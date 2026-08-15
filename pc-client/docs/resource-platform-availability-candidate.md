# Resource platform availability candidate

Status: `candidate-only`. This contract is not wired to the active catalog
schema, Admin CRUD, publication, Electron OS detection, installation, or an
Agent execution port.

## One shared seam

`shared/resource-platform-availability.cjs` owns both structural validation
and projection:

```js
validatePlatformSupportClaims(claims, { now })
projectResourcePlatformAvailability({
  resourceSupport,
  hostSupport,
  profileSupport,
  requested,
  now
})
```

Catalog/resource projection and Agent Capability Broker must call this seam;
they must not reproduce platform matching. A target keeps its current identity,
module, profile, capability and enabled checks. Platform data is not duplicated
onto every target.

## Candidate claim shape

Each support record has exactly these fields:

```json
{
  "platform": "windows | macos | linux",
  "runtime": "native | wsl | container | browser | remote",
  "status": "supported | unsupported | unknown | blocked",
  "architectures": ["x64 | arm64 | x86 | universal | unknown"],
  "evidence": [{
    "kind": "first-party",
    "url": "https://vendor.example/platform-support",
    "observedAt": "2026-08-07T00:00:00.000Z"
  }]
}
```

Objects reject unknown fields, duplicate platform/runtime records, duplicate or
unknown architecture values, non-HTTPS/credential/hash URLs, future evidence,
and evidence older than the fixed 366-day candidate review window. An empty
architecture list and `unknown` remain representable but never match an
execution request. The signed directory still has to establish that an
evidence URL is genuinely first-party before a future schema may accept it;
the client does not infer ownership from hostname resemblance.

The runtime request has exactly `platform`, `runtime`, `architecture`, and
`runtimeDependencies`. It comes from a future platform-specific client build
or fixed runtime and is fixed when the Broker is constructed, never supplied by
catalog content or a per-workflow call. No OS auto-detection is added.

## Intersection and lifecycle boundary

Managed eligibility requires one supported, fresh, architecture-compatible
record in the resource, host product and fixed local profile. Any missing,
invalid, unsupported, unknown, blocked or empty intersection fails closed.
`universal` may satisfy a concrete requested architecture; `unknown` cannot.

- `browser` and `remote` may have explicit records for several platforms, but
  never satisfy a `native` request.
- `wsl` is valid only with platform `windows` and the independently confirmed
  `wsl` runtime dependency.
- `container` requires the independently confirmed `container` dependency and
  never satisfies the host's native runtime.
- `native`, `wsl`, and `container` profiles may approve only one platform.
  Therefore a Windows fixed profile, artifact, lifecycle and receipt cannot be
  reused for macOS/Linux. Each future platform needs a separately reviewed
  profile identity and ownership receipt boundary.

The returned projection contains only the requested platform/runtime/
architecture and booleans; evidence URLs and arbitrary catalog values do not
cross into an Agent capability plan.

## Current baseline and remaining work

Draft 89 / v2 active6 has no structured platform claim on any product,
resource or target, and the fixed extension registry has none on its profiles.
The candidate therefore grants no current managed/Agent binding by default.
Existing non-Agent Windows product, download and lifecycle behavior is
untouched.

Before activation, backend/catalog owners must add an unbound schema candidate,
verify every first-party claim, and keep requested platform out of writable
catalog data. Frontend/resource owners may later project display availability
through this same function. macOS/Linux profiles, artifacts, detection,
lifecycle and receipts require separate implementation and acceptance.
