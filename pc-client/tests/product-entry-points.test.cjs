"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveProductEntryPoints,
  validateProductEntryPoints
} = require("../shared/product-entry-points.cjs");

function product(overrides = {}) {
  return {
    kind: "桌面端",
    productType: "desktop-reviewed",
    website: "https://example.com/download",
    tutorial: "https://example.com/help",
    ...overrides
  };
}

test("product entry points preserve the backend-defined button order", () => {
  const entryPoints = [
    { type: "website", label: "工具官网", url: "https://example.com" },
    { type: "web", label: "示例网页版", url: "https://app.example.com" },
    { type: "desktop", label: "示例客户端一键安装" }
  ];
  const value = product({ entryPoints });
  assert.equal(validateProductEntryPoints(value), "");
  assert.deepEqual(resolveProductEntryPoints(value), entryPoints);
});

test("product action entries cannot carry backend commands or paths", () => {
  for (const extra of [
    { command: "powershell" },
    { args: ["-c", "whoami"] },
    { path: "C:\\Temp" },
    { url: "https://example.com/setup.exe" }
  ]) {
    assert.match(
      validateProductEntryPoints(
        product({
          entryPoints: [
            { type: "desktop", label: "一键安装", ...extra }
          ]
        })
      ),
      /不能携带/
    );
  }
});

test("link entries require HTTPS and reject unknown fields", () => {
  assert.match(
    validateProductEntryPoints(
      product({
        entryPoints: [
          { type: "web", label: "网页版", url: "http://example.com" }
        ]
      })
    ),
    /无效/
  );
  assert.match(
    validateProductEntryPoints(
      product({
        entryPoints: [
          {
            type: "website",
            label: "官网",
            url: "https://example.com",
            script: "run"
          }
        ]
      })
    ),
    /无效/
  );
});

test("CLI lifecycle entries remain on independent CLI products", () => {
  assert.equal(
    validateProductEntryPoints(
      product({
        kind: "CLI",
        productType: "cli",
        entryPoints: [
          { type: "website", label: "CLI 官网", url: "https://example.com" },
          { type: "cli", label: "CLI 一键安装" }
        ]
      })
    ),
    ""
  );
  assert.match(
    validateProductEntryPoints(
      product({ entryPoints: [{ type: "cli", label: "CLI 一键安装" }] })
    ),
    /独立 CLI/
  );
});

test("legacy products receive compatible entry points", () => {
  assert.deepEqual(resolveProductEntryPoints(product()), [
    {
      type: "website",
      label: "工具官网",
      url: "https://example.com/download"
    },
    {
      type: "tutorial",
      label: "打开教程",
      url: "https://example.com/help"
    },
    { type: "desktop", label: "一键安装" }
  ]);
});
