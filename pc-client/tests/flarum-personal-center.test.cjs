"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createFlarumPersonalCenterClient
} = require("../identity/flarum-personal-center.cjs");

test("normalizes Flarum reminders and native interactions behind one interface", async () => {
  const calls = [];
  const client = createFlarumPersonalCenterClient({
    origin: "http://community",
    secret: "a".repeat(32),
    request: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      return {
        notifications: [
          {
            id: "12",
            type: "postLiked",
            actorUsername: "alice",
            discussionId: "42",
            discussionTitle: "统一入口",
            discussionSlug: "unified-entry",
            postNumber: 3,
            read: false,
            readAt: null,
            createdAt: "2026-07-31 08:00:00"
          }
        ],
        interactions: [
          {
            discussionId: "42",
            title: "统一入口",
            slug: "unified-entry",
            favorited: true,
            liked: true,
            updatedAt: "2026-07-31 08:01:00"
          }
        ]
      };
    }
  });

  const center = await client.list("user_1");
  assert.deepEqual(center.notifications, [
    {
      id: "12",
      source: "community",
      title: "alice 喜欢了你的回复",
      body: "统一入口",
      actionPath: "/d/42-unified-entry/3",
      read: false,
      readAt: null,
      createdAt: "2026-07-31T08:00:00.000Z"
    }
  ]);
  assert.deepEqual(center.interactions, [
    {
      discussionId: "42",
      title: "统一入口",
      path: "/d/42-unified-entry",
      favorited: true,
      liked: true,
      updatedAt: "2026-07-31T08:01:00.000Z"
    }
  ]);
  assert.equal(calls[0].body.action, "list");
  assert.equal(
    calls[0].options.headers["X-AIHub-Community-Secret"],
    "a".repeat(32)
  );
});

test("marks only a numeric reminder for the authenticated forum username", async () => {
  const calls = [];
  const client = createFlarumPersonalCenterClient({
    origin: "http://community",
    secret: "b".repeat(32),
    request: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return { ok: true };
    }
  });

  await client.markRead("user_1", "19");
  assert.deepEqual(calls, [
    {
      action: "mark-read",
      username: "user_1",
      notificationId: "19"
    }
  ]);
  await assert.rejects(
    () => client.markRead("user_1", "../19"),
    /标识无效/
  );
});
