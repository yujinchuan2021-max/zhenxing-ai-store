"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  applyManagedCliSettings
} = require("../shared/managed-cli-settings.cjs");

const policy = {
  relativePath: [".qoder", "settings.json"],
  values: { general: { enableAutoUpdate: false } }
};

test("merges the reviewed setting without replacing user configuration", (t) => {
  const homeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-cli-settings-"));
  t.after(() => fs.rmSync(homeDirectory, { recursive: true, force: true }));
  const settingsDirectory = path.join(homeDirectory, ".qoder");
  fs.mkdirSync(settingsDirectory);
  fs.writeFileSync(
    path.join(settingsDirectory, "settings.json"),
    JSON.stringify({ theme: "dark", general: { telemetry: true } })
  );

  const result = applyManagedCliSettings({ homeDirectory, policy });
  assert.equal(result.ok, true);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(result.path, "utf8")),
    {
      theme: "dark",
      general: { telemetry: true, enableAutoUpdate: false }
    }
  );
});

test("refuses traversal and invalid existing JSON", (t) => {
  const homeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-cli-settings-"));
  t.after(() => fs.rmSync(homeDirectory, { recursive: true, force: true }));
  assert.equal(
    applyManagedCliSettings({
      homeDirectory,
      policy: { relativePath: ["..", "settings.json"], values: {} }
    }).ok,
    false
  );
  const directory = path.join(homeDirectory, ".qoder");
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "settings.json"), "not-json");
  const invalid = applyManagedCliSettings({ homeDirectory, policy });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /JSON/);
});

test("merges a reviewed TOML setting while preserving other sections", (t) => {
  const homeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-cli-settings-"));
  t.after(() => fs.rmSync(homeDirectory, { recursive: true, force: true }));
  const directory = path.join(homeDirectory, ".kimi-code");
  fs.mkdirSync(directory);
  fs.writeFileSync(
    path.join(directory, "tui.toml"),
    [
      "# user theme",
      "[tui]",
      'theme = "dark"',
      "",
      "[upgrade]",
      "auto_install = true",
      "notify = true",
      ""
    ].join("\r\n")
  );
  const result = applyManagedCliSettings({
    homeDirectory,
    policy: {
      format: "toml",
      relativePath: [".kimi-code", "tui.toml"],
      values: { upgrade: { auto_install: false } }
    }
  });
  assert.equal(result.ok, true);
  const content = fs.readFileSync(result.path, "utf8");
  assert.match(content, /\[tui\][\s\S]*theme = "dark"/);
  assert.match(content, /\[upgrade\][\s\S]*auto_install = false/);
  assert.match(content, /notify = true/);
  assert.equal(content.includes("\r\n"), true);
});

test("creates a TOML section and refuses ambiguous duplicate ownership", (t) => {
  const homeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-cli-settings-"));
  t.after(() => fs.rmSync(homeDirectory, { recursive: true, force: true }));
  const tomlPolicy = {
    format: "toml",
    relativePath: [".kimi-code", "tui.toml"],
    values: { upgrade: { auto_install: false } }
  };
  const created = applyManagedCliSettings({ homeDirectory, policy: tomlPolicy });
  assert.equal(created.ok, true);
  assert.equal(
    fs.readFileSync(created.path, "utf8"),
    "[upgrade]\nauto_install = false"
  );
  fs.writeFileSync(
    created.path,
    "[upgrade]\nauto_install = true\n[ upgrade ]\nauto_install = false\n"
  );
  const duplicate = applyManagedCliSettings({
    homeDirectory,
    policy: tomlPolicy
  });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /TOML/);
});
