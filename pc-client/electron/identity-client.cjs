"use strict";

function createIdentityClient({
  origin,
  request,
  vault,
  deviceId,
  deviceName
}) {
  const parsedOrigin = new URL(origin);
  if (
    parsedOrigin.origin !== origin ||
    !(
      parsedOrigin.protocol === "https:" ||
      (parsedOrigin.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(parsedOrigin.hostname))
    )
  ) {
    throw new Error("身份服务必须使用 HTTPS 或本机回环地址");
  }
  let accessToken = "";
  let accessExpiresAt = 0;
  let snapshot = { status: "anonymous" };

  async function call(pathname, options = {}) {
    return request(new URL(pathname, `${origin}/`).href, options);
  }

  function acceptSession(result) {
    if (
      !result?.user ||
      typeof result.accessToken !== "string" ||
      typeof result.refreshToken !== "string"
    ) {
      throw new Error("身份服务返回了无效会话");
    }
    accessToken = result.accessToken;
    accessExpiresAt = Date.parse(result.accessExpiresAt) || 0;
    vault.write({ refreshToken: result.refreshToken });
    snapshot = {
      status: "authenticated",
      user: result.user,
      sessionId: result.sessionId
    };
    return snapshot;
  }

  async function refresh() {
    const saved = vault.read();
    if (!saved?.refreshToken) {
      snapshot = { status: "anonymous" };
      return snapshot;
    }
    try {
      return acceptSession(
        await call("/v1/sessions/refresh", {
          method: "POST",
          body: { refreshToken: saved.refreshToken }
        })
      );
    } catch (error) {
      if ([401, 403].includes(error?.status)) {
        vault.clear();
        accessToken = "";
        accessExpiresAt = 0;
        snapshot = { status: "anonymous" };
        return snapshot;
      }
      throw error;
    }
  }

  async function bearerCall(pathname, options = {}) {
    if (!accessToken || accessExpiresAt <= Date.now() + 10_000) {
      await refresh();
    }
    if (!accessToken) {
      const error = new Error("请先登录");
      error.code = "SESSION_REVOKED";
      error.status = 401;
      throw error;
    }
    try {
      return await call(pathname, {
        ...options,
        accessToken
      });
    } catch (error) {
      if (error?.status !== 401) throw error;
      await refresh();
      if (!accessToken) throw error;
      return call(pathname, { ...options, accessToken });
    }
  }

  return {
    async requestRegistrationCode(email) {
      return call("/v1/registration/challenges", {
        method: "POST",
        body: { email }
      });
    },
    async register(input) {
      return acceptSession(
        await call("/v1/registration/complete", {
          method: "POST",
          body: {
            ...input,
            deviceId,
            deviceName
          }
        })
      );
    },
    async login(input) {
      return acceptSession(
        await call("/v1/sessions/login", {
          method: "POST",
          body: {
            ...input,
            deviceId,
            deviceName
          }
        })
      );
    },
    async current() {
      if (snapshot.status === "authenticated" && accessExpiresAt > Date.now()) {
        return snapshot;
      }
      return refresh();
    },
    async logout() {
      try {
        if (accessToken) {
          await call("/v1/sessions/logout", {
            method: "POST",
            accessToken
          });
        }
      } finally {
        vault.clear();
        accessToken = "";
        accessExpiresAt = 0;
        snapshot = { status: "anonymous" };
      }
      return snapshot;
    },
    async listSessions() {
      return (await bearerCall("/v1/sessions")).sessions;
    },
    async revokeSession(sessionId) {
      const result = await bearerCall(`/v1/sessions/${sessionId}`, {
        method: "DELETE"
      });
      if (result.revokedCurrent) {
        vault.clear();
        accessToken = "";
        accessExpiresAt = 0;
        snapshot = { status: "anonymous" };
      }
      return result;
    },
    async updateProfile(input) {
      const result = await bearerCall("/v1/me/profile", {
        method: "PUT",
        body: input
      });
      snapshot = { ...snapshot, user: result.user };
      return snapshot;
    },
    async createCommunityHandoff() {
      return bearerCall("/v1/community/handoffs", {
        method: "POST",
        body: {}
      });
    }
  };
}

module.exports = {
  createIdentityClient
};
