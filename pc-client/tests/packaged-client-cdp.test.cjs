"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("creates and removes an isolated packaged-client profile", async () => {
  const module = await import("../scripts/lib/packaged-client-cdp.mjs");
  const profile = module.createIsolatedAcceptanceProfile("aihub-cdp-test-");
  assert.equal(
    path.relative(path.resolve(os.tmpdir()), profile.root).startsWith(".."),
    false
  );
  assert.equal(fs.existsSync(path.join(profile.userData, "pc-settings.json")), true);
  await module.removeIsolatedAcceptanceProfile(profile);
  assert.equal(fs.existsSync(profile.root), false);
});

test("requires a real byte threshold and paused task from the download gate", async () => {
  const { verifyManagedDownloadPause } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const downloadDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-cdp-download-")
  );
  fs.writeFileSync(path.join(downloadDirectory, "installer.exe.part"), Buffer.alloc(2048));
  const calls = [];
  try {
    const result = await verifyManagedDownloadPause({
      productId: "openclaw-windows-hub",
      downloadDirectory,
      minimumBytes: 1024,
      timeoutMs: 1000,
      async evaluate(expression) {
        calls.push(expression);
        if (expression.startsWith("Boolean")) return true;
        if (expression.includes("startDownload")) return { ok: true, task: {} };
        if (expression.includes("getDownloadTask")) {
          return { phase: "downloading", progress: { receivedBytes: 2048 } };
        }
        if (expression.includes("pauseDownload")) {
          return {
            ok: true,
            task: {
              phase: "paused",
              resumable: true,
              progress: { receivedBytes: 2048, downloadDirectory }
            }
          };
        }
        throw new Error(`Unexpected expression: ${expression}`);
      }
    });
    assert.deepEqual(result, {
      productId: "openclaw-windows-hub",
      phase: "paused",
      receivedBytes: 2048,
      partialPath: path.join(downloadDirectory, "installer.exe.part")
    });
    assert.equal(calls.some((entry) => entry.includes("pauseDownload")), true);
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true });
  }
});

test("rejects a paused task whose durable partial did not reach the gate", async () => {
  const { verifyManagedDownloadPause } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const downloadDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-cdp-download-")
  );
  try {
    await assert.rejects(
      verifyManagedDownloadPause({
        productId: "openclaw-windows-hub",
        downloadDirectory,
        minimumBytes: 1024,
        timeoutMs: 1000,
        async evaluate(expression) {
          if (expression.startsWith("Boolean")) return true;
          if (expression.includes("startDownload")) return { ok: true, task: {} };
          if (expression.includes("getDownloadTask")) {
            return { phase: "downloading", progress: { receivedBytes: 2048 } };
          }
          if (expression.includes("pauseDownload")) {
            return {
              ok: true,
              task: {
                phase: "paused",
                resumable: false,
                progress: { receivedBytes: 0, downloadDirectory }
              }
            };
          }
          throw new Error(`Unexpected expression: ${expression}`);
        }
      }),
      /durable partial/i
    );
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true });
  }
});

test("bounds the CDP WebSocket handshake and runs failure cleanup", async () => {
  const { openCdpWebSocket } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  let closed = 0;
  let cleaned = 0;
  class NeverOpeningSocket extends EventTarget {
    close() {
      closed += 1;
    }
  }

  await assert.rejects(
    openCdpWebSocket({
      debuggerUrl: "ws://127.0.0.1:9222/devtools/page/test",
      timeoutMs: 20,
      createSocket: () => new NeverOpeningSocket(),
      onFailure: () => {
        cleaned += 1;
      }
    }),
    /timed out/i
  );
  assert.equal(closed, 1);
  assert.equal(cleaned, 1);
});

test("requires a real DOM action to expose disabled busy feedback", async () => {
  const { clickPackagedDomAction } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  await assert.rejects(
    clickPackagedDomAction({
      productId: "openclaw-windows-hub",
      action: "install-product",
      timeoutMs: 1000,
      async evaluate() {
        return { clicked: true, busyObserved: false, label: "" };
      }
    }),
    /busy feedback/i
  );

  let clickedExpression = "";
  const result = await clickPackagedDomAction({
    productId: "openclaw-windows-hub",
    action: "install-product",
    timeoutMs: 1000,
    async evaluate(expression) {
      clickedExpression = expression;
      return { clicked: true, busyObserved: true, label: "正在检测" };
    }
  });
  assert.deepEqual(result, {
    clicked: true,
    busyObserved: true,
    label: "正在检测"
  });
  assert.match(clickedExpression, /actionButton\.click\(\)/);
  assert.doesNotMatch(clickedExpression, /window\.aihubPC/);
});

test("drives managed download start and pause through supplied DOM actions", async () => {
  const { verifyManagedDownloadPause } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const downloadDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "aihub-cdp-download-")
  );
  fs.writeFileSync(
    path.join(downloadDirectory, "installer.exe.part"),
    Buffer.alloc(2048)
  );
  const expressions = [];
  let starts = 0;
  let pauses = 0;
  try {
    const result = await verifyManagedDownloadPause({
      productId: "openclaw-windows-hub",
      downloadDirectory,
      minimumBytes: 1024,
      timeoutMs: 1000,
      async startDownload() {
        starts += 1;
        return { ok: true, task: { phase: "starting" } };
      },
      async pauseDownload() {
        pauses += 1;
        return {
          ok: true,
          task: {
            phase: "paused",
            resumable: true,
            progress: { receivedBytes: 2048, downloadDirectory }
          }
        };
      },
      async evaluate(expression) {
        expressions.push(expression);
        if (expression.startsWith("Boolean")) return true;
        if (expression.includes("getDownloadTask")) {
          return { phase: "downloading", progress: { receivedBytes: 2048 } };
        }
        throw new Error(`Unexpected expression: ${expression}`);
      }
    });
    assert.equal(starts, 1);
    assert.equal(pauses, 1);
    assert.equal(
      expressions.some(
        (expression) =>
          expression.includes("startDownload") || expression.includes("pauseDownload")
      ),
      false
    );
    assert.equal(result.receivedBytes, 2048);
  } finally {
    fs.rmSync(downloadDirectory, { recursive: true, force: true });
  }
});

test("accepts a newer remote catalog while rejecting stale or local data", async () => {
  const { assertPackagedRemoteCatalog } = await import(
    "../scripts/lib/packaged-client-cdp.mjs"
  );
  const newer = {
    source: "remote",
    catalogVersion: 12,
    catalog: { vendors: [{ id: "openai", products: [] }] }
  };
  assert.equal(
    assertPackagedRemoteCatalog({ catalog: newer, minimumCatalogVersion: 10 }),
    newer
  );
  assert.throws(
    () =>
      assertPackagedRemoteCatalog({
        catalog: { ...newer, catalogVersion: 9 },
        minimumCatalogVersion: 10
      }),
    /remote signed catalog/i
  );
  assert.throws(
    () =>
      assertPackagedRemoteCatalog({
        catalog: { ...newer, source: "built-in" },
        minimumCatalogVersion: 10
      }),
    /remote signed catalog/i
  );
});

test("the packaged release gate does not bypass renderer actions", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "verify-local-release-client.mjs"),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /window\.aihubPC\.(?:installExtension|uninstallExtension|startDownload|pauseDownload)\(/
  );
  for (const action of [
    "install-extension",
    "uninstall-extension",
    "install-product",
    "pause-download"
  ]) {
    assert.match(source, new RegExp(`action: ["']${action}["']`));
  }
});
