# Community SSO cookie Phase A handoff

Status: `candidateOnly=true`, `deployable=false`.

The real `maicol07/flarum-ext-sso` chain confirms one security defect: the old image emits the HTTPS `flarum_token` without `Secure`; the candidate image emits it with `Secure`, keeps the exact domain match, and preserves HTTP loopback with `Secure=false`. Ticket replay remains 401.

The same isolated chain was executed through a real Electron Chromium session using `persist:aihub-community`. Both old and candidate images completed two allowed-path redirects, ended at the approved root, logged in, and reported `tooManyRedirects=false`. Therefore this candidate does **not** reproduce or prove a fix for the user's `ERR_TOO_MANY_REDIRECTS`; redirect root cause remains `UNVERIFIED` and production deployment is prohibited.

The candidate image is `zhenxing-ai/flarum:aihub-community-sso-phasea-20260812`, image ID and repo digest `sha256:f0fa584cbcb62a9c95ab800a93364472a48a4ddb943f67279a0a2f9121484c4d`. The full source closure and sanitized evidence are under `output/community-sso-phasea-20260812/`.

Rollback handoff: no production action occurred. If a later separately approved deployment uses this image and fails, Test/Release must restore the previously frozen Flarum image tag/digest without altering MariaDB, Flarum config/storage/assets, Identity, or community cookies. This document does not authorize that deployment.
