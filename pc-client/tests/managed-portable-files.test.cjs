"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  cleanupInterruptedPortableFiles,
  replaceManagedPortableDirectory,
  replaceManagedPortableFiles,
  uninstallManagedPortableDirectory,
  uninstallManagedPortableFiles
} = require("../shared/managed-portable-files.cjs");

const EXECUTABLE = "StabilityMatrix.exe";
const MARKER = ".zhenxingai-managed.json";

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "zhenxing-portable-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function write(filePath, contents) {
  fs.writeFileSync(filePath, contents, { flag: "wx" });
}

function transactionOptions(directory, overrides = {}) {
  return {
    directory,
    executableFileName: EXECUTABLE,
    markerContents: "new-marker",
    stageExecutable: (filePath) => write(filePath, "new-executable"),
    writeReceipt: () => {},
    restoreReceipt: () => {},
    fileSystem: fs,
    randomId: () => "fixed-id",
    ...overrides
  };
}

test("interrupted fresh install cleanup removes only orphan pending files", (t) => {
  const directory = temporaryDirectory(t);
  const dataDirectory = path.join(directory, "Data");
  const pendingExecutable = path.join(
    directory,
    `.${EXECUTABLE}.pending-interrupted-id`
  );
  const pendingMarker = path.join(
    directory,
    `.${MARKER}.pending-interrupted-id`
  );
  const lookalikePending = path.join(
    directory,
    ".Other.exe.pending-interrupted-id"
  );
  const unrelatedFile = path.join(directory, "keep.txt");
  fs.mkdirSync(dataDirectory);
  write(path.join(dataDirectory, "model.bin"), "user-data");
  write(pendingExecutable, "verified-but-uncommitted");
  write(pendingMarker, "uncommitted-marker");
  write(lookalikePending, "not-this-product");
  write(unrelatedFile, "unrelated");

  cleanupInterruptedPortableFiles({
    directory,
    executableFileName: EXECUTABLE,
    markerFileName: MARKER,
    fileSystem: fs
  });

  assert.equal(fs.existsSync(pendingExecutable), false);
  assert.equal(fs.existsSync(pendingMarker), false);
  assert.equal(fs.readFileSync(path.join(dataDirectory, "model.bin"), "utf8"), "user-data");
  assert.equal(fs.readFileSync(lookalikePending, "utf8"), "not-this-product");
  assert.equal(fs.readFileSync(unrelatedFile, "utf8"), "unrelated");
});

test("fresh install atomically publishes the exact executable and marker", async (t) => {
  const directory = temporaryDirectory(t);
  let receipt = null;

  const result = await replaceManagedPortableFiles(
    transactionOptions(directory, {
      validateStagedExecutable: (filePath) =>
        assert.equal(fs.readFileSync(filePath, "utf8"), "new-executable"),
      writeReceipt: () => {
        receipt = "new-receipt";
      },
      restoreReceipt: () => {
        receipt = null;
      }
    })
  );

  assert.equal(fs.readFileSync(result.executable, "utf8"), "new-executable");
  assert.equal(fs.readFileSync(result.marker, "utf8"), "new-marker");
  assert.equal(receipt, "new-receipt");
  assert.deepEqual(fs.readdirSync(directory).sort(), [EXECUTABLE, MARKER].sort());
});

test("marker contents can be derived from the verified staged executable", async (t) => {
  const directory = temporaryDirectory(t);
  await replaceManagedPortableFiles(
    transactionOptions(directory, {
      markerContents: (stagedExecutable) =>
        `verified:${fs.readFileSync(stagedExecutable, "utf8")}`
    })
  );
  assert.equal(
    fs.readFileSync(path.join(directory, MARKER), "utf8"),
    "verified:new-executable"
  );
});

test("reinstall replaces only managed files and preserves Data", async (t) => {
  const directory = temporaryDirectory(t);
  const dataDirectory = path.join(directory, "Data");
  fs.mkdirSync(dataDirectory);
  write(path.join(dataDirectory, "model.bin"), "user-data");
  write(path.join(directory, EXECUTABLE), "old-executable");
  write(path.join(directory, MARKER), "old-marker");

  await replaceManagedPortableFiles(
    transactionOptions(directory, { priorManaged: true })
  );

  assert.equal(
    fs.readFileSync(path.join(directory, EXECUTABLE), "utf8"),
    "new-executable"
  );
  assert.equal(fs.readFileSync(path.join(directory, MARKER), "utf8"), "new-marker");
  assert.equal(
    fs.readFileSync(path.join(dataDirectory, "model.bin"), "utf8"),
    "user-data"
  );
});

test("receipt write failure restores the previous files and receipt", async (t) => {
  const directory = temporaryDirectory(t);
  write(path.join(directory, EXECUTABLE), "old-executable");
  write(path.join(directory, MARKER), "old-marker");
  let receipt = "old-receipt";

  await assert.rejects(
    replaceManagedPortableFiles(
      transactionOptions(directory, {
        priorManaged: true,
        writeReceipt: () => {
          receipt = "partial-new-receipt";
          throw new Error("receipt unavailable");
        },
        restoreReceipt: () => {
          receipt = "old-receipt";
        }
      })
    ),
    /receipt unavailable/
  );

  assert.equal(
    fs.readFileSync(path.join(directory, EXECUTABLE), "utf8"),
    "old-executable"
  );
  assert.equal(fs.readFileSync(path.join(directory, MARKER), "utf8"), "old-marker");
  assert.equal(receipt, "old-receipt");
  assert.deepEqual(fs.readdirSync(directory).sort(), [EXECUTABLE, MARKER].sort());
});

test("a rollback failure is explicit", async (t) => {
  const directory = temporaryDirectory(t);

  await assert.rejects(
    replaceManagedPortableFiles(
      transactionOptions(directory, {
        writeReceipt: () => {
          throw new Error("receipt unavailable");
        },
        restoreReceipt: () => {
          throw new Error("receipt rollback unavailable");
        }
      })
    ),
    (error) =>
      error instanceof AggregateError &&
      error.code === "PORTABLE_FILE_ROLLBACK_FAILED" &&
      /receipt unavailable/.test(error.message)
  );
});

test("uninstall deletes only the exact executable and marker", async (t) => {
  const directory = temporaryDirectory(t);
  const dataDirectory = path.join(directory, "Data");
  fs.mkdirSync(dataDirectory);
  write(path.join(dataDirectory, "model.bin"), "user-data");
  write(path.join(directory, "keep.txt"), "unrelated");
  write(path.join(directory, EXECUTABLE), "managed-executable");
  write(path.join(directory, MARKER), "managed-marker");
  let receipt = "managed-receipt";
  const fileSystem = Object.create(fs);
  fileSystem.rmSync = () => {
    throw new Error("transaction must never recursively remove a directory");
  };

  await uninstallManagedPortableFiles({
    directory,
    executableFileName: EXECUTABLE,
    removeReceipt: () => {
      receipt = null;
    },
    restoreReceipt: () => {
      receipt = "managed-receipt";
    },
    fileSystem,
    randomId: () => "fixed-id"
  });

  assert.equal(fs.existsSync(path.join(directory, EXECUTABLE)), false);
  assert.equal(fs.existsSync(path.join(directory, MARKER)), false);
  assert.equal(fs.readFileSync(path.join(directory, "keep.txt"), "utf8"), "unrelated");
  assert.equal(
    fs.readFileSync(path.join(dataDirectory, "model.bin"), "utf8"),
    "user-data"
  );
  assert.equal(receipt, null);
});

function portableDirectoryLayout(t) {
  const productRoot = temporaryDirectory(t);
  const runtimeRoot = path.join(productRoot, "runtime");
  const dataDirectory = path.join(productRoot, "Data");
  fs.mkdirSync(runtimeRoot);
  fs.mkdirSync(dataDirectory);
  write(path.join(dataDirectory, "user.db"), "user-data");
  write(path.join(runtimeRoot, "keep-runtime.txt"), "sibling");
  return { productRoot, runtimeRoot, dataDirectory };
}

function stageGoose(directory, version = "new") {
  fs.mkdirSync(path.join(directory, "resources"));
  write(path.join(directory, "Goose.exe"), `${version}-executable`);
  write(path.join(directory, "resources", "app.bin"), `${version}-resource`);
}

function directoryTransactionOptions(runtimeRoot, overrides = {}) {
  return {
    runtimeRoot,
    stageDirectory: (directory) => stageGoose(directory),
    writeReceipt: () => {},
    restoreReceipt: () => {},
    fileSystem: fs,
    randomId: () => "fixed-directory-id",
    ...overrides
  };
}

test("directory fresh install publishes only runtime/app", async (t) => {
  const { runtimeRoot, dataDirectory } = portableDirectoryLayout(t);
  let receipt = null;

  const result = await replaceManagedPortableDirectory(
    directoryTransactionOptions(runtimeRoot, {
      validateStagedDirectory: (directory) =>
        assert.equal(
          fs.readFileSync(path.join(directory, "Goose.exe"), "utf8"),
          "new-executable"
        ),
      writeReceipt: () => {
        receipt = "new-receipt";
      },
      restoreReceipt: () => {
        receipt = null;
      }
    })
  );

  assert.equal(result.directory, path.join(runtimeRoot, "app"));
  assert.equal(
    fs.readFileSync(path.join(result.directory, "resources", "app.bin"), "utf8"),
    "new-resource"
  );
  assert.equal(fs.readFileSync(path.join(dataDirectory, "user.db"), "utf8"), "user-data");
  assert.equal(fs.readFileSync(path.join(runtimeRoot, "keep-runtime.txt"), "utf8"), "sibling");
  assert.equal(receipt, "new-receipt");
});

test("directory update replaces app and preserves sibling and parent Data", async (t) => {
  const { runtimeRoot, dataDirectory } = portableDirectoryLayout(t);
  const appDirectory = path.join(runtimeRoot, "app");
  fs.mkdirSync(appDirectory);
  stageGoose(appDirectory, "old");
  write(path.join(appDirectory, "old-only.txt"), "remove-with-old-app");

  await replaceManagedPortableDirectory(
    directoryTransactionOptions(runtimeRoot, { priorManaged: true })
  );

  assert.equal(
    fs.readFileSync(path.join(appDirectory, "Goose.exe"), "utf8"),
    "new-executable"
  );
  assert.equal(fs.existsSync(path.join(appDirectory, "old-only.txt")), false);
  assert.equal(fs.readFileSync(path.join(dataDirectory, "user.db"), "utf8"), "user-data");
  assert.equal(fs.readFileSync(path.join(runtimeRoot, "keep-runtime.txt"), "utf8"), "sibling");
});

test("directory receipt failure restores the complete previous app", async (t) => {
  const { runtimeRoot, dataDirectory } = portableDirectoryLayout(t);
  const appDirectory = path.join(runtimeRoot, "app");
  fs.mkdirSync(appDirectory);
  stageGoose(appDirectory, "old");
  let receipt = "old-receipt";

  await assert.rejects(
    replaceManagedPortableDirectory(
      directoryTransactionOptions(runtimeRoot, {
        priorManaged: true,
        writeReceipt: () => {
          receipt = "partial-new-receipt";
          throw new Error("directory receipt unavailable");
        },
        restoreReceipt: () => {
          receipt = "old-receipt";
        }
      })
    ),
    /directory receipt unavailable/
  );

  assert.equal(
    fs.readFileSync(path.join(appDirectory, "Goose.exe"), "utf8"),
    "old-executable"
  );
  assert.equal(
    fs.readFileSync(path.join(appDirectory, "resources", "app.bin"), "utf8"),
    "old-resource"
  );
  assert.equal(receipt, "old-receipt");
  assert.equal(fs.readFileSync(path.join(dataDirectory, "user.db"), "utf8"), "user-data");
  assert.deepEqual(
    fs.readdirSync(runtimeRoot).sort(),
    ["app", "keep-runtime.txt"].sort()
  );
});

test("directory uninstall removes only runtime/app", async (t) => {
  const { runtimeRoot, dataDirectory } = portableDirectoryLayout(t);
  const appDirectory = path.join(runtimeRoot, "app");
  fs.mkdirSync(appDirectory);
  stageGoose(appDirectory, "managed");
  let receipt = "managed-receipt";
  const fileSystem = Object.create(fs);
  fileSystem.rmSync = () => {
    throw new Error("directory transaction must not call recursive rm");
  };

  await uninstallManagedPortableDirectory({
    runtimeRoot,
    removeReceipt: () => {
      receipt = null;
    },
    restoreReceipt: () => {
      receipt = "managed-receipt";
    },
    fileSystem,
    randomId: () => "fixed-directory-id"
  });

  assert.equal(fs.existsSync(appDirectory), false);
  assert.equal(fs.readFileSync(path.join(dataDirectory, "user.db"), "utf8"), "user-data");
  assert.equal(fs.readFileSync(path.join(runtimeRoot, "keep-runtime.txt"), "utf8"), "sibling");
  assert.equal(receipt, null);
});

test("directory recursion rejects a link before uninstall", async (t) => {
  const { runtimeRoot, dataDirectory } = portableDirectoryLayout(t);
  const appDirectory = path.join(runtimeRoot, "app");
  const linked = path.join(appDirectory, "linked-data");
  fs.mkdirSync(appDirectory);
  write(linked, "pretend-reparse-point");
  const fileSystem = Object.create(fs);
  fileSystem.lstatSync = (candidate) =>
    path.resolve(candidate).toLowerCase() === path.resolve(linked).toLowerCase()
      ? {
          isDirectory: () => false,
          isFile: () => false,
          isSymbolicLink: () => true
        }
      : fs.lstatSync(candidate);

  await assert.rejects(
    uninstallManagedPortableDirectory({
      runtimeRoot,
      removeReceipt: () => {},
      restoreReceipt: () => {},
      fileSystem,
      randomId: () => "fixed-directory-id"
    }),
    /链接或重解析点/
  );
  assert.equal(fs.existsSync(appDirectory), true);
  assert.equal(fs.readFileSync(path.join(dataDirectory, "user.db"), "utf8"), "user-data");
});
