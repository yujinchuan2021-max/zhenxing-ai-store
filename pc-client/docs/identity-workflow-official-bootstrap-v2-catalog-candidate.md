# Identity official bootstrap fixed-v2 catalog candidate

Status: `candidateOnly=true`, `deployable=false`.

The official bootstrap accepts only the literal `catalogChannel === "v2"` and maps it internally to the sole Admin endpoint `http://admin:4173/channels/v2/catalog-release.json`. Callers cannot provide a URL, host, path, headers, or environment override. Missing or non-literal channels fail closed before any fetch.

Network, signature, JSON, and readiness failures are retryable HTTP 503. After complete verification, only an exact active7 `releaseId`/version/`catalogSha256` tuple matching the manifest may proceed; a verified release with a missing tuple is HTTP 400. Ordinary Identity runtime configuration is unchanged.

Current Identity-only closure:

```text
source digest       f18ec9d51b4e30bb01323e0d1c752d94a4b9e32556ef1e7dd845e3bfcdc358ee
manifest file SHA   58A7D790760D97876B06640C480AB662FDDA8A623F1F3F519FD42DCBF8BBE99C
manifest inputs     73
actual image COPY   71
tag                 zhenxing-ai/identity:workflow-readiness-candidate-f18ec9d51b4e
image ID            sha256:e76979a8c827eb4feb6e1f14026d8813f487535df654838299d139817b856731
release label       workflow-production-r7-2026-08-09
```

Manifest: `.aihub-identity-source-manifest.json` in the frozen r7 prepared release.

The Dockerfile and `.dockerignore` already include the complete Identity source closure; no edits were needed. Deployment wrappers/manifests still require a fresh Backend freeze and must call the fixed seam directly, not inject or replace URLs. No server, catalog, state, signature, or production action was performed.
