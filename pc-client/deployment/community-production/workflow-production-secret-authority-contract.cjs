"use strict";

const path = require("node:path");

const BASELINE_SECRET_CONSUMERS = Object.freeze({
  identity_db_password: Object.freeze(["identityDatabase", "identity"]),
  forum_db_password: Object.freeze(["communityDatabase", "community"]),
  forum_db_root_password: Object.freeze(["communityDatabase"]),
  forum_admin_password: Object.freeze(["community"]),
  forum_api_key: Object.freeze(["community"]),
  forum_password_token: Object.freeze(["community"]),
  community_internal: Object.freeze(["identity", "community"]),
  community_management: Object.freeze(["admin", "community"]),
  community_cms_gateway: Object.freeze(["admin"]),
  workflow_review_secret: Object.freeze([])
});
const TARGET_SECRET_CONSUMERS = Object.freeze({
  ...BASELINE_SECRET_CONSUMERS,
  workflow_review_secret: Object.freeze(["identity"])
});
const SECRET_CONSUMERS_BY_PROFILE = Object.freeze({
  baseline: BASELINE_SECRET_CONSUMERS,
  target: TARGET_SECRET_CONSUMERS
});

function invalid() { throw new Error("secret authority is invalid"); }
function validSecretBytes(name, bytes) {
  if (!Buffer.isBuffer(bytes)) return false;
  if (name === "forum_api_key") return bytes.length === 65 && bytes[64] === 10 && bytes.subarray(0, 64).every((byte) => byte >= 0x21 && byte <= 0x7e && byte !== 0x3b);
  if (name === "community_cms_gateway") return bytes.length === 64 && bytes.every((byte) => (byte >= 0x30 && byte <= 0x39) || (byte >= 0x61 && byte <= 0x66));
  const maximum = ["forum_db_password", "forum_db_root_password", "forum_admin_password", "forum_password_token"].includes(name) ? 4096 : 512;
  const body = bytes.at(-1) === 10 ? bytes.subarray(0, -1) : bytes;
  return body.length >= 32 && body.length <= maximum && bytes.length <= (maximum === 4096 ? 4096 : 513) && body.every((byte) => byte >= 0x21 && byte <= 0x7e && byte !== 0x3b);
}
function secretMountFor(inspect, destination) {
  const mounts = (inspect?.Mounts || []).filter((mount) => mount.Destination === destination);
  if (mounts.length !== 1 || mounts[0].Type !== "bind" || mounts[0].RW !== false || typeof mounts[0].Source !== "string") invalid();
  return mounts[0];
}
function validatePublishedCatalogMount({ inspect, fsImpl }) {
  const mounts = (inspect?.Mounts || []).filter((mount) => mount.Destination === "/app/admin/published");
  if (mounts.length !== 1 || mounts[0].Type !== "bind" || mounts[0].RW !== true || typeof mounts[0].Source !== "string" || !mounts[0].Source.startsWith("/")) invalid();
  const source = mounts[0].Source; const canonical = fsImpl.realpathSync(source); const stat = fsImpl.lstatSync(source);
  if (canonical !== source || !stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 1000 || stat.gid !== 1000 || (stat.mode & 0o777) !== 0o755 || !Number.isSafeInteger(stat.nlink) || stat.nlink < 2) invalid();
  return source;
}
function validateSecretSnapshot({ inspectAll, fsImpl, environment, profile }) {
  const expectedByName = SECRET_CONSUMERS_BY_PROFILE[profile];
  const commonRoot = environment?.AIHUB_SECRET_DIR;
  const workflowRoot = environment?.AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR;
  if (!expectedByName || typeof commonRoot !== "string" || !commonRoot.startsWith("/") ||
      typeof workflowRoot !== "string" || !workflowRoot.startsWith("/") || commonRoot === workflowRoot) invalid();
  let metadataCount = 0; let consumerCount = 0; const sources = {};
  for (const [name, expectedConsumers] of Object.entries(expectedByName)) {
    const actualConsumers = []; let source = null;
    for (const [service, inspect] of Object.entries(inspectAll)) {
      const mounts = (inspect?.Mounts || []).filter((mount) => mount.Destination === `/run/secrets/${name}`);
      if (mounts.length > 1) invalid();
      if (mounts.length === 1) { if (mounts[0].Type !== "bind" || mounts[0].RW !== false || typeof mounts[0].Source !== "string") invalid(); actualConsumers.push(service); if (source !== null && source !== mounts[0].Source) invalid(); source = mounts[0].Source; }
    }
    if (JSON.stringify(actualConsumers.sort()) !== JSON.stringify([...expectedConsumers].sort())) invalid();
    consumerCount += actualConsumers.length;
    if (expectedConsumers.length) sources[name] = source;
  }
  const roots = new Set(Object.entries(sources).map(([name, source]) => {
    const expectedRoot = name === "workflow_review_secret" ? workflowRoot : commonRoot;
    if (source !== `${expectedRoot}/${name}` || path.posix.dirname(source) !== expectedRoot) invalid();
    return expectedRoot;
  }));
  if (roots.size !== (profile === "target" ? 2 : 1)) invalid();
  for (const authorityRoot of roots) {
    const root = fsImpl.realpathSync(authorityRoot); const rootStat = fsImpl.lstatSync(authorityRoot);
    if (root !== authorityRoot || !rootStat.isDirectory() || rootStat.isSymbolicLink() || rootStat.uid !== 1000 || rootStat.gid !== 1000 || (rootStat.mode & 0o777) !== 0o700) invalid();
  }
  for (const [name, source] of Object.entries(sources)) {
    const authorityRoot = name === "workflow_review_secret" ? workflowRoot : commonRoot;
    const canonical = fsImpl.realpathSync(source); const stat = fsImpl.lstatSync(source);
    if (canonical !== `${authorityRoot}/${name}` || source !== canonical || !stat.isFile() || stat.isSymbolicLink() || stat.uid !== 1000 || stat.gid !== 1000 || (stat.mode & 0o777) !== 0o600 || stat.nlink !== 1 || !validSecretBytes(name, fsImpl.readFileSync(source))) invalid();
    metadataCount += 1;
  }
  const caddyMounts = inspectAll.caddy?.Mounts || [];
  if (!(caddyMounts.filter((mount) => mount.Destination === "/run/aihub-caddy-secret" && mount.Type === "volume" && mount.RW === false).length === 1 && !caddyMounts.some((mount) => mount.Destination.startsWith("/run/secrets/")))) invalid();
  return Object.freeze({ metadataCount, consumerCount, consumersExact: true, caddyDerived: true });
}

module.exports = {
  BASELINE_SECRET_CONSUMERS,
  TARGET_SECRET_CONSUMERS,
  SECRET_CONSUMERS_BY_PROFILE,
  validSecretBytes,
  secretMountFor,
  validatePublishedCatalogMount,
  validateSecretSnapshot
};
