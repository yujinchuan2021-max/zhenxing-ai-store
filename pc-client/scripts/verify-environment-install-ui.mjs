const cdpPort = process.env.AIHUB_CDP_PORT || "9223";
const targets = await (
  await fetch(`http://127.0.0.1:${cdpPort}/json`)
).json();
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("请先用 --remote-debugging-port=9223 启动 AI Hub");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const callbacks = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) callbacks.reject(new Error(message.error.message));
  else callbacks.resolve(message.result);
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || "页面执行失败");
  }
  return result.result.value;
}

const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const productText = () =>
  evaluate(`([...document.querySelectorAll("article")]
    .find((item) => item.innerText.includes("ComfyUI Desktop"))
    ?.innerText || "")`);
const ollamaText = () =>
  evaluate(`([...document.querySelectorAll("article")]
    .find((item) => item.innerText.includes("Ollama"))
    ?.innerText || "")`);

await send("Runtime.enable");
if (process.argv.includes("--download-ollama")) {
  await evaluate(`([...document.querySelectorAll("button")]
    .find((button) => button.innerText.includes("全部厂商"))
    ?.click())`);
  await pause(300);
  await evaluate(`([...document.querySelectorAll("button")]
    .find((button) => button.innerText.includes("Ollama"))
    ?.click())`);
  await pause(300);
  await evaluate(`([...document.querySelectorAll("article")]
    .find((item) => item.innerText.includes("Ollama"))
    ?.querySelector(".detectButton")
    ?.click())`);

  let ollamaState = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await pause(500);
    ollamaState = await ollamaText();
    if (
      ollamaState.includes("下载安装包") ||
      ollamaState.includes("点击安装")
    ) {
      break;
    }
  }
  if (!ollamaState.includes("下载安装包") && !ollamaState.includes("点击安装")) {
    throw new Error(`没有进入 Ollama 安装包下载状态：${ollamaState}`);
  }

  if (ollamaState.includes("下载安装包")) {
    await evaluate(`(() => {
      const article = [...document.querySelectorAll("article")]
        .find((item) => item.innerText.includes("Ollama"));
      [...article.querySelectorAll("button")]
        .find((button) => button.innerText.includes("下载安装包"))
        ?.click();
    })()`);
    await pause(100);
    const immediate = await ollamaText();
    if (!immediate.includes("正在下载")) {
      throw new Error(`点击后没有进入 Ollama 下载进度：${immediate}`);
    }

    for (let attempt = 0; attempt < 900; attempt += 1) {
      await pause(500);
      ollamaState = await ollamaText();
      if (ollamaState.includes("点击安装")) break;
      if (ollamaState.includes("下载失败") || ollamaState.includes("重试")) {
        throw new Error(`Ollama 安装包下载失败：${ollamaState}`);
      }
    }
    if (!ollamaState.includes("点击安装")) {
      throw new Error(`七分半内没有完成 Ollama 安装包下载：${ollamaState}`);
    }
  }

  const inspection = await evaluate(
    `window.aihubPC.inspectInstaller("ollama-cli")`
  );
  if (!inspection?.ok || !inspection.signer?.includes("Ollama Inc.")) {
    throw new Error(`Ollama 安装包签名验证失败：${JSON.stringify(inspection)}`);
  }
  console.log(JSON.stringify({ completed: ollamaState, inspection }, null, 2));
  socket.close();
  process.exit(0);
}

if (process.argv.includes("--scan-python")) {
  const report = await evaluate("window.aihubPC.scanEnvironment()");
  const python = report.checks.find((check) => check.id === "python");
  if (!python?.installed || !python.location) {
    throw new Error(`Python 仍被误报为未安装：${JSON.stringify(python)}`);
  }
  console.log(JSON.stringify(python, null, 2));
  socket.close();
  process.exit(0);
}
if (process.argv.includes("--inspect-only")) {
  console.log(await evaluate("document.body.innerText"));
  socket.close();
  process.exit(0);
}
await evaluate(`([...document.querySelectorAll("button")]
  .find((button) => button.innerText.includes("Comfy Org"))
  ?.click())`);
await pause(300);
await evaluate(`([...document.querySelectorAll("article")]
  .find((item) => item.innerText.includes("ComfyUI Desktop"))
  ?.querySelector(".detectButton")
  ?.click())`);

let state = "";
if (process.argv.includes("--resume-comfy")) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await pause(250);
    state = await productText();
    if (state.includes("下载安装包")) break;
  }
  if (!state.includes("下载安装包")) {
    throw new Error(`没有进入 Comfy 下载准备状态：${state}`);
  }
  await evaluate(`(() => {
    const article = [...document.querySelectorAll("article")]
      .find((item) => item.innerText.includes("ComfyUI Desktop"));
    [...article.querySelectorAll("button")]
      .find((button) => button.innerText.includes("下载安装包"))
      ?.click();
  })()`);

  let beforePauseText = "";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await pause(50);
    beforePauseText = await productText();
    if (beforePauseText.includes("/s") && beforePauseText.includes("暂停")) {
      break;
    }
  }
  if (!beforePauseText.includes("暂停")) {
    throw new Error(`下载完成前没有出现暂停操作：${beforePauseText}`);
  }
  await evaluate(`(() => {
    const article = [...document.querySelectorAll("article")]
      .find((item) => item.innerText.includes("ComfyUI Desktop"));
    [...article.querySelectorAll("button")]
      .find((button) => button.innerText.includes("暂停"))
      ?.click();
  })()`);

  let pausedText = "";
  for (let attempt = 0; attempt < 80; attempt += 1) {
    await pause(100);
    pausedText = await productText();
    if (pausedText.includes("继续下载")) break;
  }
  const partialBeforeResume = await evaluate(
    `window.aihubPC.getPartialDownload("comfy-desktop")`
  );
  if (
    !pausedText.includes("继续下载") ||
    !partialBeforeResume?.receivedBytes
  ) {
    throw new Error(
      `暂停后没有保留断点：${pausedText} ${JSON.stringify(partialBeforeResume)}`
    );
  }

  await evaluate(`(() => {
    const article = [...document.querySelectorAll("article")]
      .find((item) => item.innerText.includes("ComfyUI Desktop"));
    [...article.querySelectorAll("button")]
      .find((button) => button.innerText.includes("继续下载"))
      ?.click();
  })()`);
  await pause(500);
  const partialAfterResume = await evaluate(
    `window.aihubPC.getPartialDownload("comfy-desktop")`
  );
  if (
    !partialAfterResume ||
    partialAfterResume.receivedBytes < partialBeforeResume.receivedBytes
  ) {
    throw new Error(
      `继续下载后断点倒退：${JSON.stringify({
        partialBeforeResume,
        partialAfterResume
      })}`
    );
  }

  for (let attempt = 0; attempt < 480; attempt += 1) {
    await pause(500);
    state = await productText();
    if (state.includes("点击安装")) break;
  }
  if (!state.includes("点击安装")) {
    throw new Error(`断点续传后没有完成下载：${state}`);
  }
  const inspection = await evaluate(
    `window.aihubPC.inspectInstaller("comfy-desktop")`
  );
  const completedRecord = await evaluate(
    `window.aihubPC.getDownloadRecord("comfy-desktop")`
  );
  if (
    !inspection?.ok ||
    !inspection.signer?.includes("Drip Artificial Inc")
  ) {
    throw new Error(`续传完成后的签名验证失败：${JSON.stringify(inspection)}`);
  }
  if (!completedRecord?.resumedFrom) {
    throw new Error(`服务器没有确认断点续传：${JSON.stringify(completedRecord)}`);
  }
  console.log(
    JSON.stringify(
      {
        beforePauseText,
        pausedText,
        partialBeforeResume,
        partialAfterResume,
        completed: state,
        completedRecord,
        inspection
      },
      null,
      2
    )
  );
  socket.close();
  process.exit(0);
}

if (process.argv.includes("--download-comfy")) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await pause(500);
    state = await productText();
    if (state.includes("下载安装包") || state.includes("点击安装")) break;
  }
  if (state.includes("前往官网下载")) {
    throw new Error(`仍在使用旧的官网跳转策略：${state}`);
  }
  if (!state.includes("下载安装包") && !state.includes("点击安装")) {
    throw new Error(`没有进入 Comfy 安装包下载状态：${state}`);
  }

  if (state.includes("下载安装包")) {
    await evaluate(`(() => {
      const article = [...document.querySelectorAll("article")]
        .find((item) => item.innerText.includes("ComfyUI Desktop"));
      [...article.querySelectorAll("button")]
        .find((button) => button.innerText.includes("下载安装包"))
        ?.click();
    })()`);
    await pause(100);
    const immediate = await productText();
    if (!immediate.includes("正在下载")) {
      throw new Error(`点击后没有进入下载进度：${immediate}`);
    }

    let progressEvidence = "";
    for (let attempt = 0; attempt < 480; attempt += 1) {
      await pause(500);
      state = await productText();
      if (
        state.includes("/s") &&
        state.includes("剩余") &&
        state.includes("下载空间：需要") &&
        state.includes("安装建议预留 15 GB")
      ) {
        progressEvidence = state;
      }
      if (state.includes("点击安装")) break;
      if (state.includes("下载失败") || state.includes("重试")) {
        throw new Error(`Comfy 安装包下载失败：${state}`);
      }
    }
    if (!state.includes("点击安装")) {
      throw new Error(`四分钟内没有完成 Comfy 安装包下载：${state}`);
    }
    if (!progressEvidence) {
      throw new Error(
        "下载过程中没有显示文件大小、速度、剩余时间和磁盘检查结果"
      );
    }
  }

  const inspection = await evaluate(
    `window.aihubPC.inspectInstaller("comfy-desktop")`
  );
  if (
    !inspection?.ok ||
    !inspection.signer?.includes("Drip Artificial Inc")
  ) {
    throw new Error(`Comfy 安装包签名验证失败：${JSON.stringify(inspection)}`);
  }
  console.log(JSON.stringify({ completed: state, inspection }, null, 2));
  socket.close();
  process.exit(0);
}

for (let attempt = 0; attempt < 40; attempt += 1) {
  await pause(500);
  state = await productText();
  if (state.includes("安装 Python")) break;
}
if (!state.includes("安装 Python")) {
  throw new Error(`没有进入缺少 Python 的状态：${state}`);
}

await evaluate(`(() => {
  const article = [...document.querySelectorAll("article")]
    .find((item) => item.innerText.includes("ComfyUI Desktop"));
  [...article.querySelectorAll("button")]
    .find((button) => button.innerText.includes("安装 Python"))
    ?.click();
})()`);
await pause(80);
const immediate = await productText();
if (
  !immediate.includes("正在检测官方下载源") &&
  !immediate.includes("正在下载 Python")
) {
  throw new Error(`点击后没有可见反馈：${immediate}`);
}

for (let attempt = 0; attempt < 360; attempt += 1) {
  await pause(500);
  state = await productText();
  if (state.includes("打开安装包")) break;
  if (state.includes("没有可用") || state.includes("无法下载")) {
    throw new Error(`下载失败：${state}`);
  }
  if (
    attempt > 2 &&
    state.includes("安装 Python") &&
    !state.includes("正在下载") &&
    !state.includes("正在检测")
  ) {
    throw new Error(`下载返回可重试状态：${state}`);
  }
}
if (!state.includes("打开安装包")) {
  throw new Error(`三分钟内没有完成下载：${state}`);
}

console.log(JSON.stringify({ immediate, completed: state }, null, 2));
socket.close();
