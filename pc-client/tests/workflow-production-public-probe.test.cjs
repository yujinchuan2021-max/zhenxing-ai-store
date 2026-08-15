"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const test = require("node:test");

const wrapperPath = path.resolve(
  __dirname,
  "..",
  "deployment",
  "community-production",
  "workflow-official-bootstrap-production-wrapper.cjs"
);
const caddyfilePath = path.resolve(__dirname, "..", "deployment", "community-production", "Caddyfile");
const PUBLIC_HOST = "community.workflow.invalid";
const PUBLIC_LIST_PATH = "/v1/community/workflow-store/public/list?limit=50";
const LEGACY_HTTP_PROBE = String.raw`const http=require('http');let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const p=JSON.parse(input);const r=http.get({host:'caddy',port:80,path:p.path,headers:{host:p.publicHost},agent:false},x=>{const b=[];x.on('data',v=>b.push(v));x.on('end',()=>{let body=null;try{body=JSON.parse(Buffer.concat(b).toString('utf8'))}catch{}process.stdout.write(JSON.stringify({status:x.statusCode,body}))})});r.on('error',()=>process.exit(2))});`;

function opensslPath() {
  const candidates = process.platform === "win32"
    ? ["C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe", "C:\\Program Files\\Git\\usr\\bin\\openssl.exe"]
    : ["openssl"];
  return candidates.find((candidate) => candidate === "openssl" || fs.existsSync(candidate));
}

function createCertificate(directory, name, hostname) {
  const key = path.join(directory, `${name}.key.pem`);
  const certificate = path.join(directory, `${name}.cert.pem`);
  const result = spawnSync(opensslPath(), [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "1",
    "-keyout", key, "-out", certificate, "-subj", `/CN=${hostname}`,
    "-addext", `subjectAltName=DNS:${hostname}`,
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,digitalSignature,keyEncipherment",
    "-addext", "extendedKeyUsage=serverAuth"
  ], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return {
    key: fs.readFileSync(key),
    cert: fs.readFileSync(certificate),
    certificate
  };
}

function writeCaddyDnsPreload(directory) {
  const preload = path.join(directory, "caddy-dns-preload.cjs");
  fs.writeFileSync(preload, `
const dns = require("node:dns");
const original = dns.lookup;
dns.lookup = function lookup(hostname, options, callback) {
  if (hostname !== "caddy") return original.apply(this, arguments);
  if (typeof options === "function") callback = options, options = {};
  const answer = { address: "127.0.0.1", family: 4 };
  process.nextTick(() => options && options.all
    ? callback(null, [answer])
    : callback(null, answer.address, answer.family));
};
`, { encoding: "utf8", mode: 0o600 });
  return preload;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function runProbe(program, input, { preload, trustedCertificate } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", program], {
      env: {
        ...process.env,
        ...(preload ? { NODE_OPTIONS: `--require=${preload}` } : {}),
        ...(trustedCertificate ? { NODE_EXTRA_CA_CERTS: trustedCertificate } : {})
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

test("production public probe replaces the HTTP 308 path with fixed verified HTTPS SNI and Host", async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-production-public-probe-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const trusted = createCertificate(temporary, "trusted", PUBLIC_HOST);
  const untrusted = createCertificate(temporary, "untrusted", PUBLIC_HOST);
  const preload = writeCaddyDnsPreload(temporary);
  const wrapper = require(wrapperPath);

  assert.equal(typeof wrapper.REQUEST_PROGRAM, "string");
  assert.equal(typeof wrapper.exactPublicListResponse, "function");
  assert.match(wrapper.REQUEST_PROGRAM, /require\('https'\)/);
  assert.match(wrapper.REQUEST_PROGRAM, /host:'caddy',port:443/);
  assert.match(wrapper.REQUEST_PROGRAM, /servername:p\.publicHost/);
  assert.match(wrapper.REQUEST_PROGRAM, /headers:\{host:p\.publicHost\}/);
  assert.match(wrapper.REQUEST_PROGRAM, /agent:false/);
  assert.doesNotMatch(wrapper.REQUEST_PROGRAM, /rejectUnauthorized|https?:\/\//);

  const httpServer = http.createServer((_request, response) => {
    response.writeHead(308, { Location: `https://${PUBLIC_HOST}${PUBLIC_LIST_PATH}` });
    response.end();
  });
  await listen(httpServer, 80);
  const legacy = await runProbe(LEGACY_HTTP_PROBE, {
    target: "caddy", path: PUBLIC_LIST_PATH, publicHost: PUBLIC_HOST
  }, { preload });
  await close(httpServer);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.equal(JSON.parse(legacy.stdout).status, 308);

  let observedHost = null;
  let observedServername = null;
  const httpsServer = https.createServer(trusted, (request, response) => {
    observedHost = request.headers.host;
    observedServername = request.socket.servername;
    if (request.url === "/redirect") {
      response.writeHead(308, { Location: `https://${PUBLIC_HOST}${PUBLIC_LIST_PATH}` });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ items: [{}, {}, {}] }));
  });
  await listen(httpsServer, 443);
  const secure = await runProbe(wrapper.REQUEST_PROGRAM, {
    target: "caddy", path: PUBLIC_LIST_PATH, publicHost: PUBLIC_HOST
  }, { preload, trustedCertificate: trusted.certificate });
  assert.equal(secure.status, 0, secure.stderr);
  const secureResponse = JSON.parse(secure.stdout);
  assert.equal(wrapper.exactPublicListResponse(secureResponse), true);
  assert.equal(observedHost, PUBLIC_HOST);
  assert.equal(observedServername, PUBLIC_HOST);

  const redirect = await runProbe(wrapper.REQUEST_PROGRAM, {
    target: "caddy", path: "/redirect", publicHost: PUBLIC_HOST
  }, { preload, trustedCertificate: trusted.certificate });
  assert.equal(redirect.status, 0, redirect.stderr);
  assert.equal(JSON.parse(redirect.stdout).status, 308);
  assert.equal(wrapper.exactPublicListResponse(JSON.parse(redirect.stdout)), false);

  const wrongHost = await runProbe(wrapper.REQUEST_PROGRAM, {
    target: "caddy", path: PUBLIC_LIST_PATH, publicHost: "other.workflow.invalid"
  }, { preload, trustedCertificate: trusted.certificate });
  assert.equal(wrongHost.status, 2);
  await close(httpsServer);

  const untrustedServer = https.createServer(untrusted, (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ items: [{}, {}, {}] }));
  });
  await listen(untrustedServer, 443);
  const badCertificate = await runProbe(wrapper.REQUEST_PROGRAM, {
    target: "caddy", path: PUBLIC_LIST_PATH, publicHost: PUBLIC_HOST
  }, { preload, trustedCertificate: trusted.certificate });
  assert.equal(badCertificate.status, 2);
  await close(untrustedServer);
});

test("public probe summary exposes only status classes and counts", () => {
  const wrapper = require(wrapperPath);
  assert.deepEqual(wrapper.publicProbeSummary(
    { status: 200, body: { items: [{}, {}, {}] }, private: "do-not-copy" },
    { status: 308, body: null, headers: { location: "https://private.invalid/value" } }
  ), {
    identityStatusClass: "2xx",
    identityItemCount: 3,
    caddyStatusClass: "3xx",
    caddyItemCount: null
  });
});

test("official bootstrap waits for exact trusted Caddy HTTPS before writing workflows", () => {
  const wrapper = require(wrapperPath);
  assert.equal(typeof wrapper.waitForPublicTls, "function");

  let time = 0;
  const calls = [];
  const responses = [
    new Error("certificate pending"),
    { status: 308, body: null },
    { status: 200, body: { status: "ok" } }
  ];
  const result = wrapper.waitForPublicTls((target, endpoint) => {
    calls.push([target, endpoint]);
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  }, {
    deadlineMs: 5_000,
    intervalMs: 250,
    now: () => time,
    sleep: (milliseconds) => { time += milliseconds; }
  });

  assert.deepEqual(result, { attemptCount: 3 });
  assert.deepEqual(calls, [
    ["caddy", "/health"],
    ["caddy", "/health"],
    ["caddy", "/health"]
  ]);

  const source = fs.readFileSync(wrapperPath, "utf8");
  assert.ok(source.indexOf('stage = "public-tls"') < source.indexOf('stage = "bootstrap"'));
  assert.ok(source.indexOf("waitForPublicTls(probe)") < source.indexOf('stage = "bootstrap"'));
});

test("official bootstrap TLS gate is bounded and rejects every non-200 response", () => {
  const wrapper = require(wrapperPath);
  let time = 0;
  let attempts = 0;
  assert.throws(() => wrapper.waitForPublicTls(() => {
    attempts += 1;
    return { status: attempts % 2 === 0 ? 503 : 308, body: null };
  }, {
    deadlineMs: 1_000,
    intervalMs: 250,
    now: () => time,
    sleep: (milliseconds) => { time += milliseconds; }
  }), /public TLS is unavailable/);
  assert.equal(attempts, 4);
});

test("production Caddy uses the fixed ZeroSSL ACME endpoint without a caller credential", () => {
  const source = fs.readFileSync(caddyfilePath, "utf8");
  assert.match(source, /^\{\r?\n\s*email admin@zhenxingai\.com\r?\n\s*acme_ca https:\/\/acme\.zerossl\.com\/v2\/DV90\r?\n\}\r?\n/);
  assert.equal((source.match(/acme_ca /g) || []).length, 1);
  assert.doesNotMatch(source, /acme_eab|issuer\s+zerossl|tls\s+internal|api[_-]?key/i);
});
