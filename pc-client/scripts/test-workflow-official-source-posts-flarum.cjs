"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const image = "zhenxing-ai/flarum:community-candidate-8b13962a36bf";

function run(command, args, { allowFailure = false, timeout = 300_000 } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout, windowsHide: true });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout || result.error?.message || "unknown").trim()}`);
  }
  return result;
}

function docker(args, options) {
  return run("docker", args, options);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(check, label, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (check()) return;
    await sleep(1_000);
  }
  throw new Error(`${label} did not become ready`);
}

async function insideContainer() {
  const {
    createLocalFlarumAdminRequest,
    ensureOfficialSourcePosts,
    POST_MARKERS,
    rollbackOfficialSourcePosts,
  } = require("/work/community/workflow-official-source-posts.cjs");
  const manifest = require("/work/community/workflow-official-source-posts-candidate.json");
  const apiKey = fs.readFileSync("/run/secrets/forum_api_key", "utf8");
  const rawRequestFlarum = createLocalFlarumAdminRequest({ apiKey });
  const requestFlarum = rawRequestFlarum;

  let first;
  try {
    first = await ensureOfficialSourcePosts({ manifest, requestFlarum });
  } catch (error) { throw error; }
  const second = await ensureOfficialSourcePosts({ manifest, requestFlarum });
  const counts = [];
  for (const post of manifest.posts) {
    const marker = POST_MARKERS[post.key];
    const response = await requestFlarum({
      method: "GET",
      path: `/api/discussions?filter%5Bq%5D=${encodeURIComponent(marker)}&page%5Blimit%5D=20`
    });
    counts.push(response.value?.data?.length ?? -1);
  }
  if (first.created.length !== 3 || second.created.length !== 0 || counts.some((count) => count !== 1)) {
    throw new Error("real Flarum idempotency check failed");
  }
  const ids = first.items.map((item) => ({ ...item }));
  const cleanup = await rollbackOfficialSourcePosts({ manifest, receipt: first.receipt, requestFlarum });
  const remaining = [];
  for (const post of manifest.posts) {
    const marker = POST_MARKERS[post.key];
    const response = await requestFlarum({
      method: "GET",
      path: `/api/discussions?filter%5Bq%5D=${encodeURIComponent(marker)}&page%5Blimit%5D=20`
    });
    remaining.push(response.value?.data?.length ?? -1);
  }
  if (cleanup.removed !== 3 || remaining.some((count) => count !== 0)) {
    throw new Error("real Flarum cleanup check failed");
  }
  process.stdout.write(JSON.stringify({ ok: true, ids, retryCounts: counts, cleanup }));
}

async function orchestrate() {
  const suffix = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  const prefix = `aihub-workflow-source-${suffix}`;
  const names = {
    database: `${prefix}-database`,
    community: `${prefix}-community`,
    network: `${prefix}-network`,
    dbVolume: `${prefix}-db`,
    configVolume: `${prefix}-config`,
    storageVolume: `${prefix}-storage`,
    assetsVolume: `${prefix}-assets`
  };
  const secretDir = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-source-"));
  const secrets = {
    db: crypto.randomBytes(32).toString("hex"),
    root: crypto.randomBytes(32).toString("hex"),
    admin: crypto.randomBytes(32).toString("hex"),
    api: crypto.randomBytes(32).toString("hex"),
    passwordToken: crypto.randomBytes(32).toString("hex")
  };
  for (const [name, value] of Object.entries(secrets)) {
    fs.writeFileSync(path.join(secretDir, name), value, { mode: 0o600 });
  }
  try {
    docker(["network", "create", names.network]);
    for (const volume of [names.dbVolume, names.configVolume, names.storageVolume, names.assetsVolume]) {
      docker(["volume", "create", volume]);
    }
    docker([
      "run", "-d", "--name", names.database, "--network", names.network,
      "--network-alias", "community-database",
      "-e", "MARIADB_DATABASE=community",
      "-e", "MARIADB_USER=community",
      "-e", `MARIADB_PASSWORD=${secrets.db}`,
      "-e", `MARIADB_ROOT_PASSWORD=${secrets.root}`,
      "-v", `${names.dbVolume}:/var/lib/mysql`,
      "mariadb:11.8"
    ]);
    await waitFor(() => docker([
      "exec", names.database, "mariadb-admin", "ping", "-h", "127.0.0.1",
      "-ucommunity", `-p${secrets.db}`, "--silent"
    ], { allowFailure: true, timeout: 10_000 }).status === 0, "MariaDB");

    const common = [
      "--network", names.network,
      "-e", "AIHUB_FORUM_DB_HOST=community-database",
      "-e", "AIHUB_FORUM_DB_PORT=3306",
      "-e", "AIHUB_FORUM_DB_NAME=community",
      "-e", "AIHUB_FORUM_DB_USER=community",
      "-e", "AIHUB_FORUM_DB_PASSWORD_FILE=/run/secrets/forum_db",
      "-e", "AIHUB_FORUM_ADMIN_USER=admin",
      "-e", "AIHUB_FORUM_ADMIN_EMAIL=admin@example.invalid",
      "-e", "AIHUB_FORUM_ADMIN_PASSWORD_FILE=/run/secrets/forum_admin",
      "-e", "AIHUB_FORUM_API_KEY_FILE=/run/secrets/forum_api_key",
      "-e", "AIHUB_FORUM_PASSWORD_TOKEN_FILE=/run/secrets/forum_password_token",
      "-e", "AIHUB_FORUM_PUBLIC_ORIGIN=http://community",
      "-v", `${path.join(secretDir, "db")}:/run/secrets/forum_db:ro`,
      "-v", `${path.join(secretDir, "admin")}:/run/secrets/forum_admin:ro`,
      "-v", `${path.join(secretDir, "api")}:/run/secrets/forum_api_key:ro`,
      "-v", `${path.join(secretDir, "passwordToken")}:/run/secrets/forum_password_token:ro`,
      "-v", `${names.configVolume}:/var/lib/flarum`,
      "-v", `${names.storageVolume}:/var/www/html/storage`,
      "-v", `${names.assetsVolume}:/var/www/html/public/assets`
    ];
    docker(["run", "--rm", "--name", `${prefix}-migrate`, ...common, "-e", "AIHUB_FLARUM_MODE=migrate", image]);
    docker([
      "run", "-d", "--name", names.community, "--network-alias", "community",
      ...common,
      "-e", "AIHUB_FLARUM_MODE=runtime",
      "-e", "AIHUB_IDENTITY_INTERNAL_URL=http://identity:4180",
      "-e", "AIHUB_FORUM_INTERNAL_ORIGIN=http://127.0.0.1",
      image
    ]);
    await waitFor(() => docker([
      "exec", names.community, "php", "-r",
      "exit(@file_get_contents('http://127.0.0.1/api/discussions?page[limit]=1')===false?1:0);"
    ], { allowFailure: true, timeout: 10_000 }).status === 0, "Flarum");

    const inside = docker([
      "run", "--rm", "--network", `container:${names.community}`,
      "-v", `${root}:/work:ro`,
      "-v", `${path.join(secretDir, "api")}:/run/secrets/forum_api_key:ro`,
      "node:22-alpine", "node", "/work/scripts/test-workflow-official-source-posts-flarum.cjs", "--inside"
    ], { timeout: 120_000 });
    const result = JSON.parse(inside.stdout);
    process.stdout.write(`${JSON.stringify({
      ...result,
      candidateOnly: true,
      image,
      productionTouched: false
    }, null, 2)}\n`);
  } finally {
    docker(["rm", "-f", names.community, names.database], { allowFailure: true });
    docker(["network", "rm", names.network], { allowFailure: true });
    for (const volume of [names.dbVolume, names.configVolume, names.storageVolume, names.assetsVolume]) {
      docker(["volume", "rm", volume], { allowFailure: true });
    }
    fs.rmSync(secretDir, { recursive: true, force: true });
  }
}

(process.argv.includes("--inside") ? insideContainer() : orchestrate()).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
