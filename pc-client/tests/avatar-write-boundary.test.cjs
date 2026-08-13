"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createIdentityCommunity } = require("../identity/identity-community.cjs");

test("profile updates reject avatar URLs and leave avatar changes to the upload route", async () => {
  const calls = [];
  const pool = {
    async query(sql) {
      calls.push(sql);
      if (/FROM\s+sessions\s+WHERE\s+access_hash/.test(sql)) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "session-1",
              user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              device_id: "device-1"
            }
          ]
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    }
  };
  const identity = createIdentityCommunity({
    pool,
    publicOrigin: "http://127.0.0.1:4180",
    publishedProductIds: async () => new Set(),
    sendVerification: async () => {}
  });

  await assert.rejects(
    identity.updateProfile("access-token", {
      nickname: "测试用户",
      bio: "",
      avatarUrl: "https://example.invalid/avatar.png"
    }),
    /头像仅支持上传接口/
  );
  assert.equal(calls.length, 1);
});
