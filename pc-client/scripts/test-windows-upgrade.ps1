[CmdletBinding()]
param(
  [string]$BaseInstallerPath = "",
  [string]$UpgradeInstallerPath = "",
  [string]$ExpectedUpgradeVersion = "0.1.10"
)

$ErrorActionPreference = "Stop"
if (-not $BaseInstallerPath) {
  $BaseInstallerPath = Join-Path `
    $PSScriptRoot `
    "..\release\AI-Hub-0.1.0-Windows-x64-Setup.exe"
}
if (-not $UpgradeInstallerPath) {
  $UpgradeInstallerPath = Join-Path `
    $PSScriptRoot `
    "..\release-upgrade-$ExpectedUpgradeVersion\AI-Hub-$ExpectedUpgradeVersion-Windows-x64-Setup.exe"
}

function Get-AIHubUninstallEntries {
  $roots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
  )
  $entries = @()
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root)) {
      continue
    }
    foreach ($key in Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue) {
      $value = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
      if ([string]$value.DisplayName -match '^AI Hub(?:\s+\d+\.\d+\.\d+)?$') {
        $entries += [pscustomobject]@{
          key = $key.PSPath
          name = [string]$value.DisplayName
          version = [string]$value.DisplayVersion
          location = [string]$value.InstallLocation
          displayIcon = [string]$value.DisplayIcon
          uninstall = [string]$value.UninstallString
        }
      }
    }
  }
  return $entries
}

function Get-EntryInstallDirectory {
  param($Entry)

  if ($Entry.location) {
    return [System.IO.Path]::GetFullPath($Entry.location.TrimEnd('\'))
  }
  if ($Entry.displayIcon) {
    $iconPath = ($Entry.displayIcon -replace ',\d+$', '').Trim('"')
    if ([System.IO.Path]::IsPathRooted($iconPath)) {
      return [System.IO.Path]::GetDirectoryName(
        [System.IO.Path]::GetFullPath($iconPath)
      )
    }
  }
  if ($Entry.uninstall -match '^"([^"]+)"') {
    return [System.IO.Path]::GetDirectoryName(
      [System.IO.Path]::GetFullPath($Matches[1])
    )
  }
  return ""
}

function Get-EntryAtDirectory {
  param([string]$InstallDirectory)

  $resolved = [System.IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
  return @(
    Get-AIHubUninstallEntries |
      Where-Object {
        (Get-EntryInstallDirectory -Entry $_).TrimEnd('\') -eq $resolved
      }
  )
}

function Get-ProcessesAtPath {
  param([string]$ExecutablePath)

  $resolved = [System.IO.Path]::GetFullPath($ExecutablePath)
  return @(
    Get-Process -Name "AI Hub" -ErrorAction SilentlyContinue |
      Where-Object {
        try {
          [System.IO.Path]::GetFullPath($_.Path) -eq $resolved
        } catch {
          $false
        }
      }
  )
}

function Invoke-SilentInstaller {
  param(
    [string]$Installer,
    [string]$InstallDirectory
  )

  $process = Start-Process `
    -FilePath $Installer `
    -ArgumentList @("/S", "/D=$InstallDirectory") `
    -Wait `
    -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Installer exit code: $($process.ExitCode)"
  }
}

function Stop-InstalledApplication {
  param([string]$ExecutablePath)

  $running = @(Get-ProcessesAtPath -ExecutablePath $ExecutablePath)
  if ($running.Count) {
    $running | Stop-Process -Force
  }
  return $running.Count
}

$baseInstaller = (Resolve-Path -LiteralPath $BaseInstallerPath).Path
$upgradeInstaller = (Resolve-Path -LiteralPath $UpgradeInstallerPath).Path
if ((Get-AIHubUninstallEntries).Count -ne 0) {
  throw "A registered AI Hub installation already exists; refusing upgrade test."
}

$acceptanceRoot = Join-Path $env:LOCALAPPDATA "AIHubAcceptance"
$installDirectory = Join-Path $acceptanceRoot (
  "AI-Hub-Upgrade-{0}" -f [guid]::NewGuid().ToString("N")
)
$expectedPrefix = [System.IO.Path]::GetFullPath($acceptanceRoot) +
  [System.IO.Path]::DirectorySeparatorChar
$resolvedTarget = [System.IO.Path]::GetFullPath($installDirectory)
if (-not $resolvedTarget.StartsWith(
  $expectedPrefix,
  [System.StringComparison]::OrdinalIgnoreCase
)) {
  throw "Acceptance install path escaped the expected root."
}
if (Test-Path -LiteralPath $resolvedTarget) {
  throw "Acceptance install path must not exist before the test."
}

$desktopShortcut = Join-Path (
  [Environment]::GetFolderPath("Desktop")
) "AI Hub.lnk"
$startMenuShortcut = Join-Path (
  [Environment]::GetFolderPath("Programs")
) "AI Hub.lnk"
$desktopBefore = Test-Path -LiteralPath $desktopShortcut
$startMenuBefore = Test-Path -LiteralPath $startMenuShortcut
$userDataDirectory = Join-Path $env:APPDATA "AI Hub"
$markerPath = Join-Path $userDataDirectory (
  "upgrade-acceptance-{0}.json" -f [guid]::NewGuid().ToString("N")
)
$markerCreated = $false
$baseLaunchCount = 0
$upgradeLaunchCount = 0
$cleanupExitCode = $null
$testError = $null

try {
  Invoke-SilentInstaller `
    -Installer $baseInstaller `
    -InstallDirectory $resolvedTarget
  $installedExecutable = Join-Path $resolvedTarget "AI Hub.exe"
  if (-not (Test-Path -LiteralPath $installedExecutable)) {
    throw "Base installation did not create AI Hub.exe."
  }
  $baseEntries = @(Get-EntryAtDirectory -InstallDirectory $resolvedTarget)
  if ($baseEntries.Count -ne 1 -or $baseEntries[0].version -ne "0.1.0") {
    throw "Base registry version is not exactly 0.1.0."
  }

  Start-Process -FilePath $installedExecutable | Out-Null
  Start-Sleep -Seconds 4
  $baseLaunchCount = Stop-InstalledApplication `
    -ExecutablePath $installedExecutable
  if ($baseLaunchCount -lt 1) {
    throw "Base application did not stay running."
  }

  New-Item -ItemType Directory -Path $userDataDirectory -Force | Out-Null
  $markerValue = [guid]::NewGuid().ToString("N")
  [System.IO.File]::WriteAllText(
    $markerPath,
    $markerValue,
    [System.Text.Encoding]::UTF8
  )
  $markerCreated = $true

  Invoke-SilentInstaller `
    -Installer $upgradeInstaller `
    -InstallDirectory $resolvedTarget
  if (-not (Test-Path -LiteralPath $installedExecutable)) {
    throw "Upgrade removed the installed executable."
  }
  $upgradeEntries = @(Get-EntryAtDirectory -InstallDirectory $resolvedTarget)
  if (
    $upgradeEntries.Count -ne 1 -or
    $upgradeEntries[0].version -ne $ExpectedUpgradeVersion
  ) {
    throw "Upgrade registry version is not exactly $ExpectedUpgradeVersion."
  }
  $productVersion = [string](
    Get-Item -LiteralPath $installedExecutable
  ).VersionInfo.ProductVersion
  if (-not $productVersion.StartsWith($ExpectedUpgradeVersion)) {
    throw "Installed executable version is not $ExpectedUpgradeVersion."
  }
  if (
    -not (Test-Path -LiteralPath $markerPath) -or
    [System.IO.File]::ReadAllText($markerPath) -ne $markerValue
  ) {
    throw "The user-data marker did not survive the upgrade."
  }

  Start-Process -FilePath $installedExecutable | Out-Null
  Start-Sleep -Seconds 4
  $upgradeLaunchCount = Stop-InstalledApplication `
    -ExecutablePath $installedExecutable
  if ($upgradeLaunchCount -lt 1) {
    throw "Upgraded application did not stay running."
  }
} catch {
  $testError = $_
} finally {
  if ($markerCreated -and (Test-Path -LiteralPath $markerPath)) {
    Remove-Item -LiteralPath $markerPath -Force
  }
  if (Test-Path -LiteralPath $resolvedTarget) {
    $installedExecutable = Join-Path $resolvedTarget "AI Hub.exe"
    if (Test-Path -LiteralPath $installedExecutable) {
      Stop-InstalledApplication -ExecutablePath $installedExecutable | Out-Null
    }
    $uninstaller = Get-ChildItem `
      -LiteralPath $resolvedTarget `
      -Filter "Uninstall*.exe" `
      -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($uninstaller) {
      $cleanup = Start-Process `
        -FilePath $uninstaller.FullName `
        -ArgumentList @("/currentuser", "/S") `
        -Wait `
        -PassThru
      $cleanupExitCode = $cleanup.ExitCode
    }
  }
}

$deadline = [DateTime]::UtcNow.AddSeconds(20)
while (
  (Test-Path -LiteralPath $resolvedTarget) -and
  [DateTime]::UtcNow -lt $deadline
) {
  Start-Sleep -Milliseconds 500
}

$remainingEntries = @(Get-EntryAtDirectory -InstallDirectory $resolvedTarget)
$targetRemains = Test-Path -LiteralPath $resolvedTarget
$desktopAfter = Test-Path -LiteralPath $desktopShortcut
$startMenuAfter = Test-Path -LiteralPath $startMenuShortcut
$markerRemains = Test-Path -LiteralPath $markerPath

$result = [ordered]@{
  baseInstaller = $baseInstaller
  upgradeInstaller = $upgradeInstaller
  installDirectory = $resolvedTarget
  baseVersion = "0.1.0"
  upgradeVersion = $ExpectedUpgradeVersion
  baseLaunchProcessCount = $baseLaunchCount
  upgradeLaunchProcessCount = $upgradeLaunchCount
  userDataMarkerPreserved = $markerCreated -and -not $testError
  cleanupExitCode = $cleanupExitCode
  installDirectoryRemoved = -not $targetRemains
  registryEntryRemoved = $remainingEntries.Count -eq 0
  desktopShortcutRestored = $desktopAfter -eq $desktopBefore
  startMenuShortcutRestored = $startMenuAfter -eq $startMenuBefore
  testMarkerRemoved = -not $markerRemains
  error = if ($testError) { [string]$testError } else { "" }
}
$result | ConvertTo-Json

if ($testError) {
  throw $testError
}
if (
  $cleanupExitCode -ne 0 -or
  $targetRemains -or
  $remainingEntries.Count -ne 0 -or
  $desktopAfter -ne $desktopBefore -or
  $startMenuAfter -ne $startMenuBefore -or
  $markerRemains
) {
  throw "Upgrade acceptance found residual state."
}
