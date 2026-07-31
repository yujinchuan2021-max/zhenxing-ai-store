"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  candidateId,
  createDiscoveryReview
} = require("../admin/discovery-review.cjs");

function catalogFixture() {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "admin", "data", "catalog-v1.json"),
      "utf8"
    )
  );
}

function writeReport(reportPath, catalog, findings) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: "2026-07-31T14:00:00.000Z",
        catalogUpdatedAt: catalog.updatedAt,
        summary: {
          vendors: 49,
          checkedPages: 83,
          failures: 4,
          needsReview: findings.length,
          researchLeads: 21
        },
        vendors: [
          {
            vendorId: "openai",
            vendorName: "OpenAI",
            candidates: findings
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

function candidate(overrides = {}) {
  return {
    url: "https://openai.com/future-product",
    label: "Future Product",
    inferredType: "web-or-feature",
    score: 8,
    existingProductId: null,
    evidenceUrl: "https://openai.com/",
    ...overrides
  };
}

function setup(t, { findings = [candidate()], runScan = async () => {} } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-discovery-review-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const reportPath = path.join(directory, "report.json");
  const statePath = path.join(directory, "state.json");
  const catalog = catalogFixture();
  writeReport(reportPath, catalog, findings);
  const commits = [];
  const review = createDiscoveryReview({
    reportPath,
    statePath,
    clock: () => new Date("2026-07-31T15:00:00.000Z"),
    runScan,
    commitCatalog: async (value) => {
      commits.push(value);
      return { revision: 18, updatedAt: "2026-07-31T15:00:01.000Z" };
    }
  });
  return { catalog, commits, reportPath, review, statePath };
}

test("discovery review exposes only current vendor-scoped candidates", (t) => {
  const { catalog, review } = setup(t, {
    findings: [
      candidate(),
      candidate({
        url: "https://example.com/not-official",
        evidenceUrl: "https://example.com/"
      }),
      candidate({
        url: "https://openai.com/already-known",
        existingProductId: "chatgpt-web"
      })
    ]
  });
  const snapshot = review.snapshot(catalog);
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.stale, false);
  assert.equal(snapshot.summary.pending, 1);
  assert.equal(snapshot.candidates[0].vendorId, "openai");
  assert.equal(snapshot.candidates[0].suggestedModuleId, "web-link");
});

test("ignore and restore are persisted behind the review interface", (t) => {
  const { catalog, review, statePath } = setup(t);
  const id = candidateId("openai", "https://openai.com/future-product");
  assert.equal(review.decision({ catalog, candidateId: id, status: "ignored" }).summary.ignored, 1);
  assert.equal(JSON.parse(fs.readFileSync(statePath, "utf8")).decisions[id].status, "ignored");
  assert.equal(review.decision({ catalog, candidateId: id, status: "pending" }).summary.pending, 1);
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(statePath, "utf8")).decisions, id), false);
});

test("accepted candidates enter a disabled safe draft and never gain local execution", async (t) => {
  const { catalog, commits, review } = setup(t);
  const id = candidateId("openai", "https://openai.com/future-product");
  await assert.rejects(
    review.acceptCandidate({
      catalog,
      candidateId: id,
      expectedRevision: 17,
      product: {
        id: "openai-future",
        name: "Future Product",
        description: "Official product candidate.",
        category: "AI 对话",
        moduleId: "cli-managed",
        tutorial: "https://openai.com/future-product"
      }
    }),
    /不执行本地命令/
  );
  assert.equal(commits.length, 0);

  const result = await review.acceptCandidate({
    catalog,
    candidateId: id,
    expectedRevision: 17,
    product: {
      id: "openai-future",
      name: "Future Product",
      description: "Official product candidate.",
      category: "AI 对话",
      moduleId: "web-link",
      tutorial: "https://openai.com/future-product"
    }
  });
  assert.equal(result.revision, 18);
  assert.equal(result.product.enabled, false);
  assert.equal(result.product.moduleId, "web-link");
  assert.deepEqual(result.product.capabilities, ["website", "tutorial"]);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].expectedRevision, 17);
  assert.equal(
    commits[0].catalog.vendors.find((vendor) => vendor.id === "openai").products.at(-1).id,
    "openai-future"
  );
  assert.equal(review.snapshot(catalog).summary.accepted, 1);
});

test("a stale report is labeled but still enters only a disabled safe draft", async (t) => {
  const { catalog, commits, review } = setup(t);
  catalog.updatedAt = "2026-07-31T16:00:00.000Z";
  assert.equal(review.snapshot(catalog).stale, true);
  const result = await review.acceptCandidate({
    catalog,
    candidateId: candidateId("openai", "https://openai.com/future-product"),
    expectedRevision: 18,
    product: {
      id: "openai-future",
      name: "Future Product",
      description: "Official product candidate.",
      category: "AI 对话",
      moduleId: "web-link",
      tutorial: "https://openai.com/future-product"
    }
  });
  assert.equal(result.product.enabled, false);
  assert.equal(commits.length, 1);
});

test("candidate review accepts categories declared by the current backend catalog", async (t) => {
  const { catalog, review } = setup(t);
  catalog.categories = [
    ...(catalog.categories || [
      "AI 对话",
      "编程开发",
      "图像创作",
      "视频创作",
      "音频创作",
      "智能体",
      "本地模型"
    ]),
    "语音交互"
  ];
  const result = await review.acceptCandidate({
    catalog,
    candidateId: candidateId("openai", "https://openai.com/future-product"),
    expectedRevision: 18,
    product: {
      id: "openai-voice-future",
      name: "Future Voice Product",
      description: "Official voice product candidate.",
      category: "语音交互",
      moduleId: "web-link",
      tutorial: "https://openai.com/future-product"
    }
  });
  assert.equal(result.product.category, "语音交互");
});

test("only one fixed scan runs at a time and exposes bounded status", async (t) => {
  let finish;
  const running = new Promise((resolve) => (finish = resolve));
  const { review } = setup(t, { runScan: () => running });
  assert.equal(review.startScan().started, true);
  assert.equal(review.startScan().started, false);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(review.startScan().started, true);
});

test("admin exposes the discovery queue without an executable policy input", () => {
  const server = fs.readFileSync(
    path.join(__dirname, "..", "admin", "server.cjs"),
    "utf8"
  );
  const html = fs.readFileSync(
    path.join(__dirname, "..", "admin", "public", "index.html"),
    "utf8"
  );
  const script = fs.readFileSync(
    path.join(__dirname, "..", "admin", "public", "app.js"),
    "utf8"
  );
  assert.match(html, /data-view="discovery"/);
  for (const route of [
    "/api/discovery",
    "/api/discovery/scan",
    "/api/discovery/decision",
    "/api/discovery/accept"
  ]) {
    assert.match(server, new RegExp(route.replaceAll("/", "\\/")));
  }
  for (const marker of [
    "scan-discovery",
    "ignore-discovery",
    "restore-discovery",
    "accept-discovery",
    "data-discovery-product"
  ]) {
    assert.match(script, new RegExp(marker));
  }
  assert.doesNotMatch(script, /data-discovery-(?:command|script|download)/);
});
