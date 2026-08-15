"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");
const backupScript = path.join(deployment, "backup.sh");
const restoreScript = path.join(deployment, "restore-drill.sh");
const bash = process.env.AIHUB_BASH || (process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash");
const nonce = crypto.randomBytes(6).toString("hex");
const project = `aihubbackup${nonce}`;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-backup-restore-"));
const compose = path.join(temporary, "compose.yaml");
const forumInit = path.join(temporary, "forum-init.sql");
const identitySecret = path.join(temporary, "identity-db-password");
const forumSecret = path.join(temporary, "forum-db-password");
const backupRoot = path.join(temporary, "backups");
const unsafeBackupRoot = path.join(temporary, "unsafe-backups");
const output = path.join(root, "output", `community-production-backup-restore-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${nonce}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  return { status: result.status, output: `${result.stdout || ""}${result.stderr || ""}` };
}

function must(result, description) {
  assert.equal(result.status, 0, `${description}: ${result.output.slice(0, 2000)}`);
}

function bashPath(nativePath) {
  if (process.platform !== "win32") return nativePath;
  const escaped = nativePath.replaceAll("'", "'\\''");
  const result = run(bash, ["-lc", `cygpath -u '${escaped}'`]);
  must(result, "convert path for Git Bash");
  return result.output.trim();
}

function yamlPath(nativePath) {
  return nativePath.replaceAll("\\", "/");
}

function refreshChecksum(directory, name) {
  const file = path.join(directory, name);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const checksumFile = path.join(directory, "SHA256SUMS");
  const lines = fs.readFileSync(checksumFile, "utf8").trimEnd().split("\n");
  const index = lines.findIndex((line) => line.trimEnd().endsWith(name));
  assert.notEqual(index, -1, `${name} must already be covered by SHA256SUMS`);
  lines[index] = `${digest}${lines[index].slice(64).trimEnd()}`;
  fs.writeFileSync(checksumFile, `${lines.join("\n")}\n`);
}

function appendRegularArchiveMember(directory, member, value) {
  const source = path.join(directory, "append-source");
  fs.mkdirSync(path.dirname(path.join(source, member)), { recursive: true });
  fs.writeFileSync(path.join(source, member), value);
  const appended = run("docker", [
    "run", "--rm", "--network", "none", "-v", `${directory}:/backup`, "-v", `${source}:/source:ro`,
    "node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd",
    "sh", "-ec", `mkdir -p /work; tar -xf /backup/community-files.tar -C /work; mkdir -p /work/$(dirname '${member}'); cp /source/${member} /work/${member}; tar -C /work -cf /backup/community-files.tar var/lib/flarum var/www/html/storage var/www/html/public/assets ${member}`,
  ]);
  must(appended, `append checksum-valid archive member ${member}`);
  refreshChecksum(directory, "community-files.tar");
}

function composeRun(args) {
  return run("docker", ["compose", "-p", project, "-f", compose, ...args]);
}

try {
  fs.writeFileSync(identitySecret, "isolated-identity-backup-password-0123456789", { mode: 0o600 });
  fs.writeFileSync(forumSecret, "isolated-forum-backup-password-0123456789", { mode: 0o600 });
  fs.writeFileSync(forumInit, [
    "CREATE TABLE users (id INT UNSIGNED PRIMARY KEY, username VARCHAR(100) NOT NULL);",
    "CREATE TABLE discussions (id INT UNSIGNED PRIMARY KEY, title VARCHAR(255) NOT NULL);",
    "CREATE TABLE posts (id INT UNSIGNED PRIMARY KEY, discussion_id INT UNSIGNED NOT NULL, content TEXT NOT NULL);",
    "CREATE TABLE aihub_identity_links (identity_id CHAR(36) PRIMARY KEY, flarum_user_id INT UNSIGNED NOT NULL);",
    "INSERT INTO users VALUES (1, 'isolated-user');",
    "INSERT INTO discussions VALUES (1, 'isolated-discussion');",
    "INSERT INTO posts VALUES (1, 1, 'isolated-post');",
    "INSERT INTO aihub_identity_links VALUES ('11111111-1111-4111-8111-111111111111', 1);",
    "",
  ].join("\n"));
  fs.mkdirSync(backupRoot);
  fs.mkdirSync(unsafeBackupRoot);
  fs.writeFileSync(compose, `services:
  identity-database:
    image: postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193
    environment:
      POSTGRES_DB: aihub
      POSTGRES_USER: aihub
      POSTGRES_PASSWORD_FILE: /run/secrets/identity_db_password
    volumes:
      - identity_database:/var/lib/postgresql/data
      - "${yamlPath(path.join(root, "identity", "schema.sql"))}:/docker-entrypoint-initdb.d/001-schema.sql:ro"
    secrets: [identity_db_password]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U aihub -d aihub"]
      interval: 1s
      timeout: 3s
      retries: 30
  community-database:
    image: mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4
    environment:
      MARIADB_DATABASE: aihub_forum
      MARIADB_USER: aihub_forum
      MARIADB_PASSWORD_FILE: /run/secrets/forum_db_password
      MARIADB_ROOT_PASSWORD: isolated-root-password-not-a-production-secret
    volumes:
      - community_database:/var/lib/mysql
      - "${yamlPath(forumInit)}:/docker-entrypoint-initdb.d/001-fixture.sql:ro"
    secrets: [forum_db_password]
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 1s
      timeout: 3s
      retries: 60
  community:
    image: node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd
    command:
      - sh
      - -ec
      - |
        mkdir -p /var/lib/flarum /var/www/html/storage/formatter /var/www/html/public/assets/avatars
        printf fixture-config > /var/lib/flarum/config.php
        printf fixture-storage > /var/www/html/storage/fixture.txt
        printf generated-renderer > /var/www/html/storage/formatter/Renderer_fixture.php
        printf fixture-asset > /var/www/html/public/assets/fixture.txt
        printf fixture-avatar > /var/www/html/public/assets/avatars/fixture.png
        node -e 'const fs=require("node:fs");setInterval(()=>fs.writeFileSync("/var/www/html/storage/formatter/Renderer_fixture.php","generated-renderer"),5)' &
        exec sleep 600
    volumes:
      - community_config:/var/lib/flarum
      - community_storage:/var/www/html/storage
      - community_assets:/var/www/html/public/assets
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 1s
      timeout: 3s
      retries: 10
secrets:
  identity_db_password:
    file: "${yamlPath(identitySecret)}"
  forum_db_password:
    file: "${yamlPath(forumSecret)}"
volumes:
  identity_database:
  community_database:
  community_config:
  community_storage:
  community_assets:
`);

  must(composeRun(["up", "-d", "--wait"]), "start isolated backup source services");
  const backup = run(bash, [bashPath(backupScript), yamlPath(compose), bashPath(backupRoot)], {
    env: { ...process.env, COMPOSE_PROJECT_NAME: project, MSYS_NO_PATHCONV: "1" },
  });
  must(backup, "create and verify backup");

  const backupDirectories = fs.readdirSync(backupRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.equal(backupDirectories.length, 1, "backup must create exactly one final directory");
  const finalBackup = path.join(backupRoot, backupDirectories[0].name);
  for (const name of ["identity.pgdump", "community.sql", "community-files.tar", "COMMUNITY-FILES.json", "IMAGES.json", "SHA256SUMS"]) {
    assert.ok(fs.statSync(path.join(finalBackup, name)).size > 0, `${name} must be non-empty`);
  }
  const archiveEntries = run("tar", ["-tf", path.join(finalBackup, "community-files.tar")]);
  must(archiveEntries, "list Flarum files archive");
  assert.match(archiveEntries.output, /^var\/lib\/flarum\/config\.php$/m);
  assert.match(archiveEntries.output, /^var\/www\/html\/storage\/fixture\.txt$/m);
  assert.match(archiveEntries.output, /^var\/www\/html\/public\/assets\/fixture\.txt$/m);
  assert.match(archiveEntries.output, /^var\/www\/html\/public\/assets\/avatars\/fixture\.png$/m);
  assert.doesNotMatch(archiveEntries.output, /^var\/www\/html\/storage\/formatter(?:\/|$)/m);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(finalBackup, "COMMUNITY-FILES.json"), "utf8")), {
    schemaVersion: 1,
    archiveRoots: ["var/lib/flarum", "var/www/html/storage", "var/www/html/public/assets"],
    excludedGeneratedPaths: ["var/www/html/storage/formatter"],
  });

  const restore = run(bash, [bashPath(restoreScript), bashPath(finalBackup)], {
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  must(restore, "restore backup into isolated temporary databases");
  assert.match(restore.output, /restore drill passed in isolated temporary databases/);

  const tamperedContract = path.join(temporary, "tampered-contract");
  fs.cpSync(finalBackup, tamperedContract, { recursive: true });
  fs.writeFileSync(path.join(tamperedContract, "COMMUNITY-FILES.json"), "{\"schemaVersion\":1,\"archiveRoots\":[],\"excludedGeneratedPaths\":[]}\n");
  refreshChecksum(tamperedContract, "COMMUNITY-FILES.json");
  const contractRestore = run(bash, [bashPath(restoreScript), bashPath(tamperedContract)], {
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  assert.notEqual(contractRestore.status, 0, "restore must reject a checksum-valid but different files contract");
  assert.match(contractRestore.output, /community files backup contract does not match this release/);

  const unexpectedMemberArchive = path.join(temporary, "unexpected-member-archive");
  fs.cpSync(finalBackup, unexpectedMemberArchive, { recursive: true });
  appendRegularArchiveMember(unexpectedMemberArchive, "tmp/extra.txt", "unexpected");
  const unexpectedMemberRestore = run(bash, [bashPath(restoreScript), bashPath(unexpectedMemberArchive)], {
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  assert.notEqual(unexpectedMemberRestore.status, 0, "restore must reject a checksum-valid unexpected archive member before extraction");
  assert.match(unexpectedMemberRestore.output, /community files archive contains an unexpected member/);

  const duplicateMemberArchive = path.join(temporary, "duplicate-member-archive");
  fs.cpSync(finalBackup, duplicateMemberArchive, { recursive: true });
  appendRegularArchiveMember(duplicateMemberArchive, "var/lib/flarum/config.php", "duplicate");
  const duplicateMemberRestore = run(bash, [bashPath(restoreScript), bashPath(duplicateMemberArchive)], {
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  assert.notEqual(duplicateMemberRestore.status, 0, "restore must reject a checksum-valid duplicate archive member before extraction");
  assert.match(duplicateMemberRestore.output, /community files archive contains a duplicate member/);

  const unsafeArchive = path.join(temporary, "unsafe-archive");
  fs.cpSync(finalBackup, unsafeArchive, { recursive: true });
  const injectUnsafeArchive = run("docker", [
    "run", "--rm", "--network", "none", "-v", `${unsafeArchive}:/backup`,
    "node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd",
    "sh", "-ec",
    "mkdir -p /work; tar -xf /backup/community-files.tar -C /work; ln -s /var/lib/flarum/config.php /work/var/www/html/storage/unsafe-link; tar -C /work -cf /backup/community-files.tar var/lib/flarum var/www/html/storage var/www/html/public/assets",
  ]);
  must(injectUnsafeArchive, "inject a checksum-valid unsafe archive entry");
  refreshChecksum(unsafeArchive, "community-files.tar");
  const unsafeRestore = run(bash, [bashPath(restoreScript), bashPath(unsafeArchive)], {
    env: { ...process.env, MSYS_NO_PATHCONV: "1" },
  });
  assert.notEqual(unsafeRestore.status, 0, "restore must reject symlinks in the files archive");
  assert.match(unsafeRestore.output, /community files archive contains an unsafe entry type/);

  const formatterProbeProgram = Buffer.from([
    'require "/var/www/html/vendor/autoload.php";',
    'mkdir("/var/www/html/storage/formatter", 0770, true);',
    '$configurator = new s9e\\TextFormatter\\Configurator;',
    '$configurator->rendering->setEngine("PHP");',
    '$configurator->rendering->getEngine()->cacheDir = "/var/www/html/storage/formatter";',
    '$configurator->BBCodes->addFromRepository("B");',
    '$configurator->finalize();',
    '$files = glob("/var/www/html/storage/formatter/Renderer_*.php");',
    'exit(count($files) === 1 && filesize($files[0]) > 0 ? 0 : 1);',
  ].join("\n")).toString("base64");
  const formatterProbe = run("docker", [
    "run", "--rm", "--network", "none", "--tmpfs", "/var/www/html/storage:rw,noexec,nosuid,size=32m",
    "--entrypoint", "php", "zhenxing-ai/flarum:community-candidate-8b13962a36bf",
    "-r", `eval(base64_decode('${formatterProbeProgram}'));`,
  ]);
  must(formatterProbe, "regenerate a renderer with the frozen Flarum image from an empty formatter cache");

  must(composeRun(["exec", "-T", "community", "sh", "-ec", "ln -s /var/www/html/public/assets/fixture.txt /var/www/html/storage/unsafe-link"]), "create an unsafe storage symlink");
  const unsafeBackup = run(bash, [bashPath(backupScript), yamlPath(compose), bashPath(unsafeBackupRoot)], {
    env: { ...process.env, COMPOSE_PROJECT_NAME: project, MSYS_NO_PATHCONV: "1" },
  });
  assert.notEqual(unsafeBackup.status, 0, "backup must fail closed when a durable root contains a symlink");
  assert.match(unsafeBackup.output, /community file roots must not contain symlinks/);
  assert.deepEqual(fs.readdirSync(unsafeBackupRoot), [], "failed backup must remove its incomplete output");

  fs.mkdirSync(output, { recursive: true });
  const report = {
    schemaVersion: 1,
    ok: true,
    isolatedProject: true,
    backupShaVerified: true,
    postgresRestoreVerified: true,
    mariaDbRestoreVerified: true,
    communityFilesRestoreVerified: true,
    generatedFormatterMutationExcluded: true,
    tamperedContractRejected: true,
    unexpectedArchiveMemberRejected: true,
    duplicateArchiveMemberRejected: true,
    unsafeArchiveEntryRejected: true,
    unsafeSourceSymlinkRejected: true,
    frozenFlarumFormatterRegenerated: true,
    sourceServices: ["identity-database", "community-database", "community"],
    cleanupScope: project,
  };
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ...report, report: path.join(output, "report.json") })}\n`);
} finally {
  composeRun(["down", "--remove-orphans", "--volumes"]);
  fs.rmSync(temporary, { recursive: true, force: true });
}
