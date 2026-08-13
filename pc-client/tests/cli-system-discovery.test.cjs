const assert = require("node:assert/strict");
const test = require("node:test");

const {
  inferNpmPrefixFromCommandPath
} = require("../shared/cli-system-discovery.cjs");

test("discovers an allowlisted npm CLI prefix from its Windows command shim", () => {
  assert.equal(
    inferNpmPrefixFromCommandPath("D:\\AI Hub\\openclaw.cmd", "openclaw"),
    "D:\\AI Hub"
  );
});

test("rejects roots, UNC paths and lookalike command shims", () => {
  assert.equal(inferNpmPrefixFromCommandPath("C:\\openclaw.cmd", "openclaw"), "");
  assert.equal(
    inferNpmPrefixFromCommandPath("\\\\server\\tools\\openclaw.cmd", "openclaw"),
    ""
  );
  assert.equal(
    inferNpmPrefixFromCommandPath("D:\\Tools\\openclaw-helper.cmd", "openclaw"),
    ""
  );
});
