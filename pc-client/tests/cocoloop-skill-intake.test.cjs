const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  DEFAULT_HOST,
  acquireExclusiveLock,
  cacheKey,
  classifyPhase2HttpStatus,
  canonicalSkillRecord,
  checkpointPlan,
  dedupeSkillRows,
  fetchPageWith,
  inspectPhase2StopMarker,
  validateCheckpoint,
  validatePublicResponse,
  parseRobotsTxt,
  readBodyBytes,
  runWithPhase2Owner,
  parseSitemapIndexXml,
  parseSkillHtml,
  parsePublicSkillMetadata,
  phase2BatchStopReason,
  phase2InputManifestHash,
  planPhase2CheckpointReconcile,
  replaceAtomicWithRetry,
  parseSkillSitemapXml,
  publicCocoLoopUrl,
  validatePhase2Bindings,
  validatePhase2Extension,
  validatePhase2ParserMigration
} = require("../shared/cocoloop-skill-intake.cjs");

const host = "hub.cocoloop.cn";

test("CocoLoop Hub public URL gate rejects API, non-HTTPS, and foreign hosts", () => {
  assert.equal(DEFAULT_HOST, host);
  assert.equal(publicCocoLoopUrl("/robots.txt", "https://hub.cocoloop.cn/", host), "https://hub.cocoloop.cn/robots.txt");
  assert.equal(publicCocoLoopUrl("/sitemap-index.xml", "https://hub.cocoloop.cn/", host), "https://hub.cocoloop.cn/sitemap-index.xml");
  assert.equal(publicCocoLoopUrl("/sitemaps/skills-1.xml", "https://hub.cocoloop.cn/", host), "https://hub.cocoloop.cn/sitemaps/skills-1.xml");
  assert.equal(publicCocoLoopUrl("https://hub.cocoloop.cn/skills/42", "https://hub.cocoloop.cn/", host), "https://hub.cocoloop.cn/skills/42");
  assert.equal(publicCocoLoopUrl("https://hub.cocoloop.cn/skills/0", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("https://hub.cocoloop.cn/skills/demo", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("https://hub.cocoloop.cn/skills/42?x=1", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("https://hub.cocoloop.cn/skills/42#x", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("https://hub.cocoloop.cn/api/skills", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("/about", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("/_next/static/app.js", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("/sitemaps/posts-1.xml", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("/sitemaps/skills-0.xml", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("http://hub.cocoloop.cn/skills/42", "https://hub.cocoloop.cn/", host), null);
  assert.equal(publicCocoLoopUrl("https://evil.example/skills/42", "https://hub.cocoloop.cn/", host), null);
});

test("robots and sitemap index enumerate only public sitemap shards", () => {
  assert.deepEqual(parseRobotsTxt("User-agent: *\nDisallow: /api/\nSitemap: https://hub.cocoloop.cn/sitemap-index.xml\n"), ["https://hub.cocoloop.cn/sitemap-index.xml"]);
  assert.deepEqual(parseSitemapIndexXml("<?xml version=\"1.0\"?><sitemapindex><sitemap><loc>/sitemaps/skills-1.xml</loc></sitemap></sitemapindex>", "https://hub.cocoloop.cn/sitemap-index.xml", host), ["https://hub.cocoloop.cn/sitemaps/skills-1.xml"]);
  assert.deepEqual(parseSitemapIndexXml("<sitemapindex><sitemap><loc>https://hub.cocoloop.cn/sitemap.xml</loc></sitemap><sitemap><loc>/sitemaps/topics.xml</loc></sitemap><sitemap><loc>/sitemaps/skills-1.xml</loc></sitemap><sitemap><loc>/sitemaps/skills-721.xml</loc></sitemap></sitemapindex>", "https://hub.cocoloop.cn/sitemap-index.xml", host), ["https://hub.cocoloop.cn/sitemaps/skills-1.xml", "https://hub.cocoloop.cn/sitemaps/skills-721.xml"]);
  assert.throws(() => parseSitemapIndexXml("<sitemapindex><sitemap><loc>/sitemaps/unknown.xml</loc></sitemap></sitemapindex>", "https://hub.cocoloop.cn/sitemap-index.xml", host), /invalid Skill sitemap loc/);
  assert.throws(() => parseSitemapIndexXml("<sitemapindex><sitemap><loc>https://evil.example/sitemaps/skills-1.xml</loc></sitemap></sitemapindex>", "https://hub.cocoloop.cn/sitemap-index.xml", host), /invalid sitemap loc/);
});

test("synthetic mixed sitemap selects exactly the 721 Skill shards", () => {
  const entries = ["<sitemap><loc>/sitemap.xml</loc></sitemap>", "<sitemap><loc>/sitemaps/topics.xml</loc></sitemap>", ...Array.from({ length: 721 }, (_, index) => `<sitemap><loc>/sitemaps/skills-${index + 1}.xml</loc></sitemap>`)];
  assert.equal(parseSitemapIndexXml(`<sitemapindex>${entries.join("")}</sitemapindex>`, "https://hub.cocoloop.cn/sitemap-index.xml", host).length, 721);
});

test("skill sitemap preserves external id, lastmod, and discoveredVia", () => {
  const rows = parseSkillSitemapXml("<urlset><url><loc>https://hub.cocoloop.cn/skills/42</loc><lastmod>2026-08-07</lastmod></url><url><loc>/skills/43</loc></url></urlset>", "https://hub.cocoloop.cn/sitemaps/skills-1.xml", host);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { externalId: "42", pageUrl: "https://hub.cocoloop.cn/skills/42", lastmod: "2026-08-07", discoveredVia: "cocoloop" });
  assert.equal(rows[1].lastmod, null);
});

test("sitemap XML fails closed on truncation, bad loc cardinality, stray content, and duplicate loc", () => {
  const parse = (xml) => parseSkillSitemapXml(xml, "https://hub.cocoloop.cn/sitemaps/skills-1.xml", host);
  assert.throws(() => parse("<urlset><url><loc>/skills/42</loc></url>"), /truncated/);
  assert.throws(() => parse("<urlset><url></url></urlset>"), /exactly one loc/);
  assert.throws(() => parse("<urlset><url><loc>/skills/42</loc><loc>/skills/43</loc></url></urlset>"), /exactly one loc/);
  assert.throws(() => parse("stray<urlset><url><loc>/skills/42</loc></url></urlset>"), /invalid/);
  assert.throws(() => parse("<urlset><url><loc>/skills/42</loc></url><url><loc>/skills/42</loc></url></urlset>"), /duplicate loc/);
});

test("HTML metadata keeps ratings external and provenance unresolved", () => {
  const html = `<html><head><title>Demo Skill</title><meta name="description" content="A demo"><meta name="author" content="Ada"><meta name="category" content="research"><meta name="keywords" content="game-development, agent, automation"><meta name="agent-compatibility" content="Claude Code, OpenClaw"><meta name="security" content="CLS A"><meta name="install-count" content="12"><script type="application/ld+json">{"@type":"SoftwareApplication","name":"Demo Skill","version":"1.2.3","author":{"name":"Ada"},"aggregateRating":{"ratingValue":"4.8","ratingCount":"9"}}</script></head><body><a href="https://github.com/ada/demo">source</a><a href="https://hub.cocoloop.cn/skills/43">related</a><a href="https://dl.cocoloop.cn/files/demo.zip">zip</a></body></html>`;
  const result = parseSkillHtml(html, "https://hub.cocoloop.cn/skills/42", "2026-08-07T00:00:00.000Z");
  assert.equal(result.externalId, "42");
  assert.equal(result.version, "1.2.3");
  assert.equal(result.authorDisplay, "Ada");
  assert.equal(result.externalReference.ratingValue, "4.8");
  assert.equal(result.externalReference.sourcePlatform, "cocoloop");
  assert.deepEqual(result.rawTags, ["game-development", "agent", "automation"]);
  assert.deepEqual(result.normalizedTags, ["Agent", "自动化", "游戏"]);
  assert.ok(result.mappingEvidence.some((item) => item.canonicalTag === "游戏" && item.matchedAlias === "game-development"));
  assert.deepEqual(result.agentCompatibility.normalized, ["Claude Code", "OpenClaw"]);
  assert.equal(result.matureAgentEcosystemCandidate, false);
  assert.equal(result.provenanceStatus, "provenance-unresolved");
  assert.deepEqual(result.canonicalSourceCandidates, ["https://github.com/ada/demo"]);
  assert.deepEqual(result.zipUrls, ["https://dl.cocoloop.cn/files/demo.zip"]);
});

test("cache keys are deterministic without exposing URL text", () => {
  assert.equal(cacheKey("https://hub.cocoloop.cn/skills/42"), cacheKey("https://hub.cocoloop.cn/skills/42"));
  assert.notEqual(cacheKey("https://hub.cocoloop.cn/skills/42"), cacheKey("https://hub.cocoloop.cn/skills/43"));
});

test("candidate discovery records are minimal, canonical, and always unreviewed", () => {
  assert.deepEqual(canonicalSkillRecord({ externalId: "42", pageUrl: "https://hub.cocoloop.cn/skills/42", lastmod: "2026-08-07", discoveredVia: "cocoloop" }), {
    externalId: "42",
    pageUrl: "https://hub.cocoloop.cn/skills/42",
    lastmod: "2026-08-07",
    discoveredVia: "cocoloop",
    status: "discovered-unreviewed"
  });
});

test("sitemap duplicates collapse canonically and report exact duplicate count", () => {
  const result = dedupeSkillRows([
    { externalId: "42", pageUrl: "https://hub.cocoloop.cn/skills/42", lastmod: null },
    { externalId: "42", pageUrl: "https://hub.cocoloop.cn/skills/42/", lastmod: "2026-08-08" },
    { externalId: "43", pageUrl: "https://hub.cocoloop.cn/skills/43", lastmod: null }
  ]);
  assert.deepEqual(result.rows.map((row) => row.externalId), ["42", "43"]);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.rows[0].lastmod, "2026-08-08");
  assert.throws(() => dedupeSkillRows([
    { externalId: "42", pageUrl: "https://hub.cocoloop.cn/skills/42" },
    { externalId: "43", pageUrl: "https://hub.cocoloop.cn/skills/42/" }
  ]), /canonical URL conflict/);
  assert.throws(() => dedupeSkillRows([
    { externalId: "42", pageUrl: "https://hub.cocoloop.cn/skills/42" },
    { externalId: "42", pageUrl: "https://hub.cocoloop.cn/skills/0042" }
  ]), /external ID conflict/);
});

test("checkpoint planning resumes only incomplete declared shards", () => {
  const shards = ["https://hub.cocoloop.cn/sitemaps/skills-1.xml", "https://hub.cocoloop.cn/sitemaps/skills-2.xml"];
  assert.deepEqual(checkpointPlan(shards, { completedShards: { [shards[0]]: { rowCount: 2 } } }), [shards[1]]);
  assert.deepEqual(checkpointPlan(shards, { completedShards: { "https://evil.example/sitemap.xml": {} } }), shards);
});

test("response and checkpoint validation stop HTML and index drift", () => {
  assert.throws(() => validatePublicResponse({ status: 200, url: "https://hub.cocoloop.cn/sitemaps/skills-1.xml", contentType: "text/html" }, "xml"), /content type/);
  assert.throws(() => validatePublicResponse({ status: 200, url: "https://evil.example/sitemaps/skills-1.xml", contentType: "application/xml" }, "xml"), /redirect/);
  assert.throws(() => validateCheckpoint({ indexHash: "old", shardManifestHash: "m", outputOffset: 0, outputPrefixHash: "x" }, { indexHash: "new", shardManifestHash: "m", outputBytes: Buffer.alloc(0) }), /index hash drift/);
});

test("byte reader accepts exact limit and cancels chunked overflow and reader errors", async () => {
  function fake(chunks, errorAt = -1) {
    let index = 0; const state = { cancelled: false };
    return { state, response: { headers: { get: () => null }, body: { getReader: () => ({
      read: async () => { if (index === errorAt) throw new Error("reader boom"); return index < chunks.length ? { done: false, value: chunks[index++] } : { done: true }; },
      cancel: async () => { state.cancelled = true; }
    }) } } };
  }
  const exact = fake([new Uint8Array(2), new Uint8Array(3)]);
  assert.equal((await readBodyBytes(exact.response, 5)).byteLength, 5);
  assert.equal(exact.state.cancelled, false);
  const overflow = fake([new Uint8Array(3), new Uint8Array(3)]);
  await assert.rejects(() => readBodyBytes(overflow.response, 5), /byte limit/);
  assert.equal(overflow.state.cancelled, true);
  const broken = fake([new Uint8Array(1)], 1);
  await assert.rejects(() => readBodyBytes(broken.response, 5), /reader boom/);
  assert.equal(broken.state.cancelled, true);
});

test("public Skill metadata fixture emits only stable minimal fields", () => {
  const html = `<html><head><title>Fallback</title><link rel="canonical" href="https://hub.cocoloop.cn/skills/12277"><meta name="description" content="Safe public summary"><meta name="keywords" content="memory,AI Agent,CocoLoop"><script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Self-Improving Agent","description":"Safe public summary","author":{"@type":"Person","name":"pskoett"}}</script></head><body></body></html>`;
  assert.deepEqual(parsePublicSkillMetadata(html, "https://hub.cocoloop.cn/skills/12277", "2026-08-14T00:00:00.000Z", "phase2-001"), {
    externalId: "12277", pageUrl: "https://hub.cocoloop.cn/skills/12277", title: "Self-Improving Agent", pageTitle: "Fallback", summary: "Safe public summary", tags: ["memory"],
    contentHash: "sha256:79bdee0f948172e9925310e7d8cac6d888de501ae0b78eca9c1120e019e79d6a", status: "metadata-observed-unreviewed", observedAt: "2026-08-14T00:00:00.000Z", runId: "phase2-001"
  });
  assert.throws(() => parsePublicSkillMetadata(html.replace("/skills/12277", "/skills/999"), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /canonical page mismatch/);
  assert.throws(() => parsePublicSkillMetadata(html.replace('<link rel="canonical" href="https://hub.cocoloop.cn/skills/12277">', ""), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /canonical must be unique/);
  assert.throws(() => parsePublicSkillMetadata(html.replace("</head>", '<link rel="canonical" href="https://hub.cocoloop.cn/skills/12277"></head>'), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /canonical must be unique/);
  assert.throws(() => parsePublicSkillMetadata(html.replace("</head>", '<script type="application/ld+json">bad</script></head>'), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /invalid JSON-LD/);
  assert.throws(() => parsePublicSkillMetadata(html.replace("</head>", '<script type="application/ld+json">{"@type":"SoftwareApplication","name":"Other"}</script></head>'), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /identity must be unique/);
  assert.throws(() => parsePublicSkillMetadata(html.replace('"description":"Safe public summary"', '"description":"mail me at a@example.com"'), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /unsafe summary/);
  assert.throws(() => parsePublicSkillMetadata(html.replace('"name":"Self-Improving Agent"', '"name":"Call +1 212 555 0123"'), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /unsafe title/);
  assert.throws(() => parsePublicSkillMetadata(html.replace('"@type":"SoftwareApplication"', '"@type":"SoftwareApplication","url":"https://hub.cocoloop.cn/skills/999"'), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /identity mismatch/);
  assert.throws(() => parsePublicSkillMetadata(html.replace('"@type":"SoftwareApplication"', '"@type":"SoftwareApplication","identifier":"999"'), "https://hub.cocoloop.cn/skills/12277", "x", "r"), /identifier mismatch/);
});

test("exclusive owner lock rejects a concurrent instance and only owner token releases", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cocoloop-lock-"));
  const lock = path.join(directory, "owner.lock");
  const release = acquireExclusiveLock(lock, { pid: process.pid, runToken: "one" });
  assert.throws(() => acquireExclusiveLock(lock, { pid: process.pid, runToken: "two" }), /owner lock exists/);
  release();
  assert.equal(fs.existsSync(lock), false);
  fs.rmdirSync(directory);
});

test("Phase2 bindings reject ordered-input and parser drift without mutating checkpoint", () => {
  const pages = [
    { externalId: "1", pageUrl: "https://hub.cocoloop.cn/skills/1" },
    { externalId: "2", pageUrl: "https://hub.cocoloop.cn/skills/2" }
  ];
  const current = { phase1IndexSha256: "index", inputManifestSha256: phase2InputManifestHash(pages), parserArtifactSha256: "parser", parserSchema: "phase2-minimal-v2" };
  const checkpoint = structuredClone(current);
  validatePhase2Bindings(checkpoint, current);
  assert.deepEqual(checkpoint, current);
  assert.notEqual(phase2InputManifestHash([...pages].reverse()), current.inputManifestSha256);
  assert.throws(() => validatePhase2Bindings(checkpoint, { ...current, inputManifestSha256: phase2InputManifestHash([...pages].reverse()) }), /inputManifestSha256 drift/);
  assert.throws(() => validatePhase2Bindings(checkpoint, { ...current, parserArtifactSha256: "changed" }), /parserArtifactSha256 drift/);
});

test("Phase2 response contract globally stops 403/429 and refuses redirects or non-HTML", () => {
  assert.equal(classifyPhase2HttpStatus(403), "http-403-stop");
  assert.equal(classifyPhase2HttpStatus(429), "http-429-stop");
  assert.equal(classifyPhase2HttpStatus(302), "redirect-boundary");
  assert.equal(classifyPhase2HttpStatus(404), "http-404");
  assert.equal(classifyPhase2HttpStatus(200), "http-2xx");
  assert.throws(() => validatePublicResponse({ status: 200, url: "https://hub.cocoloop.cn/skills/42", contentType: "application/json" }, "html"), /HTML content type/);
});

test("Phase2 injected fetch chain stops safely and enforces response/body boundaries", async () => {
  const pageUrl = "https://hub.cocoloop.cn/skills/42";
  function fakeResponse(status, { contentType = "text/html", contentLength = null, chunks = [], url = pageUrl } = {}) {
    let index = 0;
    const state = { reads: 0, cancelled: false };
    return { state, response: { status, url, statusText: "secret", headers: { get: (name) => name === "content-type" ? contentType : name === "content-length" ? contentLength : name === "retry-after" ? "private" : null }, body: { getReader: () => ({
      read: async () => { state.reads += 1; return index < chunks.length ? { done: false, value: chunks[index++] } : { done: true }; },
      cancel: async () => { state.cancelled = true; }
    }) } } };
  }
  for (const status of [403, 429]) {
    const fixture = fakeResponse(status, { chunks: [new Uint8Array([1])] });
    const outcomes = [], appended = [];
    let error;
    try { await fetchPageWith(async () => fixture.response, pageUrl, 5); } catch (caught) { error = caught; }
    assert.equal(error.safetyStop, true);
    assert.deepEqual(error.stopRecord, { stopped: true, statusClass: status === 429 ? "http-429" : "http-403", externalId: "42" });
    assert.deepEqual(Object.keys(error.stopRecord), ["stopped", "statusClass", "externalId"]);
    assert.equal(fixture.state.reads, 0); assert.equal(outcomes.length, 0); assert.equal(appended.length, 0);
  }
  const redirect = fakeResponse(302, { chunks: [new Uint8Array([1])] });
  let fetchOptions;
  assert.deepEqual(await fetchPageWith(async (_url, options) => { fetchOptions = options; return redirect.response; }, pageUrl, 5), { statusClass: "redirect-boundary", bytes: 0 });
  assert.equal(fetchOptions.redirect, "manual"); assert.equal(redirect.state.reads, 0);
  const nonHtml = fakeResponse(200, { contentType: "application/json", chunks: [new Uint8Array([1])] });
  await assert.rejects(() => fetchPageWith(async () => nonHtml.response, pageUrl, 5), /HTML content type/); assert.equal(nonHtml.state.reads, 0);
  const declaredOversize = fakeResponse(200, { contentLength: "6", chunks: [new Uint8Array(6)] });
  await assert.rejects(() => fetchPageWith(async () => declaredOversize.response, pageUrl, 5), /byte limit/); assert.equal(declaredOversize.state.reads, 0);
  for (const contentLength of [null, "1"]) {
    const chunked = fakeResponse(200, { contentLength, chunks: [new Uint8Array(3), new Uint8Array(3)] });
    await assert.rejects(() => fetchPageWith(async () => chunked.response, pageUrl, 5), /byte limit/); assert.equal(chunked.state.cancelled, true);
  }
  const exact = fakeResponse(200, { contentLength: "5", chunks: [new TextEncoder().encode("hello")] });
  assert.deepEqual(await fetchPageWith(async () => exact.response, pageUrl, 5), { statusClass: "http-2xx", bytes: 5, html: "hello" });
});

test("Phase2 extension accepts only an exact unique first1000 outcome prefix", () => {
  const pages = Array.from({ length: 5000 }, (_, index) => ({ externalId: String(index + 1), pageUrl: `https://hub.cocoloop.cn/skills/${index + 1}` }));
  const checkpoint = { targetCount: 1000, nextIndex: 1000, inputManifestSha256: phase2InputManifestHash(pages.slice(0, 1000)) };
  const ids = pages.slice(0, 1000).map((row) => row.externalId);
  assert.doesNotThrow(() => validatePhase2Extension(checkpoint, pages, ids));
  assert.throws(() => validatePhase2Extension(checkpoint, [pages[1], pages[0], ...pages.slice(2)], ids), /prefix drift/);
  assert.throws(() => validatePhase2Extension(checkpoint, pages, [...ids.slice(0, -1), ids[0]]), /duplicate outcome/);
});

test("Phase2 batch thresholds stop only beyond bounded rates or at ten consecutive failures", () => {
  const counts = (overrides) => ({ completed: 100, fetchFailure: 2, parseFailure: 1, otherFailure: 0, consecutiveFailures: 0, ...overrides });
  assert.equal(phase2BatchStopReason(counts({})), null);
  assert.equal(phase2BatchStopReason(counts({ fetchFailure: 3 })), "fetch-failure-rate");
  assert.equal(phase2BatchStopReason(counts({ parseFailure: 2 })), "parse-failure-rate");
  assert.equal(phase2BatchStopReason(counts({ completed: 99, fetchFailure: 99, parseFailure: 99 })), null);
  assert.equal(phase2BatchStopReason(counts({ consecutiveFailures: 9 })), null);
  assert.equal(phase2BatchStopReason(counts({ completed: 9, consecutiveFailures: 10 })), "consecutive-failures");
});

test("existing Phase2 stop markers reject before task and preserve output bytes and mtime", async () => {
  for (const marker of [
    { stopped: true, statusClass: "http-403", externalId: "42" },
    { stopped: true, statusClass: "http-429", externalId: "42" },
    { stopped: true, statusClass: "fetch-failure-rate", completed: 100 }
  ]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cocoloop-stop-"));
    const lock = path.join(directory, "owner.lock"), stop = path.join(directory, "stopped.json"), output = path.join(directory, "metadata.ndjson");
    fs.writeFileSync(stop, JSON.stringify(marker)); fs.writeFileSync(output, "frozen\n");
    const before = { bytes: fs.readFileSync(output), mtime: fs.statSync(output).mtimeMs };
    let calls = 0;
    await assert.rejects(() => runWithPhase2Owner(lock, { pid: process.pid, runToken: crypto.randomUUID() }, stop, async () => { calls += 1; }), /Phase2 stopped/);
    assert.equal(calls, 0); assert.deepEqual(fs.readFileSync(output), before.bytes); assert.equal(fs.statSync(output).mtimeMs, before.mtime); assert.equal(fs.existsSync(lock), false);
    fs.rmSync(directory, { recursive: true });
  }
});

test("Phase2 stop marker fails closed on corrupt, extra fields, and reparse input", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cocoloop-stop-bad-"));
  const stop = path.join(directory, "stopped.json");
  fs.writeFileSync(stop, "{"); assert.throws(() => inspectPhase2StopMarker(stop), /invalid.*JSON/);
  fs.writeFileSync(stop, JSON.stringify({ stopped: true, statusClass: "http-429", externalId: "42", retryAfter: "secret" })); assert.throws(() => inspectPhase2StopMarker(stop), /schema/);
  const fakeFs = { existsSync: () => true, lstatSync: () => ({ isFile: () => true, isSymbolicLink: () => true }) };
  assert.throws(() => inspectPhase2StopMarker(stop, fakeFs), /unsafe/);
  fs.rmSync(directory, { recursive: true });
});

test("Phase2 parser binding migration accepts only the frozen source and exact bindings", () => {
  const checkpoint = { targetCount: 5000, nextIndex: 1409, phase1IndexSha256: "index", inputManifestSha256: "input", parserSchema: "phase2-minimal-v2", parserArtifactSha256: "f4b70082f622f5daf16f9b1a597dcecc005bac89059ef5ceaeac732c80b22e9c" };
  const current = { phase1IndexSha256: "index", inputManifestSha256: "input", parserSchema: "phase2-minimal-v2", parserArtifactSha256: "0182e734cfe891f340e7c630b99f5c321dcdd916b1cca83bf5fd515b143919b8" };
  assert.equal(validatePhase2ParserMigration(checkpoint, current).parserArtifactSha256, current.parserArtifactSha256);
  assert.throws(() => validatePhase2ParserMigration({ ...checkpoint, parserArtifactSha256: "0".repeat(64) }, current), /not allowlisted/);
  assert.throws(() => validatePhase2ParserMigration(checkpoint, { ...current, parserArtifactSha256: "a".repeat(64) }), /target not allowlisted/);
  assert.throws(() => validatePhase2ParserMigration(checkpoint, { ...current, phase1IndexSha256: "drift" }), /phase1IndexSha256 drift/);
  assert.throws(() => validatePhase2ParserMigration(checkpoint, { ...current, inputManifestSha256: "drift" }), /inputManifestSha256 drift/);
  assert.throws(() => validatePhase2ParserMigration(checkpoint, { ...current, parserSchema: "drift" }), /parserSchema drift/);
});

test("Windows atomic replace retries only transient sharing failures and preserves both files on exhaustion", () => {
  let calls = 0;
  replaceAtomicWithRetry(() => { calls += 1; if (calls < 3) throw Object.assign(new Error("sharing"), { code: "EPERM" }); }, "tmp", "checkpoint", { wait: () => {} });
  assert.equal(calls, 3);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cocoloop-replace-")), temporary = path.join(directory, "checkpoint.tmp"), destination = path.join(directory, "checkpoint.json");
  fs.writeFileSync(temporary, "new"); fs.writeFileSync(destination, "old");
  assert.throws(() => replaceAtomicWithRetry(() => { throw Object.assign(new Error("sharing"), { code: "EPERM" }); }, temporary, destination, { attempts: 2, wait: () => {} }), /sharing/);
  assert.equal(fs.readFileSync(temporary, "utf8"), "new"); assert.equal(fs.readFileSync(destination, "utf8"), "old");
  assert.throws(() => replaceAtomicWithRetry(() => { throw Object.assign(new Error("bad"), { code: "EINVAL" }); }, "tmp", "checkpoint", { wait: () => {} }), /bad/);
  fs.rmSync(directory, { recursive: true });
});

test("Phase2 reconcile promotes only an exact one-outcome committed tmp checkpoint", () => {
  const old = { nextIndex: 4012, targetCount: 5000, phase1IndexSha256: "index", inputManifestSha256: "inputs", parserArtifactSha256: "parser", parserSchema: "schema", counts: { http2xx: 3998, parsed: 3974, parseFailure: 24, http404: 0, fetchFailure: 14, http429: 0, http403: 0, bytes: 100 }, records: { bytes: 10, sha256: "old", lines: 3974 }, failures: { bytes: 2, sha256: "fail", lines: 38 }, batchCounts: { completed: 3012, fetchFailure: 9, parseFailure: 23, otherFailure: 0, consecutiveFailures: 0 } };
  const current = { records: { bytes: 12, sha256: "new", lines: 3975 }, failures: old.failures, oldPrefixesMatch: true, extraOutcomes: [{ externalId: "13474", pageUrl: "https://hub.cocoloop.cn/skills/13474" }], expectedInput: { externalId: "13474", pageUrl: "https://hub.cocoloop.cn/skills/13474" } };
  const tmp = { ...structuredClone(old), nextIndex: 4013, counts: { ...old.counts, http2xx: 3999, parsed: 3975, bytes: 105 }, records: current.records, batchCounts: { ...old.batchCounts, completed: 3013 } };
  assert.deepEqual(planPhase2CheckpointReconcile(old, tmp, current), { action: "promote-tmp", nextIndex: 4013 });
  assert.throws(() => planPhase2CheckpointReconcile(old, { ...tmp, nextIndex: 4014 }, current), /exactly one/);
  assert.throws(() => planPhase2CheckpointReconcile(old, { ...tmp, records: { ...tmp.records, sha256: "wrong" } }, current), /artifact/);
  assert.throws(() => planPhase2CheckpointReconcile(old, tmp, { ...current, extraOutcomes: [current.extraOutcomes[0], current.extraOutcomes[0]] }), /outcome/);
  assert.throws(() => planPhase2CheckpointReconcile(old, tmp, { ...current, expectedInput: { externalId: "other", pageUrl: current.expectedInput.pageUrl } }), /identity/);
});
