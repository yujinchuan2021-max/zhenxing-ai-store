import assert from "node:assert/strict";

const debuggerOrigin =
  process.env.AIHUB_ELECTRON_DEBUG_ORIGIN || "http://127.0.0.1:9230";
const mailOrigin = "http://127.0.0.1:8025";
const communityOrigin = "http://127.0.0.1:8088";
const suffix = Date.now().toString(36);
const email = `desktop-${suffix}@aihub.local`;
let username = `desktop_${suffix}`;
const nickname = `桌面验收${suffix.slice(-4)}`;
const password = `AIHub-${suffix}-Secure9`;

const targets = await (await fetch(`${debuggerOrigin}/json/list`)).json();
const target = targets.find(
  (item) => item.type === "page" && item.title === "AI Hub PC"
);
assert.ok(target?.webSocketDebuggerUrl, "没有找到 AI Hub Electron 渲染页");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "页面脚本执行失败"
    );
  }
  return result.result.value;
}

async function waitFor(expression, message, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(message);
}

await command("Runtime.enable");

const catalog = await evaluate("window.aihubPC.getCatalog()");
assert.equal(catalog.catalog.vendors.length, 22);

let identity = await evaluate("window.aihubPC.getIdentity()");
if (identity.status !== "authenticated") {
  const challenge = await evaluate(
    `window.aihubPC.requestRegistrationCode(${JSON.stringify(email)})`
  );
  let code = "";
  for (let attempt = 0; attempt < 50 && !code; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const mailbox = await (await fetch(`${mailOrigin}/api/v1/messages`)).json();
    const message = mailbox.messages.find((candidate) =>
      candidate.To?.some(
        (recipient) => recipient.Address.toLowerCase() === email.toLowerCase()
      )
    );
    code = message?.Snippet?.match(/(\d{6})/)?.[1] || "";
  }
  assert.match(code, /^\d{6}$/);
  identity = await evaluate(`window.aihubPC.register(${JSON.stringify({
    email,
    username,
    nickname,
    password,
    challengeId: challenge.challengeId,
    code
  })})`);
} else {
  username = identity.user.username;
}
assert.equal(identity.status, "authenticated");
assert.equal(identity.user.username, username);

const communityButtonFound = await evaluate(`(() => {
  const button = [...document.querySelectorAll("button")].find(
    (item) => item.textContent.trim().includes("社区")
  );
  if (!button) return false;
  button.click();
  return true;
})()`);
assert.equal(communityButtonFound, true);
await waitFor(
  `document.body.innerText.includes("Flarum") &&
   document.body.innerText.includes("进入社区")`,
  "PC 客户端没有显示 Flarum 社区入口"
);

const opened = await evaluate("window.aihubPC.openCommunity()");
assert.equal(opened.ok, true);

let forumUser = null;
for (let attempt = 0; attempt < 50 && !forumUser; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const response = await fetch(
    `${communityOrigin}/u/${encodeURIComponent(username)}`
  );
  if (!response.ok) continue;
  const html = await response.text();
  if (html.includes(username)) forumUser = { id: "browser-provisioned" };
}
assert.ok(forumUser, "系统浏览器没有完成 Flarum 单点登录");

socket.close();
process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      catalogVendors: catalog.catalog.vendors.length,
      registered: true,
      pcSession: "authenticated",
      communityProvider: "Flarum",
      browserHandoff: "consumed",
      forumUser: forumUser.id
    },
    null,
    2
  )}\n`
);
