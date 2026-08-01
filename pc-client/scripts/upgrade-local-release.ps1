$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot "deployment\local\compose.yaml"
$TransactionFile = Join-Path (
  [System.IO.Path]::GetTempPath()
) ("aihub-local-release-transaction-{0}.json" -f [guid]::NewGuid())

function Invoke-NpmScript {
  param([Parameter(Mandatory = $true)][string]$Name)
  & npm.cmd run $Name
  if ($LASTEXITCODE -ne 0) {
    throw "npm script failed: $Name"
  }
}

function Invoke-NpmAudit {
  & npm.cmd audit --audit-level=low
  if ($LASTEXITCODE -ne 0) {
    throw "npm audit failed"
  }
}

function Invoke-NodeScript {
  param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter()][string[]]$Arguments = @()
  )
  & node $Script @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "node script failed: $Script"
  }
}

function Stop-ReleaseServerFailClosed {
  & docker compose -f $ComposeFile stop --timeout 10 release-server
  if ($LASTEXITCODE -ne 0) {
    & docker compose -f $ComposeFile kill release-server
  }
  $Running = & docker compose -f $ComposeFile ps --status running -q release-server
  if ($LASTEXITCODE -ne 0 -or $Running) {
    throw "rejected local release server could not be stopped"
  }
}

function Restore-ReleaseServerAfterRollback {
  $CurrentRuntime = Join-Path $ProjectRoot "deployment\local\runtime\current"
  if (Test-Path -LiteralPath $CurrentRuntime -PathType Container) {
    Invoke-NpmScript "release:local:recreate-server"
    Invoke-NpmScript "release:local:pin-tls"
    return
  }
  Stop-ReleaseServerFailClosed
}

$TransactionPrepared = $false
Push-Location $ProjectRoot
try {
  # These gates must finish before anything can replace runtime/current.
  Invoke-NpmScript "test"
  Invoke-NpmScript "build"
  Invoke-NpmAudit

  # Rebuild every local application image and reject stale container bytes.
  Invoke-NpmScript "release:local:rebuild-app-services"

  Invoke-NpmScript "release:local:recreate-server"
  Invoke-NpmScript "release:local:pin-tls"
  Invoke-NpmScript "package:win:local-release"
  Invoke-NodeScript "scripts/prepare-local-release.cjs" @(
    "--result-file",
    $TransactionFile
  )
  $TransactionPrepared = $true

  try {
    Invoke-NpmScript "release:local:verify"
    Invoke-NpmScript "release:local:recreate-server"
    Invoke-NpmScript "release:local:up"
    Invoke-NpmScript "release:local:test-server"
    Invoke-NpmScript "release:local:pin-tls"
    Invoke-NpmScript "release:local:test-client"
    Invoke-NodeScript "scripts/finalize-local-release.cjs" @($TransactionFile)
    $TransactionPrepared = $false
  }
  catch {
    $AcceptanceError = $_
    if ($TransactionPrepared) {
      try {
        Invoke-NodeScript "scripts/rollback-local-release.cjs" @($TransactionFile)
      }
      catch {
        $RollbackError = $_
        try {
          Stop-ReleaseServerFailClosed
        }
        catch {
          throw [System.AggregateException]::new(
            "Local release acceptance failed, rollback failed, and the release server could not be stopped.",
            [System.Exception[]]@(
              $AcceptanceError.Exception,
              $RollbackError.Exception,
              $_.Exception
            )
          )
        }
        throw [System.AggregateException]::new(
          "Local release acceptance failed and rollback failed; the transaction receipt was preserved.",
          [System.Exception[]]@($AcceptanceError.Exception, $RollbackError.Exception)
        )
      }
      $TransactionPrepared = $false
      try {
        Restore-ReleaseServerAfterRollback
      }
      catch {
        $RefreshError = $_
        try {
          Stop-ReleaseServerFailClosed
        }
        catch {
          throw [System.AggregateException]::new(
            "Local release acceptance failed; rollback succeeded, but release-server refresh and shutdown failed.",
            [System.Exception[]]@(
              $AcceptanceError.Exception,
              $RefreshError.Exception,
              $_.Exception
            )
          )
        }
        throw [System.AggregateException]::new(
          "Local release acceptance failed; rollback succeeded and the release server was stopped after refresh failed.",
          [System.Exception[]]@($AcceptanceError.Exception, $RefreshError.Exception)
        )
      }
    }
    throw $AcceptanceError
  }

  Write-Host "Local release upgrade completed and verified."
}
finally {
  if (
    -not $TransactionPrepared -and
    (Test-Path -LiteralPath $TransactionFile -PathType Leaf)
  ) {
    Remove-Item -LiteralPath $TransactionFile -Force
  }
  elseif (Test-Path -LiteralPath $TransactionFile -PathType Leaf) {
    Write-Warning "Local release transaction receipt preserved for recovery: $TransactionFile"
  }
  Pop-Location
}
