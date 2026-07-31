[CmdletBinding()]
param(
  [string]$InstallerPath = ""
)

$ErrorActionPreference = "Stop"
if (-not $InstallerPath) {
  $InstallerPath = Join-Path `
    $PSScriptRoot `
    "..\release\AI-Hub-0.1.8-Windows-x64-Setup.exe"
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

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$acceptanceRoot = Join-Path $env:LOCALAPPDATA "AIHubAcceptance"
$installDirectory = Join-Path $acceptanceRoot (
  "AI-Hub-{0}" -f [guid]::NewGuid().ToString("N")
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
$acceptanceUserData = Join-Path $acceptanceRoot (
  "UserData-{0}" -f [guid]::NewGuid().ToString("N")
)
$resolvedUserData = [System.IO.Path]::GetFullPath($acceptanceUserData)
if (-not $resolvedUserData.StartsWith(
  $expectedPrefix,
  [System.StringComparison]::OrdinalIgnoreCase
)) {
  throw "Acceptance user-data path escaped the expected root."
}
if (Test-Path -LiteralPath $resolvedTarget) {
  throw "Acceptance install path must not exist before the test."
}

$beforeEntries = @(Get-AIHubUninstallEntries)
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "AI Hub.lnk"
$startMenuShortcut = Join-Path (
  [Environment]::GetFolderPath("Programs")
) "AI Hub.lnk"
$desktopBefore = Test-Path -LiteralPath $desktopShortcut
$startMenuBefore = Test-Path -LiteralPath $startMenuShortcut

$installProcess = Start-Process `
  -FilePath $installer `
  -ArgumentList @("/S", "/D=$resolvedTarget") `
  -Wait `
  -PassThru
if ($installProcess.ExitCode -ne 0) {
  throw "Installer exit code: $($installProcess.ExitCode)"
}

$installedExecutable = Join-Path $resolvedTarget "AI Hub.exe"
if (-not (Test-Path -LiteralPath $installedExecutable)) {
  throw "AI Hub.exe was not found after installation."
}
$afterInstallEntries = @(Get-AIHubUninstallEntries)
$newEntries = @(
  $afterInstallEntries |
    Where-Object {
      $candidate = Get-EntryInstallDirectory -Entry $_
      $candidate -eq $resolvedTarget.TrimEnd('\')
    }
)
if ($newEntries.Count -ne 1) {
  throw "A unique acceptance uninstall registry entry was not found."
}

$appProcess = Start-Process `
  -FilePath $installedExecutable `
  -ArgumentList @("--user-data-dir=$resolvedUserData") `
  -PassThru
Start-Sleep -Seconds 4
$running = @(Get-ProcessesAtPath -ExecutablePath $installedExecutable)
if ($running.Count -lt 1) {
  throw "The installed application did not stay running."
}
$appProcess.Refresh()
$closeRequested = $appProcess.CloseMainWindow()
if (-not $closeRequested) {
  throw "The installed application did not expose a closable main window."
}
Start-Sleep -Seconds 2
$runningAfterClose = @(Get-ProcessesAtPath -ExecutablePath $installedExecutable)
if ($runningAfterClose.Count -lt 1) {
  throw "Closing the main window stopped the tray application."
}
$stayedRunningAfterClose = $true
$running | Stop-Process -Force
$appProcess.WaitForExit(10000) | Out-Null
if (Test-Path -LiteralPath $resolvedUserData) {
  Remove-Item -LiteralPath $resolvedUserData -Recurse -Force
}
$userDataRemoved = -not (Test-Path -LiteralPath $resolvedUserData)

$uninstaller = Get-ChildItem `
  -LiteralPath $resolvedTarget `
  -Filter "Uninstall*.exe" |
  Select-Object -First 1
if (-not $uninstaller) {
  throw "The uninstaller was not found."
}
$uninstallProcess = Start-Process `
  -FilePath $uninstaller.FullName `
  -ArgumentList @("/S") `
  -Wait `
  -PassThru
if ($uninstallProcess.ExitCode -ne 0) {
  throw "Uninstaller exit code: $($uninstallProcess.ExitCode)"
}

$deadline = [DateTime]::UtcNow.AddSeconds(20)
while (
  (Test-Path -LiteralPath $resolvedTarget) -and
  [DateTime]::UtcNow -lt $deadline
) {
  Start-Sleep -Milliseconds 500
}

$afterUninstallEntries = @(Get-AIHubUninstallEntries)
$remainingEntry = @(
  $afterUninstallEntries |
    Where-Object {
      (Get-EntryInstallDirectory -Entry $_) -eq
        $resolvedTarget.TrimEnd('\')
    }
)
$targetRemains = Test-Path -LiteralPath $resolvedTarget
$desktopAfter = Test-Path -LiteralPath $desktopShortcut
$startMenuAfter = Test-Path -LiteralPath $startMenuShortcut

$result = [ordered]@{
  installer = $installer
  installDirectory = $resolvedTarget
  installExitCode = $installProcess.ExitCode
  launchedProcessCount = $running.Count
  closeRequested = $closeRequested
  stayedRunningAfterClose = $stayedRunningAfterClose
  uninstallExitCode = $uninstallProcess.ExitCode
  installDirectoryRemoved = -not $targetRemains
  isolatedUserDataRemoved = $userDataRemoved
  registryEntryRemoved = $remainingEntry.Count -eq 0
  desktopShortcutRestored = $desktopAfter -eq $desktopBefore
  startMenuShortcutRestored = $startMenuAfter -eq $startMenuBefore
  preExistingRegistrationCount = $beforeEntries.Count
}

$result | ConvertTo-Json

if (
  $targetRemains -or
  -not $userDataRemoved -or
  $remainingEntry.Count -ne 0 -or
  $desktopAfter -ne $desktopBefore -or
  $startMenuAfter -ne $startMenuBefore
) {
  throw "Installer lifecycle acceptance found residual state."
}
