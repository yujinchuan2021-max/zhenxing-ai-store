"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  fetchOfficialRegistryPageWith,
  normalizeOfficialRegistryPage,
  runOfficialRegistryIntake
} = require("../shared/official-mcp-registry-intake.cjs");

function officialEntry(name, version, overrides = {}) {
  return {
    server: {
      $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
      name,
      description: `${name} description`,
      version,
      ...overrides
    },
    _meta: {
      "io.modelcontextprotocol.registry/official": {
        status: "active",
        statusChangedAt: "2026-08-15T00:00:00.000Z",
        publishedAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T01:00:00.000Z",
        isLatest: true
      }
    }
  };
}

function response(value, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": contentType }
  });
}

function trackedResponse({ status = 200, url = "", contentType = "application/json", contentLength = null, chunks = [] } = {}) {
  const state = { reads: 0, cancels: 0 };
  const headers = new Headers({ "content-type": contentType });
  if (contentLength !== null) headers.set("content-length", String(contentLength));
  return {
    state,
    value: {
      status,
      url,
      headers,
      body: {
        getReader() {
          let index = 0;
          return {
            async read() {
              state.reads += 1;
              if (index >= chunks.length) return { done: true };
              return { done: false, value: new Uint8Array(Buffer.from(chunks[index++])) };
            },
            async cancel() { state.cancels += 1; },
            releaseLock() {}
          };
        }
      }
    }
  };
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("normalizes an Official MCP Registry page into minimal discovery records", () => {
  const page = normalizeOfficialRegistryPage({
    servers: [
      {
        server: {
          $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
          name: "io.example/weather",
          description: "Weather lookup",
          title: "Weather",
          version: "1.2.3",
          websiteUrl: "https://example.com/weather",
          repository: {
            url: "https://github.com/example/weather",
            source: "github",
            id: "123",
            subfolder: "packages/mcp"
          },
          packages: [
            {
              registryType: "npm",
              registryBaseUrl: "https://registry.npmjs.org",
              identifier: "@example/weather",
              version: "1.2.3",
              transport: { type: "stdio" },
              runtimeHint: "npx",
              runtimeArguments: [{ type: "positional", value: "secret" }],
              environmentVariables: [{ name: "API_KEY", isSecret: true }]
            }
          ],
          remotes: [
            {
              type: "streamable-http",
              url: "https://example.com/private-endpoint",
              headers: [{ name: "Authorization", isSecret: true }]
            }
          ]
        },
        _meta: {
          "io.modelcontextprotocol.registry/official": {
            status: "active",
            statusChangedAt: "2026-08-15T00:00:00.000Z",
            publishedAt: "2026-08-15T00:00:00.000Z",
            updatedAt: "2026-08-15T01:00:00.000Z",
            isLatest: true
          }
        }
      }
    ],
    metadata: { count: 1, nextCursor: "io.example/weather:1.2.3" }
  });

  assert.deepEqual(page, {
    records: [
      {
        registryId: "io.example/weather@1.2.3",
        name: "io.example/weather",
        version: "1.2.3",
        title: "Weather",
        description: "Weather lookup",
        websiteUrl: "https://example.com/weather",
        repository: {
          url: "https://github.com/example/weather",
          source: "github",
          id: "123",
          subfolder: "packages/mcp"
        },
        packages: [
          {
            registryType: "npm",
            registryBaseUrl: "https://registry.npmjs.org/",
            identifier: "@example/weather",
            version: "1.2.3"
          }
        ],
        transportKinds: ["stdio", "streamable-http"],
        hasPackages: true,
        hasRemotes: true,
        packageCount: 1,
        packageRefCount: 1,
        remoteCount: 1,
        status: "active",
        statusMessage: null,
        statusChangedAt: "2026-08-15T00:00:00.000Z",
        publishedAt: "2026-08-15T00:00:00.000Z",
        updatedAt: "2026-08-15T01:00:00.000Z",
        isLatest: true,
        classification: "discovery-only",
        candidateOnly: true,
        publishable: false,
        installProfileId: "",
        discoveredVia: "official-mcp-registry",
        reviewStatus: "discovered-unreviewed",
        normalizationWarnings: []
      }
    ],
    nextCursor: "io.example/weather:1.2.3"
  });
  assert.doesNotMatch(
    JSON.stringify(page),
    /runtimeHint|runtimeArguments|environmentVariables|private-endpoint|Authorization|API_KEY|secret/
  );
});

test("runs every Registry page once and completed reruns are byte-idempotent", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-official-registry-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const calls = [];
  const pages = [
    {
      servers: [officialEntry("io.example/alpha", "1.0.0")],
      metadata: { count: 1, nextCursor: "io.example/alpha:1.0.0" }
    },
    {
      servers: [officialEntry("io.example/beta", "2.0.0")],
      metadata: { count: 1 }
    }
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response(pages[calls.length - 1]);
  };

  const summary = await runOfficialRegistryIntake({
    directory,
    fetchImpl,
    sleep: async () => {},
    now: () => "2026-08-15T02:00:00.000Z",
    runId: "test-run"
  });
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "https://registry.modelcontextprotocol.io/v0.1/servers?limit=100&version=latest",
      "https://registry.modelcontextprotocol.io/v0.1/servers?limit=100&version=latest&cursor=io.example%2Falpha%3A1.0.0"
    ]
  );
  assert.ok(calls.every((call) => call.options.redirect === "manual"));
  assert.deepEqual(
    { completed: summary.completed, pages: summary.pages, records: summary.records },
    { completed: true, pages: 2, records: 2 }
  );
  assert.deepEqual(
    {
      fullEnumeration: summary.fullEnumeration,
      snapshotIsolation: summary.snapshotIsolation,
      hasFullSnapshotClaim: Object.hasOwn(summary, "fullSnapshot")
    },
    { fullEnumeration: true, snapshotIsolation: false, hasFullSnapshotClaim: false }
  );

  const indexPath = path.join(directory, "registry-index.ndjson");
  const checkpointPath = path.join(directory, "checkpoint.json");
  const summaryPath = path.join(directory, "summary.json");
  const index = fs.readFileSync(indexPath, "utf8");
  assert.equal(index.trim().split("\n").length, 2);
  assert.doesNotMatch(index, /runtimeArguments|environmentVariables|headers|endpoint|command|args|env/);
  const frozen = [indexPath, checkpointPath, summaryPath].map((filePath) => ({
    filePath,
    hash: sha256(filePath),
    mtime: fs.statSync(filePath).mtimeMs
  }));

  await runOfficialRegistryIntake({
    directory,
    fetchImpl: async () => { throw new Error("completed run must not fetch"); },
    sleep: async () => {},
    now: () => "2026-08-15T03:00:00.000Z",
    runId: "second-run"
  });
  for (const item of frozen) {
    assert.equal(sha256(item.filePath), item.hash);
    assert.equal(fs.statSync(item.filePath).mtimeMs, item.mtime);
  }
  assert.equal(fs.existsSync(path.join(directory, "owner.lock")), false);
});

test("omits package metadata that cannot identify an immutable transport", () => {
  const invalid = (packageValue) => ({
    servers: [
      officialEntry("io.example/invalid-package", "1.0.0", {
        packages: [packageValue]
      })
    ],
    metadata: { count: 1 }
  });
  for (const packageValue of [
    {
      registryType: "npm",
      identifier: "@example/invalid-package",
      version: "1.0.0"
    },
    {
      registryType: "npm",
      identifier: "@example/invalid-package",
      version: "latest",
      transport: { type: "stdio" }
    }
  ]) {
    const record = normalizeOfficialRegistryPage(invalid(packageValue)).records[0];
    assert.deepEqual(record.packages, []);
    assert.equal(record.packageCount, 1);
    assert.equal(record.packageRefCount, 0);
    assert.deepEqual(record.normalizationWarnings, ["package-metadata-omitted"]);
  }
});

test("rejects a Registry page larger than the fixed public limit", () => {
  const servers = Array.from({ length: 101 }, (_, index) => officialEntry(`io.example/server-${index}`, "1.0.0"));
  assert.throws(
    () => normalizeOfficialRegistryPage({ servers, metadata: { count: servers.length } }),
    /page count exceeds limit/
  );
});

test("accepts historical latest rows without optional schema and updatedAt fields", () => {
  const entry = officialEntry("io.example/historical", "1.0.0");
  delete entry.server.$schema;
  delete entry._meta["io.modelcontextprotocol.registry/official"].updatedAt;
  const normalized = normalizeOfficialRegistryPage({ servers: [entry], metadata: { count: 1 } });
  assert.equal(normalized.records[0].updatedAt, null);
  assert.equal(normalized.records[0].registryId, "io.example/historical@1.0.0");
  assert.equal(normalized.records[0].classification, "discovery-only");
});

test("sanitizes optional repository metadata without persisting unsafe URL values", () => {
  const entry = officialEntry("io.example/legacy-repository", "1.0.0", {
    $schema: "private response value",
    websiteUrl: "http://legacy.example.test/mcp",
    repository: {
      url: "git+https://private.example.test/repository.git",
      id: 12345,
      subfolder: "../outside"
    }
  });
  const normalized = normalizeOfficialRegistryPage({ servers: [entry], metadata: { count: 1 } });
  assert.deepEqual(normalized.records[0].repository, {
    url: null,
    source: null,
    id: "12345",
    subfolder: null
  });
  assert.equal(normalized.records[0].websiteUrl, null);
  assert.deepEqual(normalized.records[0].normalizationWarnings, [
    "repository-id-stringified",
    "repository-subfolder-omitted",
    "repository-url-omitted",
    "schema-url-omitted",
    "website-url-omitted"
  ]);
  assert.doesNotMatch(JSON.stringify(normalized), /private response value|legacy\.example|private\.example/);
});

test("keeps identity while omitting malformed non-identity metadata", () => {
  const entry = officialEntry("io.example/legacy-package", "legacy-v1", {
    description: "unsafe\nmultiline",
    title: ["not text"],
    packages: [{
      registryType: "npm",
      identifier: "@example/legacy-package",
      version: "latest",
      transport: { type: "websocket" },
      environmentVariables: [{ name: "TOKEN", value: "private-value" }]
    }],
    remotes: [{ type: "websocket", url: "https://private.example/mcp" }]
  });
  delete entry._meta["io.modelcontextprotocol.registry/official"].statusChangedAt;
  delete entry._meta["io.modelcontextprotocol.registry/official"].publishedAt;
  delete entry._meta["io.modelcontextprotocol.registry/official"].updatedAt;
  const record = normalizeOfficialRegistryPage({ servers: [entry], metadata: { count: 1 } }).records[0];
  assert.equal(record.registryId, "io.example/legacy-package@legacy-v1");
  assert.equal(record.description, null);
  assert.equal(record.title, null);
  assert.deepEqual(record.packages, []);
  assert.equal(record.packageCount, 1);
  assert.equal(record.packageRefCount, 0);
  assert.equal(record.remoteCount, 1);
  assert.deepEqual(record.transportKinds, []);
  assert.deepEqual(record.normalizationWarnings, [
    "description-omitted",
    "package-metadata-omitted",
    "published-at-missing",
    "remote-metadata-omitted",
    "status-changed-at-missing",
    "title-omitted",
    "updated-at-missing"
  ]);
  assert.doesNotMatch(JSON.stringify(record), /TOKEN|private-value|private\.example|websocket/);
});

test("resumes by promoting one fully written page without refetching it", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-official-registry-resume-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const pages = [
    response({
      servers: [officialEntry("io.example/alpha", "1.0.0")],
      metadata: { count: 1, nextCursor: "io.example/alpha:1.0.0" }
    }),
    response({
      servers: [officialEntry("io.example/beta", "2.0.0")],
      metadata: { count: 1 }
    })
  ];
  let calls = 0;
  await runOfficialRegistryIntake({
    directory,
    fetchImpl: async () => pages[calls++],
    sleep: async () => {},
    now: () => "2026-08-15T02:00:00.000Z",
    runId: "initial"
  });

  const checkpointPath = path.join(directory, "checkpoint.json");
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  const first = checkpoint.pages[0];
  Object.assign(checkpoint, {
    pages: [first],
    records: first.records,
    nextCursor: first.cursorOut,
    exhausted: false,
    completed: false
  });
  delete checkpoint.index;
  delete checkpoint.summary;
  fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
  fs.rmSync(path.join(directory, "registry-index.ndjson"));
  fs.rmSync(path.join(directory, "summary.json"));

  const resumed = await runOfficialRegistryIntake({
    directory,
    fetchImpl: async () => { throw new Error("the durable orphan page must not be fetched again"); },
    sleep: async () => {},
    now: () => "2026-08-15T03:00:00.000Z",
    runId: "resume"
  });
  assert.equal(resumed.pages, 2);
  assert.equal(resumed.records, 2);
  assert.equal(calls, 2);
});

test("classifies a network failure without persisting its error text", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-official-registry-network-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let calls = 0;
  await assert.rejects(
    runOfficialRegistryIntake({
      directory,
      fetchImpl: async () => {
        calls += 1;
        throw new Error("private-host.example bearer-secret");
      },
      sleep: async () => {},
      now: () => "2026-08-15T04:00:00.000Z",
      runId: "network-failure"
    }),
    /fetch-failure/
  );
  assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "stopped.json"), "utf8")), {
    stopped: true,
    statusClass: "fetch-failure",
    page: 1,
    cursor: null
  });
  assert.doesNotMatch(fs.readFileSync(path.join(directory, "stopped.json"), "utf8"), /private-host|bearer-secret/);
});

test("HTTP safety stops never read rejected bodies and a stop marker blocks restart", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-official-registry-stop-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const rejected = trackedResponse({ status: 429, chunks: ["private response"] });
  let calls = 0;
  await assert.rejects(
    runOfficialRegistryIntake({
      directory,
      fetchImpl: async () => { calls += 1; return rejected.value; },
      sleep: async () => {},
      now: () => "2026-08-15T04:00:00.000Z",
      runId: "http-stop"
    }),
    /http-429/
  );
  assert.equal(calls, 1);
  assert.equal(rejected.state.reads, 0);
  const markerPath = path.join(directory, "stopped.json");
  assert.deepEqual(JSON.parse(fs.readFileSync(markerPath, "utf8")), {
    stopped: true,
    statusClass: "http-429",
    page: 1,
    cursor: null
  });
  const frozen = { hash: sha256(markerPath), mtime: fs.statSync(markerPath).mtimeMs };
  await assert.rejects(
    runOfficialRegistryIntake({
      directory,
      fetchImpl: async () => { calls += 1; throw new Error("must not fetch"); },
      sleep: async () => {},
      runId: "blocked-restart"
    }),
    /stopped pending review/
  );
  assert.equal(calls, 1);
  assert.equal(sha256(markerPath), frozen.hash);
  assert.equal(fs.statSync(markerPath).mtimeMs, frozen.mtime);
  assert.equal(fs.existsSync(path.join(directory, "owner.lock")), false);
});

test("response boundaries reject redirects, non-JSON, and byte overflow without leakage", async () => {
  const url = "https://registry.modelcontextprotocol.io/v0.1/servers?limit=100&version=latest";
  const redirect = trackedResponse({ status: 302, url, chunks: ["redirect body"] });
  await assert.rejects(fetchOfficialRegistryPageWith(async () => redirect.value, url, 5), /redirect-boundary/);
  assert.equal(redirect.state.reads, 0);

  const wrongType = trackedResponse({ url, contentType: "text/html", chunks: ["<html>"] });
  await assert.rejects(fetchOfficialRegistryPageWith(async () => wrongType.value, url, 5), /content-type/);
  assert.equal(wrongType.state.reads, 0);

  const declared = trackedResponse({ url, contentLength: 6, chunks: ["123456"] });
  await assert.rejects(fetchOfficialRegistryPageWith(async () => declared.value, url, 5), /body-read/);
  assert.equal(declared.state.reads, 0);

  const streamed = trackedResponse({ url, chunks: ["1234", "5678"] });
  await assert.rejects(fetchOfficialRegistryPageWith(async () => streamed.value, url, 5), /body-read/);
  assert.equal(streamed.state.cancels, 1);
});

test("resume rejects an unknown temporary page artifact before any fetch or write", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-official-registry-drift-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  await runOfficialRegistryIntake({
    directory,
    fetchImpl: async () => response({
      servers: [officialEntry("io.example/alpha", "1.0.0")],
      metadata: { count: 1 }
    }),
    sleep: async () => {},
    now: () => "2026-08-15T04:00:00.000Z",
    runId: "initial"
  });
  const checkpointPath = path.join(directory, "checkpoint.json");
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  checkpoint.completed = false;
  delete checkpoint.index;
  delete checkpoint.summary;
  fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
  const strayPath = path.join(directory, "pages", "page-000002.json.123.tmp");
  fs.writeFileSync(strayPath, "partial");
  const protectedPaths = [checkpointPath, path.join(directory, "registry-index.ndjson"), path.join(directory, "summary.json")];
  const frozen = protectedPaths.map((filePath) => ({ filePath, hash: sha256(filePath), mtime: fs.statSync(filePath).mtimeMs }));
  let calls = 0;
  await assert.rejects(
    runOfficialRegistryIntake({
      directory,
      fetchImpl: async () => { calls += 1; throw new Error("must not fetch"); },
      sleep: async () => {},
      runId: "drifted-resume"
    }),
    /temporary page artifact/
  );
  assert.equal(calls, 0);
  for (const item of frozen) {
    assert.equal(sha256(item.filePath), item.hash);
    assert.equal(fs.statSync(item.filePath).mtimeMs, item.mtime);
  }
  assert.equal(fs.existsSync(path.join(directory, "owner.lock")), false);
});

test("resume rejects executable fields injected into an uncheckpointed normalized page", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-official-registry-cache-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const pages = [
    response({
      servers: [officialEntry("io.example/alpha", "1.0.0")],
      metadata: { count: 1, nextCursor: "io.example/alpha:1.0.0" }
    }),
    response({
      servers: [officialEntry("io.example/beta", "2.0.0")],
      metadata: { count: 1 }
    })
  ];
  let calls = 0;
  await runOfficialRegistryIntake({
    directory,
    fetchImpl: async () => pages[calls++],
    sleep: async () => {},
    now: () => "2026-08-15T04:00:00.000Z",
    runId: "initial"
  });
  const checkpointPath = path.join(directory, "checkpoint.json");
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  const first = checkpoint.pages[0];
  Object.assign(checkpoint, {
    pages: [first],
    records: first.records,
    nextCursor: first.cursorOut,
    exhausted: false,
    completed: false
  });
  delete checkpoint.index;
  delete checkpoint.summary;
  fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
  fs.rmSync(path.join(directory, "registry-index.ndjson"));
  fs.rmSync(path.join(directory, "summary.json"));
  const orphanPath = path.join(directory, "pages", "page-000002.json");
  const orphan = JSON.parse(fs.readFileSync(orphanPath, "utf8"));
  orphan.records[0].packages = [{
    registryType: "npm",
    registryBaseUrl: "https://registry.npmjs.org/",
    identifier: "@example/beta",
    version: "2.0.0",
    command: "private-command"
  }];
  orphan.records[0].hasPackages = true;
  orphan.records[0].packageCount = 1;
  fs.writeFileSync(orphanPath, `${JSON.stringify(orphan, null, 2)}\n`);

  await assert.rejects(
    runOfficialRegistryIntake({
      directory,
      fetchImpl: async () => { throw new Error("must not fetch"); },
      sleep: async () => {},
      runId: "malicious-cache"
    }),
    /package schema drift/
  );
  assert.equal(fs.existsSync(path.join(directory, "registry-index.ndjson")), false);
  assert.equal(fs.existsSync(path.join(directory, "owner.lock")), false);
});

test("pagination stops on a repeated canonical server name or cursor cycle", async (t) => {
  async function runScenario(label, secondPage) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `aihub-official-registry-${label}-`));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const pages = [
      response({
        servers: [officialEntry("io.example/alpha", "1.0.0")],
        metadata: { count: 1, nextCursor: "io.example/alpha:1.0.0" }
      }),
      response(secondPage)
    ];
    let calls = 0;
    await assert.rejects(runOfficialRegistryIntake({
      directory,
      fetchImpl: async () => pages[calls++],
      sleep: async () => {},
      runId: label
    }));
    return JSON.parse(fs.readFileSync(path.join(directory, "stopped.json"), "utf8"));
  }

  const duplicate = await runScenario("duplicate", {
    servers: [officialEntry("io.example/alpha", "2.0.0")],
    metadata: { count: 1 }
  });
  assert.equal(duplicate.statusClass, "validation-identity");

  const cycle = await runScenario("cycle", {
    servers: [officialEntry("io.example/beta", "1.0.0")],
    metadata: { count: 1, nextCursor: "io.example/alpha:1.0.0" }
  });
  assert.equal(cycle.statusClass, "validation-cursor");
});
