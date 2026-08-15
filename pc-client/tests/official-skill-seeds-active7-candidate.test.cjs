const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const candidatePath = path.join(root, "docs/research/official-skill-seeds-candidate-active7-2026-08-14.json");
const researchPath = path.join(root, "docs/research/official-skill-seeds-sample-2026-08-14.md");
const activePath = path.join(root, "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json");
const researchSha256 = "d6ec0cb0652701dc7a1ca75eea343a72025fce89c247bbacefdedd09bdf219a1";
const activeSha256 = "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4";

const expected = [
  [1, "hermes-bundled", "hermes-apple-notes-skill", "apple-notes", "github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:skills/apple/apple-notes/SKILL.md", "blocked"],
  [2, "hermes-bundled", "hermes-codex-skill", "codex", "github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:skills/autonomous-ai-agents/codex/SKILL.md", "blocked"],
  [3, "hermes-bundled", "hermes-excalidraw-skill", "excalidraw", "github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:skills/creative/excalidraw/SKILL.md", "blocked"],
  [4, "hermes-optional", "hermes-solana-skill", "solana", "github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:optional-skills/blockchain/solana/SKILL.md", "blocked"],
  [5, "hermes-optional", "hermes-page-agent-skill", "page-agent", "github.com/NousResearch/hermes-agent@423f92e607dd51908d23b04758bc0fcd6ec5ff39:optional-skills/web-development/page-agent/SKILL.md", "blocked"],
  [6, "anthropic", "anthropic-skills-algorithmic-art", "algorithmic-art", "github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/algorithmic-art/SKILL.md", "duplicate"],
  [7, "anthropic", "anthropic-skills-claude-api", "claude-api", "github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/claude-api/SKILL.md", "blocked"],
  [8, "anthropic", "anthropic-skills-skill-creator", "skill-creator", "github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/skill-creator/SKILL.md", "duplicate"],
  [9, "anthropic", "anthropic-skills-docx", "docx", "github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/docx/SKILL.md", "blocked"],
  [10, "anthropic", "anthropic-skills-xlsx", "xlsx", "github.com/anthropics/skills@f6656c1256d5a8adfa37db9110046ef20bac644c:skills/xlsx/SKILL.md", "blocked"],
  [11, "microsoft-site", "microsoft-skills-agent-framework-azure-ai-py", "agent-framework-azure-ai-py", "github.com/microsoft/skills@f9c19ba07bf9bdfca6e3edf72319878d6111f59d:.github/plugins/azure-sdk-python/skills/agent-framework-azure-ai-py/SKILL.md", "deferred"],
  [12, "microsoft-site", "microsoft-skills-airunway-aks-setup", "airunway-aks-setup", "github.com/microsoft/skills@f9c19ba07bf9bdfca6e3edf72319878d6111f59d:.github/plugins/azure-skills/skills/airunway-aks-setup/SKILL.md", "deferred"],
  [13, "microsoft-site", "microsoft-skills-appinsights-instrumentation", "appinsights-instrumentation", "github.com/microsoft/skills@f9c19ba07bf9bdfca6e3edf72319878d6111f59d:.github/plugins/azure-skills/skills/appinsights-instrumentation/SKILL.md", "deferred"],
  [14, "microsoft-site", "microsoft-skills-applicationinsights-web-ts", "applicationinsights-web-ts", "github.com/microsoft/skills@f9c19ba07bf9bdfca6e3edf72319878d6111f59d:.github/plugins/azure-sdk-typescript/skills/applicationinsights-web-ts/SKILL.md", "deferred"],
  [15, "microsoft-site", "microsoft-skills-azure-ai", "azure-ai", "github.com/microsoft/skills@f9c19ba07bf9bdfca6e3edf72319878d6111f59d:.github/plugins/azure-skills/skills/azure-ai/SKILL.md", "deferred"],
  [16, "openai-plugins", "openai-plugins-linear", "linear", "github.com/openai/plugins@11c74d6ba24d3a6d48f54a194cd00ef3beea18f9:plugins/linear/skills/linear/SKILL.md", "blocked"],
  [17, "openai-plugins", "openai-plugins-capture-tasks-from-meeting-notes", "capture-tasks-from-meeting-notes", "github.com/openai/plugins@11c74d6ba24d3a6d48f54a194cd00ef3beea18f9:plugins/atlassian-rovo/skills/capture-tasks-from-meeting-notes/SKILL.md", "blocked"],
  [18, "openai-plugins", "openai-plugins-generate-status-report", "generate-status-report", "github.com/openai/plugins@11c74d6ba24d3a6d48f54a194cd00ef3beea18f9:plugins/atlassian-rovo/skills/generate-status-report/SKILL.md", "blocked"],
  [19, "openai-plugins", "openai-plugins-search-company-knowledge", "search-company-knowledge", "github.com/openai/plugins@11c74d6ba24d3a6d48f54a194cd00ef3beea18f9:plugins/atlassian-rovo/skills/search-company-knowledge/SKILL.md", "blocked"],
  [20, "openai-plugins", "openai-plugins-spec-to-backlog", "spec-to-backlog", "github.com/openai/plugins@11c74d6ba24d3a6d48f54a194cd00ef3beea18f9:plugins/atlassian-rovo/skills/spec-to-backlog/SKILL.md", "blocked"]
];

const fold = (value) => String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function canonicalParts(identity) {
  const match = /^github\.com\/([^/]+)\/([^@/]+)@([0-9a-f]{40}):(.+\/SKILL\.md)$/i.exec(identity);
  assert.ok(match, `invalid canonical identity: ${identity}`);
  return {
    commit: match[3].toLowerCase(),
    logicalPath: `${match[1]}/${match[2]}:${match[4].replace(/\/SKILL\.md$/i, "")}`.toLowerCase()
  };
}

function githubLogicalPath(value) {
  if (typeof value !== "string") return null;
  let parsed;
  try { parsed = new URL(value); } catch { return null; }
  if (parsed.hostname.toLowerCase() !== "github.com") return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 5 || !["tree", "blob"].includes(parts[2])) return null;
  const relative = parts.slice(4).join("/").replace(/\/SKILL\.md$/i, "");
  return `${parts[0]}/${parts[1]}:${relative}`.toLowerCase();
}

function activeIdentities(resources) {
  const byId = new Map();
  const byName = new Map();
  const byPath = new Map();
  for (const resource of resources) {
    byId.set(fold(resource.id), resource.id);
    const normalizedName = fold(resource.name);
    byName.set(normalizedName, [...(byName.get(normalizedName) || []), resource.id]);
    const urls = [resource.website, resource.tutorial, ...(resource.provenanceEvidence || [])];
    for (const url of urls) {
      const logicalPath = githubLogicalPath(url);
      if (logicalPath) byPath.set(logicalPath, [...new Set([...(byPath.get(logicalPath) || []), resource.id])]);
    }
  }
  return { byId, byName, byPath };
}

const forbiddenFields = new Set([
  "command", "commands", "args", "env", "endpoint", "endpoints", "token", "tokens",
  "apikey", "headers", "credentials", "managedinstall", "installcommand", "executable",
  "shell", "powershell", "cmd", "script", "scripts", "packagename", "packagespec"
]);
function collectForbiddenKeys(value, prefix = [], found = []) {
  if (Array.isArray(value)) value.forEach((item, index) => collectForbiddenKeys(item, [...prefix, String(index)], found));
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    const current = [...prefix, key];
    if (forbiddenFields.has(key.toLowerCase())) found.push(current.join("."));
    collectForbiddenKeys(child, current, found);
  }
  return found;
}

test("official Skill seed candidate exists before contract evaluation", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate must exist");
});

test("official Skill seed candidate freezes all 20 decisions against exact active7", () => {
  assert.equal(sha256(researchPath), researchSha256, "source research drifted");
  assert.equal(sha256(activePath), activeSha256, "active7 drifted");

  const candidate = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
  const release = JSON.parse(fs.readFileSync(activePath, "utf8"));
  const active = release.payload.catalog;
  const identities = activeIdentities(active.resources);

  assert.equal(candidate.candidateOnly, true);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.freezeOnly, true);
  assert.deepEqual(candidate.source, {
    researchPath: "docs/research/official-skill-seeds-sample-2026-08-14.md",
    researchSha256,
    activeReleaseId: "catalog-v00000007-8c49e1972186-0cec5335",
    activeCatalogPath: "admin/published/catalog-store/releases/catalog-v00000007-8c49e1972186-0cec5335.json",
    activeCatalogSha256: activeSha256,
    activeResources: 250,
    activeTargets: 777,
    activeSkillResources: 120
  });
  assert.deepEqual(candidate.summary, { observed: 20, ready: 0, duplicate: 2, deferred: 5, blocked: 13 });
  assert.deepEqual(candidate.proposedResources, []);
  assert.equal(candidate.reviewLedger.length, 20);
  assert.deepEqual(candidate.reviewLedger.map((row) => [row.rank, row.sourceGroup, row.candidateResourceId, row.name, row.canonicalIdentity, row.outcome]), expected);

  for (const row of candidate.reviewLedger) {
    assert.deepEqual(Object.keys(row), ["rank", "sourceGroup", "candidateResourceId", "name", "canonicalIdentity", "licenseEvidence", "hostEvidence", "riskEvidence", "dedupe", "outcome", "reason"]);
    const canonical = canonicalParts(row.canonicalIdentity);
    assert.ok(row.licenseEvidence.evidence.every((url) => url.includes(canonical.commit)), `license evidence must be pinned for rank ${row.rank}`);
    assert.ok(row.hostEvidence.evidence.every((url) => url.includes(canonical.commit)), `host evidence must be pinned for rank ${row.rank}`);
    const computed = {
      idMatches: identities.byId.has(fold(row.candidateResourceId)) ? [identities.byId.get(fold(row.candidateResourceId))] : [],
      nameMatches: [...(identities.byName.get(fold(row.name)) || [])].sort(),
      pathMatches: [...(identities.byPath.get(canonical.logicalPath) || [])].sort()
    };
    assert.deepEqual(row.dedupe, computed, `active7 dedupe drifted for rank ${row.rank}`);
    assert.equal(row.outcome === "duplicate", Object.values(computed).some((matches) => matches.length > 0), `duplicate outcome mismatch at rank ${row.rank}`);
  }

  assert.deepEqual(candidate.safety, {
    resourceLinkOnly: true,
    websiteCapabilityOnly: true,
    emptyInstallProfileOnly: true,
    localExecutionAuthorized: false,
    secretsCollected: false,
    activeCatalogWritten: false,
    stateWritten: false,
    channelWritten: false,
    releaseWritten: false,
    appWritten: false,
    schemaWritten: false,
    packageWritten: false,
    serverWritten: false
  });
  assert.deepEqual(collectForbiddenKeys(candidate), []);

  for (const resource of candidate.proposedResources) {
    assert.deepEqual(resource.resourceTypes, ["skill"]);
    assert.equal(resource.targets.length > 0, true);
    for (const target of resource.targets) assert.deepEqual(target, {
      productId: target.productId,
      compatibility: "official",
      moduleId: "resource-link",
      installProfileId: "",
      capabilities: ["website"],
      enabled: true
    });
  }
});
