import assert from "node:assert/strict";
import crypto from "node:crypto";

const identityOrigin = "http://127.0.0.1:4180";
const mailOrigin = "http://127.0.0.1:8025";
const communityOrigin = "http://127.0.0.1:8088";
const forumAdminToken =
  "aihub-local-forum-api-key-change-before-production; userId=1";
const suffix = Date.now().toString(36);
const email = `flarum-${suffix}@aihub.local`;
const username = `用户${suffix}`;
const peerEmail = `flarum-peer-${suffix}@aihub.local`;
const peerUsername = `flarum_peer_${suffix}`;
const password = `AIHub-${suffix}-Secure9`;
const nextPassword = `AIHub-${suffix}-Changed8`;
const nextEmail = `flarum-next-${suffix}@aihub.local`;
const linkedEmail = `flarum-linked-${suffix}@aihub.local`;
const testPhone = `+8613${String(Date.now()).slice(-9)}`;
const expectedNickname = `AI Hub ${suffix}`;

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
const communityUsername = `zx_${registered.user.id
  .replaceAll("-", "")
  .slice(0, 27)}`;

const profile = await jsonRequest(identityOrigin, "/v1/me/profile", {
  method: "PUT",
  accessToken: registered.accessToken,
  body: {
    nickname: expectedNickname,
    bio: "统一个人中心验收",
    avatarUrl: ""
  }
});
assert.equal(profile.user.profile.bio, "统一个人中心验收");

const avatarBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const avatar = await jsonRequest(identityOrigin, "/v1/me/avatar", {
  method: "PUT",
  accessToken: registered.accessToken,
  body: { dataUrl: `data:image/png;base64,${avatarBase64}` }
});
assert.match(avatar.user.profile.avatarUrl, /\/v1\/avatars\//);

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
let forumToken = tokenCookie.split(";", 1)[0].split("=", 2)[1];
assert.ok(forumToken);

const forumUsers = await jsonRequest(
  communityOrigin,
  `/api/users?filter[q]=${encodeURIComponent(communityUsername)}`,
  { forumToken }
);
const forumUser = forumUsers.data.find(
  (candidate) => candidate.attributes.username === communityUsername
);
assert.ok(forumUser, "The unified identity was not provisioned in Flarum");
assert.equal(forumUser.attributes.isEmailConfirmed, true);
assert.equal(forumUser.attributes.email, nextEmail);
assert.equal(forumUser.attributes.displayName, expectedNickname);
assert.equal(forumUser.attributes.avatarUrl, avatar.user.profile.avatarUrl);

const existingDiscussions = await jsonRequest(
  communityOrigin,
  "/api/discussions?page[limit]=1",
  { forumToken }
);
const existingDiscussionId = String(existingDiscussions.data?.[0]?.id || "");
assert.match(existingDiscussionId, /^[0-9]+$/);
const existingDiscussion = await jsonRequest(
  communityOrigin,
  `/api/discussions/${existingDiscussionId}`,
  { forumToken }
);
const likeablePost = existingDiscussion.included?.find(
  (item) => item.type === "posts" && item.attributes?.canLike
);
assert.ok(likeablePost, "fixture discussion did not expose a likeable post");
await jsonRequest(communityOrigin, `/api/posts/${likeablePost.id}`, {
  method: "PATCH",
  forumToken,
  body: {
    data: {
      type: "posts",
      id: String(likeablePost.id),
      attributes: { isLiked: true }
    }
  }
});

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

const legacyUsername = `legacy_${suffix}`;
const renamedLegacy = await jsonRequest(
  communityOrigin,
  `/api/users/${forumUser.id}`,
  {
    method: "PATCH",
    forumToken: forumAdminToken,
    body: {
      data: {
        type: "users",
        id: String(forumUser.id),
        attributes: { username: legacyUsername }
      }
    }
  }
);
assert.equal(renamedLegacy.data.attributes.username, legacyUsername);

const migrationHandoff = await jsonRequest(
  identityOrigin,
  "/v1/community/handoffs",
  { method: "POST", accessToken: registered.accessToken }
);
const migrationBridge = await fetch(migrationHandoff.launchUrl, {
  redirect: "manual"
});
assert.equal(migrationBridge.status, 303);
const migrationCookies =
  typeof migrationBridge.headers.getSetCookie === "function"
    ? migrationBridge.headers.getSetCookie()
    : [migrationBridge.headers.get("set-cookie")].filter(Boolean);
const migrationTokenCookie = migrationCookies.find((cookie) =>
  cookie.startsWith("flarum_token=")
);
assert.ok(migrationTokenCookie);
forumToken = migrationTokenCookie.split(";", 1)[0].split("=", 2)[1];
const migratedForumUser = await jsonRequest(
  communityOrigin,
  `/api/users/${forumUser.id}`,
  { forumToken }
);
assert.equal(migratedForumUser.data.id, forumUser.id);
assert.equal(migratedForumUser.data.attributes.username, communityUsername);
assert.equal(migratedForumUser.data.attributes.displayName, expectedNickname);
assert.equal(migratedForumUser.data.attributes.avatarUrl, avatar.user.profile.avatarUrl);
const preservedDiscussion = await jsonRequest(
  communityOrigin,
  `/api/discussions/${discussion.data.id}`,
  { forumToken }
);
assert.equal(
  preservedDiscussion.data.relationships.user.data.id,
  forumUser.id,
  "email-based migration must preserve the Flarum author id"
);

const linkedEmailChallenge = await jsonRequest(
  identityOrigin,
  "/v1/me/email-change/challenges",
  {
    method: "POST",
    accessToken: registered.accessToken,
    body: { email: linkedEmail, currentPassword: password }
  }
);
const linkedEmailCode = await waitForCode(linkedEmail);
assert.match(linkedEmailCode, /^\d{6}$/);
await jsonRequest(identityOrigin, "/v1/me/email-change/complete", {
  method: "POST",
  accessToken: registered.accessToken,
  body: {
    challengeId: linkedEmailChallenge.challengeId,
    code: linkedEmailCode
  }
});
const linkedHandoff = await jsonRequest(
  identityOrigin,
  "/v1/community/handoffs",
  { method: "POST", accessToken: registered.accessToken }
);
const linkedBridge = await fetch(linkedHandoff.launchUrl, {
  redirect: "manual"
});
assert.equal(linkedBridge.status, 303);
const linkedCookies =
  typeof linkedBridge.headers.getSetCookie === "function"
    ? linkedBridge.headers.getSetCookie()
    : [linkedBridge.headers.get("set-cookie")].filter(Boolean);
const linkedTokenCookie = linkedCookies.find((cookie) =>
  cookie.startsWith("flarum_token=")
);
assert.ok(linkedTokenCookie);
forumToken = linkedTokenCookie.split(";", 1)[0].split("=", 2)[1];
const relinkedForumUser = await jsonRequest(
  communityOrigin,
  `/api/users/${forumUser.id}`,
  { forumToken }
);
assert.equal(relinkedForumUser.data.id, forumUser.id);
assert.equal(relinkedForumUser.data.attributes.email, linkedEmail);

const peerChallenge = await jsonRequest(
  identityOrigin,
  "/v1/registration/challenges",
  {
    method: "POST",
    body: { email: peerEmail }
  }
);
const peerCode = await waitForCode(peerEmail);
assert.match(peerCode, /^\d{6}$/);
const peer = await jsonRequest(identityOrigin, "/v1/registration/complete", {
  method: "POST",
  body: {
    challengeId: peerChallenge.challengeId,
    code: peerCode,
    email: peerEmail,
    username: peerUsername,
    nickname: `Peer ${suffix}`,
    password,
    deviceId: crypto.randomUUID(),
    deviceName: "Flarum notification peer"
  }
});
const peerHandoff = await jsonRequest(
  identityOrigin,
  "/v1/community/handoffs",
  {
    method: "POST",
    accessToken: peer.accessToken
  }
);
const peerBridge = await fetch(peerHandoff.launchUrl, { redirect: "manual" });
assert.equal(peerBridge.status, 303);
const peerCookies =
  typeof peerBridge.headers.getSetCookie === "function"
    ? peerBridge.headers.getSetCookie()
    : [peerBridge.headers.get("set-cookie")].filter(Boolean);
const peerTokenCookie = peerCookies.find((cookie) =>
  cookie.startsWith("flarum_token=")
);
assert.ok(peerTokenCookie);
const peerForumToken = peerTokenCookie.split(";", 1)[0].split("=", 2)[1];
await jsonRequest(communityOrigin, `/api/posts/${reply.data.id}`, {
  method: "PATCH",
  forumToken: peerForumToken,
  body: {
    data: {
      type: "posts",
      id: String(reply.data.id),
      attributes: { isLiked: true }
    }
  }
});

const lastReadPostNumber = Number(reply.data.attributes.number);
assert.ok(lastReadPostNumber > 0);
await jsonRequest(communityOrigin, `/api/discussions/${discussion.data.id}`, {
  method: "PATCH",
  forumToken: peerForumToken,
  body: {
    data: {
      type: "discussions",
      id: String(discussion.data.id),
      attributes: { lastReadPostNumber }
    }
  }
});
const peerCenterBeforeHide = await jsonRequest(
  identityOrigin,
  "/v1/me/personal-center",
  { accessToken: peer.accessToken }
);
assert.equal(
  peerCenterBeforeHide.readingHistory.some(
    (item) => item.discussionId === String(discussion.data.id)
  ),
  true,
  "visible discussion did not reach the peer reading history"
);

await jsonRequest(communityOrigin, `/api/discussions/${discussion.data.id}`, {
  method: "PATCH",
  forumToken,
  body: {
    data: {
      type: "discussions",
      id: String(discussion.data.id),
      attributes: { subscription: "follow" }
    }
  }
});

const personalCenter = await jsonRequest(identityOrigin, "/v1/me/personal-center", {
  accessToken: registered.accessToken
});
assert.equal(personalCenter.sources.account, "ready");
assert.equal(personalCenter.sources.community, "ready");
assert.ok(personalCenter.notifications.length >= 3);
const communityUnread = personalCenter.notifications.find(
  (message) =>
    message.source === "community" &&
    !message.read &&
    message.actionPath.includes(`/d/${discussion.data.id}-`)
);
assert.ok(communityUnread, "Flarum notification did not reach personal center");
assert.equal(
  personalCenter.interactions.some(
    (item) =>
      item.discussionId === String(discussion.data.id) && item.favorited
  ),
  true
);
assert.equal(
  personalCenter.interactions.some(
    (item) => item.discussionId === existingDiscussionId && item.liked
  ),
  true
);
assert.equal(
  personalCenter.readingHistory.some(
    (item) => item.discussionId === String(discussion.data.id)
  ),
  true
);
assert.ok(personalCenter.summary.favorites >= 1);
assert.ok(personalCenter.summary.likes >= 1);
const unread = personalCenter.notifications.find(
  (message) => message.source === "account" && !message.read
);
assert.ok(unread);
await jsonRequest(
  identityOrigin,
  `/v1/me/notifications/account/${unread.id}/read`,
  {
  method: "PUT",
  accessToken: registered.accessToken,
  body: {}
  }
);
await jsonRequest(
  identityOrigin,
  `/v1/me/notifications/community/${communityUnread.id}/read`,
  {
    method: "PUT",
    accessToken: registered.accessToken,
    body: {}
  }
);
const readBack = await jsonRequest(identityOrigin, "/v1/me/personal-center", {
  accessToken: registered.accessToken
});
assert.equal(
  readBack.notifications.find(
    (message) =>
      message.source === "community" && message.id === communityUnread.id
  )?.read,
  true
);

await jsonRequest(communityOrigin, `/api/discussions/${discussion.data.id}`, {
  method: "PATCH",
  forumToken,
  body: {
    data: {
      type: "discussions",
      id: String(discussion.data.id),
      attributes: { isHidden: true }
    }
  }
});
const peerCenterAfterHide = await jsonRequest(
  identityOrigin,
  "/v1/me/personal-center",
  { accessToken: peer.accessToken }
);
assert.equal(
  peerCenterAfterHide.readingHistory.some(
    (item) => item.discussionId === String(discussion.data.id)
  ),
  false,
  "hidden discussion leaked through the peer reading history"
);
assert.equal(
  peerCenterAfterHide.interactions.some(
    (item) => item.discussionId === String(discussion.data.id)
  ),
  false,
  "hidden discussion leaked through the peer interactions"
);

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
      identifier: linkedEmail,
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
    identifier: linkedEmail,
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
        notifications: personalCenter.notifications.length,
        communityNotificationRead: true,
        favorites: personalCenter.summary.favorites,
        likes: personalCenter.summary.likes,
        readingHistory: personalCenter.readingHistory.length,
        hiddenHistoryFiltered: true,
        hiddenInteractionsFiltered: true,
        communitySource: personalCenter.sources.community
      },
      handoffReplay: "rejected"
    },
    null,
    2
  )}\n`
);
