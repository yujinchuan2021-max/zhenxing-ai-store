[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("stage", "promote")]
  [string]$Action,
  [Parameter(Mandatory = $true)]
  [string]$ReceiptPath,
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[a-f0-9]{40}$")]
  [string]$ExpectedRevision,
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^(?:0|[1-9]\d*)\.\d+\.\d+$")]
  [string]$ExpectedVersion
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RepositoryRoot = (& git -C $ProjectRoot rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or -not $RepositoryRoot) {
  throw "local service release repository root is unavailable"
}
$ComposeFile = Join-Path $ProjectRoot "deployment\local\compose.yaml"
$ResolvedReceipt = [System.IO.Path]::GetFullPath($ReceiptPath)
$ManifestPath = "$ResolvedReceipt.manifest.json"
$CandidatesPath = "$ResolvedReceipt.candidates.json"

function Invoke-DockerCapture {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  $Output = & docker @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "docker command failed: docker $($Arguments -join ' ')`n$($Output -join "`n")"
  }
  return ($Output -join "`n").Trim()
}

function Invoke-DockerChecked {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker command failed: docker $($Arguments -join ' ')"
  }
}

function Invoke-NodeChecked {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  & node @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "node command failed: node $($Arguments -join ' ')"
  }
}

function Invoke-SourcePreflight {
  Invoke-NodeChecked @(
    "scripts/local-service-release-policy.cjs",
    "preflight",
    "--expected-revision", $ExpectedRevision,
    "--expected-version", $ExpectedVersion
  )
}

function Read-TrustedJson {
  param([Parameter(Mandatory = $true)][string]$Path)
  $Item = Get-Item -LiteralPath $Path
  if (
    $Item.PSIsContainer -or
    (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) -or
    $Item.Length -lt 2 -or
    $Item.Length -gt 4MB
  ) {
    throw "local service release JSON file is not trusted: $Path"
  }
  return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json
}

function Read-ServiceReceipt {
  $Output = & node scripts/local-service-image-receipt.cjs read `
    --receipt $ResolvedReceipt 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "local service image receipt is invalid`n$($Output -join "`n")"
  }
  $Receipt = ($Output -join "`n") | ConvertFrom-Json
  if (
    [string]$Receipt.expectedRevision -ne $ExpectedRevision -or
    [string]$Receipt.expectedVersion -ne $ExpectedVersion
  ) {
    throw "local service image receipt source differs from the requested release"
  }
  return $Receipt
}

function Write-JsonExclusive {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][object]$Value
  )
  if (Test-Path -LiteralPath $Path) {
    throw "local service release output already exists: $Path"
  }
  [System.IO.File]::WriteAllText(
    $Path,
    (($Value | ConvertTo-Json -Depth 20) + "`n"),
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Assert-LiveContainersUnchanged {
  param([Parameter(Mandatory = $true)][object]$Receipt)
  foreach ($Entry in @($Receipt.services)) {
    $CurrentContainer = Invoke-DockerCapture @(
      "compose", "-f", $ComposeFile, "ps", "-q", [string]$Entry.service
    )
    if ($CurrentContainer -ne [string]$Entry.previousContainerId) {
      throw "candidate staging changed a live container: $($Entry.service)"
    }
    if ($CurrentContainer) {
      $CurrentImage = Invoke-DockerCapture @(
        "inspect", $CurrentContainer, "--format", "{{.Image}}"
      )
      if ($CurrentImage -ne [string]$Entry.previousImageId) {
        throw "candidate staging changed a live image: $($Entry.service)"
      }
    }
  }
}

function New-RevisionSnapshot {
  param([Parameter(Mandatory = $true)][string]$Destination)
  $Archive = Join-Path $Destination "source.tar"
  $Extracted = Join-Path $Destination "source"
  New-Item -ItemType Directory -Path $Extracted | Out-Null
  # git archive follows core.autocrlf on Windows unless it is overridden.
  # The release manifest hashes immutable Git blobs, so the build snapshot must
  # preserve those exact LF bytes instead of exporting CRLF worktree bytes.
  & git -c core.autocrlf=false -C $RepositoryRoot archive `
    --format=tar `
    "--output=$Archive" `
    $ExpectedRevision `
    -- pc-client
  if ($LASTEXITCODE -ne 0) {
    throw "unable to archive the exact tagged local service source"
  }
  & tar.exe -xf $Archive -C $Extracted
  if ($LASTEXITCODE -ne 0) {
    throw "unable to extract the exact tagged local service source"
  }
  $SnapshotProject = Join-Path $Extracted "pc-client"
  if (-not (Test-Path -LiteralPath $SnapshotProject -PathType Container)) {
    throw "tagged local service source snapshot is incomplete"
  }
  return $SnapshotProject
}

function Build-CandidateImage {
  param(
    [Parameter(Mandatory = $true)][object]$ManifestService,
    [Parameter(Mandatory = $true)][object]$ReceiptEntry,
    [Parameter(Mandatory = $true)][string]$SnapshotProject
  )
  $Context = [System.IO.Path]::GetFullPath(
    (Join-Path $SnapshotProject ([string]$ManifestService.dockerContext))
  )
  $Dockerfile = [System.IO.Path]::GetFullPath(
    (Join-Path $SnapshotProject ([string]$ManifestService.dockerfile))
  )
  if (
    -not (Test-Path -LiteralPath $Context -PathType Container) -or
    -not (Test-Path -LiteralPath $Dockerfile -PathType Leaf)
  ) {
    throw "candidate Docker build source is incomplete: $($ManifestService.service)"
  }
  $Arguments = @(
    "build",
    "--no-cache",
    "--file", $Dockerfile,
    "--tag", [string]$ReceiptEntry.candidateTag,
    "--build-arg", "AIHUB_SOURCE_REVISION=$ExpectedRevision",
    "--build-arg", "AIHUB_RELEASE_VERSION=$ExpectedVersion"
  )
  foreach ($Property in @($ManifestService.buildArgs.PSObject.Properties)) {
    $Arguments += @("--build-arg", "$($Property.Name)=$($Property.Value)")
  }
  $Arguments += $Context
  Invoke-DockerChecked -Arguments $Arguments
}

function Get-CandidateFileHashes {
  param(
    [Parameter(Mandatory = $true)][string]$CandidateTag,
    [Parameter(Mandatory = $true)][object[]]$SourceFiles
  )
  $Hashes = @()
  for ($Offset = 0; $Offset -lt $SourceFiles.Count; $Offset += 24) {
    $Last = [Math]::Min($Offset + 23, $SourceFiles.Count - 1)
    $Chunk = @($SourceFiles[$Offset..$Last])
    $Paths = @($Chunk | ForEach-Object { [string]$_.containerPath })
    $Output = Invoke-DockerCapture (@(
      "run", "--rm", "--network", "none", "--entrypoint", "sha256sum",
      $CandidateTag
    ) + $Paths)
    $Lines = @($Output -split "`r?`n" | Where-Object { $_ })
    if ($Lines.Count -ne $Chunk.Count) {
      throw "candidate image returned an incomplete source hash set"
    }
    foreach ($Line in $Lines) {
      $Match = [regex]::Match($Line, "^([a-f0-9]{64})\s+(.+)$")
      if (-not $Match.Success) {
        throw "candidate image returned an invalid source hash"
      }
      $Hashes += [pscustomobject]@{
        containerPath = $Match.Groups[2].Value.Trim()
        sha256 = $Match.Groups[1].Value.ToLowerInvariant()
      }
    }
  }
  return $Hashes
}

function Verify-CandidateImage {
  param(
    [Parameter(Mandatory = $true)][object]$ManifestService,
    [Parameter(Mandatory = $true)][object]$ReceiptEntry,
    [Parameter(Mandatory = $true)][string]$InspectionPath
  )
  $ImageId = Invoke-DockerCapture @(
    "image", "inspect", [string]$ReceiptEntry.candidateTag,
    "--format", "{{.Id}}"
  )
  $LabelsJson = Invoke-DockerCapture @(
    "image", "inspect", [string]$ReceiptEntry.candidateTag,
    "--format", "{{json .Config.Labels}}"
  )
  $Inspection = [pscustomobject]@{
    service = [string]$ManifestService.service
    imageId = $ImageId
    labels = if ($LabelsJson -eq "null") { @{} } else { $LabelsJson | ConvertFrom-Json }
    fileHashes = @(Get-CandidateFileHashes `
      -CandidateTag ([string]$ReceiptEntry.candidateTag) `
      -SourceFiles @($ManifestService.sourceFiles))
  }
  Write-JsonExclusive -Path $InspectionPath -Value $Inspection
  Invoke-NodeChecked @(
    "scripts/local-service-release-policy.cjs",
    "verify-candidate",
    "--manifest", $ManifestPath,
    "--inspection", $InspectionPath
  ) | Out-Null
  return [pscustomobject]@{
    service = [string]$ManifestService.service
    candidateTag = [string]$ReceiptEntry.candidateTag
    imageId = $ImageId
  }
}

function Stage-Candidates {
  Invoke-SourcePreflight
  $Receipt = Read-ServiceReceipt
  if ($Receipt.phase -ne "begun") {
    throw "local service candidates can only be staged from a begun transaction"
  }
  Assert-LiveContainersUnchanged -Receipt $Receipt
  $Temporary = Join-Path (
    [System.IO.Path]::GetTempPath()
  ) ("aihub-local-service-stage-{0}" -f [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $Temporary | Out-Null
  try {
    Invoke-NodeChecked @(
      "scripts/local-service-release-policy.cjs",
      "manifest",
      "--expected-revision", $ExpectedRevision,
      "--expected-version", $ExpectedVersion,
      "--output", $ManifestPath
    )
    $Manifest = Read-TrustedJson -Path $ManifestPath
    $SnapshotProject = New-RevisionSnapshot -Destination $Temporary
    $Candidates = @()
    foreach ($ManifestService in @($Manifest.services)) {
      $ReceiptEntry = @(
        $Receipt.services | Where-Object { $_.service -eq $ManifestService.service }
      )[0]
      if (-not $ReceiptEntry) {
        throw "local service manifest differs from its image receipt"
      }
      Build-CandidateImage `
        -ManifestService $ManifestService `
        -ReceiptEntry $ReceiptEntry `
        -SnapshotProject $SnapshotProject
      Invoke-SourcePreflight
      $InspectionPath = Join-Path $Temporary (
        "inspection-{0}.json" -f [string]$ManifestService.service
      )
      $Candidates += Verify-CandidateImage `
        -ManifestService $ManifestService `
        -ReceiptEntry $ReceiptEntry `
        -InspectionPath $InspectionPath
      Assert-LiveContainersUnchanged -Receipt $Receipt
    }
    Invoke-SourcePreflight
    Assert-LiveContainersUnchanged -Receipt $Receipt
    Write-JsonExclusive -Path $CandidatesPath -Value @($Candidates)
    Invoke-NodeChecked @(
      "scripts/local-service-image-receipt.cjs",
      "mark-staged",
      "--receipt", $ResolvedReceipt,
      "--candidates", $CandidatesPath
    )
    Write-Host "Local service candidate images staged and verified offline."
  }
  finally {
    if (Test-Path -LiteralPath $Temporary -PathType Container) {
      Remove-Item -LiteralPath $Temporary -Recurse -Force
    }
  }
}

function Assert-CandidatesStillVerified {
  param(
    [Parameter(Mandatory = $true)][object]$Receipt,
    [Parameter(Mandatory = $true)][object]$Manifest
  )
  $Temporary = Join-Path (
    [System.IO.Path]::GetTempPath()
  ) ("aihub-local-service-promote-{0}" -f [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $Temporary | Out-Null
  try {
    foreach ($ManifestService in @($Manifest.services)) {
      $Entry = @(
        $Receipt.services | Where-Object { $_.service -eq $ManifestService.service }
      )[0]
      if (-not $Entry -or -not $Entry.candidateVerified) {
        throw "local service candidate receipt is incomplete"
      }
      $ActualId = Invoke-DockerCapture @(
        "image", "inspect", [string]$Entry.candidateTag,
        "--format", "{{.Id}}"
      )
      if ($ActualId -ne [string]$Entry.candidateImageId) {
        throw "local service candidate image identity changed: $($Entry.service)"
      }
      $InspectionPath = Join-Path $Temporary (
        "inspection-{0}.json" -f [string]$Entry.service
      )
      Verify-CandidateImage `
        -ManifestService $ManifestService `
        -ReceiptEntry $Entry `
        -InspectionPath $InspectionPath | Out-Null
    }
  }
  finally {
    if (Test-Path -LiteralPath $Temporary -PathType Container) {
      Remove-Item -LiteralPath $Temporary -Recurse -Force
    }
  }
}

function Promote-Candidates {
  Invoke-SourcePreflight
  $Receipt = Read-ServiceReceipt
  if ($Receipt.phase -ne "staged") {
    throw "only a fully staged local service image set can be promoted"
  }
  $Manifest = Read-TrustedJson -Path $ManifestPath
  Assert-LiveContainersUnchanged -Receipt $Receipt
  Assert-CandidatesStillVerified -Receipt $Receipt -Manifest $Manifest
  Invoke-SourcePreflight
  Assert-LiveContainersUnchanged -Receipt $Receipt

  foreach ($Entry in @($Receipt.services)) {
    Invoke-DockerChecked @(
      "image", "tag", [string]$Entry.candidateTag, [string]$Entry.liveImageName
    )
  }
  Invoke-DockerChecked @(
    "compose", "-f", $ComposeFile, "up", "-d", "--pull", "never",
    "--no-build", "--force-recreate", "--wait",
    "admin", "identity-community", "community"
  )
  foreach ($Entry in @($Receipt.services)) {
    $ContainerId = Invoke-DockerCapture @(
      "compose", "-f", $ComposeFile, "ps", "-q", [string]$Entry.service
    )
    $ActualImage = Invoke-DockerCapture @(
      "inspect", $ContainerId, "--format", "{{.Image}}"
    )
    if ($ActualImage -ne [string]$Entry.candidateImageId) {
      throw "promoted local service container uses the wrong image: $($Entry.service)"
    }
  }
  Invoke-SourcePreflight
  Invoke-NodeChecked @(
    "scripts/local-service-image-receipt.cjs",
    "mark-promoted",
    "--receipt", $ResolvedReceipt
  )
  Write-Host "Local service candidate images promoted after offline verification."
}

Push-Location $ProjectRoot
try {
  switch ($Action) {
    "stage" { Stage-Candidates }
    "promote" { Promote-Candidates }
  }
}
finally {
  Pop-Location
}
