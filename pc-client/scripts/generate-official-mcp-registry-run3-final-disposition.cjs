"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildFinalDisposition,
  contract
} = require("../shared/official-mcp-registry-final-disposition.cjs");

const ROOT = path.resolve(__dirname, "..");
const TARGET = path.join(ROOT, ...contract.OUTPUT_DIRECTORY.split("/"));

function readInputs() {
  const files = { contract: fs.readFileSync(path.join(ROOT, ...contract.CONTRACT.path.split("/"))) };
  for (const input of contract.INPUTS) files[input.key] = fs.readFileSync(path.join(ROOT, ...input.path.split("/")));
  return files;
}

function assertNormalDirectory(directory, label) {
  const state = fs.lstatSync(directory);
  if (!state.isDirectory() || state.isSymbolicLink()) throw new Error(`${label} must be a normal directory`);
}

function writeExclusive(filePath, bytes) {
  const descriptor = fs.openSync(filePath, "wx");
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function verifyExisting(expected) {
  assertNormalDirectory(TARGET, "Final disposition output");
  const names = fs.readdirSync(TARGET).sort();
  const expectedNames = [...contract.ALL_FILES].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) throw new Error("Final disposition output file set drift");
  for (const name of expectedNames) {
    const filePath = path.join(TARGET, name);
    const state = fs.lstatSync(filePath);
    if (!state.isFile() || state.isSymbolicLink() || !fs.readFileSync(filePath).equals(expected[name])) {
      throw new Error(`Final disposition output drift: ${name}`);
    }
  }
}

function removeStaging(directory) {
  if (!fs.existsSync(directory)) return;
  assertNormalDirectory(directory, "Final disposition staging");
  const allowed = new Set(contract.ALL_FILES);
  for (const name of fs.readdirSync(directory)) {
    if (!allowed.has(name)) throw new Error("Final disposition staging file set drift");
    const filePath = path.join(directory, name);
    const state = fs.lstatSync(filePath);
    if (!state.isFile() || state.isSymbolicLink()) throw new Error("Final disposition staging contains a non-file");
    fs.unlinkSync(filePath);
  }
  fs.rmdirSync(directory);
}

function run() {
  if (process.argv.length !== 2) throw new Error("Final disposition generator accepts no arguments");
  const parent = path.dirname(TARGET);
  assertNormalDirectory(parent, "Final disposition parent");
  const prefix = `${path.basename(TARGET)}.`;
  const siblings = fs.readdirSync(parent);
  if (siblings.some((name) => name.startsWith(prefix) && (name.endsWith(".tmp") || name.endsWith(".lock")))) {
    throw new Error("Final disposition staging or writer lock already exists");
  }
  const first = buildFinalDisposition(readInputs());
  const second = buildFinalDisposition(readInputs());
  for (const name of contract.ALL_FILES) {
    if (!first.files[name].equals(second.files[name])) throw new Error(`Pure rebuild drift: ${name}`);
  }
  if (fs.existsSync(TARGET)) {
    verifyExisting(first.files);
    return { written: false, summary: first.summary };
  }
  const nonce = `${process.pid}.${crypto.randomUUID()}`;
  const lock = `${TARGET}.lock`;
  const staging = `${TARGET}.${nonce}.tmp`;
  fs.mkdirSync(lock);
  try {
    fs.mkdirSync(staging);
    try {
      for (const name of contract.ALL_FILES) writeExclusive(path.join(staging, name), first.files[name]);
      const descriptor = fs.openSync(staging, "r");
      try {
        try { fs.fsyncSync(descriptor); } catch (error) {
          if (process.platform !== "win32" || error.code !== "EPERM") throw error;
        }
      } finally { fs.closeSync(descriptor); }
      fs.renameSync(staging, TARGET);
    } catch (error) {
      removeStaging(staging);
      throw error;
    }
  } finally {
    fs.rmdirSync(lock);
  }
  verifyExisting(first.files);
  return { written: true, summary: first.summary };
}

if (require.main === module) {
  const result = run();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

module.exports = Object.freeze({ run });
