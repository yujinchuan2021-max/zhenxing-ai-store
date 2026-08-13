"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  DEFAULT_CONCURRENCY,
  createManagedDownloadQueue
} = require("../shared/managed-download-queue.cjs");

async function serverFixture(t) {
  const held = new Map();
  const hits = new Map();
  const server = http.createServer((request, response) => {
    const id = request.url.slice(1);
    hits.set(id, (hits.get(id) || 0) + 1);
    if (id === "fail-once" && hits.get(id) === 1) {
      response.writeHead(500).end("failed");
      return;
    }
    response.writeHead(200, { "content-length": "4" });
    held.set(id, response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    for (const response of held.values()) response.destroy();
    server.closeAllConnections?.();
    return new Promise((resolve) => server.close(resolve));
  });
  const { port } = server.address();
  return {
    hits,
    url: (id) => `http://127.0.0.1:${port}/${id}`,
    async waitFor(id) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (held.has(id)) return;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      throw new Error(`fixture ${id} did not start`);
    },
    release(id, body = "data") {
      const response = held.get(id);
      assert.ok(response, `fixture ${id} was not started`);
      held.delete(id);
      response.end(body);
    }
  };
}

async function fetchFixture({ id, url, signal, root, expectedSha256 }) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const partial = path.join(root, `${id}.part`);
  const target = path.join(root, `${id}.bin`);
  try {
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(partial, buffer);
    const digest = require("node:crypto").createHash("sha256").update(buffer).digest("hex");
    if (expectedSha256 && digest !== expectedSha256) throw new Error("INTEGRITY_INVALID");
    fs.renameSync(partial, target);
    return { phase: "downloaded" };
  } finally {
    fs.rmSync(partial, { force: true });
  }
}

async function waitForIdle(queue) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (queue.list().every((job) => !["queued", "downloading"].includes(job.phase))) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("queue did not settle");
}

test("defaults to three complete-resource downloads and constrains client configuration", () => {
  assert.equal(DEFAULT_CONCURRENCY, 3);
  assert.throws(() => createManagedDownloadQueue({ concurrency: 0, start: async () => {} }));
  assert.throws(() => createManagedDownloadQueue({ concurrency: 5, start: async () => {} }));
  const queue = createManagedDownloadQueue({ start: async () => {} });
  assert.deepEqual(Object.keys(queue).sort(), ["cancel", "dispose", "enqueue", "list", "status"]);
});

test("held starts deterministically keep three active while a fourth is queued and independently cancellable", async (t) => {
  const started = [];
  const releases = new Map();
  const queue = createManagedDownloadQueue({
    concurrency: 3,
    start: ({ id, signal }) => new Promise((resolve, reject) => {
      started.push(id);
      releases.set(id, resolve);
      signal.addEventListener("abort", () => reject(Object.assign(new Error("cancelled"), { code: "ABORT_ERR" })), { once: true });
    })
  });
  t.after(() => queue.dispose());

  for (const id of ["one", "two", "three", "four"]) assert.equal(queue.enqueue({ id }).accepted, true);
  assert.deepEqual(started, ["one", "two", "three"]);
  assert.equal(queue.list().filter((job) => job.phase === "downloading").length, 3);
  assert.equal(queue.status("four").phase, "queued");

  assert.equal(queue.cancel("four").accepted, true);
  assert.equal(queue.status("four").phase, "cancelled");
  assert.ok(["one", "two", "three"].every((id) => queue.status(id).phase === "downloading"));
  assert.equal(queue.enqueue({ id: "four" }).accepted, true);
  assert.equal(queue.status("four").phase, "queued");

  for (const resolve of releases.values()) resolve({ phase: "downloaded" });
  await Promise.resolve();
});

test("local fixture runs three downloads, queues the fourth, deduplicates, and cancels only its target", async (t) => {
  const fixture = await serverFixture(t);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-queue-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let queue;
  queue = createManagedDownloadQueue({
    concurrency: 3,
    start: (job) => {
      assert.equal(job.controller.signal, job.signal);
      return fetchFixture({ ...job, root });
    }
  });

  for (const id of ["one", "two", "three", "four"]) {
    assert.equal(queue.enqueue({ id, url: fixture.url(id) }).accepted, true);
  }
  const duplicate = queue.enqueue({ id: "four", url: fixture.url("four") });
  assert.equal(duplicate.accepted, true);
  assert.equal(duplicate.reused, true);
  await Promise.all(["one", "two", "three"].map((id) => fixture.waitFor(id)));
  const beforeCancel = queue.list();
  assert.equal(beforeCancel.filter((job) => job.phase === "downloading").length, 3);
  assert.equal(beforeCancel.find((job) => job.id === "four").phase, "queued");

  assert.equal(queue.cancel("two").accepted, true);
  await fixture.waitFor("four");
  assert.equal(queue.status("two").phase, "cancelled");
  assert.equal(queue.status("four").phase, "downloading");
  assert.equal(queue.status("one").phase, "downloading");
  assert.equal(queue.status("three").phase, "downloading");

  fixture.release("one");
  fixture.release("three");
  fixture.release("four");
  await waitForIdle(queue);
  assert.equal(queue.status("three").phase, "downloaded");
  assert.equal(queue.status("four").phase, "downloaded");
});

test("local fixture retries a failed resource and leaves no formal file after validation failure", async (t) => {
  const fixture = await serverFixture(t);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-queue-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let queue;
  queue = createManagedDownloadQueue({
    concurrency: 3,
    start: (job) => fetchFixture({ ...job, root, expectedSha256: job.expectedSha256 })
  });
  queue.enqueue({ id: "fail-once", url: fixture.url("fail-once") });
  await waitForIdle(queue);
  assert.equal(queue.status("fail-once").phase, "failed");
  assert.equal(queue.enqueue({ id: "fail-once", url: fixture.url("fail-once") }).accepted, true);
  await fixture.waitFor("fail-once");
  fixture.release("fail-once");
  await waitForIdle(queue);
  assert.equal(queue.status("fail-once").phase, "downloaded");
  assert.equal(fixture.hits.get("fail-once"), 2);

  queue.enqueue({
    id: "invalid",
    url: fixture.url("invalid"),
    expectedSha256: "0".repeat(64)
  });
  await fixture.waitFor("invalid");
  fixture.release("invalid");
  await waitForIdle(queue);
  assert.equal(queue.status("invalid").phase, "failed");
  assert.equal(fs.existsSync(path.join(root, "invalid.bin")), false);
  assert.equal(fs.existsSync(path.join(root, "invalid.part")), false);
});

test("queue disposal aborts active work, drops queued work, and leaves no temporary parts", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-download-queue-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const queue = createManagedDownloadQueue({
    concurrency: 3,
    start: async ({ id, signal }) => {
      const partial = path.join(root, `${id}.part`);
      fs.writeFileSync(partial, "partial");
      try {
        await new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("cancelled"), { code: "ABORTED" })), { once: true }));
      } finally {
        fs.rmSync(partial, { force: true });
      }
    }
  });
  for (const id of ["one", "two", "three", "four"]) queue.enqueue({ id });
  await new Promise((resolve) => setImmediate(resolve));
  queue.dispose();
  await waitForIdle(queue);
  assert.deepEqual(queue.list().map((job) => job.phase), ["cancelled", "cancelled", "cancelled", "cancelled"]);
  assert.deepEqual(fs.readdirSync(root), []);
});

test("an active cancel wins a late completion without affecting queued or independent tasks", async () => {
  const releases = new Map();
  const started = new Map();
  const attempts = new Map();
  const queue = createManagedDownloadQueue({
    concurrency: 2,
    start: ({ id }) => {
      attempts.set(id, (attempts.get(id) || 0) + 1);
      if (attempts.get(id) > 1) return Promise.resolve({ phase: "downloaded" });
      return new Promise((resolve) => {
        releases.set(id, resolve);
        started.get(id)?.();
      });
    }
  });
  const waitForStart = (id) => new Promise((resolve) => started.set(id, resolve));
  const oneStarted = waitForStart("one");
  const twoStarted = waitForStart("two");
  queue.enqueue({ id: "one" });
  queue.enqueue({ id: "two" });
  queue.enqueue({ id: "three" });
  await Promise.all([oneStarted, twoStarted]);

  assert.equal(queue.cancel("three").accepted, true);
  assert.equal(queue.status("three").phase, "cancelled");
  assert.equal(queue.cancel("one").accepted, true);
  releases.get("one")({ phase: "downloaded" });
  releases.get("two")({ phase: "downloaded" });
  await waitForIdle(queue);

  assert.equal(queue.status("one").phase, "cancelled");
  assert.equal(queue.status("two").phase, "downloaded");
  assert.equal(queue.cancel("two").accepted, false);
  assert.equal(queue.enqueue({ id: "one" }).accepted, true);
  await waitForIdle(queue);
  assert.equal(queue.status("one").phase, "downloaded");
});
