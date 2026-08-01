[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("begin", "rollback", "finalize")]
  [string]$Action,
  [Parameter(Mandatory = $true)]
  [string]$ReceiptPath,
  [Parameter()]
  [ValidatePattern("^[a-f0-9]{40}$")]
  [string]$ExpectedRevision = "",
  [Parameter()]
  [ValidatePattern("^(?:0|[1-9]\d*)\.\d+\.\d+$")]
  [string]$ExpectedVersion = ""
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot "deployment\local\compose.yaml"
$ServiceImages = [ordered]@{
  "admin" = "local-admin"
  "identity-community" = "local-identity-community"
  "community" = "local-community"
}

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

function Test-DockerImageExists {
  param([Parameter(Mandatory = $true)][string]$Reference)
  $Output = & docker image inspect $Reference 2>&1
  $ExitCode = $LASTEXITCODE
  if ($ExitCode -eq 0) { return $true }
  $Text = ($Output -join "`n").Trim()
  if ($Text -match "(?im)(no such image|no such object|image .+ not found)") {
    return $false
  }
  throw "Docker image existence could not be verified: $Reference`n$Text"
}

function Get-ImageContract {
  param(
    [Parameter(Mandatory = $true)][string]$Service,
    [Parameter(Mandatory = $true)][string]$ImageId
  )
  if (-not $ImageId) { return "absent" }
  $LabelsJson = Invoke-DockerCapture @(
    "image", "inspect", $ImageId, "--format", "{{json .Config.Labels}}"
  )
  $Labels = if ($LabelsJson -and $LabelsJson -ne "null") {
    $LabelsJson | ConvertFrom-Json
  } else {
    $null
  }
  $Contract = if ($Labels) {
    [string]$Labels.'com.aihub.runtime-contract'
  } else {
    ""
  }
  if ($Contract) { return $Contract }
  if ($Service -eq "identity-community") {
    return "identity-catalog-file-v1"
  }
  return "$Service-legacy-v1"
}

function Remove-ImageTagsBestEffort {
  param(
    [Parameter(Mandatory = $true)][object[]]$Entries,
    [Parameter(Mandatory = $true)][string[]]$Properties
  )
  $Failures = @()
  foreach ($Entry in $Entries) {
    foreach ($Property in $Properties) {
      $Reference = [string]$Entry.$Property
      if (-not $Reference) { continue }
      if (-not (Test-DockerImageExists -Reference $Reference)) { continue }
      try {
        Invoke-DockerChecked @("image", "rm", $Reference)
      }
      catch {
        $Failures += $_.Exception
      }
    }
  }
  if ($Failures.Count -gt 0) {
    throw [System.AggregateException]::new(
      "one or more local service transaction image tags could not be cleaned",
      [System.Exception[]]$Failures
    )
  }
}

function Write-ReceiptAtomic {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][object]$Value
  )
  $Resolved = [System.IO.Path]::GetFullPath($Path)
  $Parent = Split-Path -Parent $Resolved
  if (-not (Test-Path -LiteralPath $Parent -PathType Container)) {
    throw "service image transaction receipt parent does not exist"
  }
  if (Test-Path -LiteralPath $Resolved) {
    throw "service image transaction receipt already exists"
  }
  $Temporary = "$Resolved.$([guid]::NewGuid().ToString('N')).tmp"
  try {
    [System.IO.File]::WriteAllText(
      $Temporary,
      (($Value | ConvertTo-Json -Depth 10) + "`n"),
      [System.Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $Temporary -Destination $Resolved
  }
  finally {
    if (Test-Path -LiteralPath $Temporary -PathType Leaf) {
      Remove-Item -LiteralPath $Temporary -Force
    }
  }
}

function Read-ReceiptStrict {
  $Resolved = [System.IO.Path]::GetFullPath($ReceiptPath)
  $Item = Get-Item -LiteralPath $Resolved
  if (
    $Item.PSIsContainer -or
    (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
  ) {
    throw "service image transaction receipt is not a trusted file"
  }
  $Output = & node scripts/local-service-image-receipt.cjs read `
    --receipt $Resolved 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "service image transaction receipt is invalid`n$($Output -join "`n")"
  }
  return (($Output -join "`n") | ConvertFrom-Json)
}

function Assert-BeginInputs {
  if (-not $ExpectedRevision -or -not $ExpectedVersion) {
    throw "begin requires ExpectedRevision and ExpectedVersion"
  }
  Invoke-NodeChecked @(
    "scripts/local-service-release-policy.cjs",
    "preflight",
    "--expected-revision", $ExpectedRevision,
    "--expected-version", $ExpectedVersion
  )
}

function Begin-ServiceImageTransaction {
  Assert-BeginInputs
  $TransactionId = [guid]::NewGuid().ToString("N").ToLowerInvariant()
  $Entries = @()
  try {
    foreach ($Pair in $ServiceImages.GetEnumerator()) {
      $Service = [string]$Pair.Key
      $ImageName = [string]$Pair.Value
      $ContainerId = Invoke-DockerCapture @(
        "compose", "-f", $ComposeFile, "ps", "-q", $Service
      )
      $ImageId = ""
      $WasRunning = $false
      if ($ContainerId) {
        $Inspection = Invoke-DockerCapture @("inspect", $ContainerId) |
          ConvertFrom-Json
        $Container = @($Inspection)[0]
        $ImageId = [string]$Container.Image
        $ImageName = [string]$Container.Config.Image
        $WasRunning = [bool]$Container.State.Running
      }
      else {
        $ImageId = (
          Invoke-DockerCapture @(
            "compose", "-f", $ComposeFile, "images", "-q", $Service
          ) -split "`r?`n"
        )[0]
        if ($ImageId -and -not $ImageId.StartsWith("sha256:")) {
          $ImageId = "sha256:$ImageId"
        }
      }
      if ($ImageId -and $ImageId -notmatch "^sha256:[a-f0-9]{64}$") {
        throw "local service image identity is invalid: $Service"
      }
      $BackupTag = "aihub-local-release-backup:$TransactionId-$Service"
      $CandidateTag = "aihub-local-release-candidate:$TransactionId-$Service"
      $Entries += [pscustomobject]@{
        service = $Service
        liveImageName = [string]$Pair.Value
        previousImageId = $ImageId
        previousImageName = $ImageName
        previousContainerId = $ContainerId
        previousRuntimeContract = Get-ImageContract $Service $ImageId
        wasRunning = $WasRunning
        backupTag = $BackupTag
        candidateTag = $CandidateTag
        candidateImageId = ""
        candidateVerified = $false
      }
    }
    $ContractPath = "$ReceiptPath.contracts.$([guid]::NewGuid().ToString('N')).json"
    try {
      $Contracts = @($Entries | ForEach-Object {
        [pscustomobject]@{
          service = $_.service
          runtimeContract = $_.previousRuntimeContract
        }
      })
      [System.IO.File]::WriteAllText(
        [System.IO.Path]::GetFullPath($ContractPath),
        (($Contracts | ConvertTo-Json -Depth 4) + "`n"),
        [System.Text.UTF8Encoding]::new($false)
      )
      Invoke-NodeChecked @(
        "scripts/local-service-release-policy.cjs",
        "verify-previous-contracts",
        "--input", ([System.IO.Path]::GetFullPath($ContractPath))
      )
    }
    finally {
      if (Test-Path -LiteralPath $ContractPath -PathType Leaf) {
        Remove-Item -LiteralPath $ContractPath -Force
      }
    }
    $Receipt = [pscustomobject]@{
      schemaVersion = 2
      transactionId = $TransactionId
      createdAt = [DateTime]::UtcNow.ToString("o")
      expectedRevision = $ExpectedRevision
      expectedVersion = $ExpectedVersion
      phase = "begun"
      services = $Entries
    }
    Write-ReceiptAtomic -Path $ReceiptPath -Value $Receipt
    foreach ($Entry in $Entries) {
      if ($Entry.previousImageId) {
        Invoke-DockerChecked @(
          "image", "tag", [string]$Entry.previousImageId, [string]$Entry.backupTag
        )
      }
    }
    Read-ReceiptStrict | ConvertTo-Json -Depth 10
  }
  catch {
    Remove-ImageTagsBestEffort -Entries $Entries -Properties @("backupTag")
    throw
  }
}

function Restore-ServiceImages {
  $Receipt = Read-ReceiptStrict
  $Restorable = @($Receipt.services | Where-Object { $_.previousImageId })
  foreach ($Entry in $Restorable) {
    if (-not (Test-DockerImageExists -Reference $Entry.backupTag)) {
      if (-not (Test-DockerImageExists -Reference $Entry.previousImageId)) {
        throw "local service rollback image is missing: $($Entry.service)"
      }
      Invoke-DockerChecked @(
        "image", "tag", [string]$Entry.previousImageId, [string]$Entry.backupTag
      )
    }
    $BackupId = Invoke-DockerCapture @(
      "image", "inspect", [string]$Entry.backupTag, "--format", "{{.Id}}"
    )
    if ($BackupId -ne [string]$Entry.previousImageId) {
      throw "local service rollback image identity changed: $($Entry.service)"
    }
    Invoke-DockerChecked @(
      "image", "tag", [string]$Entry.backupTag, [string]$Entry.previousImageName
    )
  }

  if ($Restorable.Count -gt 0) {
    $Services = @($Restorable | ForEach-Object { [string]$_.service })
    Invoke-DockerChecked -Arguments (@(
      "compose", "-f", $ComposeFile, "up", "-d", "--pull", "never",
      "--no-build", "--force-recreate", "--wait"
    ) + $Services)
    foreach ($Entry in $Restorable) {
      $ContainerId = Invoke-DockerCapture @(
        "compose", "-f", $ComposeFile, "ps", "-q", [string]$Entry.service
      )
      $ActualImage = Invoke-DockerCapture @(
        "inspect", $ContainerId, "--format", "{{.Image}}"
      )
      if ($ActualImage -ne [string]$Entry.previousImageId) {
        throw "local service rollback did not restore exact image: $($Entry.service)"
      }
    }
  }

  foreach ($Entry in @($Receipt.services | Where-Object { -not $_.previousImageId })) {
    Remove-RejectedFirstReleaseImage -Entry $Entry
  }
  foreach ($Entry in @($Restorable | Where-Object { -not $_.wasRunning })) {
    Invoke-DockerChecked @(
      "compose", "-f", $ComposeFile, "stop", "--timeout", "10",
      [string]$Entry.service
    )
  }
  Invoke-NodeChecked @(
    "scripts/local-service-image-receipt.cjs",
    "mark-rolled-back",
    "--receipt", ([System.IO.Path]::GetFullPath($ReceiptPath))
  )
  [pscustomobject]@{ ok = $true; restored = @($Restorable.service) } |
    ConvertTo-Json -Depth 4
}

function Remove-RejectedFirstReleaseImage {
  param([Parameter(Mandatory = $true)][object]$Entry)
  Invoke-DockerChecked @(
    "compose", "-f", $ComposeFile, "rm", "-f", "-s", [string]$Entry.service
  )
  if (Test-DockerImageExists -Reference ([string]$Entry.liveImageName)) {
    Invoke-DockerChecked @("image", "rm", "--force", [string]$Entry.liveImageName)
  }
  if (Test-DockerImageExists -Reference ([string]$Entry.liveImageName)) {
    throw "rejected local service image still exists: $($Entry.service)"
  }
  $ContainerId = Invoke-DockerCapture @(
    "compose", "-f", $ComposeFile, "ps", "-q", [string]$Entry.service
  )
  if ($ContainerId) {
    throw "rejected local service container still exists: $($Entry.service)"
  }
}

function Finalize-ServiceImages {
  $Receipt = Read-ReceiptStrict
  if ($Receipt.phase -notin @("promoted", "rolled-back")) {
    throw "local service image transaction is not ready to finalize"
  }
  Remove-ImageTagsBestEffort `
    -Entries @($Receipt.services) `
    -Properties @("backupTag", "candidateTag")
  [pscustomobject]@{
    ok = $true
    finalized = @($Receipt.services.service)
    phase = [string]$Receipt.phase
  } | ConvertTo-Json -Depth 4
}

Push-Location $ProjectRoot
try {
  switch ($Action) {
    "begin" { Begin-ServiceImageTransaction }
    "rollback" { Restore-ServiceImages }
    "finalize" { Finalize-ServiceImages }
  }
}
finally {
  Pop-Location
}
