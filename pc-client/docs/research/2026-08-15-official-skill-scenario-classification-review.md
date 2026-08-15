# Official Skill scenario classification review (2026-08-15)

Status: **research-only recommendation; candidate unchanged; not publishable**

## Result

The frozen Auralogs catalog contains 126 Resources whose `resourceTypes`
include `skill`. Existing scenario overlay already classifies 104 of them. This
review covers the remaining **22/22** Resources: **18 `official`** and **4
`reviewed-community`**.

- **19** Resources have enough first-party, resource-specific evidence for one
  or more canonical scenario recommendations.
- **3** collection-level Resources remain deliberately `unclassified` because
  their frozen evidence describes a mixed rolling directory, not a stable
  workload.
- The existing **104** classified Skill Resources are outside this review and
  remain unchanged.
- No catalog, candidate, generator, test, release, state, channel, package, or
  production data was modified. No Skill was downloaded, installed, or run.

These are proposed `scenarioTags` only. They do not change provenance,
compatibility, maturity, safety, permissions, or install eligibility.

## Frozen input

| Fact | Frozen value |
| --- | --- |
| Candidate | [`auralogs-mcp-catalog-v3-candidate-2026-08-15.json`](./auralogs-mcp-catalog-v3-candidate-2026-08-15.json) |
| SHA-256 | `dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8` |
| Bytes | `1,790,395` |
| Lines | `46,470` |
| Catalog Resources | `280` |
| Skill Resources | `126` |
| Existing non-empty Skill `scenarioTags` | `104` |
| Missing Skill `scenarioTags` reviewed here | `22` |

The review used the candidate's frozen `name`, `description`, `website`, and
`tutorial` values plus existing first-party audits under `docs/research/`.
There was no live network refresh and no keyword-generated classification.

## Taxonomy and decision rules

The only allowed IDs are the 21 canonical values in
[`shared/catalog-taxonomy.cjs`](../../shared/catalog-taxonomy.cjs):

```text
programming-development
agent-multi-agent
automation-rpa
office-collaboration
data-analytics
research
knowledge-docs
writing-content
image-design
video-audio
3d-cad-industrial
gaming
game-development
marketing
ecommerce
finance-investing
education
life-health
cybersecurity-operations
social-communication
browser-information-collection
```

Recommendations follow canonical taxonomy order and contain at most four IDs.
The evidence threshold is deliberately conservative:

1. A tag describes the Resource's evidenced workload, not merely the host
   product, Resource type, publisher, target, or store channel.
2. `agent-multi-agent` is not a synonym for every Skill. It is used only where
   the frozen Resource or first-party audit is specifically about Agent
   capability, orchestration, or Agent development.
3. A broad marketplace or rolling directory remains `unclassified` when its
   leaf contents span multiple unrelated workloads. It must be split into
   stable leaf Resources before receiving leaf-level business scenarios.
4. Input media does not by itself prove an output scenario. For example, Pika's
   first-party evidence supports video generation, so this review does not add
   `image-design` merely because images can be inputs.
5. Lifecycle, compatibility, and risk evidence is not promoted into a scenario
   claim. A link-only or unsafe Resource can still have an accurate scenario,
   while an official Resource can remain unclassified.

## Per-Resource recommendation ledger

| # | Exact `resourceId` | `sourceKind` | Recommended `scenarioTags` | Evidence and boundary |
| ---: | --- | --- | --- | --- |
| 1 | `openai-codex-skills-catalog` | `official` | **`unclassified`** | The frozen record and [first-party review](./skill-store-first-party-review-2026-08-06.md) establish a rolling OpenAI directory and its system/curated/experimental trust split, but no stable leaf workload. A mixed catalog must not inherit one guessed scene. |
| 2 | `openai-chatgpt-apps-skill` | `official` | `programming-development` | The fixed [ChatGPT Apps Skill](https://github.com/openai/skills/blob/49f948faa9258a0c61caceaf225e179651397431/skills/.curated/chatgpt-apps/SKILL.md) is explicitly for designing, building, and checking Apps SDK applications; the local [first-party review](./skill-store-first-party-review-2026-08-06.md) preserves that immutable identity. |
| 3 | `anythingllm-agent-skills` | `official` | `agent-multi-agent`, `automation-rpa` | Existing [first-party review](./skill-needs-review-batch-2026-08-05.md) confirms AnythingLLM application-internal Agent Skills, Skill Selection, flows, and MCP. Those facts support Agent capability and workflow automation, without asserting a leaf business domain. |
| 4 | `minimax-official-skills` | `official` | **`unclassified`** | The frozen description and [fixed-profile audit](./skill-fixed-profile-candidate-review-2026-08-06.md) establish only an official rolling repository/collection with host configuration. No selected leaf Skill or workload is frozen, so a scenario would be speculative. |
| 5 | `pika-mcp-skills` | `official` | `video-audio` | The existing [first-party ecosystem audit](./2026-07-31-ai-vendor-product-agent-ecosystem.md) records Pika's text/image/video-to-video service and its official Agent/MCP Skills surface; the [Skill review](./skill-needs-review-batch-2026-08-05.md) confirms creative/editing tools. This supports video creation, but not a separate image-output claim. |
| 6 | `hf-agent-skills` | `official` | `agent-multi-agent` | The frozen record points to Hugging Face's first-party [Agents overview](https://huggingface.co/docs/hub/agents-overview), which documents host-directed Agent Skill installation. The evidence is Agent capability, not a narrower content domain. |
| 7 | `openclaw-clawhub-skills` | `official` | **`unclassified`** | The frozen record and [first-party review](./skill-fixed-profile-candidate-review-2026-08-06.md) identify ClawHub as a rolling public registry whose packages can have different publishers and purposes. Registry identity cannot substitute for leaf scenario classification. |
| 8 | `hermes-agent-skills` | `official` | `agent-multi-agent` | The frozen description and [first-party ecosystem audit](./2026-07-31-ai-vendor-product-agent-ecosystem.md) state that Hermes creates and improves Agent Skills from experience. This supports Agent capability while leaving the many heterogeneous leaf workloads to leaf records. |
| 9 | `cline-official-skills-plugins` | `official` | `programming-development`, `agent-multi-agent` | The [first-party audit](./skill-needs-review-batch-2026-08-05.md) identifies Cline's modular Skills plus Plugin/MCP extension surfaces for its coding Agent. The tags describe coding-Agent extension work, not installation readiness or every leaf's business use. |
| 10 | `opencode-agent-skills` | `official` | `programming-development`, `agent-multi-agent` | The frozen description and [official Skills documentation](https://opencode.ai/docs/skills) describe local `.agents/skills` discovery for the OpenCode coding Agent. This supports coding-Agent extension work; it does not establish a registry-wide leaf taxonomy. |
| 11 | `matlab-agentic-toolkit` | `official` | `programming-development`, `data-analytics` | The [MathWorks audit](./2026-08-02-connectable-creator-batch2.md) records engineering computation, code inspection/execution, files, tests, and toolbox workflows in the official Toolkit. Those facts support programming and analytical computation; no separate `research` claim is needed. |
| 12 | `simulink-agentic-toolkit` | `official` | `programming-development`, `3d-cad-industrial` | The [MathWorks audit](./2026-08-02-connectable-creator-batch2.md) records model structure inspection, model editing, simulation, testing, and model-based design. That maps directly to development and industrial/modeling work without broadening ordinary simulation into generic RPA or research. |
| 13 | `nvidia-omniverse-agent-skills` | `official` | `programming-development`, `3d-cad-industrial` | The [first-party Omniverse audit](./2026-08-02-connectable-creator-batch2.md) records Kit/USD/OmniUI Skills, scene-code generation, USD layer edits, rendering, and physical simulation. This supports 3D/industrial development; the current broad entry should still be narrowed to stable leaf Skills later. |
| 14 | `cesium-agent-skills` | `official` | `programming-development`, `3d-cad-industrial` | The [Cesium first-party audit](./2026-08-02-connectable-industry-science-batch3.md) records CesiumJS, Cesium ion, 3D Tiles, geospatial best practices, and Cesium code generation. These facts support web development and 3D/geospatial work; they do not alone establish generic data analytics. |
| 15 | `meshy-3d-skill` | `official` | `3d-cad-industrial` | The frozen [Meshy documentation](https://docs.meshy.ai/en/agent/mcp-and-skill) and candidate description explicitly identify 3D creation from compatible coding Agents. The dedicated 3D taxonomy is sufficient; this review does not duplicate it into `image-design`. |
| 16 | `krea-agent-skills` | `official` | `image-design`, `video-audio` | The frozen [Krea Skills page](https://www.krea.ai/skills) and candidate description explicitly cover image, video, and enhancement workflows. Both media scenarios are directly evidenced. |
| 17 | `openclaw-summarize-skill` | `reviewed-community` | `knowledge-docs`, `writing-content`, `video-audio`, `browser-information-collection` | The pinned [OpenClaw Skill](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/skills/summarize/SKILL.md) summarizes or extracts URLs, files, podcasts, and media. The [frozen intake](./community-skill-store-cocoloop-next-batch-frozen-handoff-2026-08-13.md) preserves its exact source path and revision. |
| 18 | `openclaw-wacli-skill` | `reviewed-community` | `social-communication` | The pinned [OpenClaw Skill](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/extensions/whatsapp/skills/wacli/SKILL.md) covers explicit-request WhatsApp messaging and history search. Searching message history remains communication, not browser information collection. |
| 19 | `openclaw-mcporter-skill` | `reviewed-community` | `programming-development`, `agent-multi-agent` | The pinned [OpenClaw Skill](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/skills/mcporter/SKILL.md) lists, configures, authenticates, calls, and inspects MCP servers/tools. That is developer-facing Agent tool integration; mere tool invocation is not enough to add generic RPA. |
| 20 | `openclaw-weather-skill` | `reviewed-community` | `life-health`, `browser-information-collection` | The pinned [OpenClaw Skill](https://github.com/openclaw/openclaw/blob/6f99d3405cec1221c4fd9fa30f89795acc5f427d/skills/weather/SKILL.md) obtains current weather and forecasts through Web fetch with a guarded curl fallback. This is a daily-life information and Web retrieval workload. |
| 21 | `aws-agent-toolkit-agents-build` | `official` | `programming-development`, `agent-multi-agent`, `automation-rpa`, `cybersecurity-operations` | The fixed [AWS first-party audit](./aws-agents-build-skill-first-party-evidence-2026-08-14.md) records AgentCore project construction, multi-Agent/integration flows, AWS API/IAM and VPC changes, browser/code-interpreter automation, and cloud operations. All four tags are evidenced; they do not reduce the Resource's `unsafe`, link-only boundary. |
| 22 | `hermes-one-three-one-rule` | `official` | `office-collaboration`, `writing-content` | The pinned [Hermes Skill](https://github.com/NousResearch/hermes-agent/blob/642b735dbdbae4f01f5df0b9288d5f67a7e530f4/optional-skills/communication/one-three-one-rule/SKILL.md) is a prose decision format: one problem, exactly three options, one recommendation, a definition of done, and an implementation plan. This supports workplace decision writing without treating all communication as social messaging. |

## Recommended coverage if a later candidate applies this review

Applying exactly the 19 classified rows would produce **123/126** Skill
Resources with non-empty canonical `scenarioTags`; the three remaining broad
collections would stay unclassified:

1. `openai-codex-skills-catalog`
2. `minimax-official-skills`
3. `openclaw-clawhub-skills`

That remaining gap is intentional. The repair is stable leaf intake, not a
catch-all category. In particular, `agent-multi-agent` must not be used to hide
missing leaf evidence or to replace Agent maturity/host compatibility fields.

## STOP boundary

This report is the sole intended workspace addition. It is research evidence,
not a catalog mutation or publication instruction. A separate catalog-owner
task must revalidate the frozen input, encode only the approved rows, prove the
existing 104-row overlay is deep-equal, validate canonical IDs and tag order,
run semantic deduplication, and produce a new candidate/frozen handoff. This
review authorizes no draft save, signature, release, publish, package, upload,
download, install, update, connection, credential handling, or execution.
