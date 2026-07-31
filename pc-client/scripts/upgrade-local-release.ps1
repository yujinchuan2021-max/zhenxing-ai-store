$ErrorActionPreference = "Stop"

function Invoke-NpmScript {
  param([Parameter(Mandatory = $true)][string]$Name)
  & npm.cmd run $Name
  if ($LASTEXITCODE -ne 0) {
    throw "npm script failed: $Name"
  }
}

Invoke-NpmScript "release:local:recreate-server"
Invoke-NpmScript "release:local:pin-tls"
Invoke-NpmScript "package:win:local-release"
Invoke-NpmScript "release:local:prepare"
Invoke-NpmScript "release:local:verify"
Invoke-NpmScript "release:local:recreate-server"
Invoke-NpmScript "release:local:up"
Invoke-NpmScript "release:local:test-server"
Invoke-NpmScript "release:local:pin-tls"
Invoke-NpmScript "release:local:test-client"

Write-Host "Local release upgrade completed and verified."
