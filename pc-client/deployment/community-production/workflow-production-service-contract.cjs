"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const {
  adminImageArtifact,
  identityImageArtifact,
  flarumImageArtifact,
  oldAdminImageArtifact,
  rollbackIdentityImageArtifact
} = require("./workflow-production-release-bundle.cjs");

const PROJECT = "zhenxing-community-production";
function imageOf(artifact) {
  return Object.freeze({ tag: artifact.image, id: artifact.imageId, source: artifact.sourceDigest, revision: artifact.sourceRevision, release: artifact.releaseLabel, user: artifact.user });
}
const DATA_MOUNTS = Object.freeze({
  admin: Object.freeze([
    Object.freeze({ destination: "/app/admin/data", sourceEnv: "AIHUB_ADMIN_DATA_DIR", type: "bind", rw: true }),
    Object.freeze({ destination: "/app/admin/published", sourceEnv: "AIHUB_ADMIN_PUBLISHED_DIR", type: "bind", rw: true }),
    Object.freeze({ destination: "/app/output", sourceEnv: "AIHUB_ADMIN_OUTPUT_DIR", type: "bind", rw: true })
  ]),
  identityDatabase: Object.freeze([Object.freeze({ destination: "/var/lib/postgresql/data", sourceEnv: "AIHUB_IDENTITY_DB_DIR", type: "bind", rw: true })]),
  identity: Object.freeze([]),
  communityDatabase: Object.freeze([Object.freeze({ destination: "/var/lib/mysql", sourceEnv: "AIHUB_COMMUNITY_DB_DIR", type: "bind", rw: true })]),
  community: Object.freeze([
    Object.freeze({ destination: "/var/lib/flarum", sourceEnv: "AIHUB_COMMUNITY_CONFIG_DIR", type: "bind", rw: true }),
    Object.freeze({ destination: "/var/www/html/storage", sourceEnv: "AIHUB_COMMUNITY_STORAGE_DIR", type: "bind", rw: true }),
    Object.freeze({ destination: "/var/www/html/public/assets", sourceEnv: "AIHUB_COMMUNITY_ASSETS_DIR", type: "bind", rw: true })
  ]),
  caddy: Object.freeze([
    Object.freeze({ destination: "/etc/caddy/Caddyfile", releaseFile: "Caddyfile", mode: 0o644, type: "bind", rw: false }),
    Object.freeze({ destination: "/usr/local/bin/aihub-caddy-entrypoint", releaseFile: "caddy-entrypoint.sh", mode: 0o755, type: "bind", rw: false }),
    Object.freeze({ destination: "/data", sourceEnv: "AIHUB_CADDY_DATA_VOLUME", type: "volume", rw: true }),
    Object.freeze({ destination: "/config", sourceEnv: "AIHUB_CADDY_CONFIG_VOLUME", type: "volume", rw: true }),
    Object.freeze({ destination: "/run/aihub-caddy-secret", sourceEnv: "AIHUB_CADDY_CMS_SECRET_VOLUME", type: "volume", rw: false })
  ])
});
const SERVICES = Object.freeze([
  Object.freeze({ key: "admin", composeService: "admin", containerName: "zhenxing-community-production-admin-1", baseline: imageOf(oldAdminImageArtifact), target: imageOf(adminImageArtifact) }),
  Object.freeze({ key: "identityDatabase", composeService: "identity-database", containerName: "zhenxing-community-production-identity-database-1", baseline: Object.freeze({ tag: "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193" }), target: Object.freeze({ tag: "postgres:17-alpine@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193" }) }),
  Object.freeze({ key: "identity", composeService: "identity", containerName: "zhenxing-community-production-identity-1", baseline: imageOf(rollbackIdentityImageArtifact), target: imageOf(identityImageArtifact) }),
  Object.freeze({ key: "communityDatabase", composeService: "community-database", containerName: "zhenxing-community-production-community-database-1", baseline: Object.freeze({ tag: "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4" }), target: Object.freeze({ tag: "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4" }) }),
  Object.freeze({ key: "community", composeService: "community", containerName: "zhenxing-community-production-community-1", baseline: imageOf(flarumImageArtifact), target: imageOf(flarumImageArtifact) }),
  Object.freeze({ key: "caddy", composeService: "caddy", containerName: "zhenxing-community-production-caddy-1", baseline: Object.freeze({ tag: "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d" }), target: Object.freeze({ tag: "caddy:2.10-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d" }) })
]);

function fail() { throw new Error("production service contract is invalid"); }
function validateRetainedReleaseFile(source, candidate, expectedMode, fsImpl) {
  const releaseRoot = path.posix.dirname(path.posix.dirname(path.posix.dirname(source)));
  if (path.posix.dirname(releaseRoot) !== "/opt/zhenxing-ai/releases" ||
      !/^community-production-[A-Za-z0-9][A-Za-z0-9-]{5,127}$/.test(path.posix.basename(releaseRoot)) ||
      path.posix.relative(releaseRoot, source) !== `deployment/community-production/${path.posix.basename(source)}`) fail();
  let sourceBytes; let candidateBytes;
  try {
    for (const value of [source, candidate]) {
      const stat = fsImpl.lstatSync(value);
      if (fsImpl.realpathSync(value) !== value || !stat.isFile() || stat.isSymbolicLink() || stat.uid !== 1000 || stat.gid !== 1000 ||
          stat.nlink !== 1 || (stat.mode & 0o777) !== expectedMode) fail();
    }
    sourceBytes = fsImpl.readFileSync(source);
    candidateBytes = fsImpl.readFileSync(candidate);
  } catch { fail(); }
  const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
  if (!Buffer.isBuffer(sourceBytes) || !Buffer.isBuffer(candidateBytes) || sourceBytes.length !== candidateBytes.length || digest(sourceBytes) !== digest(candidateBytes)) fail();
}

function contractFor(profile) {
  if (profile !== "baseline" && profile !== "target") fail();
  return SERVICES.map((service) => Object.freeze({ ...service, image: service[profile] }));
}

function validateProductionServices(inspectAll, profile) {
  const reject = () => { throw new Error("production service contract is invalid"); };
  if (profile !== "baseline" && profile !== "target") reject();
  const contract = SERVICES.map((service) => Object.freeze({ ...service, image: service[profile] }));
  if (!inspectAll || Object.keys(inspectAll).sort().join("|") !== contract.map((item) => item.key).sort().join("|")) reject();
  for (const service of contract) {
    const inspect = inspectAll[service.key];
    if (!inspect || inspect.Name !== `/${service.containerName}` || inspect.Config?.Image !== service.image.tag ||
        (service.image.id && inspect.Image !== service.image.id) ||
        (service.image.source && inspect.Config?.Labels?.["com.aihub.source-content-sha256"] !== service.image.source) ||
        (service.image.revision && inspect.Config?.Labels?.["com.aihub.source-revision"] !== service.image.revision) ||
        (service.image.release && inspect.Config?.Labels?.["com.aihub.release-version"] !== service.image.release) ||
        (service.image.user !== undefined && inspect.Config?.User !== service.image.user) ||
        inspect.Config?.Labels?.["com.docker.compose.project"] !== PROJECT ||
        inspect.Config?.Labels?.["com.docker.compose.service"] !== service.composeService ||
        inspect.State?.Health?.Status !== "healthy" || !Array.isArray(inspect.Mounts)) reject();
  }
  return true;
}

function validateProductionMounts({ inspectAll, profile, environment, releaseRoot, fsImpl, secretConsumers }) {
  if (!environment || typeof releaseRoot !== "string" || !fsImpl || !secretConsumers) fail();
  for (const service of SERVICES) {
    const expected = [...DATA_MOUNTS[service.key]];
    for (const [name, consumers] of Object.entries(secretConsumers)) {
      if (consumers.includes(service.key)) expected.push({ destination: `/run/secrets/${name}`, sourceEnv: "AIHUB_SECRET_DIR", secret: name, type: "bind", rw: false });
    }
    const actual = inspectAll[service.key]?.Mounts;
    if (!Array.isArray(actual) || actual.length !== expected.length) fail();
    for (const contract of expected) {
      const matches = actual.filter((mount) => mount.Destination === contract.destination);
      if (matches.length !== 1 || matches[0].Type !== contract.type || matches[0].RW !== contract.rw) fail();
      const mount = matches[0];
      let source;
      if (contract.releaseFile) {
        source = mount.Source;
        const candidate = `${releaseRoot}/deployment/community-production/${contract.releaseFile}`;
        if (typeof source !== "string" || path.posix.basename(source) !== contract.releaseFile) fail();
        validateRetainedReleaseFile(source, candidate, contract.mode, fsImpl);
        continue;
      }
      else if (contract.secret) {
        const root = environment[contract.secret === "workflow_review_secret" ? "AIHUB_WORKFLOW_PRODUCTION_SECRET_DIR" : "AIHUB_SECRET_DIR"];
        if (typeof root !== "string" || !root.startsWith("/")) fail();
        source = `${root}/${contract.secret}`;
      }
      else source = environment[contract.sourceEnv];
      if (typeof source !== "string" || !source || (contract.type === "bind" ? !source.startsWith("/") : !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(source)) ||
          (contract.type === "bind" ? mount.Source !== source : mount.Name !== source)) fail();
      if (contract.type === "bind") {
        const stat = fsImpl.lstatSync(source);
        if (fsImpl.realpathSync(source) !== source || stat.isSymbolicLink() || !Number.isSafeInteger(stat.uid) || !Number.isSafeInteger(stat.gid) ||
            (contract.secret ? (!stat.isFile() || stat.nlink !== 1) : (!stat.isDirectory() || stat.nlink < 2)) ||
            ((stat.mode & 0o777) & 0o022) !== 0) fail();
      }
    }
  }
  return Object.freeze({ profile, serviceCount: SERVICES.length, mountCount: SERVICES.reduce((count, service) => count + inspectAll[service.key].Mounts.length, 0) });
}

module.exports = { DATA_MOUNTS, PROJECT, SERVICES, contractFor, validateProductionMounts, validateProductionServices };
