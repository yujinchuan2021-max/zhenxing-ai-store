"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  markLocalServiceImagesPromoted,
  markLocalServiceImagesRolledBack,
  markLocalServiceImagesStaged,
  readLocalServiceImageReceipt
} = require("../shared/local-service-image-receipt.cjs");

function options(args) {
  const command = args[0];
  const parsed = {};
  for (let index = 1; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!/^--[a-z-]+$/.test(name || "") || value === undefined || parsed[name]) {
      throw new Error("Local service image receipt arguments are invalid");
    }
    parsed[name] = value;
  }
  return { command, parsed };
}

function trustedCandidates(filePath) {
  const resolved = path.resolve(String(filePath || ""));
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 64 * 1024) {
    throw new Error("Local service candidate file is not trusted");
  }
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

const { command, parsed } = options(process.argv.slice(2));
const receiptPath = path.resolve(String(parsed["--receipt"] || ""));
let receipt;
if (command === "read") {
  receipt = readLocalServiceImageReceipt(receiptPath);
} else if (command === "mark-staged") {
  receipt = markLocalServiceImagesStaged(
    receiptPath,
    trustedCandidates(parsed["--candidates"])
  );
} else if (command === "mark-promoted") {
  receipt = markLocalServiceImagesPromoted(receiptPath);
} else if (command === "mark-rolled-back") {
  receipt = markLocalServiceImagesRolledBack(receiptPath);
} else {
  throw new Error("Unknown local service image receipt command");
}
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
