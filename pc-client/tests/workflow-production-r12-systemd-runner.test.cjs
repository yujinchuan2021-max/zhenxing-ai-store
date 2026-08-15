"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const runnerPath = path.join(__dirname, "..", "scripts", "test-workflow-production-r12-systemd.cjs");

test("r12 systemd acceptance runner is a fixed local-only executable contract", () => {
  const source = fs.readFileSync(runnerPath, "utf8");
  assert.match(source, /workflow-production-r12-launcher\.sh/);
  assert.match(source, /workflow-production-r12-prepared-coordinator\.cjs/);
  assert.match(source, /zhenxing-ai-workflow-production-r12\.service/);
  assert.match(source, /workflow-production-r12/);
  assert.match(source, /--cgroupns=private/);
  assert.match(source, /parentSessionHup/);
  assert.match(source, /repeatedLaunchRejected/);
  assert.match(source, /coordinatorCalls/);
  assert.match(source, /secretValueHits/);
  assert.match(source, /containerResidue/);
  assert.doesNotMatch(source, /workflow-production-r11|workflow-production-r10|down --volumes|docker system prune|ssh|scp|sftp/);
});

