# Windows CLI managed expansion

Date: 2026-08-03

## Decision

The client-owned `npm` driver is reused for three official Windows-compatible
CLI packages. Each package is pinned to an exact version, installed from the
official npm registry with lifecycle scripts disabled, stored in the selected
AI Hub CLI directory, and removed only when an AI Hub ownership receipt
matches the installed package.

| Product | Fixed package | Runtime | Command |
| --- | --- | --- | --- |
| Promptfoo CLI | `promptfoo@0.121.20` | Node `>=22.22.0` | `promptfoo` |
| Continue CLI | `@continuedev/cli@1.5.47` | Node `>=20` | `cn` |
| Ruflo CLI | `ruflo@3.34.0` | Node `>=20`, Git | `ruflo` |

## Primary sources

- Promptfoo documents global npm installation, `promptfoo --version`, global
  npm uninstall, current Node requirements, and preservation of the user's
  `%USERPROFILE%\.promptfoo` data:
  <https://www.promptfoo.dev/docs/installation/>
- Continue documents its cross-platform npm path, Node 20 requirement,
  `cn --version`, first-run authentication, and interactive `cn` command:
  <https://docs.continue.dev/cli/quickstart>
- Ruflo documents native Windows npm/npx use, optional global installation,
  Node 20 and Git prerequisites, and global npm uninstall:
  <https://github.com/ruvnet/ruflo/wiki/Installation>
- Immutable npm registry metadata used for the reviewed package versions:
  <https://registry.npmjs.org/promptfoo/0.121.20>,
  <https://registry.npmjs.org/@continuedev%2fcli/1.5.47>, and
  <https://registry.npmjs.org/ruflo/3.34.0>.

## Package evidence

| Package | Registry integrity | Consumer lifecycle scripts |
| --- | --- | --- |
| `promptfoo@0.121.20` | `sha512-EgUwvF+mc7JGkCrf2eeBOjDD7XcX4rFuY5VMk53G9cEz398BcWH0RkYiov/iGZJEuILv7wzPqxxXPvxzUBgsXQ==` | no install/postinstall |
| `@continuedev/cli@1.5.47` | `sha512-gtpewV3RoIOD9dyTtKIBi1SY0VOHRu3Ehe7C/mmnswm+j34MPyrcQhQaWj/m+jdfGO4fNIKdrgGIlLso1ULDFw==` | no install/postinstall |
| `ruflo@3.34.0` | `sha512-tBgJoqIqADjEXNM8QGX7Fn+FgBPHEIneDienDG84wZ2rXAoaG/VROZFq/qLzm4zie4HpZ7GBeCpbZU/xUJNQJg==` | no install/postinstall |

Package manifests may contain maintainer-only `prepare` or
`prepublishOnly` scripts. AI Hub passes `--ignore-scripts`, so none of those
scripts run during the managed install or uninstall.

## Lifecycle boundary

- Install/update/repair use the same fixed registry, version and isolated npm
  configuration.
- Open launches the reviewed package binary in a visible command window.
- Uninstall removes only the exact package and AI Hub-owned prefix recorded in
  the receipt; it preserves unrelated packages and user project/config data.
- Authentication and API keys remain user-owned and are requested by the
  vendor tool on first use. AI Hub does not collect them.
