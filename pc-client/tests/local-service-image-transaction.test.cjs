"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.resolve(
    __dirname,
    "../scripts/manage-local-service-image-transaction.ps1"
  ),
  "utf8"
);
const receiptSource = fs.readFileSync(
  path.resolve(__dirname, "../shared/local-service-image-receipt.cjs"),
  "utf8"
);

test("local service image rollback is fixed to the three self-built services", () => {
  assert.match(source, /"admin" = "local-admin"/);
  assert.match(
    source,
    /"identity-community" = "local-identity-community"/
  );
  assert.match(source, /"community" = "local-community"/);
  assert.match(source, /scripts\/local-service-image-receipt\.cjs/);
  assert.match(receiptSource, /services\.length !== SERVICE_NAMES\.length/);
  assert.match(receiptSource, /service order is invalid/);
});

test("service rollback pins, recreates and verifies the exact previous image", () => {
  assert.match(
    source,
    /"image", "tag", \[string\]\$Entry\.previousImageId, \[string\]\$Entry\.backupTag/
  );
  assert.match(
    source,
    /"image", "tag", \[string\]\$Entry\.backupTag, \[string\]\$Entry\.previousImageName/
  );
  assert.match(source, /"--pull", "never"/);
  assert.match(source, /"--no-build", "--force-recreate", "--wait"/);
  assert.match(source, /ActualImage -ne \[string\]\$Entry\.previousImageId/);
  assert.match(source, /Remove-ImageTagsBestEffort/);
});

test("the durable service transaction receipt is written atomically and rejects links", () => {
  assert.match(source, /Write-ReceiptAtomic/);
  assert.match(source, /Move-Item -LiteralPath \$Temporary/);
  assert.match(source, /FileAttributes\]::ReparsePoint/);
  assert.match(source, /service image transaction receipt already exists/);
  assert.ok(
    source.indexOf("Write-ReceiptAtomic -Path $ReceiptPath") <
      source.indexOf(
        '"image", "tag", [string]$Entry.previousImageId, [string]$Entry.backupTag'
      )
  );
});

test("Docker image absence is distinguished from daemon or permission failure", () => {
  assert.match(source, /\$Output = & docker image inspect \$Reference 2>&1/);
  assert.match(source, /\$PreviousErrorActionPreference = \$ErrorActionPreference/);
  assert.match(source, /\$ErrorActionPreference = "Continue"/);
  assert.match(source, /\$ErrorActionPreference = \$PreviousErrorActionPreference/);
  assert.match(source, /no such image|not found/i);
  assert.match(source, /Docker image existence could not be verified/);
  assert.doesNotMatch(source, /return \$LASTEXITCODE -eq 0/);
});

test("rollback removes and verifies a rejected image when no previous image existed", () => {
  assert.match(source, /Remove-RejectedFirstReleaseImage/);
  assert.match(source, /"image", "rm", "--force"/);
  assert.match(source, /rejected local service image still exists/);
  assert.match(source, /rejected local service container still exists/);
  assert.match(
    source,
    /Where-Object \{ -not \$_.previousImageId \}[\s\S]*Remove-RejectedFirstReleaseImage/
  );
});
