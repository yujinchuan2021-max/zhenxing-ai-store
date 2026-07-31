"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getProductInstallPresentation
} = require("../shared/product-install-presentation.cjs");

test("installing is one disabled button without explanatory copy", () => {
  for (const stage of [
    "deploying",
    "launching-installer",
    "awaiting-verification"
  ]) {
    assert.deepEqual(getProductInstallPresentation({ stage }), {
      filePath: "",
      buttonLabel: "正在安装",
      disabled: true,
      showHash: false,
      showTaskLog: false
    });
  }
});

test("preparing an install keeps one disabled button visible", () => {
  assert.deepEqual(getProductInstallPresentation({ stage: "detecting" }), {
    filePath: "",
    buttonLabel: "正在准备",
    disabled: true,
    showHash: false,
    showTaskLog: false
  });
});

test("a downloaded package shows only its path and immediate install", () => {
  assert.deepEqual(
    getProductInstallPresentation({
      stage: "downloaded",
      filePath: "D:\\AI Hub\\Claude-Setup-x64.exe"
    }),
    {
      filePath: "D:\\AI Hub\\Claude-Setup-x64.exe",
      buttonLabel: "立即安装",
      disabled: false,
      showHash: false,
      showTaskLog: false
    }
  );
});
