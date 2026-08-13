"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  RESOURCE_BINDING_KINDS,
  DEPENDENCY_PERMISSIONS,
  WorkflowContractError,
  createCommunityWorkflowStore
} = require("../community/workflow-store.cjs");

const AUTHOR = "11111111-1111-4111-8111-111111111111";
const REVIEWER = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

function content(overrides = {}) {
  return {
    title: "整理一份安全的图片工作流",
    summary: "只描述人工步骤与已审核依赖，不包含任何可执行配置。",
    inputs: [
      { name: "source_image", type: "image", required: true, description: "用户选择的输入图片。" }
    ],
    outputs: [
      { name: "processed_image", type: "image", description: "处理后的图片引用。" }
    ],
    instructions: ["选择输入图片。", "在目标产品中按说明完成处理。"],
    dependencies: [
      {
        kind: "product",
        canonicalId: "comfyui",
        permissions: ["read-selected-input", "write-selected-output"]
      },
      {
        kind: "resource",
        canonicalId: "reviewed-image-helper",
        hostProductId: "comfyui",
        bindingKind: "skill-context",
        permissions: ["secret-placeholder"]
      }
    ],
    secretPlaceholders: [
      { name: "IMAGE_SERVICE_TOKEN", description: "由用户在客户端本地填写。" }
    ],
    ...overrides
  };
}

function fixture() {
  const ids = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
  ];
  let tick = 0;
  const canonical = new Set([
    "product:comfyui",
    "resource:reviewed-image-helper:comfyui:skill-context"
  ]);
  return createCommunityWorkflowStore({
    hasCanonicalDependency: ({ kind, canonicalId, hostProductId = "", bindingKind = "" }) =>
      canonical.has([kind, canonicalId, hostProductId, bindingKind].filter(Boolean).join(":")),
    hasCanonicalLicense: (licenseId) => licenseId === "CC-BY-4.0",
    hasCommunityPost: (postId) => ["42", "43", "44"].includes(postId),
    makeId: () => ids.shift(),
    now: () => `2026-08-07T00:00:0${tick++}.000Z`
  });
}

function draftInput(draftContent = content()) {
  return {
    authorIdentityId: AUTHOR,
    sourceCommunityPostId: "42",
    provenance: {
      licenseId: "CC-BY-4.0",
      derivedFrom: [],
      discoveredVia: [{ kind: "external-index", canonicalId: "cocoloop-workflow-42" }]
    },
    content: draftContent
  };
}

async function published(store, draftContent = content()) {
  const draft = store.createDraft(draftInput(draftContent));
  store.submitDraft({ workflowId: draft.workflowId, authorIdentityId: AUTHOR });
  const result = store.reviewSubmission({
    workflowId: draft.workflowId,
    reviewerIdentityId: REVIEWER,
    decision: "publish",
    reviewStatus: "manually-reviewed",
    riskLevel: "guarded"
  });
  return result;
}

test("submission review creates immutable releases and a separately mutable listing", async () => {
  const store = fixture();
  const first = await published(store);

  assert.equal(first.release.version, 1);
  assert.equal(first.release.authorIdentityId, AUTHOR);
  assert.equal(first.release.provenance.originalAuthorIdentityId, AUTHOR);
  assert.deepEqual(first.release.provenance.canonicalSource, {
    kind: "community-post",
    canonicalId: "42"
  });
  assert.equal(first.release.provenance.licenseId, "CC-BY-4.0");
  assert.deepEqual(first.release.provenance.discoveredVia, [
    { kind: "external-index", canonicalId: "cocoloop-workflow-42" }
  ]);
  assert.equal(first.listing.status, "published");
  assert.equal(first.listing.version, 1);
  assert.equal(first.listing.sourceCommunityPostId, "42");
  assert.equal(first.release.reviewStatus, "manually-reviewed");
  assert.equal(first.release.riskLevel, "guarded");
  assert.equal(first.listing.requiresPerUseConfirmation, true);
  assert.equal("safe" in first.release, false);
  assert.equal(Object.isFrozen(first.release), true);
  assert.equal(Object.isFrozen(first.release.content), true);

  store.updateDraft({
    workflowId: first.release.workflowId,
    authorIdentityId: AUTHOR,
    content: content({ title: "第二版图片工作流" })
  });
  store.submitDraft({ workflowId: first.release.workflowId, authorIdentityId: AUTHOR });
  const second = store.reviewSubmission({
    workflowId: first.release.workflowId,
    reviewerIdentityId: REVIEWER,
    decision: "publish",
    reviewStatus: "automated-reviewed",
    riskLevel: "low"
  });

  assert.equal(second.release.version, 2);
  assert.equal(store.getRelease(first.release.workflowId, 1).content.title, content().title);
  assert.equal(store.getListing(first.release.workflowId).version, 2);

  const unlisted = store.unlist({
    workflowId: first.release.workflowId,
    reviewerIdentityId: REVIEWER,
    reason: "审核后收到有效安全举报"
  });
  assert.equal(unlisted.status, "unlisted");
  assert.equal(unlisted.importable, false);
  assert.equal(store.getRelease(first.release.workflowId, 2).content.title, "第二版图片工作流");
  assert.throws(
    () => store.importRelease({
      workflowId: first.release.workflowId,
      version: 2,
      ownerIdentityId: USER
    }),
    (error) => error instanceof WorkflowContractError && error.code === "IMPORT_NOT_ALLOWED"
  );
});

test("rejected drafts can be revised and resubmitted without changing their author", () => {
  const store = fixture();
  const draft = store.createDraft(draftInput());
  store.submitDraft({ workflowId: draft.workflowId, authorIdentityId: AUTHOR });
  const rejected = store.reviewSubmission({
    workflowId: draft.workflowId,
    reviewerIdentityId: REVIEWER,
    decision: "reject",
    reviewStatus: "rejected",
    riskLevel: "low",
    reason: "说明不足"
  });
  assert.equal(rejected.draft.status, "rejected");
  assert.equal(rejected.release, null);

  const revised = store.updateDraft({
    workflowId: draft.workflowId,
    authorIdentityId: AUTHOR,
    content: content({ summary: "补充了完整的人工操作说明。" })
  });
  assert.equal(revised.status, "draft");
  assert.equal(revised.authorIdentityId, AUTHOR);

  assert.throws(
    () => store.updateDraft({ workflowId: draft.workflowId, authorIdentityId: USER, content: content() }),
    (error) => error instanceof WorkflowContractError && error.code === "AUTHOR_MISMATCH"
  );
});

test("authors cannot self-review and reports do not rewrite releases", async () => {
  const store = fixture();
  const draft = store.createDraft(draftInput());
  store.submitDraft({ workflowId: draft.workflowId, authorIdentityId: AUTHOR });
  assert.throws(
    () => store.reviewSubmission({
      workflowId: draft.workflowId,
      reviewerIdentityId: AUTHOR,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "low"
    }),
    (error) => error instanceof WorkflowContractError && error.code === "SELF_REVIEW_FORBIDDEN"
  );

  const result = store.reviewSubmission({
    workflowId: draft.workflowId,
    reviewerIdentityId: REVIEWER,
    decision: "publish",
    reviewStatus: "manually-reviewed",
    riskLevel: "guarded"
  });
  const report = store.reportRelease({
    workflowId: draft.workflowId,
    version: 1,
    reporterIdentityId: USER,
    reason: "依赖权限说明可能不完整"
  });
  assert.equal(report.status, "pending");
  assert.equal(report.workflowId, draft.workflowId);
  assert.deepEqual(store.getRelease(draft.workflowId, 1), result.release);
  assert.equal(store.getListing(draft.workflowId).status, "published");
});

test("community cards contain only workflowId and immutable version; imports are independent copies", async () => {
  const store = fixture();
  const { release } = await published(store);
  assert.deepEqual(store.createPostCard({ workflowId: release.workflowId, version: 1 }), {
    workflowId: release.workflowId,
    version: 1
  });

  const imported = store.importRelease({
    workflowId: release.workflowId,
    version: 1,
    ownerIdentityId: USER
  });
  assert.equal(imported.ownerIdentityId, USER);
  assert.deepEqual(imported.source, { workflowId: release.workflowId, version: 1 });
  assert.equal(imported.reviewStatus, "manually-reviewed");
  assert.equal(imported.riskLevel, "guarded");
  assert.equal(imported.requiresPerUseConfirmation, true);
  assert.equal(imported.provenance.originalAuthorIdentityId, AUTHOR);
  assert.equal(imported.provenance.licenseId, "CC-BY-4.0");
  imported.content.title = "用户自己的副本";
  assert.equal(store.getRelease(release.workflowId, 1).content.title, content().title);
});

test("derived workflows preserve their own author and link the immutable original provenance", async () => {
  const store = fixture();
  const { release } = await published(store);
  const derived = store.createDraft({
    authorIdentityId: USER,
    sourceCommunityPostId: "43",
    provenance: {
      licenseId: "CC-BY-4.0",
      derivedFrom: [{ workflowId: release.workflowId, version: 1 }],
      discoveredVia: [{ kind: "community-post", canonicalId: "42" }]
    },
    content: content({ title: "基于原版本的派生工作流" })
  });

  assert.equal(derived.provenance.originalAuthorIdentityId, USER);
  assert.deepEqual(derived.provenance.canonicalSource, {
    kind: "community-post",
    canonicalId: "43"
  });
  assert.deepEqual(derived.provenance.derivedFrom, [
    { workflowId: release.workflowId, version: 1 }
  ]);
  assert.equal(store.getRelease(release.workflowId, 1).provenance.originalAuthorIdentityId, AUTHOR);
});

test("unsafe is a reviewed high-risk result and cannot become a release or importable listing", () => {
  const store = fixture();
  const draft = store.createDraft(draftInput());
  assert.equal(draft.reviewStatus, "unreviewed");
  assert.equal(draft.riskLevel, null);
  store.submitDraft({ workflowId: draft.workflowId, authorIdentityId: AUTHOR });
  assert.throws(
    () => store.reviewSubmission({
      workflowId: draft.workflowId,
      reviewerIdentityId: REVIEWER,
      decision: "publish",
      reviewStatus: "manually-reviewed",
      riskLevel: "unsafe"
    }),
    (error) => error instanceof WorkflowContractError && error.code === "UNSAFE_NOT_PUBLISHABLE"
  );
  assert.throws(
    () => fixture().createDraft({
      ...draftInput(),
      provenance: {
        licenseId: "UNKNOWN-LICENSE",
        derivedFrom: [],
        discoveredVia: []
      }
    }),
    (error) => error instanceof WorkflowContractError && error.code === "LICENSE_NOT_FOUND"
  );
  const rejected = store.reviewSubmission({
    workflowId: draft.workflowId,
    reviewerIdentityId: REVIEWER,
    decision: "reject",
    reviewStatus: "rejected",
    riskLevel: "unsafe",
    reason: "已审核确认包含高风险能力"
  });
  assert.equal(rejected.draft.reviewStatus, "rejected");
  assert.equal(rejected.draft.riskLevel, "unsafe");
  assert.equal(rejected.release, null);
  assert.equal(rejected.listing.status, "warning");
  assert.equal(rejected.listing.importable, false);
  assert.equal(rejected.listing.agentBindable, false);
});

test("the data-only schema rejects executable fields, secret values, unknown dependencies, and arbitrary nodes", () => {
  const forbidden = [
    ["command", "powershell"],
    ["args", ["-Command", "whoami"]],
    ["env", { TOKEN: "secret" }],
    ["headers", { Authorization: "secret" }],
    ["credentials", { password: "secret" }],
    ["script", "doSomething()"],
    ["url", "https://example.invalid/run"],
    ["path", "C:\\Users\\Public"],
    ["nodes", [{ type: "shell" }]]
  ];

  for (const [field, value] of forbidden) {
    assert.throws(
      () => fixture().createDraft({
        authorIdentityId: AUTHOR,
        sourceCommunityPostId: "42",
        provenance: draftInput().provenance,
        content: content({ [field]: value })
      }),
      (error) => error instanceof WorkflowContractError && error.code === "INVALID_SCHEMA",
      field
    );
  }

  assert.throws(
    () => fixture().createDraft({
      authorIdentityId: AUTHOR,
      sourceCommunityPostId: "42",
      provenance: draftInput().provenance,
      content: content({
        secretPlaceholders: [{ name: "TOKEN", description: "local", value: "actual-secret" }]
      })
    }),
    (error) => error instanceof WorkflowContractError && error.code === "INVALID_SCHEMA"
  );
  assert.throws(
    () => fixture().createDraft({
      authorIdentityId: AUTHOR,
      sourceCommunityPostId: "42",
      provenance: draftInput().provenance,
      content: content({
        dependencies: [{
          kind: "resource",
          canonicalId: "reviewed-image-helper",
          hostProductId: "comfyui",
          bindingKind: "invoke",
          permissions: ["none"]
        }]
      })
    }),
    (error) => error instanceof WorkflowContractError && error.code === "INVALID_BINDING"
  );
  assert.throws(
    () => fixture().createDraft({
      authorIdentityId: AUTHOR,
      sourceCommunityPostId: "42",
      provenance: draftInput().provenance,
      content: content({
        dependencies: [{ kind: "product", canonicalId: "unknown-product", permissions: ["none"] }]
      })
    }),
    (error) => error instanceof WorkflowContractError && error.code === "DEPENDENCY_NOT_FOUND"
  );
  assert.throws(
    () => fixture().createDraft({
      authorIdentityId: AUTHOR,
      sourceCommunityPostId: "42",
      provenance: draftInput().provenance,
      content: content({
        dependencies: [{
          kind: "product",
          canonicalId: "comfyui",
          permissions: ["run-command"]
        }]
      })
    }),
    (error) => error instanceof WorkflowContractError && error.code === "INVALID_PERMISSION"
  );
  assert.deepEqual(DEPENDENCY_PERMISSIONS, [
    "none",
    "read-selected-input",
    "write-selected-output",
    "approved-network",
    "secret-placeholder"
  ]);
  assert.deepEqual(RESOURCE_BINDING_KINDS, [
    "skill-context",
    "mcp-tool",
    "mcp-resource",
    "mcp-prompt",
    "plugin-host-extension",
    "connector-authorized-connection"
  ]);
});

test("owners attach exact released cards to Flarum posts and can withdraw a submitted draft", async () => {
  const store = fixture();
  const { draft, release } = await published(store);
  const attached = store.attachPostReference({
    workflowId: release.workflowId,
    version: release.version,
    authorIdentityId: AUTHOR,
    communityPostId: "44",
    expectedRevision: draft.revision
  });
  assert.deepEqual(attached.postReference.card, { workflowId: release.workflowId, version: 1 });
  assert.equal(attached.draft.revision, draft.revision + 1);
  assert.deepEqual(store.listPostReferences(release.workflowId), [attached.postReference]);

  const detached = store.detachPostReference({
    workflowId: release.workflowId,
    version: release.version,
    authorIdentityId: AUTHOR,
    communityPostId: "44",
    expectedRevision: attached.draft.revision
  });
  assert.equal(detached.draft.revision, attached.draft.revision + 1);
  assert.deepEqual(store.listPostReferences(release.workflowId), []);

  const pending = store.createDraft({ ...draftInput(), sourceCommunityPostId: "43" });
  const submitted = store.submitDraft({ workflowId: pending.workflowId, authorIdentityId: AUTHOR });
  const withdrawn = store.withdrawDraft({
    workflowId: pending.workflowId,
    authorIdentityId: AUTHOR,
    expectedRevision: submitted.revision
  });
  assert.equal(withdrawn.status, "withdrawn");
  assert.throws(
    () => store.updateDraft({ workflowId: pending.workflowId, authorIdentityId: AUTHOR, content: content() }),
    (error) => error instanceof WorkflowContractError && error.code === "INVALID_STATE"
  );
});
