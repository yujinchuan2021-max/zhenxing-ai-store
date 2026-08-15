import { open, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const {
  fetchClawHubFirst100,
  serializeClawHubFirst100,
  validateClawHubFirst100
} = require("../shared/clawhub-public-feed.cjs");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(
  repoRoot,
  "docs/research/clawhub-official-feed-first100-discovery-2026-08-14.json"
);

const defaultFs = Object.freeze({ open, readFile, stat });

async function readExisting(fsImpl) {
  try {
    const bytes = await fsImpl.readFile(outputPath, "utf8");
    const candidate = validateClawHubFirst100(JSON.parse(bytes));
    if (serializeClawHubFirst100(candidate) !== bytes) {
      throw new Error("Existing ClawHub discovery artifact is not canonical JSON");
    }
    return candidate;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function runClawHubFirst100Intake({
  fetchImpl = globalThis.fetch,
  fsImpl = defaultFs
} = {}) {
  if (
    typeof fetchImpl !== "function" ||
    typeof fsImpl?.stat !== "function" ||
    typeof fsImpl?.readFile !== "function" ||
    typeof fsImpl?.open !== "function"
  ) {
    throw new TypeError("ClawHub intake dependencies are invalid");
  }
  const directory = await fsImpl.stat(dirname(outputPath));
  if (!directory.isDirectory()) {
    throw new Error("ClawHub discovery output directory is unavailable");
  }
  const existing = await readExisting(fsImpl);
  if (existing) {
    return { status: "cached", resources: 100 };
  }

  const candidate = validateClawHubFirst100(
    await fetchClawHubFirst100({ fetchImpl })
  );
  const bytes = serializeClawHubFirst100(candidate);
  const handle = await fsImpl.open(outputPath, "wx");
  try {
    await handle.writeFile(bytes, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { status: "written", resources: 100 };
}

async function main() {
  if (process.argv.length !== 2) {
    throw new Error("This intake accepts no arguments");
  }
  process.stdout.write(`${JSON.stringify(await runClawHubFirst100Intake())}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "ClawHub discovery intake failed"}\n`);
    process.exitCode = 1;
  });
}
