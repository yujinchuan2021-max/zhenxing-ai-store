"use strict";

function getProductInstallPresentation({ stage, filePath }) {
  if (stage === "downloaded") {
    return {
      filePath,
      buttonLabel: "立即安装",
      disabled: false,
      showHash: false,
      showTaskLog: false
    };
  }
  if (stage === "detecting") {
    return {
      filePath: "",
      buttonLabel: "正在准备",
      disabled: true,
      showHash: false,
      showTaskLog: false
    };
  }
  if (
    [
      "deploying",
      "launching-installer",
      "awaiting-verification"
    ].includes(stage)
  ) {
    return {
      filePath: "",
      buttonLabel: "正在安装",
      disabled: true,
      showHash: false,
      showTaskLog: false
    };
  }
  return null;
}

module.exports = {
  getProductInstallPresentation
};
