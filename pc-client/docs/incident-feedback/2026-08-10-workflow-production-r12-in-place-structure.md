# r12 in-place coordinator structure gate

## Symptom

The retired r11 cutover owns a second isolated full stack and cannot express the
r12 single-project, retained-data replacement contract.  Early r12 sketches
also accepted externally supplied collector receipts and had no release-local
operation or durable-lifecycle boundary.

## Fix

The r12 prepared coordinator now consumes its same-release bundle verifier,
fixed collector, existing-state verifier, and fixed operation runner.  The
redundant r12-only file-set verifier and decorative collector command list were
removed; the release-bundle verifier is the only payload-closure authority. The collector
uses only fixed Docker inspect/exec read paths, PostgreSQL and MariaDB
read-only statements, the pure Flarum GET seam, pinned HTTPS/SNI, signed
release-store reads, exact service/secret/mount checks, and a fixed r12
concurrency check. PostgreSQL uses fixed TCP and verifies the database/user,
schema tables, and the append trigger's exact table binding. MariaDB opens a
read-only transaction. The capability and disabled-public responses use exact
DTOs. Raw database and HTTP values stay inside the collector;
the coordinator accepts only the exact verifier receipt.  The executor has seven fixed
operations plus a fixed rollback that uses the base plus rollback overlay only,
restores active6/disabled flags/no review-secret consumer, and waits for all six
services. Every Compose command fixes both Admin and Identity images for its
phase and validates the resolved images before acting. Rollback restores active6
before waiting on the active6-only Admin image. The runtime service contract also
checks every frozen image ID/tag and all available source/release/User labels.
The catalog state is hashed from a canonical 1000:1000, 0600, single-link file;
the general and Workflow review authorities remain distinct canonical 0700 roots
with exact 0600 children and profile-specific consumers. PostgreSQL reads its
already-validated password mount in-container before the fixed TCP read-only SQL.
Bootstrap zero-delta is derived by comparing the separately verified baseline and
target event/idempotency/head/source receipts, not by a collector literal. After a rollback command returns,
the coordinator reruns the same-release collector and existing-state verifier;
command success alone is not rollback evidence. The r12 launcher reuses the
frozen Node runtime helper and prepared control hashes, binds its request and
receipt to the deployment set/manifest/marker/bundle/payload, rejects request
replacement and existing units, uses a clean systemd worker environment, and
always has an allowlisted launcher/worker terminal path.

## Verification and remaining acceptance

Focused Node tests cover fixed argv, project/path/NODE injection rejection,
read-only transport markers, source/public TLS shape, secret/mount receipt
redaction, every mutation boundary plus rollback failure, immutable service
contracts, collector concurrency, and durable worker terminal structure.  No Docker, SSH, server,
transfer, prepare, launch, manifest write, or bundle creation was performed in
this structural slice.

The checked-in manifest remains the old r11 manifest. Its source-set verification
currently fails by design in this pre-freeze slice; an unchanged old manifest file
must not be described as an undrifted r12 manifest. The remaining gates are CTO
code audit, an authorized new manifest-controlled r12 bundle, true-Linux
prepared verification, actual systemd/HUP acceptance, and the single-stack
production-shaped retained success/failure matrix.  Those require a separate
CTO audit and explicit execution authorization.
