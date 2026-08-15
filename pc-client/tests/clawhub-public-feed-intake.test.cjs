"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const {
  CLAWHUB_FEED_MAX_BYTES,
  CLAWHUB_FEED_URLS,
  composeClawHubFirst100,
  fetchClawHubFirst100,
  serializeClawHubFirst100,
  validateClawHubFirst100
} = require("../shared/clawhub-public-feed.cjs");

const OUTER_KEYS = [
  "candidateOnly",
  "classification",
  "discoveryOnly",
  "publishable",
  "resources",
  "reviewLedger",
  "schemaVersion",
  "sourceId"
];
const REVIEW_LEDGER_KEYS = [
  "failureClass",
  "outcome",
  "rawVersion",
  "registryId",
  "resourceKind"
];
const RESOURCE_KEYS = [
  "candidateOnly",
  "canonicalUrl",
  "classification",
  "featured",
  "feedGeneratedAt",
  "feedId",
  "installProfileId",
  "latestObservedVersion",
  "ownerHandle",
  "pluginSubtype",
  "publishable",
  "publisherTrust",
  "registryId",
  "registryLicense",
  "resourceKind",
  "sourceCommit",
  "sourceId",
  "sourceLicense",
  "sourcePath",
  "sourceProvenance",
  "sourceRef",
  "sourceRepo",
  "state",
  "summary",
  "title",
  "versionLineageStatus"
];
const blockedArtifactPath = path.resolve(
  __dirname,
  "../docs/research/clawhub-official-feed-first100-discovery-2026-08-14.json"
);

async function intakeRunner() {
  const module = await import(
    pathToFileURL(
      path.resolve(__dirname, "../scripts/clawhub-public-feed-intake.mjs")
    ).href
  );
  return module.runClawHubFirst100Intake;
}

function entry(type, index, overrides = {}) {
  const owner = `publisher-${String(index).padStart(3, "0")}`;
  return {
    type,
    id: `@${owner}/resource-${String(index).padStart(3, "0")}`,
    title: `Resource ${index}`,
    description: `Description ${index}`,
    version: `1.0.${index}`,
    state: "available",
    featured: false,
    publisher: { id: owner, trust: "official" },
    install: { candidates: [{ command: "must-not-be-read", token: "secret" }] },
    ...overrides
  };
}

function feed(type, count) {
  return {
    schemaVersion: 1,
    id: type === "skill" ? "clawhub-official-skills" : "clawhub-official",
    generatedAt: "2026-08-14T12:31:01.498Z",
    sequence: 7,
    expiresAt: "2026-08-21T12:31:00.245Z",
    description: type === "skill" ? "Verified skills." : "Official plugins.",
    entries: Array.from({ length: count }, (_, index) => entry(type, count - index))
  };
}

function response(value, overrides = {}) {
  const body = overrides.rawBody ?? JSON.stringify(value);
  const chunks = overrides.chunks ?? [Buffer.from(body)];
  const counters = { reads: 0, cancels: 0, completed: false };
  let index = 0;
  const headers = {
    "content-type": "application/json",
    ...(overrides.headers || {})
  };
  return {
    response: {
      status: overrides.status ?? 200,
      url: overrides.url,
      headers: {
        get(name) {
          return headers[name.toLowerCase()] ?? null;
        }
      },
      body: {
        getReader() {
          return {
            async read() {
              counters.reads += 1;
              if (index < chunks.length) {
                return { done: false, value: chunks[index++] };
              }
              counters.completed = true;
              return { done: true };
            },
            async cancel() {
              counters.cancels += 1;
            },
            releaseLock() {}
          };
        }
      }
    },
    counters
  };
}

test("composes an exact deterministic 80 Skill + 20 Plugin discovery-only batch", () => {
  const result = composeClawHubFirst100({
    skillsFeed: feed("skill", 80),
    pluginsFeed: feed("plugin", 20)
  });

  assert.equal(result.resources.length, 100);
  assert.equal(result.resources.filter(({ resourceKind }) => resourceKind === "skill").length, 80);
  assert.equal(result.resources.filter(({ resourceKind }) => resourceKind === "plugin").length, 20);
  assert.equal(result.resources[0].registryId, "@publisher-001/resource-001");
  assert.equal(result.resources[79].registryId, "@publisher-080/resource-080");
  assert.equal(result.resources[80].registryId, "@publisher-001/resource-001");
  assert.equal(result.resources[99].registryId, "@publisher-020/resource-020");
  assert.equal(result.classification, "discovery-only");
  assert.equal(result.discoveryOnly, true);
  assert.equal(result.candidateOnly, true);
  assert.equal(result.publishable, false);
  assert.equal(result.reviewLedger.length, 100);
  assert.equal(
    result.reviewLedger.every(({ outcome, failureClass, rawVersion }) =>
      outcome === "discovered-unreviewed" &&
      failureClass === null &&
      rawVersion === null
    ),
    true
  );
});

test("keeps one exact metadata-deferred outcome for a locked AWS version token", () => {
  const skillsFeed = feed("skill", 80);
  const aws = skillsFeed.entries.at(-1);
  aws.id = "@aws/agents-build";
  aws.publisher.id = "aws";
  aws.version = "latest";

  const result = composeClawHubFirst100({
    skillsFeed,
    pluginsFeed: feed("plugin", 20)
  });
  const awsResource = result.resources.find(
    ({ registryId }) => registryId === "@aws/agents-build"
  );
  const awsOutcome = result.reviewLedger.find(
    ({ registryId }) => registryId === "@aws/agents-build"
  );

  assert.equal(result.discoveryOnly, true);
  assert.equal(result.resources.length, 100);
  assert.equal(result.reviewLedger.length, 100);
  assert.deepEqual(awsOutcome, {
    resourceKind: "skill",
    registryId: "@aws/agents-build",
    outcome: "metadata-deferred",
    failureClass: "version-invalid",
    rawVersion: "latest"
  });
  assert.equal(awsResource.latestObservedVersion, null);
  assert.equal(awsResource.versionLineageStatus, "metadata-deferred");

  const discovered = result.reviewLedger.filter(
    ({ outcome }) => outcome === "discovered-unreviewed"
  );
  assert.equal(discovered.length, 99);
  assert.equal(
    discovered.every(({ failureClass, rawVersion }) =>
      failureClass === null && rawVersion === null
    ),
    true
  );
});

test("fails the whole batch on strict schema, duplicate identity, or an invalid locked entry", () => {
  const valid = () => ({ skillsFeed: feed("skill", 80), pluginsFeed: feed("plugin", 20) });

  const extraField = valid();
  extraField.skillsFeed.unreviewed = true;
  assert.throws(() => composeClawHubFirst100(extraField), /feed schema/i);

  const duplicate = valid();
  duplicate.skillsFeed.entries[79] = structuredClone(duplicate.skillsFeed.entries[0]);
  assert.throws(() => composeClawHubFirst100(duplicate), /duplicate/i);

  const invalidLocked = { skillsFeed: feed("skill", 81), pluginsFeed: feed("plugin", 20) };
  invalidLocked.skillsFeed.entries.push(invalidLocked.skillsFeed.entries.shift());
  invalidLocked.skillsFeed.entries.at(-1).publisher.trust = "community";
  assert.equal(invalidLocked.skillsFeed.entries.at(-1).id, "@publisher-081/resource-081");
  invalidLocked.skillsFeed.entries.at(-1).id = "@publisher-000/resource-000";
  invalidLocked.skillsFeed.entries.at(-1).publisher.id = "publisher-000";
  assert.throws(() => composeClawHubFirst100(invalidLocked), /publisher trust/i);

  const wrongScope = valid();
  wrongScope.pluginsFeed.entries.at(-1).publisher.id = "someone-else";
  assert.throws(() => composeClawHubFirst100(wrongScope), /publisher scope/i);

  for (const mutate of [
    (item) => { delete item.version; },
    (item) => { item.version = 1; },
    (item) => { item.version = ""; },
    (item) => { item.version = "1.0.\n0"; },
    (item) => { item.version = `v${"a".repeat(64)}`; },
    (item) => { item.version = "1/2"; }
  ]) {
    const invalidVersionField = valid();
    mutate(invalidVersionField.skillsFeed.entries.at(-1));
    assert.throws(
      () => composeClawHubFirst100(invalidVersionField),
      /entry.*schema|version field/i
    );
  }

  const unavailable = valid();
  unavailable.pluginsFeed.entries.at(-1).state = "hidden";
  assert.throws(() => composeClawHubFirst100(unavailable), /available/i);
});

test("uses the full feed only for identity ordering and validates exact schema after locking", () => {
  const unlockedExtra = { skillsFeed: feed("skill", 121), pluginsFeed: feed("plugin", 20) };
  const sortedEntry120 = unlockedExtra.skillsFeed.entries.find(
    ({ id }) => id === "@publisher-120/resource-120"
  );
  assert.ok(sortedEntry120);
  sortedEntry120.unreviewed = true;
  assert.doesNotThrow(() => composeClawHubFirst100(unlockedExtra));

  const lockedExtra = { skillsFeed: feed("skill", 81), pluginsFeed: feed("plugin", 20) };
  assert.equal(lockedExtra.skillsFeed.entries.at(-1).id, "@publisher-001/resource-001");
  lockedExtra.skillsFeed.entries.at(-1).unreviewed = true;
  assert.throws(() => composeClawHubFirst100(lockedExtra), /entry.*schema/i);

  const unlockedWrongType = { skillsFeed: feed("skill", 81), pluginsFeed: feed("plugin", 20) };
  unlockedWrongType.skillsFeed.entries[0].type = "plugin";
  assert.throws(() => composeClawHubFirst100(unlockedWrongType), /wrong resource type/i);

  const unlockedDuplicate = { skillsFeed: feed("skill", 81), pluginsFeed: feed("plugin", 20) };
  unlockedDuplicate.skillsFeed.entries[0].id = unlockedDuplicate.skillsFeed.entries[1].id;
  assert.throws(() => composeClawHubFirst100(unlockedDuplicate), /duplicate/i);
});

test("never reads install candidates and serializes only the discovery allowlist byte-identically", () => {
  const skillsFeed = feed("skill", 80);
  let installReads = 0;
  Object.defineProperty(skillsFeed.entries.at(-1), "install", {
    enumerable: true,
    get() {
      installReads += 1;
      throw new Error("install candidates were read");
    }
  });

  const result = composeClawHubFirst100({
    skillsFeed,
    pluginsFeed: feed("plugin", 20)
  });
  assert.equal(installReads, 0);
  assert.deepEqual(Object.keys(result).sort(), OUTER_KEYS);
  for (const resource of result.resources) {
    assert.deepEqual(Object.keys(resource).sort(), RESOURCE_KEYS);
  }
  for (const outcome of result.reviewLedger) {
    assert.deepEqual(Object.keys(outcome).sort(), REVIEW_LEDGER_KEYS);
  }
  assert.equal(result.resources[0].registryLicense, "MIT-0");
  assert.equal(result.resources[80].registryLicense, "unknown");
  assert.equal(result.resources[80].sourceLicense, "unknown");
  assert.equal(result.resources[80].pluginSubtype, null);

  const forbidden = new Set([
    "args",
    "artifactUrl",
    "catalog",
    "command",
    "credentials",
    "downloadUrl",
    "endpoint",
    "env",
    "fileBytes",
    "headers",
    "install",
    "installCandidate",
    "stateWrite",
    "token"
  ]);
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        assert.equal(forbidden.has(key), false, `forbidden output field: ${key}`);
        visit(child);
      }
    }
  };
  visit(result);

  const first = serializeClawHubFirst100(result);
  const second = serializeClawHubFirst100(result);
  assert.equal(first, second);
  assert.equal(first.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(first), result);
});

test("one exact artifact validator protects new results and canonical cached bytes", () => {
  const artifact = composeClawHubFirst100({
    skillsFeed: feed("skill", 80),
    pluginsFeed: feed("plugin", 20)
  });
  assert.equal(validateClawHubFirst100(artifact), artifact);

  function rejected(mutator, pattern) {
    const value = structuredClone(artifact);
    mutator(value);
    assert.throws(() => validateClawHubFirst100(value), pattern);
    assert.throws(() => serializeClawHubFirst100(value), pattern);
  }
  rejected((value) => { value.unknown = true; }, /artifact schema/i);
  rejected((value) => { value.resources[0].unknown = true; }, /resource.*schema/i);
  rejected((value) => { value.resources.pop(); }, /80 Skill.*20 Plugin/i);
  rejected((value) => { value.reviewLedger.pop(); }, /100 outcomes/i);
  rejected((value) => { value.resources[1] = structuredClone(value.resources[0]); }, /duplicate/i);
  rejected((value) => { value.discoveryOnly = false; }, /artifact identity/i);
  rejected((value) => { value.candidateOnly = false; }, /candidateOnly/i);
  rejected((value) => { value.publishable = true; }, /publishable/i);
  rejected((value) => { value.resources[0].candidateOnly = false; }, /discovery identity/i);
  rejected((value) => { value.resources[0].publishable = true; }, /discovery identity/i);
  rejected((value) => { value.resources[0].installProfileId = "managed"; }, /installProfileId/i);
  rejected((value) => { value.resources[0].canonicalUrl = "https://example.com"; }, /source fields/i);
  rejected((value) => { value.resources[0].sourceRepo = "https://example.com"; }, /source fields/i);
  rejected((value) => { value.resources[0].sourceProvenance = "verified"; }, /source provenance/i);
  rejected((value) => { value.resources[0].sourceLicense = "MIT-0"; }, /source license/i);
  rejected((value) => { value.resources[0].publisherTrust = "community"; }, /publisher trust/i);
  rejected((value) => { value.resources[0].registryLicense = "unknown"; }, /Skill license/i);
  rejected((value) => { value.resources[80].registryLicense = "MIT-0"; }, /Plugin license/i);
  rejected((value) => { value.resources[80].pluginSubtype = "code-plugin"; }, /Plugin subtype/i);
  rejected((value) => { value.reviewLedger[0].registryId = "@other/resource"; }, /outcome identity/i);
  rejected((value) => {
    value.reviewLedger[0] = {
      ...value.reviewLedger[0],
      outcome: "metadata-deferred",
      failureClass: "version-invalid",
      rawVersion: "<script>"
    };
  }, /discovery facts/i);
  for (const field of ["command", "credentials", "endpoint", "install"]) {
    rejected((value) => { value.resources[0][field] = "forbidden"; }, /resource.*schema/i);
  }
});

test("fetches the two exact public feeds once and sequentially with manual redirects", async () => {
  const skills = response(feed("skill", 80), { url: CLAWHUB_FEED_URLS.skill });
  const plugins = response(feed("plugin", 20), { url: CLAWHUB_FEED_URLS.plugin });
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === CLAWHUB_FEED_URLS.skill) return skills.response;
    assert.equal(skills.counters.completed, true, "plugin GET started before skill body completed");
    return plugins.response;
  };

  const result = await fetchClawHubFirst100({ fetchImpl });
  assert.equal(result.resources.length, 100);
  assert.deepEqual(calls, [
    {
      url: CLAWHUB_FEED_URLS.skill,
      options: { method: "GET", redirect: "manual", headers: { Accept: "application/json" } }
    },
    {
      url: CLAWHUB_FEED_URLS.plugin,
      options: { method: "GET", redirect: "manual", headers: { Accept: "application/json" } }
    }
  ]);
  assert.equal(skills.counters.completed, true);
  assert.equal(plugins.counters.completed, true);
});

test("stops without retry or body reads on auth, rate-limit, redirect, URL, and content gates", async () => {
  for (const status of [401, 403, 429]) {
    const blocked = response({}, { status, url: CLAWHUB_FEED_URLS.skill });
    let calls = 0;
    await assert.rejects(
      fetchClawHubFirst100({ fetchImpl: async () => (calls += 1, blocked.response) }),
      new RegExp(String(status))
    );
    assert.equal(calls, 1);
    assert.equal(blocked.counters.reads, 0);
  }

  const cases = [
    response({}, { status: 302, url: CLAWHUB_FEED_URLS.skill }),
    response({}, { url: "https://example.invalid/feed" }),
    response({}, { url: CLAWHUB_FEED_URLS.skill, headers: { "content-type": "text/html" } }),
    response({}, { url: CLAWHUB_FEED_URLS.skill, headers: { "content-type": null } }),
    response({}, {
      url: CLAWHUB_FEED_URLS.skill,
      headers: { "content-length": String(CLAWHUB_FEED_MAX_BYTES + 1) }
    })
  ];
  for (const blocked of cases) {
    await assert.rejects(fetchClawHubFirst100({ fetchImpl: async () => blocked.response }));
    assert.equal(blocked.counters.reads, 0);
  }
});

test("stops the whole batch when the second feed is rate-limited and caps streamed bytes", async () => {
  const skills = response(feed("skill", 80), { url: CLAWHUB_FEED_URLS.skill });
  const limited = response({}, { status: 429, url: CLAWHUB_FEED_URLS.plugin });
  let calls = 0;
  await assert.rejects(
    fetchClawHubFirst100({
      fetchImpl: async () => (++calls === 1 ? skills.response : limited.response)
    }),
    /429/
  );
  assert.equal(calls, 2);
  assert.equal(skills.counters.completed, true);
  assert.equal(limited.counters.reads, 0);

  const oversized = response({}, {
    url: CLAWHUB_FEED_URLS.skill,
    chunks: [Buffer.alloc(CLAWHUB_FEED_MAX_BYTES + 1)]
  });
  await assert.rejects(fetchClawHubFirst100({ fetchImpl: async () => oversized.response }));
  assert.equal(oversized.counters.reads, 1);
  assert.equal(oversized.counters.cancels, 1);
});

test("intake runner rejects a malicious but canonically formatted cache", async () => {
  const runClawHubIntake = await intakeRunner();
  assert.equal(typeof runClawHubIntake, "function");
  const malicious = composeClawHubFirst100({
    skillsFeed: feed("skill", 80),
    pluginsFeed: feed("plugin", 20)
  });
  malicious.resources[0].installProfileId = "managed";
  const bytes = `${JSON.stringify(malicious, null, 2)}\n`;
  const counters = { reads: 0, fetches: 0, opens: 0, writes: 0 };
  const fsImpl = {
    async stat() { return { isDirectory: () => true }; },
    async readFile() { counters.reads += 1; return bytes; },
    async open() {
      counters.opens += 1;
      return {
        async writeFile() { counters.writes += 1; },
        async sync() {},
        async close() {}
      };
    }
  };

  await assert.rejects(
    runClawHubIntake({
      fsImpl,
      fetchImpl: async () => { counters.fetches += 1; throw new Error("must not fetch"); }
    }),
    /installProfileId/i
  );
  assert.deepEqual(counters, { reads: 1, fetches: 0, opens: 0, writes: 0 });
});

test("invalid version token runner fetches each feed once and writes one discovery artifact", async () => {
  assert.equal(fs.existsSync(blockedArtifactPath), false, "synthetic test must not use a real artifact");
  const runClawHubFirst100Intake = await intakeRunner();
  assert.equal(typeof runClawHubFirst100Intake, "function");
  const skillsFeed = feed("skill", 80);
  const aws = skillsFeed.entries.at(-1);
  aws.id = "@aws/agents-build";
  aws.publisher.id = "aws";
  aws.version = "latest";
  const skills = response(skillsFeed, { url: CLAWHUB_FEED_URLS.skill });
  const plugins = response(feed("plugin", 20), { url: CLAWHUB_FEED_URLS.plugin });
  const counters = { fetches: 0, opens: 0, writes: 0 };
  const calls = [];
  let writtenBytes = null;
  const missing = Object.assign(new Error("missing"), { code: "ENOENT" });
  const fsImpl = {
    async stat() { return { isDirectory: () => true }; },
    async readFile() { throw missing; },
    async open(target, flags) {
      counters.opens += 1;
      assert.equal(target, blockedArtifactPath);
      assert.equal(flags, "wx");
      return {
        async writeFile(bytes, encoding) {
          counters.writes += 1;
          writtenBytes = bytes;
          assert.equal(encoding, "utf8");
        },
        async sync() {},
        async close() {}
      };
    }
  };

  const result = await runClawHubFirst100Intake({
    fsImpl,
    fetchImpl: async (url) => {
      counters.fetches += 1;
      calls.push(url);
      return url === CLAWHUB_FEED_URLS.skill ? skills.response : plugins.response;
    }
  });
  assert.deepEqual(result, { status: "written", resources: 100 });
  assert.deepEqual(calls, [CLAWHUB_FEED_URLS.skill, CLAWHUB_FEED_URLS.plugin]);
  assert.deepEqual(counters, { fetches: 2, opens: 1, writes: 1 });
  assert.equal(skills.counters.completed, true);
  assert.equal(plugins.counters.completed, true);
  const artifact = validateClawHubFirst100(JSON.parse(writtenBytes));
  assert.equal(serializeClawHubFirst100(artifact), writtenBytes);
  assert.deepEqual(
    artifact.reviewLedger.find(({ registryId }) => registryId === "@aws/agents-build"),
    {
      resourceKind: "skill",
      registryId: "@aws/agents-build",
      outcome: "metadata-deferred",
      failureClass: "version-invalid",
      rawVersion: "latest"
    }
  );
  assert.equal(fs.existsSync(blockedArtifactPath), false, "synthetic test must not write a real artifact");
});
