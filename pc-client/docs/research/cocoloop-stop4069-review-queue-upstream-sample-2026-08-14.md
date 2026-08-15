# CocoLoop stop 4069 review queue: upstream sample

Date: 2026-08-14  
Status: frozen research only; not a resource candidate; not publisher review  
Scope: the ten IDs fixed in `cocoloop-skill-metadata-phase2-stop-4069-frozen-handoff-2026-08-14.md`

## Result

| Classification | Count |
| --- | ---: |
| `duplicate` | 1 |
| `reviewable` | 0 |
| `deferred` | 7 |
| `blocked` | 2 |
| Total | 10 |

No row is ready for catalog intake. `reviewable` here would only mean that an
original-author source, a 40-character Git commit, the Skill path/version,
same-commit license evidence, and a named compatible host were all closed. It
would still not mean AI Hub review, trust, publication, installation, or
execution authority.

Search was used only to discover possible upstreams. Decisions below use only
original-author or official repositories and their documentation. No CocoLoop
page or feed was revisited. No Skill, CLI, package, script, or repository was
installed, cloned, downloaded for execution, or executed.

## Fixed review queue

| ID | Queue slug | Class | Canonical upstream, revision, Skill/version and license | Publisher and compatible-host evidence | Execution / network / credential / write risk | Active v3 and history dedupe |
| ---: | --- | --- | --- | --- | --- | --- |
| 6 | `yt-digest` | `deferred` | No admissible original-author repository was found that binds this exact slug to a 40-character commit, `SKILL.md`, version, and same-commit license. Search-only owner/archive hints are not provenance. | Publisher and host are unverified. | Unknown until the actual Skill and support files are fixed; the title alone cannot establish whether transcript fetching, a local binary, credentials, or filesystem writes are used. | No exact id/name/canonical match. Active v3 has `Youtube Copy`, but copywriting and video digestion are not proven semantically identical, so it is not declared a duplicate. |
| 7 | `pihole-ctl` | `deferred` | No admissible original-author repository, fixed Skill path/version, or same-commit license was closed. A third-party security-report search hit is discovery only and was not used as publisher or license evidence. | Publisher and host are unverified. | Unknown until source is fixed. The slug suggests administration of a Pi-hole instance, but network, authentication, and mutating control cannot be asserted from a slug. | No exact or confirmed semantic resource duplicate in active v3 or the historical candidate JSON set. |
| 27 | `iterative-code-evolution` | `deferred` | No original-author repository could be bound to the exact slug with commit/path/version/license. Generic code-evolution repositories are not interchangeable. | Publisher and host are unverified. | Unknown; code modification, command execution, and repository writes must be assessed from the missing Skill rather than inferred from the translated title. | No exact or confirmed semantic resource duplicate in active v3 or history. |
| 33 | `google-tasks` | `duplicate` | The queue slug itself has no proven source binding. The same capability is already represented in history by Google Workspace's [`googleworkspace/cli@a3768d0e82ad83cca2da97724e46bea4ff0e6dbd:skills/gws-tasks/SKILL.md`](https://github.com/googleworkspace/cli/blob/a3768d0e82ad83cca2da97724e46bea4ff0e6dbd/skills/gws-tasks/SKILL.md), canonical name `gws-tasks`, version `0.22.5`; same-commit [Apache-2.0 license](https://github.com/googleworkspace/cli/blob/a3768d0e82ad83cca2da97724e46bea4ff0e6dbd/LICENSE). | Repository owner is the Google Workspace organization. The fixed README explicitly documents OpenClaw setup and a Gemini CLI extension; this evidence belongs to `gws-tasks`, not to an unproven `google-tasks` artifact. | The fixed Skill requires the `gws` binary and shared authentication, calls Google Tasks over the network, and exposes create/update/move/clear/delete operations. Credentials and destructive writes are therefore material. | Historical row `googleworkspace-cli-gws-tasks` / `github:googleworkspace/cli#gws-tasks` already records the capability as `blocked-credential-runtime-dynamic`. The queue row is a semantic duplicate of that review work, not an active v3 resource and not an alias authorization. |
| 57 | `conventional-commits` | `deferred` | The phrase is a public convention and appears in many unrelated repositories; no original-author Skill with the exact slug was bound to commit/path/version/license. | Publisher and host are unverified. | Unknown. Git command execution or commit creation would be high-impact if present, but cannot be attributed without the Skill bytes. | Active `Claude Code Commit Commands` and historical `getsentry-skills-commit` are only functional neighbors. There is no canonical identity proof, so neither is used to force a duplicate decision. |
| 70 | `garmin-connect` | `deferred` | No exact original-author Skill source, fixed commit/path/version, or same-commit license was closed. Garmin API/client projects found by topic are not proof of this Skill's origin. | Publisher and host are unverified; the Garmin brand in a slug is not publisher evidence. | Unknown pending source. Account credentials, health data, network calls, local exports, and remote writes are possible review surfaces, not established facts for this row. | No exact or confirmed semantic resource duplicate in active v3 or history. |
| 72 | `discord-chat` | `deferred` | No exact original-author Skill source was fixed. An official Anthropic repository contains a different Discord `access` Skill, which is not this slug and cannot be substituted. | Publisher and compatible host are unverified. Active v3 contains the Discord vendor/product host records, but a host record is not a Skill publisher or resource duplicate. | Unknown pending source. Bot/user tokens, message reads, message sends, moderation, and remote writes must be checked if the real Skill is located. | No exact Skill resource duplicate. `discord` / `discord-desktop` in active v3 are host identities only. |
| 74 | `lark-calendar` | `deferred` | Strong exact upstream: [`larksuite/cli@0c5530dc63b65b3fda86f667f5725b1a08f0c4dc:skills/lark-calendar/SKILL.md`](https://github.com/larksuite/cli/blob/0c5530dc63b65b3fda86f667f5725b1a08f0c4dc/skills/lark-calendar/SKILL.md), name `lark-calendar`, version `1.0.0`; same-commit [MIT license](https://github.com/larksuite/cli/blob/0c5530dc63b65b3fda86f667f5725b1a08f0c4dc/LICENSE). | Repository owner is LarkSuite and the fixed README lists `lark-calendar` under Agent Skills. It documents generic `npx skills add`, but does not name a catalog-compatible host for this exact revision; that remaining host edge keeps the row deferred. | Requires the `lark-cli` binary, Lark authentication and network access. The Skill reads calendars and can create/update events, alter attendees, RSVP, find/reserve rooms, and act as user or bot. | No Skill resource duplicate. Active v3's `bytedance-feishu` is a compatible-product possibility, not evidence of a relation and not a resource duplicate. |
| 101 | `webmcp` | `blocked` | Canonical collision. [`webmaxru/web-ai-agent-skills@f4c5a233067e5532699cc91546dcc81e6f802d77:skills/webmcp/SKILL.md`](https://github.com/webmaxru/web-ai-agent-skills/blob/f4c5a233067e5532699cc91546dcc81e6f802d77/skills/webmcp/SKILL.md) has exact name `webmcp`, version `1.5`, and inline `license: MIT`, but no root license file at that revision. OpenTiny's [`webmcp-sdk@f439dd757966678ec17885ed6bd9b7ad5b5361fc`](https://github.com/opentiny/webmcp-sdk/tree/f439dd757966678ec17885ed6bd9b7ad5b5361fc) advertises `webmcp-skill` and has a same-commit [MIT license](https://github.com/opentiny/webmcp-sdk/blob/f439dd757966678ec17885ed6bd9b7ad5b5361fc/LICENSE), while its advertised `packages/webmcp-skill/SKILL.md` path returns 404 at that fixed revision. A third primary repo exposes a differently named `add-webmcp-tools` Skill. | Multiple unrelated original publishers use the WebMCP term; the queue row has no evidence selecting one. Host support is also not attributable across them. | The exact-name Skill instructs code inspection, a Node scanning script, source edits, and browser-preview validation. The OpenTiny project adds CLI-driven browser perception/control. These risks cannot be merged into one unidentified artifact. | No active/history exact resource duplicate. Blocked because choosing an upstream would manufacture canonical identity, not because WebMCP as a topic is disallowed. |
| 106 | `brave-search-mcp` | `blocked` | Brave's official fixed source is [`brave/brave-search-mcp-server@937e85a61f69e36f5a88e44308d47836a8d5d523`](https://github.com/brave/brave-search-mcp-server/tree/937e85a61f69e36f5a88e44308d47836a8d5d523), package `@brave/brave-search-mcp-server` version `2.1.0`, MCP name `io.github.brave/brave-search-mcp-server`, with same-commit [MIT license](https://github.com/brave/brave-search-mcp-server/blob/937e85a61f69e36f5a88e44308d47836a8d5d523/LICENSE). It has no `SKILL.md`: it is an MCP server, not a Skill. | Package author is Brave Software, Inc. The fixed README documents Claude Desktop and VS Code as MCP hosts. That proves an MCP host relation only and cannot validate a Skill resource. | Runs an MCP server through Node/NPX or Docker, performs network searches, and requires `BRAVE_API_KEY`; API use may incur account/cost boundaries. | No active/history exact Skill resource duplicate. Blocked by resource-subtype mismatch; it belongs in an MCP review lane if not already represented there. |

## Dedupe boundary

The active comparison baseline was
`catalog-v3-resource-connections-candidate-2026-08-14.json`, SHA-256
`43bc18592106542d778ba47fc693fa42826b1febbdc166c7c9e2d9d617c95fd8`
(schema v3, 262 resources, 124 Skill resources). The historical strong-match
row is in `community-skill-batch1-complete-candidate-2026-08-08.json`, SHA-256
`51abdb1ac6983e02f12944cdf6175fa229f22b61ef942eaf99cee4d446fc951e`.

Exact ids, normalized names, and canonical sources were checked first. Semantic
comparison was then limited to evidence visible in the fixed upstream files and
the local candidate records. Cross-language paraphrase cannot be proven absent
from titles alone. Product/vendor records (`discord-desktop`,
`bytedance-feishu`) were not counted as Skill-resource duplicates, and nearby
capabilities (`Youtube Copy`, commit helpers) were not collapsed without
canonical identity evidence.

## Trust and license boundary

- A GitHub organization or package author establishes source attribution only;
  it does not grant AI Hub `official`, `reviewed`, or publisher trust.
- A repository license applies only to the bytes at the cited revision and
  does not license third-party APIs, account data, trademarks, models,
  dependencies, or hosted services.
- A repository's generic Agent Skills/install statement is not an exact host
  compatibility edge. Compatible hosts must be named by the fixed upstream or
  separately reviewed before catalog work.
- No discovery clue, translated title, registry slug, or brand name was used to
  infer credentials, commands, endpoints, permissions, or installation data.

## Next review gate

The seven deferred rows need an original-author link that resolves to a fixed
commit and exact Skill path, plus same-commit license and named-host evidence.
The two blocked rows need a canonical-identity or resource-type resolution,
not more catalog shaping. The duplicate row needs no new Skill candidate; any
future work should continue from the existing `gws-tasks` historical ledger and
re-review its credential/runtime boundary.

