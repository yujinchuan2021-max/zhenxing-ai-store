"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  EXTENSION_INSTALL_REGISTRY
} = require("../shared/extension-install-registry.cjs");

const COMMIT = "49f948faa9258a0c61caceaf225e179651397431";
const SNAPSHOT_FILES = Object.freeze({
  "agents/openai.yaml": "c126d350e70b56a26d7b9942bf94b5d99d6972f0b361e1a068b2c04b26242b60",
  "LICENSE.txt": "f40b718f40ec4b8f421f87c4abdea9c32b2c76203c176c947ec4ddaaef5b832c",
  "references/app-archetypes.md": "6004f49292f67fba49d62b0bd149f5279eb6f98d4ad1a0b9d2741dab51e11454",
  "references/apps-sdk-docs-workflow.md": "476ee613f6f9ce507c5a4124db2ba92bd865aee27a9ac733a733e026adb048f0",
  "references/interactive-state-sync-patterns.md": "3eb29a7e4be55b2e567a58b25bd1ee666448dff8a3d91a61aab3e30bedff4657",
  "references/repo-contract-and-validation.md": "604e0be1ae54160d6b7890bd3e0000cc3943560931c72a9451b3dce8df1f98e8",
  "references/search-fetch-standard.md": "2d3d3f4c286aba6abf0501a410889032c934775f5a7042a024ce0e283692b2a6",
  "references/upstream-example-workflow.md": "ed8ec87f75da303df2a97ce290616bdc7e6d2ff02b7d3beb4ff83be3a5585498",
  "references/window-openai-patterns.md": "9313351a77ed8fcfbc7cf31f51ccbadda7ddaa87127a620e58f4125640ea99f3",
  "scripts/scaffold_node_ext_apps.mjs": "3952d9012ddd4b7940b69c024809331ba4e1d39944f89d38f5374e2f15f7acd1",
  "SKILL.md": "928530dd05490d9cd38a8935c824049c5f562422a1bcaa2516ff3032d524ee44"
});

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("bundled ChatGPT Apps Skill matches the pinned official snapshot", () => {
  const root = path.join(
    __dirname,
    "..",
    "extension-resources",
    "codex",
    "chatgpt-apps"
  );
  const source = JSON.parse(
    fs.readFileSync(path.join(root, "AIHUB-SOURCE.json"), "utf8")
  );
  assert.equal(source.repository, "https://github.com/openai/skills");
  assert.equal(source.commit, COMMIT);
  assert.equal(source.licenseFile, "LICENSE.txt");
  for (const [relativePath, expectedHash] of Object.entries(SNAPSHOT_FILES)) {
    const filePath = path.join(root, ...relativePath.split("/"));
    assert.equal(sha256(filePath), expectedHash, relativePath);
    assert.equal(fs.lstatSync(filePath).isSymbolicLink(), false, relativePath);
  }
});

test("managed ChatGPT Apps profile pins the exact bundled source manifest", () => {
  const profile = EXTENSION_INSTALL_REGISTRY["skill.codex.chatgpt-apps"];
  assert.equal(profile.sourceManifest.versionRef, COMMIT);
  assert.deepEqual(profile.sourceManifest.files, SNAPSHOT_FILES);
});
