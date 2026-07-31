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

const host = process.env.AIHUB_IDENTITY_HOST || "127.0.0.1";
const port = Number(process.env.AIHUB_IDENTITY_PORT || 4180);
const pool = new Pool({
  connectionString:
    process.env.AIHUB_IDENTITY_DATABASE_URL ||
    "postgres://aihub:aihub-local-only@127.0.0.1:5432/aihub"
});
const mailer = nodemailer.createTransport({
  host: process.env.AIHUB_SMTP_HOST || "127.0.0.1",
  port: Number(process.env.AIHUB_SMTP_PORT || 1025),
  secure: false
});

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

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 512 * 1024) {
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

function accessToken(request) {
  const value = String(request.headers.authorization || "");
  const match = value.match(/^Bearer ([A-Za-z0-9_-]{20,})$/);
  return match ? match[1] : "";
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
  await pool.query(schema);
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

const identity = createIdentityCommunity({
  pool,
  communityPersonalCenter,
  publicOrigin:
    process.env.AIHUB_IDENTITY_PUBLIC_ORIGIN ||
    `http://127.0.0.1:${port}`,
  catalogFile:
    process.env.AIHUB_CATALOG_FILE ||
    path.resolve(__dirname, "..", "admin", "published", "catalog-v1.json"),
  sendVerification: async ({ email, code, expiresAt, purpose }) => {
    const changingEmail = purpose === "email-change";
    await mailer.sendMail({
      from: process.env.AIHUB_MAIL_FROM || "AI Hub <no-reply@aihub.local>",
      to: email,
      subject: changingEmail ? "AI Hub 更换邮箱验证码" : "AI Hub 注册验证码",
      text: `你的 AI Hub ${changingEmail ? "更换邮箱" : "注册"}验证码是 ${code}。验证码将在 ${expiresAt.toISOString()} 过期。`
    });
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
    if (!(error instanceof DomainError)) {
      console.error("Identity request failed", error);
    }
    sendJson(response, error.status || 500, {
      error: error.code || "TEMPORARILY_UNAVAILABLE",
      message:
        error instanceof DomainError
          ? error.message
          : "服务暂时不可用，请稍后重试"
    });
  }
});

initializeDatabase()
  .then(() => {
    ready = true;
    server.listen(port, host, () => {
      console.log(`AI Hub identity and community listening on ${host}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Unable to initialize identity database", error);
    process.exitCode = 1;
  });

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
