"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  EXPECTED,
  EXPECTED_STATS,
  SOURCE_CLOSURE_ALLOWLIST,
  buildSourceClosure,
  findUniqueInput,
  localizationEntries,
  localizationStats,
  mergeLocalizedCatalog,
  prepareUnsignedSigningHandoff,
  readFixedInputs,
  stripLocalized
} = require("../scripts/create-catalog-localized-v8-signed-candidate.cjs");

const root = path.resolve(__dirname, "..");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function cloneClosureRoot(t) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-localized-closure-"));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  for (const entry of SOURCE_CLOSURE_ALLOWLIST) {
    const sourcePath = path.join(root, entry.relativePath);
    const targetPath = path.join(target, entry.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
  const stateRelativePath = "admin/published/catalog-store/state.json";
  const stateTarget = path.join(target, stateRelativePath);
  fs.mkdirSync(path.dirname(stateTarget), { recursive: true });
  fs.copyFileSync(path.join(root, stateRelativePath), stateTarget);
  return target;
}

test("fixed inputs merge and prepare a complete unsigned v8 signing handoff without state writes", async () => {
  const statePath = path.join(root, "admin/published/catalog-store/state.json");
  const stateBefore = fs.readFileSync(statePath);
  const handoff = await prepareUnsignedSigningHandoff(root);
  const { catalog, inputs, sourceClosure: closure } = handoff;

  assert.deepEqual(localizationStats(catalog), EXPECTED_STATS);
  assert.deepEqual(stripLocalized(catalog), inputs.active7.catalog);
  assert.deepEqual(
    localizationEntries(handoff.projectedCatalog),
    localizationEntries(catalog)
  );
  assert.equal(handoff.payload.catalogVersion, 8);
  assert.equal(handoff.payload.parentReleaseId, EXPECTED.active7.releaseId);
  assert.equal(
    handoff.payload.notes,
    `0.1.82 localized catalog v8 signing handoff; source-closure-sha256=${closure.sha256}`
  );
  assert.ok(handoff.payload.releaseId.endsWith(`-${closure.sha256.slice(0, 8)}`));
  assert.equal(handoff.sourceClosureSha256, closure.sha256);
  assert.ok(handoff.estimatedSignedEnvelopeBytes <= 2 * 1024 * 1024);
  assert.deepEqual(fs.readFileSync(statePath), stateBefore);
});

test("every tooling or test-contract byte changes the complete closure and unsigned payload identity", async (t) => {
  const fixtureRoot = cloneClosureRoot(t);
  const baseline = await prepareUnsignedSigningHandoff(fixtureRoot);

  for (const entry of SOURCE_CLOSURE_ALLOWLIST.filter(({ kind }) => kind !== "input")) {
    const filePath = path.join(fixtureRoot, entry.relativePath);
    const original = fs.readFileSync(filePath);
    fs.appendFileSync(filePath, `\nclosure-drift-${entry.role}\n`);
    const changed = await prepareUnsignedSigningHandoff(fixtureRoot);
    assert.notEqual(changed.sourceClosure.sha256, baseline.sourceClosure.sha256, entry.role);
    assert.notEqual(changed.payload.releaseId, baseline.payload.releaseId, entry.role);
    assert.notEqual(changed.payload.notes, baseline.payload.notes, entry.role);
    fs.writeFileSync(filePath, original);
  }
});

test("source closure is an exact ordered regular non-reparse allowlist", (t) => {
  const fixtureRoot = cloneClosureRoot(t);
  const closure = buildSourceClosure(fixtureRoot);
  assert.deepEqual(
    closure.manifest.files.map(({ role, relativePath }) => ({ role, relativePath })),
    SOURCE_CLOSURE_ALLOWLIST.map(({ role, relativePath }) => ({ role, relativePath }))
  );
  assert.equal(closure.sha256, sha256(Buffer.from(closure.canonical, "utf8")));

  const missing = SOURCE_CLOSURE_ALLOWLIST.at(-1);
  fs.unlinkSync(path.join(fixtureRoot, missing.relativePath));
  assert.throws(() => buildSourceClosure(fixtureRoot), /closure file|missing/i);
  fs.copyFileSync(path.join(root, missing.relativePath), path.join(fixtureRoot, missing.relativePath));

  const duplicateInput = path.join(fixtureRoot, "docs/research/duplicate-a.json");
  fs.copyFileSync(
    path.join(fixtureRoot, EXPECTED.contentA.relativePath),
    duplicateInput
  );
  assert.throws(() => buildSourceClosure(fixtureRoot), /exactly one/i);
  fs.unlinkSync(duplicateInput);

  const linked = SOURCE_CLOSURE_ALLOWLIST.find(({ role }) => role === "catalog-localization-contract");
  const linkedPath = path.join(fixtureRoot, linked.relativePath);
  const sibling = `${linkedPath}.hardlink`;
  fs.linkSync(linkedPath, sibling);
  assert.throws(() => buildSourceClosure(fixtureRoot), /regular|link|reparse/i);
  fs.unlinkSync(sibling);

  const testsDirectory = path.join(fixtureRoot, "tests");
  const realTestsDirectory = path.join(fixtureRoot, "tests-real");
  fs.renameSync(testsDirectory, realTestsDirectory);
  fs.symlinkSync(realTestsDirectory, testsDirectory, "junction");
  assert.throws(() => buildSourceClosure(fixtureRoot), /regular|link|reparse/i);
});

test("input discovery and merge fail closed for hash, overlap, missing localization, and primary drift", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-localized-input-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("fixed candidate\n", "utf8");
  const digest = sha256(bytes);
  assert.throws(() => findUniqueInput(directory, digest), /exactly one/i);
  fs.writeFileSync(path.join(directory, "candidate.json"), bytes);
  assert.equal(path.basename(findUniqueInput(directory, digest)), "candidate.json");
  fs.copyFileSync(path.join(directory, "candidate.json"), path.join(directory, "duplicate.json"));
  assert.throws(() => findUniqueInput(directory, digest), /exactly one/i);

  const inputs = await readFixedInputs(root);
  const overlap = structuredClone(inputs);
  overlap.contentA.value.catalog.resourceStores[0].localized =
    overlap.contentB.value.resourceStores[0].localized;
  assert.throws(() => mergeLocalizedCatalog(overlap), /scope|overlap/i);
  const missing = structuredClone(inputs);
  delete missing.contentA.value.catalog.vendors[0].localized;
  assert.throws(() => mergeLocalizedCatalog(missing), /localized|count/i);
  const drift = structuredClone(inputs);
  drift.contentA.value.catalog.vendors[0].website = "https://example.com/drift";
  assert.throws(() => mergeLocalizedCatalog(drift), /primary|drift/i);
});

test("unsigned handoff is fixed to v8/v2 and the closure tooling never reads or creates private keys", async () => {
  const handoff = await prepareUnsignedSigningHandoff(root);
  assert.equal(handoff.payload.catalogVersion, 8);
  assert.equal(handoff.payload.parentReleaseId, EXPECTED.active7.releaseId);
  const source = fs.readFileSync(
    path.join(root, "scripts/create-catalog-localized-v8-signed-candidate.cjs"),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /catalog-signing-private\.pem|loadSigningKey|createPrivateKey|generateKeyPair|createSignedEnvelope/
  );
});
