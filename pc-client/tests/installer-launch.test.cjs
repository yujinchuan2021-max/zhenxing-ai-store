const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");

const {
  formatExitCode,
  launchProcessWithGrace
} = require("../shared/installer-launch.cjs");

test("formats Windows crash codes without a noisy decimal duplicate", () => {
  assert.equal(formatExitCode(3221225477), "0xc0000005");
  assert.equal(formatExitCode(5), "5");
});

test("reports an installer that exits with a failure code immediately", async () => {
  const result = await launchProcessWithGrace({
    command: process.execPath,
    args: ["-e", "process.exit(5)"],
    graceMs: 1_000
  });

  assert.equal(result.launched, false);
  assert.equal(result.exitCode, 5);
  assert.match(result.error, /启动后立即退出/);
});

test("accepts an installer that stays alive beyond the launch grace period", async () => {
  const result = await launchProcessWithGrace({
    command: process.execPath,
    args: ["-e", "setTimeout(() => process.exit(0), 150)"],
    graceMs: 30
  });

  assert.equal(result.launched, true);
  assert.equal(result.exitCode, null);
});

test("accepts a bootstrapper that exits cleanly during launch", async () => {
  const result = await launchProcessWithGrace({
    command: process.execPath,
    args: ["-e", "process.exit(0)"],
    graceMs: 1_000
  });

  assert.equal(result.launched, true);
  assert.equal(result.exitCode, 0);
});

test("rejects a clean bootstrapper exit when Windows reports its child crash", async () => {
  let probes = 0;
  const result = await launchProcessWithGrace({
    command: process.execPath,
    args: ["-e", "process.exit(0)"],
    graceMs: 300,
    verifyLaunch: async () => {
      probes += 1;
      return {
        ok: false,
        error: "安装程序启动后崩溃（0xc0000005）"
      };
    }
  });

  assert.equal(probes, 1);
  assert.equal(result.launched, false);
  assert.equal(result.exitCode, 0);
  assert.match(result.error, /0xc0000005/);
});

test("reports spawn through the callback before the grace result", async () => {
  const child = new EventEmitter();
  child.unref = () => {};
  const events = [];
  const isolatedEnvironment = { PATH: "C:\\Windows\\System32" };

  const result = await launchProcessWithGrace({
    command: "C:\\Trusted\\Setup.exe",
    args: ["/currentuser"],
    env: isolatedEnvironment,
    graceMs: 10,
    processLabel: "卸载程序",
    onSpawn: () => events.push("spawn-callback"),
    spawnProcess: (command, args, options) => {
      events.push("spawn-process");
      assert.equal(command, "C:\\Trusted\\Setup.exe");
      assert.deepEqual(args, ["/currentuser"]);
      assert.equal(options.env, isolatedEnvironment);
      queueMicrotask(() => {
        events.push("spawn-event");
        child.emit("spawn");
      });
      return child;
    }
  });

  events.push("grace-result");
  assert.deepEqual(events, [
    "spawn-process",
    "spawn-event",
    "spawn-callback",
    "grace-result"
  ]);
  assert.deepEqual(result, { launched: true, exitCode: null, error: "" });
});

test("calls the spawn callback once before an immediate non-zero exit", async () => {
  const child = new EventEmitter();
  child.unref = () => {};
  let spawnCallbacks = 0;

  const result = await launchProcessWithGrace({
    command: "C:\\Trusted\\Setup.exe",
    graceMs: 1_000,
    processLabel: "卸载程序",
    onSpawn: () => {
      spawnCallbacks += 1;
    },
    spawnProcess: () => {
      queueMicrotask(() => {
        child.emit("spawn");
        child.emit("exit", 5, null);
      });
      return child;
    }
  });

  assert.equal(spawnCallbacks, 1);
  assert.equal(result.launched, false);
  assert.equal(result.exitCode, 5);
  assert.match(result.error, /卸载程序启动后立即退出/);
});

test("contains a spawn callback failure without changing process evidence", async () => {
  const child = new EventEmitter();
  child.unref = () => {};

  const result = await launchProcessWithGrace({
    command: "C:\\Trusted\\Setup.exe",
    graceMs: 5,
    onSpawn: () => {
      throw new Error("verification disk full");
    },
    spawnProcess: () => {
      queueMicrotask(() => child.emit("spawn"));
      return child;
    }
  });

  assert.equal(result.launched, true);
  assert.equal(result.exitCode, null);
  assert.match(result.warning, /verification disk full/);
});

test("reports a foreground installer exit after the launch grace result", async () => {
  const child = new EventEmitter();
  child.unref = () => {};
  let observedExit = null;

  const result = await launchProcessWithGrace({
    command: "C:\\Trusted\\Setup.exe",
    graceMs: 5,
    onProcessExit: (exit) => {
      observedExit = exit;
    },
    spawnProcess: () => {
      queueMicrotask(() => child.emit("spawn"));
      setTimeout(() => child.emit("exit", 0, null), 15);
      return child;
    }
  });

  assert.equal(result.launched, true);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(observedExit, { exitCode: 0, signal: null });
});
