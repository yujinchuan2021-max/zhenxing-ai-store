"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const net = require("node:net");

const root = path.resolve(__dirname, "..");
const basePrefix = "aihub-community-sso-phasea-20260812";
const image = process.argv[2];
if (!/^zhenxing-ai\/flarum:[A-Za-z0-9_.-]+$/.test(image || "")) throw new Error("fixed Flarum image is required");
const variant = process.argv[3];
if (!/^(red|green)$/.test(variant || "")) throw new Error("variant must be red or green");
const prefix = `${basePrefix}-${variant}`;

function run(command, args, { allowFailure = false, timeout = 300_000 } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, timeout });
  if (!allowFailure && (result.error || result.status !== 0)) {
    const diagnostic = (result.stderr || result.stdout || result.error?.message || "").trim().slice(-2000);
    throw new Error(`${command} failed (${result.status ?? "error"}): ${diagnostic}`);
  }
  return result;
}
const docker = (args, options) => run("docker", args, options);
const curl = (args, options) => run("curl.exe", ["--noproxy", "*", ...args], options);
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(check, label, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (check()) return;
    await sleep(1000);
  }
  throw new Error(`${label} unavailable`);
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(String(port)));
    });
  });
}

function listNames(kind) {
  const args = kind === "container" ? ["ps", "-a", "--format", "{{.Names}}"] :
    kind === "network" ? ["network", "ls", "--format", "{{.Name}}"] :
      ["volume", "ls", "--format", "{{.Name}}"];
  return docker(args).stdout.trim().split(/\r?\n/).filter(Boolean);
}

function parseCookieJar(filename, hostname) {
  const rows = fs.readFileSync(filename, "utf8").split(/\r?\n/)
    .filter((line) => line && (!line.startsWith("#") || line.startsWith("#HttpOnly_")))
    .map((line) => line.split("\t"));
  const row = rows.find((fields) => fields[5] === "flarum_token");
  if (!row || row.length < 7) return { cookiePresent: false, secure: false, domainMatch: false };
  const domain = row[0].replace(/^#HttpOnly_/, "");
  const cookieHost = domain.replace(/^\./, "");
  return {
    cookiePresent: row[6].length > 0,
    secure: row[3] === "TRUE",
    domainMatch: hostname === cookieHost || hostname.endsWith(`.${cookieHost}`)
  };
}

function secretFile(directory, name, value) {
  const filename = path.join(directory, name);
  fs.writeFileSync(filename, value, { mode: 0o600 });
  return filename;
}

async function main() {
  const existing = ["container", "network", "volume"].flatMap((kind) =>
    listNames(kind).filter((name) => name.startsWith(prefix)).map((name) => `${kind}:${name}`));
  if (existing.length) throw new Error("phase-a namespace is not empty");

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const secrets = {
    db: secretFile(temp, "db", crypto.randomBytes(32).toString("hex")),
    root: secretFile(temp, "root", crypto.randomBytes(32).toString("hex")),
    admin: secretFile(temp, "admin", crypto.randomBytes(32).toString("hex")),
    api: secretFile(temp, "api", crypto.randomBytes(32).toString("hex")),
    password: secretFile(temp, "password", crypto.randomBytes(32).toString("hex")),
    internal: secretFile(temp, "internal", crypto.randomBytes(32).toString("hex"))
  };
  const createdContainers = [];
  const createdVolumes = [];
  let createdNetwork = false;
  const names = {
    network: `${prefix}-network`, identity: `${prefix}-identity`, caddy: `${prefix}-caddy`,
    httpsDb: `${prefix}-https-db`, httpsCommunity: `${prefix}-https-community`,
    httpDb: `${prefix}-http-db`, httpCommunity: `${prefix}-http-community`
  };
  const volumeNames = ["https-db", "https-config", "https-storage", "https-assets", "http-db", "http-config", "http-storage", "http-assets"]
    .map((name) => `${prefix}-${name}`);
  const report = { ok: false, variant, image, https: null, http: null, electron: null, replayStatus: null, cleanup: false };

  function createVolume(name) { docker(["volume", "create", name]); createdVolumes.push(name); }
  function startContainer(args, name) { docker(["run", "-d", "--name", name, ...args]); createdContainers.push(name); }
  function common(dbName, publicOrigin, configVolume, storageVolume, assetsVolume) {
    return [
      "--network", names.network,
      "-e", `AIHUB_FORUM_PUBLIC_ORIGIN=${publicOrigin}`,
      "-e", "AIHUB_FORUM_INTERNAL_ORIGIN=http://127.0.0.1",
      "-e", `AIHUB_FORUM_DB_HOST=${dbName}`,
      "-e", "AIHUB_FORUM_DB_PORT=3306", "-e", "AIHUB_FORUM_DB_NAME=forum", "-e", "AIHUB_FORUM_DB_USER=forum",
      "-e", "AIHUB_FORUM_DB_PASSWORD_FILE=/run/secrets/db", "-e", "AIHUB_FORUM_ADMIN_USER=phasea_admin",
      "-e", "AIHUB_FORUM_ADMIN_EMAIL=phasea-admin@example.invalid", "-e", "AIHUB_FORUM_ADMIN_PASSWORD_FILE=/run/secrets/admin",
      "-e", "AIHUB_FORUM_API_KEY_FILE=/run/secrets/api", "-e", "AIHUB_FORUM_PASSWORD_TOKEN_FILE=/run/secrets/password",
      "-e", "AIHUB_IDENTITY_INTERNAL_URL=http://identity:3000", "-e", "AIHUB_COMMUNITY_INTERNAL_SECRET_FILE=/run/secrets/internal",
      "-v", `${secrets.db}:/run/secrets/db:ro`, "-v", `${secrets.admin}:/run/secrets/admin:ro`,
      "-v", `${secrets.api}:/run/secrets/api:ro`, "-v", `${secrets.password}:/run/secrets/password:ro`,
      "-v", `${secrets.internal}:/run/secrets/internal:ro`,
      "-v", `${configVolume}:/var/lib/flarum`, "-v", `${storageVolume}:/var/www/html/storage`, "-v", `${assetsVolume}:/var/www/html/public/assets`
    ];
  }

  try {
    docker(["network", "create", names.network]); createdNetwork = true;
    volumeNames.forEach(createVolume);
    startContainer([
      "--network", names.network, "--network-alias", "identity", "--read-only", "--tmpfs", "/tmp",
      "-v", `${path.join(root, "scripts/fixtures/community-sso-phasea-identity.cjs")}:/app/server.cjs:ro`,
      "-v", `${secrets.internal}:/run/secrets/community-internal:ro`, "node:22-alpine", "node", "/app/server.cjs"
    ], names.identity);
    startContainer([
      "--network", names.network, "-p", "127.0.0.1::443", "--tmpfs", "/data", "--tmpfs", "/config",
      "-v", `${path.join(root, "scripts/fixtures/community-sso-phasea.Caddyfile")}:/etc/caddy/Caddyfile:ro`, "caddy:2.10-alpine"
    ], names.caddy);
    const httpsPort = docker(["port", names.caddy, "443/tcp"]).stdout.trim().match(/:(\d+)$/)?.[1];
    if (!httpsPort) throw new Error("HTTPS port unavailable");
    const httpsOrigin = `https://community.phasea.test:${httpsPort}`;

    for (const [dbName, dbVolume] of [[names.httpsDb, volumeNames[0]], [names.httpDb, volumeNames[4]]]) {
      startContainer([
        "--network", names.network, "--network-alias", dbName,
        "-e", "MARIADB_DATABASE=forum", "-e", "MARIADB_USER=forum",
        "-e", "MARIADB_PASSWORD_FILE=/run/secrets/db", "-e", "MARIADB_ROOT_PASSWORD_FILE=/run/secrets/root",
        "-v", `${secrets.db}:/run/secrets/db:ro`, "-v", `${secrets.root}:/run/secrets/root:ro`,
        "-v", `${dbVolume}:/var/lib/mysql`, "mariadb:11.8"
      ], dbName);
      await waitFor(() => docker(["exec", dbName, "healthcheck.sh", "--connect", "--innodb_initialized"], { allowFailure: true, timeout: 10_000 }).status === 0, dbName);
    }

    docker(["run", "--rm", "--name", `${prefix}-https-migrate`, ...common(names.httpsDb, httpsOrigin, volumeNames[1], volumeNames[2], volumeNames[3]), "-e", "AIHUB_FLARUM_MODE=migrate", image]);
    startContainer([...common(names.httpsDb, httpsOrigin, volumeNames[1], volumeNames[2], volumeNames[3]), "--network-alias", "https-community", "-e", "AIHUB_FLARUM_MODE=runtime", image], names.httpsCommunity);
    await waitFor(() => curl(["-k", "--silent", "--output", "NUL", "--resolve", `community.phasea.test:${httpsPort}:127.0.0.1`, `${httpsOrigin}/`], { allowFailure: true, timeout: 10_000 }).status === 0, "HTTPS Flarum");

    const jar = path.join(temp, "https.cookies");
    const body = path.join(temp, "https.body");
    const ticket = crypto.randomBytes(32).toString("base64url");
    const chain = curl([
      "-k", "--silent", "--show-error", "--location", "--max-redirs", "5",
      "--resolve", `community.phasea.test:${httpsPort}:127.0.0.1`, "--cookie-jar", jar, "--cookie", jar,
      "--output", body, "--write-out", "%{http_code}|%{num_redirects}|%{url_effective}",
      `${httpsOrigin}/aihub-sso.php?ticket=${ticket}`
    ]);
    const [finalStatus, redirects, finalUrl] = chain.stdout.trim().split("|");
    const cookie = parseCookieJar(jar, "community.phasea.test");
    const loggedIn = fs.readFileSync(body, "utf8").includes("phasea_user");
    fs.rmSync(body, { force: true });
    const replay = curl([
      "-k", "--silent", "--output", "NUL", "--resolve", `community.phasea.test:${httpsPort}:127.0.0.1`,
      "--write-out", "%{http_code}", `${httpsOrigin}/aihub-sso.php?ticket=${ticket}`
    ]);
    const statusTicket = crypto.randomBytes(32).toString("base64url");
    const status303 = curl([
      "-k", "--silent", "--output", "NUL", "--max-redirs", "0", "--resolve", `community.phasea.test:${httpsPort}:127.0.0.1`,
      "--write-out", "%{http_code}", `${httpsOrigin}/aihub-sso.php?ticket=${statusTicket}`
    ]);
    report.https = { finalStatus, redirectCount: Number(redirects), finalOrigin: new URL(finalUrl).origin === httpsOrigin, finalPath: new URL(finalUrl).pathname, loggedIn, ...cookie, status303: status303.stdout.trim() === "303" };
    report.replayStatus = replay.stdout.trim();

    const electronInput = path.join(temp, "electron-input.json");
    fs.writeFileSync(electronInput, JSON.stringify({
      origin: httpsOrigin,
      profilePath: path.join(temp, "electron-profile"),
      tickets: [crypto.randomBytes(32).toString("base64url"), crypto.randomBytes(32).toString("base64url")]
    }), { mode: 0o600 });
    const electron = spawnSync(
      path.join(root, "node_modules/electron/dist/electron.exe"),
      [path.join(root, "scripts/fixtures/community-sso-phasea-electron.cjs"), electronInput],
      { encoding: "utf8", windowsHide: true, timeout: 60_000, env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" } }
    );
    fs.rmSync(electronInput, { force: true });
    if (electron.error || electron.status !== 0) throw new Error("Electron SSO probe failed");
    report.electron = JSON.parse(electron.stdout);

    const httpPort = await reservePort();
    const httpOrigin = `http://127.0.0.1:${httpPort}`;
    docker(["run", "--rm", "--name", `${prefix}-http-migrate`, ...common(names.httpDb, httpOrigin, volumeNames[5], volumeNames[6], volumeNames[7]), "-e", "AIHUB_FLARUM_MODE=migrate", image]);
    startContainer([...common(names.httpDb, httpOrigin, volumeNames[5], volumeNames[6], volumeNames[7]), "-p", `127.0.0.1:${httpPort}:80`, "-e", "AIHUB_FLARUM_MODE=runtime", image], names.httpCommunity);
    await waitFor(() => curl(["--silent", "--output", "NUL", `${httpOrigin}/`], { allowFailure: true, timeout: 10_000 }).status === 0, "HTTP Flarum");
    const httpJar = path.join(temp, "http.cookies");
    const httpBody = path.join(temp, "http.body");
    const httpTicket = crypto.randomBytes(32).toString("base64url");
    const httpChain = curl([
      "--silent", "--show-error", "--location", "--max-redirs", "5", "--cookie-jar", httpJar, "--cookie", httpJar,
      "--output", httpBody, "--write-out", "%{http_code}|%{num_redirects}|%{url_effective}",
      `${httpOrigin}/aihub-sso.php?ticket=${httpTicket}`
    ]);
    const [httpStatus, httpRedirects, httpFinal] = httpChain.stdout.trim().split("|");
    const httpCookie = parseCookieJar(httpJar, "127.0.0.1");
    const httpLoggedIn = fs.readFileSync(httpBody, "utf8").includes("phasea_user");
    fs.rmSync(httpBody, { force: true });
    report.http = { finalStatus: httpStatus, redirectCount: Number(httpRedirects), finalOrigin: new URL(httpFinal).origin === httpOrigin, finalPath: new URL(httpFinal).pathname, loggedIn: httpLoggedIn, ...httpCookie };

    const pass = report.https.finalStatus === "200" && report.https.redirectCount === 2 && report.https.finalOrigin && report.https.finalPath === "/" &&
      report.https.loggedIn && report.https.cookiePresent && report.https.secure && report.https.domainMatch && report.https.status303 &&
      report.electron.partitionMatch && report.electron.first.finalOrigin && report.electron.first.finalPath === "/" &&
      report.electron.first.redirectPathsAllowed && !report.electron.first.tooManyRedirects && !report.electron.first.loadFailed &&
      report.electron.first.loggedIn && report.electron.first.cookiePresent && report.electron.first.secure && report.electron.first.domainMatch &&
      report.electron.second.finalOrigin && report.electron.second.finalPath === "/" && report.electron.second.redirectPathsAllowed &&
      !report.electron.second.tooManyRedirects && !report.electron.second.loadFailed && report.electron.second.loggedIn &&
      report.electron.second.cookiePresent && report.electron.second.secure && report.electron.second.domainMatch &&
      report.electron.afterLogout && report.electron.afterRevoke &&
      report.replayStatus === "401" && report.http.finalStatus === "200" && report.http.redirectCount === 2 &&
      report.http.finalOrigin && report.http.finalPath === "/" && report.http.loggedIn && report.http.cookiePresent && !report.http.secure && report.http.domainMatch;
    report.ok = pass;
  } finally {
    for (const name of [...createdContainers].reverse()) {
      if (!name.startsWith(prefix)) continue;
      const inspect = docker(["inspect", "-f", "{{.State.Running}}", name], { allowFailure: true });
      if (inspect.status === 0 && inspect.stdout.trim() === "true") docker(["stop", "--time", "10", name]);
      const stopped = docker(["inspect", "-f", "{{.State.Running}}", name], { allowFailure: true });
      if (stopped.status === 0 && stopped.stdout.trim() !== "false") throw new Error(`owned container did not stop: ${name}`);
      docker(["rm", "-f", name], { allowFailure: true });
    }
    const remainingOwned = listNames("container").filter((name) => name.startsWith(prefix));
    if (remainingOwned.length) throw new Error("owned containers remain");
    for (const name of [...createdVolumes].reverse()) {
      if (!name.startsWith(prefix)) continue;
      docker(["volume", "rm", name]);
    }
    if (createdNetwork) docker(["network", "rm", names.network]);
    fs.rmSync(temp, { recursive: true, force: true });
    report.cleanup = true;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
