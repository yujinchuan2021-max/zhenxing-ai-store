"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  SERVICE_NAMES,
  SERVICE_SPECS,
  assertCandidateImageInspection,
  assertLocalServiceRuntimeContracts,
  assertPreviousRuntimeContracts,
  createLocalServiceReleaseManifest,
  validateLocalServiceReleaseManifest
} = require("../shared/local-service-release-policy.cjs");

const revision = "a".repeat(40);
const version = "0.1.24";
const revisionFiles = [
  "admin/config-validation.cjs",
  "admin/data/catalog-v1.json",
  "admin/data/release-settings.json",
  "admin/public/app.js",
  "admin/public/index.html",
  "admin/public/styles.css",
  "admin/server.cjs",
  "community/flarum/aihub-personal-center.php",
  "community/flarum/aihub-sso.php",
  "community/flarum/apache.conf",
  "community/flarum/dependency-lock.json",
  "community/flarum/docker-entrypoint.sh",
  "identity/identity-community.cjs",
  "identity/package-lock.json",
  "identity/package.json",
  "identity/server.cjs",
  "scripts/discover-official-products.mjs",
  "shared/active-catalog-products.cjs",
  "shared/avatar-image.cjs",
  "shared/catalog.cjs",
  "shared/identity-security.cjs"
];

function manifestFixture() {
  return createLocalServiceReleaseManifest({
    revision,
    version,
    revisionFiles,
    readRevisionFile(sourcePath) {
      return Buffer.from(`source:${sourcePath}\n`, "utf8");
    }
  });
}

function runtimeModel() {
  return {
    services: {
      admin: {},
      community: {},
      "identity-community": {
        environment: {
          AIHUB_CATALOG_URL: "http://admin:4173/catalog-v1.json",
          AIHUB_CATALOG_FILE: "/app/catalog/catalog-v1.json"
        },
        depends_on: { admin: { condition: "service_healthy" } },
        volumes: [
          {
            type: "bind",
            source: "C:/checkout/pc-client/admin/data",
            target: "/app/catalog",
            read_only: true
          }
        ]
      }
    }
  };
}

test("service release manifests cover every source copied into the three images", () => {
  const manifest = validateLocalServiceReleaseManifest(manifestFixture());
  assert.deepEqual(
    manifest.services.map((entry) => entry.service),
    SERVICE_NAMES
  );

  const admin = manifest.services.find((entry) => entry.service === "admin");
  assert.equal(
    admin.sourceFiles.some((entry) => entry.sourcePath === "admin/public/app.js"),
    true
  );
  assert.equal(
    admin.sourceFiles.some(
      (entry) => entry.sourcePath === "scripts/discover-official-products.mjs"
    ),
    true
  );
  assert.equal(
    admin.sourceFiles.some((entry) => entry.sourcePath === "identity/server.cjs"),
    false
  );

  const identity = manifest.services.find(
    (entry) => entry.service === "identity-community"
  );
  assert.equal(
    identity.sourceFiles.some(
      (entry) => entry.sourcePath === "shared/active-catalog-products.cjs"
    ),
    true
  );
  assert.equal(
    identity.sourceFiles.some((entry) => entry.sourcePath === "shared/catalog.cjs"),
    false
  );

  const community = manifest.services.find((entry) => entry.service === "community");
  assert.deepEqual(
    community.sourceFiles.map((entry) => entry.sourcePath),
    [
      "community/flarum/aihub-personal-center.php",
      "community/flarum/aihub-sso.php",
      "community/flarum/apache.conf",
      "community/flarum/dependency-lock.json",
      "community/flarum/docker-entrypoint.sh"
    ]
  );
});

test("candidate inspection binds labels and every copied source hash to one release", () => {
  const manifest = manifestFixture();
  const expected = manifest.services.find((entry) => entry.service === "admin");
  const inspection = {
    service: "admin",
    imageId: `sha256:${"b".repeat(64)}`,
    labels: {
      "com.aihub.source-revision": revision,
      "com.aihub.release-version": version,
      "com.aihub.runtime-contract": SERVICE_SPECS.admin.runtimeContract
    },
    fileHashes: expected.sourceFiles.map(({ containerPath, sha256 }) => ({
      containerPath,
      sha256
    }))
  };
  assert.equal(
    assertCandidateImageInspection({ manifest, inspection }).imageId,
    inspection.imageId
  );

  assert.throws(
    () =>
      assertCandidateImageInspection({
        manifest,
        inspection: {
          ...inspection,
          labels: {
            ...inspection.labels,
            "com.aihub.source-revision": "c".repeat(40)
          }
        }
      }),
    /label drift/
  );
  assert.throws(
    () =>
      assertCandidateImageInspection({
        manifest,
        inspection: {
          ...inspection,
          fileHashes: inspection.fileHashes.map((entry, index) =>
            index === 0 ? { ...entry, sha256: "d".repeat(64) } : entry
          )
        }
      }),
    /source drift/
  );
});

test("current, legacy and absent runtime contracts are explicit rollback inputs", () => {
  const current = SERVICE_NAMES.map((service) => ({
    service,
    runtimeContract: SERVICE_SPECS[service].runtimeContract
  }));
  assert.deepEqual(assertPreviousRuntimeContracts(current), {
    admin: "admin-v1",
    "identity-community": "identity-catalog-url-v2",
    community: "community-v1"
  });
  assert.deepEqual(
    assertPreviousRuntimeContracts([
      { service: "admin", runtimeContract: "admin-legacy-v1" },
      {
        service: "identity-community",
        runtimeContract: "identity-catalog-file-v1"
      },
      { service: "community", runtimeContract: "community-legacy-v1" }
    ]),
    {
      admin: "admin-legacy-v1",
      "identity-community": "identity-catalog-file-v1",
      community: "community-legacy-v1"
    }
  );
  assert.deepEqual(
    assertPreviousRuntimeContracts(
      SERVICE_NAMES.map((service) => ({ service, runtimeContract: "absent" }))
    ),
    {
      admin: "absent",
      "identity-community": "absent",
      community: "absent"
    }
  );
  assert.throws(
    () =>
      assertPreviousRuntimeContracts([
        { service: "admin", runtimeContract: "admin-v1" },
        { service: "identity-community", runtimeContract: "unknown" },
        { service: "community", runtimeContract: "community-v1" }
      ]),
    /Unsupported previous/
  );
});

test("the current identity image and previous file-based image share one compose topology", () => {
  assert.deepEqual(assertLocalServiceRuntimeContracts(runtimeModel()), {
    admin: "admin-v1",
    identityCurrent: "identity-catalog-url-v2",
    identityRollback: "identity-catalog-file-v1",
    community: "community-v1"
  });
  const missingFile = runtimeModel();
  delete missingFile.services["identity-community"].environment.AIHUB_CATALOG_FILE;
  assert.throws(
    () => assertLocalServiceRuntimeContracts(missingFile),
    /dual catalog runtime contract drift/
  );
  const writableMount = runtimeModel();
  writableMount.services["identity-community"].volumes[0].read_only = false;
  assert.throws(
    () => assertLocalServiceRuntimeContracts(writableMount),
    /rollback mount contract drift/
  );
});

test("self-built image definitions pin bases, community dependencies and admin copy scope", () => {
  const root = path.resolve(__dirname, "..");
  const admin = fs.readFileSync(
    path.join(root, "deployment/local/admin.Dockerfile"),
    "utf8"
  );
  const identity = fs.readFileSync(
    path.join(root, "deployment/local/identity.Dockerfile"),
    "utf8"
  );
  const community = fs.readFileSync(
    path.join(root, "community/flarum/Dockerfile"),
    "utf8"
  );
  const lock = JSON.parse(
    fs.readFileSync(
      path.join(root, "community/flarum/dependency-lock.json"),
      "utf8"
    )
  );

  assert.match(admin, /^FROM [^\r\n]+@sha256:[a-f0-9]{64}$/m);
  assert.match(identity, /^FROM [^\r\n]+@sha256:[a-f0-9]{64}$/m);
  assert.match(community, new RegExp(`^FROM ${lock.composerImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
  assert.match(community, new RegExp(`^FROM ${lock.runtimeImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
  assert.match(lock.chineseSimplified, /^2\.x-dev#[a-f0-9]{40}$/);
  assert.match(lock.composerLockSha256, /^[a-f0-9]{64}$/);
  assert.match(community, /composerLockSha256/);

  assert.match(admin, /COPY --chown=node:node admin\/\*\.cjs \/app\/admin\//);
  assert.match(admin, /COPY --chown=node:node admin\/public \/app\/admin\/public/);
  assert.match(
    admin,
    /COPY --chown=node:node scripts\/discover-official-products\.mjs \/app\/scripts\/discover-official-products\.mjs/
  );
  assert.doesNotMatch(admin, /COPY --chown=node:node admin \/app\/admin/);
  assert.doesNotMatch(admin, /COPY --chown=node:node scripts \/app\/scripts/);
  assert.doesNotMatch(admin, /COPY --chown=node:node (?:catalog|updates) /);
});
