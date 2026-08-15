import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runServerConnectedReviewAcceptance } from "./lib/packaged-client-acceptance.mjs";
import { readServerConnectedReviewRuntimeClosure } from "./lib/server-connected-review-receipt.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
let result;
if (args.length !== 2 || args[0] !== "--version" || !/^(?:0|[1-9]\d*)\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(args[1])) {
  result = {
    status: "BLOCKED",
    stage: "preflight",
    code: "ACCEPTANCE_ARGUMENT_INVALID",
    finalReport: null,
    finalSha256: null
  };
} else {
  const version = args[1];
  const packageDirectory = path.join(root, `release-review-server-connected-${version}-candidate`);
  const portablePath = path.join(packageDirectory, `ZhenXing-AI-Server-Connected-Review-${version}-Windows-x64-Portable.exe`);
  const evidenceDirectory = path.join(root, "output", `windows-client-${version}-package-acceptance`);
  try {
    if (!fs.existsSync(portablePath)) throw new Error("SERVER_CONNECTED_REVIEW_PORTABLE_MISSING");
    const closure = readServerConnectedReviewRuntimeClosure({ packageDirectory, version });
    const expectedPackageAsarSha256 = closure.asarSha256;
    const expectedCatalogChannelSha256 = closure.catalogChannelSha256;
    const expectedUpdateChannelSha256 = closure.updateChannelSha256;
    const artifactSha256 = crypto.createHash("sha256").update(fs.readFileSync(portablePath)).digest("hex");
    result = await runServerConnectedReviewAcceptance({ version, portablePath, artifactSha256, expectedPackageAsarSha256, expectedCatalogChannelSha256, expectedUpdateChannelSha256, evidenceDirectory });
  } catch (error) {
    const allowed = new Set([
      "ACCEPTANCE_ARTIFACT_MISMATCH",
      "ACCEPTANCE_EVIDENCE_EXISTS",
      "ACCEPTANCE_EVIDENCE_OUTSIDE_OUTPUT",
      "ACCEPTANCE_INPUT_INVALID",
      "PACKAGE_RECEIPT_INVALID",
      "PACKAGE_RUNTIME_CLOSURE_INVALID",
      "SERVER_CONNECTED_REVIEW_PORTABLE_MISSING"
    ]);
    result = {
      status: "BLOCKED",
      stage: "preflight",
      code: allowed.has(error?.message) ? error.message : "ACCEPTANCE_PREFLIGHT_FAILED",
      finalReport: null,
      finalSha256: null
    };
  }
}
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.status !== "PASS") process.exitCode = 2;
