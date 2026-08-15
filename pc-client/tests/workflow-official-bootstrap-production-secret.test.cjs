"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createLocalFlarumAdminRequest,
  POST_MARKERS
} = require("../community/workflow-official-source-posts.cjs");
const {
  parseForumApiKeyFile
} = require("../identity/workflow-official-bootstrap-production.cjs");

test("production forum API key accepts the observed 65-byte file with one terminal LF", () => {
  const secret = "a".repeat(64);
  const file = `${secret}\n`;

  assert.equal(Buffer.byteLength(file), 65);
  assert.equal(parseForumApiKeyFile(file), secret);
});

test("production forum API key accepts only no terminator or one terminal LF", () => {
  const secret = "b".repeat(64);
  assert.equal(parseForumApiKeyFile(secret), secret);
  assert.equal(parseForumApiKeyFile(`${secret}\n`), secret);

  const rejected = [
    ["bare CR", `${secret}\r`],
    ["terminal CRLF without an authority contract", `${secret}\r\n`],
    ["internal CR", `${secret.slice(0, 32)}\r${secret.slice(32)}`],
    ["internal LF", `${secret.slice(0, 32)}\n${secret.slice(32)}`],
    ["double LF", `${secret}\n\n`],
    ["double CRLF", `${secret}\r\n\r\n`],
    ["leading space", ` ${secret}`],
    ["trailing space", `${secret} `],
    ["leading tab", `\t${secret}`],
    ["NUL", `${secret.slice(0, 32)}\0${secret.slice(32)}`],
    ["C0 control", `${secret.slice(0, 32)}\x1f${secret.slice(32)}`],
    ["DEL", `${secret.slice(0, 32)}\x7f${secret.slice(32)}`],
    ["format control", `${secret.slice(0, 32)}\u200b${secret.slice(32)}`],
    ["header delimiter", `${secret};`],
    ["below minimum", `${"c".repeat(31)}\n`],
    ["above maximum", `${"d".repeat(513)}\n`]
  ];
  for (const [label, file] of rejected) {
    assert.throws(
      () => parseForumApiKeyFile(file),
      { message: "official Workflow bootstrap Flarum credential is invalid" },
      label
    );
  }
  assert.throws(
    () => parseForumApiKeyFile(Buffer.from(secret)),
    { message: "official Workflow bootstrap Flarum credential is invalid" }
  );
});

test("validated forum API key reaches only the fixed Flarum Authorization header unchanged", async () => {
  const secret = "e".repeat(64);
  const calls = [];
  const request = createLocalFlarumAdminRequest({
    apiKey: parseForumApiKeyFile(`${secret}\n`),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  const requestPath = `/api/discussions?filter%5Bq%5D=${POST_MARKERS["chatgpt-desktop-research"]}&page%5Blimit%5D=20`;
  const response = await request({ method: "GET", path: requestPath });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Authorization, `Token ${secret}; userId=1`);
  assert.equal(calls[0].url, `http://127.0.0.1${requestPath}`);
  assert.equal(calls[0].url.includes(secret), false);
});
