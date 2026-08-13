"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  clearCommunitySessionCookies
} = require("../electron/community-session.cjs");

test("clears only the persisted community cookies when a local identity ends", async () => {
  const calls = [];
  await clearCommunitySessionCookies({
    fromPartition(partition) {
      calls.push({ type: "partition", partition });
      return {
        clearStorageData(options) {
          calls.push({ type: "clear", options });
          return Promise.resolve();
        }
      };
    }
  });

  assert.deepEqual(calls, [
    { type: "partition", partition: "persist:aihub-community" },
    { type: "clear", options: { storages: ["cookies"] } }
  ]);
});

test("wires community-cookie clearing into logout and current-session revocation", () => {
  const main = fs.readFileSync(
    path.join(__dirname, "..", "electron", "main.cjs"),
    "utf8"
  );
  assert.match(main, /clearCommunitySessionCookies\(session\)/);
  assert.match(main, /result\.revokedCurrent\)\s*\{\s*await clearCommunitySessionCookies\(session\)/);
});
