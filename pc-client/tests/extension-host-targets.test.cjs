"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  resolveCodexSkillsRoot
} = require("../shared/extension-host-targets.cjs");

test("Codex skills root uses an absolute CODEX_HOME without touching disk", () => {
  const codexHome = path.resolve("C:\\temp", "isolated-codex-home");
  assert.equal(
    resolveCodexSkillsRoot({
      env: { CODEX_HOME: codexHome },
      homedir: () => {
        throw new Error("homedir should not be read");
      }
    }),
    path.join(codexHome, "skills")
  );
});

test("Codex skills root falls back to the user .codex directory", () => {
  const home = path.resolve("C:\\temp", "isolated-user-home");
  assert.equal(
    resolveCodexSkillsRoot({ env: {}, homedir: () => home }),
    path.join(home, ".codex", "skills")
  );
});

test("relative CODEX_HOME is rejected", () => {
  assert.throws(
    () =>
      resolveCodexSkillsRoot({
        env: { CODEX_HOME: "relative/codex" },
        homedir: () => "unused"
      }),
    (error) => error.code === "EXTENSION_CODEX_HOME_INVALID"
  );
});
