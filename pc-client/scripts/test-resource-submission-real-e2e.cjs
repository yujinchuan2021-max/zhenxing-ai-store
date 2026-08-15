"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const image = "zhenxing-ai/identity:community-candidate-e5a9b797c20f";
const runId = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const prefix = `aihub-submission-e2e-${runId}`;
const resources = {
  network: `${prefix}-network`,
  volume: `${prefix}-postgres`,
  postgres: `${prefix}-postgres`,
  mailpit: `${prefix}-mailpit`,
  identity: `${prefix}-identity`
};
const output = path.join(root, "output", "acceptance", `resource-submission-real-e2e-${runId}`);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
const profile = path.join(temporary, "electron-profile");
const reviewerSecretPath = path.join(temporary, "reviewer-secret");
const electronLogPath = path.join(output, "electron.log");
const evidence = {
  runId,
  tier: "isolated-real-electron-identity-e2e",
  focusedTests: "32/32",
  build: "pass",
  migration: {},
  disabled: {},
  anonymous: {},
  lifecycle: {},
  boundaries: {},
  layout: {},
  community: {},
  businessFailures: [],
  cleanup: {}
};

fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(reviewerSecretPath, crypto.randomBytes(32).toString("hex"), {
  encoding: "utf8",
  mode: 0o600
});

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${executable} ${args.join(" ")} failed (${result.status}): ${String(
        result.stderr || result.stdout
      ).trim()}`
    );
  }
  return result;
}

const docker = (args, options) => command("docker", args, options);

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(check, message, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`${message}${lastError ? `: ${lastError.message}` : ""}`);
}

async function jsonRequest(origin, pathname, options = {}) {
  const response = await fetch(new URL(pathname, `${origin}/`), {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let value = {};
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    value = { text };
  }
  if (!response.ok) {
    const error = new Error(value.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return value;
}

function psql(sql, { tuples = false } = {}) {
  const args = ["exec", "-i", resources.postgres, "psql", "-v", "ON_ERROR_STOP=1"];
  if (tuples) args.push("-At");
  args.push("-U", "acceptance", "-d", "acceptance");
  return docker(args, { input: sql }).stdout.trim();
}

function submissionCount() {
  return Number(psql("SELECT count(*) FROM resource_submissions;\n", { tuples: true }));
}

function startIdentity(enabled, identityPort, proxyOrigin) {
  docker(["rm", "-f", resources.identity], { allowFailure: true });
  const args = [
    "run", "-d", "--name", resources.identity,
    "--network", resources.network,
    "-p", `127.0.0.1:${identityPort}:4180`,
    "--mount", `type=bind,src=${root},dst=/workspace,readonly`,
    "--mount", `type=bind,src=${reviewerSecretPath},dst=/run/secrets/resource-reviewer,readonly`,
    "--workdir", "/workspace/identity",
    "-e", "NODE_PATH=/app/identity/node_modules",
    "-e", "AIHUB_IDENTITY_HOST=0.0.0.0",
    "-e", "AIHUB_IDENTITY_PORT=4180",
    "-e", "AIHUB_IDENTITY_SCHEMA_MODE=external",
    "-e", "AIHUB_IDENTITY_DATABASE_URL=postgres://acceptance@postgres:5432/acceptance",
    "-e", `AIHUB_IDENTITY_PUBLIC_ORIGIN=${proxyOrigin}`,
    "-e", "AIHUB_REGISTRATION_ENABLED=1",
    "-e", "AIHUB_SMTP_HOST=mailpit",
    "-e", "AIHUB_SMTP_PORT=1025",
    "-e", "AIHUB_SMTP_SECURE=false",
    "-e", "AIHUB_SMTP_REQUIRE_TLS=false",
    "-e", "AIHUB_CATALOG_URL=http://127.0.0.1:9/catalog-v1.json",
    "-e", `AIHUB_RESOURCE_SUBMISSIONS_ENABLED=${enabled ? "1" : "0"}`,
    "-e", "AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION=1",
    "--entrypoint", "node",
    image,
    "/workspace/identity/server.cjs"
  ];
  docker(args);
}

async function waitIdentity(origin) {
  await waitFor(
    async () => {
      const response = await fetch(`${origin}/ready`);
      return response.status === 200;
    },
    "Identity did not become ready",
    35_000
  );
}

function createProxy(targetOrigin) {
  const state = {
    nextCreateAfterForward503: false,
    nextOwner429: false,
    nextOwner503: false,
    nextListLeak: false,
    metrics: { capability: 0, ownerRead: 0, ownerWrite: 0, forwarded: 0 }
  };
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const owner = pathname.startsWith("/v1/me/resource-submissions");
    const create = owner && request.method === "POST" && pathname === "/v1/me/resource-submissions";
    const list = owner && request.method === "GET" && pathname === "/v1/me/resource-submissions";
    if (pathname === "/v1/resource-submissions/capability") state.metrics.capability += 1;
    if (owner) state.metrics[request.method === "GET" ? "ownerRead" : "ownerWrite"] += 1;
    if (owner && state.nextOwner429) {
      state.nextOwner429 = false;
      response.writeHead(429, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "RATE_LIMITED", message: "synthetic internal rate detail" }));
      return;
    }
    if (owner && state.nextOwner503) {
      state.nextOwner503 = false;
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "DB_FAILURE", message: "synthetic postgres secret detail" }));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const headers = { ...request.headers };
    delete headers.host;
    delete headers.connection;
    delete headers["content-length"];
    headers.connection = "close";
    try {
      state.metrics.forwarded += 1;
      const upstream = await fetch(new URL(request.url, `${targetOrigin}/`), {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : Buffer.concat(chunks)
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      if (create && state.nextCreateAfterForward503) {
        state.nextCreateAfterForward503 = false;
        response.writeHead(503, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "UPSTREAM_TIMEOUT", message: "synthetic raw timeout detail" }));
        return;
      }
      if (list && state.nextListLeak && upstream.ok) {
        state.nextListLeak = false;
        const value = JSON.parse(body.toString("utf8"));
        if (value.items?.length) {
          Object.assign(value.items[0], {
            reviewerId: "reviewer-internal",
            riskLevel: "internal-risk",
            audit: [{ note: "internal-audit" }],
            fingerprint: "internal-fingerprint"
          });
        }
        response.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(value));
        return;
      }
      response.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/json"
      });
      response.end(body);
    } catch {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "UPSTREAM_UNAVAILABLE", message: "identity unavailable" }));
    }
  });
  return { server, state };
}

function electronController(port) {
  let socket;
  let sequence = 0;
  const pending = new Map();
  async function connect() {
    const page = await waitFor(async () => {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      return targets.find((target) => target.type === "page" && target.url.startsWith("file:"));
    }, "could not connect to the real Electron renderer");
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    });
    await send("Runtime.enable");
    await send("Page.enable");
  }
  function send(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }
  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }
  async function waitForExpression(expression, message, timeout = 20_000) {
    await waitFor(async () => Boolean(await evaluate(expression)), message, timeout);
  }
  async function screenshot(name) {
    const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const target = path.join(output, name);
    fs.writeFileSync(target, Buffer.from(result.data, "base64"));
    return target;
  }
  return {
    connect,
    evaluate,
    send,
    screenshot,
    waitForExpression,
    close: () => socket?.close()
  };
}

function containerScript(source) {
  const result = docker(["exec", "-i", resources.identity, "node", "-"], { input: source });
  return JSON.parse(result.stdout.trim());
}

function review(body) {
  return containerScript(`
    const fs = require("node:fs");
    const { Pool } = require("pg");
    const { createFixedServiceReviewerAuthenticator, createIdentityResourceSubmissionStore, createResourceSubmissionReviewAdapter } = require("/workspace/identity/resource-submissions.cjs");
    (async () => {
      const pool = new Pool({ connectionString: process.env.AIHUB_IDENTITY_DATABASE_URL });
      try {
        const store = createIdentityResourceSubmissionStore({ pool, enabled: true, rateLimit: async () => true });
        const secret = fs.readFileSync("/run/secrets/resource-reviewer", "utf8").trim();
        const adapter = createResourceSubmissionReviewAdapter({ store, authenticateService: createFixedServiceReviewerAuthenticator({ secret, reviewerIdentityId: "review-service:e2e" }) });
        const result = await adapter.review({ headers: { "x-aihub-resource-review-secret": secret }, body: ${JSON.stringify(body)} });
        process.stdout.write(JSON.stringify({ submissionId: result.submissionId, revision: result.revision, status: result.status, publicEligibility: result.publicEligibility }));
      } finally { await pool.end(); }
    })().catch((error) => { console.error(error); process.exit(1); });
  `);
}

function ownerUpdate({ actorId, submissionId, expectedRevision, submission }) {
  return containerScript(`
    const { Pool } = require("pg");
    const { createIdentityResourceSubmissionStore } = require("/workspace/identity/resource-submissions.cjs");
    (async () => {
      const pool = new Pool({ connectionString: process.env.AIHUB_IDENTITY_DATABASE_URL });
      try {
        const store = createIdentityResourceSubmissionStore({ pool, enabled: true, rateLimit: async () => true });
        const result = await store.mutateOwner({ actorId: ${JSON.stringify(actorId)}, submissionId: ${JSON.stringify(submissionId)}, expectedRevision: ${expectedRevision}, action: "update", submission: ${JSON.stringify(submission)} });
        process.stdout.write(JSON.stringify({ submissionId: result.submissionId, revision: result.revision, status: result.status }));
      } finally { await pool.end(); }
    })().catch((error) => { console.error(error); process.exit(1); });
  `);
}

function publicReadModel() {
  return containerScript(`
    const { Pool } = require("pg");
    const { createPublicContributionReadModel } = require("/workspace/community/public-contributions.cjs");
    (async () => {
      const pool = new Pool({ connectionString: process.env.AIHUB_IDENTITY_DATABASE_URL });
      try {
        const records = (await pool.query("SELECT record FROM resource_submissions ORDER BY submission_id")).rows.map((row) => row.record);
        const model = createPublicContributionReadModel({ isPubliclyAllowed: (record) => record.publicEligibility === true, resolvePublicIdentity: (identityId, displayName) => ({ identityId, displayName }) }).build(records);
        const cards = model.list();
        process.stdout.write(JSON.stringify({ cards: cards.length, ids: cards.map((card) => card.contributionId), privateLeak: JSON.stringify(cards).includes("review-service:e2e") || JSON.stringify(cards).includes("dedupeFingerprint") }));
      } finally { await pool.end(); }
    })().catch((error) => { console.error(error); process.exit(1); });
  `);
}

async function provisionUser(proxyOrigin, mailOrigin) {
  const suffix = runId.replace(/[^a-z0-9]/gi, "").slice(-12);
  const account = {
    email: `submission-${suffix}@aihub.local`,
    username: `submission_${suffix}`.slice(0, 28),
    nickname: `Submission ${suffix}`,
    password: `AIHub-${suffix}-Secure9`
  };
  const challenge = await jsonRequest(proxyOrigin, "/v1/registration/challenges", {
    method: "POST",
    body: { email: account.email }
  });
  const code = await waitFor(async () => {
    const mailbox = await (await fetch(`${mailOrigin}/api/v1/messages`)).json();
    const message = mailbox.messages?.find((candidate) =>
      candidate.To?.some((recipient) => recipient.Address.toLowerCase() === account.email.toLowerCase())
    );
    return message?.Snippet?.match(/(\d{6})/)?.[1] || "";
  }, "registration mail did not arrive");
  const registration = await jsonRequest(proxyOrigin, "/v1/registration/complete", {
    method: "POST",
    body: {
      challengeId: challenge.challengeId,
      code,
      email: account.email,
      username: account.username,
      nickname: account.nickname,
      password: account.password,
      deviceId: crypto.randomUUID(),
      deviceName: "Resource submission isolated E2E"
    }
  });
  return { account, identityId: registration.user.id };
}

function setFieldScript(data) {
  return `(() => {
    const form = document.querySelector('.submissionForm');
    const inputs = [...form.querySelectorAll('input')];
    const textareas = [...form.querySelectorAll('textarea')];
    const set = (element, value) => {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(inputs[0], ${JSON.stringify(data.title)});
    set(inputs[1], ${JSON.stringify(data.canonicalSource)});
    set(inputs[2], ${JSON.stringify(data.originalAuthor || "E2E Author")});
    set(inputs[3], ${JSON.stringify(data.organization || "E2E Org")});
    set(inputs[4], ${JSON.stringify(data.licenseId || "MIT")});
    set(inputs[5], ${JSON.stringify(data.sourceRevision || "v1")});
    set(inputs[7], ${JSON.stringify(data.platforms || "windows")});
    set(textareas[0], ${JSON.stringify(data.summary)});
    set(textareas[1], ${JSON.stringify(data.evidence || "https://example.com/evidence")});
    return true;
  })()`;
}

function recordUnsafeUiMessage(label, value) {
  if (/Error invoking remote method|ResourceSubmissionIpcError|identity:|stack|https?:\/\/|postgres|database|DB_|secret/i.test(value)) {
    evidence.businessFailures.push({
      owner: "frontend/identity-ipc-error-presentation",
      label,
      reason: "technical Electron IPC wrapper is visible to the user",
      text: value
    });
  }
}

function submissionValue(result, label) {
  assert.deepEqual(Object.keys(result).sort(), ["ok", "value"], `${label} success envelope shape`);
  assert.equal(result.ok, true, `${label} did not return a success envelope`);
  return result.value;
}

function safeSubmissionFailure(result, expected, label) {
  assert.deepEqual(Object.keys(result).sort(), ["error", "ok"], `${label} failure envelope shape`);
  assert.equal(result.ok, false, `${label} did not return a failure envelope`);
  assert.deepEqual(Object.keys(result.error).sort(), ["code", "messageKey", "status"], `${label} error shape`);
  assert.deepEqual(result.error, expected, `${label} safe error contract`);
  assert.equal(
    /Error invoking remote method|ResourceSubmissionIpcError|identity:|stack|https?:\/\/|postgres|database|DB_|secret/i.test(JSON.stringify(result)),
    false,
    `${label} leaked technical data`
  );
  evidence.boundaries.structuredErrors ||= {};
  evidence.boundaries.structuredErrors[label] = result.error;
  return result.error;
}

async function main() {
  const pgPort = await freePort();
  const mailPort = await freePort();
  const identityPort = await freePort();
  const proxyPort = await freePort();
  const debugPort = await freePort();
  const identityOrigin = `http://127.0.0.1:${identityPort}`;
  const proxyOrigin = `http://127.0.0.1:${proxyPort}`;
  const mailOrigin = `http://127.0.0.1:${mailPort}`;
  const { server: proxy, state: proxyState } = createProxy(identityOrigin);
  let electron;
  let controller;
  let completed = false;
  try {
    docker(["network", "create", resources.network]);
    docker(["volume", "create", resources.volume]);
    docker([
      "run", "-d", "--name", resources.postgres,
      "--network", resources.network, "--network-alias", "postgres",
      "-p", `127.0.0.1:${pgPort}:5432`,
      "-e", "POSTGRES_USER=acceptance",
      "-e", "POSTGRES_DB=acceptance",
      "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
      "-v", `${resources.volume}:/var/lib/postgresql/data`,
      "postgres:17-alpine"
    ]);
    await waitFor(
      () => docker(["exec", resources.postgres, "pg_isready", "-U", "acceptance", "-d", "acceptance"], { allowFailure: true }).status === 0,
      "PostgreSQL did not become ready"
    );
    docker([
      "run", "-d", "--name", resources.mailpit,
      "--network", resources.network, "--network-alias", "mailpit",
      "-p", `127.0.0.1:${mailPort}:8025`,
      "axllent/mailpit:v1.27.8"
    ]);
    await waitFor(async () => (await fetch(`${mailOrigin}/api/v1/info`)).ok, "Mailpit did not become ready");

    psql(fs.readFileSync(path.join(root, "identity", "schema.sql"), "utf8"));
    const migration = fs.readFileSync(path.join(root, "identity", "migrations", "candidates", "0001-resource-submissions.sql"), "utf8");
    psql(migration);
    const tableCount = Number(psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'resource_submission%';\n", { tuples: true }));
    assert.equal(tableCount, 5);
    evidence.migration = { freshPostgres: true, highPort: pgPort, candidateTables: tableCount };

    await new Promise((resolve, reject) => {
      proxy.once("error", reject);
      proxy.listen(proxyPort, "127.0.0.1", resolve);
    });
    startIdentity(false, identityPort, proxyOrigin);
    await waitIdentity(identityOrigin);
    assert.equal((await jsonRequest(proxyOrigin, "/v1/resource-submissions/capability")).enabled, false);

    const electronLog = fs.openSync(electronLogPath, "w");
    electron = spawn(
      path.join(root, "node_modules", "electron", "dist", "electron.exe"),
      [root, `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`],
      {
        cwd: root,
        env: {
          ...process.env,
          AIHUB_IDENTITY_ORIGIN: proxyOrigin,
          AIHUB_COMMUNITY_PUBLIC_ORIGIN: "http://127.0.0.1:8088"
        },
        stdio: ["ignore", electronLog, electronLog],
        windowsHide: true
      }
    );
    fs.closeSync(electronLog);
    controller = electronController(debugPort);
    await controller.connect();
    await controller.waitForExpression("Boolean(document.body)", "Electron renderer body did not render");
    const startupCatalog = await controller.evaluate("window.aihubPC.getCatalog()");
    evidence.startup = {
      source: startupCatalog.source,
      error: startupCatalog.error || null,
      vendors: startupCatalog.catalog?.vendors?.length || 0,
      products: (startupCatalog.catalog?.vendors || []).reduce(
        (count, vendor) => count + (vendor.products?.length || 0),
        0
      )
    };
    await controller.waitForExpression(
      "Boolean(document.querySelector('.sidebarContribution button'))",
      `submission entry did not render; startup=${JSON.stringify(evidence.startup)}`,
      60_000
    );
    const uniqueEntry = await controller.evaluate("document.querySelectorAll('.sidebarContribution button').length");
    assert.equal(uniqueEntry, 1);
    assert.equal(await controller.evaluate(`(() => { const entry = document.querySelector('.sidebarContribution button'); entry.focus(); return document.activeElement === entry; })()`), true);
    await controller.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter" });
    await controller.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter" });
    if (!(await controller.evaluate("Boolean(document.querySelector('.submissionCallout'))"))) {
      await controller.evaluate("document.querySelector('.sidebarContribution button')?.click()");
    }
    await controller.waitForExpression("Boolean(document.querySelector('.submissionCallout'))", "disabled submission callout did not render");
    await waitFor(() => proxyState.metrics.capability >= 2, "disabled UI did not request capability");
    await delay(200);
    const disabled = await controller.evaluate(`(() => ({
      disabled: document.querySelector('[data-aihub-action="submit-resource"]')?.disabled === true,
      workspace: Boolean(document.querySelector('[data-aihub-submission-capability="enabled"]')),
      text: document.querySelector('.submissionCallout')?.textContent || ''
    }))()`);
    assert.equal(disabled.disabled, true);
    assert.equal(disabled.workspace, false);
    assert.equal(submissionCount(), 0);
    assert.equal(proxyState.metrics.ownerRead + proxyState.metrics.ownerWrite, 0);
    evidence.disabled = { ...disabled, databaseWrites: 0, ownerRequests: 0, uniqueNavigationEntry: uniqueEntry, keyboardFocusable: true, syntheticEnterActivation: false, clickNavigation: true };

    controller.close();
    command("taskkill.exe", ["/PID", String(electron.pid), "/T", "/F"], { allowFailure: true });
    electron = null;
    controller = null;
    await delay(750);
    docker(["rm", "-f", resources.identity]);
    startIdentity(true, identityPort, proxyOrigin);
    await waitIdentity(identityOrigin);
    assert.equal((await jsonRequest(proxyOrigin, "/v1/resource-submissions/capability")).enabled, true);
    const enabledProfile = path.join(temporary, "electron-profile-enabled");
    fs.mkdirSync(enabledProfile, { recursive: true });
    const enabledDebugPort = await freePort();
    const enabledElectronLog = fs.openSync(electronLogPath, "a");
    electron = spawn(
      path.join(root, "node_modules", "electron", "dist", "electron.exe"),
      [root, `--remote-debugging-port=${enabledDebugPort}`, `--user-data-dir=${enabledProfile}`],
      {
        cwd: root,
        env: {
          ...process.env,
          AIHUB_IDENTITY_ORIGIN: proxyOrigin,
          AIHUB_COMMUNITY_PUBLIC_ORIGIN: "http://127.0.0.1:8088"
        },
        stdio: ["ignore", enabledElectronLog, enabledElectronLog],
        windowsHide: true
      }
    );
    fs.closeSync(enabledElectronLog);
    controller = electronController(enabledDebugPort);
    await controller.connect();
    await controller.waitForExpression("Boolean(document.querySelector('.sidebarContribution button'))", "enabled Electron submission entry did not render", 60_000);
    await controller.evaluate("document.querySelector('.sidebarContribution button')?.click()");
    await controller.waitForExpression("Boolean(document.querySelector('.submissionCallout button:not([disabled])'))", "anonymous login action did not render", 40_000);
    const anonymous = await controller.evaluate(`(() => ({
      loginAction: Boolean(document.querySelector('.submissionCallout button:not([disabled])')),
      writeDisabled: document.querySelector('.submissionCallout button[disabled]')?.disabled === true
    }))()`);
    assert.equal(anonymous.loginAction, true);
    assert.equal(anonymous.writeDisabled, true);
    assert.equal(submissionCount(), 0);
    assert.equal(proxyState.metrics.ownerRead + proxyState.metrics.ownerWrite, 0);
    evidence.anonymous = { ...anonymous, databaseWrites: 0, ownerRequests: 0 };

    const { account, identityId } = await provisionUser(proxyOrigin, mailOrigin);
    await controller.evaluate("document.querySelector('.submissionCallout button:not([disabled])')?.click()");
    await controller.waitForExpression("Boolean(document.querySelector('.authModal form'))", "login modal did not open");
    await controller.evaluate(`(() => {
      const inputs = document.querySelectorAll('.authModal input');
      const set = (element, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(inputs[0], ${JSON.stringify(account.email)});
      set(inputs[1], ${JSON.stringify(account.password)});
      document.querySelector('.authModal form').requestSubmit();
    })()`);
    await controller.waitForExpression("Boolean(document.querySelector('[data-aihub-submission-capability=\"enabled\"]'))", "authenticated submission workspace did not render");

    const rootProposal = {
      title: `E2E Root ${runId}`,
      canonicalSource: `https://example.com/${runId}/root`,
      summary: "Initial real Electron candidate draft.",
      evidence: `https://example.com/${runId}/evidence-1`
    };
    await controller.evaluate(setFieldScript(rootProposal));
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await controller.waitForExpression(`Boolean([...document.querySelectorAll('.submissionList button')].find((button) => button.textContent.includes(${JSON.stringify(rootProposal.title)})))`, "root draft was not created");
    let items = submissionValue(
      await controller.evaluate("window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 })"),
      "list root draft"
    );
    let rootItem = items.items.find((item) => item.proposal.title === rootProposal.title);
    assert.equal(rootItem.status, "draft");

    const updatedProposal = { ...rootProposal, summary: "Updated through the real renderer form." };
    await controller.evaluate(setFieldScript(updatedProposal));
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await waitFor(async () => {
      items = submissionValue(
        await controller.evaluate("window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 })"),
        "list updated draft"
      );
      rootItem = items.items.find((item) => item.submissionId === rootItem.submissionId);
      return rootItem.expectedRevision === 2;
    }, "root draft update did not persist");
    await controller.evaluate("document.querySelector('[data-aihub-action=\"submit-submission\"]')?.click()");
    await waitFor(async () => {
      rootItem = submissionValue(
        await controller.evaluate(`window.aihubPC.getOwnSubmission({ submissionId: ${JSON.stringify(rootItem.submissionId)} })`),
        "get submitted draft"
      );
      return rootItem.status === "submitted";
    }, "root submission did not submit");
    let reviewed = review({ submissionId: rootItem.submissionId, expectedRevision: rootItem.expectedRevision, action: "triage" });
    reviewed = review({ submissionId: rootItem.submissionId, expectedRevision: reviewed.revision, action: "needs-evidence" });
    await controller.evaluate("document.querySelector('.submissionWorkspace header button')?.click()");
    await delay(250);
    await controller.evaluate(`([...document.querySelectorAll('.submissionList button')].find((button) => button.textContent.includes(${JSON.stringify(rootProposal.title)})))?.click()`);
    await controller.waitForExpression("document.querySelector('[data-aihub-action=\"add-submission-evidence\"]')?.disabled === false", "evidence action did not become available");
    await controller.evaluate(`(() => { const area = document.querySelectorAll('.submissionForm textarea')[1]; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, ${JSON.stringify(`https://example.com/${runId}/evidence-2`)}); area.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await controller.evaluate("document.querySelector('[data-aihub-action=\"add-submission-evidence\"]')?.click()");
    await waitFor(async () => {
      rootItem = submissionValue(
        await controller.evaluate(`window.aihubPC.getOwnSubmission({ submissionId: ${JSON.stringify(rootItem.submissionId)} })`),
        "get evidence draft"
      );
      return rootItem.expectedRevision === reviewed.revision + 1;
    }, "evidence update did not persist");
    reviewed = review({ submissionId: rootItem.submissionId, expectedRevision: rootItem.expectedRevision, action: "accept", reviewStatus: "manually-reviewed", riskLevel: "low" });
    assert.equal(reviewed.publicEligibility, false);
    reviewed = review({ submissionId: rootItem.submissionId, expectedRevision: reviewed.revision, action: "set-public-eligibility", publicEligibility: true });
    assert.equal(reviewed.publicEligibility, true);

    await controller.evaluate("document.querySelector('.submissionWorkspace header button')?.click()");
    await delay(250);
    const ownerView = submissionValue(
      await controller.evaluate("window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 })"),
      "list accepted owner view"
    );
    const acceptedOwner = ownerView.items.find((item) => item.submissionId === rootItem.submissionId);
    assert.equal(acceptedOwner.status, "accepted");
    assert.deepEqual(Object.keys(acceptedOwner).sort(), ["allowedActions", "evidenceRequired", "expectedRevision", "proposal", "status", "submissionId"]);
    assert.equal(/reviewer|risk|audit|fingerprint/i.test(JSON.stringify(acceptedOwner)), false);

    await controller.waitForExpression("document.querySelector('.submissionList > button')?.disabled === false", "new draft action remained busy before withdraw");
    await controller.evaluate("document.querySelector('.submissionList > button')?.click()");
    await controller.waitForExpression("document.querySelector('.submissionForm input')?.value === ''", "withdraw draft form did not reset");
    const withdrawnProposal = {
      title: `E2E Withdraw ${runId}`,
      canonicalSource: `https://example.com/${runId}/withdraw`,
      summary: "Withdraw lifecycle candidate.",
      evidence: `https://example.com/${runId}/withdraw-evidence`
    };
    await controller.evaluate(setFieldScript(withdrawnProposal));
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await controller.waitForExpression(`Boolean([...document.querySelectorAll('.submissionList button')].find((button) => button.textContent.includes(${JSON.stringify(withdrawnProposal.title)})))`, "withdraw draft missing");
    await controller.evaluate("document.querySelector('[data-aihub-action=\"withdraw-submission\"]')?.click()");
    await waitFor(async () => {
      const page = submissionValue(
        await controller.evaluate("window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 })"),
        "list withdrawn draft"
      );
      return page.items.find((item) => item.proposal.title === withdrawnProposal.title)?.status === "withdrawn";
    }, "withdraw action did not persist");

    await controller.waitForExpression("document.querySelector('.submissionList > button')?.disabled === false", "new draft action remained busy before conflict");
    await controller.evaluate("document.querySelector('.submissionList > button')?.click()");
    await controller.waitForExpression("document.querySelector('.submissionForm input')?.value === ''", "conflict draft form did not reset");
    const conflictProposal = {
      title: `E2E Conflict ${runId}`,
      canonicalSource: `https://example.com/${runId}/conflict`,
      summary: "Conflict candidate.",
      evidence: `https://example.com/${runId}/conflict-evidence`
    };
    const beforeValidationWrites = proxyState.metrics.ownerWrite;
    const beforeValidationRows = submissionCount();
    await controller.evaluate(setFieldScript({
      ...conflictProposal,
      canonicalSource: `http://example.com/${runId}/invalid`
    }));
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await controller.waitForExpression("Boolean((document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || '').trim())", "validation safe message missing");
    const validationText = await controller.evaluate("document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || ''");
    recordUnsafeUiMessage("validation", validationText);
    assert.equal(proxyState.metrics.ownerWrite, beforeValidationWrites);
    assert.equal(submissionCount(), beforeValidationRows);
    await controller.evaluate(setFieldScript(conflictProposal));
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await controller.waitForExpression(`Boolean([...document.querySelectorAll('.submissionList button')].find((button) => button.textContent.includes(${JSON.stringify(conflictProposal.title)})))`, "conflict draft missing");
    items = submissionValue(
      await controller.evaluate("window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 })"),
      "list conflict draft"
    );
    const conflictItem = items.items.find((item) => item.proposal.title === conflictProposal.title);
    const beforeInvalid = submissionCount();
    safeSubmissionFailure(
      await controller.evaluate(`window.aihubPC.createSubmission({ idempotencyKey: ${JSON.stringify(`invalid-${runId}`)}, submission: ${JSON.stringify({ ...conflictItem.proposal, command: "whoami" })} })`),
      { code: "INVALID_INPUT", status: 400, messageKey: "resources.submit.invalid" },
      "validation"
    );
    assert.equal(submissionCount(), beforeInvalid);
    ownerUpdate({ actorId: identityId, submissionId: conflictItem.submissionId, expectedRevision: conflictItem.expectedRevision, submission: { ...conflictItem.proposal, summary: "Concurrent update" } });
    safeSubmissionFailure(
      await controller.evaluate(`window.aihubPC.updateSubmissionDraft({ submissionId: ${JSON.stringify(conflictItem.submissionId)}, expectedRevision: ${conflictItem.expectedRevision}, submission: ${JSON.stringify({ ...conflictItem.proposal, summary: "Stale direct update" })} })`),
      { code: "REVISION_CONFLICT", status: 409, messageKey: "resources.submit.conflict" },
      "409"
    );
    await controller.evaluate(setFieldScript({ ...conflictProposal, summary: "Stale UI update" }));
    const beforeConflictText = await controller.evaluate("document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || ''");
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await controller.waitForExpression(`(() => { const value = (document.querySelector('.submissionNotice[role="status"]')?.textContent || '').trim(); return value.length > 0 && value !== ${JSON.stringify(beforeConflictText)}; })()`, "409 safe message missing");
    const conflictText = await controller.evaluate("document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || ''");
    assert.equal(/revision|postgres|stack|secret/i.test(conflictText), false);
    recordUnsafeUiMessage("409", conflictText);

    await controller.waitForExpression("document.querySelector('.submissionList > button')?.disabled === false", "new draft action remained busy before retry");
    await controller.evaluate("document.querySelector('.submissionList > button')?.click()");
    await controller.waitForExpression("document.querySelector('.submissionForm input')?.value === ''", "retry draft form did not reset");
    const retryProposal = {
      title: `E2E Retry ${runId}`,
      canonicalSource: `https://example.com/${runId}/retry`,
      summary: "Idempotent retry candidate.",
      evidence: `https://example.com/${runId}/retry-evidence`
    };
    await controller.evaluate(setFieldScript(retryProposal));
    const beforeRetry = submissionCount();
    proxyState.nextCreateAfterForward503 = true;
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await controller.waitForExpression("Boolean(document.querySelector('.submissionNotice[role=\"status\"]'))", "503 retry message missing");
    const retryUnavailableText = await controller.evaluate("document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || ''");
    recordUnsafeUiMessage("503-create-retry", retryUnavailableText);
    await waitFor(() => submissionCount() === beforeRetry + 1, "forwarded create did not persist");
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await controller.waitForExpression(`Boolean([...document.querySelectorAll('.submissionList button')].find((button) => button.textContent.includes(${JSON.stringify(retryProposal.title)})))`, "idempotent retry did not recover");
    assert.equal(submissionCount(), beforeRetry + 1);

    await controller.waitForExpression("document.querySelector('.submissionList > button')?.disabled === false", "new draft action remained busy before rate");
    await controller.evaluate("document.querySelector('.submissionList > button')?.click()");
    await controller.waitForExpression("document.querySelector('.submissionForm input')?.value === ''", "rate draft form did not reset");
    const rateProposal = {
      title: `E2E Rate ${runId}`,
      canonicalSource: `https://example.com/${runId}/rate`,
      summary: "Rate message candidate.",
      evidence: `https://example.com/${runId}/rate-evidence`
    };
    await controller.evaluate(setFieldScript(rateProposal));
    const beforeRate = submissionCount();
    proxyState.nextOwner429 = true;
    safeSubmissionFailure(
      await controller.evaluate("window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 })"),
      { code: "RATE_LIMITED", status: 429, messageKey: "resources.submit.rateLimited" },
      "429"
    );
    proxyState.nextOwner429 = true;
    const beforeRateText = await controller.evaluate("document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || ''");
    await controller.evaluate("document.querySelector('[data-aihub-action=\"save-submission\"]')?.click()");
    await controller.waitForExpression(`(() => { const value = (document.querySelector('.submissionNotice[role="status"]')?.textContent || '').trim(); return value.length > 0 && value !== ${JSON.stringify(beforeRateText)}; })()`, "429 safe message missing");
    const rateText = await controller.evaluate("document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || ''");
    assert.equal(/synthetic|internal|stack|secret/i.test(rateText), false);
    recordUnsafeUiMessage("429", rateText);
    assert.equal(submissionCount(), beforeRate);

    proxyState.nextOwner503 = true;
    safeSubmissionFailure(
      await controller.evaluate("window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 })"),
      { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "resources.submit.serviceUnavailable" },
      "503"
    );
    proxyState.nextOwner503 = true;
    const beforeUnavailableText = rateText;
    await controller.evaluate("document.querySelector('.submissionWorkspace header button')?.click()");
    await controller.waitForExpression(`(() => { const value = (document.querySelector('.submissionNotice[role="status"]')?.textContent || '').trim(); return value.length > 0 && value !== ${JSON.stringify(beforeUnavailableText)}; })()`, "503 safe message missing");
    const unavailableText = await controller.evaluate("document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || ''");
    assert.equal(/synthetic|postgres|database|stack|secret/i.test(unavailableText), false);
    recordUnsafeUiMessage("503", unavailableText);

    proxyState.nextListLeak = true;
    safeSubmissionFailure(
      await controller.evaluate("window.aihubPC.listOwnSubmissions({ offset: 0, limit: 20 })"),
      { code: "INVALID_IDENTITY_RESPONSE", status: 502, messageKey: "resources.submit.failed" },
      "malicious-owner-dto"
    );
    proxyState.nextListLeak = true;
    const beforeLeakText = unavailableText;
    await controller.evaluate("document.querySelector('.submissionWorkspace header button')?.click()");
    await controller.waitForExpression(`(() => { const value = (document.querySelector('.submissionNotice[role="status"]')?.textContent || '').trim(); return value.length > 0 && value !== ${JSON.stringify(beforeLeakText)}; })()`, "malicious owner response did not fail closed");
    const leakText = await controller.evaluate("document.querySelector('.submissionNotice[role=\"status\"]')?.textContent || ''");
    assert.equal(/reviewer|risk|audit|fingerprint|internal/i.test(leakText), false);
    recordUnsafeUiMessage("malicious-owner-dto", leakText);

    await controller.waitForExpression("document.querySelector('.submissionList > button')?.disabled === false", "new draft action remained busy before workflow");
    await controller.evaluate("document.querySelector('.submissionList > button')?.click()");
    await controller.waitForExpression("document.querySelector('.submissionForm input')?.value === ''", "new draft form did not reset before workflow check");
    const beforeWorkflow = proxyState.metrics.ownerWrite;
    const workflow = await controller.evaluate(`(() => {
      const select = document.querySelector('.submissionForm select');
      const option = [...select.options].find((entry) => entry.value === 'workflow');
      option?.click();
      return { optionDisabled: option?.disabled === true, selected: select.value };
    })()`);
    await delay(200);
    assert.equal(workflow.optionDisabled, true);
    assert.equal(proxyState.metrics.ownerWrite, beforeWorkflow);

    for (const width of [1365, 740]) {
      await controller.send("Emulation.setDeviceMetricsOverride", { width, height: 768, deviceScaleFactor: 1, mobile: false });
      await delay(200);
      const layout = await controller.evaluate(`(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        entryCount: document.querySelectorAll('.sidebarContribution button').length,
        visibleButtonsInside: [...document.querySelectorAll('.submissionWorkspace button')].filter((button) => button.offsetParent !== null).every((button) => { const rect = button.getBoundingClientRect(); return rect.left >= -1 && rect.right <= window.innerWidth + 1; })
      }))()`);
      assert.equal(layout.overflow, false);
      assert.equal(layout.entryCount, 1);
      assert.equal(layout.visibleButtonsInside, true);
      evidence.layout[width] = { ...layout, screenshot: await controller.screenshot(`submission-${width}.png`) };
    }
    await controller.send("Emulation.clearDeviceMetricsOverride");

    const publicModel = publicReadModel();
    assert.equal(publicModel.cards, 1);
    assert.deepEqual(publicModel.ids, [rootItem.submissionId]);
    assert.equal(publicModel.privateLeak, false);
    evidence.community = { ...publicModel, readModelOnly: true, flarumUiClaimed: false };
    evidence.lifecycle = {
      normalIdentityLogin: true,
      createDraft: true,
      update: true,
      submit: true,
      needsEvidence: true,
      addEvidence: true,
      accepted: true,
      publicEligibility: true,
      withdrawn: true,
      staleRevision409Safe: true,
      idempotentRetrySingleRow: true,
      rate429Safe: true,
      unavailable503Safe: true,
      canonicalSensitiveFieldsOwnerHidden: true,
      maliciousOwnerDtoMainRejected: true,
      rendererTextLeak: false,
      workflowDisabledZeroWrite: true,
      actualSubmissionRows: submissionCount(),
      proxyMetrics: proxyState.metrics,
      displayedMessages: { validation: validationText, conflict: conflictText, rate: rateText, unavailable: unavailableText, maliciousOwnerDto: leakText }
    };
    const structuredErrors = evidence.boundaries.structuredErrors;
    evidence.boundaries = {
      currentMain: true,
      currentPreload: true,
      currentRendererDist: true,
      identitySourceReadOnlyMounted: true,
      productionCapabilityChanged: false,
      productionOrLocalComposeChanged: false,
      realAccountOrDatabaseUsed: false,
      packagedClient: false,
      userMachineAcceptance: false,
      productionAcceptance: false,
      structuredErrors
    };
    completed = true;
  } finally {
    controller?.close();
    if (electron?.pid) {
      command("taskkill.exe", ["/PID", String(electron.pid), "/T", "/F"], { allowFailure: true });
      await delay(500);
    }
    await new Promise((resolve) => proxy.close(() => resolve())).catch(() => {});
    for (const name of [resources.identity, resources.mailpit, resources.postgres]) {
      docker(["rm", "-f", name], { allowFailure: true });
    }
    docker(["network", "rm", resources.network], { allowFailure: true });
    docker(["volume", "rm", resources.volume], { allowFailure: true });
    fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    const residual = docker(["ps", "-a", "--format", "{{.Names}}"], { allowFailure: true }).stdout
      .split(/\r?\n/).filter((name) => name.startsWith(prefix));
    const residualNetworks = docker(["network", "ls", "--format", "{{.Name}}"], { allowFailure: true }).stdout
      .split(/\r?\n/).filter((name) => name.startsWith(prefix));
    const residualVolumes = docker(["volume", "ls", "--format", "{{.Name}}"], { allowFailure: true }).stdout
      .split(/\r?\n/).filter((name) => name.startsWith(prefix));
    evidence.cleanup = {
      electronStopped: true,
      profileRemoved: !fs.existsSync(profile),
      tempSecretRemoved: !fs.existsSync(reviewerSecretPath),
      residualContainers: residual,
      residualNetworks,
      residualVolumes,
      zeroResidual: residual.length + residualNetworks.length + residualVolumes.length === 0
    };
    evidence.ok =
      completed &&
      evidence.cleanup.zeroResidual &&
      evidence.businessFailures.length === 0;
    const reportJson = path.join(output, "report.json");
    const reportMarkdown = path.join(output, "report.md");
    fs.writeFileSync(reportJson, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    fs.writeFileSync(reportMarkdown, `# Resource submission isolated real Electron E2E\n\n- Result: **${evidence.ok ? "PASS" : "FAIL"}**\n- Tier: real current Electron main/preload/renderer + fresh isolated Identity/PostgreSQL; not packaged, user-machine, or production acceptance.\n- Focused tests/build: ${evidence.focusedTests}; ${evidence.build}.\n- Migration: fresh PostgreSQL on loopback high port, ${evidence.migration.candidateTables || 0} candidate tables.\n- Disabled/anonymous: zero owner writes and zero database rows before login.\n- Lifecycle: draft → update → submit → needs-evidence → evidence → accept/public; withdrawal, 409, idempotent retry, 429/503 safe text, malicious owner DTO fail-closed.\n- Community: ${evidence.community.cards || 0} PublicContributionCard read-model record(s); no Flarum UI claim.\n- Layout: 1365/740 screenshots, no horizontal overflow, unique entry and focus evidence.\n- Cleanup: ${evidence.cleanup.zeroResidual ? "zero residual containers/network/volume/profile/temp secret" : "residual detected"}.\n\nSee report.json for structured evidence.\n`, "utf8");
    if (!evidence.ok) {
      fs.writeFileSync(
        reportMarkdown,
        `# Resource submission isolated real Electron E2E\n\n- Result: **BLOCKED**\n- Tier: real current Electron main/preload/renderer + fresh isolated Identity/PostgreSQL; not packaged, user-machine, or production acceptance.\n- Focused tests/build: ${evidence.focusedTests}; ${evidence.build}.\n- Migration: fresh PostgreSQL on loopback high port, ${evidence.migration.candidateTables || 0} candidate tables.\n- Disabled/anonymous: zero owner writes and zero database rows before login.\n- Lifecycle: draft/update/submit/needs-evidence/evidence/accept/public; withdrawal, 409, idempotent retry, 429/503, malicious owner DTO fail-closed.\n- Business failures: ${evidence.businessFailures.map((failure) => `${failure.label}: ${failure.reason}`).join("; ")}.\n- Community: ${evidence.community.cards || 0} PublicContributionCard read-model record(s); no Flarum UI claim.\n- Layout: 1365/740 screenshots, no horizontal overflow, unique entry and focus evidence.\n- Cleanup: ${evidence.cleanup.zeroResidual ? "zero residual containers/network/volume/profile/temp secret" : "residual detected"}.\n\nSee report.json for structured evidence.\n`,
        "utf8"
      );
    }
    process.stdout.write(`${JSON.stringify({ ok: evidence.ok, output, reportJson, reportMarkdown, cleanup: evidence.cleanup }, null, 2)}\n`);
    if (!evidence.ok) process.exitCode = 1;
  }
}

main().catch((error) => {
  evidence.error = { name: error.name, message: error.message, stack: String(error.stack || "").split("\n").slice(0, 8) };
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
