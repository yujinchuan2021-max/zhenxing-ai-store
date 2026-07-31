"use strict";

const assert = require("node:assert/strict");
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
  relativeSegments
} = require("../shared/extension-runtime.cjs");

const TEST_PROFILE_ID = "skill.test.codex-directory-snapshot";
const TEST_PROFILE = Object.freeze({
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

function testProfileLookup(profileId) {
  return profileId === TEST_PROFILE_ID ? TEST_PROFILE : null;
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-extension-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resourcesRoot = path.join(root, "resources");
  const userDataRoot = path.join(root, "user-data");
  fs.mkdirSync(resourcesRoot);
  fs.mkdirSync(userDataRoot);
  const profile = TEST_PROFILE;
  const source = path.join(
    resourcesRoot,
    ...profile.sourcePath.split(/[\\/]+/)
  );
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "SKILL.md"), "# Managed fixture\n");
  return {
    profile,
    resourcesRoot,
    source,
    userDataRoot,
    runtime: createExtensionRuntime({
      resourcesRoot,
      userDataRoot,
      profileLookup: testProfileLookup,
      now: () => "2026-07-31T00:00:00.000Z"
    })
  };
}

test("production registry exposes only the reviewed ChatGPT Apps snapshot", () => {
  assert.deepEqual(Object.keys(EXTENSION_INSTALL_REGISTRY), [
    "skill.codex.chatgpt-apps"
  ]);
  assert.deepEqual(publicExtensionInstallProfiles(), [
    {
      id: "skill.codex.chatgpt-apps",
      label: "ChatGPT Apps Skill",
      moduleId: "skill-managed",
      extensionId: "openai-chatgpt-apps-skill",
      hostProductId: "codex-cli",
      capabilities: ["website", "install", "uninstall"],
      adapterId: "directory-snapshot"
    }
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
    targetRoots: { "codex-skills": codexSkillsRoot },
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
  assert.equal(fs.existsSync(path.join(installedSkill, "AIHUB-SOURCE.json")), true);
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
    targetRoots: { "codex-skills": codexSkillsRoot }
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
