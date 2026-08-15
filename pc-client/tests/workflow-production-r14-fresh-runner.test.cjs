"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const inner = fs.readFileSync(path.join(root, "scripts", "workflow-production-r14-fresh-inner.cjs"), "utf8");
const driver = fs.readFileSync(path.join(root, "scripts", "test-workflow-production-r14-fresh.cjs"), "utf8");
const imageReferenceProbe = fs.readFileSync(path.join(root, "scripts", "test-workflow-production-r14-official-image-reference.cjs"), "utf8");
const innerModule = require("../scripts/workflow-production-r14-fresh-inner.cjs");
const referenceProbeModule = require("../scripts/test-workflow-production-r14-official-image-reference.cjs");
const { projectInnerTerminal, INNER_TERMINAL_INVALID, ensureOuterDockerAvailable, cleanupOuterResources, FRESH_CANDIDATE, RELEASE_ROOT, requireFreshCandidate } = require("../scripts/test-workflow-production-r14-fresh.cjs");

test("r14 fresh local gate uses one project and the prepared migration/bootstrap/verifier seams", () => {
  assert.match(inner, /const PROJECT = "zhenxing-community-production"/);
  assert.match(inner, /workflow-production-fresh-secret-authority\.sh/);
  assert.match(inner, /catalog-active7-fresh-install\.cjs/);
  assert.match(inner, /identity-migrate/); assert.match(inner, /community-migrate/);
  assert.match(inner, /workflow-official-bootstrap-production-wrapper\.cjs/);
  assert.match(inner, /createR12FixedCollector/); assert.match(inner, /verifyExistingWorkflowState/);
  assert.match(inner, /\[9, 9, 9\]/); assert.match(inner, /sourcePosts: 3/);
  assert.match(inner, /resourceTablesAbsent: true/);
  assert.match(inner, /stop", "caddy", "community", "identity", "admin", "community-database", "identity-database"/);
  assert.doesNotMatch(inner, /resource-submissions\.sql|\bDELETE\b|docker system prune|down.*--volumes/i);
});

test("r14 fresh outer gate is one private DinD and leaves no runner-owned container or volume", () => {
  assert.match(driver, /workflow-production-r14-e177ec06-memory-gate-removed-20260811\.bundle/);
  assert.match(driver, /--cgroupns=private/);
  assert.match(driver, /cleanup/);
  assert.doesNotMatch(driver, /--cgroupns=host|\/sys\/fs\/cgroup:.*rw|docker.*pull/i);
});

test("r14 fresh driver and inner bind only the exact e177ec candidate before Docker", () => {
  const expected = {
    bundleName: "workflow-production-r14-e177ec06-memory-gate-removed-20260811.bundle",
    deploymentSetDigest: "e177ec0681071769f776c873d5bd34cf42684c2720e523749bc9652a68c7a6cf",
    deploymentManifestSha256: "bf6a40fe5f873d93c37b50e277db84648036798f7e34f672ca3327786e67da87",
    payloadDigest: "626ba670e1252ef1c6535e6ae2bff0353ed2e5762a368930fe2e8e44a309b27e",
    bundleManifestSha256: "ae15278da93970232b243ff3c6e49566fa06075be939be3a2ae5278d58a14b1c",
    bundleTableSha256: "5e2003cf0ba7be016f5c84fb26de99288b038148cb391a889e2ef79982d2114c",
    releaseName: "community-production-r14-e177ec06",
    innerSha256: "453a1f1e72edc89eaff72aa476db2407ce2e74490161d9250fc5349f48ef1b83"
  };
  assert.deepEqual(FRESH_CANDIDATE, expected);
  assert.equal(FRESH_CANDIDATE.innerSha256, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "scripts", "workflow-production-r14-fresh-inner.cjs"))).digest("hex"));
  assert.equal(path.basename(RELEASE_ROOT), expected.releaseName);
  assert.equal(innerModule.RELEASE, RELEASE_ROOT);
  assert.doesNotMatch(driver, /b95faa2f/);
  assert.doesNotMatch(inner, /b95faa2f/);
  assert.doesNotMatch(driver, /45a1026a/);
  assert.doesNotMatch(inner, /45a1026a/);

  const closure = Object.fromEntries(["deploymentSetDigest", "deploymentManifestSha256", "payloadDigest", "bundleManifestSha256", "bundleTableSha256"].map((key) => [key, expected[key]]));
  assert.deepEqual(requireFreshCandidate(closure, FRESH_CANDIDATE.innerSha256), Object.fromEntries(Object.entries(expected).filter(([key]) => key !== "innerSha256")));
  for (const key of Object.keys(closure)) assert.throws(() => requireFreshCandidate({ ...closure, [key]: "0".repeat(64) }, FRESH_CANDIDATE.innerSha256), (error) => {
    assert.deepEqual(error.outerFailure, { stage: "candidate-binding", code: "R14_FRESH_CANDIDATE_BINDING_FAILED" });
    return true;
  });
  assert.throws(() => requireFreshCandidate(closure, "0".repeat(64)), (error) => {
    assert.deepEqual(error.outerFailure, { stage: "candidate-binding", code: "R14_FRESH_CANDIDATE_BINDING_FAILED" });
    return true;
  });
  assert.throws(() => projectInnerTerminal({}), /r14 fresh inner terminal invalid/);
});

test("r14 official digest archives are verified by immutable ID before their fixed Compose tag is restored", () => {
  for (const image of innerModule.OFFICIAL) {
    assert.equal(image.ref, `${image.inspectRef}@${image.id}`);
  }
  assert.match(imageReferenceProbe, /docker", "load"/);
  assert.match(imageReferenceProbe, /docker", "tag", IMAGE\.id, IMAGE\.tag/);
  assert.match(imageReferenceProbe, /"create", "--pull", "never"/);
  assert.match(imageReferenceProbe, /IMAGE\.digestRef/);
  assert.doesNotMatch(imageReferenceProbe, /call\(\["(?:pull|build|push)"/);
});

test("r14 official-image reference probe accepts only the complete observed nested-DinD projection", () => {
  const projection = {
    loadStatus: true,
    imageId: "sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193",
    imageIdExact: true,
    repoTagsCount: 0,
    fixedTagPresentBefore: false,
    repoDigestsCount: 0,
    fixedDigestPresentBefore: false,
    inspectById: true,
    inspectByTagBefore: false,
    inspectByDigestBefore: false,
    pinnedCreateBeforeTag: false,
    fixedTagCreatedFromExactId: true,
    inspectByTagAfter: true,
    inspectByDigestAfter: true,
    pinnedCreateAfterTag: true
  };
  assert.equal(referenceProbeModule.referenceChecksExact(projection), true);
  for (const key of ["loadStatus", "imageIdExact", "fixedTagPresentBefore", "fixedDigestPresentBefore", "inspectById", "inspectByTagBefore", "inspectByDigestBefore", "pinnedCreateBeforeTag", "fixedTagCreatedFromExactId", "inspectByTagAfter", "inspectByDigestAfter", "pinnedCreateAfterTag"]) {
    assert.equal(referenceProbeModule.referenceChecksExact({ ...projection, [key]: !projection[key] }), false, key);
  }
  assert.equal(referenceProbeModule.referenceChecksExact({ ...projection, repoTagsCount: 1 }), false);
  assert.equal(referenceProbeModule.referenceChecksExact({ ...projection, repoDigestsCount: 1 }), false);
  assert.equal(referenceProbeModule.referenceChecksExact({ ...projection, imageId: "sha256:wrong" }), false);
  assert.equal(referenceProbeModule.referenceChecksExact({ ...projection, unexpected: true }), false);
});

test("r14 outer Docker prerequisite and cleanup require successful commands and observed zero residue", () => {
  const unavailable = () => ({ status: 1, stdout: "", stderr: "/secret/path" });
  assert.throws(() => ensureOuterDockerAvailable(unavailable), (error) => {
    assert.deepEqual(error.outerFailure, { stage: "outer-docker-unavailable", code: "R14_FRESH_OUTER_DOCKER_UNAVAILABLE" });
    assert.doesNotMatch(JSON.stringify(error.outerFailure), /secret|path|raw/i);
    return true;
  });
  const calls = [];
  const noResourcesWereCreated = cleanupOuterResources({ dockerCall: (args) => { calls.push(args); return unavailable(); }, container: "runner", volume: "runner-volume", containerCreated: false, volumeCreated: false, removeTemporary() {}, privateRootPresent: () => false });
  assert.deepEqual(calls, []);
  assert.equal(noResourcesWereCreated.completed, true);
  assert.deepEqual({ containerCreated: noResourcesWereCreated.containerCreated, volumeCreated: noResourcesWereCreated.volumeCreated }, { containerCreated: false, volumeCreated: false });
  const success = () => ({ status: 0, stdout: "", stderr: "" });
  const clean = cleanupOuterResources({ dockerCall: success, container: "runner", volume: "runner-volume", containerCreated: true, volumeCreated: true, removeTemporary() {}, privateRootPresent: () => false });
  assert.equal(clean.completed, true); assert.equal(clean.containers, 0); assert.equal(clean.volumes, 0);
  assert.equal(clean.containerRemovalStatus, 0); assert.equal(clean.volumeRemovalStatus, 0);
  assert.equal(clean.containerQueryStatus, 0); assert.equal(clean.volumeQueryStatus, 0);
  const queryUnavailable = cleanupOuterResources({ dockerCall: (args) => args[0] === "volume" && args[1] === "rm" ? success() : unavailable(), container: "runner", volume: "runner-volume", containerCreated: false, volumeCreated: true, removeTemporary() {}, privateRootPresent: () => false });
  assert.equal(queryUnavailable.completed, false); assert.equal(queryUnavailable.volumes, null); assert.equal(queryUnavailable.volumeRemovalStatus, 0); assert.equal(queryUnavailable.volumeQueryStatus, 1);
  const removalFailure = cleanupOuterResources({ dockerCall: (args) => args[0] === "rm" ? unavailable() : success(), container: "runner", volume: "runner-volume", containerCreated: true, volumeCreated: false, removeTemporary() {}, privateRootPresent: () => false });
  assert.equal(removalFailure.completed, false); assert.equal(removalFailure.containerRemovalStatus, 1); assert.equal(removalFailure.containerQueryStatus, 0);
  const volumeRemovalFailure = cleanupOuterResources({ dockerCall: (args) => args[0] === "volume" && args[1] === "rm" ? unavailable() : success(), container: "runner", volume: "runner-volume", containerCreated: false, volumeCreated: true, removeTemporary() {}, privateRootPresent: () => false });
  assert.equal(volumeRemovalFailure.completed, false); assert.equal(volumeRemovalFailure.volumeRemovalStatus, 1); assert.equal(volumeRemovalFailure.volumeQueryStatus, 0);
  const emptyFailedQuery = cleanupOuterResources({ dockerCall: (args) => args[0] === "ps" ? unavailable() : success(), container: "runner", volume: "runner-volume", containerCreated: true, volumeCreated: false, removeTemporary() {}, privateRootPresent: () => false });
  assert.equal(emptyFailedQuery.completed, false); assert.equal(emptyFailedQuery.containers, null); assert.equal(emptyFailedQuery.containerQueryStatus, 1);
});

test("r14 fresh prepare failures have exact safe stages and reach the outer terminal", () => {
  assert.match(inner, /function runPreparePhase\(/);
  for (const image of ["postgres", "mariadb", "caddy", "admin", "identity", "flarum"]) {
    assert.match(inner, new RegExp(`R14_FRESH_${image.toUpperCase()}_LOAD_FAILED`));
    assert.match(inner, new RegExp(`R14_FRESH_${image.toUpperCase()}_INSPECT_FAILED`));
    assert.match(inner, new RegExp(`R14_FRESH_${image.toUpperCase()}_IMAGE_ID_DRIFT`));
  }
  assert.match(inner, /R14_FRESH_PREPARE_DIRECTORIES_MKDIR_FAILED/);
  assert.match(inner, /R14_FRESH_PREPARE_DIRECTORIES_OWNER_FAILED/);
  assert.match(inner, /privateRoots: runnerPrivateRoots\(\)/);
  assert.match(driver, /projectInnerTerminal/);
  assert.doesNotMatch(driver, /failure = \{ stage: officialImageExportFailureStage\(error\?\.stage, stage\), code: "R14_FRESH_DRIVER_FAILED" \}/);
});

test("r14 prepare classifies directory mkdir, mode, owner and every fixed image failure without raw output", () => {
  const ok = { status: 0, stdout: "" };
  const images = [...innerModule.OFFICIAL, ...innerModule.CUSTOM];
  assert.deepEqual(innerModule.OFFICIAL.map(({ inspectRef }) => inspectRef), ["postgres:17-alpine", "mariadb:11.8", "caddy:2.10-alpine"]);
  const inspected = (args) => ({ status: 0, stdout: JSON.stringify([{ Id: images.find((candidate) => candidate.inspectRef === args.at(-1) || candidate.ref === args.at(-1) || candidate.id === args.at(-1)).id }]) });
  assert.throws(() => innerModule.prepareDirectories({ mkdirSync() { throw new Error("/secret/path"); }, chmodSync() {}, command: () => ok }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: "prepare-directories-mkdir", code: "R14_FRESH_PREPARE_DIRECTORIES_MKDIR_FAILED" }); return true; });
  assert.throws(() => innerModule.prepareDirectories({ mkdirSync() {}, chmodSync() {}, command: () => ({ status: 1, stderr: "/secret/path" }) }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: "prepare-directories-owner", code: "R14_FRESH_PREPARE_DIRECTORIES_OWNER_FAILED" }); return true; });
  assert.throws(() => innerModule.prepareDirectories({ mkdirSync() {}, chmodSync() { throw new Error("/secret/path"); }, command: () => ok }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: "prepare-directories-mode", code: "R14_FRESH_PREPARE_DIRECTORIES_MODE_FAILED" }); return true; });
  for (const image of images) {
    assert.throws(() => innerModule.loadImages({ docker: (args) => args[0] === "load" ? (args.at(-1) === image.archive ? { status: 1, stderr: "/secret/path" } : ok) : inspected(args) }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: `prepare-image-${image.name}-load`, code: innerModule.PREPARE_IMAGE_FAILURES[image.name].load }); return true; });
    const initialInspectRef = innerModule.OFFICIAL.includes(image) ? image.id : image.inspectRef;
    assert.throws(() => innerModule.loadImages({ docker: (args) => args[0] === "load" ? ok : (args.at(-1) === initialInspectRef ? { status: 1, stderr: "image output" } : inspected(args)) }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: `prepare-image-${image.name}-inspect`, code: innerModule.PREPARE_IMAGE_FAILURES[image.name].inspect }); return true; });
    assert.throws(() => innerModule.loadImages({ docker: (args) => args[0] === "load" ? ok : (args.at(-1) === initialInspectRef ? { status: 0, stdout: JSON.stringify([{ Id: "sha256:wrong" }]) } : inspected(args)) }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: `prepare-image-${image.name}-id`, code: innerModule.PREPARE_IMAGE_FAILURES[image.name].id }); return true; });
    if (innerModule.OFFICIAL.includes(image)) {
      assert.throws(() => innerModule.loadImages({ docker: (args) => args[0] === "tag" && args[1] === image.id ? { status: 1, stderr: "/secret/path" } : (args[0] === "load" ? ok : inspected(args)) }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: `prepare-image-${image.name}-tag`, code: innerModule.PREPARE_IMAGE_FAILURES[image.name].tag }); return true; });
      let tagged = false;
      assert.throws(() => innerModule.loadImages({ docker: (args) => {
        if (args[0] === "tag" && args[1] === image.id) { tagged = true; return ok; }
        if (tagged && args[0] === "image" && args.at(-1) === image.ref) return { status: 1, stderr: "image output" };
        return args[0] === "load" ? ok : inspected(args);
      } }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: `prepare-image-${image.name}-ref-inspect`, code: innerModule.PREPARE_IMAGE_FAILURES[image.name]["ref-inspect"] }); return true; });
      tagged = false;
      assert.throws(() => innerModule.loadImages({ docker: (args) => {
        if (args[0] === "tag" && args[1] === image.id) { tagged = true; return ok; }
        if (tagged && args[0] === "image" && args.at(-1) === image.ref) return { status: 0, stdout: JSON.stringify([{ Id: "sha256:wrong" }]) };
        return args[0] === "load" ? ok : inspected(args);
      } }), (error) => { assert.deepEqual(innerModule.safePrepareFailure(error), { stage: `prepare-image-${image.name}-ref-id`, code: innerModule.PREPARE_IMAGE_FAILURES[image.name]["ref-id"] }); return true; });
    }
  }
  const imageCalls = [];
  innerModule.loadImages({ docker: (args) => {
    if (args[0] === "load") return ok;
    imageCalls.push(args); return args[0] === "tag" ? ok : inspected(args);
  } });
  assert.deepEqual(imageCalls, [
    ...innerModule.OFFICIAL.flatMap((image) => [["image", "inspect", image.id], ["tag", image.id, image.inspectRef], ["image", "inspect", image.ref]]),
    ...innerModule.CUSTOM.map((image) => ["image", "inspect", image.inspectRef])
  ]);
  assert.deepEqual(innerModule.safePrepareFailure(new Error("/secret/path")), { stage: "unknown", code: "R14_FRESH_UNKNOWN_FAILED" });
  assert.deepEqual(innerModule.safeInnerFailure(new Error("/secret/path"), "prepare"), { stage: "unknown", code: "R14_FRESH_UNKNOWN_FAILED" });
  assert.deepEqual(innerModule.safeInnerFailure(new Error("/secret/path"), "catalog-terminal-invalid"), { stage: "catalog-terminal-invalid", code: "R14_FRESH_CATALOG_TERMINAL_INVALID" });
  assert.deepEqual(innerModule.safeInnerFailure(new Error("/secret/path"), "untrusted"), { stage: "unknown", code: "R14_FRESH_UNKNOWN_FAILED" });
  assert.equal(innerModule.runnerPrivateRoots(() => true), 1);
  assert.equal(innerModule.runnerPrivateRoots(() => false), 0);
});

test("r14 outer projects only an allowlisted blocked inner terminal", () => {
  const terminal = { schema: "aihub-workflow-production-r14-fresh-local-v1", candidateOnly: true, deployable: false, serverConnected: false, serverWritten: false, status: "blocked", checks: {}, cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0, downStatus: 0 }, failure: { stage: "prepare-image-caddy-inspect", code: "R14_FRESH_CADDY_INSPECT_FAILED" } };
  assert.deepEqual(projectInnerTerminal(terminal), terminal.failure);
  const tagTerminal = { ...terminal, failure: { stage: "prepare-image-postgres-ref-id", code: "R14_FRESH_POSTGRES_REF_ID_DRIFT" } };
  assert.deepEqual(projectInnerTerminal(tagTerminal), tagTerminal.failure);
  const reject = (value) => assert.throws(() => projectInnerTerminal(value), (error) => {
    assert.deepEqual(error.innerTerminal, INNER_TERMINAL_INVALID);
    assert.doesNotMatch(JSON.stringify(error.innerTerminal), /secret|path|raw/i);
    return true;
  });
  reject({ ...terminal, raw: "/opt/zhenxing-ai/secret" });
  reject({ ...terminal, failure: { stage: "prepare", code: "R14_FRESH_LOCAL_FAILED" } });
  reject({ ...terminal, failure: { stage: "prepare-image-caddy-inspect", code: "R14_FRESH_POSTGRES_LOAD_FAILED" } });
  reject({ ...terminal, failure: { stage: "prepare-image-postgres-ref-id", code: "R14_FRESH_POSTGRES_REF_INSPECT_FAILED" } });
  reject({ ...terminal, failure: { ...terminal.failure, code: "R14_FRESH_CADDY_INSPECT_FAILED:/secret" } });
  for (const [key, value] of [["candidateOnly", false], ["deployable", true], ["serverConnected", true], ["serverWritten", true]]) reject({ ...terminal, [key]: value });
  for (const [key, value] of [["completed", false], ["containers", 1], ["networks", 1], ["volumes", 1], ["privateRoots", 1], ["downStatus", 1]]) reject({ ...terminal, cleanup: { ...terminal.cleanup, [key]: value } });
});

test("r14 inner accepts only exact catalog failure envelopes and projects their pair to the outer terminal", () => {
  const pairs = innerModule.CATALOG_FAILURE_CODES_BY_STAGE;
  assert.deepEqual(pairs, require("../deployment/community-production/catalog-active7-fresh-install.cjs").CATALOG_FAILURE_CODES_BY_STAGE);
  assert.equal(new Set(Object.values(pairs)).size, Object.keys(pairs).length);
  const execution = (failure, overrides = {}) => ({
    status: 1,
    signal: null,
    error: undefined,
    stderr: "",
    stdout: `${JSON.stringify({ schema: "aihub-catalog-active7-fresh-install-v1", status: "blocked", failure })}\n`,
    ...overrides
  });
  for (const [stage, code] of Object.entries(pairs)) {
    assert.throws(() => innerModule.requireCatalogInstall(execution({ stage, code })), (error) => {
      assert.deepEqual(innerModule.safeInnerFailure(error, "catalog-terminal-invalid"), { stage, code });
      return true;
    });
    const terminal = { schema: "aihub-workflow-production-r14-fresh-local-v1", candidateOnly: true, deployable: false, serverConnected: false, serverWritten: false, status: "blocked", checks: {}, cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0, downStatus: 0 }, failure: { stage, code } };
    assert.deepEqual(projectInnerTerminal(terminal), { stage, code });
  }
  const reject = (value) => assert.throws(() => innerModule.requireCatalogInstall(value), (error) => {
    assert.deepEqual(innerModule.safeInnerFailure(error, "catalog-terminal-invalid"), { stage: "catalog-terminal-invalid", code: "R14_FRESH_CATALOG_TERMINAL_INVALID" });
    assert.doesNotMatch(JSON.stringify(error), /secret|raw|path|stack|message/i);
    return true;
  });
  const first = Object.entries(pairs)[0];
  const second = Object.entries(pairs)[1];
  reject(execution({ stage: first[0], code: second[1] }));
  reject(execution({ stage: "catalog", code: "R14_FRESH_LOCAL_FAILED" }));
  reject(execution({ stage: first[0], code: first[1], raw: "/secret/path" }));
  reject(execution({ stage: first[0], code: first[1] }, { stdout: `${JSON.stringify({ schema: "aihub-catalog-active7-fresh-install-v1", status: "blocked", failure: { stage: first[0], code: first[1] } })}\n{}\n` }));
  reject(execution({ stage: first[0], code: first[1] }, { stderr: "raw error" }));
  reject(execution({ stage: first[0], code: first[1] }, { status: 0 }));
});

test("r14 inner attributes each post-catalog prerequisite to one fixed safe pair", () => {
  const expected = {
    "caddy-data-volume": "R14_FRESH_CADDY_DATA_VOLUME_FAILED",
    "caddy-config-volume": "R14_FRESH_CADDY_CONFIG_VOLUME_FAILED",
    "caddy-secret-volume-seed": "R14_FRESH_CADDY_SECRET_VOLUME_SEED_FAILED",
    "compose-contract": "R14_FRESH_COMPOSE_CONTRACT_FAILED"
  };
  for (const [stage, code] of Object.entries(expected)) assert.equal(innerModule.INNER_FAILURE_CODES_BY_STAGE[stage], code);

  const volumeFailure = (call) => assert.throws(() => innerModule.createVolumes({
    docker: (args) => call(args) ? { status: 1 } : { status: 0 },
    command: () => call(["secret-seed"]) ? { status: 1 } : { status: 0 }
  }), (error) => {
    assert.deepEqual(innerModule.safeInnerFailure(error, "catalog-terminal-invalid"), expected[error.stage] ? { stage: error.stage, code: expected[error.stage] } : null);
    assert.doesNotMatch(JSON.stringify(error), /\/|raw|path|stack|message/i);
    return true;
  });
  volumeFailure((args) => args[1] === "create" && args[2] === "r14_fresh_caddy_data");
  volumeFailure((args) => args[1] === "create" && args[2] === "r14_fresh_caddy_config");
  volumeFailure((args) => args[0] === "secret-seed");
  assert.throws(() => innerModule.requireComposeContract(() => ({ status: 1 })), (error) => {
    assert.deepEqual(innerModule.safeInnerFailure(error, "catalog-terminal-invalid"), { stage: "compose-contract", code: expected["compose-contract"] });
    return true;
  });

  const stages = [];
  const seedCalls = [];
  innerModule.createVolumes({
    docker: () => ({ status: 0 }),
    command: (file, args, options) => { seedCalls.push({ file, args, options }); return { status: 0 }; },
    setStage: (stage) => stages.push(stage)
  });
  innerModule.requireComposeContract(() => ({ status: 0 }), (stage) => stages.push(stage));
  assert.deepEqual(stages, Object.keys(expected));
  assert.equal(seedCalls.length, 1);
  assert.equal(seedCalls[0].file, "/bin/bash");
  assert.equal(seedCalls[0].args[0].endsWith("/seed-caddy-secret-volume.sh"), true);
  assert.deepEqual(
    { SUDO_UID: seedCalls[0].options?.env?.SUDO_UID, SUDO_GID: seedCalls[0].options?.env?.SUDO_GID },
    { SUDO_UID: "1000", SUDO_GID: "1000" }
  );
  assert.notEqual(seedCalls[0].options?.shell, true);
  const catalog = inner.indexOf("requireCatalogInstall(result(");
  const volumes = inner.indexOf("createVolumes({ setStage:", catalog);
  const compose = inner.indexOf("requireComposeContract(compose,", volumes);
  const base = inner.indexOf('stage = "base-services"', compose);
  assert.equal(catalog >= 0 && catalog < volumes && volumes < compose && compose < base, true);

  const terminal = { schema: "aihub-workflow-production-r14-fresh-local-v1", candidateOnly: true, deployable: false, serverConnected: false, serverWritten: false, status: "blocked", checks: {}, cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0, downStatus: 0 } };
  for (const [stage, code] of Object.entries(expected)) assert.deepEqual(projectInnerTerminal({ ...terminal, failure: { stage, code } }), { stage, code });
  assert.throws(() => projectInnerTerminal({ ...terminal, failure: { stage: "compose-contract", code: expected["caddy-data-volume"] } }));
});

test("r14 base-services keeps one combined up and safely attributes its failed service before cleanup", () => {
  assert.equal(typeof innerModule.runBaseServices, "function");
  const up = ["up", "-d", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "240", "identity-database", "community-database", "admin"];
  const ps = ["ps", "--all", "--format", "json", "identity-database", "community-database", "admin"];
  const healthy = [
    { Service: "identity-database", State: "running", Health: "healthy", ExitCode: 0 },
    { Service: "community-database", State: "running", Health: "healthy", ExitCode: 0 },
    { Service: "admin", State: "running", Health: "healthy", ExitCode: 0 }
  ];
  const execute = (rows, upResult = { status: 1 }) => {
    const calls = [];
    try {
      innerModule.runBaseServices((args) => {
        calls.push(args);
        if (calls.length === 1) return upResult;
        return { status: 0, stdout: JSON.stringify(rows), stderr: "" };
      });
      assert.fail("base services should fail");
    } catch (error) {
      return { calls, failure: innerModule.safeInnerFailure(error, "base-services") };
    }
  };

  for (const [service, key, state, stage, code] of [
    ["identity-database", "identityDatabase", { State: "exited", Health: "", ExitCode: 1 }, "base-services-identity-database", "R14_FRESH_BASE_SERVICES_IDENTITY_DATABASE_FAILED"],
    ["community-database", "communityDatabase", { State: "running", Health: "starting", ExitCode: 0 }, "base-services-community-database", "R14_FRESH_BASE_SERVICES_COMMUNITY_DATABASE_FAILED"],
    ["admin", "admin", { State: "running", Health: "unhealthy", ExitCode: 0 }, "base-services-admin", "R14_FRESH_BASE_SERVICES_ADMIN_FAILED"]
  ]) {
    const rows = healthy.map((row) => row.Service === service ? { ...row, ...state } : row);
    const value = execute(rows);
    assert.deepEqual(value.calls, [up, ps]);
    assert.equal(value.failure.stage, stage);
    assert.equal(value.failure.code, code);
    assert.equal(value.failure.baseServices[key] === "healthy", false);
    assert.deepEqual(Object.keys(value.failure.baseServices).sort(), ["admin", "communityDatabase", "identityDatabase"]);
  }

  const multiple = execute(healthy.map((row) => row.Service === "admin" ? { ...row, Health: "starting" } : { ...row, State: "created", Health: "" }));
  assert.equal(multiple.failure.stage, "base-services-multiple");
  assert.equal(multiple.failure.code, "R14_FRESH_BASE_SERVICES_MULTIPLE_FAILED");

  const missing = execute(healthy.slice(0, 2));
  assert.deepEqual(missing.failure, {
    stage: "base-services-diagnostic-invalid",
    code: "R14_FRESH_BASE_SERVICES_DIAGNOSTIC_INVALID",
    baseServices: { identityDatabase: "unverified", communityDatabase: "unverified", admin: "unverified" }
  });
  assert.deepEqual(
    innerModule.safeBaseServiceProjection({ identityDatabase: "healthy", communityDatabase: "healthy", admin: "missing" }, "base-services-missing"),
    { identityDatabase: "healthy", communityDatabase: "healthy", admin: "missing" }
  );

  const duplicate = execute([...healthy, healthy[0]]);
  assert.deepEqual(duplicate.failure, {
    stage: "base-services-diagnostic-invalid",
    code: "R14_FRESH_BASE_SERVICES_DIAGNOSTIC_INVALID",
    baseServices: { identityDatabase: "unverified", communityDatabase: "unverified", admin: "unverified" }
  });

  const unknown = execute(healthy.map((row) => row.Service === "admin" ? { ...row, State: "paused", Health: "" } : row));
  assert.equal(unknown.failure.stage, "base-services-diagnostic-invalid");
  assert.equal(unknown.failure.code, "R14_FRESH_BASE_SERVICES_DIAGNOSTIC_INVALID");
  const mismatch = execute(healthy);
  assert.deepEqual(mismatch.failure, {
    stage: "base-services-execution-mismatch",
    code: "R14_FRESH_BASE_SERVICES_EXECUTION_MISMATCH",
    baseServices: { identityDatabase: "healthy", communityDatabase: "healthy", admin: "healthy" }
  });

  const diagnosticCalls = [];
  assert.throws(() => innerModule.runBaseServices((args) => {
    diagnosticCalls.push(args);
    return diagnosticCalls.length === 1 ? { status: 1, stderr: "/secret/raw" } : { status: 1, stdout: "", stderr: "/secret/raw" };
  }), (error) => {
    assert.deepEqual(innerModule.safeInnerFailure(error, "base-services"), {
      stage: "base-services-diagnostic-command",
      code: "R14_FRESH_BASE_SERVICES_DIAGNOSTIC_COMMAND_FAILED",
      baseServices: { identityDatabase: "unverified", communityDatabase: "unverified", admin: "unverified" }
    });
    assert.doesNotMatch(JSON.stringify(innerModule.safeInnerFailure(error, "base-services")), /secret|raw|path|stderr|stdout/i);
    return true;
  });

  const successCalls = [];
  assert.doesNotThrow(() => innerModule.runBaseServices((args) => { successCalls.push(args); return { status: 0, stdout: "sensitive progress", stderr: "sensitive progress" }; }));
  assert.deepEqual(successCalls, [up]);
});

test("r14 base-services accepts only exact legacy array or Compose v5 JSONL diagnostics", () => {
  const healthy = [
    { Service: "identity-database", State: "running", Health: "healthy", ExitCode: 0, Extra: "ignored" },
    { Service: "community-database", State: "running", Health: "healthy", ExitCode: 0 },
    { Service: "admin", State: "running", Health: "unhealthy", ExitCode: 1 }
  ];
  const failureFor = (stdout) => {
    const calls = [];
    try {
      innerModule.runBaseServices((args) => {
        calls.push(args);
        return calls.length === 1 ? { status: 1 } : { status: 0, stdout, stderr: "" };
      });
    } catch (error) {
      const failure = innerModule.safeInnerFailure(error, "base-services");
      assert.doesNotMatch(JSON.stringify(failure), /raw|stdout|stderr|path|secret/i);
      return failure;
    }
    assert.fail("diagnostic must produce a fixed failure");
  };
  const expected = {
    stage: "base-services-admin",
    code: "R14_FRESH_BASE_SERVICES_ADMIN_FAILED",
    baseServices: { identityDatabase: "healthy", communityDatabase: "healthy", admin: "running-unhealthy" }
  };
  assert.deepEqual(failureFor(JSON.stringify(healthy)), expected);
  const jsonl = healthy.map((row) => JSON.stringify(row)).join("\n");
  assert.deepEqual(failureFor(jsonl), expected);
  assert.deepEqual(failureFor(`${jsonl}\n`), expected);

  const invalid = (stdout) => assert.deepEqual(failureFor(stdout), {
    stage: "base-services-diagnostic-invalid",
    code: "R14_FRESH_BASE_SERVICES_DIAGNOSTIC_INVALID",
    baseServices: { identityDatabase: "unverified", communityDatabase: "unverified", admin: "unverified" }
  });
  invalid(healthy.slice(0, 2).map((row) => JSON.stringify(row)).join("\n"));
  invalid([...healthy, healthy[0]].map((row) => JSON.stringify(row)).join("\n"));
  invalid(`${JSON.stringify(healthy[0])}\n\n${JSON.stringify(healthy[1])}\n${JSON.stringify(healthy[2])}`);
  invalid(`prefix${jsonl}`);
  invalid(`${jsonl}suffix`);
  invalid(healthy.map((row) => JSON.stringify(row)).join(""));
  invalid(`${JSON.stringify(healthy)}\n${JSON.stringify(healthy[0])}`);
  invalid(JSON.stringify(healthy.slice(0, 2)));
  invalid(JSON.stringify([...healthy, healthy[0]]));
  invalid([...healthy.slice(0, 2), { ...healthy[0] }].map((row) => JSON.stringify(row)).join("\n"));
  invalid([...healthy.slice(0, 2), { Service: "unknown", State: "running", Health: "healthy", ExitCode: 0 }].map((row) => JSON.stringify(row)).join("\n"));
  invalid(`${jsonl}\n\n`);
  invalid(`${JSON.stringify(healthy[0])}\n${JSON.stringify(healthy[1])}\n{}`);
});

test("r14 outer projects only the exact allowlisted base-service diagnosis", () => {
  const terminal = {
    schema: "aihub-workflow-production-r14-fresh-local-v1", candidateOnly: true, deployable: false,
    serverConnected: false, serverWritten: false, status: "blocked", checks: {},
    cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRoots: 0, downStatus: 0 },
    failure: {
      stage: "base-services-admin", code: "R14_FRESH_BASE_SERVICES_ADMIN_FAILED",
      baseServices: { identityDatabase: "healthy", communityDatabase: "healthy", admin: "running-unhealthy" }
    }
  };
  assert.deepEqual(projectInnerTerminal(terminal), terminal.failure);
  for (const value of [
    { ...terminal, failure: { ...terminal.failure, raw: "/secret/path" } },
    { ...terminal, failure: { ...terminal.failure, baseServices: { ...terminal.failure.baseServices, extra: "healthy" } } },
    { ...terminal, failure: { ...terminal.failure, baseServices: { ...terminal.failure.baseServices, admin: "raw-health-output" } } },
    { ...terminal, failure: { ...terminal.failure, baseServices: { identityDatabase: "exited-nonzero", communityDatabase: "healthy", admin: "healthy" } } },
    { ...terminal, failure: { ...terminal.failure, code: "R14_FRESH_BASE_SERVICES_IDENTITY_DATABASE_FAILED" } }
  ]) assert.throws(() => projectInnerTerminal(value), (error) => {
    assert.deepEqual(error.innerTerminal, INNER_TERMINAL_INVALID);
    return true;
  });
});
