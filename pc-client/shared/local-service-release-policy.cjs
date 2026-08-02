"use strict";

const crypto = require("node:crypto");

const REVISION = /^[a-f0-9]{40}$/;
const VERSION = /^(?:0|[1-9]\d*)\.\d+\.\d+$/;
const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;
const SHA256 = /^[a-f0-9]{64}$/;

const EXPECTED_IDENTITY_CATALOG_URL =
  "http://admin:4173/catalog-v1.json";
const EXPECTED_IDENTITY_CATALOG_FILE = "/app/catalog/catalog-v1.json";
const ABSENT_RUNTIME_CONTRACT = "absent";

const SERVICE_SPECS = Object.freeze({
  admin: Object.freeze({
    service: "admin",
    liveImageName: "local-admin",
    dockerContext: ".",
    dockerfile: "deployment/local/admin.Dockerfile",
    runtimeContract: "admin-v1"
  }),
  "identity-community": Object.freeze({
    service: "identity-community",
    liveImageName: "local-identity-community",
    dockerContext: ".",
    dockerfile: "deployment/local/identity.Dockerfile",
    runtimeContract: "identity-catalog-url-v2"
  }),
  community: Object.freeze({
    service: "community",
    liveImageName: "local-community",
    dockerContext: "community/flarum",
    dockerfile: "community/flarum/Dockerfile",
    runtimeContract: "community-v1"
  })
});

const SERVICE_NAMES = Object.freeze(Object.keys(SERVICE_SPECS));
const IDENTITY_SHARED_FILES = new Set([
  "shared/active-catalog-products.cjs",
  "shared/avatar-image.cjs",
  "shared/identity-security.cjs"
]);
const ADMIN_DATA_FILES = new Set([
  "admin/data/catalog-v1.json",
  "admin/data/release-settings.json",
  "admin/data/vendor-icon-fallbacks.json",
  "admin/data/vendor-icon-sources.json"
]);
const COMMUNITY_CONTAINER_PATHS = Object.freeze({
  "community/flarum/apache.conf":
    "/etc/apache2/conf-available/flarum.conf",
  "community/flarum/docker-entrypoint.sh":
    "/usr/local/bin/aihub-flarum-entrypoint",
  "community/flarum/aihub-sso.php":
    "/var/www/html/public/aihub-sso.php",
  "community/flarum/aihub-personal-center.php":
    "/var/www/html/public/aihub-personal-center.php",
  "community/flarum/dependency-lock.json":
    "/usr/local/share/aihub/community-dependency-lock.json"
});

function normalizedSourcePath(value) {
  const sourcePath = String(value || "").replace(/\\/g, "/");
  if (
    !sourcePath ||
    sourcePath.startsWith("/") ||
    /[\x00-\x1f\x7f]/.test(sourcePath) ||
    sourcePath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Local service release source path is invalid");
  }
  return sourcePath;
}

function sourcePathsForService(service, revisionFiles) {
  const files = revisionFiles.map(normalizedSourcePath);
  let selected;
  if (service === "admin") {
    selected = files.filter(
      (file) =>
        (file.startsWith("admin/") &&
          (/^admin\/[^/]+\.cjs$/.test(file) ||
            file.startsWith("admin/public/") ||
            ADMIN_DATA_FILES.has(file) ||
            file.startsWith("admin/data/vendor-icons/"))) ||
        file.startsWith("shared/") ||
        file === "scripts/discover-official-products.mjs"
    );
  } else if (service === "identity-community") {
    selected = files.filter(
      (file) =>
        (file.startsWith("identity/") &&
          !file.includes("/node_modules/")) ||
        IDENTITY_SHARED_FILES.has(file)
    );
  } else if (service === "community") {
    selected = files.filter((file) =>
      Object.prototype.hasOwnProperty.call(COMMUNITY_CONTAINER_PATHS, file)
    );
  } else {
    throw new Error("Local service release service is unknown");
  }
  return [...new Set(selected)].sort();
}

function containerPathForSource(service, sourcePath) {
  if (service === "admin") return `/app/${sourcePath}`;
  if (service === "identity-community") {
    return sourcePath.startsWith("identity/")
      ? `/app/identity/${sourcePath.slice("identity/".length)}`
      : `/app/${sourcePath}`;
  }
  return COMMUNITY_CONTAINER_PATHS[sourcePath];
}

function assertRequiredSourceFiles(service, sourcePaths) {
  const required = {
    admin: [
      "admin/public/app.js",
      "admin/server.cjs",
      "admin/data/catalog-v1.json",
      "admin/data/release-settings.json",
      "admin/data/vendor-icon-fallbacks.json",
      "scripts/discover-official-products.mjs"
    ],
    "identity-community": [
      "identity/server.cjs",
      "shared/active-catalog-products.cjs"
    ],
    community: [
      "community/flarum/aihub-sso.php",
      "community/flarum/aihub-personal-center.php",
      "community/flarum/dependency-lock.json"
    ]
  }[service];
  if (required.some((sourcePath) => !sourcePaths.includes(sourcePath))) {
    throw new Error(`Local service release source manifest is incomplete: ${service}`);
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createLocalServiceReleaseManifest({
  revision,
  version,
  revisionFiles,
  readRevisionFile
}) {
  if (
    !REVISION.test(revision || "") ||
    !VERSION.test(version || "") ||
    !Array.isArray(revisionFiles) ||
    typeof readRevisionFile !== "function"
  ) {
    throw new Error("Local service release manifest inputs are invalid");
  }
  const services = SERVICE_NAMES.map((service) => {
    const spec = SERVICE_SPECS[service];
    const sourcePaths = sourcePathsForService(service, revisionFiles);
    assertRequiredSourceFiles(service, sourcePaths);
    const sourceFiles = sourcePaths.map((sourcePath) => {
      const contents = readRevisionFile(sourcePath);
      if (!Buffer.isBuffer(contents) && typeof contents !== "string") {
        throw new Error("Git revision source reader returned invalid contents");
      }
      return Object.freeze({
        sourcePath,
        containerPath: containerPathForSource(service, sourcePath),
        sha256: sha256(contents)
      });
    });
    return Object.freeze({
      ...spec,
      buildArgs: Object.freeze({ ...(spec.buildArgs || {}) }),
      sourceFiles: Object.freeze(sourceFiles)
    });
  });
  return Object.freeze({
    schemaVersion: 1,
    revision,
    version,
    services: Object.freeze(services)
  });
}

function normalizedManifestSourceFiles(service, value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 512) {
    throw new Error(`Local service release source manifest is invalid: ${service}`);
  }
  const sourceFiles = value.map((entry) => {
    const sourcePath = normalizedSourcePath(entry?.sourcePath);
    const containerPath = String(entry?.containerPath || "");
    if (
      !containerPath.startsWith("/") ||
      /[\r\n]/.test(containerPath) ||
      !SHA256.test(entry?.sha256 || "")
    ) {
      throw new Error(`Local service release source entry is invalid: ${service}`);
    }
    return Object.freeze({ sourcePath, containerPath, sha256: entry.sha256 });
  });
  if (
    new Set(sourceFiles.map((entry) => entry.sourcePath)).size !== sourceFiles.length ||
    new Set(sourceFiles.map((entry) => entry.containerPath)).size !== sourceFiles.length
  ) {
    throw new Error(`Local service release source manifest has duplicates: ${service}`);
  }
  const sorted = [...sourceFiles].sort((left, right) =>
    left.sourcePath.localeCompare(right.sourcePath)
  );
  if (sourceFiles.some((entry, index) => entry.sourcePath !== sorted[index].sourcePath)) {
    throw new Error(`Local service release source manifest is not sorted: ${service}`);
  }
  assertRequiredSourceFiles(service, sourceFiles.map((entry) => entry.sourcePath));
  return Object.freeze(sourceFiles);
}

function validateLocalServiceReleaseManifest(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.schemaVersion !== 1 ||
    !REVISION.test(value.revision || "") ||
    !VERSION.test(value.version || "") ||
    !Array.isArray(value.services) ||
    value.services.length !== SERVICE_NAMES.length
  ) {
    throw new Error("Local service release manifest is invalid");
  }
  const services = value.services.map((entry) => {
    const spec = SERVICE_SPECS[entry?.service];
    if (
      !spec ||
      entry.liveImageName !== spec.liveImageName ||
      entry.dockerContext !== spec.dockerContext ||
      entry.dockerfile !== spec.dockerfile ||
      entry.runtimeContract !== spec.runtimeContract ||
      JSON.stringify(entry.buildArgs || {}) !== JSON.stringify(spec.buildArgs || {})
    ) {
      throw new Error("Local service release manifest policy drift detected");
    }
    return Object.freeze({
      ...spec,
      buildArgs: Object.freeze({ ...(spec.buildArgs || {}) }),
      sourceFiles: normalizedManifestSourceFiles(
        spec.service,
        entry.sourceFiles
      )
    });
  });
  if (
    services.some((entry, index) => entry.service !== SERVICE_NAMES[index])
  ) {
    throw new Error("Local service release manifest service order drift detected");
  }
  return Object.freeze({
    schemaVersion: 1,
    revision: value.revision,
    version: value.version,
    services: Object.freeze(services)
  });
}

function catalogCompatibilityVolume(identity) {
  const volumes = Array.isArray(identity?.volumes) ? identity.volumes : [];
  const catalogVolumes = volumes.filter(
    (volume) => volume?.target === "/app/catalog"
  );
  if (catalogVolumes.length !== 1) return null;
  const volume = catalogVolumes[0];
  const source = String(volume.source || "").replace(/\\/g, "/");
  return volume.type === "bind" &&
    volume.read_only === true &&
    /(?:^|\/)admin\/data\/?$/i.test(source)
    ? volume
    : null;
}

function assertLocalServiceRuntimeContracts(model) {
  const services = model?.services;
  const admin = services?.admin;
  const identity = services?.["identity-community"];
  const community = services?.community;
  if (!admin || !identity || !community) {
    throw new Error("Local service runtime contract topology is incomplete");
  }
  const environment = identity.environment;
  if (
    !environment ||
    environment.AIHUB_CATALOG_URL !== EXPECTED_IDENTITY_CATALOG_URL ||
    environment.AIHUB_CATALOG_FILE !== EXPECTED_IDENTITY_CATALOG_FILE
  ) {
    throw new Error("Identity dual catalog runtime contract drift detected");
  }
  if (identity.depends_on?.admin?.condition !== "service_healthy") {
    throw new Error("Identity healthy admin runtime contract drift detected");
  }
  if (!catalogCompatibilityVolume(identity)) {
    throw new Error("Identity catalog-file rollback mount contract drift detected");
  }
  return Object.freeze({
    admin: "admin-v1",
    identityCurrent: "identity-catalog-url-v2",
    identityRollback: "identity-catalog-file-v1",
    community: "community-v1"
  });
}

function assertPreviousRuntimeContracts(entries) {
  const supported = {
    admin: new Set(["admin-v1", "admin-legacy-v1", ABSENT_RUNTIME_CONTRACT]),
    "identity-community": new Set([
      "identity-catalog-url-v2",
      "identity-catalog-file-v1",
      ABSENT_RUNTIME_CONTRACT
    ]),
    community: new Set([
      "community-v1",
      "community-legacy-v1",
      ABSENT_RUNTIME_CONTRACT
    ])
  };
  if (!Array.isArray(entries) || entries.length !== SERVICE_NAMES.length) {
    throw new Error("Previous local service runtime contracts are incomplete");
  }
  const seen = new Set();
  for (const entry of entries) {
    const service = String(entry?.service || "");
    const runtimeContract = String(entry?.runtimeContract || "");
    if (
      !supported[service] ||
      seen.has(service) ||
      !supported[service].has(runtimeContract)
    ) {
      throw new Error(`Unsupported previous local service runtime contract: ${service}`);
    }
    seen.add(service);
  }
  return Object.freeze(
    Object.fromEntries(
      entries.map((entry) => [entry.service, entry.runtimeContract])
    )
  );
}

function assertCandidateImageInspection({ manifest, inspection }) {
  const normalized = validateLocalServiceReleaseManifest(manifest);
  const expected = normalized.services.find(
    (entry) => entry.service === inspection?.service
  );
  if (!expected || !IMAGE_ID.test(inspection?.imageId || "")) {
    throw new Error("Local service candidate image inspection is invalid");
  }
  const labels = inspection.labels;
  if (
    !labels ||
    typeof labels !== "object" ||
    Array.isArray(labels) ||
    labels["com.aihub.source-revision"] !== normalized.revision ||
    labels["com.aihub.release-version"] !== normalized.version ||
    labels["com.aihub.runtime-contract"] !== expected.runtimeContract
  ) {
    throw new Error(`Local service candidate image label drift detected: ${expected.service}`);
  }
  if (!Array.isArray(inspection.fileHashes)) {
    throw new Error("Local service candidate image hashes are invalid");
  }
  const actual = new Map();
  for (const entry of inspection.fileHashes) {
    if (
      typeof entry?.containerPath !== "string" ||
      !SHA256.test(entry?.sha256 || "") ||
      actual.has(entry.containerPath)
    ) {
      throw new Error("Local service candidate image hashes are invalid");
    }
    actual.set(entry.containerPath, entry.sha256);
  }
  const mismatches = expected.sourceFiles.filter(
    (entry) => actual.get(entry.containerPath) !== entry.sha256
  );
  if (actual.size !== expected.sourceFiles.length || mismatches.length) {
    const paths = mismatches
      .slice(0, 4)
      .map((entry) => entry.containerPath)
      .join(", ");
    throw new Error(
      `Local service candidate source drift detected: ${expected.service}` +
        (paths ? ` (${paths})` : "")
    );
  }
  return Object.freeze({
    service: expected.service,
    imageId: inspection.imageId,
    revision: normalized.revision,
    version: normalized.version,
    runtimeContract: expected.runtimeContract
  });
}

module.exports = {
  ABSENT_RUNTIME_CONTRACT,
  EXPECTED_IDENTITY_CATALOG_FILE,
  EXPECTED_IDENTITY_CATALOG_URL,
  SERVICE_NAMES,
  SERVICE_SPECS,
  assertCandidateImageInspection,
  assertPreviousRuntimeContracts,
  assertLocalServiceRuntimeContracts,
  createLocalServiceReleaseManifest,
  validateLocalServiceReleaseManifest
};
