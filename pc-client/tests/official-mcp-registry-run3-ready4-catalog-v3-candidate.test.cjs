"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCatalog } = require("../shared/catalog.cjs");
const {
  assertFrozenInputHashes,
  buildCandidate,
  newResources
} = require("../scripts/generate-official-mcp-registry-run3-ready4-catalog-v3-candidate.cjs");

const root = path.resolve(__dirname, "..");
const candidatePath = path.resolve(__dirname, "..", "docs", "research", "official-mcp-registry-run3-ready4-catalog-v3-candidate-2026-08-15.json");
const candidateRelativePath = "docs/research/official-mcp-registry-run3-ready4-catalog-v3-candidate-2026-08-15.json";
const basePath = path.join(root, "docs", "research", "official-unbound-mcp-d12-d16-catalog-v3-candidate-2026-08-15.json");
const generatorPath = path.join(root, "scripts", "generate-official-mcp-registry-run3-ready4-catalog-v3-candidate.cjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function totalTargets(catalog) {
  return catalog.resources.reduce((count, resource) => count + resource.targets.length, 0);
}

test("Official Registry run3 ready4 candidate exists", () => {
  assert.equal(fs.existsSync(candidatePath), true, "candidate artifact is missing");
});

test("candidate is an exact validated ready4 successor with no new connection edges", () => {
  const candidate = readJson(candidatePath);
  const base = readJson(basePath);
  assert.deepEqual(candidate, buildCandidate(base));
  assert.equal(validateCatalog(candidate.catalog), candidate.catalog);
  assert.deepEqual(candidate.summary, {
    vendors: 375,
    products: 616,
    resources: 279,
    targets: 861,
    resourceConnections: 10,
    appendedResources: 4,
    correctedResources: 2
  });
  assert.equal(totalTargets(candidate.catalog), 861);
  assert.deepEqual(candidate.catalog.resourceConnections, base.catalog.resourceConnections);
  assert.deepEqual(candidate.catalog.resources.slice(-4), newResources);

  const expectedHosts = new Map([
    ["anomalyarmor-mcp", ["claude-code", "cursor-desktop", "claude-desktop"]],
    ["borealhost-mcp", ["cursor-desktop", "windsurf-editor"]],
    ["chronary-mcp", ["claude-desktop", "claude-code", "cursor-desktop", "microsoft-vscode", "github-copilot", "windsurf-editor"]],
    ["foura-mcp", ["claude-desktop", "claude-code", "cursor-desktop", "windsurf-editor", "microsoft-vscode"]]
  ]);
  for (const resource of newResources) {
    assert.deepEqual(resource.resourceTypes, ["mcp"]);
    assert.equal(resource.sourceKind, "official");
    assert.equal(resource.reviewStatus, "manually-reviewed");
    assert.equal(resource.riskLevel, "unsafe");
    assert.equal(Object.hasOwn(resource, "publisherVendorId"), false);
    assert.equal(Object.hasOwn(resource, "sourceProductIds"), false);
    assert.deepEqual(resource.targets.map(({ productId }) => productId), expectedHosts.get(resource.id));
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
  }

  const reversed = structuredClone(candidate.catalog);
  reversed.resources.splice(-4);
  for (const id of ["godot-mcp", "sentry-mcp"]) {
    reversed.resources[reversed.resources.findIndex((resource) => resource.id === id)] =
      structuredClone(base.catalog.resources.find((resource) => resource.id === id));
  }
  assert.deepEqual(reversed, base.catalog);
});

test("Godot publisher and Sentry license facts are corrected without widening execution", () => {
  const candidate = readJson(candidatePath);
  const godot = candidate.catalog.resources.find((resource) => resource.id === "godot-mcp");
  const sentry = candidate.catalog.resources.find((resource) => resource.id === "sentry-mcp");
  assert.equal(godot.publisher, "tomyud1");
  assert.equal(godot.sourceKind, "reviewed-community");
  assert.equal(Object.hasOwn(godot, "publisherVendorId"), false);
  assert.equal(Object.hasOwn(godot, "sourceProductIds"), false);
  assert.equal(godot.metadataSnapshot.originalAuthor, "tomyud1");
  assert.equal(godot.metadataSnapshot.licenseId, "MIT");
  assert.match(godot.versionRef, /0\.5\.0\+f794f7f4/);
  assert.doesNotMatch(sentry.description, /开源/);
  assert.equal(sentry.metadataSnapshot.licenseId, "FSL-1.1-ALv2");
  assert.match(sentry.versionRef, /package-0\.25\.0@03402519/);
  for (const resource of [godot, sentry]) {
    assert.equal(resource.targets.every((target) => target.moduleId === "resource-link"), true);
  }
});

test("current and historical identities fail closed while exact successors remain valid", () => {
  const base = readJson(basePath);
  const candidateRaw = fs.readFileSync(candidatePath, "utf8");
  const candidateSha = sha256(candidateRaw);
  const currentDuplicate = structuredClone(base);
  const replacement = currentDuplicate.catalog.resources.findIndex((resource) => resource.targets.length === 3);
  currentDuplicate.catalog.resources[replacement] = structuredClone(newResources[0]);
  assert.throws(() => buildCandidate(currentDuplicate), /semantic identity already exists/);

  const anchor = { path: candidateRelativePath, raw: candidateRaw };
  const successor = structuredClone(readJson(candidatePath));
  successor.inputs = { baseCatalogV3: { path: candidateRelativePath, sha256: candidateSha } };
  const successorEntry = {
    path: "docs/research/future-ready4-successor-candidate.json",
    raw: `${JSON.stringify(successor)}\n`
  };
  assert.doesNotThrow(() => buildCandidate(base, [anchor, successorEntry]));

  const renamed = structuredClone(successor);
  renamed.catalog.resources.push({
    ...structuredClone(newResources[0]),
    id: "renamed-anomalyarmor-copy",
    name: "Anomaly Armor Duplicate"
  });
  assert.throws(() => buildCandidate(base, [anchor, {
    path: successorEntry.path,
    raw: `${JSON.stringify(renamed)}\n`
  }]), /historical semantic identity already exists/);

  const forged = structuredClone(successor);
  forged.inputs.baseCatalogV3.sha256 = "a".repeat(64);
  assert.throws(() => buildCandidate(base, [anchor, {
    path: successorEntry.path,
    raw: `${JSON.stringify(forged)}\n`
  }]), /historical semantic identity already exists/);
});

test("path-and-SHA-verified transitive successor remains valid", () => {
  const base = readJson(basePath);
  const candidateRaw = fs.readFileSync(candidatePath, "utf8");
  const candidateSha = sha256(candidateRaw);
  const anchor = { path: candidateRelativePath, raw: candidateRaw };
  const direct = structuredClone(readJson(candidatePath));
  direct.inputs = { baseCatalogV3: { path: candidateRelativePath, sha256: candidateSha } };
  const directEntry = {
    path: "docs/research/future-ready4-direct-successor-candidate.json",
    raw: `${JSON.stringify(direct)}\n`
  };
  const transitive = structuredClone(readJson(candidatePath));
  transitive.inputs = { baseCatalogV3: { path: directEntry.path, sha256: sha256(directEntry.raw) } };
  const transitiveEntry = {
    path: "docs/research/future-ready4-transitive-successor-candidate.json",
    raw: `${JSON.stringify(transitive)}\n`
  };

  assert.doesNotThrow(() => buildCandidate(base, [anchor, directEntry, transitiveEntry]));
});

test("externalId alone rejects a semantic duplicate", () => {
  const base = readJson(basePath);
  const collision = structuredClone(newResources[0]);
  Object.assign(collision, {
    id: "external-id-only-collision",
    name: "Independent External Identity Fixture",
    publisher: "Independent Fixture Publisher",
    website: "https://example.com/external-id-only",
    tutorial: "https://example.com/external-id-only/guide",
    versionRef: "external-id-only-fixture",
    provenanceEvidence: ["https://example.com/external-id-only/evidence"]
  });
  Object.assign(collision.metadataSnapshot, {
    sourcePage: collision.tutorial,
    canonicalSource: collision.website,
    originalAuthor: collision.publisher,
    sourceRevision: collision.versionRef
  });
  assert.equal(collision.metadataSnapshot.externalId, newResources[0].metadataSnapshot.externalId);
  const replacement = base.catalog.resources.findIndex((resource) => resource.targets.length === collision.targets.length);
  base.catalog.resources[replacement] = collision;

  assert.throws(() => buildCandidate(base), /semantic identity already exists/);
});

test("frozen inputs, forbidden fields, and generator byte idempotence remain closed", () => {
  const candidate = readJson(candidatePath);
  const forbidden = new Set([
    "args", "command", "credential", "credentialValue", "credentialValues", "credentials",
    "endpoint", "env", "headers", "installArgs", "installCommand", "installPackage",
    "installRuntime", "managedInstall", "package", "runtime", "runtimeConfig", "script",
    "secret", "token", "value"
  ]);
  const hits = [];
  const visit = (value, pointer = "candidate") => {
    if (Array.isArray(value)) return value.forEach((child, index) => visit(child, `${pointer}[${index}]`));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (forbidden.has(key)) hits.push(`${pointer}.${key}`);
      visit(child, `${pointer}.${key}`);
    }
  };
  visit({ resources: candidate.catalog.resources.slice(-4) });
  assert.deepEqual(hits, []);
  assert.doesNotThrow(() => assertFrozenInputHashes({
    baseCatalogV3: "3efc8e7e8f1e417d38982e630247c845da3d9f1876afa3cc5a997b5138929cba",
    first10Research: "b46d323dcecd3e3814da3fa4726bc6c32e5ed4db201aa156c14f8caeeb4c7125",
    sourceSignalsResearch: "8f9d03ccb558a2b36740168e6807eb9c05bf64f50fb8057fc3408b15a243d419"
  }));
  assert.throws(() => assertFrozenInputHashes({}), /frozen input drift/);

  const before = sha256(fs.readFileSync(candidatePath));
  childProcess.execFileSync(process.execPath, [generatorPath], { cwd: root, stdio: "pipe" });
  const afterFirst = sha256(fs.readFileSync(candidatePath));
  childProcess.execFileSync(process.execPath, [generatorPath], { cwd: root, stdio: "pipe" });
  const afterSecond = sha256(fs.readFileSync(candidatePath));
  assert.equal(afterFirst, before);
  assert.equal(afterSecond, before);
});
