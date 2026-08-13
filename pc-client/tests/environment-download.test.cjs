const assert = require("node:assert/strict");
const test = require("node:test");

const {
  downloadFromReachableSources,
  environmentIdFromManagedDownload,
  getEnvironmentDownloadPlan,
  getEnvironmentManagedDownloadPlan,
  selectReachableSource
} = require("../shared/environment-download.cjs");

test("maps only reviewed environment download task IDs", () => {
  assert.equal(environmentIdFromManagedDownload("environment:python"), "python");
  assert.equal(environmentIdFromManagedDownload("environment:constructor"), "");
  assert.equal(environmentIdFromManagedDownload("python"), "");
});

test("builds a resumable environment plan from the persisted exact source", () => {
  const plan = getEnvironmentDownloadPlan("python");
  const mirror = plan.sources.find((source) => source.kind === "mirror");
  const managed = getEnvironmentManagedDownloadPlan("environment:python", {
    persistedSourceUrl: mirror.url
  });

  assert.equal(managed.environmentId, "python");
  assert.equal(managed.url, mirror.url);
  assert.equal(managed.sourceLabel, mirror.label);
  assert.deepEqual(managed.allowedHosts, mirror.allowedHosts);
});

test("rejects an unreviewed persisted environment source", () => {
  assert.equal(
    getEnvironmentManagedDownloadPlan("environment:python", {
      persistedSourceUrl: "https://example.com/python.exe"
    }),
    null
  );
});

test("always probes the official Python source before its trusted mirror", () => {
  const plan = getEnvironmentDownloadPlan("python", true);

  assert.equal(plan.fileName, "python-3.13.14-amd64.exe");
  assert.equal(plan.sources[0].kind, "official");
  assert.equal(
    new URL(plan.sources[1].url).hostname,
    "mirrors.huaweicloud.com"
  );
  assert.equal(plan.sources[1].kind, "mirror");
});

test("keeps Python 3.12 on the last official Windows installer", () => {
  const plan = getEnvironmentDownloadPlan("python312");
  assert.equal(plan.recommendedVersion, "3.12.10");
  assert.equal(plan.fileName, "python-3.12.10-amd64.exe");
  assert.deepEqual(plan.sources.map((source) => source.id), [
    "python312-official"
  ]);
  assert.equal(
    plan.sources[0].url,
    "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe"
  );
});

test("projects only exact reviewed environment versions", () => {
  assert.equal(getEnvironmentDownloadPlan("node").recommendedVersion, "24.18.0");
  assert.equal(getEnvironmentDownloadPlan("git").recommendedVersion, "2.55.0.3");
  assert.equal(getEnvironmentDownloadPlan("python").recommendedVersion, "3.13.14");
  assert.equal(getEnvironmentDownloadPlan("docker").recommendedVersion, "");
});

test("prefers the official source outside China", () => {
  const plan = getEnvironmentDownloadPlan("node", false);

  assert.equal(plan.sources[0].kind, "official");
  assert.equal(new URL(plan.sources[0].url).hostname, "nodejs.org");
  assert.equal(plan.sources[1].kind, "mirror");
});

test("uses the first source that passes the download probe", async () => {
  const plan = getEnvironmentDownloadPlan("python", true);
  const visited = [];
  const selected = await selectReachableSource(plan, async (source) => {
    visited.push(source.label);
    return source.kind === "mirror";
  });

  assert.deepEqual(visited, ["Python 官方源", "华为云镜像"]);
  assert.equal(selected.kind, "mirror");
});

test("falls back to the mirror when an official download stalls or fails", async () => {
  const plan = getEnvironmentDownloadPlan("python");
  const downloads = [];

  const result = await downloadFromReachableSources(
    plan,
    async () => true,
    async (source) => {
      downloads.push(source.kind);
      if (source.kind === "official") throw new Error("下载长时间没有进度");
      return { filePath: "python.exe" };
    }
  );

  assert.deepEqual(downloads, ["official", "mirror"]);
  assert.equal(result.source.kind, "mirror");
  assert.equal(result.download.filePath, "python.exe");
});

test("fails without downloading when no trusted source is reachable", async () => {
  const plan = getEnvironmentDownloadPlan("python", true);

  await assert.rejects(
    () => selectReachableSource(plan, async () => false),
    /没有可用的官方下载源或可信镜像/
  );
});

test("rejects unknown environment package IDs", () => {
  assert.throws(
    () => getEnvironmentDownloadPlan("unknown", true),
    /不在环境安装包白名单/
  );
});
