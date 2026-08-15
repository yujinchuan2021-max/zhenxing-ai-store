# Agent Channel and Scenario Taxonomy Contract

`category` remains the editable product feature classification. It is not a
tag vocabulary. `scenarioTags` is a separate list of canonical IDs from
`shared/catalog-taxonomy.cjs`; aliases are intake/search conveniences and are
normalized before storage. The fixed vocabulary includes programming,
Agent/multi-Agent, automation/RPA, office, data, research, knowledge/docs,
writing, image, video/audio, 3D/CAD/industrial, gaming, game development,
marketing, ecommerce, finance, education, life/health, security/operations,
social communication, and browser/information collection.

`agentTag=true` is the ordinary compatibility tag. There is exactly one shared
`agentChannel="mature-agent"`, never a channel per Agent/product. Promotion is
candidate-only until a manually reviewed record contains a clear identity,
maintenance owner, at least three canonical host resources, two continuity
evidence IDs, and a review timestamp. The planner verifies that the resource
IDs actually target that product. Otherwise it stays only `agentTag=true`.

Hermes Desktop/Agent ecosystem is an explicit mature-Agent **candidate**, not
a saved catalog assignment. OpenClaw, Codex, Claude, Gemini, WorkBuddy, and
other products use the same evidence seam. Popular ordering is derived later
from observed content/use statistics; this contract stores no invented heat or
rank. No community UI, execution primitive, or publication is added here.
