"use strict";

const fs = require("node:fs");
const http = require("node:http");
const {
  createActiveCatalogProductSource
} = require("/app/shared/active-catalog-products.cjs");
const {
  createInMemoryWorkflowRepository
} = require("/app/community/workflow-persistence.cjs");
const {
  createIdentityWorkflowStoreGateway
} = require("/app/identity/workflow-store.cjs");
const {
  createWorkflowDependencyResolver
} = require("/app/identity/workflow-resolvers.cjs");

const release = JSON.parse(fs.readFileSync("/fixture/release.json", "utf8"));
const channel = JSON.parse(fs.readFileSync("/app/catalog/channel.json", "utf8"));
let mode = ["fail", "bad-signature", "manual"].includes(process.env.FIXTURE_CATALOG_MODE)
  ? process.env.FIXTURE_CATALOG_MODE
  : "delayed";
let fetchCount = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const source = createActiveCatalogProductSource({
  catalogUrl: "http://admin:4173/catalog-release.json",
  sourceMode: "signed-internal-admin",
  trustedKeys: channel.trustedKeys,
  highestCatalogVersion: Number(process.env.FIXTURE_HIGHEST_CATALOG_VERSION || 0),
  highestCatalogSha256: String(process.env.FIXTURE_HIGHEST_CATALOG_SHA256 || ""),
  cacheTtlMs: 60_000,
  requestTimeoutMs: 6_000,
  fetchCatalog: async () => {
    fetchCount += 1;
    if (mode === "fail") throw new Error("fixture network unavailable");
    if (mode === "bad-signature") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...release, signature: `${release.signature.slice(0, -4)}AAAA` })
      };
    }
    await wait(4_000);
    return { ok: true, status: 200, json: async () => release };
  }
});

const gateway = createIdentityWorkflowStoreGateway({
  repository: createInMemoryWorkflowRepository(),
  workflowStoreEnabled: true,
  workflowPublicStoreEnabled: false,
  resourceSubmissionsEnabled: true,
  workflowSubmissionLookupEnabled: true,
  resolveOwnerIdentity: async () => "11111111-1111-4111-8111-111111111111",
  authenticateReviewer: async () => "22222222-2222-4222-8222-222222222222",
  resolvePublicIdentity: async () => null,
  hasCanonicalDependency: createWorkflowDependencyResolver({ activeCatalogSource: source }),
  hasCanonicalLicense: async (licenseId) => licenseId === "CC-BY-4.0",
  hasCommunityPost: async (postId) => postId === "42",
  isCanonicalDependencyReady: () => source.readiness().ready,
  prepareCanonicalDependencies: () => source.warm()
});

function body(canonicalId) {
  return {
    sourceCommunityPostId: "42",
    provenance: { licenseId: "CC-BY-4.0", derivedFrom: [], discoveredVia: [] },
    content: {
      title: "Docker readiness fixture",
      summary: "Verifies one signed dependency projection.",
      inputs: [],
      outputs: [],
      instructions: ["Use the reviewed canonical dependency."],
      dependencies: [{ kind: "product", canonicalId, permissions: ["none"] }],
      secretPlaceholders: []
    }
  };
}

function send(response, status, value) {
  const encoded = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": encoded.length,
    "cache-control": "no-store"
  });
  response.end(encoded);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") {
      send(response, 200, { status: "ok" });
      return;
    }
    if (request.method === "GET" && ["/capability", "/v1/community/workflow-store/capability"].includes(url.pathname)) {
      send(response, 200, gateway.capability());
      return;
    }
    if (request.method === "GET" && url.pathname === "/metrics") {
      send(response, 200, { fetchCount, readiness: source.readiness() });
      return;
    }
    if (request.method === "POST" && url.pathname === "/mode/success") {
      mode = "delayed";
      void source.warm().catch(() => {});
      send(response, 204, {});
      return;
    }
    if (request.method === "POST" && url.pathname === "/create") {
      const input = await readJson(request);
      const result = await gateway.handle({
        method: "POST",
        path: "/v1/community/workflow-store/owner/drafts",
        accessToken: "fixture-owner-token",
        headers: {
          "content-type": "application/json",
          "idempotency-key": String(input.idempotencyKey || "fixture-create")
        },
        body: body(String(input.canonicalId || ""))
      });
      send(response, result.status, result.body);
      return;
    }
    send(response, 404, { error: "not-found" });
  } catch {
    send(response, 500, { error: "fixture-failed" });
  }
});

server.listen(4180, "0.0.0.0", () => {
  if (mode !== "manual") void source.warm().catch(() => {});
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
