"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createIdentityClient
} = require("../electron/identity-client.cjs");

function session(index = 1) {
  return {
    user: {
      id: "user-1",
      email: "user@example.com",
      username: "user",
      profile: { nickname: "User", avatarUrl: "", bio: "" }
    },
    sessionId: "session-1",
    accessToken: `access-${index}`,
    accessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    refreshToken: `refresh-${index}`,
    refreshExpiresAt: new Date(Date.now() + 120_000).toISOString()
  };
}

test("keeps long-lived session material in the vault, not the view", async () => {
  let saved = null;
  const client = createIdentityClient({
    origin: "http://127.0.0.1:4180",
    deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    deviceName: "Test PC",
    vault: {
      read: () => saved,
      write: (value) => {
        saved = value;
      },
      clear: () => {
        saved = null;
      }
    },
    request: async (_url, options) => {
      assert.equal(options.body.identifier, "user@example.com");
      return session();
    }
  });
  const view = await client.login({
    identifier: "user@example.com",
    password: "secure-password-123"
  });
  assert.equal(view.status, "authenticated");
  assert.equal("accessToken" in view, false);
  assert.deepEqual(saved, { refreshToken: "refresh-1" });
});

test("restores a saved session and clears a revoked credential", async () => {
  let saved = { refreshToken: "old-refresh" };
  const client = createIdentityClient({
    origin: "http://127.0.0.1:4180",
    deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    deviceName: "Test PC",
    vault: {
      read: () => saved,
      write: (value) => {
        saved = value;
      },
      clear: () => {
        saved = null;
      }
    },
    request: async () => {
      const error = new Error("revoked");
      error.status = 401;
      throw error;
    }
  });
  assert.deepEqual(await client.current(), { status: "anonymous" });
  assert.equal(saved, null);
});

test("rejects non-loopback plain HTTP identity services", () => {
  assert.throws(
    () =>
      createIdentityClient({
        origin: "http://identity.example",
        deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        deviceName: "Test PC",
        vault: {},
        request: async () => ({})
      }),
    /HTTPS/
  );
});

test("keeps personal center and embedded community calls behind the main process", async () => {
  const calls = [];
  const client = createIdentityClient({
    origin: "http://127.0.0.1:4180",
    deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    deviceName: "Test PC",
    vault: {
      read: () => null,
      write: () => {},
      clear: () => {}
    },
    request: async (url, options = {}) => {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      calls.push({ pathname, search: parsed.search, options });
      if (pathname === "/v1/sessions/login") return session();
      if (pathname === "/v1/me/phone") {
        return {
          user: {
            ...session().user,
            phone: "+8613800000000"
          }
        };
      }
      if (pathname === "/v1/me/avatar") {
        return {
          user: {
            ...session().user,
            profile: {
              ...session().user.profile,
              avatarUrl: "http://127.0.0.1:4180/v1/avatars/user-1?v=1"
            }
          }
        };
      }
      if (pathname === "/v1/me/messages") {
        return { messages: [{ id: "message-1" }] };
      }
      if (pathname === "/v1/me/personal-center") {
        return {
          notifications: [{ id: "message-1", source: "account" }],
          interactions: [],
          summary: { unreadNotifications: 1 }
        };
      }
      if (pathname === "/v1/users/by-username/peer") {
        return {
          id: "user-2",
          username: "peer",
          profile: { nickname: "Peer", avatarUrl: "", bio: "" },
          social: {
            followers: 1,
            following: 0,
            isFollowing: false,
            isMe: false
          }
        };
      }
      if (pathname === "/v1/me/followers") {
        return {
          users: [{ id: "user-2", username: "peer" }],
          hasMore: true,
          nextOffset: 27
        };
      }
      if (pathname === "/v1/me/following") {
        return {
          users: [{ id: "user-3", username: "followed" }],
          hasMore: false,
          nextOffset: null
        };
      }
      if (pathname === "/v1/me/direct-messages") {
        return {
          conversations: [{ peer: { id: "user-2" } }],
          hasMore: false,
          nextOffset: null
        };
      }
      if (pathname === "/v1/me/direct-messages/user-2") {
        if (options.method === "POST") {
          return { id: "direct-2", body: options.body.body };
        }
        return {
          peer: { id: "user-2" },
          messages: [{ id: "direct-1", body: "hello" }],
          hasMore: true,
          nextBefore: "direct-1"
        };
      }
      if (pathname === "/v1/me/community-interactions") {
        return { interactions: [{ discussionId: "42" }] };
      }
      if (pathname === "/v1/community/handoffs") {
        return {
          launchUrl:
            "http://127.0.0.1:8088/aihub-sso.php?ticket=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          expiresAt: new Date(Date.now() + 60_000).toISOString()
        };
      }
      return { ok: true };
    }
  });

  await client.login({
    identifier: "user@example.com",
    password: "secure-password-123"
  });
  const updated = await client.updatePhone({
    phone: "+8613800000000",
    currentPassword: "secure-password-123"
  });
  assert.equal(updated.user.phone, "+8613800000000");
  const avatar = await client.updateAvatar({
    dataUrl: "data:image/jpeg;base64,/9j/2wBD"
  });
  assert.match(avatar.user.profile.avatarUrl, /\/v1\/avatars\//);
  assert.deepEqual(await client.listMessages(), [{ id: "message-1" }]);
  assert.deepEqual((await client.getPersonalCenter()).notifications, [
    { id: "message-1", source: "account" }
  ]);
  assert.equal(
    (await client.getIdentityUserByUsername("peer")).id,
    "user-2"
  );
  assert.equal(
    (await client.listIdentityFollowers({ limit: 25, offset: 2 })).users[0].id,
    "user-2"
  );
  assert.equal((await client.listIdentityFollowing()).users[0].id, "user-3");
  await client.followIdentityUser("user-2");
  await client.unfollowIdentityUser("user-2");
  assert.equal(
    (await client.listDirectConversations({ limit: 25 })).conversations[0].peer.id,
    "user-2"
  );
  assert.equal(
    (
      await client.listDirectMessages("user-2", {
        limit: 50,
        before: "direct-0"
      })
    ).messages[0].id,
    "direct-1"
  );
  assert.equal(
    (await client.sendDirectMessage("user-2", { body: "hello" })).body,
    "hello"
  );
  await client.markDirectMessagesRead("user-2", "direct-1");
  await client.markPersonalCenterNotificationRead("community", "7");
  assert.deepEqual(await client.listCommunityInteractions(), [
    { discussionId: "42" }
  ]);
  await client.setCommunityInteraction("42", {
    title: "Discussion",
    path: "/d/42-discussion",
    favorited: true,
    liked: false
  });
  await client.createCommunityHandoff();

  const protectedCalls = calls.filter(
    (call) => call.pathname !== "/v1/sessions/login"
  );
  assert.equal(
    protectedCalls.every(
      (call) => call.options.accessToken === "access-1"
    ),
    true
  );
  assert.equal(
    calls.some(
      (call) =>
        call.pathname === "/v1/me/avatar" &&
        call.options.body.dataUrl.startsWith("data:image/jpeg")
    ),
    true
  );
  assert.equal(
    calls.some(
      (call) =>
        call.pathname === "/v1/me/followers" &&
        call.search === "?limit=25&offset=2"
    ),
    true
  );
  assert.equal(
    calls.some(
      (call) =>
        call.pathname === "/v1/me/direct-messages/user-2" &&
        call.search === "?limit=50&before=direct-0"
    ),
    true
  );
  assert.equal(
    calls.some(
      (call) =>
        call.pathname === "/v1/me/community-interactions/42" &&
        call.options.body.favorited === true
    ),
    true
  );
  assert.equal(
    calls.some(
      (call) =>
        call.pathname ===
        "/v1/me/notifications/community/7/read"
    ),
    true
  );
  assert.equal(
    calls.some(
      (call) =>
        call.pathname === "/v1/me/following/user-2" &&
        call.options.method === "DELETE"
    ),
    true
  );
  assert.equal(
    calls.some(
      (call) =>
        call.pathname === "/v1/me/direct-messages/user-2/read" &&
        call.options.body.throughMessageId === "direct-1"
    ),
    true
  );
});

test("workflow owner client stays capability-gated and never sends an identity or reviewer", async () => {
  const calls = [];
  const client = createIdentityClient({
    origin: "http://127.0.0.1:4180",
    deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    deviceName: "Test PC",
    vault: { read: () => null, write: () => {}, clear: () => {} },
    request: async (url, options = {}) => {
      const parsed = new URL(url);
      calls.push({ pathname: parsed.pathname, search: parsed.search, options });
      if (parsed.pathname === "/v1/sessions/login") return session();
      if (parsed.pathname === "/v1/community/workflow-store/capability") {
        return { enabled: true, schemaVersion: 1, execution: false, workflowSubmissionLookup: false };
      }
      return { workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", expectedRevision: 1 };
    }
  });
  await client.login({ identifier: "user@example.com", password: "secure-password-123" });
  await client.createMyWorkflowDraft("create-key", { sourceCommunityPostId: "42", provenance: {}, content: {} });
  await client.listMyWorkflowDrafts({ limit: 20, after: "cursor" });
  await client.getMyWorkflowDraft("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await client.updateMyWorkflowDraft("update-key", { workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", expectedRevision: 1, content: {} });
  await client.submitMyWorkflowDraft("submit-key", { workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", expectedRevision: 2 });
  await client.withdrawMyWorkflowDraft("withdraw-key", { workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", expectedRevision: 3 });
  await client.attachMyWorkflowPost("attach-key", { workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 1, communityPostId: "43", expectedRevision: 4 });
  await client.detachMyWorkflowPost("detach-key", { workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 1, communityPostId: "43", expectedRevision: 5 });
  await client.reportWorkflowRelease("report-key", { workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 1, reason: "copyright concern" });

  assert.equal(calls.filter((entry) => entry.pathname === "/v1/community/workflow-store/capability").length, 9);
  assert.equal(calls.filter((entry) => entry.options.accessToken === "access-1").length, 9);
  assert.equal(calls.some((entry) => /reviewer/.test(JSON.stringify(entry.options.body || {}))), false);
  assert.equal(calls.some((entry) => /identityId/.test(JSON.stringify(entry.options.body || {}))), false);
  assert.equal(calls.some((entry) => entry.options.idempotencyKey === "report-key"), true);
});

test("workflow public client exposes only fixed read calls and exact tuples", async () => {
  const calls = [];
  const client = createIdentityClient({
    origin: "https://identity.example.test",
    deviceId: "device-1",
    deviceName: "test device",
    request: async (url, options = {}) => {
      const parsed = new URL(url);
      calls.push({ url, path: `${parsed.pathname}${parsed.search}`, options });
      if (parsed.pathname.endsWith("/public/capability")) return { enabled: true, schemaVersion: 1, execution: false };
      if (parsed.pathname.includes("/public/list")) return { items: [], next: null };
      return { workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 1 };
    },
    vault: { load: async () => null, save: async () => {}, clear: async () => {} }
  });
  assert.deepEqual(await client.getWorkflowPublicCapability(), { enabled: true, schemaVersion: 1, execution: false });
  await client.listPublicWorkflows({ limit: 10, riskLevel: "guarded" });
  await client.getPublicWorkflow({ workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 1 });
  await client.resolvePublicWorkflow({ workflowId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 1 });
  assert.equal(calls.length, 7);
  assert.equal(calls.filter((call) => call.path.endsWith("/public/capability")).length, 4);
  assert.equal(calls.every((call) => call.options.method === undefined || call.options.method === "GET"), true);
  assert.equal(calls.every((call) => !call.options.body && !call.options.accessToken), true);
  assert.equal(calls.some((call) => /https?:|path=|url=/i.test(call.path)), false);
});
