const assert = require("node:assert/strict");
const test = require("node:test");
const {
  cacheKey,
  parseRobotsTxt,
  parseSitemapIndexXml,
  parseSkillHtml,
  parseSkillSitemapXml,
  publicCocoLoopUrl
} = require("../shared/cocoloop-skill-intake.cjs");

const host = "skill.cocoloop.com";

test("CocoLoop public URL gate rejects API, non-HTTPS, and foreign hosts", () => {
  assert.equal(publicCocoLoopUrl("https://skill.cocoloop.com/skills/42", "https://skill.cocoloop.com/", host), "https://skill.cocoloop.com/skills/42");
  assert.equal(publicCocoLoopUrl("https://skill.cocoloop.com/api/skills", "https://skill.cocoloop.com/", host), null);
  assert.equal(publicCocoLoopUrl("http://skill.cocoloop.com/skills/42", "https://skill.cocoloop.com/", host), null);
  assert.equal(publicCocoLoopUrl("https://evil.example/skills/42", "https://skill.cocoloop.com/", host), null);
});

test("robots and sitemap index enumerate only public sitemap shards", () => {
  assert.deepEqual(parseRobotsTxt("User-agent: *\nDisallow: /api/\nSitemap: https://skill.cocoloop.com/sitemap-index.xml\n"), ["https://skill.cocoloop.com/sitemap-index.xml"]);
  assert.deepEqual(parseSitemapIndexXml("<sitemapindex><sitemap><loc>/skills-1.xml</loc></sitemap><sitemap><loc>https://evil.example/x.xml</loc></sitemap></sitemapindex>", "https://skill.cocoloop.com/sitemap-index.xml", host), ["https://skill.cocoloop.com/skills-1.xml"]);
});

test("skill sitemap preserves external id, lastmod, duplicates, and discoveredVia", () => {
  const rows = parseSkillSitemapXml("<urlset><url><loc>https://skill.cocoloop.com/skills/42</loc><lastmod>2026-08-07</lastmod></url><url><loc>/skills/42</loc></url><url><loc>/about</loc></url></urlset>", "https://skill.cocoloop.com/skills-1.xml", host);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { externalId: "42", pageUrl: "https://skill.cocoloop.com/skills/42", lastmod: "2026-08-07", discoveredVia: "cocoloop" });
  assert.equal(rows[1].lastmod, null);
  assert.equal(rows[2].externalId, null);
});

test("HTML metadata keeps ratings external and provenance unresolved", () => {
  const html = `<html><head><title>Demo Skill</title><meta name="description" content="A demo"><meta name="author" content="Ada"><meta name="category" content="research"><meta name="keywords" content="game-development, agent, automation"><meta name="agent-compatibility" content="Claude Code, OpenClaw"><meta name="security" content="CLS A"><meta name="install-count" content="12"><script type="application/ld+json">{"@type":"SoftwareApplication","name":"Demo Skill","version":"1.2.3","author":{"name":"Ada"},"aggregateRating":{"ratingValue":"4.8","ratingCount":"9"}}</script></head><body><a href="https://github.com/ada/demo">source</a><a href="https://skill.cocoloop.com/files/demo.zip">zip</a></body></html>`;
  const result = parseSkillHtml(html, "https://skill.cocoloop.com/skills/42", "2026-08-07T00:00:00.000Z");
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
  assert.deepEqual(result.zipUrls, ["https://skill.cocoloop.com/files/demo.zip"]);
});

test("cache keys are deterministic without exposing URL text", () => {
  assert.equal(cacheKey("https://skill.cocoloop.com/skills/42"), cacheKey("https://skill.cocoloop.com/skills/42"));
  assert.notEqual(cacheKey("https://skill.cocoloop.com/skills/42"), cacheKey("https://skill.cocoloop.com/skills/43"));
});
