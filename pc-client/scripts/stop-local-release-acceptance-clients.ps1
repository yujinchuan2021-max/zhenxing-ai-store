[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$DeliveryDirectory
)

$ErrorActionPreference = "Stop"

$ResolvedDelivery = [System.IO.Path]::GetFullPath($DeliveryDirectory).TrimEnd("\")
if ([System.IO.Path]::GetFileName($ResolvedDelivery) -ne "release-local-server-client") {
  throw "local acceptance client delivery directory is invalid"
}
$Delivery = Get-Item -LiteralPath $ResolvedDelivery
if (
  -not $Delivery.PSIsContainer -or
  ($Delivery.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
) {
  throw "local acceptance client delivery directory is not trusted"
}

$PortableName = '^AI-Hub-Local-(?:0|[1-9][0-9]*)\.[0-9]+\.[0-9]+-Windows-x64-Portable\.exe$'
$Stopped = 0
foreach ($Candidate in @(Get-CimInstance Win32_Process)) {
  if (-not $Candidate.ExecutablePath) {
    continue
  }
  $Executable = [System.IO.Path]::GetFullPath([string]$Candidate.ExecutablePath)
  if (
    [System.IO.Path]::GetDirectoryName($Executable).TrimEnd("\") -ine $ResolvedDelivery -or
    [System.IO.Path]::GetFileName($Executable) -notmatch $PortableName
  ) {
    continue
  }

  $ProcessId = [int]$Candidate.ProcessId
  $Current = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
  if (
    -not $Current -or
    [System.IO.Path]::GetFullPath([string]$Current.ExecutablePath) -ine $Executable
  ) {
    throw "local acceptance client identity changed before shutdown"
  }
  Stop-Process -Id $ProcessId -Force
  Wait-Process -Id $ProcessId -Timeout 10 -ErrorAction SilentlyContinue
  if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    throw "local acceptance client did not exit"
  }
  $Stopped += 1
}

Write-Host "Stopped $Stopped running local acceptance client(s)."
