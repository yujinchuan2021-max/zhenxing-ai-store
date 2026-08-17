"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
const {
  DomainError,
  createIdentityCommunity
} = require("./identity-community.cjs");
const {
  createFlarumPersonalCenterClient
} = require("./flarum-personal-center.cjs");
const {
  createActiveCatalogProductSource
} = require("../shared/active-catalog-products.cjs");
const {
  registrationMailSettings
} = require("./smtp-config.cjs");
const { identitySchemaMode } = require("./schema-mode.cjs");
const {
  IdentityMigrationDatabaseError,
  initializeIdentitySchema
} = require("./migration-database-contract.cjs");
const { ResourceSubmissionError } = require("../admin/resource-submissions.cjs");
const {
  createFixedWindowSubmissionRateLimit,
  createIdentityResourceSubmissionStore,
  createResourceSubmissionOwnerAdapter
} = require("./resource-submissions.cjs");
const {
  createFixedWorkflowReviewerAuthenticator,
  createIdentityWorkflowStoreGateway
} = require("./workflow-store.cjs");
const {
  createFlarumPostResolver,
  createPublicIdentityResolver,
  createWorkflowDependencyResolver,
  hasCanonicalWorkflowLicense
} = require("./workflow-resolvers.cjs");

const host = process.env.AIHUB_IDENTITY_HOST || "127.0.0.1";
const port = Number(process.env.AIHUB_IDENTITY_PORT || 4180);
const schemaMode = identitySchemaMode();
const pool = new Pool({
  connectionString:
    process.env.AIHUB_IDENTITY_DATABASE_URL ||
    "postgres://aihub:aihub-local-only@127.0.0.1:5432/aihub"
});
const mailSettings = registrationMailSettings(process.env);
const mailer = mailSettings.enabled
  ? nodemailer.createTransport(mailSettings.transportOptions)
  : null;

function requireRegistrationMail() {
  if (!mailer) {
    throw new DomainError(
      "REGISTRATION_UNAVAILABLE",
      "注册暂未开放，请稍后再试",
      503
    );
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  });
  response.end(`${JSON.stringify(value)}\n`);
}

async function readJson(request, maximumBytes = 512 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) {
      throw new DomainError("INVALID_INPUT", "请求内容过大", 413);
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new Error();
    }
    return value;
  } catch {
    throw new DomainError("INVALID_INPUT", "请求内容不是有效 JSON");
  }
}

function queryObject(url) {
  const query = Object.create(null);
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(query, key)) {
      throw new DomainError("INVALID_INPUT", "查询参数无效");
    }
    query[key] = value;
  }
  return query;
}

function accessToken(request) {
  const value = String(request.headers.authorization || "");
  const match = value.match(/^Bearer ([A-Za-z0-9_-]{20,})$/);
  return match ? match[1] : "";
}

function decodedPathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new DomainError("INVALID_INPUT", "路径参数无效");
  }
}

function contextFor(request) {
  return {
    remoteAddress: request.socket.remoteAddress || "unknown"
  };
}

function validInternalCommunitySecret(request) {
  const expected = Buffer.from(
    process.env.AIHUB_COMMUNITY_INTERNAL_SECRET || ""
  );
  const received = Buffer.from(
    String(request.headers["x-aihub-community-secret"] || "")
  );
  return (
    expected.length >= 32 &&
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
}

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await initializeIdentitySchema({ schemaMode, pool, schema });
}

const communityInternalOrigin = String(
  process.env.AIHUB_FORUM_INTERNAL_URL || ""
).trim();
const communityInternalSecret = String(
  process.env.AIHUB_COMMUNITY_INTERNAL_SECRET || ""
);
const communityPersonalCenter = communityInternalOrigin
  ? createFlarumPersonalCenterClient({
      origin: communityInternalOrigin,
      secret: communityInternalSecret
    })
  : null;
const activeCatalogProducts = createActiveCatalogProductSource({
  catalogUrl:
    process.env.AIHUB_CATALOG_URL ||
    "http://127.0.0.1:4173/catalog-v1.json",
  sourceMode: process.env.AIHUB_CATALOG_SOURCE_MODE || "raw-catalog",
  trustedKeys:
    process.env.AIHUB_CATALOG_SOURCE_MODE === "signed-internal-admin"
      ? JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "..", "catalog", "channel.json"),
            "utf8"
          )
        ).trustedKeys
      : undefined,
  highestCatalogVersion: Number(
    process.env.AIHUB_CATALOG_HIGHEST_VERSION || 0
  ),
  highestCatalogSha256:
    process.env.AIHUB_CATALOG_HIGHEST_SHA256 || "",
  cacheTtlMs: Number(process.env.AIHUB_CATALOG_CACHE_TTL_MS || 15_000)
});

const identity = createIdentityCommunity({
  pool,
  communityPersonalCenter,
  publicOrigin:
    process.env.AIHUB_IDENTITY_PUBLIC_ORIGIN ||
    `http://127.0.0.1:${port}`,
  publishedProductIds: () => activeCatalogProducts.enabledProductIds(),
  sendVerification: async ({ email, code, expiresAt, purpose }) => {
    requireRegistrationMail();
    const changingEmail = purpose === "email-change";
    await mailer.sendMail({
      from: mailSettings.from,
      to: email,
      subject: changingEmail ? "枕星AI助手 更换邮箱验证码" : "枕星AI助手 注册验证码",
      text: `你的枕星AI助手 ${changingEmail ? "更换邮箱" : "注册"}验证码是 ${code}。验证码将在 ${expiresAt.toISOString()} 过期。`
    });
  }
});
const resourceSubmissionEnabled =
  process.env.AIHUB_RESOURCE_SUBMISSIONS_ENABLED === "1" &&
  process.env.AIHUB_RESOURCE_SUBMISSIONS_SCHEMA_VERSION === "1";
const workflowStoreRequested =
  process.env.AIHUB_WORKFLOW_STORE_ENABLED === "1" &&
  process.env.AIHUB_WORKFLOW_STORE_SCHEMA_VERSION === "1";
const workflowPublicStoreRequested =
  process.env.AIHUB_WORKFLOW_PUBLIC_STORE_ENABLED === "1" &&
  process.env.AIHUB_WORKFLOW_STORE_SCHEMA_VERSION === "1";
const workflowSubmissionLookupRequested =
  process.env.AIHUB_WORKFLOW_SUBMISSION_LOOKUP_ENABLED === "1";
function workflowReviewerSecret() {
  if (!workflowStoreRequested) return "";
  const secretFile = String(process.env.AIHUB_WORKFLOW_REVIEW_SECRET_FILE || "");
  if (secretFile !== "/run/secrets/workflow_review_secret") return "";
  try {
    const value = fs.readFileSync(secretFile, "utf8");
    return value.length >= 32 && value.length <= 512 && !/[\r\n\p{Cc}\p{Cf}]/u.test(value)
      ? value
      : "";
  } catch {
    return "";
  }
}
let workflowReviewerAuthenticator;
try {
  workflowReviewerAuthenticator = createFixedWorkflowReviewerAuthenticator({
    secret: workflowReviewerSecret(),
    reviewerIdentityId: process.env.AIHUB_WORKFLOW_REVIEWER_ID
  });
} catch {
  workflowReviewerAuthenticator = undefined;
}
const workflowPublicIdentity = createPublicIdentityResolver({ pool });
const workflowDependencyResolver = createWorkflowDependencyResolver({
  activeCatalogSource: activeCatalogProducts
});
const workflowStore = createIdentityWorkflowStoreGateway({
  pool,
  workflowStoreEnabled: workflowStoreRequested,
  workflowPublicStoreEnabled: workflowPublicStoreRequested,
  resourceSubmissionsEnabled: resourceSubmissionEnabled,
  workflowSubmissionLookupEnabled: workflowSubmissionLookupRequested,
  resolveOwnerIdentity: async (request) =>
    (await identity.me(request.accessToken || "")).user.id,
  authenticateReviewer: workflowReviewerAuthenticator,
  resolvePublicIdentity: workflowPublicIdentity,
  hasCanonicalDependency: workflowDependencyResolver,
  hasCanonicalLicense: hasCanonicalWorkflowLicense,
  hasCommunityPost: createFlarumPostResolver(),
  isCanonicalDependencyReady: () => activeCatalogProducts.readiness().ready,
  prepareCanonicalDependencies: () => activeCatalogProducts.warm()
});
const resourceSubmissionStore = createIdentityResourceSubmissionStore({
  pool,
  enabled: resourceSubmissionEnabled,
  rateLimit: createFixedWindowSubmissionRateLimit(),
  workflowSubmissionLookupEnabled: workflowStore.submissionLookupEnabled,
  lookupPublishedWorkflowRelease: (reference) =>
    workflowStore.lookupPublishedRelease(reference)
});
const resourceSubmissionOwner = createResourceSubmissionOwnerAdapter({
  store: resourceSubmissionStore,
  resolveIdentity: async (request) => {
    const current = await identity.me(request.accessToken || "");
    return {
      identityId: current.user.id,
      displayName: current.user.profile.nickname
    };
  }
});

let ready = false;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const context = contextFor(request);
  try {
    const avatarMatch = url.pathname.match(
      /^\/v1\/avatars\/([0-9a-f-]{36})$/i
    );
    if (request.method === "GET" && avatarMatch) {
      const avatar = await identity.getAvatar(avatarMatch[1]);
      if (!avatar) {
        sendJson(response, 404, { error: "NOT_FOUND", message: "头像不存在" });
        return;
      }
      response.writeHead(200, {
        "Content-Type": avatar.mime_type,
        "Content-Length": avatar.content.length,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "cross-origin"
      });
      response.end(avatar.content);
      return;
    }
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/ready") {
      if (!ready) {
        sendJson(response, 503, { status: "starting" });
        return;
      }
      await pool.query("SELECT 1");
      sendJson(response, 200, { status: "ready" });
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/registration/challenges"
    ) {
      requireRegistrationMail();
      sendJson(
        response,
        201,
        await identity.requestRegistrationCode(await readJson(request), context)
      );
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/registration/complete"
    ) {
      sendJson(response, 201, await identity.register(await readJson(request), context));
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/sessions/login") {
      sendJson(response, 200, await identity.login(await readJson(request), context));
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/sessions/refresh") {
      sendJson(response, 200, await identity.refresh(await readJson(request), context));
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/sessions/logout") {
      sendJson(response, 200, await identity.logout(accessToken(request), context));
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/me") {
      sendJson(response, 200, await identity.me(accessToken(request)));
      return;
    }
    if (url.pathname.startsWith("/v1/community/workflow-store/")) {
      let workflowRequest;
      try {
        workflowRequest = {
          method: request.method,
          path: url.pathname,
          accessToken: accessToken(request),
          headers: request.headers,
          query: queryObject(url),
          ...(request.method === "POST"
            ? { body: await readJson(request, 128 * 1024) }
            : {})
        };
      } catch (error) {
        console.error("Identity workflow request parsing failed", error);
        sendJson(response, 400, {
          error: {
            code: "INVALID_INPUT",
            status: 400,
            messageKey: "workflow.store.invalid"
          }
        });
        return;
      }
      const result = await workflowStore.handle(workflowRequest);
      sendJson(response, result.status, result.body);
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/v1/resource-submissions/capability"
    ) {
      sendJson(response, 200, resourceSubmissionOwner.capability());
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/v1/me/resource-submissions"
    ) {
      sendJson(
        response,
        200,
        await resourceSubmissionOwner.list(
          { accessToken: accessToken(request) },
          {
            limit: url.searchParams.get("limit"),
            offset: url.searchParams.get("offset")
          }
        )
      );
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/me/resource-submissions"
    ) {
      sendJson(
        response,
        201,
        await resourceSubmissionOwner.create({
          accessToken: accessToken(request),
          headers: request.headers,
          body: await readJson(request)
        })
      );
      return;
    }
    const resourceSubmissionActionMatch = url.pathname.match(
      /^\/v1\/me\/resource-submissions\/([0-9a-f-]{36})\/actions$/i
    );
    if (request.method === "POST" && resourceSubmissionActionMatch) {
      sendJson(
        response,
        200,
        await resourceSubmissionOwner.mutate(
          {
            accessToken: accessToken(request),
            body: await readJson(request)
          },
          resourceSubmissionActionMatch[1]
        )
      );
      return;
    }
    const resourceSubmissionMatch = url.pathname.match(
      /^\/v1\/me\/resource-submissions\/([0-9a-f-]{36})$/i
    );
    if (request.method === "GET" && resourceSubmissionMatch) {
      sendJson(
        response,
        200,
        await resourceSubmissionOwner.get(
          { accessToken: accessToken(request) },
          resourceSubmissionMatch[1]
        )
      );
      return;
    }
    if (request.method === "PUT" && url.pathname === "/v1/me/profile") {
      sendJson(
        response,
        200,
        await identity.updateProfile(accessToken(request), await readJson(request))
      );
      return;
    }
    if (request.method === "PUT" && url.pathname === "/v1/me/avatar") {
      sendJson(
        response,
        200,
        await identity.updateAvatar(
          accessToken(request),
          await readJson(request),
          context
        )
      );
      return;
    }
    if (request.method === "PUT" && url.pathname === "/v1/me/phone") {
      sendJson(
        response,
        200,
        await identity.updatePhone(
          accessToken(request),
          await readJson(request),
          context
        )
      );
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/me/email-change/challenges"
    ) {
      requireRegistrationMail();
      sendJson(
        response,
        201,
        await identity.requestEmailChange(
          accessToken(request),
          await readJson(request),
          context
        )
      );
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/me/email-change/complete"
    ) {
      sendJson(
        response,
        200,
        await identity.completeEmailChange(
          accessToken(request),
          await readJson(request),
          context
        )
      );
      return;
    }
    if (request.method === "PUT" && url.pathname === "/v1/me/password") {
      sendJson(
        response,
        200,
        await identity.changePassword(
          accessToken(request),
          await readJson(request),
          context
        )
      );
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/v1/me/personal-center"
    ) {
      sendJson(
        response,
        200,
        await identity.getPersonalCenter(accessToken(request))
      );
      return;
    }
    const publicUserMatch = url.pathname.match(
      /^\/v1\/users\/by-username\/([^/]+)$/
    );
    if (request.method === "GET" && publicUserMatch) {
      sendJson(
        response,
        200,
        await identity.getPublicUserByUsername(
          accessToken(request),
          decodedPathSegment(publicUserMatch[1])
        )
      );
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/me/followers") {
      sendJson(
        response,
        200,
        await identity.listFollowers(accessToken(request), {
          limit: url.searchParams.get("limit"),
          offset: url.searchParams.get("offset")
        })
      );
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/me/following") {
      sendJson(
        response,
        200,
        await identity.listFollowing(accessToken(request), {
          limit: url.searchParams.get("limit"),
          offset: url.searchParams.get("offset")
        })
      );
      return;
    }
    const followingMatch = url.pathname.match(
      /^\/v1\/me\/following\/([0-9a-f-]{36})$/i
    );
    if (request.method === "PUT" && followingMatch) {
      sendJson(
        response,
        200,
        await identity.followUser(accessToken(request), followingMatch[1])
      );
      return;
    }
    if (request.method === "DELETE" && followingMatch) {
      sendJson(
        response,
        200,
        await identity.unfollowUser(accessToken(request), followingMatch[1])
      );
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/v1/me/direct-messages"
    ) {
      sendJson(
        response,
        200,
        await identity.listDirectConversations(
          accessToken(request),
          {
            limit: url.searchParams.get("limit"),
            offset: url.searchParams.get("offset")
          }
        )
      );
      return;
    }
    const directMessageReadMatch = url.pathname.match(
      /^\/v1\/me\/direct-messages\/([0-9a-f-]{36})\/read$/i
    );
    if (request.method === "PUT" && directMessageReadMatch) {
      const input = await readJson(request);
      sendJson(
        response,
        200,
        await identity.markDirectMessagesRead(
          accessToken(request),
          directMessageReadMatch[1],
          input.throughMessageId
        )
      );
      return;
    }
    const directMessagePeerMatch = url.pathname.match(
      /^\/v1\/me\/direct-messages\/([0-9a-f-]{36})$/i
    );
    if (request.method === "GET" && directMessagePeerMatch) {
      sendJson(
        response,
        200,
        await identity.listDirectMessages(
          accessToken(request),
          directMessagePeerMatch[1],
          {
            limit: url.searchParams.get("limit"),
            before: url.searchParams.get("before") || ""
          }
        )
      );
      return;
    }
    if (request.method === "POST" && directMessagePeerMatch) {
      sendJson(
        response,
        201,
        await identity.sendDirectMessage(
          accessToken(request),
          directMessagePeerMatch[1],
          await readJson(request)
        )
      );
      return;
    }
    const notificationMatch = url.pathname.match(
      /^\/v1\/me\/notifications\/(account|community)\/([0-9a-f-]{1,36})\/read$/i
    );
    if (request.method === "PUT" && notificationMatch) {
      sendJson(
        response,
        200,
        await identity.markPersonalCenterNotificationRead(
          accessToken(request),
          notificationMatch[1].toLowerCase(),
          notificationMatch[2]
        )
      );
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/me/messages") {
      sendJson(response, 200, {
        messages: await identity.listSiteMessages(accessToken(request), {
          limit: url.searchParams.get("limit")
        })
      });
      return;
    }
    const messageMatch = url.pathname.match(
      /^\/v1\/me\/messages\/([0-9a-f-]{36})\/read$/i
    );
    if (request.method === "PUT" && messageMatch) {
      sendJson(
        response,
        200,
        await identity.markSiteMessageRead(
          accessToken(request),
          messageMatch[1]
        )
      );
      return;
    }
    if (
      request.method === "GET" &&
      url.pathname === "/v1/me/community-interactions"
    ) {
      sendJson(response, 200, {
        interactions: await identity.listCommunityInteractions(
          accessToken(request)
        )
      });
      return;
    }
    const interactionMatch = url.pathname.match(
      /^\/v1\/me\/community-interactions\/([0-9]{1,20})$/
    );
    if (request.method === "PUT" && interactionMatch) {
      sendJson(
        response,
        200,
        await identity.setCommunityInteraction(
          accessToken(request),
          interactionMatch[1],
          await readJson(request)
        )
      );
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/community/handoffs"
    ) {
      sendJson(
        response,
        201,
        await identity.createCommunityHandoff(accessToken(request))
      );
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/v1/internal/community/handoffs/redeem"
    ) {
      if (!validInternalCommunitySecret(request)) {
        throw new DomainError(
          "INTERNAL_AUTHENTICATION_FAILED",
          "内部服务认证失败",
          403
        );
      }
      sendJson(
        response,
        200,
        await identity.redeemCommunityHandoff(
          await readJson(request),
          context
        )
      );
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/sessions") {
      sendJson(response, 200, {
        sessions: await identity.listSessions(accessToken(request))
      });
      return;
    }
    const sessionMatch = url.pathname.match(/^\/v1\/sessions\/([0-9a-f-]{36})$/i);
    if (request.method === "DELETE" && sessionMatch) {
      sendJson(
        response,
        200,
        await identity.revokeSession(
          accessToken(request),
          sessionMatch[1],
          context
        )
      );
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/discussions") {
      sendJson(response, 200, {
        discussions: await identity.listDiscussions({
          productId: url.searchParams.get("productId") || "",
          limit: url.searchParams.get("limit")
        })
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/v1/discussions") {
      sendJson(
        response,
        201,
        await identity.createDiscussion(
          accessToken(request),
          await readJson(request)
        )
      );
      return;
    }
    const discussionMatch = url.pathname.match(
      /^\/v1\/discussions\/([0-9a-f-]{36})$/i
    );
    if (request.method === "GET" && discussionMatch) {
      sendJson(response, 200, await identity.getDiscussion(discussionMatch[1]));
      return;
    }
    const replyMatch = url.pathname.match(
      /^\/v1\/discussions\/([0-9a-f-]{36})\/replies$/i
    );
    if (request.method === "POST" && replyMatch) {
      sendJson(
        response,
        201,
        await identity.reply(
          accessToken(request),
          replyMatch[1],
          await readJson(request)
        )
      );
      return;
    }
    sendJson(response, 404, { error: "NOT_FOUND", message: "接口不存在" });
  } catch (error) {
    if (
      !(error instanceof DomainError) &&
      !(error instanceof ResourceSubmissionError)
    ) {
      console.error("Identity request failed", error);
    }
    sendJson(response, error.status || 500, {
      error: error.code || "TEMPORARILY_UNAVAILABLE",
      message:
        error instanceof DomainError || error instanceof ResourceSubmissionError
          ? error.message
          : "服务暂时不可用，请稍后重试"
    });
  }
});

async function start() {
  try {
    if (schemaMode !== "external") await initializeDatabase();
    if (schemaMode === "migrate") {
      await pool.end();
      return;
    }
    void activeCatalogProducts.warm().catch(() => {});
    ready = true;
    server.listen(port, host, () => {
      console.log(`ZhenXing AI Assistant identity and community listening on ${host}:${port}`);
    });
  } catch (error) {
    if (error instanceof IdentityMigrationDatabaseError) {
      console.error(JSON.stringify({ error: error.code, status: error.status }));
    } else {
      console.error("Unable to initialize identity database", error);
    }
    await pool.end().catch(() => {});
    process.exitCode = 1;
  }
}

void start();

function shutdown() {
  const finish = () => pool.end().finally(() => process.exit(0));
  if (server.listening) server.close(finish);
  else finish();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
