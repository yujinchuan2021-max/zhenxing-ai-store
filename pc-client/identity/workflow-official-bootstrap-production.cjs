"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");
const {
  createCommunityWorkflowCandidate,
  createPostgresWorkflowRepository
} = require("../community/workflow-persistence.cjs");
const {
  runOfficialWorkflowBootstrapOneShot
} = require("../community/workflow-official-bootstrap.cjs");
const {
  createLocalFlarumAdminRequest
} = require("../community/workflow-official-source-posts.cjs");
const { verifyCatalogRelease } = require("../shared/catalog-release.cjs");
const { workflowDependencyProjection } = require("../shared/active-catalog-products.cjs");
const {
  provisionWorkflowOfficialPublisherIdentity,
  rollbackProvisionedWorkflowOfficialPublisherIdentity,
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
} = require("./workflow-official-publisher-service-identity.cjs");
const {
  WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID
} = require("./workflow-reviewer-service-identity.cjs");
const {
  createFlarumPostResolver,
  createPublicIdentityResolver,
  hasCanonicalWorkflowLicense
} = require("./workflow-resolvers.cjs");
const { createIdentityWorkflowStoreGateway } = require("./workflow-store.cjs");

const OFFICIAL_BOOTSTRAP_CATALOG_CHANNEL = "v2";
const CATALOG_URL = "http://admin:4173/channels/v2/catalog-release.json";
const FORUM_API_KEY_FILE = "/run/secrets/forum_api_key";
const MIGRATION_FILE = path.join(__dirname, "migrations", "candidates", "0003-workflow-official-publisher-service-identity.sql");
const BOOTSTRAP_MANIFEST_FILE = path.join(__dirname, "..", "community", "workflow-official-bootstrap-candidate.json");
const SOURCE_POST_MANIFEST_FILE = path.join(__dirname, "..", "community", "workflow-official-source-posts-candidate.json");
const CHANNEL_FILE = path.join(__dirname, "..", "catalog", "channel.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseForumApiKeyFile(contents) {
  if (typeof contents !== "string") {
    throw new Error("official Workflow bootstrap Flarum credential is invalid");
  }
  const value = contents.endsWith("\n") ? contents.slice(0, -1) : contents;
  if (value.length < 32 || value.length > 512 ||
      /^\p{White_Space}|\p{White_Space}$/u.test(value) ||
      /[;\r\n\p{Cc}\p{Cf}]/u.test(value)) {
    throw new Error("official Workflow bootstrap Flarum credential is invalid");
  }
  return value;
}

function readForumApiKey() {
  return parseForumApiKeyFile(fs.readFileSync(FORUM_API_KEY_FILE, "utf8"));
}

function catalogError(code, status, message) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function verifiedCatalog(manifest, { catalogChannel, fetchImpl = globalThis.fetch } = {}) {
  if (catalogChannel !== OFFICIAL_BOOTSTRAP_CATALOG_CHANNEL) {
    throw catalogError(
      "OFFICIAL_BOOTSTRAP_CATALOG_CHANNEL_DENIED",
      503,
      "official Workflow bootstrap requires the fixed v2 catalog channel"
    );
  }
  if (typeof fetchImpl !== "function") {
    throw catalogError(
      "OFFICIAL_BOOTSTRAP_CATALOG_UNAVAILABLE",
      503,
      "official Workflow bootstrap catalog is unavailable"
    );
  }
  let release;
  try {
    const response = await fetchImpl(CATALOG_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error"
    });
    if (!response || response.ok !== true || response.status !== 200) throw new Error("catalog response unavailable");
    release = verifyCatalogRelease(await response.json(), {
      trustedKeys: readJson(CHANNEL_FILE).trustedKeys,
      clientId: "workflow-official-bootstrap-production"
    });
  } catch {
    throw catalogError(
      "OFFICIAL_BOOTSTRAP_CATALOG_UNAVAILABLE",
      503,
      "official Workflow bootstrap catalog is unavailable"
    );
  }
  if (release.eligible !== true) {
    throw catalogError(
      "OFFICIAL_BOOTSTRAP_CATALOG_UNAVAILABLE",
      503,
      "official Workflow bootstrap catalog is not ready"
    );
  }
  if (!manifest?.catalog || release.releaseId !== manifest.catalog.releaseId ||
      release.catalogVersion !== manifest.catalog.catalogVersion ||
      release.catalogSha256 !== manifest.catalog.catalogSha256) {
    throw catalogError(
      "OFFICIAL_BOOTSTRAP_CATALOG_TUPLE_MISSING",
      400,
      "official Workflow bootstrap catalog does not match the frozen manifest"
    );
  }
  return release;
}

async function runOfficialWorkflowProductionBootstrap({
  pool = new Pool({ connectionString: process.env.AIHUB_IDENTITY_DATABASE_URL }),
  catalogChannel,
  fetchImpl = globalThis.fetch
} = {}) {
  const bootstrapManifest = readJson(BOOTSTRAP_MANIFEST_FILE);
  const sourcePostManifest = readJson(SOURCE_POST_MANIFEST_FILE);
  const catalog = await verifiedCatalog(bootstrapManifest, { catalogChannel, fetchImpl });
  const dependencies = workflowDependencyProjection(catalog.catalog);
  const repository = createPostgresWorkflowRepository({ pool, enabled: true });
  const resolvePublicIdentity = createPublicIdentityResolver({ pool });
  const hasCommunityPost = createFlarumPostResolver();
  const hasCanonicalDependency = async (tuple) => {
    if (tuple?.kind === "product" && Object.keys(tuple).length === 2) {
      return dependencies.productIds.has(tuple.canonicalId);
    }
    if (tuple?.kind === "resource" && Object.keys(tuple).length === 4) {
      return dependencies.resourceBindings.has(
        `${tuple.canonicalId}\u0000${tuple.hostProductId}\u0000${tuple.bindingKind}`
      );
    }
    return false;
  };
  const candidate = createCommunityWorkflowCandidate({
    enabled: true,
    repository,
    resolveOwnerIdentity: async (request) => request?.officialPublisherIdentityId === WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
      ? WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
      : null,
    resolveReviewerIdentity: async (request) => request?.serviceIdentityId === WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID
      ? WORKFLOW_PRODUCTION_REVIEWER_SERVICE_ID
      : null,
    resolvePublicIdentity,
    hasCanonicalDependency,
    hasCanonicalLicense: hasCanonicalWorkflowLicense,
    hasCommunityPost
  });
  const publicGateway = createIdentityWorkflowStoreGateway({
    repository,
    workflowPublicStoreEnabled: true,
    resolvePublicIdentity
  });
  const requestFlarum = createLocalFlarumAdminRequest({
    apiKey: readForumApiKey(),
    fetchImpl
  });
  return runOfficialWorkflowBootstrapOneShot({
    candidate,
    publicGateway,
    bootstrapManifest,
    sourcePostManifest,
    requestFlarum,
    provisionPublisher: async () => {
      await pool.query(fs.readFileSync(MIGRATION_FILE, "utf8"));
      return provisionWorkflowOfficialPublisherIdentity(pool);
    },
    rollbackPublisher: (receipt) => rollbackProvisionedWorkflowOfficialPublisherIdentity(pool, receipt),
    validation: {
      verifyCatalogSnapshot: async (snapshot) => snapshot.releaseId === catalog.releaseId &&
        snapshot.catalogVersion === catalog.catalogVersion && snapshot.catalogSha256 === catalog.catalogSha256,
      hasCanonicalDependency,
      hasCommunityPost
    }
  });
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.AIHUB_IDENTITY_DATABASE_URL });
  runOfficialWorkflowProductionBootstrap({ pool, catalogChannel: OFFICIAL_BOOTSTRAP_CATALOG_CHANNEL })
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write("official Workflow bootstrap failed\n");
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = {
  BOOTSTRAP_MANIFEST_FILE,
  CATALOG_URL,
  FORUM_API_KEY_FILE,
  MIGRATION_FILE,
  OFFICIAL_BOOTSTRAP_CATALOG_CHANNEL,
  parseForumApiKeyFile,
  SOURCE_POST_MANIFEST_FILE,
  verifiedCatalog,
  runOfficialWorkflowProductionBootstrap
};
