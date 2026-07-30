"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  resolveReleaseResponseUrl
} = require("../shared/release-response.cjs");

test("uses the verified response URL when the network stack provides one", () => {
  assert.equal(
    resolveReleaseResponseUrl(
      {
        url: "https://catalog.example/final.json",
        redirected: true
      },
      "https://catalog.example/current.json"
    ).href,
    "https://catalog.example/final.json"
  );
});

test("uses the request URL only for a response that did not redirect", () => {
  assert.equal(
    resolveReleaseResponseUrl(
      { url: "", redirected: false },
      "https://localhost:4443/catalog-release.json"
    ).href,
    "https://localhost:4443/catalog-release.json"
  );
  assert.throws(
    () =>
      resolveReleaseResponseUrl(
        { url: "", redirected: true },
        "https://localhost:4443/catalog-release.json"
      ),
    /重定向/
  );
});
