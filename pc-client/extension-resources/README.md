# 枕星AI助手本地受管生态资源

This directory is packaged as the read-only source root for locally approved
Skill, MCP, and plugin snapshots. Catalog schema v2 stores each resource once
in top-level `resources`; store pages and target-product listings are projections
and do not create extra files here.

Backend catalog data cannot add files, package names, commands, configuration
fragments, or arbitrary paths. A resource-target pair becomes installable only
after its `moduleId` and `installProfileId` match a client-approved profile in
`shared/extension-install-registry.cjs` and pass client tests. Installation and
uninstallation must keep an ownership receipt and only change files or settings
owned by that receipt.
