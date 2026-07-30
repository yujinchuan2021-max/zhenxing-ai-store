param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [int]$ObservationSeconds = 6
)

$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath -ErrorAction Stop).Path
$startedAt = Get-Date
$process = Start-Process -FilePath $resolvedInstaller -PassThru
Start-Sleep -Seconds $ObservationSeconds
$process.Refresh()

$crash = Get-WinEvent -FilterHashtable @{
  LogName = "Application"
  ProviderName = "Application Error"
  StartTime = $startedAt
} -ErrorAction SilentlyContinue |
  Where-Object { $_.Message -like "*$resolvedInstaller*" } |
  Select-Object -First 1

$result = [ordered]@{
  installer = $resolvedInstaller
  processId = $process.Id
  stillRunning = -not $process.HasExited
  exitCode = if ($process.HasExited) { $process.ExitCode } else { $null }
  crashEventId = $crash.Id
  crashTime = $crash.TimeCreated
}

$result | ConvertTo-Json

if ($crash -or ($process.HasExited -and $process.ExitCode -ne 0)) {
  exit 1
}
