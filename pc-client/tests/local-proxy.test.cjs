const assert = require("node:assert/strict");
const test = require("node:test");

const { trustedLocalProxy } = require("../shared/local-proxy.cjs");

test("uses a loopback HTTPS proxy such as Clash", () => {
  assert.equal(
    trustedLocalProxy({
      HTTPS_PROXY: "http://127.0.0.1:7897",
      ALL_PROXY: "http://127.0.0.1:7890"
    }),
    "http://127.0.0.1:7897"
  );
});

test("rejects remote or credentialed proxy environment values", () => {
  assert.equal(
    trustedLocalProxy({ HTTPS_PROXY: "http://proxy.example.com:8080" }),
    ""
  );
  assert.equal(
    trustedLocalProxy({ HTTPS_PROXY: "http://user:secret@127.0.0.1:7897" }),
    ""
  );
});
