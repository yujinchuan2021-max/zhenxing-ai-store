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
