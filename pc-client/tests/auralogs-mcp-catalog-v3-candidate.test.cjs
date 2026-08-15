"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  assertFrozenInputHashes,
  buildCandidate,
  resource
} = require("../scripts/generate-auralogs-mcp-catalog-v3-candidate.cjs");

const root = path.resolve(__dirname, "..");
const candidateRelativePath =
  "docs/research/auralogs-mcp-catalog-v3-candidate-2026-08-15.json";
const candidatePath = path.join(root, candidateRelativePath);
const inputs = Object.freeze({
  baseCatalogV3: {
    path: "docs/research/official-mcp-registry-run3-ready4-catalog-v3-candidate-2026-08-15.json",
    sha256: "16116ca707a3dd344a252229758e359e3e4ba123fb6f4fbb8958166b689984e8"
  },
  primaryResearch: {
    path: "docs/research/official-mcp-registry-run3-next10-primary-review-2026-08-15.md",
    sha256: "c9cea0f78dc2c9d98c8487e4c91cd11743bbaaff507d58abd06b1a148676838a"
  }
});
const candidateSha256 =
  "dad1079b3ef04f06860901917c07f625b622d54ad26dc7e990cb6834594946d8";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function digestRaw(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function fileSha256(relativePath) {
  return digestRaw(fs.readFileSync(path.join(root, relativePath)));
}

function target(productId) {
  return {
    productId,
    compatibility: "official",
    moduleId: "resource-link",
    installProfileId: "",
    capabilities: ["website"],
    enabled: true
  };
}

test("Auralogs MCP catalog v3 candidate exists", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate artifact is missing");
});

test("candidate adds exactly one unsafe official link-only Auralogs MCP resource", () => {
  for (const input of Object.values(inputs)) {
    assert.equal(fileSha256(input.path), input.sha256, `frozen input drift: ${input.path}`);
  }
  assert.equal(fileSha256(candidateRelativePath), candidateSha256);

  const base = readJson(inputs.baseCatalogV3.path);
  const candidate = readJson(candidateRelativePath);
  assert.deepEqual(candidate, buildCandidate(base));
  assert.deepEqual(Object.keys(candidate).sort(), [
    "candidateOnly",
    "catalog",
    "freezeOnly",
    "generatedAt",
    "inputs",
    "publishable",
    "safety",
    "schemaVersion",
    "summary",
    "targetRelease",
    "title"
  ]);
  assert.deepEqual(
    [candidate.schemaVersion, candidate.candidateOnly, candidate.freezeOnly, candidate.publishable],
    [1, true, true, false]
  );
  assert.equal(candidate.targetRelease, "next-major");
  assert.deepEqual(candidate.inputs, inputs);
  assert.deepEqual(candidate.summary, {
    resources: 280,
    targets: 866,
    resourceConnections: 10,
    appendedResources: 1
  });
  assert.equal(candidate.catalog.schemaVersion, 3);
  assert.equal(candidate.catalog.updatedAt, base.catalog.updatedAt);
  assert.equal(candidate.catalog.resources.length, 280);
  assert.equal(
    candidate.catalog.resources.reduce((count, item) => count + item.targets.length, 0),
    866
  );
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);

  const auralogs = candidate.catalog.resources.at(-1);
  assert.deepEqual(auralogs, resource);
  assert.deepEqual(Object.keys(auralogs).sort(), [
    "credentialRequirements",
    "description",
    "enabled",
    "id",
    "installScope",
    "lastVerifiedAt",
    "metadataSnapshot",
    "name",
    "order",
    "provenanceEvidence",
    "publisher",
    "requestedPermissions",
    "resourceTypes",
    "reviewStatus",
    "riskLevel",
    "sourceKind",
    "targets",
    "tutorial",
    "uninstallPlan",
    "versionRef",
    "website"
  ]);
  assert.deepEqual(
    [auralogs.id, auralogs.name, auralogs.publisher, auralogs.order],
    ["auralogs-mcp", "Auralogs MCP", "Auralogs", 279]
  );
  assert.deepEqual(auralogs.resourceTypes, ["mcp"]);
  assert.deepEqual(
    [auralogs.sourceKind, auralogs.reviewStatus, auralogs.riskLevel],
    ["official", "manually-reviewed", "unsafe"]
  );
  assert.equal(Object.hasOwn(auralogs, "publisherVendorId"), false);
  assert.equal(Object.hasOwn(auralogs, "sourceProductIds"), false);
  assert.equal(auralogs.website, "https://github.com/auralogs-ai/auralogs-mcp");
  assert.equal(auralogs.tutorial, "https://docs.auralogs.ai/read-api/overview/");
  assert.equal(
    auralogs.versionRef,
    "official-mcp-registry:ai.auralogs/auralogs@0.1.0+hosted-service"
  );
  assert.deepEqual(auralogs.targets, [
    target("claude-desktop"),
    target("claude-code"),
    target("cursor-desktop"),
    target("cline-agent"),
    target("codex-cli")
  ]);
  assert.equal(
    candidate.catalog.resourceConnections.some(({ resourceId }) => resourceId === auralogs.id),
    false
  );

  assert.match(auralogs.description, /MIT/);
  assert.match(auralogs.description, /server/);
  assert.match(auralogs.description, /\u4e0d\u662f.*\u5f00\u6e90\u5b9e\u73b0/s);
  const permissions = auralogs.requestedPermissions.join("\n");
  const toolNames = [
    "list_projects",
    "get_project",
    "list_logs",
    "search_logs",
    "get_log",
    "list_analyses",
    "get_analysis"
  ];
  assert.equal(toolNames.filter((name) => permissions.includes(name)).length, 7);
  for (const fact of [/secret/, /stack trace/, /\u4e2a\u4eba\u6807\u8bc6/, /\u4e8b\u6545/, /\u652f\u4ed8/]) {
    assert.match(permissions, fact);
  }
  const credentials = auralogs.credentialRequirements.join("\n");
  for (const fact of [/project-scoped read key/, /SHA-256/, /401/, /read key/]) {
    assert.match(credentials, fact);
  }
  for (const action of ["\u4e0d\u8bf7\u6c42", "\u6536\u96c6", "\u4fdd\u5b58", "\u4ee3\u7406", "\u6821\u9a8c", "\u8f6c\u53d1"]) {
    assert.equal(credentials.includes(action), true, `missing never-collect boundary: ${action}`);
  }
  for (const fact of [
    /\u4e0d\u4e0b\u8f7d/,
    /\u4e0d\u5b89\u88c5/,
    /\u4e0d\u914d\u7f6e/,
    /\u4e0d\u8fde\u63a5/,
    /\u4e0d\u67e5\u8be2/,
    /Privacy/,
    /Terms/,
    /legal operator/,
    /processor/
  ]) assert.match(auralogs.installScope, fact);
  assert.match(auralogs.uninstallPlan, /7.*30.*90/s);
  assert.match(auralogs.uninstallPlan, /dashboard/);
  assert.match(auralogs.uninstallPlan, /read key/);
  assert.match(auralogs.uninstallPlan, /processor/);
  assert.deepEqual(auralogs.provenanceEvidence, [
    "https://github.com/auralogs-ai/auralogs-mcp",
    "https://github.com/auralogs-ai/auralogs-mcp/blob/main/server.json",
    "https://github.com/auralogs-ai/auralogs-mcp/blob/main/README.md",
    "https://github.com/auralogs-ai/auralogs-mcp/blob/main/LICENSE",
    "https://auralogs.ai/",
    "https://auralogs.ai/privacy",
    "https://auralogs.ai/terms"
  ]);
  assert.deepEqual(auralogs.metadataSnapshot, {
    sourcePlatform: "first-party-review",
    discoveredVia: "official-mcp-registry",
    sourcePage: "https://github.com/auralogs-ai/auralogs-mcp/blob/main/server.json",
    canonicalSource: "https://github.com/auralogs-ai/auralogs-mcp",
    originalAuthor: "Auralogs",
    licenseId: "MIT",
    sourceRevision: "registry-0.1.0+hosted-service",
    provenanceStatus: "first-party-verified",
    externalId: "official-mcp-registry:ai.auralogs/auralogs@0.1.0",
    observedAt: "2026-08-15T00:00:00.000Z",
    licenseStatus: "verified"
  });

  const forbiddenFields = new Set([
    "args", "command", "credential", "credentialValue", "credentialValues",
    "credentials", "endpoint", "env", "headers", "installArgs", "installCommand",
    "installPackage", "installRuntime", "managedInstall", "package", "path", "runtime",
    "runtimeConfig", "script", "secret", "token", "value"
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenFields.has(key), false, `forbidden runtime field: ${key}`);
      visit(child);
    }
  };
  visit(auralogs);

  assert.equal(validateCatalog(candidate.catalog), candidate.catalog);
  const reversed = structuredClone(candidate.catalog);
  assert.deepEqual(reversed.resources.pop(), auralogs);
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

test("generator rejects frozen drift and all four current/history identity lanes", () => {
  assert.throws(
    () => assertFrozenInputHashes({
      baseCatalogV3: "0".repeat(64),
      primaryResearch: inputs.primaryResearch.sha256
    }),
    /frozen input drift/
  );

  const base = readJson(inputs.baseCatalogV3.path);
  const currentMutations = [
    (item) => { item.id = "auralogs-mcp"; },
    (item) => {
      item.name = "  AURALOGS---mcp  ";
      item.publisher = "AURALOGS";
    },
    (item) => {
      item.metadataSnapshot.externalId =
        "official-mcp-registry:ai.auralogs/auralogs@0.1.0";
    },
    (item) => { item.website = "https://github.com/auralogs-ai/auralogs-mcp/"; }
  ];
  for (const mutate of currentMutations) {
    const duplicate = structuredClone(base);
    mutate(duplicate.catalog.resources.at(-1));
    assert.throws(() => buildCandidate(duplicate), /semantic identity already exists/);
  }

  const historyCollisions = [
    { id: "auralogs-mcp", name: "Other", publisher: "Other" },
    { id: "other-id", name: "Auralogs MCP", publisher: "Auralogs" },
    {
      id: "other-id",
      name: "Other",
      publisher: "Other",
      metadataSnapshot: {
        externalId: "official-mcp-registry:ai.auralogs/auralogs@0.1.0"
      }
    },
    {
      id: "other-id",
      name: "Other",
      publisher: "Other",
      metadataSnapshot: { canonicalSource: "https://github.com/auralogs-ai/auralogs-mcp/" }
    }
  ];
  for (const [index, collision] of historyCollisions.entries()) {
    assert.throws(
      () => buildCandidate(base, [{
        path: `docs/research/auralogs-history-collision-${index}.json`,
        raw: JSON.stringify({ proposedResources: [collision] })
      }]),
      /historical semantic identity already exists/
    );
  }
  assert.doesNotThrow(() => buildCandidate(base, [{
    path: "docs/research/auralogs-prose-only.json",
    raw: JSON.stringify({
      description: "Research prose mentions Auralogs MCP and github.com/auralogs-ai/auralogs-mcp."
    })
  }]));
});

test("history skips one exact resource only through verified direct or transitive ancestry", () => {
  const base = readJson(inputs.baseCatalogV3.path);
  const currentRaw = fs.readFileSync(candidatePath, "utf8");
  const current = JSON.parse(currentRaw);
  const anchor = { path: candidateRelativePath, raw: currentRaw };
  const directPath = "docs/research/future-auralogs-successor-candidate.json";
  const direct = structuredClone(current);
  direct.inputs = {
    parent: { path: candidateRelativePath, sha256: candidateSha256 }
  };
  const directRaw = JSON.stringify(direct);
  const directEntry = { path: directPath, raw: directRaw };
  assert.doesNotThrow(() => buildCandidate(base, [anchor, directEntry]));

  const transitive = structuredClone(direct);
  transitive.inputs = {
    parent: { path: directPath, sha256: digestRaw(directRaw) }
  };
  assert.doesNotThrow(() => buildCandidate(base, [anchor, directEntry, {
    path: "docs/research/transitive-auralogs-successor-candidate.json",
    raw: JSON.stringify(transitive)
  }]));

  const renamed = structuredClone(direct);
  renamed.catalog.resources.push({
    id: "renamed-independent-auralogs-copy",
    name: "Different hosted reader",
    publisher: "Different publisher",
    metadataSnapshot: { canonicalSource: "https://github.com/auralogs-ai/auralogs-mcp" }
  });
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/renamed-auralogs-successor-candidate.json",
      raw: JSON.stringify(renamed)
    }]),
    /historical semantic identity already exists/
  );

  const secondExact = structuredClone(direct);
  secondExact.catalog.resources.push(structuredClone(resource));
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/two-exact-auralogs-successor-candidate.json",
      raw: JSON.stringify(secondExact)
    }]),
    /historical semantic identity already exists/
  );

  const forgedHash = structuredClone(direct);
  forgedHash.inputs.parent.sha256 = "0".repeat(64);
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/forged-hash-auralogs-successor-candidate.json",
      raw: JSON.stringify(forgedHash)
    }]),
    /historical semantic identity already exists/
  );

  const forgedPath = structuredClone(direct);
  forgedPath.inputs.parent.path = "docs/research/not-the-auralogs-candidate.json";
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/forged-path-auralogs-successor-candidate.json",
      raw: JSON.stringify(forgedPath)
    }]),
    /historical semantic identity already exists/
  );

  const unknownAncestor = structuredClone(direct);
  unknownAncestor.inputs = {
    parent: {
      path: "docs/research/unknown-auralogs-ancestor-candidate.json",
      sha256: "f".repeat(64)
    }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/unknown-ancestor-auralogs-successor-candidate.json",
      raw: JSON.stringify(unknownAncestor)
    }]),
    /historical semantic identity already exists/
  );

  const cycleA = structuredClone(direct);
  const cycleB = structuredClone(direct);
  cycleA.inputs = {
    parent: { path: "docs/research/auralogs-cycle-b.json", sha256: "a".repeat(64) }
  };
  cycleB.inputs = {
    parent: { path: "docs/research/auralogs-cycle-a.json", sha256: "b".repeat(64) }
  };
  assert.throws(
    () => buildCandidate(base, [anchor, {
      path: "docs/research/auralogs-cycle-a.json",
      raw: JSON.stringify(cycleA)
    }, {
      path: "docs/research/auralogs-cycle-b.json",
      raw: JSON.stringify(cycleB)
    }]),
    /historical semantic identity already exists/
  );

  const badAnchor = { path: candidateRelativePath, raw: `${currentRaw.trimEnd()} ` };
  assert.throws(
    () => buildCandidate(base, [badAnchor, directEntry]),
    /frozen output anchor mismatch/
  );
});

test("builder rejects base drift and produces candidate bytes idempotently", () => {
  const base = readJson(inputs.baseCatalogV3.path);
  const invalid = structuredClone(base);
  invalid.catalog.resourceConnections.pop();
  assert.throws(() => buildCandidate(invalid), /base catalog v3 contract mismatch/);

  const first = `${JSON.stringify(buildCandidate(base), null, 2)}\n`;
  const second = `${JSON.stringify(buildCandidate(structuredClone(base)), null, 2)}\n`;
  assert.equal(second, first);
  assert.equal(first, fs.readFileSync(candidatePath, "utf8"));
  assert.equal(digestRaw(first), candidateSha256);
});
