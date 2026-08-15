# Identity PostgreSQL target readiness

Date: 2026-08-10

## Symptom and evidence

In fresh and partially initialized PostgreSQL data directories, Compose could
mark `identity-database` healthy while the `aihub` database was absent.
`pg_isready -h 127.0.0.1 -U aihub -d aihub` only confirmed that PostgreSQL was
accepting a connection; it did not run a query in the requested database.
The following TCP schema connection therefore failed with PostgreSQL `3D000`.

The focused disposable PostgreSQL regression proves this sequence: the old
probe succeeds while the target query is rejected; after explicit database
creation, TCP and socket queries both identify `aihub`, and Identity plus
Workflow migration apply/rollback/reapply contracts succeed.

## Root cause

`POSTGRES_DB=aihub` creates the database only during the official image's first
initialization of an empty PGDATA directory. A reused or partial directory may
already contain a PostgreSQL cluster but not that database. The prior health
probe conflated server reachability with the exact database/principal contract.

## Fix

The production `identity-database` health check now performs an authenticated
TCP `psql` query and succeeds only when `current_database()='aihub'` and
`current_user='aihub'`. It reads the existing in-container password file, emits
no secret or database error text, and neither creates databases nor retries.

The same `service_healthy` dependency remains the sole gate used by both the
outer Identity migration and the temporary acceptance project. In addition,
Identity migration itself checks the same exact database/principal contract
before any schema SQL and maps missing, inaccessible, or mismatched targets to
safe `503` errors.

## Verification and remaining boundary

Focused deployment, Identity migration, manifest, and image-closure tests cover
the exact query and reject `pg_isready` as an existence check. A new immutable
Identity candidate is required whenever this COPY closure changes. These are
local candidate gates only: a fresh independent production-shaped A-E run must
still validate the frozen release before any server preflight or change.

## P0 follow-up: pool receiver preservation

The first candidate implementation destructured `query` from the pool and
called it as a bare function. `pg-pool` requires its `this` receiver, so a
real `pg.Pool` incorrectly became `IDENTITY_DATABASE_UNAVAILABLE` even for the
valid `aihub` database and principal. The migration helper now accepts the
pool and calls `pool.query(...)` directly. A receiver-sensitive fake and a
fresh PostgreSQL fixture running the real Node `pg.Pool` cover this exact path;
the fixture also keeps the missing/wrong database and user cases fail-closed.

The prior `dee87.../b8ad...` Identity candidate is obsolete. Its replacement
is local candidate image
`zhenxing-ai/identity:workflow-readiness-candidate-4b8b12d20fcb`, image ID
`sha256:95510c1d911b4d48efeab2e7463570ec2078ade6fca481b8632a6f94ee9dfb40`,
with source digest
`4b8b12d20fcb37037011ea019f9b75546119de8ba9dd7c8772021eaccceaa0b5`.
It remains candidate-only and requires Backend to freeze a new deployment
manifest and independent release validation.

## Rollback image supply-chain closure

The fresh production-shaped harness previously depended on the prior 19a
Identity image already being present in the local Docker daemon. Cleanup could
remove that cache and block a rollback scenario before any business operation.
The protected production read-only stream is now preserved as an exact release
artifact: 58,887,168 bytes, SHA-256
`9205edae43228dd7afb66bf179ff321c032f2d8e47e71f61d65fc4165b56e904`.
Its recursive OCI index, runnable manifest, attestation manifest, config and all
layers close without an unreferenced blob; the target descriptor is the exact
19a image ID, while the config digest remains a separate valid descriptor.

Bundle creation and prepared-release verification reuse one strict archive
validator. The cutover and disposable four-quadrant harness both load that
manifest-controlled artifact, then inspect the exact tag, image ID, source and
release labels, and `User=node`. Missing, corrupt, extra-image, descriptor,
label, user, or layer drift fails before use. The pre-existing production image
ID gate remains unchanged; no retag, rebuild, pull, or server stream is used.

The same cache dependency existed for the prior Admin and self-built Flarum
images. The preserved multi-image archive is retained as provenance, while two
exact single-image exports are now bundled: old Admin (60,279,808 bytes,
SHA-256 `2604d520d1c0a428725c73f507598785cdbdb4c78ac80fba937eec4f953f0ad0`)
and Flarum (239,078,912 bytes, SHA-256
`2ed8a402b6020f8c7197c53ca2b3ded956b2ea57a616dd12ba8ef044844c779f`).
Both pass the same recursive closure and reject extra images. Production
cutover restores only Admin; the fresh harness restores Flarum before any
project/network exists. Official digest-pinned base images remain a single
aggregate local-image preflight.

## Prevention gate

PostgreSQL health gates that release sibling migrations must prove the exact
TCP database and principal with a query. Server-acceptance probes, socket-only
postmasters, sleeps, and implicit `CREATE DATABASE` are not valid substitutes.
