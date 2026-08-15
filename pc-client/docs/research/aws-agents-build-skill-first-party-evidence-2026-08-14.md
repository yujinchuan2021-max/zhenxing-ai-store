# AWS Agents Build Skill first-party evidence

Date: 2026-08-14

Status: **READY only for a high-risk, link-only Skill candidate; not a candidate artifact; not publishable**

Scope: `aws/agent-toolkit-for-aws` first-party repository at one fixed commit, plus read-only semantic dedupe against the local active7-derived, catalog-v3, and Brave candidates

## Decision

`agents-build` has enough first-party identity, version, publisher, host, and
license evidence to enter a later catalog-owner review as one canonical Skill.
It is not eligible for a managed profile, one-click install, automatic update,
Agent binding, command execution, credential handling, AWS API calls, or cloud
resource management by 枕星 AI.

The admissible shape is deliberately narrow:

| Proposed fact | Evidence-bound recommendation |
| --- | --- |
| Canonical resource ID | `aws-agent-toolkit-agents-build` |
| Resource type | `skill` only |
| Display name | `AWS Agents Build` |
| Publisher | `Amazon Web Services` (`publisherVendorId=amazon`) |
| Source product | `amazon-bedrock-agents` |
| Source kind | `official`; this means first-party source, not a safety guarantee |
| Version | `SKILL.md@1.0.0+1beb63a6a1d0760bb444961ea62cdca362edae72` |
| Review/risk proposal | `manually-reviewed` / `unsafe`; the warning must remain visible even though the catalog action is link-only |
| Exact minimum targets | `claude-code`, `codex-cli`, `cursor-desktop` |
| Target contract | Each target is `resource-link`, empty `installProfileId`, `capabilities=["website"]`, and no executable profile |
| Canonical source | The fixed `plugins/aws-agents/skills/agents-build` directory at the commit below |
| External identity | `github:aws/agent-toolkit-for-aws#plugins/aws-agents/skills/agents-build` |
| Catalog relationships | Add no `resourceConnections` edge and infer no fixed `skill-context` binding from a link-only target |

This is **READY-link-only**, not READY-managed. If the later candidate cannot
preserve the exact source revision, `unsafe` warning, never-collect credential
boundary, and empty executable profile, the decision falls back to `blocked`.

## Fixed first-party source

The official `main` ref was re-read with `git ls-remote` on 2026-08-14 and
resolved to:

```text
1beb63a6a1d0760bb444961ea62cdca362edae72  refs/heads/main
```

All conclusions below are pinned to that 40-character commit rather than the
moving branch.

| Evidence | Pinned first-party URL | Relevant fact |
| --- | --- | --- |
| Repository | [fixed tree](https://github.com/aws/agent-toolkit-for-aws/tree/1beb63a6a1d0760bb444961ea62cdca362edae72) | AWS-owned repository describes itself as the official, AWS-supported toolkit for MCP servers, skills, and plugins. |
| Exact Skill | [`agents-build/SKILL.md`](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/skills/agents-build/SKILL.md) | `name=agents-build`, `metadata.version=1.0.0`, `metadata.author=aws-agentcore`, `requires-cli=>=0.9.0`, and allowed tools `Read`, `Grep`, `Glob`, `Bash`. |
| Generic plugin manifest | [`plugins/aws-agents/plugin.json`](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/plugin.json) | Plugin version `1.0.0`, author `Amazon Web Services`, repository identity, and `Apache-2.0`. |
| Claude package | [Claude plugin manifest](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/.claude-plugin/plugin.json) | Packages `./skills/` and identifies the AWS publisher. |
| Codex package | [Codex plugin manifest](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/.codex-plugin/plugin.json) | Packages `./skills/`, declares `Read` and `Write` capabilities, and identifies the AWS publisher. |
| Cursor package | [Cursor plugin manifest](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/.cursor-plugin/plugin.json) | Packages `./skills/` and identifies the AWS publisher. |
| Marketplace package | [Claude marketplace entry](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/.claude-plugin/marketplace.json) and [Codex marketplace entry](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/.agents/plugins/marketplace.json) | Both enumerate `aws-agents`; the Claude entry fixes version `1.0.0`, while the Codex entry uses the repository-local plugin path and marks authentication at install. |
| Host and prerequisite guide | [`plugins/aws-agents/README.md`](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/README.md) and [root README](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/README.md) | The fixed repository packages plugins for Claude Code, Codex, and Cursor; AWS account credentials are required for API calls and script execution, but not for reading/discovering the Skill. |
| License | [root `LICENSE`](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/LICENSE) | Apache License 2.0 for the repository work at this revision. |

The first-party Skill version `1.0.0` is independently visible in the exact
`SKILL.md`; it must not be guessed from a discovery feed. The local ClawHub
first-100 batch remains correctly BLOCKED under its own strict-feed contract
because the feed value for `@aws/agents-build` was not strict semver. This
direct-source decision neither rewrites that feed value nor authorizes another
ClawHub request or candidate.

## Resource-channel boundary

The `aws-agents` **plugin** is a package containing multiple Skills and an AWS
Knowledge MCP configuration. The fixed plugin manifests point to `./skills/`
and `./.mcp.json`; the MCP files separately declare the remote
`awsknowledge` endpoint ([generic MCP manifest](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/mcp.json),
[host MCP manifest](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/.mcp.json)).

Therefore:

- `agents-build` remains one Skill resource and must not gain `mcp` or
  `plugin` as extra types merely because its containing plugin bundles them.
- The AWS Knowledge MCP endpoint is a separate future MCP review subject; it
  is not copied into this Skill's targets, permissions, or connection edges.
- The `aws-agents` plugin itself is a separate package identity. This report
  does not approve a plugin candidate or plugin installation.

## Capability and risk evidence

The Skill routes to capability-specific references and tells the agent to use
their processes, not merely summarize them. Consequently, the risk assessment
must include those referenced actions.

| Surface | Fixed first-party evidence | Catalog implication |
| --- | --- | --- |
| Commands and local writes | The Skill permits `Bash`, checks `agentcore --version`, reads `agentcore/agentcore.json`, and routes to flows that run AgentCore, AWS CLI, CDK, package-manager, and source-edit commands. The [integration reference](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/skills/agents-build/references/integrate.md) also documents `InvokeAgentRuntimeCommand`, which can execute arbitrary shell commands inside a live runtime with its filesystem, network namespace, and execution role. | Never place a command, args, env, path, script, endpoint, or fixed install profile in the catalog. Opening the pinned source is the only allowed action. |
| Cloud writes and IAM | Memory, integration, multi-agent, migration, VPC, browser, code-interpreter, and payment flows can edit project code/config and create or update AWS resources through AgentCore/CDK/AWS APIs. The Skill also directs model and IAM changes. | Treat as high-impact cloud administration guidance, not passive documentation or an installable data-only Skill. |
| Destructive deletion | The [teardown reference](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/skills/agents-build/references/teardown.md) uses `agentcore remove`, later deployment, CDK destroy, and CloudFormation deletion. It says runtime resources, memory data, credentials, policies, evaluators, and IAM roles may be removed; some data loss is permanent, while logs, ECR images, bootstrap state, and local files can persist and require separate cleanup. | `riskLevel=unsafe`; no install/uninstall button and no suggestion that closing a link reverses AWS-side effects. |
| VPC and network mutation | The [VPC reference](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/skills/agents-build/references/vpc.md) covers ENIs, subnets, security groups, NAT gateways, route tables, private endpoints, DNS, IAM, outbound internet access, and deployment. | Warn that following the Skill can change routing, exposure, availability, and cost. No network action may be proxied by 枕星 AI. |
| Browser automation | The [browser reference](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/skills/agents-build/references/browser.md) uses an isolated managed Chrome session driven through CDP by Strands, Nova Act, or Playwright. It can navigate sites, fill forms, scrape data, use live view/recording, and requires scoped IAM; Nova Act additionally needs its own API key. | State that browsing may transmit data and perform user-visible remote actions. Do not collect browser credentials or API keys. |
| Code execution | The [Code Interpreter reference](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/skills/agents-build/references/code-interpreter.md) executes Python, JavaScript, or TypeScript in a session sandbox, reads/writes files, can install packages, can use network access, and can write to S3 through a custom role. Sessions can incur cost if leaked. | This is executable capability, not data-only guidance. No sandbox invocation, package install, file upload, or S3 permission is granted by a catalog listing. |
| Payments | The [payments reference](https://github.com/aws/agent-toolkit-for-aws/blob/1beb63a6a1d0760bb444961ea62cdca362edae72/plugins/aws-agents/skills/agents-build/references/payments.md) provisions payment managers/connectors, IAM, per-user instruments and sessions; handles provider secrets, wallet delegation and funding; and enables budget-bounded agent spend. It warns that connector secrets are written locally before upload and that credentials must not pass through the agent or chat. | Payment, wallet, account, secret, funding, budget, and spend actions require explicit provider/user control outside 枕星 AI. Link-only is the maximum admissible catalog authority. |

The presence of isolation, IAM controls, CloudTrail, budgets, or warnings in the
upstream improves operational guidance but is not a safety certification. A
compromised or over-permissioned caller can still change project files, reach
network resources, spend funds, or destroy cloud state.

## Account, credential, and runtime prerequisites

First-party evidence establishes these prerequisites, but a later catalog
record must describe them without storing values:

- an existing AgentCore project or an explicit transition to the separate
  get-started flow;
- AgentCore CLI `>=0.9.0`;
- an AWS account, selected Region, locally configured AWS credentials, and
  capability-specific least-privilege IAM/model/service access for API calls;
- optional network identifiers such as VPC, subnet, security-group, endpoint,
  route, and account/role identifiers;
- optional third-party secrets and accounts, including Nova Act or payment
  providers, plus user-controlled wallet delegation and funding;
- capability-specific SDKs, runtimes, packages, deployed resources, and cloud
  billing.

The safe catalog wording is: users keep all AWS credentials, tokens, API keys,
JWTs, payment-provider secrets, wallet authority, and billing decisions in the
official tools or target host; 枕星 AI does not request, collect, store, proxy,
validate, or forward them.

## Exact host recommendation

The minimum target set is intentionally limited to existing enabled
`ai-tool` products that have a matching fixed plugin package:

| Existing product ID | Fixed evidence | Proposed compatibility |
| --- | --- | --- |
| `claude-code` | Claude plugin manifest packages the same `./skills/` tree. | `official` |
| `codex-cli` | Codex plugin manifest packages the same `./skills/` tree. | `official` |
| `cursor-desktop` | Cursor plugin manifest packages the same `./skills/` tree. | `official` |

The plugin README also describes manual Skill installation for Kiro and other
agents. That broader guidance is not needed for this minimum candidate and
should not be converted into extra targets without a separate host-edge review.
In particular, do not infer `claude-desktop`, `chatgpt-desktop`, or an arbitrary
SKILL.md-capable client from the repository's generic wording.

## Local semantic dedupe

The comparison was read-only and used exact IDs, normalized names, pinned
canonical source paths, publisher/source product, resource type, and capability
semantics. Product/vendor records were not counted as Resource duplicates.

| Local snapshot | SHA-256 | Resources | Relevant result |
| --- | --- | ---: | --- |
| `resource-store-next-major-catalog-candidate-active7-2026-08-14.json` | `8822496b0b768605f2a0ecd7c6ebf70759107cb215cfb2cce1a6a2ae5caaf302` | 262 | No exact `agents-build`, Agent Toolkit Skill path, or external identity. |
| `catalog-v3-resource-connections-candidate-2026-08-14.json` | `43bc18592106542d778ba47fc693fa42826b1febbdc166c7c9e2d9d617c95fd8` | 262 | Same 262 Resource IDs as the active7-derived candidate; no canonical duplicate. |
| `brave-search-mcp-catalog-v3-candidate-2026-08-14.json` | `990721f3f8e55923d7014eb603ed9c3059e7e06f66415991b08e7e3164aca219` | 263 | Adds only `brave-search-mcp-server`; no canonical or semantic collision with this Skill. |

Nearby local records do not collapse the identity:

- `aws-mcp-servers` is an MCP resource pointing to the legacy
  `awslabs/mcp` repository. The fixed AWS README calls Agent Toolkit a
  successor at the repository-program level, but `agents-build` is a specific
  Skill with a different path, type, and capability. Keep both identities and
  review migration/supersession separately.
- `amazon-kiro-powers` is a Kiro plugin resource, not this Skill.
- Playwright, browser, memory, and other MCP resources may expose neighboring
  capabilities, but they do not share the AWS Skill's canonical source or
  identity.

No exact duplicate, alias, or replacement relation is established. The
recommended ID must still be rejected by a future generator if that ID, the
normalized name plus publisher, the exact Skill path, or the external identity
appears in its then-current base.

## License boundary

The pinned root README and `LICENSE`, plus the plugin manifests, establish
`Apache-2.0` for the repository work at this revision. A later link-only
candidate may record `licenseId=Apache-2.0`, `licenseStatus=verified`, and the
fixed root license URL for this Skill's source bytes.

That conclusion does **not** license or reclassify external dependencies,
package registries, AWS services, AWS account data, models, third-party APIs,
Nova Act, Playwright, Coinbase CDP, Stripe/Privy, x402 components, wallets,
hosted content, or trademarks. Each keeps its own license, terms, privacy,
account, and billing boundary. If a future product copies or redistributes
repository bytes instead of only linking, Apache-2.0 redistribution and NOTICE
obligations need a separate artifact review.

## Future candidate gate

A separate catalog-owner slice may create a candidate only if it proves all of
the following and leaves current active/state/channel/release data untouched:

1. the exact commit, Skill path, declared `1.0.0` version, AWS publisher, and
   root Apache-2.0 evidence remain byte-for-byte pinned;
2. only the three minimum target IDs above are used, each as website-only
   `resource-link` with an empty profile;
3. the resource carries an explicit high-risk warning covering commands,
   cloud writes, IAM, VPC/network, browser automation, code execution,
   credentials, payments, cost, and destructive deletion;
4. recursive forbidden-field checks find no command, args, env, headers,
   endpoint, token, secret, credential value, script, path, package install,
   or executable runtime contract;
5. no MCP or plugin type, bundled AWS Knowledge endpoint, install instruction,
   connection edge, or managed lifecycle is copied into the Skill;
6. reverse-removing the proposed Resource leaves the selected frozen catalog
   base and all existing `resourceConnections` byte-semantically unchanged;
7. current active/history/candidate semantic dedupe is rerun at generation
   time rather than trusting this 2026-08-14 snapshot.

This research created no candidate, test, generator, draft, signature, release,
package, install, login, AWS call, credential state, or cloud resource.
