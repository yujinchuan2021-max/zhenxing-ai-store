$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot "deployment\local\compose.yaml"

function Get-ContainerSha256 {
  param(
    [Parameter(Mandatory = $true)][string]$Service,
    [Parameter(Mandatory = $true)][string]$ContainerPath
  )
  $Output = & docker compose -f $ComposeFile exec -T $Service `
    sha256sum $ContainerPath 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "container source hash failed: $Service $ContainerPath`n$($Output -join "`n")"
  }
  $HashMatch = [regex]::Match(
    ($Output -join "`n"),
    "(?im)^([0-9a-f]{64})\s+"
  )
  if (-not $HashMatch.Success) {
    throw "container source hash is invalid: $Service $ContainerPath"
  }
  return $HashMatch.Groups[1].Value.ToLowerInvariant()
}

function Assert-ContainerSourceMatches {
  param(
    [Parameter(Mandatory = $true)][string]$Service,
    [Parameter(Mandatory = $true)][string]$HostRelativePath,
    [Parameter(Mandatory = $true)][string]$ContainerPath
  )
  $HostPath = Join-Path $ProjectRoot $HostRelativePath
  if (-not (Test-Path -LiteralPath $HostPath -PathType Leaf)) {
    throw "host source file is missing: $HostRelativePath"
  }
  $HostHash = (Get-FileHash -LiteralPath $HostPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $ContainerHash = Get-ContainerSha256 `
    -Service $Service `
    -ContainerPath $ContainerPath
  if ($HostHash -ne $ContainerHash) {
    throw "container source drift detected: $Service $HostRelativePath"
  }
}

function New-SourceManifestEntry {
  param(
    [Parameter(Mandatory = $true)][string]$HostRelativePath,
    [Parameter(Mandatory = $true)][string]$ContainerPath
  )
  return [pscustomobject]@{
    HostRelativePath = $HostRelativePath.Replace("\", "/")
    ContainerPath = $ContainerPath.Replace("\", "/")
  }
}

function Get-RelativePathUnder {
  param(
    [Parameter(Mandatory = $true)][string]$BasePath,
    [Parameter(Mandatory = $true)][string]$FullPath
  )
  $ResolvedBase = [System.IO.Path]::GetFullPath($BasePath).TrimEnd("\") + "\"
  $ResolvedFull = [System.IO.Path]::GetFullPath($FullPath)
  if (-not $ResolvedFull.StartsWith(
    $ResolvedBase,
    [System.StringComparison]::OrdinalIgnoreCase
  )) {
    throw "container source path escaped its expected host root: $FullPath"
  }
  return $ResolvedFull.Substring($ResolvedBase.Length)
}

function Get-AdminSourceManifest {
  $Entries = @()
  $AdminRoot = Join-Path $ProjectRoot "admin"
  foreach ($File in Get-ChildItem -LiteralPath $AdminRoot -Recurse -File -Filter "*.cjs") {
    $Relative = Get-RelativePathUnder $ProjectRoot $File.FullName
    if ($Relative -match "^admin[\\/](?:data|published)[\\/]") { continue }
    $Entries += New-SourceManifestEntry $Relative ("/app/{0}" -f $Relative)
  }
  foreach ($Directory in @("admin/public", "shared")) {
    foreach ($File in Get-ChildItem -LiteralPath (Join-Path $ProjectRoot $Directory) -Recurse -File) {
      $Relative = Get-RelativePathUnder $ProjectRoot $File.FullName
      $Entries += New-SourceManifestEntry $Relative ("/app/{0}" -f $Relative)
    }
  }
  $Entries += New-SourceManifestEntry `
    "scripts/discover-official-products.mjs" `
    "/app/scripts/discover-official-products.mjs"
  return $Entries
}

function Get-IdentitySourceManifest {
  $Entries = @()
  foreach ($File in Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "identity") -Recurse -File) {
    if ($File.FullName -match "[\\/]node_modules[\\/]") { continue }
    $RelativeInsideIdentity = Get-RelativePathUnder `
      -BasePath (Join-Path $ProjectRoot "identity") `
      -FullPath $File.FullName
    $HostRelative = "identity/{0}" -f $RelativeInsideIdentity
    $Entries += New-SourceManifestEntry `
      $HostRelative `
      ("/app/identity/{0}" -f $RelativeInsideIdentity)
  }
  foreach ($HostRelative in @(
    "shared/identity-security.cjs",
    "shared/avatar-image.cjs"
  )) {
    $Entries += New-SourceManifestEntry $HostRelative ("/app/{0}" -f $HostRelative)
  }
  return $Entries
}

function Get-CommunitySourceManifest {
  return @(
    New-SourceManifestEntry "community/flarum/apache.conf" "/etc/apache2/conf-available/flarum.conf"
    New-SourceManifestEntry "community/flarum/docker-entrypoint.sh" "/usr/local/bin/aihub-flarum-entrypoint"
    New-SourceManifestEntry "community/flarum/aihub-sso.php" "/var/www/html/public/aihub-sso.php"
    New-SourceManifestEntry "community/flarum/aihub-personal-center.php" "/var/www/html/public/aihub-personal-center.php"
  )
}

function Test-ContainerSourceManifest {
  param(
    [Parameter(Mandatory = $true)][string]$Service,
    [Parameter(Mandatory = $true)][object[]]$Entries
  )
  $Matches = $true
  foreach ($Entry in $Entries) {
    try {
      Assert-ContainerSourceMatches `
        -Service $Service `
        -HostRelativePath $Entry.HostRelativePath `
        -ContainerPath $Entry.ContainerPath
    }
    catch {
      Write-Warning $_.Exception.Message
      $Matches = $false
    }
  }
  return $Matches
}

function Stop-SelfBuiltServiceFailClosed {
  param([Parameter(Mandatory = $true)][string]$Service)
  & docker compose -f $ComposeFile stop --timeout 10 $Service
  if ($LASTEXITCODE -ne 0) {
    & docker compose -f $ComposeFile kill $Service
  }
  $Running = & docker compose -f $ComposeFile ps --status running -q $Service
  if ($LASTEXITCODE -ne 0 -or $Running) {
    throw "unverified Docker service could not be stopped: $Service"
  }
}

function Stop-AllSelfBuiltServicesFailClosed {
  $Failures = @()
  foreach ($Service in @("admin", "identity-community", "community")) {
    try {
      Stop-SelfBuiltServiceFailClosed -Service $Service
    }
    catch {
      $Failures += $_.Exception
    }
  }
  if ($Failures.Count -gt 0) {
    throw [System.AggregateException]::new(
      "one or more unverified Docker services could not be stopped",
      [System.Exception[]]$Failures
    )
  }
}

function Repair-SelfBuiltServiceImage {
  param([Parameter(Mandatory = $true)][string]$Service)
  & docker compose -f $ComposeFile build --no-cache $Service
  if ($LASTEXITCODE -ne 0) {
    Stop-SelfBuiltServiceFailClosed -Service $Service
    throw "no-cache Docker rebuild failed: $Service"
  }
  & docker compose -f $ComposeFile up -d --force-recreate --wait $Service
  if ($LASTEXITCODE -ne 0) {
    Stop-SelfBuiltServiceFailClosed -Service $Service
    throw "Docker service recreation failed after no-cache rebuild: $Service"
  }
}

function Assert-SelfBuiltServiceSources {
  param(
    [Parameter(Mandatory = $true)][string]$Service,
    [Parameter(Mandatory = $true)][object[]]$Entries
  )
  if (Test-ContainerSourceManifest -Service $Service -Entries $Entries) {
    return
  }
  # Once drift is known, take the unverified service offline before repair.
  Stop-SelfBuiltServiceFailClosed -Service $Service
  Repair-SelfBuiltServiceImage -Service $Service
  if (-not (Test-ContainerSourceManifest -Service $Service -Entries $Entries)) {
    Stop-SelfBuiltServiceFailClosed -Service $Service
    throw "container source drift remains after no-cache rebuild: $Service"
  }
}

function Assert-SelfBuiltContainerSources {
  $AdminSources = @(Get-AdminSourceManifest)
  $IdentitySources = @(Get-IdentitySourceManifest)
  $CommunitySources = @(Get-CommunitySourceManifest)
  if (-not ($AdminSources.HostRelativePath -contains "admin/public/app.js")) {
    throw "admin/public/app.js is missing from the container source manifest"
  }
  if (-not ($IdentitySources.HostRelativePath -contains "identity/server.cjs")) {
    throw "identity/server.cjs is missing from the container source manifest"
  }
  if (-not ($CommunitySources.HostRelativePath -contains "community/flarum/aihub-sso.php")) {
    throw "community/flarum/aihub-sso.php is missing from the container source manifest"
  }
  Assert-SelfBuiltServiceSources -Service "admin" -Entries $AdminSources
  Assert-SelfBuiltServiceSources -Service "identity-community" -Entries $IdentitySources
  Assert-SelfBuiltServiceSources -Service "community" -Entries $CommunitySources
}

Push-Location $ProjectRoot
try {
  $SourcesVerified = $false
  try {
    & docker compose -f $ComposeFile up -d --build --force-recreate --wait `
      admin identity-community community
    if ($LASTEXITCODE -ne 0) {
      throw "self-built Docker service rebuild failed"
    }
    Assert-SelfBuiltContainerSources
    $SourcesVerified = $true
  }
  finally {
    if (-not $SourcesVerified) {
      Stop-AllSelfBuiltServicesFailClosed
    }
  }
  Write-Host "Self-built Docker services rebuilt and source hashes verified."
}
finally {
  Pop-Location
}
