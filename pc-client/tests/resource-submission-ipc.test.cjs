"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  CHANNELS,
  registerResourceSubmissionIpc
} = require("../electron/resource-submission-ipc.cjs");

const SUBMISSION_ID = "11111111-1111-4111-8111-111111111111";
const PROPOSAL = Object.freeze({
  submissionKind: "skill",
  title: "Candidate",
  summary: "Candidate summary",
  canonicalSource: "https://example.com/skill",
  evidenceRefs: ["https://example.com/evidence"]
});

function ownerSubmission(overrides = {}) {
  return {
    submissionId: SUBMISSION_ID,
    expectedRevision: 1,
    status: "draft",
    proposal: PROPOSAL,
    allowedActions: ["update", "submit", "withdraw"],
    evidenceRequired: false,
    ...overrides
  };
}

function ipcHarness() {
  const handlers = new Map();
  return {
    ipcMain: {
      handle(channel, handler) {
        assert.equal(handlers.has(channel), false, `${channel} registered twice`);
        handlers.set(channel, handler);
      }
    },
    invoke(channel, input) {
      const handler = handlers.get(channel);
      assert.ok(handler, `missing ${channel}`);
      return handler({}, input);
    },
    handlers
  };
}

test("preload bridge exposes only owner methods and validates before IPC", async () => {
  const calls = [];
  const preload = fs.readFileSync(
    path.join(__dirname, "../electron/preload.cjs"),
    "utf8"
  );
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron", "sandboxed preload must not load local modules");
      return {
        contextBridge: {
          exposeInMainWorld(_name, api) {
            context.bridge = api;
          }
        },
        ipcRenderer: {
          invoke: async (...args) => {
            calls.push(args);
            return { ok: true };
          },
          on() {},
          removeListener() {}
        }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(preload, context, { filename: "electron/preload.cjs" });
  const bridge = context.bridge;
  assert.deepEqual(
    Object.keys(bridge).filter((name) => /Submission/.test(name)).sort(),
    [
    "addSubmissionEvidence",
    "createSubmission",
    "getOwnSubmission",
    "getSubmissionCapability",
    "listOwnSubmissions",
    "submitSubmission",
    "updateSubmissionDraft",
    "withdrawSubmission"
    ]
  );
  assert.equal("reviewSubmission" in bridge, false);
  assert.equal("listAllSubmissions" in bridge, false);

  await vm.runInContext(
    `bridge.createSubmission({
      idempotencyKey: "retry-1",
      submission: {
        submissionKind: "skill",
        title: "Candidate",
        summary: "Candidate summary",
        canonicalSource: "https://example.com/skill",
        evidenceRefs: ["https://example.com/evidence"]
      }
    })`,
    context
  );
  assert.equal(calls[0][0], CHANNELS.create);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])), {
    idempotencyKey: "retry-1",
    submission: PROPOSAL
  });

  for (const invalidCall of [
    () => vm.runInContext(
        `bridge.createSubmission({
          idempotencyKey: "retry-2",
          submission: {
            submissionKind: "skill",
            title: "Candidate",
            summary: "Candidate summary",
            canonicalSource: "https://example.com/skill",
            reviewerId: "${SUBMISSION_ID}"
          }
        })`,
        context
      ),
    () => vm.runInContext(
        `bridge.updateSubmissionDraft({
          submissionId: "${SUBMISSION_ID}",
          expectedRevision: 1,
          submission: {
            submissionKind: "skill",
            title: "Candidate",
            summary: "Candidate summary",
            canonicalSource: "https://example.com/skill",
            command: "run"
          }
        })`,
        context
      ),
    () => vm.runInContext(
        `bridge.createSubmission({
          idempotencyKey: "retry-3",
          submission: {
            submissionKind: "workflow",
            title: "Candidate",
            summary: "Candidate summary",
            canonicalSource: "https://example.com/workflow",
            workflowRef: { workflowId: "workflow-1", version: "1" }
          }
        })`,
        context
      ),
    () => vm.runInContext(
        `bridge.getOwnSubmission({
          submissionId: "${SUBMISSION_ID}",
          identityId: "${SUBMISSION_ID}"
        })`,
        context
      ),
  ]) {
    assert.deepEqual(JSON.parse(JSON.stringify(await invalidCall())), {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        status: 400,
        messageKey: "resources.submit.invalid"
      }
    });
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(await vm.runInContext(
        `bridge.createSubmission({
          idempotencyKey: "retry-4",
          submission: {
            submissionKind: "skill",
            title: "Candidate",
            summary: "x".repeat(129 * 1024),
            canonicalSource: "https://example.com/skill"
          }
        })`,
        context
      ))),
    {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        status: 400,
        messageKey: "resources.submit.invalid"
      }
    }
  );
  assert.equal(calls.length, 1, "invalid requests must not cross preload IPC");
});

test("preload never exposes Electron-wrapped submission rejections", async () => {
  const preload = fs.readFileSync(
    path.join(__dirname, "../electron/preload.cjs"),
    "utf8"
  );
  const context = vm.createContext({
    require(specifier) {
      assert.equal(specifier, "electron");
      return {
        contextBridge: {
          exposeInMainWorld(_name, api) {
            context.bridge = api;
          }
        },
        ipcRenderer: {
          async invoke(channel) {
            throw new Error(
              `Error invoking remote method '${channel}': ` +
                "ResourceSubmissionIpcError: postgres://user:secret@db/internal"
            );
          },
          on() {},
          removeListener() {}
        }
      };
    },
    TextEncoder,
    URL
  });
  vm.runInContext(preload, context, { filename: "electron/preload.cjs" });

  const calls = [
    () => context.bridge.getSubmissionCapability(),
    () => context.bridge.createSubmission({ idempotencyKey: "retry", submission: PROPOSAL }),
    () => context.bridge.listOwnSubmissions({ offset: 0, limit: 20 }),
    () => context.bridge.getOwnSubmission({ submissionId: SUBMISSION_ID }),
    () => context.bridge.updateSubmissionDraft({ submissionId: SUBMISSION_ID, expectedRevision: 1, submission: PROPOSAL }),
    () => context.bridge.submitSubmission({ submissionId: SUBMISSION_ID, expectedRevision: 1 }),
    () => context.bridge.addSubmissionEvidence({ submissionId: SUBMISSION_ID, expectedRevision: 1, evidenceRefs: ["https://example.com/evidence"] }),
    () => context.bridge.withdrawSubmission({ submissionId: SUBMISSION_ID, expectedRevision: 1 })
  ];
  for (const call of calls) {
    const result = await call();
    assert.deepEqual(JSON.parse(JSON.stringify(result)), {
      ok: false,
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        status: 503,
        messageKey: "resources.submit.serviceUnavailable"
      }
    });
    assert.doesNotMatch(
      JSON.stringify(result),
      /identity:|ResourceSubmissionIpcError|postgres|secret|Error invoking|stack/i
    );
  }
});

test("main handlers re-check the current session and never accept renderer identity", async () => {
  const harness = ipcHarness();
  const mutations = [];
  const client = {
    current: async () => ({ status: "authenticated", user: { id: "owner" } }),
    getResourceSubmissionCapability: async () => ({
      enabled: false,
      supportedKinds: ["skill", "workflow"],
      temporarilyUnavailableKinds: ["workflow"],
      authenticationRequired: true,
      proposalSchemaVersion: 1
    }),
    createMyResourceSubmission: async (key, proposal) => {
      mutations.push({ key, proposal });
      return ownerSubmission();
    },
    listMyResourceSubmissions: async () => ({
      items: [ownerSubmission()],
      page: { offset: 0, limit: 20, nextOffset: null }
    }),
    getMyResourceSubmission: async () => ownerSubmission(),
    mutateMyResourceSubmission: async (id, input) => {
      mutations.push({ id, input });
      return ownerSubmission({ expectedRevision: input.expectedRevision + 1 });
    }
  };
  registerResourceSubmissionIpc(harness.ipcMain, {
    getIdentityClient: () => client,
    logError: () => {}
  });
  assert.deepEqual([...harness.handlers.keys()].sort(), Object.values(CHANNELS).sort());

  assert.deepEqual(await harness.invoke(CHANNELS.capability), {
    ok: true,
    value: {
      enabled: false,
      supportedKinds: ["skill", "workflow"],
      temporarilyUnavailableKinds: ["workflow"],
      authenticationRequired: true,
      proposalSchemaVersion: 1
    }
  });
  assert.deepEqual(await harness.invoke(CHANNELS.create, {
    idempotencyKey: "retry-1",
    submission: PROPOSAL
  }), { ok: true, value: ownerSubmission() });
  await harness.invoke(CHANNELS.update, {
    submissionId: SUBMISSION_ID,
    expectedRevision: 1,
    submission: PROPOSAL
  });
  await harness.invoke(CHANNELS.submit, {
    submissionId: SUBMISSION_ID,
    expectedRevision: 2
  });
  await harness.invoke(CHANNELS.evidence, {
    submissionId: SUBMISSION_ID,
    expectedRevision: 3,
    evidenceRefs: ["https://example.com/new-evidence"]
  });
  await harness.invoke(CHANNELS.withdraw, {
    submissionId: SUBMISSION_ID,
    expectedRevision: 4
  });
  assert.deepEqual(mutations.map((entry) => entry.input?.action).filter(Boolean), [
    "update",
    "submit",
    "evidence",
    "withdraw"
  ]);
  assert.equal(
    mutations.some((entry) => "identityId" in entry || "identityId" in (entry.input || {})),
    false
  );
});

test("main returns safe structured failures and keeps raw causes in diagnostics", async () => {
  const anonymousHarness = ipcHarness();
  let called = false;
  registerResourceSubmissionIpc(anonymousHarness.ipcMain, {
    getIdentityClient: () => ({
      current: async () => ({ status: "anonymous" }),
      getMyResourceSubmission: async () => {
        called = true;
      }
    }),
    logError: () => {}
  });
  assert.deepEqual(
    await anonymousHarness.invoke(CHANNELS.get, { submissionId: SUBMISSION_ID }),
    {
      ok: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        status: 401,
        messageKey: "resources.submit.loginRequired"
      }
    }
  );
  assert.equal(called, false);

  const failureHarness = ipcHarness();
  const diagnostics = [];
  registerResourceSubmissionIpc(failureHarness.ipcMain, {
    getIdentityClient: () => ({
      current: async () => ({ status: "authenticated" }),
      getMyResourceSubmission: async () => {
        const error = new Error("postgres connection string secret detail");
        error.status = 500;
        error.code = "DB_FAILURE";
        throw error;
      }
    }),
    logError: (...args) => diagnostics.push(args)
  });
  assert.deepEqual(
    await failureHarness.invoke(CHANNELS.get, { submissionId: SUBMISSION_ID }),
    {
      ok: false,
      error: {
        code: "TEMPORARILY_UNAVAILABLE",
        status: 503,
        messageKey: "resources.submit.serviceUnavailable"
      }
    }
  );
  assert.match(diagnostics[0][1].message, /postgres connection string/);
  assert.match(diagnostics[0][2].message, /postgres connection string/);

  const leakHarness = ipcHarness();
  registerResourceSubmissionIpc(leakHarness.ipcMain, {
    getIdentityClient: () => ({
      current: async () => ({ status: "authenticated" }),
      getMyResourceSubmission: async () =>
        ownerSubmission({ reviewerId: SUBMISSION_ID })
    }),
    logError: () => {}
  });
  assert.deepEqual(
    await leakHarness.invoke(CHANNELS.get, { submissionId: SUBMISSION_ID }),
    {
      ok: false,
      error: {
        code: "INVALID_IDENTITY_RESPONSE",
        status: 502,
        messageKey: "resources.submit.failed"
      }
    }
  );
});

test("main preserves only fixed submission status and message-key errors", async () => {
  const cases = [
    [
      { status: 409, code: "REVISION_CONFLICT" },
      { code: "REVISION_CONFLICT", status: 409, messageKey: "resources.submit.conflict" }
    ],
    [
      { status: 429, code: "RATE_LIMITED" },
      { code: "RATE_LIMITED", status: 429, messageKey: "resources.submit.rateLimited" }
    ],
    [
      { status: 503, code: "FEATURE_DISABLED" },
      { code: "FEATURE_DISABLED", status: 503, messageKey: "resources.submit.unavailable" }
    ],
    [
      { status: 503, code: "DB_SECRET_FAILURE" },
      { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "resources.submit.serviceUnavailable" }
    ]
  ];
  for (const [source, expected] of cases) {
    const harness = ipcHarness();
    registerResourceSubmissionIpc(harness.ipcMain, {
      getIdentityClient: () => ({
        current: async () => ({ status: "authenticated" }),
        getMyResourceSubmission: async () => {
          const error = new Error("private database URL and secret");
          Object.assign(error, source);
          throw error;
        }
      }),
      logError: () => {}
    });
    assert.deepEqual(
      await harness.invoke(CHANNELS.get, { submissionId: SUBMISSION_ID }),
      { ok: false, error: expected }
    );
  }

  const validationHarness = ipcHarness();
  registerResourceSubmissionIpc(validationHarness.ipcMain, {
    getIdentityClient: () => ({ current: async () => ({ status: "authenticated" }) }),
    logError: () => {}
  });
  assert.deepEqual(
    await validationHarness.invoke(CHANNELS.get, {
      submissionId: SUBMISSION_ID,
      reviewerId: SUBMISSION_ID
    }),
    {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        status: 400,
        messageKey: "resources.submit.invalid"
      }
    }
  );
});

test("main and preload wire the candidate without reviewer or public channels", () => {
  const root = path.join(__dirname, "..");
  const main = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
  const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
  const bridge = fs.readFileSync(
    path.join(root, "electron/resource-submission-ipc.cjs"),
    "utf8"
  );
  assert.match(main, /registerResourceSubmissionIpc\(ipcMain/);
  assert.match(preload, /\.\.\.resourceSubmissionBridge/);
  assert.doesNotMatch(bridge, /reviewSubmission|reviewer S2S|PublicContributionCard/);
  assert.doesNotMatch(preload, /identity:(?:review|public)-submission/);
});
