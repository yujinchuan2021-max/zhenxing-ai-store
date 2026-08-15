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
