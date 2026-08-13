import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the official site without a public download claim", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>枕星 AI｜桌面 AI 的可信入口<\/title>/);
  assert.match(html, /跳到主要内容/);
  assert.match(html, /id="main-content"/);
  assert.match(html, /Windows/);
  assert.match(html, /macOS/);
  assert.match(html, /Linux/);
  assert.match(html, /联机评审候选/);
  assert.match(html, /尚未公开下载/);
  assert.match(html, /SHA-256/);
  assert.match(html, /低门槛，不降安全线/);
  assert.match(html, /固定合同和用户确认/);
  assert.match(html, /zhenxingai-logo-starry\.png/);
  assert.doesNotMatch(html, /(?:\.exe|\.msi|\.msix|\.zip)(?:["'?\s])/i);
  assert.doesNotMatch(html, /\b(?:Skill|MCP|Plugin|Connector|Workflow)\b/i);
});

test("keeps legacy directory and account routes out of the public site", async () => {
  const [vendors, vendor, login] = await Promise.all([
    readFile(new URL("../app/vendors/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/vendors/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [vendors, vendor, login]) {
    assert.match(source, /redirect\("\/"\)/);
  }
});

test("keeps the published page responsive, keyboard-visible, and local-asset only", async () => {
  const [css, logo, socialCard] = await Promise.all([
    readFile(new URL("../app/official-site.module.css", import.meta.url), "utf8"),
    access(new URL("../public/zhenxingai-logo-simple.png", import.meta.url)),
    access(new URL("../public/og-zhenxingai.png", import.meta.url)),
  ]);

  assert.equal(logo, undefined);
  assert.equal(socialCard, undefined);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media\s*\(max-width:\s*740px\)/);
  assert.doesNotMatch(css, /https?:\/\//);
});
