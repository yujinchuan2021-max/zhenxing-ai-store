"use strict";

function queryPath(pathname, values = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  const suffix = query.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

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

  async function requireResourceSubmissionCapability() {
    const capability = await call("/v1/resource-submissions/capability");
    if (capability?.enabled !== true) {
      const error = new Error("resource submission is unavailable");
      error.code = "FEATURE_DISABLED";
      error.status = 503;
      throw error;
    }
    return capability;
  }

  async function requireWorkflowStoreCapability() {
    const capability = await call("/v1/community/workflow-store/capability");
    if (capability?.enabled !== true) {
      const error = new Error("workflow store is unavailable");
      error.code = "FEATURE_DISABLED";
      error.status = 503;
      throw error;
    }
    return capability;
  }

  async function requireWorkflowPublicCapability() {
    const capability = await call("/v1/community/workflow-store/public/capability");
    if (capability?.enabled !== true) {
      const error = new Error("workflow public store is unavailable");
      error.code = "FEATURE_DISABLED";
      error.status = 503;
      throw error;
    }
    return capability;
  }

  async function workflowMutation(pathname, idempotencyKey, body) {
    await requireWorkflowStoreCapability();
    return bearerCall(pathname, { method: "POST", idempotencyKey, body });
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
    async updateAvatar(input) {
      const result = await bearerCall("/v1/me/avatar", {
        method: "PUT",
        body: input
      });
      snapshot = { ...snapshot, user: result.user };
      return snapshot;
    },
    async updatePhone(input) {
      const result = await bearerCall("/v1/me/phone", {
        method: "PUT",
        body: input
      });
      snapshot = { ...snapshot, user: result.user };
      return snapshot;
    },
    async requestEmailChange(input) {
      return bearerCall("/v1/me/email-change/challenges", {
        method: "POST",
        body: input
      });
    },
    async completeEmailChange(input) {
      const result = await bearerCall("/v1/me/email-change/complete", {
        method: "POST",
        body: input
      });
      snapshot = { ...snapshot, user: result.user };
      return snapshot;
    },
    async changePassword(input) {
      return bearerCall("/v1/me/password", {
        method: "PUT",
        body: input
      });
    },
    async getPersonalCenter() {
      return bearerCall("/v1/me/personal-center");
    },
    async getResourceSubmissionCapability() {
      return call("/v1/resource-submissions/capability");
    },
    async listMyResourceSubmissions(options = {}) {
      await requireResourceSubmissionCapability();
      return bearerCall(queryPath("/v1/me/resource-submissions", options));
    },
    async getMyResourceSubmission(submissionId) {
      await requireResourceSubmissionCapability();
      return bearerCall(
        `/v1/me/resource-submissions/${encodeURIComponent(submissionId)}`
      );
    },
    async createMyResourceSubmission(idempotencyKey, submission) {
      await requireResourceSubmissionCapability();
      return bearerCall("/v1/me/resource-submissions", {
        method: "POST",
        idempotencyKey,
        body: submission
      });
    },
    async mutateMyResourceSubmission(submissionId, input) {
      await requireResourceSubmissionCapability();
      return bearerCall(
        `/v1/me/resource-submissions/${encodeURIComponent(submissionId)}/actions`,
        { method: "POST", body: input }
      );
    },
    async getWorkflowStoreCapability() {
      return call("/v1/community/workflow-store/capability");
    },
    async getWorkflowPublicCapability() {
      return call("/v1/community/workflow-store/public/capability");
    },
    async listPublicWorkflows(options = {}) {
      await requireWorkflowPublicCapability();
      return call(queryPath("/v1/community/workflow-store/public/list", options));
    },
    async getPublicWorkflow(reference) {
      await requireWorkflowPublicCapability();
      return call(queryPath("/v1/community/workflow-store/public/release", reference));
    },
    async resolvePublicWorkflow(reference) {
      await requireWorkflowPublicCapability();
      return call(queryPath("/v1/community/workflow-store/public/release", reference));
    },
    async createMyWorkflowDraft(idempotencyKey, draft) {
      return workflowMutation(
        "/v1/community/workflow-store/owner/drafts",
        idempotencyKey,
        draft
      );
    },
    async listMyWorkflowDrafts(options = {}) {
      await requireWorkflowStoreCapability();
      return bearerCall(queryPath("/v1/community/workflow-store/owner/drafts", options));
    },
    async getMyWorkflowDraft(workflowId) {
      await requireWorkflowStoreCapability();
      return bearerCall(queryPath("/v1/community/workflow-store/owner/draft", { workflowId }));
    },
    async updateMyWorkflowDraft(idempotencyKey, input) {
      return workflowMutation(
        "/v1/community/workflow-store/owner/drafts/update",
        idempotencyKey,
        input
      );
    },
    async submitMyWorkflowDraft(idempotencyKey, input) {
      return workflowMutation(
        "/v1/community/workflow-store/owner/drafts/submit",
        idempotencyKey,
        input
      );
    },
    async withdrawMyWorkflowDraft(idempotencyKey, input) {
      return workflowMutation(
        "/v1/community/workflow-store/owner/drafts/withdraw",
        idempotencyKey,
        input
      );
    },
    async attachMyWorkflowPost(idempotencyKey, input) {
      return workflowMutation(
        "/v1/community/workflow-store/owner/posts/attach",
        idempotencyKey,
        input
      );
    },
    async detachMyWorkflowPost(idempotencyKey, input) {
      return workflowMutation(
        "/v1/community/workflow-store/owner/posts/detach",
        idempotencyKey,
        input
      );
    },
    async reportWorkflowRelease(idempotencyKey, input) {
      return workflowMutation(
        "/v1/community/workflow-store/owner/reports",
        idempotencyKey,
        input
      );
    },
    async getIdentityUserByUsername(username) {
      return bearerCall(
        `/v1/users/by-username/${encodeURIComponent(username)}`
      );
    },
    async listIdentityFollowers(options = {}) {
      return bearerCall(queryPath("/v1/me/followers", options));
    },
    async listIdentityFollowing(options = {}) {
      return bearerCall(queryPath("/v1/me/following", options));
    },
    async followIdentityUser(userId) {
      return bearerCall(
        `/v1/me/following/${encodeURIComponent(userId)}`,
        { method: "PUT", body: {} }
      );
    },
    async unfollowIdentityUser(userId) {
      return bearerCall(
        `/v1/me/following/${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
    },
    async listDirectConversations(options = {}) {
      return bearerCall(queryPath("/v1/me/direct-messages", options));
    },
    async listDirectMessages(peerUserId, options = {}) {
      return bearerCall(
        queryPath(
          `/v1/me/direct-messages/${encodeURIComponent(peerUserId)}`,
          options
        )
      );
    },
    async sendDirectMessage(peerUserId, input) {
      return bearerCall(
        `/v1/me/direct-messages/${encodeURIComponent(peerUserId)}`,
        { method: "POST", body: input }
      );
    },
    async markDirectMessagesRead(peerUserId, throughMessageId) {
      return bearerCall(
        `/v1/me/direct-messages/${encodeURIComponent(peerUserId)}/read`,
        { method: "PUT", body: { throughMessageId } }
      );
    },
    async markPersonalCenterNotificationRead(source, notificationId) {
      return bearerCall(
        `/v1/me/notifications/${encodeURIComponent(source)}/${encodeURIComponent(notificationId)}/read`,
        {
          method: "PUT",
          body: {}
        }
      );
    },
    async listMessages() {
      return (await bearerCall("/v1/me/messages")).messages;
    },
    async markMessageRead(messageId) {
      return bearerCall(`/v1/me/messages/${messageId}/read`, {
        method: "PUT",
        body: {}
      });
    },
    async listCommunityInteractions() {
      return (
        await bearerCall("/v1/me/community-interactions")
      ).interactions;
    },
    async setCommunityInteraction(discussionId, input) {
      return bearerCall(
        `/v1/me/community-interactions/${encodeURIComponent(discussionId)}`,
        {
          method: "PUT",
          body: input
        }
      );
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
