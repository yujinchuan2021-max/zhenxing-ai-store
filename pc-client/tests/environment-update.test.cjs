const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createEnvironmentUpdatePlan
} = require("../shared/environment-update.cjs");

test("creates an update intent only from a trusted lower installed version", () => {
  assert.deepEqual(
    createEnvironmentUpdatePlan({
      environmentId: "python312",
      status: { detection: "installed", version: "3.12.9" },
      downloadPlan: { recommendedVersion: "3.12.10" }
    }),
    {
      environmentId: "python312",
      intent: "update",
      installedVersion: "3.12.9",
      recommendedVersion: "3.12.10"
    }
  );
});

test("rejects absent, unknown, equal, newer, and rolling-latest update baselines", () => {
  for (const [detection, version, recommendedVersion] of [
    ["absent", "", "3.12.10"],
    ["unknown", "", "3.12.10"],
    ["installed", "3.12.10", "3.12.10"],
    ["installed", "3.13.0", "3.12.10"],
    ["installed", "1.0.0", ""]
  ]) {
    assert.equal(
      createEnvironmentUpdatePlan({
        environmentId: "python312",
        status: { detection, version },
        downloadPlan: { recommendedVersion }
      }),
      null
    );
  }
});
