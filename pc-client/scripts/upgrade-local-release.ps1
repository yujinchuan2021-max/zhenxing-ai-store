[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot "deployment\local\compose.yaml"
$RuntimeDirectory = Join-Path $ProjectRoot "deployment\local\runtime"
$UpgradeJournal = $null

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

function Invoke-NodeJson {
  param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter()][string[]]$Arguments = @()
  )
  $Output = & node $Script @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "node script failed: $Script`n$($Output -join "`n")"
  }
  try {
    return (($Output -join "`n") | ConvertFrom-Json)
  }
  catch {
    throw "node script returned invalid JSON: $Script"
  }
}

function Invoke-PowerShellScript {
  param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter()][string[]]$Arguments = @()
  )
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "PowerShell script failed: $Script"
  }
}

function Refresh-MailpitHostBinding {
  & docker compose -f $ComposeFile up -d --force-recreate --wait mailpit
  if ($LASTEXITCODE -ne 0) {
    throw "local Mailpit host binding could not be refreshed"
  }
}

function Stop-ReleaseServerFailClosed {
  # Removing the rejected container releases Docker Desktop's bind mount on
  # deployment/local/runtime. A stopped container can retain that Windows
  # directory handle and make the durable runtime rollback fail with EPERM.
  & docker compose -f $ComposeFile rm -f -s release-server
  if ($LASTEXITCODE -ne 0) {
    & docker compose -f $ComposeFile kill release-server
    & docker compose -f $ComposeFile rm -f release-server
  }
  $Container = & docker compose -f $ComposeFile ps -a -q release-server
  if ($LASTEXITCODE -ne 0 -or $Container) {
    throw "rejected local release server container could not be removed"
  }
}

function Stop-LocalApplicationServicesFailClosed {
  $Failures = [System.Collections.Generic.List[System.Exception]]::new()
  foreach ($Service in @("admin", "identity-community", "community")) {
    try {
      & docker compose -f $ComposeFile stop --timeout 10 $Service
      if ($LASTEXITCODE -ne 0) {
        & docker compose -f $ComposeFile kill $Service
      }
      $Running = & docker compose -f $ComposeFile ps --status running -q $Service
      if ($LASTEXITCODE -ne 0 -or $Running) {
        throw "unverified local application service could not be stopped: $Service"
      }
    }
    catch {
      $Failures.Add($_.Exception)
    }
  }
  if ($Failures.Count -gt 0) {
    throw [System.AggregateException]::new(
      "one or more unverified local application services could not be stopped",
      [System.Exception[]]$Failures
    )
  }
}

function Stop-AllReleaseServicesFailClosed {
  $Failures = [System.Collections.Generic.List[System.Exception]]::new()
  try {
    Stop-LocalApplicationServicesFailClosed
  }
  catch {
    $Failures.Add($_.Exception)
  }
  try {
    Stop-ReleaseServerFailClosed
  }
  catch {
    $Failures.Add($_.Exception)
  }
  if ($Failures.Count -gt 0) {
    throw [System.AggregateException]::new(
      "one or more rejected local release services could not be stopped",
      [System.Exception[]]$Failures
    )
  }
}

function Restore-ReleaseServerAfterRollback {
  $CurrentRuntime = Join-Path $RuntimeDirectory "current"
  if (Test-Path -LiteralPath $CurrentRuntime -PathType Container) {
    Invoke-NpmScript "release:local:recreate-server"
    Invoke-NpmScript "release:local:pin-tls"
    # A signed previous release can legitimately use a catalog policy that the
    # newer source no longer accepts. Recovery still verifies its exact signed
    # files, channels, update artifact and provenance; only current-policy
    # compatibility is reported instead of blocking rollback.
    Invoke-NodeScript "scripts/verify-local-release.cjs" @(
      "--allow-catalog-policy-drift"
    )
    return
  }
  Stop-ReleaseServerFailClosed
}

function Restore-LocalApplicationServicesAfterRollback {
  & docker compose -f $ComposeFile up -d --pull never --no-build --wait `
    admin identity-community community
  if ($LASTEXITCODE -ne 0) {
    throw "rolled-back local application services could not be restored"
  }
}

function Get-UpgradeJournalStatus {
  return Invoke-NodeJson "scripts/manage-local-release-upgrade-journal.cjs" @(
    "status"
  )
}

function Set-UpgradeJournalPhase {
  param([Parameter(Mandatory = $true)][string]$Phase)
  $script:UpgradeJournal = Invoke-NodeJson `
    "scripts/manage-local-release-upgrade-journal.cjs" `
    @("advance", "--phase", $Phase)
  return $script:UpgradeJournal
}

function Complete-UpgradeJournal {
  Invoke-NodeScript "scripts/manage-local-release-upgrade-journal.cjs" @(
    "complete"
  )
  $script:UpgradeJournal = $null
}

function Seal-UpgradeJournalReceipts {
  $script:UpgradeJournal = Invoke-NodeJson `
    "scripts/manage-local-release-upgrade-journal.cjs" `
    @("seal")
  return $script:UpgradeJournal
}

function Verify-SealedUpgradeReceipts {
  Invoke-NodeScript "scripts/manage-local-release-upgrade-journal.cjs" @(
    "verify-receipts"
  )
}

function Test-TrustedReceiptFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $false
  }
  $Item = Get-Item -LiteralPath $Path
  if (
    (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) -or
    $Item.Length -lt 2 -or
    $Item.Length -gt 4MB
  ) {
    throw "local release child receipt is not trusted: $Path"
  }
  return $true
}

function Read-TrustedReceiptJson {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-TrustedReceiptFile -Path $Path)) {
    throw "local release child receipt is missing: $Path"
  }
  try {
    return Get-Content -LiteralPath $Path -Raw -Encoding utf8 | ConvertFrom-Json
  }
  catch {
    throw "local release child receipt is invalid: $Path"
  }
}

function Assert-SafeTransactionChildName {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (
    -not $Name -or
    $Name -notmatch "^[A-Za-z0-9._-]{1,128}$" -or
    $Name -in @(".", "..")
  ) {
    throw "local release transaction child name is invalid"
  }
}

function Invoke-RuntimeRollbackFromJournal {
  $Receipt = [string]$UpgradeJournal.receiptPaths.runtime
  if (Test-TrustedReceiptFile -Path $Receipt) {
    try {
      Invoke-NodeScript "scripts/rollback-local-release.cjs" @($Receipt)
    }
    catch {
      # The durable snapshot is authoritative. A child rollback can already
      # have completed just before a hard exit, or its cleanup can be partial.
      Write-Warning "Runtime child rollback will be completed from the durable snapshot."
    }
  }
  Invoke-NodeScript "scripts/manage-local-release-upgrade-journal.cjs" @(
    "restore-runtime"
  )
  Invoke-NodeScript "scripts/manage-local-release-upgrade-journal.cjs" @(
    "verify-runtime"
  )
}

function Remove-RuntimeRollbackArtifactsFromJournal {
  $ReceiptPath = [string]$UpgradeJournal.receiptPaths.runtime
  if (-not (Test-TrustedReceiptFile -Path $ReceiptPath)) { return }
  $Receipt = Read-TrustedReceiptJson -Path $ReceiptPath
  foreach ($Artifact in @(
    [pscustomobject]@{
      Name = [string]$Receipt.backupName
      Root = Join-Path $RuntimeDirectory "backups"
    },
    [pscustomobject]@{
      Name = [string]$Receipt.retiredName
      Root = Join-Path $RuntimeDirectory "staging"
    }
  )) {
    if (-not $Artifact.Name) { continue }
    Assert-SafeTransactionChildName -Name $Artifact.Name
    $Target = Join-Path $Artifact.Root $Artifact.Name
    if (-not (Test-Path -LiteralPath $Target)) { continue }
    $Item = Get-Item -LiteralPath $Target -Force
    if (
      -not $Item.PSIsContainer -or
      (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)
    ) {
      throw "local runtime rollback artifact is not trusted: $Target"
    }
    Remove-Item -LiteralPath $Target -Recurse -Force
    if (Test-Path -LiteralPath $Target) {
      throw "local runtime rollback artifact cleanup did not complete: $Target"
    }
  }
}

function Invoke-ServiceRollbackFromJournal {
  $Receipt = [string]$UpgradeJournal.receiptPaths.services
  if (Test-TrustedReceiptFile -Path $Receipt) {
    Invoke-PowerShellScript `
      "scripts/manage-local-service-image-transaction.ps1" `
      @("-Action", "rollback", "-ReceiptPath", $Receipt)
  }
}

function Invoke-DeliveryRollbackFromJournal {
  $Receipt = [string]$UpgradeJournal.receiptPaths.delivery
  if (Test-TrustedReceiptFile -Path $Receipt) {
    Invoke-NodeScript "scripts/rollback-local-release-delivery.cjs" @($Receipt)
  }
}

function Finalize-RolledBackServiceTransaction {
  $Receipt = [string]$UpgradeJournal.receiptPaths.services
  if (Test-TrustedReceiptFile -Path $Receipt) {
    Invoke-PowerShellScript `
      "scripts/manage-local-service-image-transaction.ps1" `
      @("-Action", "finalize", "-ReceiptPath", $Receipt)
  }
}

function Test-RuntimeFinalizationAlreadyComplete {
  $ReceiptPath = [string]$UpgradeJournal.receiptPaths.runtime
  $Receipt = Read-TrustedReceiptJson -Path $ReceiptPath
  $CleanupFields = @(
    "retiredCleanupPending",
    "stagingCleanupPending",
    "staleLockCleanupPending",
    "activationLockCleanupPending"
  )
  if (
    $CleanupFields.Where({ $Receipt.$_ -isnot [bool] }).Count -gt 0 -or
    [string]$Receipt.expectedCurrent.version -ne [string]$UpgradeJournal.version -or
    [string]$Receipt.expectedCurrent.sha256 -notmatch "^[a-f0-9]{64}$" -or
    $null -eq $Receipt.expectedCurrent.source -or
    [string]$Receipt.expectedCurrent.source.revision -ne [string]$UpgradeJournal.revision -or
    $Receipt.expectedCurrent.source.dirty -isnot [bool] -or
    [bool]$Receipt.expectedCurrent.source.dirty -or
    [string]$Receipt.expectedCurrent.source.versionTag -ne "v$($UpgradeJournal.version)" -or
    ([string]$Receipt.backupName -and [string]$Receipt.retiredName)
  ) {
    throw "accepted local runtime receipt is invalid"
  }
  foreach ($Name in @([string]$Receipt.backupName, [string]$Receipt.retiredName)) {
    if (-not $Name) { continue }
    Assert-SafeTransactionChildName -Name $Name
    $Parent = if ($Name -eq [string]$Receipt.backupName) {
      Join-Path $RuntimeDirectory "backups"
    } else {
      Join-Path $RuntimeDirectory "staging"
    }
    if (Test-Path -LiteralPath (Join-Path $Parent $Name)) {
      return $false
    }
  }
  Invoke-NpmScript "release:local:verify"
  return $true
}

function Invoke-RuntimeFinalizationFromJournal {
  $Receipt = [string]$UpgradeJournal.receiptPaths.runtime
  if (-not (Test-TrustedReceiptFile -Path $Receipt)) {
    throw "accepted local release has no runtime receipt"
  }
  try {
    Invoke-NodeScript "scripts/finalize-local-release.cjs" @($Receipt)
  }
  catch {
    if (-not (Test-RuntimeFinalizationAlreadyComplete)) {
      throw
    }
    Write-Warning "Runtime finalization had already completed before recovery."
  }
}

function Invoke-ServiceFinalizationFromJournal {
  $Receipt = [string]$UpgradeJournal.receiptPaths.services
  if (-not (Test-TrustedReceiptFile -Path $Receipt)) {
    throw "accepted local release has no service image receipt"
  }
  Invoke-PowerShellScript `
    "scripts/manage-local-service-image-transaction.ps1" `
    @("-Action", "finalize", "-ReceiptPath", $Receipt)
}

function Test-DeliveryFinalizationAlreadyComplete {
  $ReceiptPath = [string]$UpgradeJournal.receiptPaths.delivery
  $Receipt = Read-TrustedReceiptJson -Path $ReceiptPath
  if (
    [int]$Receipt.schemaVersion -ne 1 -or
    [string]$Receipt.version -ne [string]$UpgradeJournal.version -or
    [string]$Receipt.deliveryName -ne "release-local-server-client" -or
    [string]$Receipt.transactionId -notmatch "^[a-f0-9-]{32,36}$" -or
    $null -eq $Receipt.next
  ) {
    throw "accepted local delivery receipt is invalid"
  }
  Assert-SafeTransactionChildName -Name ([string]$Receipt.candidateName)
  if ($Receipt.retiredName) {
    Assert-SafeTransactionChildName -Name ([string]$Receipt.retiredName)
  }
  $DeliveryParent = $ProjectRoot
  $Candidate = Join-Path $DeliveryParent ([string]$Receipt.candidateName)
  $Retired = if ($Receipt.retiredName) {
    Join-Path $DeliveryParent ([string]$Receipt.retiredName)
  } else {
    $null
  }
  if (
    (Test-Path -LiteralPath $Candidate) -or
    ($Retired -and (Test-Path -LiteralPath $Retired)) -or
    -not (Test-Path -LiteralPath (Join-Path $ProjectRoot "release-local-server-client") -PathType Container)
  ) {
    return $false
  }
  return $true
}

function Invoke-DeliveryFinalizationFromJournal {
  $Receipt = [string]$UpgradeJournal.receiptPaths.delivery
  if (-not (Test-TrustedReceiptFile -Path $Receipt)) {
    throw "accepted local release has no delivery receipt"
  }
  try {
    Invoke-NodeScript "scripts/finalize-local-release-delivery.cjs" @($Receipt)
  }
  catch {
    if (-not (Test-DeliveryFinalizationAlreadyComplete)) {
      throw
    }
    Write-Warning "Delivery finalization had already completed before recovery."
  }
}

function Restore-AndVerifyAcceptedReleaseServices {
  Invoke-NpmScript "release:local:recreate-server"
  Invoke-NpmScript "release:local:pin-tls"
  & docker compose -f $ComposeFile up -d --pull never --no-build --wait `
    admin identity-community community
  if ($LASTEXITCODE -ne 0) {
    throw "accepted local application services could not be restored"
  }
  Refresh-MailpitHostBinding
  Invoke-NpmScript "release:local:test-server"
  Invoke-NpmScript "test:identity-community"
  Invoke-NpmScript "release:local:pin-tls"
  Invoke-NpmScript "release:local:test-client"
}

function Recover-PendingLocalRelease {
  param([Parameter(Mandatory = $true)][object]$Journal)
  $script:UpgradeJournal = $Journal
  Stop-AllReleaseServicesFailClosed

  if ([string]$UpgradeJournal.phase -eq "initializing") {
    # begin writes this marker before copying the snapshot, and performs no
    # live mutation until it returns in the created phase.
    Complete-UpgradeJournal
    Restore-ReleaseServerAfterRollback
    Restore-LocalApplicationServicesAfterRollback
    return "rolled-back"
  }

  $FinalizationPhases = @(
    "accepted",
    "runtime-finalized",
    "services-finalized",
    "delivery-finalized"
  )
  if ([string]$UpgradeJournal.phase -in $FinalizationPhases) {
    Verify-SealedUpgradeReceipts
    if ([string]$UpgradeJournal.phase -eq "accepted") {
      Invoke-RuntimeFinalizationFromJournal
      Set-UpgradeJournalPhase "runtime-finalized" | Out-Null
    }
    if ([string]$UpgradeJournal.phase -eq "runtime-finalized") {
      Verify-SealedUpgradeReceipts
      Invoke-ServiceFinalizationFromJournal
      Set-UpgradeJournalPhase "services-finalized" | Out-Null
    }
    if ([string]$UpgradeJournal.phase -eq "services-finalized") {
      Verify-SealedUpgradeReceipts
      Invoke-DeliveryFinalizationFromJournal
      Set-UpgradeJournalPhase "delivery-finalized" | Out-Null
    }
    Restore-AndVerifyAcceptedReleaseServices
    Complete-UpgradeJournal
    return "finalized"
  }

  $ForwardPreAcceptancePhases = @(
    "created",
    "delivery-activating",
    "delivery-active",
    "runtime-activating",
    "runtime-active",
    "services-staging",
    "services-staged",
    "services-promoting",
    "services-active"
  )
  if ([string]$UpgradeJournal.phase -in $ForwardPreAcceptancePhases) {
    Set-UpgradeJournalPhase "rollback-started" | Out-Null
  }
  if ([string]$UpgradeJournal.phase -eq "rollback-started") {
    Invoke-RuntimeRollbackFromJournal
    Set-UpgradeJournalPhase "runtime-rolled-back" | Out-Null
  }
  if ([string]$UpgradeJournal.phase -eq "runtime-rolled-back") {
    Invoke-ServiceRollbackFromJournal
    Set-UpgradeJournalPhase "services-rolled-back" | Out-Null
  }
  if ([string]$UpgradeJournal.phase -eq "services-rolled-back") {
    Invoke-DeliveryRollbackFromJournal
    Set-UpgradeJournalPhase "delivery-rolled-back" | Out-Null
  }
  if ([string]$UpgradeJournal.phase -ne "delivery-rolled-back") {
    throw "local release transaction recovery phase is unsupported: $($UpgradeJournal.phase)"
  }

  # Image backup tags remain until all three live rollback boundaries have
  # durable completion phases. This makes a second hard-exit retry safe.
  Invoke-NodeScript "scripts/manage-local-release-upgrade-journal.cjs" @(
    "verify-runtime"
  )
  Remove-RuntimeRollbackArtifactsFromJournal
  Finalize-RolledBackServiceTransaction
  Restore-ReleaseServerAfterRollback
  Restore-LocalApplicationServicesAfterRollback
  Complete-UpgradeJournal
  return "rolled-back"
}

function Get-ExpectedReleaseSource {
  $Package = Get-Content -LiteralPath (Join-Path $ProjectRoot "package.json") `
    -Raw -Encoding utf8 | ConvertFrom-Json
  $Version = [string]$Package.version
  if ($Version -notmatch "^(?:0|[1-9]\d*)\.\d+\.\d+$") {
    throw "package.json contains an invalid local release version"
  }
  $Revision = (& git -C $ProjectRoot rev-parse HEAD 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "local release Git revision is unavailable"
  }
  $Revision = (($Revision -join "`n").Trim()).ToLowerInvariant()
  if ($Revision -notmatch "^[a-f0-9]{40}$") {
    throw "local release Git revision is invalid"
  }
  Invoke-NodeScript "scripts/local-service-release-policy.cjs" @(
    "preflight",
    "--expected-revision", $Revision,
    "--expected-version", $Version
  )
  return [pscustomobject]@{ version = $Version; revision = $Revision }
}

function Assert-ExpectedReleaseSource {
  param([Parameter(Mandatory = $true)][object]$Source)
  Invoke-NodeScript "scripts/local-service-release-policy.cjs" @(
    "preflight",
    "--expected-revision", [string]$Source.revision,
    "--expected-version", [string]$Source.version
  )
}

function Assert-PackagedBuildSource {
  param([Parameter(Mandatory = $true)][object]$Source)
  $BuildPath = Join-Path $ProjectRoot (
    "release-local-server-client\AI-Hub-Local-{0}-BUILD.json" -f `
      [string]$Source.version
  )
  $Build = Read-TrustedReceiptJson -Path $BuildPath
  if (
    [string]$Build.version -ne [string]$Source.version -or
    [string]$Build.source.revision -ne [string]$Source.revision -or
    [bool]$Build.source.dirty -or
    [string]$Build.source.versionTag -ne "v$($Source.version)"
  ) {
    throw "packaged local release source differs from the master transaction"
  }
}

Push-Location $ProjectRoot
try {
  try {
    $Pending = Get-UpgradeJournalStatus
  }
  catch {
    $JournalReadError = $_
    try {
      Stop-AllReleaseServicesFailClosed
    }
    catch {
      throw [System.AggregateException]::new(
        "The fixed local release journal is invalid and services could not be stopped fail-closed.",
        [System.Exception[]]@($JournalReadError.Exception, $_.Exception)
      )
    }
    throw $JournalReadError
  }

  if ($Pending.pending) {
    $RecoveryResult = Recover-PendingLocalRelease -Journal $Pending
    if ($RecoveryResult -eq "finalized") {
      Write-Host "Pending accepted local release was finalized and verified."
      return
    }
  }

  # Read-only source and quality gates finish before the durable transaction is
  # created. No release directory, runtime, image tag or container changes here.
  Invoke-NpmScript "test"
  Invoke-NpmScript "build"
  Invoke-NpmAudit
  Invoke-NpmScript "audit:desktop-sources"
  Invoke-NpmScript "test:product-layout"
  $ReleaseSource = Get-ExpectedReleaseSource

  # begin copies and verifies runtime/current before the first live mutation.
  $UpgradeJournal = Invoke-NodeJson `
    "scripts/manage-local-release-upgrade-journal.cjs" `
    @(
      "begin",
      "--version", [string]$ReleaseSource.version,
      "--revision", [string]$ReleaseSource.revision
    )

  try {
    Set-UpgradeJournalPhase "delivery-activating" | Out-Null
    # Packaging embeds the currently pinned local TLS trust, so refresh it only
    # after the durable runtime snapshot exists.
    Invoke-NpmScript "release:local:recreate-server"
    Invoke-NpmScript "release:local:pin-tls"
    Invoke-NodeScript "scripts/package-local-release.cjs" @(
      "--transaction-receipt",
      [string]$UpgradeJournal.receiptPaths.delivery
    )
    Assert-ExpectedReleaseSource -Source $ReleaseSource
    Assert-PackagedBuildSource -Source $ReleaseSource
    Set-UpgradeJournalPhase "delivery-active" | Out-Null

    Set-UpgradeJournalPhase "runtime-activating" | Out-Null
    Invoke-NodeScript "scripts/prepare-local-release.cjs" @(
      "--result-file",
      [string]$UpgradeJournal.receiptPaths.runtime
    )
    Invoke-NpmScript "release:local:verify"
    Invoke-NpmScript "release:local:recreate-server"
    Set-UpgradeJournalPhase "runtime-active" | Out-Null

    Set-UpgradeJournalPhase "services-staging" | Out-Null
    Invoke-PowerShellScript `
      "scripts/manage-local-service-image-transaction.ps1" `
      @(
        "-Action", "begin",
        "-ReceiptPath", [string]$UpgradeJournal.receiptPaths.services,
        "-ExpectedRevision", [string]$ReleaseSource.revision,
        "-ExpectedVersion", [string]$ReleaseSource.version
      )
    Invoke-PowerShellScript `
      "scripts/rebuild-local-app-services.ps1" `
      @(
        "-Action", "stage",
        "-ReceiptPath", [string]$UpgradeJournal.receiptPaths.services,
        "-ExpectedRevision", [string]$ReleaseSource.revision,
        "-ExpectedVersion", [string]$ReleaseSource.version
      )
    Assert-ExpectedReleaseSource -Source $ReleaseSource
    Set-UpgradeJournalPhase "services-staged" | Out-Null

    Set-UpgradeJournalPhase "services-promoting" | Out-Null
    Invoke-PowerShellScript `
      "scripts/rebuild-local-app-services.ps1" `
      @(
        "-Action", "promote",
        "-ReceiptPath", [string]$UpgradeJournal.receiptPaths.services,
        "-ExpectedRevision", [string]$ReleaseSource.revision,
        "-ExpectedVersion", [string]$ReleaseSource.version
      )
    Set-UpgradeJournalPhase "services-active" | Out-Null

    Refresh-MailpitHostBinding
    Invoke-NpmScript "release:local:test-server"
    Invoke-NpmScript "test:identity-community"
    Invoke-NpmScript "release:local:pin-tls"
    Invoke-NpmScript "release:local:test-client"
    Assert-ExpectedReleaseSource -Source $ReleaseSource
    Seal-UpgradeJournalReceipts | Out-Null
    Set-UpgradeJournalPhase "accepted" | Out-Null

    Verify-SealedUpgradeReceipts
    Invoke-RuntimeFinalizationFromJournal
    Set-UpgradeJournalPhase "runtime-finalized" | Out-Null
    Verify-SealedUpgradeReceipts
    Invoke-ServiceFinalizationFromJournal
    Set-UpgradeJournalPhase "services-finalized" | Out-Null
    Verify-SealedUpgradeReceipts
    Invoke-DeliveryFinalizationFromJournal
    Set-UpgradeJournalPhase "delivery-finalized" | Out-Null
    Complete-UpgradeJournal
  }
  catch {
    $ReleaseError = $_
    try {
      $CurrentJournal = Get-UpgradeJournalStatus
      if ($CurrentJournal.pending) {
        Recover-PendingLocalRelease -Journal $CurrentJournal | Out-Null
      }
    }
    catch {
      $RecoveryError = $_
      try {
        Stop-AllReleaseServicesFailClosed
      }
      catch {
        $RecoveryError = [System.Management.Automation.ErrorRecord]::new(
          [System.AggregateException]::new(
            "Local release recovery failed and services could not be stopped fail-closed.",
            [System.Exception[]]@($RecoveryError.Exception, $_.Exception)
          ),
          "LocalReleaseRecoveryFailClosed",
          [System.Management.Automation.ErrorCategory]::OperationStopped,
          $null
        )
      }
      throw [System.AggregateException]::new(
        "Local release failed and durable recovery could not be completed; the fixed journal and exact child receipts were preserved.",
        [System.Exception[]]@($ReleaseError.Exception, $RecoveryError.Exception)
      )
    }
    throw $ReleaseError
  }

  Write-Host "Local release upgrade completed and verified."
}
finally {
  if ($UpgradeJournal) {
    Write-Warning (
      "Fixed local release journal preserved for recovery: {0}" -f `
        [string]$UpgradeJournal.journalPath
    )
  }
  Pop-Location
}
