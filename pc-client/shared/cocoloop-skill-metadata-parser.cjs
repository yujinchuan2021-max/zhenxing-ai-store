const crypto = require("node:crypto");

const HOST = "hub.cocoloop.cn";

function decode(value) {
  return String(value || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function attr(tag, name) { return String(tag || "").match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] || ""; }
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function split(value) { return String(value || "").split(/[,;|，、\n]/).map((item) => item.trim()).filter(Boolean); }

function publicSkillUrl(value, base) {
  let url;
  try { url = new URL(value, base); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== HOST || url.search || url.hash || !/^\/skills\/[1-9]\d*$/.test(url.pathname)) return null;
  return url.toString();
}

function meta(html, key) {
  const tags = [...String(html || "").matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const tag = tags.find((value) => ["name", "property", "itemprop"].some((name) => attr(value, name).toLowerCase() === key.toLowerCase()));
  return tag ? attr(tag, "content") : "";
}

function jsonLd(html) {
  return [...String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => {
    let value;
    try { value = JSON.parse(match[1].trim()); } catch { throw new Error("invalid JSON-LD"); }
    return Array.isArray(value) ? value : [value];
  });
}

function clean(value, limit, field) {
  const raw = decode(String(value || "").replace(/<[^>]*>/g, " "));
  if (/[\u0000-\u001F\u007F]/.test(raw) || raw.length > limit || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw) || /(?:\+?\d[\d ()-]{8,}\d)/.test(raw)) throw new Error(`unsafe ${field}`);
  return raw.replace(/\s+/g, " ").trim();
}

function parsePublicSkillMetadata(html, pageUrl, observedAt, runId) {
  const expected = publicSkillUrl(pageUrl, `https://${HOST}`);
  if (!expected) throw new Error("invalid public Skill page URL");
  const canonicalTags = [...String(html || "").matchAll(/<link[^>]+rel=["']canonical["'][^>]*>/gi)].map((match) => match[0]);
  if (canonicalTags.length !== 1) throw new Error("canonical must be unique");
  if (publicSkillUrl(attr(canonicalTags[0], "href"), expected) !== expected) throw new Error("canonical page mismatch");
  const applications = jsonLd(html).filter((value) => value && value["@type"] === "SoftwareApplication");
  if (applications.length !== 1) throw new Error("SoftwareApplication identity must be unique");
  const data = applications[0];
  for (const identity of [data.url, data["@id"]].filter(Boolean)) if (publicSkillUrl(identity, expected) !== expected) throw new Error("SoftwareApplication identity mismatch");
  const externalId = new URL(expected).pathname.split("/").at(-1);
  if (data.identifier != null) {
    const identifier = typeof data.identifier === "object" ? data.identifier.value : data.identifier;
    if (String(identifier) !== externalId) throw new Error("SoftwareApplication identifier mismatch");
  }
  const pageTitleRaw = clean(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 240, "pageTitle");
  const pageTitle = pageTitleRaw.replace(/ \| Skill下载_CocoLoop商店$/, "");
  const title = clean(data.name, 160, "title");
  const summary = clean(data.description || meta(html, "description") || meta(html, "og:description"), 500, "summary");
  if (!title || !summary) throw new Error("required public metadata missing");
  const rawTags = split(meta(html, "keywords"));
  if (rawTags.length > 24) throw new Error("too many tags");
  const tags = rawTags.map((value) => clean(value, 60, "tag")).filter((value) => value && !/^(?:Skill技能下载|CocoLoop|AI Agent|Skills|Skill商店|OpenClaw|Molili|MCP|Claude|AI工具|智能体|技能市场|AI Agent Skills|龙虾技能|OpenClaw Skill技能)$/i.test(value)).slice(0, 12);
  const normalized = { externalId, pageUrl: expected, title, pageTitle, summary, tags };
  return { ...normalized, contentHash: `sha256:${hash(JSON.stringify(normalized))}`, status: "metadata-observed-unreviewed", observedAt, runId };
}

module.exports = { parsePublicSkillMetadata };
