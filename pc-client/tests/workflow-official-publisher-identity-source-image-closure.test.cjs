"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  createIdentitySourceManifest
} = require("../deployment/community-production/identity-source-manifest.cjs");

const image = "zhenxing-ai/identity:workflow-readiness-candidate-2a1147346c5e";
const expectedImageId = "sha256:92e2cfb5e7822890681d522d732ecf15d8efcd81af30bdc38ad05bd9b3eb8748";
const expectedDigest = "2a1147346c5e0dda9533fe803951dc9477141bb9234411bdc71f5c5f11dd50b7";
const expectedReleaseLabel = "candidate-only-2a1147346c5e";
const excluded = new Set([".dockerignore", "deployment/community-production/identity.Dockerfile"]);

function docker(args) {
  const result = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr || result.stdout}`);
  return result.stdout;
}

test("official publisher Identity image closes the current source manifest and fixed labels", () => {
  const manifest = createIdentitySourceManifest();
  assert.equal(manifest.digest.sha256, expectedDigest);
  assert.equal(manifest.files.length, 74);
  const copiedFiles = manifest.files.filter((entry) => !excluded.has(entry.path));
  assert.equal(copiedFiles.length, 72);

  const inspect = JSON.parse(docker(["image", "inspect", image, "--format", "{{json .}}"]));
  assert.equal(inspect.Id, expectedImageId);
  assert.equal(inspect.Config.User, "node");
  assert.equal(inspect.Config.Labels["com.aihub.source-content-sha256"], expectedDigest);
  assert.equal(inspect.Config.Labels["com.aihub.source-revision"], expectedDigest);
  assert.equal(inspect.Config.Labels["com.aihub.release-version"], expectedReleaseLabel);

  const probe = String.raw`
const crypto=require("node:crypto"),fs=require("node:fs");
const files=JSON.parse(process.argv[1]);
const destination=(source)=>source.startsWith("identity/")?"/app/identity/"+source.slice(9):source==="admin/resource-submissions.cjs"?"/app/admin/resource-submissions.cjs":source.startsWith("community/")?"/app/community/"+source.slice(10):source.startsWith("shared/")?"/app/shared/"+source.slice(7):source==="catalog/channel.json"?"/app/catalog/channel.json":source.endsWith("identity-entrypoint.sh")?"/usr/local/bin/aihub-identity-production-entrypoint":"/app/identity/workflow-migrate.cjs";
const copied=files.map((entry)=>{const bytes=fs.readFileSync(destination(entry.path));return {path:entry.path,bytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex")};});
const walk=(directory)=>fs.readdirSync(directory,{withFileTypes:true}).flatMap((entry)=>{const name=directory+"/"+entry.name;return entry.isDirectory()?walk(name):[name];});
require("/app/identity/workflow-official-publisher-service-identity.cjs");
require("/app/identity/workflow-resolvers.cjs");
require("/app/identity/workflow-official-bootstrap-production.cjs");
require("/app/community/workflow-official-source-posts.cjs");
require("/app/community/workflow-official-bootstrap.cjs");
const secretPaths=walk("/app").filter((name)=>/(^|\/)(?:\.env[^/]*|[^/]+\.(?:pem|key))$/i.test(name));
const secretContentHits=walk("/app").filter((name)=>/-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----|AKIA[0-9A-Z]{16}|(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/.test(fs.readFileSync(name,"utf8")));
process.stdout.write(JSON.stringify({copied,secretPaths,secretContentHits}));`;
  const result = JSON.parse(docker([
    "run", "--rm", "--network", "none", "--entrypoint", "node", image,
    "-e", probe, JSON.stringify(copiedFiles)
  ]));
  assert.deepEqual(result.copied, copiedFiles);
  assert.deepEqual(result.secretPaths, []);
  assert.deepEqual(result.secretContentHits, []);
});
