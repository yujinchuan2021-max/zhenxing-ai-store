"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  EXTENSION_INSTALL_REGISTRY,
  publicExtensionInstallProfiles
} = require("../shared/extension-install-registry.cjs");
const {
  assertDirectorySnapshotProfile,
  createExtensionRuntime,
  relativeSegments,
  scanDirectory
} = require("../shared/extension-runtime.cjs");

const TEST_PROFILE_ID = "skill.test.codex-directory-snapshot";
const TEST_PROFILE_BASE = Object.freeze({
  label: "Directory snapshot test fixture",
  moduleId: "skill-managed",
  extensionId: "test-codex-directory-snapshot",
  hostProductId: "codex-cli",
  capabilities: Object.freeze(["website", "install", "uninstall"]),
  adapterId: "directory-snapshot",
  sourcePath: "codex/test-directory-snapshot",
  targetRootId: "user-data",
  targetRelativePath: "host-targets/codex/skills/test-directory-snapshot"
});

function fileHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function productionProfileLookup(profileId) {
  const profile = EXTENSION_INSTALL_REGISTRY[profileId];
  if (!profile || profile.sourceManifest) return profile || null;
  const source = path.join(
    __dirname,
    "..",
    "extension-resources",
    ...profile.sourcePath.split("/")
  );
  return Object.freeze({
    ...profile,
    sourceManifest: Object.freeze({
      versionRef: "test-production-snapshot",
      files: scanDirectory(source).files
    })
  });
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-extension-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resourcesRoot = path.join(root, "resources");
  const userDataRoot = path.join(root, "user-data");
  fs.mkdirSync(resourcesRoot);
  fs.mkdirSync(userDataRoot);
  let profile = null;
  const source = path.join(
    resourcesRoot,
    ...TEST_PROFILE_BASE.sourcePath.split(/[\\/]+/)
  );
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "SKILL.md"), "# Managed fixture\n");
  function setProfile(versionRef = "fixture-v1") {
    profile = Object.freeze({
      ...TEST_PROFILE_BASE,
      sourceManifest: Object.freeze({
        versionRef,
        files: Object.freeze({
          "SKILL.md": fileHash(path.join(source, "SKILL.md"))
        })
      })
    });
    return profile;
  }
  setProfile();
  const runtime = createExtensionRuntime({
    resourcesRoot,
    userDataRoot,
    profileLookup: (profileId) => profileId === TEST_PROFILE_ID ? profile : null,
    now: () => "2026-07-31T00:00:00.000Z"
  });
  return {
    get profile() {
      return profile;
    },
    resourcesRoot,
    source,
    userDataRoot,
    runtime,
    setProfile
  };
}

test("production registry exposes only locally reviewed resource profiles", () => {
  assert.deepEqual(Object.keys(EXTENSION_INSTALL_REGISTRY), [
    "skill.codex.chatgpt-apps",
    "mcp.codex.openai-developer-docs",
    "mcp.claude-code.openai-developer-docs",
    "mcp.cursor.openai-developer-docs",
    "mcp.codex.zep-docs",
    "mcp.claude-code.zep-docs",
    "mcp.cursor.zep-docs",
    "plugin.claude.commit-commands"
  ]);
  assert.deepEqual(
    publicExtensionInstallProfiles().map((profile) => profile.id),
    Object.keys(EXTENSION_INSTALL_REGISTRY)
  );
  assert.deepEqual(publicExtensionInstallProfiles()[0].capabilities, [
    "website",
    "install",
    "update",
    "repair",
    "uninstall"
  ]);
});

test("Codex target root is created only by install and preserved by uninstall", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-codex-skill-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const userDataRoot = path.join(root, "user-data");
  const codexSkillsRoot = path.join(root, "codex-home", "skills");
  fs.mkdirSync(userDataRoot);
  const runtime = createExtensionRuntime({
    resourcesRoot: path.join(__dirname, "..", "extension-resources"),
    userDataRoot,
    targetRoots: { "agent-skills": codexSkillsRoot },
    profileLookup: productionProfileLookup,
    now: () => "2026-07-31T00:00:00.000Z"
  });

  assert.equal(fs.existsSync(codexSkillsRoot), false);
  assert.equal(fs.existsSync(path.join(userDataRoot, "extension-receipts")), false);
  assert.equal(runtime.getStatus("skill.codex.chatgpt-apps").state, "not-installed");
  assert.equal(fs.existsSync(codexSkillsRoot), false);
  assert.equal(fs.existsSync(path.join(userDataRoot, "extension-receipts")), false);

  runtime.install("skill.codex.chatgpt-apps");
  const installedSkill = path.join(codexSkillsRoot, "chatgpt-apps");
  assert.equal(fs.existsSync(path.join(installedSkill, "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(installedSkill, "LICENSE.txt")), true);
  assert.equal(fs.existsSync(path.join(installedSkill, "AIHUB-SOURCE.json")), false);
  assert.deepEqual(runtime.getReceipt("skill.codex.chatgpt-apps").ownedPaths, [
    installedSkill
  ]);

  runtime.uninstall("skill.codex.chatgpt-apps");
  assert.equal(fs.existsSync(installedSkill), false);
  assert.equal(fs.existsSync(codexSkillsRoot), true);
});

test("uninstall refuses a Codex target root replaced by a junction", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-codex-link-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const userDataRoot = path.join(root, "user-data");
  const codexSkillsRoot = path.join(root, "codex-home", "skills");
  fs.mkdirSync(userDataRoot);
  const runtime = createExtensionRuntime({
    resourcesRoot: path.join(__dirname, "..", "extension-resources"),
    userDataRoot,
    targetRoots: { "agent-skills": codexSkillsRoot },
    profileLookup: productionProfileLookup
  });
  runtime.install("skill.codex.chatgpt-apps");
  const relocatedRoot = path.join(root, "relocated-skills");
  fs.renameSync(codexSkillsRoot, relocatedRoot);
  try {
    fs.symlinkSync(
      relocatedRoot,
      codexSkillsRoot,
      process.platform === "win32" ? "junction" : "dir"
    );
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("Windows junction creation is not available");
      return;
    }
    throw error;
  }

  assert.equal(runtime.getStatus("skill.codex.chatgpt-apps").state, "unsafe");
  assert.throws(
    () => runtime.uninstall("skill.codex.chatgpt-apps"),
    (error) => error.code === "EXTENSION_SYMLINK_REJECTED"
  );
  assert.equal(
    fs.existsSync(path.join(relocatedRoot, "chatgpt-apps", "SKILL.md")),
    true
  );
});

test("installs a bundled directory without touching the real Codex home", (t) => {
  const { runtime, userDataRoot } = fixture(t);
  assert.equal(
    runtime.getStatus(TEST_PROFILE_ID).state,
    "not-installed"
  );

  const installed = runtime.install(TEST_PROFILE_ID);
  const target = path.join(
    userDataRoot,
    "host-targets",
    "codex",
    "skills",
    "test-directory-snapshot"
  );
  assert.equal(installed.state, "installed");
  assert.equal(fs.readFileSync(path.join(target, "SKILL.md"), "utf8"), "# Managed fixture\n");
  assert.equal(
    runtime.getStatus(TEST_PROFILE_ID).state,
    "installed"
  );
  const receipt = runtime.getReceipt(TEST_PROFILE_ID);
  assert.equal(receipt.profileId, TEST_PROFILE_ID);
  assert.ok(receipt.ownedPaths.includes(target));
  assert.ok(receipt.ownedPaths.every((ownedPath) => ownedPath.startsWith(userDataRoot)));

  assert.deepEqual(runtime.uninstall(TEST_PROFILE_ID), {
    state: "uninstalled"
  });
  assert.equal(fs.existsSync(target), false);
  assert.equal(runtime.getReceipt(TEST_PROFILE_ID), null);
});

test("never overwrites an existing host target", (t) => {
  const { profile, runtime, userDataRoot } = fixture(t);
  const target = path.join(
    userDataRoot,
    ...profile.targetRelativePath.split(/[\\/]+/)
  );
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "owner.txt"), "manual");

  assert.equal(
    runtime.getStatus(TEST_PROFILE_ID).state,
    "external"
  );
  assert.throws(
    () => runtime.install(TEST_PROFILE_ID),
    (error) => error.code === "EXTENSION_TARGET_EXISTS"
  );
  assert.equal(fs.readFileSync(path.join(target, "owner.txt"), "utf8"), "manual");
});

test("rejects absolute, traversal and unapproved adapter profiles", () => {
  for (const unsafe of ["../escape", "child/../escape", "C:\\escape", "/escape"] ) {
    assert.throws(
      () => relativeSegments(unsafe, "fixture"),
      (error) => error.code === "EXTENSION_PATH_INVALID"
    );
  }
  assert.throws(
    () =>
      assertDirectorySnapshotProfile({
        adapterId: "shell",
        extensionId: "unsafe",
        hostProductId: "codex-cli",
        targetRootId: "user-data",
        sourcePath: "safe/source",
        targetRelativePath: "safe/target"
      }),
    (error) => error.code === "EXTENSION_PROFILE_INVALID"
  );
});

test("rejects symbolic links in the bundled snapshot", (t) => {
  const { runtime, source } = fixture(t);
  const external = path.join(path.dirname(source), "outside");
  fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, "outside.txt"), "outside");
  const link = path.join(source, "linked-directory");
  try {
    fs.symlinkSync(external, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("Windows symbolic-link creation is not available");
      return;
    }
    throw error;
  }
  assert.throws(
    () => runtime.install(TEST_PROFILE_ID),
    (error) => error.code === "EXTENSION_SYMLINK_REJECTED"
  );
});

test("a tampered receipt cannot expand the uninstall boundary", (t) => {
  const { runtime, userDataRoot } = fixture(t);
  runtime.install(TEST_PROFILE_ID);
  const protectedDirectory = path.join(userDataRoot, "protected");
  fs.mkdirSync(protectedDirectory);
  fs.writeFileSync(path.join(protectedDirectory, "keep.txt"), "keep");
  const receiptFile = path.join(
    userDataRoot,
    "extension-receipts",
    `${TEST_PROFILE_ID}.json`
  );
  const receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
  receipt.ownedPaths.push(protectedDirectory);
  fs.writeFileSync(receiptFile, JSON.stringify(receipt));

  assert.equal(
    runtime.getStatus(TEST_PROFILE_ID).state,
    "invalid-receipt"
  );
  assert.throws(
    () => runtime.uninstall(TEST_PROFILE_ID),
    (error) => error.code === "EXTENSION_RECEIPT_INVALID"
  );
  assert.equal(
    fs.readFileSync(path.join(protectedDirectory, "keep.txt"), "utf8"),
    "keep"
  );
});

test("unknown profile ids can never select an adapter", (t) => {
  const { runtime } = fixture(t);
  assert.throws(
    () => runtime.install("skill.backend-supplied"),
    (error) => error.code === "EXTENSION_PROFILE_NOT_APPROVED"
  );
});

test("receipt v3 pins source, target hashes, and a per-install ownership marker", (t) => {
  const { runtime } = fixture(t);
  const first = runtime.install(TEST_PROFILE_ID);
  const second = runtime.install(TEST_PROFILE_ID);
  const receipt = runtime.getReceipt(TEST_PROFILE_ID);

  assert.equal(first.receipt.schemaVersion, 3);
  assert.match(first.receipt.managementId, /^[a-f0-9]{48}$/);
  assert.equal(receipt.versionRef, "fixture-v1");
  assert.deepEqual(receipt.sourceManifest, {
    versionRef: "fixture-v1",
    files: receipt.targetManifest.files
  });
  assert.deepEqual(second.receipt, first.receipt);
  assert.equal(runtime.inspect(TEST_PROFILE_ID).state, "installed");
});

test("does not revive a receipt after the skill is manually removed and reinstalled", (t) => {
  const { runtime, profile, source, userDataRoot } = fixture(t);
  runtime.install(TEST_PROFILE_ID);
  const target = path.join(userDataRoot, ...profile.targetRelativePath.split("/"));
  fs.rmSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });

  assert.deepEqual(runtime.getStatus(TEST_PROFILE_ID), {
    state: "modified",
    managed: false,
    targetPath: target,
    versionRef: "fixture-v1"
  });
  assert.throws(
    () => runtime.uninstall(TEST_PROFILE_ID),
    (error) => error.code === "EXTENSION_TARGET_MODIFIED"
  );
  assert.equal(fs.existsSync(path.join(target, "SKILL.md")), true);
});

test("install rejects a bundled snapshot that differs from the approved manifest", (t) => {
  const { runtime, source, profile, userDataRoot } = fixture(t);
  fs.writeFileSync(path.join(source, "unexpected.txt"), "not approved");

  assert.throws(
    () => runtime.install(TEST_PROFILE_ID),
    (error) => error.code === "EXTENSION_SOURCE_MANIFEST_MISMATCH"
  );
  assert.equal(
    fs.existsSync(path.join(userDataRoot, ...profile.targetRelativePath.split("/"))),
    false
  );
});

test("approved version changes become outdated and update atomically replaces an unchanged target", (t) => {
  const fixtureState = fixture(t);
  const { runtime, source, userDataRoot } = fixtureState;
  runtime.install(TEST_PROFILE_ID);
  fs.writeFileSync(path.join(source, "SKILL.md"), "# Managed fixture v2\n");
  fixtureState.setProfile("fixture-v2");

  assert.equal(runtime.getStatus(TEST_PROFILE_ID).state, "outdated");
  const result = runtime.execute(TEST_PROFILE_ID, "update");
  const target = path.join(
    userDataRoot,
    ...fixtureState.profile.targetRelativePath.split("/")
  );
  assert.equal(result.state, "installed");
  assert.equal(fs.readFileSync(path.join(target, "SKILL.md"), "utf8"), "# Managed fixture v2\n");
  assert.equal(runtime.getStatus(TEST_PROFILE_ID).state, "installed");
  assert.equal(runtime.getReceipt(TEST_PROFILE_ID).versionRef, "fixture-v2");
  assert.deepEqual(
    fs.readdirSync(path.dirname(target)).filter((name) => name.includes(".aihub-")),
    []
  );
});

test("repair restores a missing managed target but never overwrites a modified target", (t) => {
  const { runtime, profile, userDataRoot } = fixture(t);
  runtime.install(TEST_PROFILE_ID);
  const target = path.join(userDataRoot, ...profile.targetRelativePath.split("/"));
  fs.rmSync(target, { recursive: true });

  assert.equal(runtime.getStatus(TEST_PROFILE_ID).state, "stale");
  assert.equal(runtime.repair(TEST_PROFILE_ID).state, "installed");
  fs.writeFileSync(path.join(target, "SKILL.md"), "user edit\n");
  assert.equal(runtime.getStatus(TEST_PROFILE_ID).state, "modified");
  for (const operation of ["install", "update", "repair", "uninstall"]) {
    assert.throws(
      () => runtime.execute(TEST_PROFILE_ID, operation),
      (error) => error.code === "EXTENSION_TARGET_MODIFIED",
      operation
    );
  }
  assert.equal(fs.readFileSync(path.join(target, "SKILL.md"), "utf8"), "user edit\n");
  assert.ok(runtime.getReceipt(TEST_PROFILE_ID));
});

test("uninstall refuses added files and empty directories without deleting user data", (t) => {
  const { runtime, profile, userDataRoot } = fixture(t);
  runtime.install(TEST_PROFILE_ID);
  const target = path.join(userDataRoot, ...profile.targetRelativePath.split("/"));
  fs.writeFileSync(path.join(target, "user-note.txt"), "keep");
  fs.mkdirSync(path.join(target, "user-empty"));

  assert.equal(runtime.getStatus(TEST_PROFILE_ID).state, "modified");
  assert.throws(
    () => runtime.uninstall(TEST_PROFILE_ID),
    (error) => error.code === "EXTENSION_TARGET_MODIFIED"
  );
  assert.equal(fs.readFileSync(path.join(target, "user-note.txt"), "utf8"), "keep");
  assert.equal(fs.existsSync(path.join(target, "user-empty")), true);
});

test("uninstall clears a stale receipt without touching the shared target root", (t) => {
  const { runtime, profile, userDataRoot } = fixture(t);
  runtime.install(TEST_PROFILE_ID);
  const target = path.join(userDataRoot, ...profile.targetRelativePath.split("/"));
  const sharedRoot = path.dirname(target);
  fs.rmSync(target, { recursive: true });
  fs.writeFileSync(path.join(sharedRoot, "keep.txt"), "shared");

  assert.deepEqual(runtime.uninstall(TEST_PROFILE_ID), { state: "uninstalled" });
  assert.equal(fs.readFileSync(path.join(sharedRoot, "keep.txt"), "utf8"), "shared");
  assert.equal(runtime.getReceipt(TEST_PROFILE_ID), null);
});

test("invalid receipt manifests never authorize target deletion", (t) => {
  const { runtime, profile, userDataRoot } = fixture(t);
  runtime.install(TEST_PROFILE_ID);
  const target = path.join(userDataRoot, ...profile.targetRelativePath.split("/"));
  const receiptFile = path.join(
    userDataRoot,
    "extension-receipts",
    `${TEST_PROFILE_ID}.json`
  );
  const receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
  receipt.targetManifest.files["SKILL.md"] = "0".repeat(64);
  fs.writeFileSync(receiptFile, JSON.stringify(receipt));

  assert.equal(runtime.getStatus(TEST_PROFILE_ID).state, "invalid-receipt");
  assert.throws(
    () => runtime.uninstall(TEST_PROFILE_ID),
    (error) => error.code === "EXTENSION_RECEIPT_INVALID"
  );
  assert.equal(fs.existsSync(path.join(target, "SKILL.md")), true);
});

test("legacy receipts never authorize migration or deletion without an ownership marker", (t) => {
  const { runtime, profile, userDataRoot } = fixture(t);
  runtime.install(TEST_PROFILE_ID);
  const target = path.join(userDataRoot, ...profile.targetRelativePath.split("/"));
  const receiptFile = path.join(
    userDataRoot,
    "extension-receipts",
    `${TEST_PROFILE_ID}.json`
  );
  const v3 = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
  const v1 = {
    schemaVersion: 1,
    profileId: v3.profileId,
    adapterId: v3.adapterId,
    extensionId: v3.extensionId,
    hostProductId: v3.hostProductId,
    installedAt: v3.installedAt,
    ownedPaths: v3.ownedPaths
  };
  fs.writeFileSync(receiptFile, JSON.stringify(v1));

  assert.equal(runtime.getStatus(TEST_PROFILE_ID).state, "modified");
  assert.throws(
    () => runtime.uninstall(TEST_PROFILE_ID),
    (error) => error.code === "EXTENSION_TARGET_MODIFIED"
  );
  assert.equal(
    fs.readFileSync(path.join(target, "SKILL.md"), "utf8"),
    "# Managed fixture\n"
  );
});
