# AI Hub managed extension resources

This directory is packaged as the read-only source root for locally approved
Skill and MCP snapshots. Backend catalog data cannot add files here or select
arbitrary paths. A resource becomes installable only after a matching profile
is added to `shared/extension-install-registry.cjs` and passes client tests.
