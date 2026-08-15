import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import intake from "../shared/official-mcp-registry-intake.cjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(scriptDirectory, "..");
const directory = path.join(repository, "output", "research", "official-mcp-registry-intake-2026-08-15-run3");

if (process.argv.length !== 2 || path.relative(repository, directory).startsWith("..")) {
  throw new Error("Official Registry intake accepts no arguments and has a fixed output path");
}

try {
  const summary = await intake.runOfficialRegistryIntake({ directory });
  process.stdout.write(`${JSON.stringify({
    completed: summary.completed,
    pages: summary.pages,
    records: summary.records,
    byStatus: summary.byStatus
  })}\n`);
} catch {
  const stoppedPath = path.join(directory, "stopped.json");
  let stopped = { stopped: true, statusClass: "local-preflight-stop" };
  if (fs.existsSync(stoppedPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(stoppedPath, "utf8"));
      stopped = {
        stopped: true,
        statusClass: parsed.statusClass,
        page: parsed.page,
        cursor: parsed.cursor
      };
    } catch {}
  }
  process.stderr.write(`${JSON.stringify(stopped)}\n`);
  process.exitCode = 1;
}
