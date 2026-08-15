# AWS Agents Build Skill catalog v3 frozen handoff

Date: 2026-08-14

Status: **candidate-only / freeze-only / not publishable**

This handoff freezes one incremental, link-only Skill Resource over the Brave Search MCP catalog v3 candidate. It does not authorize an Admin draft, active catalog or channel write, signing, publishing, packaging, cloning, downloading, installation, host configuration, command execution, credential collection, AWS login, AWS or third-party API call, cloud mutation, server startup, or GUI acceptance.

## Frozen inputs

| Input | SHA-256 |
| --- | --- |
| `docs/research/brave-search-mcp-catalog-v3-candidate-2026-08-14.json` | `990721f3f8e55923d7014eb603ed9c3059e7e06f66415991b08e7e3164aca219` |
| `docs/research/aws-agents-build-skill-first-party-evidence-2026-08-14.md` | `aefb6d0a43a6aab04f2ff0bb619ad38c03f7817e1ececd643d33840e7ff9ef29` |

Fixed first-party facts:

- repository: `aws/agent-toolkit-for-aws`
- commit: `1beb63a6a1d0760bb444961ea62cdca362edae72`
- Skill path: `plugins/aws-agents/skills/agents-build/SKILL.md`
- Skill version: `1.0.0`
- publisher: Amazon Web Services / AWS AgentCore
- same-commit repository license: `Apache-2.0`
- same-commit host manifests: Claude Code, Codex CLI, and Cursor
- prerequisite boundary: user-owned AWS account, Region, local AWS credentials, AgentCore CLI `>=0.9.0`, and capability-specific IAM; browser, payment, and wallet flows may require additional user-owned third-party accounts, provider secrets, wallet delegation, and funding

The repository-level Apache-2.0 finding applies only to the fixed repository bytes reviewed here. It is not extended to AWS services, third-party services, downloaded packages, generated projects, or other external dependencies.

No network request, installation, login, AWS call, or cloud mutation was made in this candidate slice. The frozen first-party research and local base were sufficient.

## Exact candidate transformation

The generator verifies both input hashes, validates the unchanged v3 base through `validateCatalog`, rejects exact ID, normalized name/publisher, external identity, or canonical fixed Skill-path duplicates in the base and current catalog history, structured-clones the base, and appends exactly one Resource:

- `id=aws-agent-toolkit-agents-build`
- `resourceTypes=["skill"]`
- `publisherVendorId=amazon`
- `sourceProductIds=[]`
- `sourceKind=official`
- `reviewStatus=manually-reviewed`
- `riskLevel=unsafe`
- `versionRef=SKILL.md@1.0.0+1beb63a6a1d0760bb444961ea62cdca362edae72`
- exact first-party Skill directory, `SKILL.md`, plugin manifests, root README, and root Apache-2.0 license evidence at the same commit

The only targets are `claude-code`, `codex-cli`, and `cursor-desktop`. Each target is exactly `compatibility=official`, `moduleId=resource-link`, `installProfileId=""`, `capabilities=["website"]`, and `enabled=true`.

The unsafe description and permission notices expressly cover Bash and local file writes, AWS API and IAM changes, VPC and network changes, browser automation, Code Interpreter and code execution, payment and actual spend, permanent deletion, and possible residual logs, ECR images, and local files. The credential notice states that 枕星 AI never requests, collects, stores, proxies, validates, or forwards AWS access keys, IAM/JWT material, API keys, tokens, third-party or payment provider secrets, wallet keys, authorizations, or funds.

The link-only scope does not contain or manage any command, arguments, environment variables, headers, endpoint, token, secret, credential value, script, path, package, runtime, installer, or host configuration. It does not clone, download, copy, install, start, execute, authenticate, or mutate local, AWS, third-party, payment, or wallet state. It does not copy or reclassify AWS Knowledge MCP or a plugin as part of this Resource.

No `resourceConnections` edge was added or inferred. The ten relationship rows deep-equal the Brave base rows before and after the transformation. Removing the final AWS Resource deep-equals the complete frozen Brave base catalog.

Exact totals:

| Measure | Base | Candidate |
| --- | ---: | ---: |
| Resources | 263 | 264 |
| Targets | 798 | 801 |
| Resource connections | 10 | 10 |

Candidate SHA-256: `c7cd67c2b4b34fd19cfbe217d728f7d572c22db1df479e663372b257c067e74d`

## Source-product contract decision

The first generator attempt used the initially proposed `sourceProductIds=["amazon-bedrock-agents"]` and failed closed before writing the candidate:

```text
Error: 生态资源来源产品必须属于 AI 可接入目录：aws-agent-toolkit-agents-build
```

The current catalog defines `amazon-bedrock-agents` as an enabled `ai-tool`, while `sourceProductIds` may reference only an `ai-connectable` product. Binding this Skill to that product would therefore violate the frozen catalog contract and fabricate a source-product relationship. The approved minimal resolution is `sourceProductIds=[]`: AWS publisher identity, the fixed repository and Skill path, the pinned commit, and the external identity retain the first-party provenance without changing a product, schema, or generalized `aws-cloud-platform` relation.

The focused test retains the rejected `amazon-bedrock-agents` value as a counterexample and requires the exact catalog validation error above.

## TDD evidence

Required initial RED after adding only the focused existence test:

```text
node --test tests/aws-agents-build-skill-catalog-v3-candidate.test.cjs
tests 1; pass 0; fail 1
AssertionError: AWS Agents Build Skill candidate must exist
```

After the minimal generator was added, the first source-product value produced the independent contract RED documented above and wrote no candidate. After the explicit `sourceProductIds=[]` decision, the generator wrote exactly one Resource and the existence slice passed 1/1.

The retained focused suite then checks frozen hashes, exact Resource and target fields, pinned provenance/version/license facts, unsafe notices and never-collect wording, recursive managed-runtime field exclusion, absence of AWS Knowledge/plugin copying, unchanged relationships, reverse equivalence to the Brave base, public validation, base/current-history semantic duplicate rejection, the rejected source-product counterexample, and byte-idempotent generation.

Focused GREEN before freeze:

```text
node --test tests/aws-agents-build-skill-catalog-v3-candidate.test.cjs
tests 5; pass 5; fail 0
```

Final focused plus Brave/v3/next-major regression:

```text
node --test tests/aws-agents-build-skill-catalog-v3-candidate.test.cjs tests/brave-search-mcp-catalog-v3-candidate.test.cjs tests/catalog-v3-resource-connections.test.cjs tests/resource-store-next-major-catalog-candidate.test.cjs
tests 20; pass 20; fail 0
```

All four final file hashes are recorded in the completion record after this handoff itself is frozen; embedding the handoff's own SHA inside its bytes would be self-referential. The manifest contract is UTF-8 without BOM, repo-relative paths sorted ordinally, one line per file as `<sha256>  <path>\n`, with SHA-256 computed over the four complete lines.

## Protected scope

Only the AWS generator, focused test, candidate JSON, and this handoff were added. The research report, Brave base candidate and handoff, prior v3 candidates, active/history catalogs, state, channel, release, `src/App.tsx`, server, package files, product records, schemas, shared catalog validator, and runtime modules were not edited. Existing dirty worktree bytes were preserved and are not represented as clean.
