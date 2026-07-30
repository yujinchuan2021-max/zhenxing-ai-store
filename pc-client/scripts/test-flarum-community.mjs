import assert from "node:assert/strict";
import crypto from "node:crypto";

const identityOrigin = "http://127.0.0.1:4180";
const mailOrigin = "http://127.0.0.1:8025";
const communityOrigin = "http://127.0.0.1:8088";
const suffix = Date.now().toString(36);
const email = `flarum-${suffix}@aihub.local`;
const username = `flarum_${suffix}`;
const password = `AIHub-${suffix}-Secure9`;

async function jsonRequest(origin, pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {}),
      ...(options.forumToken
        ? { Authorization: `Token ${options.forumToken}` }
        : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: options.redirect || "follow"
  });
  const text = await response.text();
  const value = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(
      value.message || value.errors?.[0]?.detail || `HTTP ${response.status}`
    );
    error.status = response.status;
    error.payload = value;
    throw error;
  }
  return value;
}

const challenge = await jsonRequest(identityOrigin, "/v1/registration/challenges", {
  method: "POST",
  body: { email }
});

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

const registered = await jsonRequest(identityOrigin, "/v1/registration/complete", {
  method: "POST",
  body: {
    challengeId: challenge.challengeId,
    code,
    email,
    username,
    nickname: `Flarum ${suffix}`,
    password,
    deviceId: crypto.randomUUID(),
    deviceName: "Flarum acceptance"
  }
});

const handoff = await jsonRequest(identityOrigin, "/v1/community/handoffs", {
  method: "POST",
  accessToken: registered.accessToken
});
assert.equal(new URL(handoff.launchUrl).origin, communityOrigin);

const bridgeResponse = await fetch(handoff.launchUrl, { redirect: "manual" });
const bridgeBody = await bridgeResponse.text();
assert.equal(
  bridgeResponse.status,
  303,
  `SSO bridge failed (${bridgeResponse.status}): ${bridgeBody}`
);
const setCookies =
  typeof bridgeResponse.headers.getSetCookie === "function"
    ? bridgeResponse.headers.getSetCookie()
    : [bridgeResponse.headers.get("set-cookie")].filter(Boolean);
const tokenCookie = setCookies.find((cookie) =>
  cookie.startsWith("flarum_token=")
);
assert.ok(tokenCookie, "SSO bridge did not issue a Flarum token cookie");
const forumToken = tokenCookie.split(";", 1)[0].split("=", 2)[1];
assert.ok(forumToken);

const forumUsers = await jsonRequest(
  communityOrigin,
  `/api/users?filter[q]=${encodeURIComponent(username)}`,
  { forumToken }
);
const forumUser = forumUsers.data.find(
  (candidate) => candidate.attributes.username === username
);
assert.ok(forumUser, "The unified identity was not provisioned in Flarum");
assert.equal(forumUser.attributes.isEmailConfirmed, true);

const discussionTitle = `AI Hub acceptance ${suffix}`;
const discussion = await jsonRequest(communityOrigin, "/api/discussions", {
  method: "POST",
  forumToken,
  body: {
    data: {
      type: "discussions",
      attributes: {
        title: discussionTitle,
        content: "Unified AI Hub identity created this Flarum discussion."
      },
      relationships: {
        tags: {
          data: [{ type: "tags", id: "1" }]
        }
      }
    }
  }
});
assert.equal(discussion.data.attributes.title, discussionTitle);

// Flarum's default flood protection deliberately separates consecutive posts.
await new Promise((resolve) => setTimeout(resolve, 11_000));

const reply = await jsonRequest(communityOrigin, "/api/posts", {
  method: "POST",
  forumToken,
  body: {
    data: {
      type: "posts",
      attributes: {
        content: "The same account can reply without a second registration."
      },
      relationships: {
        discussion: {
          data: {
            type: "discussions",
            id: discussion.data.id
          }
        }
      }
    }
  }
});
assert.equal(reply.data.attributes.contentHtml.includes("same account"), true);

const replay = await fetch(handoff.launchUrl, { redirect: "manual" });
assert.equal(replay.status, 401);

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      provider: "Flarum",
      userId: registered.user.id,
      forumUserId: forumUser.id,
      discussionId: discussion.data.id,
      replyId: reply.data.id,
      handoffReplay: "rejected"
    },
    null,
    2
  )}\n`
);
