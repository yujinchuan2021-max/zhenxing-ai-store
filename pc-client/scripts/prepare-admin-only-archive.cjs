#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const shortDigest = '54f084a49b74';
const sourceDigest = '54f084a49b745882146ced2def8f70c3eb44dd47e03d6a308e9ab5daef879616';
const image = `zhenxing-ai/admin:0.1.40-src-${shortDigest}`;
const imageId = 'sha256:452dadd2868e610edc49d0a0854a4618b98bb80e7ca594475afd6defb1e941a7';
const archiveName = `release-review-admin-only-0.1.40-src-${shortDigest}`;
const output = path.join(root, archiveName);
const archive = `${output}.tar`;
const deploymentFiles = [
  'Dockerfile',
  'compose.server.yaml',
  'Caddyfile',
  'README.md',
  'final-switch-v2.sh',
];
const sourceManifest = path.join(root, 'output', 'admin-only-snapshots', sourceDigest, 'source-manifest.json');
const runtimeStore = path.join(root, 'admin', 'published', 'catalog-store');
const forbiddenPath = /(?:^|[\\/])(?:\.env(?:\.|$)|catalog-signing-private\.pem|identity|community)(?:[\\/]|$)|\.(?:exe|msi|msix|zip)$/i;
const secretPatterns = [
  /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/i,
  /AIHUB_CATALOG_SIGNING_PRIVATE_KEY\s*=/i,
  /\b(?:password|token|cookie)\s*[:=]\s*["'][^"']{1,}/i,
];

function fail(message) {
  throw new Error(message);
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  const handle = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let read;
    do {
      read = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (read) hash.update(buffer.subarray(0, read));
    } while (read);
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex');
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function relativeEntries(directory) {
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) entries.push(...relativeEntries(full));
    else if (entry.isFile()) {
      entries.push({
        path: path.relative(output, full).replace(/\\/g, '/'),
        bytes: fs.statSync(full).size,
        sha256: sha256(full),
      });
    } else fail(`unsupported archive entry: ${full}`);
  }
  return entries;
}

function assertNoForbiddenPaths(directory) {
  for (const entry of relativeEntries(directory)) {
    if (forbiddenPath.test(entry.path)) fail(`forbidden archive path: ${entry.path}`);
  }
}

function assertNoSecrets(directory) {
  const findings = [];
  for (const entry of relativeEntries(directory)) {
    if (entry.bytes > 8 * 1024 * 1024) continue;
    const text = fs.readFileSync(path.join(output, entry.path), 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) findings.push({ path: entry.path, pattern: String(pattern) });
    }
  }
  if (findings.length) fail(`secret scan failed: ${JSON.stringify(findings)}`);
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

function main() {
  if (process.argv[2] === '--discard-failed-output') {
    if (!fs.existsSync(output) || fs.existsSync(archive) || !fs.existsSync(path.join(output, 'runtime', 'catalog-store', 'catalog-signing-private.pem'))) {
      fail('refusing to discard an unexpected archive target');
    }
    fs.rmSync(output, { recursive: true, force: false });
    process.stdout.write(`discarded failed generated archive directory: ${output}\n`);
    return;
  }
  if (fs.existsSync(output) || fs.existsSync(archive)) fail(`archive target already exists: ${output}`);
  if (!fs.existsSync(sourceManifest) || !fs.existsSync(runtimeStore)) fail('required snapshot or published runtime state is missing');

  const inspect = JSON.parse(run('docker', ['image', 'inspect', image]))[0];
  if (inspect.Id !== imageId) fail(`unexpected image ID: ${inspect.Id}`);
  if (inspect.Config.Labels['com.aihub.source-content-sha256'] !== sourceDigest) fail('image content digest label mismatch');
  if (inspect.Config.Labels['com.aihub.runtime-contract'] !== 'admin-only-v1') fail('image runtime contract mismatch');

  const state = JSON.parse(fs.readFileSync(path.join(runtimeStore, 'state.json'), 'utf8'));
  const v1 = { version: state.activeCatalogVersion, releaseId: state.activeReleaseId };
  const v2 = state.channels?.v2;
  if (state.draft?.revision !== 89 || v1.version !== 72 || v2?.activeCatalogVersion !== 6) fail('published runtime precondition drift');

  fs.mkdirSync(output, { recursive: false });
  for (const file of deploymentFiles) {
    copyFile(path.join(root, 'deployment', 'admin-only', file), path.join(output, 'deployment', 'admin-only', file));
  }
  copyFile(sourceManifest, path.join(output, 'source', 'source-manifest.json'));
  fs.cpSync(runtimeStore, path.join(output, 'runtime', 'catalog-store'), {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: (source) => path.basename(source) !== 'catalog-signing-private.pem',
  });
  fs.mkdirSync(path.join(output, 'image'));
  run('docker', ['save', '--output', path.join(output, 'image', 'admin-image.tar'), image]);

  writeJson(path.join(output, 'METADATA.json'), {
    schemaVersion: 1,
    purpose: 'local archive and redeployment package for the read-only Admin-only delivery',
    image: { reference: image, id: imageId, sourceContentDigest: sourceDigest },
    runtime: {
      draftRevision: state.draft.revision,
      v1: { activeCatalogVersion: v1.version, activeReleaseId: v1.releaseId },
      v2: { activeCatalogVersion: v2.activeCatalogVersion, activeReleaseId: v2.activeReleaseId },
    },
    exclusions: ['catalog private keys', 'passwords/tokens/cookies', 'PC installers', 'Identity/Community data', 'user data', 'server backups'],
    validation: ['image identity and labels', 'runtime preconditions', 'path allowlist', 'secret scan', 'tar extraction and file hash verification'],
  });
  fs.writeFileSync(path.join(output, 'REDEPLOYMENT.md'), `# Admin-only archive\n\nThis package is a local archive of the already-built read-only Admin image and its Admin/Caddy deployment contract. Load \`image/admin-image.tar\`, then follow \`deployment/admin-only/README.md\` and \`deployment/admin-only/final-switch-v2.sh\`. Do not build on the server.\n\nThe included runtime catalog store contains previously signed release data only; it contains no signing private key and does not authorize draft writes or publishing.\n\nRollback: keep the prior image and the server's verified published-state backup, stop only Admin/Caddy, restore the prior image and unchanged published-state directory, then repeat the documented endpoint checks.\n`, { encoding: 'utf8', flag: 'wx' });

  assertNoForbiddenPaths(output);
  assertNoSecrets(output);
  const entries = relativeEntries(output);
  writeJson(path.join(output, 'ARCHIVE-MANIFEST.json'), { schemaVersion: 1, entries, secretScan: { result: 'pass', patterns: secretPatterns.map(String) } });

  run('tar', ['-cf', archive, '-C', root, archiveName]);
  const listed = new Set(run('tar', ['-tf', archive]).split(/\r?\n/).filter(Boolean).map((line) => line.replace(/\\/g, '/')));
  for (const entry of entries) {
    if (!listed.has(`${archiveName}/${entry.path}`)) fail(`archive missing entry: ${entry.path}`);
  }
  if (!listed.has(`${archiveName}/ARCHIVE-MANIFEST.json`)) fail('archive missing manifest');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aihub-admin-archive-'));
  try {
    run('tar', ['-xf', archive, '-C', temp]);
    const extracted = path.join(temp, archiveName);
    const manifest = JSON.parse(fs.readFileSync(path.join(extracted, 'ARCHIVE-MANIFEST.json'), 'utf8'));
    for (const entry of manifest.entries) {
      const file = path.join(extracted, entry.path);
      if (!fs.existsSync(file) || fs.statSync(file).size !== entry.bytes || sha256(file) !== entry.sha256) fail(`extraction verification failed: ${entry.path}`);
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }

  const result = {
    output,
    archive,
    archiveBytes: fs.statSync(archive).size,
    archiveSha256: sha256(archive),
    fileCount: entries.length + 1,
    imageBytes: fs.statSync(path.join(output, 'image', 'admin-image.tar')).size,
    runtime: { draftRevision: state.draft.revision, v1ReleaseId: v1.releaseId, v2ReleaseId: v2.activeReleaseId },
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();
