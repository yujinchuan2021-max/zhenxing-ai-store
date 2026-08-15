import { spawnSync } from "node:child_process";
import path from "node:path";

const executable = path.resolve(
  process.env.AIHUB_PACKAGED_TEST_EXE ||
    "release-review-0.1.40-complete/ZhenXing-AI-Local-0.1.40-Windows-x64-Portable.exe"
);
const gate = path.resolve("scripts/check-packaged-catalog.mjs");
const red = spawnSync(process.execPath, [gate, executable], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    AIHUB_PACKAGED_GATE_TEST: "1",
    AIHUB_PACKAGED_CATALOG_URL: "https://localhost:4443/catalog-release-502.json"
  },
  encoding: "utf8",
  shell: false
});
if (red.status === 0) throw new Error("502 catalog gate unexpectedly passed");
process.stdout.write(JSON.stringify({ ok: true, redStatus: red.status }) + "\n");
