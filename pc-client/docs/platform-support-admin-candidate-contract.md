# Platform support Admin candidate contract

Status: `candidate-only`; execution remains disabled.

`shared/resource-platform-availability.cjs` is the sole validator and
projection. The Admin adapter at `admin/platform-support-candidate.cjs` only
delegates to it: optional product, resource, or future fixed-profile claims
are structurally validated there, and previews always return
`enabled: false` and `managedEligible: false`.

The optional `platformSupport` field is permitted only on a product or a
canonical resource. It is deliberately rejected on resource targets. A target
keeps its current host/module/profile/capabilities identity; future
availability is the shared intersection of resource support, host-product
support, fixed-profile support, and a client-fixed request.

Admin exposes controlled platform, runtime, status, architecture, first-party
HTTPS evidence, and observation-time controls. It cannot configure commands,
arguments, environment, headers, credentials, scripts, arbitrary endpoints,
paths, or target overrides. Existing entries omit the field and continue to
validate unchanged.

A fixed profile has no catalog field and is not added to the current registry.
Before any future activation, the client-registry owner must independently
review one platform-specific profile, artifact, lifecycle, and ownership
receipt. `unknown` or `blocked` claims, browser/remote claims presented as
native, cross-platform local profiles, and WSL/container without their
separate runtime dependency all fail closed in the shared projection.

The candidate test uses Windows product, macOS resource, and Linux profile
claims in memory. It rejects stale and unknown-field claims, rejects a target
copy, and proves that removing the in-memory fields restores the exact
615-product/146-resource baseline fixture. It does not modify draft89, v2
active6, Agent Broker behavior, or any catalog state.
