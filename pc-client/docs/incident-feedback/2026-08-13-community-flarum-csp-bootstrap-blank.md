# Community Flarum blank shell caused by CSP bootstrap denial

## Symptom

The 0.1.86 Windows client opened the approved community origin, but the embedded page showed only a blank content area. The application shell and community navigation remained responsive.

## Evidence

- The live 0.1.86 WebView reached the approved community root with a positive viewport and a complete document.
- The Flarum header, main, and footer shell existed, but the discussion list did not boot.
- The public root and `/api` returned 2xx responses. The versioned Flarum JavaScript, locale JavaScript, and stylesheet also returned 2xx responses with non-empty bodies.
- The public Caddy policy sent `script-src 'self'`, while the Flarum document requires inline bootstrap code to create `flarum` and invoke the application load and boot sequence.
- An independent Chromium run reproduced the empty shell with seven console errors. In the same browser session, temporarily bypassing CSP and reloading produced zero errors and rendered the three existing discussions. No cookie, account, server state, or community content was changed.

## Root cause

The public community CSP blocked Flarum's required inline bootstrap. The external Flarum bundle then ran without its bootstrap global and the server-rendered shell never became the discussion application.

This was not caused by the desktop WebView dimensions, the Identity account, the SSO ticket, missing static assets, the community API, or theme CSS.

## Minimal fix

Allow inline scripts only for the public Flarum virtual host:

```text
script-src 'self' 'unsafe-inline'
```

The private CMS virtual host on port 4174 remains `script-src 'self'`. No desktop, Identity, SSO, catalog, cookie, or database contract changes are required.

## Verification

- A focused regression failed before the Caddy change and passed afterward.
- The regression asserts that the public Flarum host permits its bootstrap while the private CMS host does not gain `unsafe-inline`.
- The initial broader community set completed 57 of 59 tests. Both failures were unrelated to the CSP change: one frozen Identity source digest mismatch and an Identity image COPY list missing two current shared dependencies.
- A follow-up local-only closure repair added only `catalog-key-retirement.cjs` and `catalog-localization.cjs` to the explicit Identity image COPY allowlist. Its recursive dependency regression now passes, and the deployment file completes 32 of 33 tests.
- The remaining failure intentionally preserves the old `2a114...` Identity image/source pin. It must stay fail-closed until a separately authorized new Identity image is built and frozen; the existing image and production service were not changed.
- `git diff --check` passed for the targeted change.

## Production recovery

The authorized production hotfix was activated on 2026-08-13 by recreating only the Caddy service with the existing pinned image and volumes. The old release configuration remains available for deterministic rollback. No desktop package, Identity service, Flarum service, database, secret, cookie, or catalog state was changed.

Post-activation checks confirmed:

1. the public CSP contains the intended public-host-only allowance;
2. the existing 0.1.86 client, using the original signed-in user and community partition without clearing cookies, renders all three existing discussions;
3. the public root, API, versioned JavaScript, locale JavaScript, and stylesheet return 2xx responses;
4. the private CMS CSP remains strict and public management routes remain unavailable;
5. the Caddy PID 1 remains the non-privileged `65534:65534` user/group with zero effective capabilities;
6. the Admin, Identity, community, and database service identities did not change during the rollout.

The user-visible blank community incident is resolved in production. A future Identity image rebuild remains blocked by the separate frozen source-digest gate noted above; this hotfix does not claim to authorize or perform that rebuild.

Do not repackage the desktop client for this server-header defect. A future Flarum integration should prefer nonce- or hash-authorized bootstrap scripts when supported, instead of broadening other origins or script sources.

## 2026-08-16 follow-up: Identity source closure drift

The two previously unrelated deployment-test failures were reproduced as a tight 31/33 RED. The current `shared/catalog.cjs` requires `resource-marketplace.cjs`, which in turn requires `catalog-projections.cjs`, but the explicit Identity Docker COPY allowlist omitted both files. The same test also compared current HEAD bytes with the older deployed `2a114…` image digest, conflating a source candidate with an already reviewed image.

The Dockerfile now copies exactly those two missing transitive dependencies. Its generated current source manifest is `d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8` with 78 manifest entries and 76 actual COPY inputs. Tests separately preserve the deployed `2a114…` image and workflow evidence until a new image is deliberately built and reviewed. The original deployment suite is 33/33 GREEN, and the generated shared dependency set equals the Docker COPY set.

This follow-up does not build, tag, load, deploy, or authorize a replacement Identity image. Production continues using the previously reviewed image; a future rebuild still requires its own isolated image and cutover acceptance.

## 2026-08-16 local Identity candidate verification

After the source-closure repair was committed, Docker Desktop 4.83.0 / Engine 29.6.2 built exactly one new local candidate from the fixed digest-pinned base without starting any application container: `zhenxing-ai/identity:workflow-readiness-candidate-d9fa8de84dc8`, image ID `sha256:981fcf842ab0700697ebfc324e99aac8da8ebc01b6c860a629550acd0d51ac01`, size 58,884,827 bytes. Its source/revision labels both equal `d9fa8de84dc8170a88bf81dea377e1df6e903fe3a71a5e1199716d624d4b43c8`, its release label is `candidate-only-d9fa8de84dc8`, and it runs as `node`.

Both real image-closure probes passed: all 76 Docker COPY inputs match current source length and SHA-256, required official-publisher modules load, and the image contains no secret-shaped path or private-key/token signature. The isolated catalog-readiness runner passed all seven cold/restart/network/signature/high-water/SHA/process-model scenarios and removed all seven temporary containers. Its report is `output/identity-catalog-readiness-docker-20260815190812166-f03153ee/report.json`, SHA-256 `bf1cd6c8a8178d409719ba9466885878e6d3df9cbdffd5d8fa641679f1107476`.

The same new image passed the disposable PostgreSQL Workflow migration matrix: pre-apply rollback is a no-op, zero-event apply/verify/rollback succeeds, and rollback after a valid event is refused while data remains. The fixture removed its temporary Compose project, database volume, secret, and files. These are local candidate gates only. Production Compose, cutover, release-bundle, and server state remain pinned to the reviewed `2a114…` image until a separate fresh A–E release decision.
