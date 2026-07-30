$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$deployment = Join-Path $root "deployment\local"
$certificatePath = Join-Path $env:TEMP "aihub-local-release-root.crt"

try {
  docker compose -f (Join-Path $deployment "compose.yaml") cp `
    "release-server:/data/caddy/pki/authorities/local/root.crt" `
    $certificatePath
  node (Join-Path $PSScriptRoot "verify-local-release-https.cjs") `
    $certificatePath
  if ($LASTEXITCODE -ne 0) {
    throw "Local HTTPS release server verification failed."
  }
} finally {
  if (Test-Path -LiteralPath $certificatePath) {
    Remove-Item -LiteralPath $certificatePath -Force
  }
}
