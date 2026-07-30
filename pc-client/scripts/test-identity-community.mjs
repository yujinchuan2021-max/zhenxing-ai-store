import assert from "node:assert/strict";
import crypto from "node:crypto";

const identityOrigin = "http://127.0.0.1:4180";
const mailOrigin = "http://127.0.0.1:8025";
const suffix = Date.now().toString(36);
const email = `acceptance-${suffix}@aihub.local`;
const username = `acceptance_${suffix}`;
const password = `AIHub-${suffix}-Secure9`;
const deviceId = crypto.randomUUID();

async function request(pathname, options = {}) {
  const response = await fetch(`${identityOrigin}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const value = await response.json();
  if (!response.ok) {
    const error = new Error(value.message || "request failed");
    error.status = response.status;
    error.code = value.error;
    throw error;
  }
  return value;
}

const challenge = await request("/v1/registration/challenges", {
  method: "POST",
  body: { email }
});
assert.equal(challenge.localMailViewerUrl, mailOrigin);

let code = "";
for (let attempt = 0; attempt < 40 && !code; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  const mailbox = await (await fetch(`${mailOrigin}/api/v1/messages`)).json();
  const message = mailbox.messages.find((candidate) =>
    candidate.To?.some(
      (recipient) => recipient.Address.toLowerCase() === email.toLowerCase()
    )
  );
  const match = message?.Snippet?.match(/(\d{6})/);
  if (match) code = match[1];
}
assert.match(code, /^\d{6}$/);

const registered = await request("/v1/registration/complete", {
  method: "POST",
  body: {
    challengeId: challenge.challengeId,
    code,
    email,
    username,
    nickname: "验收用户",
    password,
    deviceId,
    deviceName: "AI Hub Acceptance"
  }
});
assert.equal(registered.user.email, email);
assert.equal(registered.user.profile.nickname, "验收用户");

const sessions = await request("/v1/sessions", {
  accessToken: registered.accessToken
});
assert.equal(sessions.sessions.length, 1);
assert.equal(sessions.sessions[0].current, true);

const discussion = await request("/v1/discussions", {
  method: "POST",
  accessToken: registered.accessToken,
  body: {
    title: `AI Hub 社区验收 ${suffix}`,
    body: "验证统一账号可以直接发布产品讨论。",
    productId: "chatgpt-web"
  }
});
assert.equal(discussion.productId, "chatgpt-web");

const replied = await request(`/v1/discussions/${discussion.id}/replies`, {
  method: "POST",
  accessToken: registered.accessToken,
  body: { body: "验证同一身份可以继续回复讨论。" }
});
assert.equal(replied.replies.length, 1);
assert.equal(replied.replies[0].author.nickname, "验收用户");

const refreshed = await request("/v1/sessions/refresh", {
  method: "POST",
  body: { refreshToken: registered.refreshToken }
});
assert.notEqual(refreshed.refreshToken, registered.refreshToken);
assert.notEqual(refreshed.accessToken, registered.accessToken);

const current = await request("/v1/me", {
  accessToken: refreshed.accessToken
});
assert.equal(current.user.id, registered.user.id);

let reuseRejected = false;
try {
  await request("/v1/sessions/refresh", {
    method: "POST",
    body: { refreshToken: registered.refreshToken }
  });
} catch (error) {
  reuseRejected =
    error.status === 401 && error.code === "SESSION_REVOKED";
}
assert.equal(reuseRejected, true);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      userId: registered.user.id,
      sessionRotation: "verified",
      refreshReuse: "revoked",
      discussionId: discussion.id,
      replies: replied.replies.length,
      mailViewer: mailOrigin
    },
    null,
    2
  )}\n`
);
