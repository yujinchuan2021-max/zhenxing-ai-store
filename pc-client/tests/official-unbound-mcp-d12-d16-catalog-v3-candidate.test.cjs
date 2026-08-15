"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFrozenInputHashes,
  buildCandidate
} = require("../scripts/generate-official-unbound-mcp-d12-d16-catalog-v3-candidate.cjs");
const { validateCatalog } = require("../shared/catalog.cjs");

const root = path.resolve(__dirname, "..");
const candidateRelativePath =
  "docs/research/official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json";
const baseRelativePath =
  "docs/research/deepseek-harness-product-catalog-v3-candidate-2026-08-15.json";
const researchRelativePath =
  "docs/research/official-unbound-mcp-host-evidence-d12-d16-2026-08-15.md";
const candidatePath = path.join(root, candidateRelativePath);
const expectedCandidateSha =
  "3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function sha256(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

const targetIds = Object.freeze({
  "pagerduty-official-mcp": [
    "claude-desktop", "cursor-desktop", "microsoft-vscode"
  ],
  "launchdarkly-official-mcp": [
    "claude-desktop", "claude-code", "cursor-desktop", "microsoft-vscode",
    "github-copilot", "windsurf-editor"
  ],
  "snyk-studio-mcp": [
    "claude-code", "codex-cli", "cursor-desktop", "gemini-cli",
    "microsoft-vscode", "github-copilot", "windsurf-editor"
  ],
  "twilio-docs-mcp": [
    "claude-desktop", "claude-code", "cursor-desktop", "codex-cli"
  ],
  "square-official-mcp": [
    "claude-desktop", "goose-desktop", "cursor-desktop", "windsurf-editor"
  ]
});

test("official D12-D16 catalog v3 candidate is frozen", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate artifact is missing");
  assert.equal(sha256(fs.readFileSync(candidatePath)), expectedCandidateSha);
});

test("candidate appends five exact link-only MCP Resources and preserves the base", () => {
  const base = readJson(baseRelativePath);
  const candidate = readJson(candidateRelativePath);
  const appended = candidate.catalog.resources.slice(-5);

  assert.deepEqual(candidate, buildCandidate(base));
  assert.strictEqual(validateCatalog(candidate.catalog), candidate.catalog);
  assert.deepEqual(candidate.inputs, {
    baseCatalogV3: {
      path: baseRelativePath,
      sha256: "ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7"
    },
    research: {
      path: researchRelativePath,
      sha256: "df5225c2ffba72597c703073ccb5372d776ca7e01376871917ddbaa04200ecdf"
    }
  });
  for (const input of Object.values(candidate.inputs)) {
    assert.equal(sha256(fs.readFileSync(path.join(root, input.path))), input.sha256);
  }
  assert.deepEqual(candidate.summary, {
    vendors: 375,
    products: 616,
    resources: 275,
    targets: 845,
    resourceConnections: 10,
    appendedResources: 5
  });
  assert.deepEqual(appended.map(({ id }) => id), Object.keys(targetIds));
  assert.deepEqual(appended.map(({ order }) => order), [270, 271, 272, 273, 274]);

  for (const resource of appended) {
    assert.deepEqual(resource.resourceTypes, ["mcp"]);
    assert.equal(resource.enabled, true);
    assert.equal(resource.sourceKind, "official");
    assert.equal(resource.reviewStatus, "manually-reviewed");
    assert.equal(resource.riskLevel, resource.id === "twilio-docs-mcp" ? "guarded" : "unsafe");
    assert.deepEqual(resource.targets.map(({ productId }) => productId), targetIds[resource.id]);
    for (const target of resource.targets) {
      assert.deepEqual(target, {
        productId: target.productId,
        compatibility: "official",
        moduleId: "resource-link",
        installProfileId: "",
        capabilities: ["website"],
        enabled: true
      });
    }
    assert.equal(resource.credentialRequirements.some((item) => /不请求、收集、保存、代理、校验或转发/.test(item)), true);
    assert.equal(Object.hasOwn(resource, "publisherVendorId"), false);
    assert.equal(Object.hasOwn(resource, "sourceProductIds"), false);
  }

  const twilio = appended.find(({ id }) => id === "twilio-docs-mcp");
  assert.match(twilio.description, /Public Beta/);
  assert.equal(twilio.credentialRequirements.some((item) => /无需 Twilio 账户、API key/.test(item)), true);
  assert.equal(twilio.requestedPermissions.some((item) => /不执行 Twilio API/.test(item)), true);

  const forbidden = new Set([
    "args", "command", "credential", "credentialValue", "credentialValues",
    "credentials", "endpoint", "env", "headers", "installArgs", "installCommand",
    "installPackage", "installRuntime", "managedInstall", "package", "runtime",
    "runtimeConfig", "script", "secret", "token", "value"
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbidden.has(key), false, key);
      visit(child);
    }
  };
  appended.forEach(visit);

  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);
  const reversed = structuredClone(candidate.catalog);
  assert.deepEqual(reversed.resources.splice(-5), appended);
  assert.deepEqual(reversed, base.catalog);
  assert.deepEqual(candidate.safety, {
    candidateOnly: true,
    freezeOnly: true,
    publishable: false,
    linkOnlyNewTargets: true,
    credentialsCollected: false,
    oauthInitiated: false,
    connectionsStored: false,
    runtimeConfigurationStored: false,
    catalogWritten: false,
    stateWritten: false,
    signed: false,
    published: false
  });
});

test("frozen inputs and current or historical semantic identities fail closed", () => {
  const base = readJson(baseRelativePath);
  const candidate = readJson(candidateRelativePath);
  const template = candidate.catalog.resources.at(-5);

  assert.doesNotThrow(() => assertFrozenInputHashes({
    baseCatalogV3: "ff4bf6d15ae575d843c66d9b692c3343b981df47b8f94b8adc026c4b7a9580c7",
    research: "df5225c2ffba72597c703073ccb5372d776ca7e01376871917ddbaa04200ecdf"
  }));
  assert.throws(() => assertFrozenInputHashes({
    baseCatalogV3: "0".repeat(64),
    research: "df5225c2ffba72597c703073ccb5372d776ca7e01376871917ddbaa04200ecdf"
  }), /frozen input drift/);

  const currentDuplicate = structuredClone(base);
  const relatedIds = new Set(
    currentDuplicate.catalog.resourceConnections.map(({ resourceId }) => resourceId)
  );
  const replaceIndex = currentDuplicate.catalog.resources.findIndex(
    (resource) => resource.targets.length === template.targets.length && !relatedIds.has(resource.id)
  );
  assert.notEqual(replaceIndex, -1);
  currentDuplicate.catalog.resources[replaceIndex] = {
    ...structuredClone(template),
    id: "renamed-pagerduty-resource",
    name: "PagerDuty---MCP Server"
  };
  assert.throws(() => buildCandidate(currentDuplicate), /semantic identity already exists/);

  assert.throws(() => buildCandidate(base, [{
    path: "docs/research/renamed-square-review.json",
    raw: JSON.stringify({
      id: "renamed-square-resource",
      name: "Other payments tool",
      canonicalSource: "https://github.com/square/square-mcp-server/"
    })
  }]), /historical semantic identity already exists/);
  assert.doesNotThrow(() => buildCandidate(base, [{
    path: "docs/research/prose-only-review.json",
    raw: JSON.stringify({
      notes: "PagerDuty MCP and https://github.com/square/square-mcp-server are mentioned for research only"
    })
  }]));
});

test("history ancestry skips only one exact inherited copy of each frozen Resource", () => {
  const base = readJson(baseRelativePath);
  const currentRaw = fs.readFileSync(candidatePath, "utf8");
  const current = JSON.parse(currentRaw);
  const currentSha = sha256(currentRaw);
  const anchor = { path: candidateRelativePath, raw: currentRaw };
  const successorPath = "docs/research/future-d12-d16-candidate.json";
  const direct = structuredClone(current);
  direct.inputs = {
    parent: { path: candidateRelativePath, sha256: currentSha }
  };
  const directRaw = JSON.stringify(direct);

  assert.equal(currentSha, expectedCandidateSha);
  assert.doesNotThrow(() => buildCandidate(base, [anchor, {
    path: successorPath,
    raw: directRaw
  }]));

  const extraIdentity = structuredClone(direct);
  extraIdentity.catalog.resources.push({
    id: "renamed-independent-pagerduty-copy",
    name: "Other incident tool",
    website: "https://github.com/PagerDuty/pagerduty-mcp-server"
  });
  assert.throws(() => buildCandidate(base, [anchor, {
    path: "docs/research/successor-with-renamed-copy.json",
    raw: JSON.stringify(extraIdentity)
  }]), /historical semantic identity already exists/);

  const secondExact = structuredClone(direct);
  secondExact.catalog.resources.push(structuredClone(current.catalog.resources.at(-5)));
  assert.throws(() => buildCandidate(base, [anchor, {
    path: "docs/research/successor-with-second-exact.json",
    raw: JSON.stringify(secondExact)
  }]), /historical semantic identity already exists/);

  const forged = structuredClone(direct);
  forged.inputs.parent.sha256 = "0".repeat(64);
  assert.throws(() => buildCandidate(base, [anchor, {
    path: "docs/research/forged-successor.json",
    raw: JSON.stringify(forged)
  }]), /historical semantic identity already exists/);

  const unknown = structuredClone(direct);
  unknown.inputs.parent = {
    path: "docs/research/unknown-parent.json",
    sha256: "f".repeat(64)
  };
  assert.throws(() => buildCandidate(base, [anchor, {
    path: "docs/research/unknown-successor.json",
    raw: JSON.stringify(unknown)
  }]), /historical semantic identity already exists/);

  const transitive = structuredClone(direct);
  transitive.inputs = {
    parent: { path: successorPath, sha256: sha256(directRaw) }
  };
  assert.doesNotThrow(() => buildCandidate(base, [anchor, {
    path: successorPath,
    raw: directRaw
  }, {
    path: "docs/research/transitive-successor.json",
    raw: JSON.stringify(transitive)
  }]));

  const cycleA = structuredClone(direct);
  const cycleB = structuredClone(direct);
  cycleA.inputs = { parent: { path: "docs/research/cycle-b.json", sha256: "a".repeat(64) } };
  cycleB.inputs = { parent: { path: "docs/research/cycle-a.json", sha256: "b".repeat(64) } };
  assert.throws(() => buildCandidate(base, [anchor, {
    path: "docs/research/cycle-a.json",
    raw: JSON.stringify(cycleA)
  }, {
    path: "docs/research/cycle-b.json",
    raw: JSON.stringify(cycleB)
  }]), /historical semantic identity already exists/);
});
