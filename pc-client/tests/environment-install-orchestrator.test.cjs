"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createEnvironmentInstallOrchestrator
} = require("../shared/environment-install-orchestrator.cjs");

test("deduplicates dependencies and advances one environment at a time", () => {
  const flow = createEnvironmentInstallOrchestrator();
  flow.enqueue("workbench", ["wsl", "docker", "git"]);
  flow.enqueue("another-product", ["git"]);
  assert.equal(flow.next([]), "wsl");
  flow.complete("wsl");
  assert.equal(flow.next(["wsl"]), "docker");
  flow.complete("docker");
  assert.equal(flow.next(["wsl", "docker"]), "git");
  flow.complete("git");
  assert.deepEqual(
    flow.readyProducts(["wsl", "docker", "git"]),
    ["workbench", "another-product"]
  );
  assert.equal(flow.next(["wsl", "docker", "git"]), "");
});

test("drops already installed requirements before launching another installer", () => {
  const flow = createEnvironmentInstallOrchestrator();
  flow.enqueue("product", ["node", "git"]);
  assert.equal(flow.next(["node"]), "git");
});

test("a failed environment clears every dependent product safely", () => {
  const flow = createEnvironmentInstallOrchestrator();
  flow.enqueue("one", ["wsl"]);
  flow.enqueue("two", ["docker"]);
  assert.equal(flow.next([]), "wsl");
  assert.deepEqual(flow.fail("wsl"), ["one", "two"]);
  assert.equal(flow.next([]), "");
});
