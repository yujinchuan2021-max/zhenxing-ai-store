import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("root lint ignores generated dist folders at every workspace depth", () => {
  const config = readFileSync(new URL("../eslint.config.mjs", import.meta.url), "utf8");
  assert.match(config, /["']\*\*\/dist\/\*\*["']/);
  assert.match(config, /["']pc-client\/\*\*["']/);
});
