const assert = require("node:assert/strict");
const test = require("node:test");

const {
  runEnvironmentInstall
} = require("../shared/environment-install-flow.cjs");

test("an environment install click reports source scanning immediately", async () => {
  let finishDownload;
  const states = [];
  const client = {
    installEnvironment: () =>
      new Promise((resolve) => {
        finishDownload = resolve;
      })
  };

  const pending = runEnvironmentInstall({
    environmentId: "python",
    client,
    onState: (state) => states.push(state)
  });

  assert.deepEqual(states, [
    {
      stage: "probing",
      message: "正在检测官方下载源…"
    }
  ]);

  finishDownload({
    downloaded: true,
    message: "Python 安装包下载完成"
  });
  await pending;

  assert.deepEqual(states[1], {
    stage: "ready",
    message: "Python 安装包下载完成"
  });
});

test("an environment install IPC failure becomes a visible retryable error", async () => {
  const states = [];

  await runEnvironmentInstall({
    environmentId: "python",
    client: {
      installEnvironment: async () => {
        throw new Error("IPC 已断开");
      }
    },
    onState: (state) => states.push(state)
  });

  assert.deepEqual(states.at(-1), {
    stage: "idle",
    message: "IPC 已断开"
  });
});

test("an environment managed task keeps the UI in a resumable state", async () => {
  const states = [];

  await runEnvironmentInstall({
    environmentId: "python",
    client: {
      installEnvironment: async () => ({
        downloaded: false,
        task: {
          phase: "paused"
        },
        message: "Python 下载已暂停"
      })
    },
    onState: (state) => states.push(state)
  });

  assert.deepEqual(states.at(-1), {
    stage: "paused",
    message: "Python 下载已暂停"
  });
});

test("a started environment managed task remains downloading", async () => {
  const states = [];

  await runEnvironmentInstall({
    environmentId: "node",
    client: {
      installEnvironment: async () => ({
        downloaded: false,
        task: {
          phase: "starting"
        },
        message: "正在下载 Node.js"
      })
    },
    onState: (state) => states.push(state)
  });

  assert.deepEqual(states.at(-1), {
    stage: "downloading",
    message: "正在下载 Node.js"
  });
});
