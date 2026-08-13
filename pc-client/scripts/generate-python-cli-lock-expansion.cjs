"use strict";

const fs = require("node:fs");
const path = require("node:path");

const output = path.join(
  __dirname,
  "..",
  "shared",
  "python-cli-locks-expansion.json"
);

const entries = process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  if (separator < 1) throw new Error(`Expected key=report.json, received ${argument}`);
  return [argument.slice(0, separator), argument.slice(separator + 1)];
});

if (!entries.length) throw new Error("At least one pip report is required.");

const locks = fs.existsSync(output)
  ? JSON.parse(fs.readFileSync(output, "utf8"))
  : {};
for (const [key, reportPath] of entries) {
  const report = JSON.parse(fs.readFileSync(path.resolve(reportPath), "utf8"));
  const artifacts = (report.install || []).map((item) => {
    const url = String(item.download_info?.url || "");
    const sha256 = String(item.download_info?.archive_info?.hashes?.sha256 || "");
    const name = String(item.metadata?.name || "");
    const version = String(item.metadata?.version || "");
    if (
      !name ||
      !version ||
      !/^https:\/\/files\.pythonhosted\.org\/.+\.whl$/.test(url) ||
      !/^[a-f0-9]{64}$/.test(sha256)
    ) {
      throw new Error(`Unsafe pip artifact in ${reportPath}: ${name}@${version}`);
    }
    return { name, version, url, sha256, requested: item.requested === true };
  });
  const requested = artifacts.filter((item) => item.requested);
  if (requested.length !== 1) {
    throw new Error(`Expected one requested distribution in ${reportPath}`);
  }
  locks[key] = [
    ...requested,
    ...artifacts
      .filter((item) => !item.requested)
      .sort((left, right) => left.name.localeCompare(right.name, "en"))
  ].map(({ requested: _requested, ...artifact }) => artifact);
}

fs.writeFileSync(output, `${JSON.stringify(locks, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    Object.fromEntries(Object.entries(locks).map(([key, value]) => [key, value.length]))
  )
);
