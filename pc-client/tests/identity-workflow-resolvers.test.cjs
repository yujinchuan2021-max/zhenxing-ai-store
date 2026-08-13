"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CANONICAL_WORKFLOW_LICENSE_IDS,
  createFlarumPostResolver,
  createPublicIdentityResolver,
  createWorkflowDependencyResolver,
  hasCanonicalWorkflowLicense
} = require("../identity/workflow-resolvers.cjs");
const {
  WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID
} = require("../identity/workflow-official-publisher-service-identity.cjs");

test("workflow dependency resolver delegates exact tuples to the verified catalog source", async () => {
  const received = [];
  const resolver = createWorkflowDependencyResolver({
    activeCatalogSource: {
      async hasCanonicalDependency(tuple) {
        received.push(tuple);
        return tuple.kind === "product" && tuple.canonicalId === "blender";
      }
    }
  });

  assert.equal(await resolver({ kind: "product", canonicalId: "blender" }), true);
  assert.equal(await resolver({ kind: "product", canonicalId: "blender-copy" }), false);
  assert.deepEqual(received, [
    { kind: "product", canonicalId: "blender" },
    { kind: "product", canonicalId: "blender-copy" }
  ]);
});

test("workflow dependency resolver preserves catalog unavailability instead of claiming absence", async () => {
  const resolver = createWorkflowDependencyResolver({
    activeCatalogSource: {
      async hasCanonicalDependency() {
        const error = new Error("private upstream detail");
        error.code = "TEMPORARILY_UNAVAILABLE";
        error.status = 503;
        throw error;
      }
    }
  });
  await assert.rejects(
    () => resolver({ kind: "product", canonicalId: "blender" }),
    (error) => error.code === "TEMPORARILY_UNAVAILABLE" && error.status === 503
  );
});

test("workflow licenses use one fixed canonical allowlist", async () => {
  assert.equal(CANONICAL_WORKFLOW_LICENSE_IDS.has("MIT"), true);
  assert.equal(CANONICAL_WORKFLOW_LICENSE_IDS.has("CC-BY-4.0"), true);
  assert.equal(await hasCanonicalWorkflowLicense("MIT"), true);
  assert.equal(await hasCanonicalWorkflowLicense("mit"), false);
  assert.equal(await hasCanonicalWorkflowLicense("LicenseRef-user-input"), false);
});

test("Flarum post resolver performs one bounded GET to the fixed internal origin", async () => {
  const requests = [];
  const resolver = createFlarumPostResolver({
    fetchPost: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json", "content-length": "37" }),
        async arrayBuffer() {
          return Buffer.from(JSON.stringify({ data: { type: "posts", id: "42" } }));
        }
      };
    }
  });

  assert.equal(await resolver("42"), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://community/api/posts/42");
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[0].options.redirect, "error");
  assert.deepEqual(requests[0].options.headers, { Accept: "application/vnd.api+json" });
  assert.equal(Object.hasOwn(requests[0].options.headers, "Authorization"), false);
  assert.equal(await resolver("https://evil.example/posts/42"), false);
});

test("Flarum post resolver fails closed on mismatches, errors, and oversized responses", async () => {
  for (const fetchPost of [
    async () => ({ ok: false, status: 404, headers: new Headers(), arrayBuffer: async () => Buffer.alloc(0) }),
    async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "65537" }),
      arrayBuffer: async () => Buffer.alloc(65537)
    }),
    async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => Buffer.from(JSON.stringify({ data: { type: "posts", id: "41" } }))
    }),
    async () => { throw new Error("upstream detail must not escape"); }
  ]) {
    const resolver = createFlarumPostResolver({ fetchPost });
    assert.equal(await resolver("42"), false);
  }
});

test("public identity resolver returns only immutable ID and public display name", async () => {
  let query;
  const resolver = createPublicIdentityResolver({
    pool: {
      async query(text, values) {
        query = { text, values };
        return { rowCount: 1, rows: [{ id: values[0], nickname: "Alice", email: "hidden@example.com" }] };
      }
    }
  });
  const identityId = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(await resolver(identityId), { identityId, displayName: "Alice" });
  assert.match(query.text, /u\.status = 'active'/);
  assert.deepEqual(query.values, [identityId]);
  assert.equal(await resolver("not-an-id"), null);
});

test("public identity resolver exposes the governed organization name without creating a browser profile", async () => {
  const queries = [];
  const resolver = createPublicIdentityResolver({
    pool: {
      async query(text, values) {
        queries.push({ text, values });
        if (text.includes("identity_kind")) {
          return {
            rowCount: 1,
            rows: [{
              id: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
              identity_kind: "workflow-official-publisher-service",
              status: "disabled",
              email: null,
              normalized_email: null,
              phone: null,
              normalized_phone: null,
              password_hash: null,
              username: "__workflow_official_publisher_service__",
              normalized_username: "__workflow_official_publisher_service__",
              community_username: "zx_46564566f5f4599c8ce50609069"
            }]
          };
        }
        return { rowCount: 0, rows: [] };
      }
    }
  });

  assert.deepEqual(await resolver(WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID), {
    identityId: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    displayName: "枕星 AI"
  });
  assert.equal(queries.some(({ text }) => /JOIN\s+community_profiles/i.test(text)), false);
  assert.match(queries[0].text, /NOT EXISTS \(SELECT 1 FROM public\.community_profiles/);
  assert.match(queries[0].text, /NOT EXISTS \(SELECT 1 FROM public\.community_handoffs/);
  assert.match(queries[0].text, /NOT EXISTS \(SELECT 1 FROM public\.email_change_challenges/);
});

test("public identity resolver fails closed for any publisher row drift, browser relation, or extra projection", async () => {
  const exact = {
    id: WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID,
    identity_kind: "workflow-official-publisher-service",
    status: "disabled",
    email: null,
    normalized_email: null,
    phone: null,
    normalized_phone: null,
    password_hash: null,
    username: "__workflow_official_publisher_service__",
    normalized_username: "__workflow_official_publisher_service__",
    community_username: "zx_46564566f5f4599c8ce50609069"
  };
  for (const row of [
    { ...exact, email: "claim@example.invalid" },
    { ...exact, password_hash: "not-a-password" },
    { ...exact, username: "claimable-user" },
    { ...exact, handoffs: 1 },
    { ...exact, email_changes: 1 },
    { ...exact, internal_kind: "must-not-be-accepted" }
  ]) {
    const resolver = createPublicIdentityResolver({
      pool: { query: async () => ({ rowCount: 1, rows: [row] }) }
    });
    assert.equal(await resolver(WORKFLOW_OFFICIAL_PUBLISHER_SERVICE_ID), null);
  }
});
