"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createReleaseStore } = require("../admin/release-store.cjs");
const { loadSigningKey } = require("../admin/signing-key.cjs");
const { canonicalize } = require("../shared/signed-release.cjs");
const { readCatalogClientChannel } = require("../shared/catalog-client-channel.cjs");

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ response, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(8_000, () => request.destroy(new Error("local admin timeout")));
    request.on("error", reject);
  });
}

(async () => {
  const root = path.resolve(__dirname, "..");
  const keyMetadata = readCatalogClientChannel(
    JSON.parse(fs.readFileSync(path.join(root, "catalog", "channel.json"), "utf8")),
    { kind: "catalog", allowLocalhost: true }
  ).trustedKeys[0];
  const store = createReleaseStore({
    rootDirectory: path.join(root, "admin", "published", "catalog-store"),
    signingKeyProvider: async () =>
      loadSigningKey({ dataDirectory: path.join(root, "admin", "data"), keyMetadata })
  });
  const state = await store.readState();
  const { response, body } = await getJson("http://127.0.0.1:4173/api/catalog");
  if (response.statusCode !== 200) {
    throw new Error(`local admin draft API returned ${response.statusCode}`);
  }
  const remote = JSON.parse(body.toString("utf8"));
  if (
    remote.revision !== state.draft?.revision ||
    canonicalize(remote.catalog) !== canonicalize(state.draft?.catalog)
  ) {
    throw new Error("local admin draft API does not match the revision store");
  }
  process.stdout.write(JSON.stringify({ ok: true, revision: remote.revision }) + "\n");
})().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
