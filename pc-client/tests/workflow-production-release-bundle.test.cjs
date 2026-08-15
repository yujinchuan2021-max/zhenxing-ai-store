"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const deployment = path.join(root, "deployment", "community-production");

test("production release bundle owns the exact transfer set and fixed file modes", () => {
  const bundleModule = path.join(deployment, "workflow-production-release-bundle.cjs");
  const prepareHelper = path.join(deployment, "prepare-workflow-production-release.sh");

  assert.equal(fs.existsSync(bundleModule), true, "manifest-controlled bundle module is missing");
  assert.equal(fs.existsSync(prepareHelper), true, "manifest-controlled prepare helper is missing");

  const { catalogActivationRuntimePaths, createWorkflowProductionReleaseBundleManifest } = require(bundleModule);
  const manifest = createWorkflowProductionReleaseBundleManifest();
  const byPath = new Map(manifest.files.map((entry) => [entry.path, entry]));

  assert.deepEqual(catalogActivationRuntimePaths, [
    "admin/release-store.cjs",
    "shared/catalog-channel.cjs",
    "shared/catalog-release-icon-compat.cjs",
    "shared/catalog.cjs",
    "shared/signed-release.cjs"
  ]);

  assert.equal(manifest.candidateOnly, true);
  assert.equal(manifest.publishable, false);
  assert.equal(manifest.adminImage.image, "zhenxing-ai/admin:0.1.40-src-186ff057efd3");
  assert.equal(manifest.adminImage.imageId, "sha256:3ef2569e56c2fc40a0a31bc89c45bed0fa7b19766f6d688bf19527c1645cb9cd");
  assert.equal(manifest.adminImage.path, "artifacts/admin-active7-image.tar");
  assert.deepEqual(manifest.identityImage, {
    path: "artifacts/identity-r11-image.tar",
    image: "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e",
    imageId: "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748",
    sourceDigest: "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7",
    user: "node",
    bytes: 58903552,
    sha256: "5026c7ae3fd05518434d28a1a704aacd81d138e7e74ca239d8110d8b15faa79b"
  });
  assert.deepEqual(byPath.get("artifacts/identity-r11-image.tar"), {
    path: "artifacts/identity-r11-image.tar",
    bytes: 58903552,
    sha256: "5026c7ae3fd05518434d28a1a704aacd81d138e7e74ca239d8110d8b15faa79b",
    mode: "0644"
  });
  assert.deepEqual(manifest.rollbackIdentityImage, {
    path: "artifacts/identity-19a-rollback-image.tar",
    image: "zhenxing-ai/identity:workflow-readiness-candidate-19a223a18392",
    imageId: "sha256:58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567",
    configDigest: "sha256:341b0551662a03e16672d6171e1f297fe9f61a015a1aec19d04008bd82b22e5c",
    sourceDigest: "19a223a183921038d01ee49f149c10d7844d9ef1c85f359fba2bfbc745a15d8c",
    releaseLabel: "workflow-reviewer-service-identity-candidate-2026-08-08",
    user: "node",
    bytes: 58887168,
    sha256: "9205edae43228dd7afb66bf179ff321c032f2d8e47e71f61d65fc4165b56e904"
  });
  assert.deepEqual(byPath.get("artifacts/identity-19a-rollback-image.tar"), {
    path: "artifacts/identity-19a-rollback-image.tar",
    bytes: 58887168,
    sha256: "9205edae43228dd7afb66bf179ff321c032f2d8e47e71f61d65fc4165b56e904",
    mode: "0644"
  });
  assert.deepEqual(manifest.oldAdminImage, {
    path: "artifacts/admin-old-b6ea4c5bd0e9.tar",
    image: "zhenxing-ai/admin:community-candidate-b6ea4c5bd0e9",
    imageId: "sha256:a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2",
    sourceDigest: "b6ea4c5bd0e9517579a3c4380fcf2c1617975f1ff6a2c6024a703a71ed4620de",
    user: "node",
    bytes: 60_279_808,
    sha256: "2604d520d1c0a428725c73f507598785cdbdb4c78ac80fba937eec4f953f0ad0"
  });
  assert.deepEqual(manifest.flarumImage, {
    path: "artifacts/flarum-8b13962a36bf.tar",
    image: "zhenxing-ai/flarum:community-candidate-8b13962a36bf",
    imageId: "sha256:6c32c21c9961e0dd35757c46be35ec2c8725f5b3537d4d0e7634c3a1cd11ba12",
    sourceDigest: "8b13962a36bf031652bd5863163948ed245314f0025852a9529fdbacbbcab3f6",
    user: "",
    bytes: 239_078_912,
    sha256: "2ed8a402b6020f8c7197c53ca2b3ded956b2ea57a616dd12ba8ef044844c779f"
  });
  assert.equal(byPath.get("artifacts/admin-old-b6ea4c5bd0e9.tar")?.mode, "0644");
  assert.equal(byPath.get("artifacts/flarum-8b13962a36bf.tar")?.mode, "0644");
  assert.equal(byPath.get("artifacts/catalog-active7-state.json").sha256, "cf0fbd33583792d0afcaf1822081b4a643fcf28d069e755003632f369ead2012");
  assert.equal(byPath.get("artifacts/catalog-active7-release.json").sha256, "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4");
  const vendorIcons = manifest.files.filter((entry) => entry.path.startsWith("artifacts/catalog-vendor-icons/"));
  assert.equal(vendorIcons.length, 204);
  for (const entry of vendorIcons) {
    const match = entry.path.match(/^artifacts\/catalog-vendor-icons\/([a-f0-9]{64})\.(?:png|jpg|webp|ico|svg)$/);
    assert.ok(match, entry.path);
    assert.equal(entry.sha256, match[1]);
    assert.equal(entry.mode, "0644");
    assert.equal(entry.bytes > 0, true);
  }
  assert.ok(byPath.has("artifacts/catalog-vendor-icons/6025a4347a8eaed17e31eaebf7834e33ec4af26cc7f59be586ac59ba5157fa1c.png"));
  assert.equal(byPath.get("deployment/community-production/caddy-entrypoint.sh").mode, "0755");
  assert.equal(byPath.get("deployment/community-production/workflow-production-cutover-launcher.sh").mode, "0755");
  assert.equal(byPath.get("deployment/community-production/Caddyfile").mode, "0644");
  assert.equal(byPath.get("deployment/community-production/runtime/SHASUMS256.txt").mode, "0644");
  assert.equal(byPath.get("deployment/community-production/runtime/node-v24.18.1-linux-x64.tar.gz").mode, "0644");
  assert.deepEqual(
    [
      ["admin/release-store.cjs", "cb89639f08217bb489fcaccff988afa5a6e466d929420bced34e84cf4846cf42"],
      ["shared/catalog-channel.cjs", "606dc8853ee85725d0f5c10205f0f39b0f8c891ddf3d70cba9cd7fa5fb592ace"],
      ["shared/catalog-release-icon-compat.cjs", "cd7d9fcbe63416fa3f88a6d93bac02f5dc7b22c989dcdf88147e7e3bc4a6870e"],
      ["shared/catalog.cjs", "eb5092cb1e3688ba5291756d4c4db0e18e93ecb980f2474e853cb7aa731691b0"],
      ["shared/signed-release.cjs", "8a342c6ef884e8652181b0fde4a91618784e9c7a6430897b2da55bd18eb0134e"]
    ].map(([relative, sha256]) => [relative, byPath.get(relative)?.mode, byPath.get(relative)?.sha256]),
    [
      ["admin/release-store.cjs", "0644", "cb89639f08217bb489fcaccff988afa5a6e466d929420bced34e84cf4846cf42"],
      ["shared/catalog-channel.cjs", "0644", "606dc8853ee85725d0f5c10205f0f39b0f8c891ddf3d70cba9cd7fa5fb592ace"],
      ["shared/catalog-release-icon-compat.cjs", "0644", "cd7d9fcbe63416fa3f88a6d93bac02f5dc7b22c989dcdf88147e7e3bc4a6870e"],
      ["shared/catalog.cjs", "0644", "eb5092cb1e3688ba5291756d4c4db0e18e93ecb980f2474e853cb7aa731691b0"],
      ["shared/signed-release.cjs", "0644", "8a342c6ef884e8652181b0fde4a91618784e9c7a6430897b2da55bd18eb0134e"]
    ]
  );
  assert.ok(byPath.has("deployment/community-production/manifest.json"));
  assert.equal(new Set(manifest.files.map((entry) => entry.path)).size, manifest.files.length);
});

test("prepare helper is atomic and rejects path, link, owner, and mode drift", () => {
  const source = fs.readFileSync(
    path.join(deployment, "prepare-workflow-production-release.sh"),
    "utf8"
  );

  assert.match(source, /set -euo pipefail/);
  assert.match(source, /\/opt\/zhenxing-ai\/staging/);
  assert.match(source, /\/opt\/zhenxing-ai\/releases/);
  assert.match(source, /\.tmp\./);
  assert.match(source, /realpath/);
  assert.match(source, /nlink|%h/);
  assert.match(source, /symlink|! -L/);
  assert.match(source, /0755/);
  assert.match(source, /0644/);
  assert.match(source, /mv -T/);
  assert.doesNotMatch(source, /chmod\s+-R|chmod\s+777|rm\s+-rf\s+\/|--volumes|prune/);
});

test("cutover loads the release-provided Admin archive, verifies its ID, and rolls back Admin", () => {
  const source = fs.readFileSync(
    path.join(deployment, "workflow-production-cutover.sh"),
    "utf8"
  );

  assert.match(source, /admin_archive="\$release_root\/artifacts\/admin-active7-image\.tar"/);
  assert.match(source, /docker load -i "\$admin_archive"/);
  assert.match(source, /docker image inspect "\$admin_image"/);
  assert.match(source, /AIHUB_ADMIN_CMS_IMAGE="\$old_admin_image" docker compose .* up -d --no-build admin/);
  assert.match(source, /old_admin_archive="\$release_root\/artifacts\/admin-old-b6ea4c5bd0e9\.tar"/);
  assert.match(source, /workflow-image-archive\.cjs" verify-old-admin "\$old_admin_archive"/);
  assert.match(source, /docker load -i "\$old_admin_archive"/);
  assert.match(source, /a1d976f82230edefb3c39416ba868fa9b50a5ab8db31cdb7a5dadb217bcb06c2/);
});

test("cutover accepts only the prepared candidate Identity archive and reports its immutable image contract accurately", () => {
  const source = fs.readFileSync(
    path.join(deployment, "workflow-production-cutover.sh"),
    "utf8"
  );

  assert.match(source, /identity_archive="\$release_root\/artifacts\/identity-r11-image\.tar"/);
  assert.match(source, /\[\[ "\$identity_archive_argument" == "\$identity_archive" \]\]/);
  assert.match(source, /docker load -i "\$identity_archive"/);
  assert.match(source, /docker image inspect "\$identity_image"/);
  assert.match(source, /--format '\{\{\.Id\}\}' "\$identity_image"/);
  assert.match(source, /--format '\{\{ index \.Config\.Labels "com\.aihub\.source-content-sha256" \}\}' "\$identity_image"/);
  assert.match(source, /--format '\{\{\.Config\.User\}\}' "\$identity_image"/);
  assert.doesNotMatch(source, /Identity image archive must be an absolute file or -/);
  assert.match(source, /rollback_identity_archive="\$release_root\/artifacts\/identity-19a-rollback-image\.tar"/);
  assert.match(source, /workflow-image-archive\.cjs" verify-rollback "\$rollback_identity_archive"/);
  assert.match(source, /docker load -i "\$rollback_identity_archive"/);
  assert.match(source, /com\.aihub\.release-version/);
  assert.doesNotMatch(source, /com\.aihub\.release"/);
  assert.match(source, /"\$expected_old_identity_image".*"\$expected_old_identity_image_id"/s);
  assert.doesNotMatch(source, /Identity (?:r7|d6) /);
  assert.match(source, /candidate Identity image archive is missing/);
  assert.match(source, /candidate Identity image ID drifted/);
  assert.match(source, /candidate Identity source label drifted/);
  assert.match(source, /candidate Identity Config\.User drifted/);
});

test("production-shaped harness loads the exact prepared rollback image instead of relying on local cache", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts", "test-workflow-production-release-bundle-cutover.cjs"),
    "utf8"
  );
  assert.match(source, /artifacts["'],\s*["']identity-19a-rollback-image\.tar/);
  assert.match(source, /docker["'],\s*\[["']load["'],\s*["']-i["']/);
  assert.match(source, /58a5fdd80c026f5dc9fceda4abea3a743ef85cb45b2def10c0df189271251567/);
  assert.doesNotMatch(source, /docker\s+(?:build|tag)|--force|pull/);
});

test("production-shaped harness reports the complete immutable local image closure before any project starts", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts", "test-workflow-production-release-bundle-cutover.cjs"),
    "utf8"
  );
  for (const token of [
    "admin-old",
    "identity-old",
    "community-flarum",
    "postgres",
    "mariadb",
    "caddy"
  ]) assert.match(source, new RegExp(JSON.stringify(token).slice(1, -1)));
  assert.match(source, /function assertLocalImageClosure\(\)/);
  assert.match(source, /const localImageClosure = assertLocalImageClosure\(\);/);
  assert.match(source, /verify-old-admin/);
  assert.match(source, /verify-flarum/);
  assert.match(source, /admin-old-b6ea4c5bd0e9\.tar/);
  assert.match(source, /flarum-8b13962a36bf\.tar/);
  assert.match(source, /missing local image closure:/);
  assert.doesNotMatch(source, /docker[^\n]*(?:pull|build|tag)/i);
  assert.ok(
    source.indexOf("const localImageClosure = assertLocalImageClosure();") < source.indexOf("const source = createPreparedCutoverFixtureSource({"),
    "image closure must complete before the project fixture is read or started"
  );
});

test("cutover harness propagates only its caller-verified prepared release into the generated inner fixture", () => {
  const { createPreparedCutoverFixtureSource } = require(
    path.join(root, "scripts", "test-workflow-production-release-bundle-cutover.cjs")
  );
  const fixtureSource = fs.readFileSync(
    path.join(root, "output", "workflow-reviewer-service-independent-cutover-harness.cjs"),
    "utf8"
  );
  const preparedReleaseRoot = path.join(root, "output", "non-default-prepared-02848cd2-sentinel");
  const generated = createPreparedCutoverFixtureSource({
    fixtureSource,
    root,
    preparedReleaseRoot,
    acceptanceNode: path.join(root, "output", "fixed-node", "node.exe")
  });

  assert.match(generated, new RegExp(JSON.stringify(path.join(preparedReleaseRoot, "deployment", "community-production")).slice(1, -1).replace(/[\\/]/g, "[\\\\/]")));
  assert.match(generated, /scenario must reuse the verified prepared release/);
  assert.doesNotMatch(generated, /prepareCutoverRelease\(runRoot\);/);
  assert.doesNotMatch(generated, /[\\/]output[\\/]community-production-/i);
  assert.throws(
    () => createPreparedCutoverFixtureSource({
      fixtureSource: fixtureSource.replace("const sourceDeployment = path.join(root, \"deployment\", \"community-production\");", ""),
      root,
      preparedReleaseRoot,
      acceptanceNode: path.join(root, "output", "fixed-node", "node.exe")
    }),
    /fixture deployment seam is missing/
  );
});

test("cutover parent enforces scenario-specific nested acceptance and rollback evidence", () => {
  const { parseHarnessOutput } = require(
    path.join(root, "scripts", "test-workflow-production-release-bundle-cutover.cjs")
  );
  assert.equal(typeof parseHarnessOutput, "function");
  const manifestDigest = "206598369f51d9feca929189c1cf515508adc34f1afd84f26532e0d3e3441c2e";
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-cutover-parser-"));

  function valueFor({ scenario, caseName = scenario, nestedCount, checks }) {
    const runRoot = path.join(temporary, caseName.replace(/[^a-z-]/g, ""));
    const evidence = path.join(runRoot, "cutover-evidence");
    fs.mkdirSync(evidence, { recursive: true });
    const reportPath = path.join(runRoot, "report.json");
    fs.writeFileSync(reportPath, `${JSON.stringify({
      status: "pass",
      kind: scenario,
      baselineKind: scenario.startsWith("retained-") ? "retained" : "empty",
      outcome: scenario.endsWith("success") ? "success" : "failure",
      checks,
      cleanup: { completed: true, containers: 0, networks: 0, volumes: 0, privateRemoved: true, backupRemoved: true },
      terminal: { finalized: true, exitCode: 0 }
    })}\n`);
    for (let index = 0; index < nestedCount; index += 1) {
      const nested = path.join(evidence, `nested-${index}`);
      fs.mkdirSync(nested);
      fs.writeFileSync(path.join(nested, "workflow-temporary-acceptance-report.json"), `${JSON.stringify({
        status: "pass",
        manifestDigest,
        finalized: true,
        cleanup: { completed: true }
      })}\n`);
    }
    return {
      status: 0,
      stdout: `${JSON.stringify({ ok: true, result: { kind: scenario.endsWith("success") ? "success" : "failure", runRoot, reportPath } })}\n`,
      stderr: ""
    };
  }

  const successChecks = { supplyChain: true, secretValueHits: 0 };
  const emptyFailureChecks = {
    supplyChain: true,
    cutoverExistingState: { baseline: "rolled-back-disabled-empty", events: 0, idempotency: 0, eventHead: 0, sourcePostsExact: 0, publisherExact: 0 },
    failureRollbackPreservedExistingBaseline: { schema: "applied", appendOnly: true, events: 0, idempotency: 0, eventHead: 0, reviewerExact: 1, reviewerForbiddenRelations: 0, workflowFlags: "disabled" },
    catalogExactActive6Rollback: true,
    failureRollbackRestoredOldImages: { adminPrior: true, identityPrior: true },
    caddyIdentityAndSecretBoundary: true,
    secretValueHits: 0
  };

  try {
    assert.doesNotThrow(() => parseHarnessOutput(valueFor({ scenario: "success", nestedCount: 1, checks: successChecks }), { expectedScenario: "success", expectedManifestDigest: manifestDigest }));
    assert.throws(() => parseHarnessOutput(valueFor({ scenario: "success", caseName: "success-zero", nestedCount: 0, checks: successChecks }), { expectedScenario: "success", expectedManifestDigest: manifestDigest }), /exactly one finalized inner acceptance report/);
    assert.throws(() => parseHarnessOutput(valueFor({ scenario: "success", caseName: "success-two", nestedCount: 2, checks: successChecks }), { expectedScenario: "success", expectedManifestDigest: manifestDigest }), /exactly one finalized inner acceptance report/);
    assert.doesNotThrow(() => parseHarnessOutput(valueFor({ scenario: "failure", nestedCount: 0, checks: emptyFailureChecks }), { expectedScenario: "failure", expectedManifestDigest: manifestDigest }));
    assert.throws(() => parseHarnessOutput(valueFor({ scenario: "failure", caseName: "failure-with-nested", nestedCount: 1, checks: emptyFailureChecks }), { expectedScenario: "failure", expectedManifestDigest: manifestDigest }), /must not produce an inner acceptance report/);
    for (const missing of ["supplyChain", "cutoverExistingState", "failureRollbackPreservedExistingBaseline"]) {
      const checks = { ...emptyFailureChecks };
      delete checks[missing];
      assert.throws(() => parseHarnessOutput(valueFor({ scenario: "failure", caseName: `failure-missing-${missing.toLowerCase()}`, nestedCount: 0, checks }), { expectedScenario: "failure", expectedManifestDigest: manifestDigest }));
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("active6-to-active7 cutover relies on parsed signed payload metadata, not transport hashes", () => {
  const source = fs.readFileSync(
    path.join(deployment, "workflow-production-cutover.sh"),
    "utf8"
  );

  assert.match(source, /catalog-v00000006-567e671621f1-3dcee587/);
  assert.match(source, /catalog-v00000007-8c49e1972186-0cec5335/);
  assert.match(source, /parentReleaseId!=="catalog-v00000006-567e671621f1-3dcee587"/);
  assert.doesNotMatch(source, /sha256sum/);
});

test("cutover activates the fixed catalog state after Admin health and restores it on later failure", () => {
  const source = fs.readFileSync(
    path.join(deployment, "workflow-production-cutover.sh"),
    "utf8"
  );

  assert.match(source, /catalog-active7-state-activation\.cjs" activate/);
  assert.match(source, /AIHUB_ADMIN_PUBLISHED_DIR\/catalog-store/);
  assert.match(source, /catalog-active7-state-activation\.cjs" rollback/);
  assert.match(source, /catalog_activated=1/);
});

test("prepared release verifies its own bundled Admin archive rather than a workspace artifact", () => {
  const { createWorkflowProductionReleaseBundle, verifyPreparedRelease } = require(
    path.join(deployment, "workflow-production-release-bundle.cjs")
  );
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-release-test-"));
  const bundle = path.join(temporary, "transferred-bundle");
  const release = path.join(temporary, "remote-prepared-release");
  const priorAcceptance = process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE;

  try {
    createWorkflowProductionReleaseBundle(bundle);
    fs.cpSync(path.join(bundle, "payload"), release, { recursive: true });
    for (const name of [
      ".aihub-workflow-release-bundle.json",
      ".aihub-workflow-release-bundle.tsv",
      ".aihub-identity-source-manifest.json"
    ]) fs.copyFileSync(path.join(bundle, name), path.join(release, name));
    process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE = "1";
    verifyPreparedRelease(release, { writeMarker: true });
    assert.equal(verifyPreparedRelease(release).verified, true);
    const releaseScoped = spawnSync(process.execPath, [
      path.join(release, "deployment", "community-production", "workflow-production-release-bundle.cjs"),
      "verify-prepared",
      release
    ], {
      encoding: "utf8",
      env: { ...process.env, AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE: "1" }
    });
    assert.equal(releaseScoped.status, 0, releaseScoped.stderr || releaseScoped.stdout);
    assert.equal(fs.existsSync(path.join(release, "artifacts", "admin-active7-image.tar")), true);
    assert.equal(fs.existsSync(path.join(release, "artifacts", "identity-r11-image.tar")), true);
    assert.equal(fs.existsSync(path.join(release, "artifacts", "identity-19a-rollback-image.tar")), true);
    assert.equal(fs.existsSync(path.join(release, "artifacts", "admin-old-b6ea4c5bd0e9.tar")), true);
    assert.equal(fs.existsSync(path.join(release, "artifacts", "flarum-8b13962a36bf.tar")), true);
  } finally {
    if (priorAcceptance === undefined) delete process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE;
    else process.env.AIHUB_WORKFLOW_PRODUCTION_ISOLATED_ACCEPTANCE = priorAcceptance;
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("prepared verification binds catalog activation inputs to bundled artifacts", () => {
  const { createWorkflowProductionReleaseBundleManifest } = require(
    path.join(deployment, "workflow-production-release-bundle.cjs")
  );
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-catalog-artifact-"));
  try {
    const state = path.join(temporary, "catalog-active7-state.json");
    const release = path.join(temporary, "catalog-active7-release.json");
    fs.copyFileSync(path.join(root, "admin", "published", "catalog-store", "state.json"), state);
    fs.copyFileSync(path.join(root, "admin", "published", "catalog-store", "releases", "catalog-v00000007-8c49e1972186-0cec5335.json"), release);
    const manifest = createWorkflowProductionReleaseBundleManifest({
      catalogStateArtifactPath: state,
      catalogReleaseArtifactPath: release
    });
    assert.equal(manifest.files.find((entry) => entry.path === "artifacts/catalog-active7-state.json").sha256, "cf0fbd33583792d0afcaf1822081b4a643fcf28d069e755003632f369ead2012");
    assert.equal(manifest.files.find((entry) => entry.path === "artifacts/catalog-active7-release.json").sha256, "facd7ae56a92de1ff1bf2834c5a41894471dd47246f83021e84885d42828b6c4");
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("prepared verification binds the Identity image input to the bundled artifact", () => {
  const { createWorkflowProductionReleaseBundleManifest } = require(
    path.join(deployment, "workflow-production-release-bundle.cjs")
  );
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-identity-artifact-"));
  try {
    const artifact = path.join(temporary, "identity-r11-image.tar");
    fs.writeFileSync(artifact, "not-the-frozen-identity-image\n");
    assert.throws(
      () => createWorkflowProductionReleaseBundleManifest({ identityArtifactPath: artifact }),
      /Identity image archive size drifted/
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("release bundle rejects a rollback archive outside the exact recursive OCI closure", () => {
  const { createWorkflowProductionReleaseBundleManifest } = require(
    path.join(deployment, "workflow-production-release-bundle.cjs")
  );
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-rollback-artifact-"));
  try {
    const artifact = path.join(temporary, "identity-19a-rollback-image.tar");
    fs.writeFileSync(artifact, "not-the-frozen-rollback-image\n");
    assert.throws(
      () => createWorkflowProductionReleaseBundleManifest({ rollbackArtifactPath: artifact }),
      /image archive size drifted/
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("release bundle rejects old Admin or Flarum outside the exact recursive OCI closure", () => {
  const { createWorkflowProductionReleaseBundleManifest } = require(
    path.join(deployment, "workflow-production-release-bundle.cjs")
  );
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-workflow-baseline-artifact-"));
  try {
    const artifact = path.join(temporary, "not-an-image.tar");
    fs.writeFileSync(artifact, "not-a-frozen-image\n");
    assert.throws(
      () => createWorkflowProductionReleaseBundleManifest({ oldAdminArtifactPath: artifact }),
      /image archive size drifted/
    );
    assert.throws(
      () => createWorkflowProductionReleaseBundleManifest({ flarumArtifactPath: artifact }),
      /image archive size drifted/
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("true-Linux verifier loads every prepared custom image archive into a fresh containerd store", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts", "test-workflow-production-release-bundle-linux.cjs"),
    "utf8"
  );

  assert.match(source, /\.workflow-runtime\/node-v24\.18\.1-linux-x64\/bin\/node/);
  assert.match(source, /require\("\/opt\/zhenxing-ai\/releases\/community-production-success01\/deployment\/community-production\/catalog-active7-state-activation\.cjs"\)/);
  assert.match(source, /activationModuleClosure/);
  assert.match(source, /\["CATALOG_FAILURE_CODES_BY_STAGE", "PUBLISHED_DIRECTORY", "catalogFailureTerminal", "catalogStep", "installFreshCatalog", "preserveCatalogFailure"\]/);
  assert.match(source, /docker load -i '\/opt\/zhenxing-ai\/releases\/community-production-success01\/artifacts\/\$\{contract\.artifact\}'/);
  for (const artifact of ["identity-r11-image.tar", "identity-19a-rollback-image.tar", "admin-active7-image.tar", "admin-old-b6ea4c5bd0e9.tar", "flarum-8b13962a36bf.tar"]) assert.match(source, new RegExp(artifact.replaceAll(".", "\\.")));
  assert.match(source, /imageArchiveClosures/);
  assert.match(source, /wrongImageIdRejected/);
  assert.match(source, /com\.aihub\.source-content-sha256/);
  assert.match(source, /92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748/);
  assert.match(source, /"--feature", "containerd-snapshotter=true"/);
});
