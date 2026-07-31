import assert from "node:assert/strict";
import crypto from "node:crypto";

const identityOrigin = "http://127.0.0.1:4180";
const mailOrigin = "http://127.0.0.1:8025";
const communityOrigin = "http://127.0.0.1:8088";
const suffix = Date.now().toString(36);
const email = `flarum-${suffix}@aihub.local`;
const username = `flarum_${suffix}`;
const password = `AIHub-${suffix}-Secure9`;
const nextPassword = `AIHub-${suffix}-Changed8`;
const nextEmail = `flarum-next-${suffix}@aihub.local`;
const testPhone = `+8613${String(Date.now()).slice(-9)}`;

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

async function waitForCode(targetEmail) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const mailbox = await (await fetch(`${mailOrigin}/api/v1/messages`)).json();
    const message = mailbox.messages.find((candidate) =>
      candidate.To?.some(
        (recipient) =>
          recipient.Address.toLowerCase() === targetEmail.toLowerCase()
      )
    );
    const match = message?.Snippet?.match(/(\d{6})/);
    if (match) return match[1];
  }
  return "";
}

const challenge = await jsonRequest(identityOrigin, "/v1/registration/challenges", {
  method: "POST",
  body: { email }
});

const code = await waitForCode(email);
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

const profile = await jsonRequest(identityOrigin, "/v1/me/profile", {
  method: "PUT",
  accessToken: registered.accessToken,
  body: {
    nickname: `AI Hub ${suffix}`,
    bio: "统一个人中心验收",
    avatarUrl: ""
  }
});
assert.equal(profile.user.profile.bio, "统一个人中心验收");

const phone = await jsonRequest(identityOrigin, "/v1/me/phone", {
  method: "PUT",
  accessToken: registered.accessToken,
  body: {
    phone: testPhone,
    currentPassword: password
  }
});
assert.equal(phone.user.phone, testPhone);

const emailChallenge = await jsonRequest(
  identityOrigin,
  "/v1/me/email-change/challenges",
  {
    method: "POST",
    accessToken: registered.accessToken,
    body: {
      email: nextEmail,
      currentPassword: password
    }
  }
);
const emailCode = await waitForCode(nextEmail);
assert.match(emailCode, /^\d{6}$/);
const changedEmail = await jsonRequest(
  identityOrigin,
  "/v1/me/email-change/complete",
  {
    method: "POST",
    accessToken: registered.accessToken,
    body: {
      challengeId: emailChallenge.challengeId,
      code: emailCode
    }
  }
);
assert.equal(changedEmail.user.email, nextEmail);

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
assert.equal(forumUser.attributes.email, nextEmail);

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

const interaction = await jsonRequest(
  identityOrigin,
  `/v1/me/community-interactions/${discussion.data.id}`,
  {
    method: "PUT",
    accessToken: registered.accessToken,
    body: {
      title: discussionTitle,
      path: `/d/${discussion.data.id}-ai-hub-acceptance`,
      favorited: true,
      liked: true
    }
  }
);
assert.equal(interaction.favorited, true);
assert.equal(interaction.liked, true);
const interactions = await jsonRequest(
  identityOrigin,
  "/v1/me/community-interactions",
  { accessToken: registered.accessToken }
);
assert.equal(interactions.interactions[0].discussionId, discussion.data.id);

const inbox = await jsonRequest(identityOrigin, "/v1/me/messages", {
  accessToken: registered.accessToken
});
assert.ok(inbox.messages.length >= 3);
const unread = inbox.messages.find((message) => !message.read);
assert.ok(unread);
await jsonRequest(identityOrigin, `/v1/me/messages/${unread.id}/read`, {
  method: "PUT",
  accessToken: registered.accessToken,
  body: {}
});

await jsonRequest(identityOrigin, "/v1/me/password", {
  method: "PUT",
  accessToken: registered.accessToken,
  body: {
    currentPassword: password,
    newPassword: nextPassword
  }
});
await assert.rejects(
  jsonRequest(identityOrigin, "/v1/sessions/login", {
    method: "POST",
    body: {
      identifier: nextEmail,
      password,
      deviceId: crypto.randomUUID(),
      deviceName: "Rejected old password"
    }
  }),
  (error) => error.status === 401
);
const relogin = await jsonRequest(identityOrigin, "/v1/sessions/login", {
  method: "POST",
  body: {
    identifier: nextEmail,
    password: nextPassword,
    deviceId: crypto.randomUUID(),
    deviceName: "Changed password acceptance"
  }
});
assert.equal(relogin.user.id, registered.user.id);

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
      personalCenter: {
        emailChanged: true,
        phoneChanged: true,
        passwordChanged: true,
        messages: inbox.messages.length,
        favorited: interaction.favorited,
        liked: interaction.liked
      },
      handoffReplay: "rejected"
    },
    null,
    2
  )}\n`
);
