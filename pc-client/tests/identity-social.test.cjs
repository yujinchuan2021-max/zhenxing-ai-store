"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  communityUsername,
  createIdentityCommunity
} = require("../identity/identity-community.cjs");

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PEER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MESSAGE_1 = "11111111-1111-4111-8111-111111111111";
const MESSAGE_2 = "22222222-2222-4222-8222-222222222222";
const CREATED_1 = new Date("2026-08-04T01:00:00.000Z");
const CREATED_2 = new Date("2026-08-04T01:01:00.000Z");

function rowCount(rows = []) {
  return { rowCount: rows.length, rows };
}

function session(userId = ACTOR) {
  return rowCount([{ id: `session-${userId}`, user_id: userId, device_id: "device" }]);
}

function publicRow(overrides = {}) {
  return {
    id: PEER,
    username: "peer_user",
    nickname: "Peer",
    avatar_url: "/v1/avatars/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    bio: "Public bio",
    followers_count: 1,
    following_count: 2,
    is_following: true,
    is_me: false,
    email: "must-not-leak@example.com",
    phone: "+8613800000000",
    ...overrides
  };
}

function scriptedPool(steps) {
  async function query(sql, params = []) {
    const step = steps.shift();
    assert.ok(step, `unexpected query: ${sql}`);
    assert.match(sql.replace(/\s+/g, " "), step.match);
    step.check?.(params, sql);
    return typeof step.result === "function"
      ? step.result(params, sql)
      : step.result || rowCount();
  }
  return {
    query,
    connect: async () => ({ query, release() {} }),
    assertDone() {
      assert.equal(steps.length, 0, `${steps.length} scripted queries were not used`);
    }
  };
}

function identity(pool, options = {}) {
  return createIdentityCommunity({
    pool,
    publicOrigin: "http://127.0.0.1:4180",
    publishedProductIds: async () => new Set(),
    sendVerification: async () => {},
    ...options
  });
}

function authStep(userId = ACTOR) {
  return { match: /FROM sessions WHERE access_hash/, result: session(userId) };
}

function publicStep(row = publicRow()) {
  return {
    match: /followers_count.*WHERE u\.id = \$2 AND u\.status = 'active'/,
    result: rowCount([row])
  };
}

test("keeps the social schema minimal and leaves community history in Flarum", () => {
  const schema = fs.readFileSync(
    path.join(__dirname, "../identity/schema.sql"),
    "utf8"
  );
  assert.match(schema, /CREATE TABLE IF NOT EXISTS user_follows/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS user_follow_notifications/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS direct_messages/);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS direct_conversations/);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS .*reading_history/);
});

test("derives every Flarum username only from the immutable identity id", () => {
  assert.equal(
    communityUsername({ id: ACTOR, username: "legacy_user" }),
    "zx_aaaaaaaaaaaa4aaa8aaaaaaaaaa"
  );
  assert.equal(
    communityUsername({ id: ACTOR, username: "中文" }),
    "zx_aaaaaaaaaaaa4aaa8aaaaaaaaaa"
  );
  const schema = fs.readFileSync(
    path.join(__dirname, "../identity/schema.sql"),
    "utf8"
  );
  assert.match(schema, /community_username text NOT NULL/);
  assert.match(schema, /users_community_username_unique/);
});

test("migrates Flarum identities by email and keeps public profile fields native", () => {
  const bridge = fs.readFileSync(
    path.join(__dirname, "../community/flarum/aihub-sso.php"),
    "utf8"
  );
  const runtimeEntrypoint = fs.readFileSync(
    path.join(__dirname, "../community/flarum/docker-entrypoint.sh"),
    "utf8"
  );
  const migrationEntrypoint = fs.readFileSync(
    path.join(__dirname, "../community/flarum/migration-entrypoint.sh"),
    "utf8"
  );
  assert.match(bridge, /WHERE username = \? OR email = \? FOR UPDATE/);
  assert.match(bridge, /FROM aihub_identity_links/);
  assert.match(bridge, /WHERE identity_user_id = \? FOR UPDATE/);
  assert.match(bridge, /UPDATE users SET username = \? WHERE id = \?/);
  assert.match(bridge, /COMMUNITY_USERNAME_COLLISION/);
  assert.match(bridge, /empty\(\$user->id\) && !\$user->fetch\(\)/);
  assert.match(bridge, /if \(\$forumUserId < 1\)/);
  assert.match(bridge, /attributes->nickname = \$nickname/);
  assert.match(bridge, /UPDATE users SET avatar_url = NULLIF/);
  assert.doesNotMatch(runtimeEntrypoint, /php flarum (?:install|migrate|extension:enable)/);
  assert.doesNotMatch(runtimeEntrypoint, /(?:CREATE TABLE|INSERT(?: IGNORE)? INTO|DELETE FROM)\s+/);
  assert.match(migrationEntrypoint, /extension:enable flarum-nicknames/);
  assert.match(migrationEntrypoint, /CREATE TABLE IF NOT EXISTS aihub_identity_links/);
  assert.match(migrationEntrypoint, /"display_name_driver" => "nickname"/);
  assert.match(migrationEntrypoint, /"allow_sign_up" => "0"/);
});

test("follows idempotently and emits one system message only on first insert", async () => {
  let siteMessages = 0;
  const pool = scriptedPool([
    authStep(),
    { match: /^BEGIN$/, result: rowCount() },
    { match: /SELECT id FROM users .* FOR SHARE/, result: rowCount([{ id: PEER }]) },
    { match: /INSERT INTO user_follows/, result: rowCount([{ follower_user_id: ACTOR }]) },
    {
      match: /INSERT INTO user_follow_notifications/,
      result: rowCount([{ follower_user_id: ACTOR }])
    },
    {
      match: /SELECT u\.username, p\.nickname/,
      result: rowCount([{ username: "actor", nickname: "Actor" }])
    },
    {
      match: /INSERT INTO site_messages/,
      check(params) {
        siteMessages += 1;
        assert.equal(params[1], PEER);
        assert.equal(params[2], "Actor 关注了你");
      },
      result: rowCount()
    },
    { match: /^COMMIT$/, result: rowCount() },
    publicStep(),
    authStep(),
    { match: /^BEGIN$/, result: rowCount() },
    { match: /SELECT id FROM users .* FOR SHARE/, result: rowCount([{ id: PEER }]) },
    { match: /INSERT INTO user_follows/, result: rowCount() },
    { match: /^COMMIT$/, result: rowCount() },
    publicStep()
  ]);
  const service = identity(pool);

  const first = await service.followUser("access-a", PEER);
  const repeated = await service.followUser("access-a", PEER);

  assert.deepEqual(
    {
      ok: first.ok,
      following: first.following,
      created: first.created,
      publicFields: Object.keys(first.user),
      leakedEmail: "email" in first.user,
      leakedPhone: "phone" in first.user
    },
    {
      ok: true,
      following: true,
      created: true,
      publicFields: ["id", "username", "profile", "social"],
      leakedEmail: false,
      leakedPhone: false
    }
  );
  assert.equal(repeated.created, false);
  assert.equal(siteMessages, 1);
  pool.assertDone();
});

test("refollowing does not create repeated system notifications", async () => {
  const pool = scriptedPool([
    authStep(),
    { match: /^BEGIN$/, result: rowCount() },
    { match: /SELECT id FROM users .* FOR SHARE/, result: rowCount([{ id: PEER }]) },
    { match: /INSERT INTO user_follows/, result: rowCount([{ follower_user_id: ACTOR }]) },
    { match: /INSERT INTO user_follow_notifications/, result: rowCount() },
    { match: /^COMMIT$/, result: rowCount() },
    publicStep()
  ]);

  const result = await identity(pool).followUser("access-a", PEER);

  assert.equal(result.created, true);
  pool.assertDone();
});

test("lists followers and following with the same public user shape", async () => {
  const follower = publicRow({ is_following: false });
  const pool = scriptedPool([
    authStep(),
    {
      match: /FROM user_follows edge .* edge\.followed_user_id/,
      check(params) {
        assert.deepEqual(params, [ACTOR, 2, 2]);
      },
      result: rowCount([follower, publicRow({ id: ACTOR })])
    },
    authStep(),
    {
      match: /FROM user_follows edge .* edge\.follower_user_id/,
      check(params) {
        assert.deepEqual(params, [ACTOR, 2, 0]);
      },
      result: rowCount([publicRow()])
    }
  ]);
  const service = identity(pool);

  const followers = await service.listFollowers("access-a", {
    limit: 1,
    offset: 2
  });
  const following = await service.listFollowing("access-a", { limit: 1 });

  assert.deepEqual(Object.keys(followers.users[0]), ["id", "username", "profile", "social"]);
  assert.equal(followers.users[0].social.isFollowing, false);
  assert.deepEqual(
    { hasMore: followers.hasMore, nextOffset: followers.nextOffset },
    { hasMore: true, nextOffset: 3 }
  );
  assert.equal(following.users[0].social.isFollowing, true);
  assert.equal(following.hasMore, false);
  pool.assertDone();
});

test("sends, aggregates, reads and marks one-to-one messages through a cursor", async () => {
  const sentRow = {
    id: MESSAGE_2,
    sender_user_id: ACTOR,
    recipient_user_id: PEER,
    body: "hello",
    read_at: null,
    created_at: CREATED_2
  };
  const olderRow = {
    id: MESSAGE_1,
    sender_user_id: PEER,
    recipient_user_id: ACTOR,
    body: "earlier",
    read_at: null,
    created_at: CREATED_1
  };
  const conversationRow = {
    ...sentRow,
    unread_count: 2,
    peer_id: PEER,
    peer_username: "peer_user",
    peer_nickname: "Peer",
    peer_avatar_url: "",
    peer_bio: "",
    peer_followers_count: 1,
    peer_following_count: 2,
    peer_is_following: true
  };
  const pool = scriptedPool([
    authStep(),
    { match: /^BEGIN$/, result: rowCount() },
    publicStep(),
    {
      match: /pg_advisory_xact_lock/,
      check(params) {
        assert.deepEqual(params, [ACTOR]);
      },
      result: rowCount()
    },
    { match: /count\(\*\)::int AS count FROM direct_messages/, result: rowCount([{ count: 0 }]) },
    { match: /INSERT INTO direct_messages/, result: rowCount([sentRow]) },
    { match: /^COMMIT$/, result: rowCount() },
    authStep(),
    {
      match: /WITH mine AS/,
      check(params) {
        assert.deepEqual(params, [ACTOR, 51, 0]);
      },
      result: rowCount([conversationRow])
    },
    authStep(),
    publicStep(),
    {
      match: /FROM direct_messages WHERE \( .* ORDER BY created_at DESC/,
      result: rowCount([sentRow, olderRow])
    },
    authStep(),
    publicStep(),
    {
      match: /SELECT id, created_at FROM direct_messages .* \(sender_user_id = \$2/,
      check(params) {
        assert.deepEqual(params, [MESSAGE_2, ACTOR, PEER]);
      },
      result: rowCount([{ id: MESSAGE_2, created_at: CREATED_2 }])
    },
    {
      match: /FROM direct_messages WHERE \( .* ORDER BY created_at DESC/,
      result: rowCount([olderRow])
    },
    authStep(),
    {
      match: /SELECT id, created_at FROM direct_messages .* sender_user_id = \$2/,
      check(params) {
        assert.deepEqual(params, [MESSAGE_1, PEER, ACTOR]);
      },
      result: rowCount([{ id: MESSAGE_1, created_at: CREATED_1 }])
    },
    {
      match: /UPDATE direct_messages .* \(created_at, id\) <=/,
      check(params) {
        assert.deepEqual(params, [PEER, ACTOR, CREATED_1, MESSAGE_1]);
      },
      result: rowCount([{ read_at: CREATED_2 }])
    }
  ]);
  const service = identity(pool);

  const sent = await service.sendDirectMessage("access-a", PEER, {
    body: " hello "
  });
  const conversations = await service.listDirectConversations("access-a");
  const thread = await service.listDirectMessages("access-a", PEER, {
    limit: 1
  });
  const older = await service.listDirectMessages("access-a", PEER, {
    limit: 1,
    before: thread.nextBefore
  });
  const read = await service.markDirectMessagesRead(
    "access-a",
    PEER,
    MESSAGE_1
  );

  assert.deepEqual(Object.keys(sent), [
    "id",
    "senderUserId",
    "recipientUserId",
    "body",
    "readAt",
    "createdAt"
  ]);
  assert.equal(sent.body, "hello");
  assert.equal(conversations.conversations[0].peer.id, PEER);
  assert.equal(conversations.conversations[0].lastMessage.id, MESSAGE_2);
  assert.equal(conversations.conversations[0].unreadCount, 2);
  assert.deepEqual(thread.messages.map((message) => message.id), [MESSAGE_2]);
  assert.equal(thread.hasMore, true);
  assert.equal(thread.nextBefore, MESSAGE_2);
  assert.deepEqual(older.messages.map((message) => message.id), [MESSAGE_1]);
  assert.equal(older.hasMore, false);
  assert.deepEqual(read, { ok: true, readCount: 1, readAt: CREATED_2 });
  pool.assertDone();
});

test("adds social and direct unread counts to the personal center", async () => {
  const queries = [];
  const pool = {
    async query(sql, params = []) {
      const compact = sql.replace(/\s+/g, " ");
      queries.push(compact);
      if (/FROM sessions WHERE access_hash/.test(compact)) return session();
      if (/SELECT u\.id, u\.email/.test(compact)) {
        return rowCount([{
          id: ACTOR,
          email: "actor@example.com",
          phone: null,
          username: "中文",
          nickname: "Actor",
          avatar_url: "",
          bio: ""
        }]);
      }
      if (/FROM sessions s JOIN devices/.test(compact)) return rowCount();
      if (/FROM site_messages WHERE user_id/.test(compact)) return rowCount();
      if (/AS unread_messages/.test(compact)) {
        assert.deepEqual(params, [ACTOR]);
        return rowCount([{ followers: 3, following: 4, unread_messages: 5 }]);
      }
      throw new Error(`unexpected query: ${compact}`);
    }
  };
  let bridgedUsername = "";
  const service = identity(pool, {
    communityPersonalCenter: {
      async list(username) {
        bridgedUsername = username;
        return { notifications: [], interactions: [] };
      },
      async markRead() {
        return { ok: true };
      }
    }
  });

  const center = await service.getPersonalCenter("access-a");

  assert.equal(bridgedUsername, "zx_aaaaaaaaaaaa4aaa8aaaaaaaaaa");
  assert.deepEqual(center.social, { followers: 3, following: 4 });
  assert.equal(center.summary.unreadDirectMessages, 5);
  assert.equal(queries.some((sql) => /community_interactions/.test(sql)), false);
});
