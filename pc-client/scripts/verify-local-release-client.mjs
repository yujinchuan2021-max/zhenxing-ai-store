import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "deployment",
      "local",
      "runtime",
      "current",
      "public",
      "release-manifest.json"
    ),
    "utf8"
  )
);
const cdpPort = process.env.AIHUB_CDP_PORT || "9225";
const deadline = Date.now() + 20_000;
let target;
while (Date.now() < deadline) {
  try {
    const targets = await (
      await fetch(`http://127.0.0.1:${cdpPort}/json`)
    ).json();
    target = targets.find((item) => item.type === "page");
    if (target) break;
  } catch {
    // The packaged client is still starting.
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!target) throw new Error("本地发布验收客户端没有开放 CDP 页面");

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
    throw new Error(
      result.exceptionDetails.exception?.description || "客户端页面执行失败"
    );
  }
  return result.result.value;
}

await send("Runtime.enable");
for (let attempt = 0; attempt < 80; attempt += 1) {
  if (await evaluate("Boolean(window.aihubPC && document.body.innerText)")) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const catalog = await evaluate("window.aihubPC.getCatalog()");
if (
  catalog?.source !== "remote" ||
  catalog.catalogVersion !== manifest.catalog.catalogVersion ||
  !Array.isArray(catalog.catalog?.vendors)
) {
  throw new Error(`客户端没有接受远程签名目录：${JSON.stringify(catalog)}`);
}

const update = await evaluate("window.aihubPC.checkForUpdate()");
if (
  update?.status !== "available" ||
  update.version !== manifest.update.version ||
  update.fileSize !== manifest.update.fileSize ||
  update.sha256 !== manifest.update.sha256
) {
  throw new Error(`客户端没有接受签名更新：${JSON.stringify(update)}`);
}

const bodyText = await evaluate("document.body.innerText");
if (!bodyText.includes("AI")) {
  throw new Error("客户端主界面没有完成渲染");
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      page: target.url,
      catalog: {
        source: catalog.source,
        catalogVersion: catalog.catalogVersion,
        vendors: catalog.catalog.vendors.length
      },
      update
    },
    null,
    2
  )}\n`
);
socket.close();
