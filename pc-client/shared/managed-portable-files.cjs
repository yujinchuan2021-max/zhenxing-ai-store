"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MARKER = ".zhenxingai-managed.json";

function exactFilePath(directory, fileName) {
  if (
    typeof directory !== "string" ||
    !path.isAbsolute(directory) ||
    typeof fileName !== "string" ||
    !fileName ||
    path.basename(fileName) !== fileName ||
    [".", ".."].includes(fileName)
  ) {
    throw new TypeError("便携程序文件路径无效");
  }
  return path.join(path.resolve(directory), fileName);
}

function transactionId(randomId) {
  const value = String(randomId());
  if (!/^[A-Za-z0-9-]{1,64}$/.test(value)) {
    throw new TypeError("便携程序事务标识无效");
  }
  return value;
}

function assertDirectory(fileSystem, directory) {
  const resolved = path.resolve(directory);
  const stat = fileSystem.lstatSync(resolved);
  const realpath = fileSystem.realpathSync.native(resolved);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    path.resolve(realpath).toLowerCase() !== resolved.toLowerCase()
  ) {
    throw new Error("便携程序目录不可信");
  }
  return resolved;
}

function assertRegularFile(fileSystem, filePath) {
  const stat = fileSystem.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`便携程序受管文件不可信：${path.basename(filePath)}`);
  }
}

function assertAvailable(fileSystem, filePaths) {
  if (filePaths.some((filePath) => fileSystem.existsSync(filePath))) {
    throw new Error("便携程序事务临时文件已存在");
  }
}

function removeExactFile(fileSystem, filePath) {
  if (!fileSystem.existsSync(filePath)) return;
  const stat = fileSystem.lstatSync(filePath);
  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    throw new Error(`拒绝删除非文件目标：${path.basename(filePath)}`);
  }
  fileSystem.unlinkSync(filePath);
}

function cleanupInterruptedPortableFiles({
  directory,
  executableFileName,
  markerFileName = DEFAULT_MARKER,
  fileSystem = fs
}) {
  const root = assertDirectory(fileSystem, directory);
  const prefixes = [
    `.${executableFileName}.pending-`,
    `.${markerFileName}.pending-`
  ];
  const cleaned = [];
  for (const name of fileSystem.readdirSync(root)) {
    const prefix = prefixes.find((candidate) => name.startsWith(candidate));
    if (!prefix || !/^[A-Za-z0-9-]{1,64}$/.test(name.slice(prefix.length))) {
      continue;
    }
    const candidate = exactFilePath(root, name);
    removeExactFile(fileSystem, candidate);
    cleaned.push(candidate);
  }
  return cleaned;
}

function assertDirectChild(directory, parent) {
  const resolvedParent = path.resolve(parent);
  const resolvedDirectory = path.resolve(directory);
  if (
    path.dirname(resolvedDirectory).toLowerCase() !==
    resolvedParent.toLowerCase()
  ) {
    throw new Error("便携程序目录事务越过运行目录");
  }
  return resolvedDirectory;
}

function assertTrustedDirectoryTree(fileSystem, directory, runtimeRoot) {
  const root = assertDirectory(fileSystem, runtimeRoot);
  const target = assertDirectChild(directory, root);
  const visit = (entryPath) => {
    const stat = fileSystem.lstatSync(entryPath);
    const canonical = fileSystem.realpathSync.native(entryPath);
    if (
      stat.isSymbolicLink() ||
      path.resolve(canonical).toLowerCase() !==
        path.resolve(entryPath).toLowerCase()
    ) {
      throw new Error("便携程序目录包含链接或重解析点");
    }
    if (stat.isDirectory()) {
      for (const name of fileSystem.readdirSync(entryPath)) {
        visit(path.join(entryPath, name));
      }
      return;
    }
    if (!stat.isFile()) {
      throw new Error("便携程序目录包含不受支持的文件类型");
    }
  };
  visit(target);
  return target;
}

function removeExactManagedDirectory(fileSystem, directory, runtimeRoot) {
  const target = assertTrustedDirectoryTree(
    fileSystem,
    directory,
    runtimeRoot
  );
  const remove = (entryPath) => {
    const stat = fileSystem.lstatSync(entryPath);
    if (stat.isDirectory()) {
      for (const name of fileSystem.readdirSync(entryPath)) {
        remove(path.join(entryPath, name));
      }
      fileSystem.rmdirSync(entryPath);
      return;
    }
    fileSystem.unlinkSync(entryPath);
  };
  remove(target);
}

async function rollbackOrThrow(original, actions) {
  const failures = [];
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) {
    const failure = new AggregateError(
      failures,
      `便携程序事务回滚失败：${
        original instanceof Error ? original.message : "未知错误"
      }`,
      { cause: original }
    );
    failure.code = "PORTABLE_FILE_ROLLBACK_FAILED";
    throw failure;
  }
  throw original;
}

function committedCleanupError(failures) {
  const error = new AggregateError(
    failures,
    "便携程序事务已提交，但临时备份清理失败"
  );
  error.code = "PORTABLE_FILE_COMMITTED_CLEANUP_FAILED";
  error.committed = true;
  return error;
}

async function replaceManagedPortableFiles({
  directory,
  executableFileName,
  markerFileName = DEFAULT_MARKER,
  markerContents,
  priorManaged = false,
  stageExecutable,
  validateStagedExecutable = async () => {},
  writeReceipt,
  restoreReceipt,
  fileSystem = fs,
  randomId = crypto.randomUUID
}) {
  if (
    !["string", "function"].includes(typeof markerContents) ||
    (typeof markerContents === "string" &&
      Buffer.byteLength(markerContents, "utf8") > 64 * 1024) ||
    typeof priorManaged !== "boolean" ||
    typeof stageExecutable !== "function" ||
    typeof validateStagedExecutable !== "function" ||
    typeof writeReceipt !== "function" ||
    typeof restoreReceipt !== "function" ||
    typeof randomId !== "function"
  ) {
    throw new TypeError("便携程序安装事务参数无效");
  }

  const root = assertDirectory(fileSystem, directory);
  const executable = exactFilePath(root, executableFileName);
  const marker = exactFilePath(root, markerFileName);
  const id = transactionId(randomId);
  const stagedExecutable = exactFilePath(
    root,
    `.${executableFileName}.pending-${id}`
  );
  const stagedMarker = exactFilePath(root, `.${markerFileName}.pending-${id}`);
  const previousExecutable = exactFilePath(
    root,
    `.${executableFileName}.previous-${id}`
  );
  const previousMarker = exactFilePath(
    root,
    `.${markerFileName}.previous-${id}`
  );
  assertAvailable(fileSystem, [
    stagedExecutable,
    stagedMarker,
    previousExecutable,
    previousMarker
  ]);

  if (priorManaged) {
    assertRegularFile(fileSystem, executable);
    assertRegularFile(fileSystem, marker);
  } else if (fileSystem.existsSync(executable) || fileSystem.existsSync(marker)) {
    throw new Error("目标位置已有非本次事务管理的程序文件");
  }

  let executableBackedUp = false;
  let markerBackedUp = false;
  let executableInstalled = false;
  let markerInstalled = false;
  let receiptAttempted = false;

  try {
    await stageExecutable(stagedExecutable);
    assertRegularFile(fileSystem, stagedExecutable);
    await validateStagedExecutable(stagedExecutable);
    const resolvedMarkerContents =
      typeof markerContents === "function"
        ? await markerContents(stagedExecutable)
        : markerContents;
    if (
      typeof resolvedMarkerContents !== "string" ||
      Buffer.byteLength(resolvedMarkerContents, "utf8") > 64 * 1024
    ) {
      throw new TypeError("便携程序管理标记无效");
    }
    fileSystem.writeFileSync(stagedMarker, resolvedMarkerContents, {
      encoding: "utf8",
      flag: "wx"
    });
    assertRegularFile(fileSystem, stagedMarker);

    if (priorManaged) {
      fileSystem.renameSync(executable, previousExecutable);
      executableBackedUp = true;
      fileSystem.renameSync(marker, previousMarker);
      markerBackedUp = true;
    }
    fileSystem.renameSync(stagedExecutable, executable);
    executableInstalled = true;
    fileSystem.renameSync(stagedMarker, marker);
    markerInstalled = true;

    receiptAttempted = true;
    await writeReceipt();
  } catch (error) {
    await rollbackOrThrow(error, [
      async () => {
        if (markerInstalled) removeExactFile(fileSystem, marker);
        else removeExactFile(fileSystem, stagedMarker);
      },
      async () => {
        if (executableInstalled) removeExactFile(fileSystem, executable);
        else removeExactFile(fileSystem, stagedExecutable);
      },
      async () => {
        if (executableBackedUp && fileSystem.existsSync(previousExecutable)) {
          fileSystem.renameSync(previousExecutable, executable);
        }
      },
      async () => {
        if (markerBackedUp && fileSystem.existsSync(previousMarker)) {
          fileSystem.renameSync(previousMarker, marker);
        }
      },
      async () => {
        if (receiptAttempted) await restoreReceipt();
      }
    ]);
  }

  const cleanupFailures = [];
  for (const filePath of [previousExecutable, previousMarker]) {
    try {
      removeExactFile(fileSystem, filePath);
    } catch (error) {
      cleanupFailures.push(error);
    }
  }
  if (cleanupFailures.length) throw committedCleanupError(cleanupFailures);
  return { executable, marker };
}

async function uninstallManagedPortableFiles({
  directory,
  executableFileName,
  markerFileName = DEFAULT_MARKER,
  removeReceipt,
  restoreReceipt,
  fileSystem = fs,
  randomId = crypto.randomUUID
}) {
  if (
    typeof removeReceipt !== "function" ||
    typeof restoreReceipt !== "function" ||
    typeof randomId !== "function"
  ) {
    throw new TypeError("便携程序卸载事务参数无效");
  }
  const root = assertDirectory(fileSystem, directory);
  const executable = exactFilePath(root, executableFileName);
  const marker = exactFilePath(root, markerFileName);
  assertRegularFile(fileSystem, executable);
  assertRegularFile(fileSystem, marker);

  const id = transactionId(randomId);
  const removedExecutable = exactFilePath(
    root,
    `.${executableFileName}.removed-${id}`
  );
  const removedMarker = exactFilePath(root, `.${markerFileName}.removed-${id}`);
  assertAvailable(fileSystem, [removedExecutable, removedMarker]);

  let executableMoved = false;
  let markerMoved = false;
  let receiptAttempted = false;
  try {
    fileSystem.renameSync(executable, removedExecutable);
    executableMoved = true;
    fileSystem.renameSync(marker, removedMarker);
    markerMoved = true;
    receiptAttempted = true;
    await removeReceipt();
  } catch (error) {
    await rollbackOrThrow(error, [
      async () => {
        if (executableMoved && fileSystem.existsSync(removedExecutable)) {
          fileSystem.renameSync(removedExecutable, executable);
        }
      },
      async () => {
        if (markerMoved && fileSystem.existsSync(removedMarker)) {
          fileSystem.renameSync(removedMarker, marker);
        }
      },
      async () => {
        if (receiptAttempted) await restoreReceipt();
      }
    ]);
  }

  const cleanupFailures = [];
  for (const filePath of [removedExecutable, removedMarker]) {
    try {
      removeExactFile(fileSystem, filePath);
    } catch (error) {
      cleanupFailures.push(error);
    }
  }
  if (cleanupFailures.length) throw committedCleanupError(cleanupFailures);
  return { executable, marker };
}

async function replaceManagedPortableDirectory({
  runtimeRoot,
  priorManaged = false,
  stageDirectory,
  validateStagedDirectory = async () => {},
  writeReceipt,
  restoreReceipt,
  fileSystem = fs,
  randomId = crypto.randomUUID
}) {
  if (
    typeof priorManaged !== "boolean" ||
    typeof stageDirectory !== "function" ||
    typeof validateStagedDirectory !== "function" ||
    typeof writeReceipt !== "function" ||
    typeof restoreReceipt !== "function" ||
    typeof randomId !== "function"
  ) {
    throw new TypeError("便携程序目录安装事务参数无效");
  }

  const root = assertDirectory(fileSystem, runtimeRoot);
  const directory = assertDirectChild(path.join(root, "app"), root);
  const id = transactionId(randomId);
  const staging = assertDirectChild(path.join(root, `.app.pending-${id}`), root);
  const previous = assertDirectChild(
    path.join(root, `.app.previous-${id}`),
    root
  );
  assertAvailable(fileSystem, [staging, previous]);

  if (priorManaged) {
    assertTrustedDirectoryTree(fileSystem, directory, root);
  } else if (fileSystem.existsSync(directory)) {
    throw new Error("目标位置已有非本次事务管理的程序目录");
  }

  let previousMoved = false;
  let directoryInstalled = false;
  let receiptAttempted = false;
  try {
    fileSystem.mkdirSync(staging, { recursive: false });
    await stageDirectory(staging);
    assertTrustedDirectoryTree(fileSystem, staging, root);
    await validateStagedDirectory(staging);

    if (priorManaged) {
      fileSystem.renameSync(directory, previous);
      previousMoved = true;
    }
    fileSystem.renameSync(staging, directory);
    directoryInstalled = true;
    receiptAttempted = true;
    await writeReceipt();
  } catch (error) {
    await rollbackOrThrow(error, [
      async () => {
        if (directoryInstalled && fileSystem.existsSync(directory)) {
          removeExactManagedDirectory(fileSystem, directory, root);
        } else if (fileSystem.existsSync(staging)) {
          removeExactManagedDirectory(fileSystem, staging, root);
        }
      },
      async () => {
        if (previousMoved && fileSystem.existsSync(previous)) {
          fileSystem.renameSync(previous, directory);
        }
      },
      async () => {
        if (receiptAttempted) await restoreReceipt();
      }
    ]);
  }

  const cleanupFailures = [];
  try {
    if (fileSystem.existsSync(previous)) {
      removeExactManagedDirectory(fileSystem, previous, root);
    }
  } catch (error) {
    cleanupFailures.push(error);
  }
  if (cleanupFailures.length) throw committedCleanupError(cleanupFailures);
  return { directory };
}

async function uninstallManagedPortableDirectory({
  runtimeRoot,
  removeReceipt,
  restoreReceipt,
  fileSystem = fs,
  randomId = crypto.randomUUID
}) {
  if (
    typeof removeReceipt !== "function" ||
    typeof restoreReceipt !== "function" ||
    typeof randomId !== "function"
  ) {
    throw new TypeError("便携程序目录卸载事务参数无效");
  }
  const root = assertDirectory(fileSystem, runtimeRoot);
  const directory = assertDirectChild(path.join(root, "app"), root);
  assertTrustedDirectoryTree(fileSystem, directory, root);
  const removed = assertDirectChild(
    path.join(root, `.app.removed-${transactionId(randomId)}`),
    root
  );
  assertAvailable(fileSystem, [removed]);

  let directoryMoved = false;
  let receiptAttempted = false;
  try {
    fileSystem.renameSync(directory, removed);
    directoryMoved = true;
    receiptAttempted = true;
    await removeReceipt();
  } catch (error) {
    await rollbackOrThrow(error, [
      async () => {
        if (directoryMoved && fileSystem.existsSync(removed)) {
          fileSystem.renameSync(removed, directory);
        }
      },
      async () => {
        if (receiptAttempted) await restoreReceipt();
      }
    ]);
  }

  const cleanupFailures = [];
  try {
    removeExactManagedDirectory(fileSystem, removed, root);
  } catch (error) {
    cleanupFailures.push(error);
  }
  if (cleanupFailures.length) throw committedCleanupError(cleanupFailures);
  return { directory };
}

module.exports = {
  cleanupInterruptedPortableFiles,
  replaceManagedPortableDirectory,
  replaceManagedPortableFiles,
  uninstallManagedPortableDirectory,
  uninstallManagedPortableFiles
};
