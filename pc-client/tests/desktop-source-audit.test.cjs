"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  evaluateDesktopSourceProbe,
  parseCurlProbeOutput
} = require("../shared/desktop-source-audit.cjs");

const plan = {
  url: "https://downloads.example.com/Product.exe",
  allowedHosts: ["downloads.example.com", "cdn.example.com"]
};

test("accepts an HTTPS executable response on an approved final host", () => {
  assert.deepEqual(
    evaluateDesktopSourceProbe({
      plan,
      probe: {
        statusCode: 206,
        finalUrl: "https://cdn.example.com/Product.exe?token=short-lived",
        contentType: "application/octet-stream",
        exitCode: 0,
        error: ""
      }
    }),
    { ok: true, reasons: [], warnings: [] }
  );
});

test("rejects redirects outside the reviewed host list", () => {
  const result = evaluateDesktopSourceProbe({
    plan,
    probe: {
      statusCode: 200,
      finalUrl: "https://lookalike.example.net/Product.exe",
      contentType: "application/x-msdownload",
      exitCode: 0,
      error: ""
    }
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /host/i);
});

test("rejects HTTP errors and HTML landing pages", () => {
  const forbidden = evaluateDesktopSourceProbe({
    plan,
    probe: {
      statusCode: 403,
      finalUrl: plan.url,
      contentType: "application/octet-stream",
      exitCode: 0,
      error: ""
    }
  });
  assert.equal(forbidden.ok, false);
  assert.match(forbidden.reasons.join(" "), /HTTP 403/);

  const landing = evaluateDesktopSourceProbe({
    plan,
    probe: {
      statusCode: 200,
      finalUrl: plan.url,
      contentType: "text/html; charset=utf-8",
      exitCode: 0,
      error: ""
    }
  });
  assert.equal(landing.ok, false);
  assert.match(landing.reasons.join(" "), /content type/i);
});

test("accepts a Windows executable when an official object store mislabels it", () => {
  const result = evaluateDesktopSourceProbe({
    plan,
    probe: {
      statusCode: 206,
      finalUrl: plan.url,
      contentType: "text/html; charset=utf-8",
      magicHex: "4d5a90000300000004000000ffff0000",
      exitCode: 0,
      error: ""
    }
  });
  assert.equal(result.ok, true);
  assert.match(result.warnings.join(" "), /mislabeled/i);
});

test("treats curl max-filesize as reachable when the server ignored Range", () => {
  const result = evaluateDesktopSourceProbe({
    plan,
    probe: {
      statusCode: 200,
      finalUrl: plan.url,
      contentType: "application/octet-stream",
      exitCode: 63,
      error: "Maximum file size exceeded"
    }
  });
  assert.equal(result.ok, true);
  assert.match(result.warnings.join(" "), /Range/i);
});

test("parses curl JSON even when curl exits after the response headers", () => {
  assert.deepEqual(
    parseCurlProbeOutput(
      '{"response_code":206,"url_effective":"https://downloads.example.com/Product.exe","content_type":"application/octet-stream"}'
    ),
    {
      statusCode: 206,
      finalUrl: "https://downloads.example.com/Product.exe",
      contentType: "application/octet-stream"
    }
  );
});
