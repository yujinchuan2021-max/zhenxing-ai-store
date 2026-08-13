"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const VERSION = /^(?:0|[1-9]\d*)\.\d+\.\d+$/;
const REVISION = /^[0-9a-f]{40}$/;
const TRANSACTION_ID = /^[0-9a-f]{32}$/;
const SAFE_FILE = /^[a-z][a-z0-9-]{0,40}\.json$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FORWARD_PHASES = Object.freeze([
  "initializing",
  "created",
  "delivery-activating",
  "delivery-active",
  "runtime-activating",
  "runtime-active",
  "services-staging",
  "services-staged",
  "services-promoting",
  "services-active",
  "accepted",
  "runtime-finalized",
  "services-finalized",
  "delivery-finalized"
]);
const ROLLBACK_PHASES = Object.freeze([
  "rollback-started",
  "runtime-rolled-back",
  "services-rolled-back",
  "delivery-rolled-back"
]);
const ALL_PHASES = new Set([...FORWARD_PHASES, ...ROLLBACK_PHASES]);

function exactKeys(value, names) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === names.length &&
    Object.keys(value).every((name) => names.includes(name))
  );
}

function trustedDirectory(directory, { create = false } = {}) {
  if (typeof directory !== "string" || !path.isAbsolute(directory)) {
    throw new TypeError("Local release transaction directory is invalid");
  }
  const resolved = path.resolve(directory);
  if (create && !fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  }
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Local release transaction directory is not trusted");
  }
  return resolved;
}

function trustedChild(parent, name, { mustExist = false } = {}) {
  if (typeof name !== "string" || !name || /[\\/]/.test(name)) {
    throw new Error("Local release transaction child name is invalid");
  }
  const candidate = path.resolve(parent, name);
  if (path.dirname(candidate) !== path.resolve(parent)) {
    throw new Error("Local release transaction child escaped its root");
  }
  if (mustExist) {
    const stat = fs.lstatSync(candidate);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("Local release transaction child is not trusted");
    }
  }
  return candidate;
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    for (;;) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      hash.update(buffer.subarray(0, count));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function treeSnapshot(directory) {
  const root = trustedDirectory(directory);
  const entries = [];
  function visit(current, relative) {
    const children = fs.readdirSync(current, { withFileTypes: true });
    for (const child of children) {
      if (child.isSymbolicLink()) {
        throw new Error("Local release runtime snapshot contains a link");
      }
      const absolute = path.join(current, child.name);
      const nextRelative = relative
        ? `${relative}/${child.name}`
        : child.name;
      if (child.isDirectory()) {
        visit(absolute, nextRelative);
      } else if (child.isFile()) {
        const stat = fs.lstatSync(absolute);
        entries.push({
          path: nextRelative.replace(/\\/g, "/"),
          size: stat.size,
          sha256: sha256File(absolute)
        });
      } else {
        throw new Error("Local release runtime snapshot contains an unsupported entry");
      }
      if (entries.length > 64) {
        throw new Error("Local release runtime snapshot contains too many files");
      }
    }
  }
  visit(root, "");
  if (entries.length < 1) {
    throw new Error("Local release runtime snapshot is empty");
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function sameSnapshot(directory, expected) {
  if (!fs.existsSync(directory)) return false;
  try {
    return JSON.stringify(treeSnapshot(directory)) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

function writeJsonAtomic(filePath, value, { replace = false } = {}) {
  const parent = trustedDirectory(path.dirname(filePath));
  const resolved = path.resolve(filePath);
  if (path.dirname(resolved) !== parent) {
    throw new Error("Local release transaction journal escaped its root");
  }
  if (!replace && fs.existsSync(resolved)) {
    throw new Error("A local release transaction is already pending");
  }
  if (replace && fs.existsSync(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error("Local release transaction journal is not trusted");
    }
  }
  const temporary = path.join(
    parent,
    `.${path.basename(resolved)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
  try {
    fs.renameSync(temporary, resolved);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function pendingPath(transactionRoot) {
  return path.join(trustedDirectory(transactionRoot, { create: true }), "pending.json");
}

function validateSnapshot(value) {
  if (
    !exactKeys(value, ["existed", "directory", "files"]) ||
    typeof value.existed !== "boolean" ||
    value.directory !== "runtime-previous" ||
    !Array.isArray(value.files) ||
    (value.existed ? value.files.length < 1 : value.files.length !== 0)
  ) {
    throw new Error("Local release runtime snapshot receipt is invalid");
  }
  let lastPath = "";
  for (const entry of value.files) {
    if (
      !exactKeys(entry, ["path", "size", "sha256"]) ||
      typeof entry.path !== "string" ||
      !entry.path ||
      entry.path.includes("\\") ||
      entry.path.startsWith("/") ||
      entry.path.split("/").some((part) => !part || part === "." || part === "..") ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 || "") ||
      entry.path.localeCompare(lastPath) <= 0
    ) {
      throw new Error("Local release runtime snapshot receipt is invalid");
    }
    lastPath = entry.path;
  }
  return {
    existed: value.existed,
    directory: value.directory,
    files: value.files.map((entry) => ({ ...entry }))
  };
}

function validateJournal(value) {
  if (
    !exactKeys(value, [
      "schemaVersion",
      "transactionId",
      "version",
      "revision",
      "phase",
      "createdAt",
      "transactionDirectory",
      "receipts",
      "receiptDigests",
      "runtimeSnapshot"
    ]) ||
    value.schemaVersion !== 1 ||
    !TRANSACTION_ID.test(value.transactionId || "") ||
    !VERSION.test(value.version || "") ||
    !REVISION.test(value.revision || "") ||
    !ALL_PHASES.has(value.phase) ||
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    new Date(value.createdAt).toISOString() !== value.createdAt ||
    value.transactionDirectory !== value.transactionId ||
    !exactKeys(value.receipts, ["delivery", "runtime", "services"]) ||
    !Object.values(value.receipts).every((name) => SAFE_FILE.test(name)) ||
    !exactKeys(value.receiptDigests, ["delivery", "runtime", "services"]) ||
    !Object.values(value.receiptDigests).every(
      (digest) => digest === null || SHA256.test(digest || "")
    )
  ) {
    throw new Error("Local release transaction journal is invalid");
  }
  if (value.phase !== "initializing" && value.runtimeSnapshot === null) {
    throw new Error("Local release transaction journal has no runtime snapshot");
  }
  const acceptedOrLater =
    FORWARD_PHASES.indexOf(value.phase) >= FORWARD_PHASES.indexOf("accepted");
  if (
    acceptedOrLater &&
    !Object.values(value.receiptDigests).every((digest) => SHA256.test(digest || ""))
  ) {
    throw new Error("Accepted local release transaction receipts are not sealed");
  }
  return {
    ...value,
    receipts: { ...value.receipts },
    receiptDigests: { ...value.receiptDigests },
    runtimeSnapshot:
      value.runtimeSnapshot === null
        ? null
        : validateSnapshot(value.runtimeSnapshot)
  };
}

function readUpgradeJournal({ transactionRoot, required = true }) {
  const root = trustedDirectory(transactionRoot, { create: true });
  const filePath = path.join(root, "pending.json");
  if (!fs.existsSync(filePath)) {
    if (required) throw new Error("No local release transaction is pending");
    return null;
  }
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Local release transaction journal is not trusted");
  }
  const journal = validateJournal(JSON.parse(fs.readFileSync(filePath, "utf8")));
  const directory = trustedChild(root, journal.transactionDirectory, {
    mustExist: true
  });
  return { journal, root, directory, filePath };
}

function beginUpgradeJournal({ transactionRoot, runtimeDirectory, version, revision }) {
  if (!VERSION.test(version || "") || !REVISION.test(revision || "")) {
    throw new Error("Local release transaction source is invalid");
  }
  const root = trustedDirectory(transactionRoot, { create: true });
  const filePath = pendingPath(root);
  if (fs.existsSync(filePath)) {
    throw new Error("A local release transaction is already pending");
  }
  const transactionId = crypto.randomBytes(16).toString("hex");
  const directory = trustedChild(root, transactionId);
  fs.mkdirSync(directory, { mode: 0o700 });
  let journal = {
    schemaVersion: 1,
    transactionId,
    version,
    revision,
    phase: "initializing",
    createdAt: new Date().toISOString(),
    transactionDirectory: transactionId,
    receipts: {
      delivery: "delivery.json",
      runtime: "runtime.json",
      services: "services.json"
    },
    receiptDigests: {
      delivery: null,
      runtime: null,
      services: null
    },
    runtimeSnapshot: null
  };
  writeJsonAtomic(filePath, journal);
  try {
    const current = path.join(path.resolve(runtimeDirectory), "current");
    const snapshotDirectory = path.join(directory, "runtime-previous");
    let runtimeSnapshot;
    if (fs.existsSync(current)) {
      const before = treeSnapshot(current);
      fs.cpSync(current, snapshotDirectory, {
        recursive: true,
        errorOnExist: true,
        force: false
      });
      const after = treeSnapshot(snapshotDirectory);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error("Local release runtime snapshot copy is inconsistent");
      }
      runtimeSnapshot = {
        existed: true,
        directory: "runtime-previous",
        files: before
      };
    } else {
      runtimeSnapshot = {
        existed: false,
        directory: "runtime-previous",
        files: []
      };
    }
    journal = { ...journal, phase: "created", runtimeSnapshot };
    writeJsonAtomic(filePath, journal, { replace: true });
    return resolveJournalPaths({ journal, root, directory, filePath });
  } catch (error) {
    // No live release mutation is permitted before begin returns.
    fs.rmSync(filePath, { force: true });
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function resolveJournalPaths(record) {
  const { journal, root, directory, filePath } = record;
  return {
    pending: true,
    ...journal,
    journalPath: filePath,
    transactionRoot: root,
    transactionPath: directory,
    receiptPaths: Object.fromEntries(
      Object.entries(journal.receipts).map(([key, name]) => [
        key,
        path.join(directory, name)
      ])
    ),
    runtimeSnapshotPath: path.join(
      directory,
      journal.runtimeSnapshot?.directory || "runtime-previous"
    )
  };
}

function upgradeJournalStatus({ transactionRoot }) {
  const record = readUpgradeJournal({ transactionRoot, required: false });
  return record
    ? resolveJournalPaths(record)
    : { pending: false, transactionRoot: path.resolve(transactionRoot) };
}

function allowedTransition(current, next) {
  if (next === "rollback-started") {
    return (
      FORWARD_PHASES.includes(current) &&
      FORWARD_PHASES.indexOf(current) < FORWARD_PHASES.indexOf("accepted")
    );
  }
  const forwardIndex = FORWARD_PHASES.indexOf(current);
  if (forwardIndex >= 0 && FORWARD_PHASES[forwardIndex + 1] === next) return true;
  const rollbackIndex = ROLLBACK_PHASES.indexOf(current);
  return rollbackIndex >= 0 && ROLLBACK_PHASES[rollbackIndex + 1] === next;
}

function advanceUpgradeJournal({ transactionRoot, phase }) {
  if (!ALL_PHASES.has(phase)) {
    throw new Error("Local release transaction phase is invalid");
  }
  const record = readUpgradeJournal({ transactionRoot });
  if (record.journal.phase === phase) {
    return resolveJournalPaths(record);
  }
  if (!allowedTransition(record.journal.phase, phase)) {
    throw new Error(
      `Local release transaction phase cannot advance from ${record.journal.phase} to ${phase}`
    );
  }
  if (
    phase === "accepted" &&
    !Object.values(record.journal.receiptDigests).every((digest) =>
      SHA256.test(digest || "")
    )
  ) {
    throw new Error("Local release transaction receipts must be sealed before acceptance");
  }
  if (phase === "accepted") {
    verifyUpgradeJournalReceipts({ transactionRoot });
  }
  const journal = { ...record.journal, phase };
  writeJsonAtomic(record.filePath, journal, { replace: true });
  return resolveJournalPaths({ ...record, journal });
}

function trustedReceiptDigest(record, key) {
  const name = record.journal.receipts[key];
  const receiptPath = trustedChild(record.directory, name);
  const stat = fs.lstatSync(receiptPath);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size < 2 ||
    stat.size > 4 * 1024 * 1024
  ) {
    throw new Error(`Local release ${key} receipt is not trusted`);
  }
  return sha256File(receiptPath);
}

function sealUpgradeJournalReceipts({ transactionRoot }) {
  const record = readUpgradeJournal({ transactionRoot });
  if (record.journal.phase !== "services-active") {
    throw new Error("Local release transaction receipts can only be sealed after service activation");
  }
  const receiptDigests = Object.fromEntries(
    Object.keys(record.journal.receipts).map((key) => [
      key,
      trustedReceiptDigest(record, key)
    ])
  );
  const journal = { ...record.journal, receiptDigests };
  writeJsonAtomic(record.filePath, journal, { replace: true });
  return resolveJournalPaths({ ...record, journal });
}

function verifyUpgradeJournalReceipts({ transactionRoot }) {
  const record = readUpgradeJournal({ transactionRoot });
  const expected = record.journal.receiptDigests;
  if (!Object.values(expected).every((digest) => SHA256.test(digest || ""))) {
    throw new Error("Local release transaction receipts are not sealed");
  }
  for (const key of Object.keys(record.journal.receipts)) {
    if (trustedReceiptDigest(record, key) !== expected[key]) {
      throw new Error(`Local release ${key} receipt differs from its sealed digest`);
    }
  }
  return { verified: true, receiptDigests: { ...expected } };
}

function restoreSnapshotInPlace({ current, previous, expected }) {
  if (!sameSnapshot(previous, expected)) {
    throw new Error("Local release runtime rollback snapshot is unavailable");
  }
  const currentRoot = trustedDirectory(current);
  for (const child of fs.readdirSync(currentRoot)) {
    fs.rmSync(path.join(currentRoot, child), {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 100
    });
  }
  for (const entry of expected) {
    const segments = entry.path.split("/");
    const source = path.join(previous, ...segments);
    const destination = path.join(currentRoot, ...segments);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
  if (!sameSnapshot(currentRoot, expected)) {
    throw new Error("Local release runtime in-place rollback could not be verified");
  }
}

function restoreRuntimeSnapshot({ transactionRoot, runtimeDirectory }) {
  const record = readUpgradeJournal({ transactionRoot });
  const snapshot = validateSnapshot(record.journal.runtimeSnapshot);
  const runtime = trustedDirectory(runtimeDirectory, { create: true });
  const current = path.join(runtime, "current");
  const previous = path.join(record.directory, snapshot.directory);
  const rejected = path.join(record.directory, "runtime-rejected");
  const candidate = path.join(record.directory, "runtime-restore-candidate");

  if (snapshot.existed && sameSnapshot(current, snapshot.files)) {
    return { restored: true, previousRuntime: true };
  }
  if (!snapshot.existed && !fs.existsSync(current)) {
    return { restored: true, previousRuntime: false };
  }
  if (snapshot.existed && !sameSnapshot(previous, snapshot.files)) {
    throw new Error("Local release runtime rollback snapshot is unavailable");
  }
  if (fs.existsSync(current)) {
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.existsSync(rejected)) {
      throw new Error("Local release runtime rollback target is not trusted");
    }
    try {
      fs.renameSync(current, rejected);
    } catch (error) {
      if (
        !snapshot.existed ||
        !["EACCES", "EBUSY", "EPERM"].includes(error?.code) ||
        !fs.existsSync(current) ||
        fs.existsSync(rejected)
      ) {
        throw error;
      }
      // Docker Desktop and antivirus scanners can retain a Windows directory
      // handle after the release-server container has stopped. Reconstructing
      // the signed snapshot in place is retryable: services stay fail-closed,
      // the immutable snapshot remains in the journal, and the exact tree is
      // verified before recovery may advance.
      restoreSnapshotInPlace({
        current,
        previous,
        expected: snapshot.files
      });
      return { restored: true, previousRuntime: true, inPlace: true };
    }
  }
  if (!snapshot.existed) {
    return { restored: true, previousRuntime: false };
  }
  if (!fs.existsSync(candidate)) {
    fs.cpSync(previous, candidate, {
      recursive: true,
      errorOnExist: true,
      force: false
    });
  }
  if (!sameSnapshot(candidate, snapshot.files)) {
    throw new Error("Local release runtime rollback candidate is invalid");
  }
  if (!fs.existsSync(current)) fs.renameSync(candidate, current);
  if (!sameSnapshot(current, snapshot.files)) {
    throw new Error("Local release runtime rollback could not be verified");
  }
  return { restored: true, previousRuntime: true };
}

function verifyRuntimeSnapshotRestored({ transactionRoot, runtimeDirectory }) {
  const record = readUpgradeJournal({ transactionRoot });
  const snapshot = validateSnapshot(record.journal.runtimeSnapshot);
  const current = path.join(path.resolve(runtimeDirectory), "current");
  const restored = snapshot.existed
    ? sameSnapshot(current, snapshot.files)
    : !fs.existsSync(current);
  if (!restored) {
    throw new Error("Local release runtime rollback does not match its journal");
  }
  return { restored: true, previousRuntime: snapshot.existed };
}

function completeUpgradeJournal({ transactionRoot }) {
  const record = readUpgradeJournal({ transactionRoot });
  if (
    !["delivery-finalized", "delivery-rolled-back", "initializing"].includes(
      record.journal.phase
    )
  ) {
    throw new Error("Local release transaction is not complete");
  }
  // Removing the single active marker first is safe: all live state is already
  // finalized or rolled back. A crash can only leave an inert orphan folder.
  fs.rmSync(record.filePath, { force: true });
  fs.rmSync(record.directory, { recursive: true, force: true });
  return { completed: true, transactionId: record.journal.transactionId };
}

module.exports = {
  FORWARD_PHASES,
  ROLLBACK_PHASES,
  advanceUpgradeJournal,
  beginUpgradeJournal,
  completeUpgradeJournal,
  readUpgradeJournal,
  restoreRuntimeSnapshot,
  sealUpgradeJournalReceipts,
  treeSnapshot,
  upgradeJournalStatus,
  validateJournal,
  verifyUpgradeJournalReceipts,
  verifyRuntimeSnapshotRestored
};
