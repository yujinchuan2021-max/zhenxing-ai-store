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

$PortableName = '^(?:ZhenXing-AI|AI-Hub)-Local-(?:0|[1-9][0-9]*)\.[0-9]+\.[0-9]+-Windows-x64-Portable\.exe$'
$Snapshot = @(Get-CimInstance Win32_Process)
$Targets = @{}
foreach ($Candidate in $Snapshot) {
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

  $Targets[[int]$Candidate.ProcessId] = $Candidate
}

do {
  $Added = $false
  foreach ($Candidate in $Snapshot) {
    $ProcessId = [int]$Candidate.ProcessId
    if (
      -not $Targets.ContainsKey($ProcessId) -and
      $Targets.ContainsKey([int]$Candidate.ParentProcessId)
    ) {
      $Targets[$ProcessId] = $Candidate
      $Added = $true
    }
  }
} while ($Added)

$OrderedTargets = foreach ($Candidate in $Targets.Values) {
  $Depth = 0
  $ParentId = [int]$Candidate.ParentProcessId
  while ($Targets.ContainsKey($ParentId)) {
    $Depth += 1
    $ParentId = [int]$Targets[$ParentId].ParentProcessId
  }
  [pscustomobject]@{ Process = $Candidate; Depth = $Depth }
}

$Stopped = 0
foreach ($Target in @($OrderedTargets | Sort-Object Depth -Descending)) {
  $Candidate = $Target.Process

  $ProcessId = [int]$Candidate.ProcessId
  $Current = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
  if (-not $Current) {
    continue
  }
  if (
    [string]$Current.CreationDate -ne [string]$Candidate.CreationDate -or
    [string]$Current.ExecutablePath -ne [string]$Candidate.ExecutablePath
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
