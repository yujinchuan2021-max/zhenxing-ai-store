"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  resolveCodexSkillsRoot,
  resolveLegacyCodexSkillsRoot
} = require("../shared/extension-host-targets.cjs");

test("Codex skills root uses the shared user .agents directory", () => {
  const home = path.resolve("C:\\temp", "isolated-user-home");
  assert.equal(
    resolveCodexSkillsRoot({
      env: { CODEX_HOME: "relative/legacy-value-is-ignored" },
      homedir: () => home
    }),
    path.join(home, ".agents", "skills")
  );
});

test("legacy Codex skills root still resolves CODEX_HOME for migration checks", () => {
  const codexHome = path.resolve("C:\\temp", "isolated-codex-home");
  assert.equal(
    resolveLegacyCodexSkillsRoot({
      env: { CODEX_HOME: codexHome },
      homedir: () => {
        throw new Error("homedir should not be read");
      }
    }),
    path.join(codexHome, "skills")
  );
});

test("legacy Codex skills root falls back to the user .codex directory", () => {
  const home = path.resolve("C:\\temp", "isolated-user-home");
  assert.equal(
    resolveLegacyCodexSkillsRoot({ env: {}, homedir: () => home }),
    path.join(home, ".codex", "skills")
  );
});

test("relative legacy CODEX_HOME is rejected", () => {
  assert.throws(
    () =>
      resolveLegacyCodexSkillsRoot({
        env: { CODEX_HOME: "relative/codex" },
        homedir: () => "unused"
      }),
    (error) => error.code === "EXTENSION_CODEX_HOME_INVALID"
  );
});

test("relative user home is rejected by the shared Codex root", () => {
  assert.throws(
    () => resolveCodexSkillsRoot({ homedir: () => "relative/home" }),
    (error) => error.code === "EXTENSION_USER_HOME_INVALID"
  );
});
