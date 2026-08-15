"use strict";

const crypto = require("node:crypto");
const { parseAvatarDataUrl } = require("../shared/avatar-image.cjs");
const {
  digestCredential,
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  randomCredential,
  validatePassword,
  verificationCode,
  verifyPassword
} = require("../shared/identity-security.cjs");

const ACCESS_LIFETIME_MS = 15 * 60 * 1000;
const REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const CHALLENGE_LIFETIME_MS = 10 * 60 * 1000;
const COMMUNITY_HANDOFF_LIFETIME_MS = 60 * 1000;
const DIRECT_MESSAGE_RATE_LIMIT_PER_MINUTE = 30;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class DomainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function uuid() {
  return crypto.randomUUID();
}

function boundedText(value, field, minimum, maximum) {
  const text = String(value || "").trim();
  if (text.length < minimum || text.length > maximum) {
    throw new DomainError(
      "INVALID_INPUT",
      `${field}长度必须为 ${minimum}-${maximum} 个字符`
    );
  }
  return text;
}

function boundedLimit(value, maximum = 100, fallback = 50) {
  return Math.min(maximum, Math.max(1, Number(value) || fallback));
}

function boundedOffset(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function uuidValue(value, field = "用户标识") {
  const id = String(value || "").trim();
  if (!UUID_PATTERN.test(id)) {
    throw new DomainError("INVALID_INPUT", `${field}无效`);
  }
  return id;
}

function normalizedPhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return { phone: "", normalized: "" };
  const compact = raw.replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]{6,20}$/.test(compact)) {
    throw new DomainError("INVALID_INPUT", "手机号格式无效");
  }
  return {
    phone: compact,
    normalized: compact.startsWith("+") ? compact : `+${compact}`
  };
}

function emailValue(value) {
  try {
    return normalizeEmail(value);
  } catch {
    throw new DomainError("INVALID_INPUT", "邮箱格式无效");
  }
}

function resolvedAvatarUrl(value, publicOrigin) {
  const avatarUrl = String(value || "");
  return avatarUrl.startsWith("/v1/avatars/")
    ? new URL(avatarUrl, `${publicOrigin}/`).href
    : avatarUrl;
}

function rowUser(row, publicOrigin) {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone || "",
    username: row.username,
    profile: {
      nickname: row.nickname,
      avatarUrl: resolvedAvatarUrl(row.avatar_url, publicOrigin),
      bio: row.bio || ""
    }
  };
}

function publicUserRow(row, publicOrigin) {
  return {
    id: row.id,
    username: row.username,
    profile: {
      nickname: row.nickname,
      avatarUrl: resolvedAvatarUrl(row.avatar_url, publicOrigin),
      bio: row.bio || ""
    },
    social: {
      followers: Number(row.followers_count || 0),
      following: Number(row.following_count || 0),
      isFollowing: Boolean(row.is_following),
      isMe: Boolean(row.is_me)
    }
  };
}

function directMessageRow(row) {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    recipientUserId: row.recipient_user_id,
    body: row.body,
    readAt: row.read_at || null,
    createdAt: row.created_at
  };
}

function communityUsername(user) {
  const id = uuidValue(user?.id).replaceAll("-", "").toLowerCase();
  return `zx_${id.slice(0, 27)}`;
}

function createIdentityCommunity({
  pool,
  sendVerification,
  publishedProductIds,
  communityPersonalCenter = null,
  publicOrigin,
  now = () => new Date()
}) {
  if (
    !pool ||
    typeof sendVerification !== "function" ||
    typeof publishedProductIds !== "function"
  ) {
    throw new Error("IdentityCommunity dependencies are incomplete");
  }
  const parsedPublicOrigin = new URL(String(publicOrigin || ""));
  if (
    parsedPublicOrigin.origin !== publicOrigin ||
    !(
      parsedPublicOrigin.protocol === "https:" ||
      (parsedPublicOrigin.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(parsedPublicOrigin.hostname))
    )
  ) {
    throw new Error("Identity public origin must use HTTPS or loopback HTTP");
  }

  async function audit(client, kind, context, userId = null, sessionId = null) {
    await client.query(
      `INSERT INTO security_events
        (id, user_id, session_id, kind, remote_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuid(), userId, sessionId, kind, context.remoteAddress || "unknown"]
    );
  }

  async function issueSession(client, userId, input, context) {
    const deviceId = String(input.deviceId || "");
    if (!/^[0-9a-f-]{36}$/i.test(deviceId)) {
      throw new DomainError("INVALID_INPUT", "设备标识无效");
    }
    const deviceName = boundedText(input.deviceName, "设备名称", 1, 80);
    const device = await client.query(
      `INSERT INTO devices (id, user_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, id) DO UPDATE
       SET name = EXCLUDED.name, last_seen_at = now()
       RETURNING id`,
      [deviceId, userId, deviceName]
    );
    if (device.rowCount !== 1) throw new Error("Device session was not saved");
    const accessToken = randomCredential();
    const refreshToken = randomCredential();
    const sessionId = uuid();
    const accessExpiresAt = new Date(now().getTime() + ACCESS_LIFETIME_MS);
    const refreshExpiresAt = new Date(now().getTime() + REFRESH_LIFETIME_MS);
    await client.query(
      `INSERT INTO sessions
        (id, user_id, device_id, access_hash, access_expires_at,
         refresh_hash, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        userId,
        deviceId,
        digestCredential(accessToken),
        accessExpiresAt,
        digestCredential(refreshToken),
        refreshExpiresAt
      ]
    );
    await audit(client, "session.created", context, userId, sessionId);
    return {
      accessToken,
      accessExpiresAt: accessExpiresAt.toISOString(),
      refreshToken,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      sessionId
    };
  }

  async function userView(client, userId) {
    const result = await client.query(
      `SELECT u.id, u.email, u.phone, u.username,
              p.nickname, p.avatar_url, p.bio
       FROM users u
       JOIN community_profiles p ON p.user_id = u.id
       WHERE u.id = $1 AND u.status = 'active'`,
      [userId]
    );
    if (!result.rows[0]) {
      throw new DomainError("SESSION_REVOKED", "会话已失效", 401);
    }
    return rowUser(result.rows[0], publicOrigin);
  }

  async function publicUserById(viewerUserId, targetUserId, queryable = pool) {
    const result = await queryable.query(
      `SELECT u.id, u.username, p.nickname, p.avatar_url, p.bio,
              (SELECT count(*)::int FROM user_follows
               WHERE followed_user_id = u.id) AS followers_count,
              (SELECT count(*)::int FROM user_follows
               WHERE follower_user_id = u.id) AS following_count,
              EXISTS (
                SELECT 1 FROM user_follows
                WHERE follower_user_id = $1 AND followed_user_id = u.id
              ) AS is_following,
              (u.id = $1) AS is_me
       FROM users u
       JOIN community_profiles p ON p.user_id = u.id
       WHERE u.id = $2 AND u.status = 'active'`,
      [viewerUserId, targetUserId]
    );
    if (!result.rows[0]) {
      throw new DomainError("NOT_FOUND", "用户不存在", 404);
    }
    return publicUserRow(result.rows[0], publicOrigin);
  }

  async function getPublicUserByUsername(accessToken, username) {
    const session = await authenticateAccess(accessToken);
    let normalized;
    try {
      normalized = normalizeUsername(username).normalized;
    } catch {
      throw new DomainError("INVALID_INPUT", "用户名无效");
    }
    const target = await pool.query(
      `SELECT id FROM users
       WHERE normalized_username = $1 AND status = 'active'`,
      [normalized]
    );
    if (!target.rows[0]) {
      throw new DomainError("NOT_FOUND", "用户不存在", 404);
    }
    return publicUserById(session.user_id, target.rows[0].id);
  }

  async function listFollowers(accessToken, input = {}) {
    const session = await authenticateAccess(accessToken);
    const limit = boundedLimit(input.limit);
    const offset = boundedOffset(input.offset);
    const result = await pool.query(
      `SELECT u.id, u.username, p.nickname, p.avatar_url, p.bio,
              (SELECT count(*)::int FROM user_follows
               WHERE followed_user_id = u.id) AS followers_count,
              (SELECT count(*)::int FROM user_follows
               WHERE follower_user_id = u.id) AS following_count,
              EXISTS (
                SELECT 1 FROM user_follows
                WHERE follower_user_id = $1 AND followed_user_id = u.id
              ) AS is_following,
              (u.id = $1) AS is_me
       FROM user_follows edge
       JOIN users u ON u.id = edge.follower_user_id AND u.status = 'active'
       JOIN community_profiles p ON p.user_id = u.id
       WHERE edge.followed_user_id = $1
       ORDER BY edge.created_at DESC, u.id
       LIMIT $2 OFFSET $3`,
      [session.user_id, limit + 1, offset]
    );
    return {
      users: result.rows
        .slice(0, limit)
        .map((row) => publicUserRow(row, publicOrigin)),
      hasMore: result.rows.length > limit,
      nextOffset: result.rows.length > limit ? offset + limit : null
    };
  }

  async function listFollowing(accessToken, input = {}) {
    const session = await authenticateAccess(accessToken);
    const limit = boundedLimit(input.limit);
    const offset = boundedOffset(input.offset);
    const result = await pool.query(
      `SELECT u.id, u.username, p.nickname, p.avatar_url, p.bio,
              (SELECT count(*)::int FROM user_follows
               WHERE followed_user_id = u.id) AS followers_count,
              (SELECT count(*)::int FROM user_follows
               WHERE follower_user_id = u.id) AS following_count,
              true AS is_following,
              false AS is_me
       FROM user_follows edge
       JOIN users u ON u.id = edge.followed_user_id AND u.status = 'active'
       JOIN community_profiles p ON p.user_id = u.id
       WHERE edge.follower_user_id = $1
       ORDER BY edge.created_at DESC, u.id
       LIMIT $2 OFFSET $3`,
      [session.user_id, limit + 1, offset]
    );
    return {
      users: result.rows
        .slice(0, limit)
        .map((row) => publicUserRow(row, publicOrigin)),
      hasMore: result.rows.length > limit,
      nextOffset: result.rows.length > limit ? offset + limit : null
    };
  }

  async function followUser(accessToken, targetUserId) {
    const session = await authenticateAccess(accessToken);
    const targetId = uuidValue(targetUserId);
    if (targetId === session.user_id) {
      throw new DomainError("INVALID_INPUT", "不能关注自己");
    }
    const client = await pool.connect();
    let created = false;
    try {
      await client.query("BEGIN");
      const target = await client.query(
        `SELECT id FROM users
         WHERE id = $1 AND status = 'active'
         FOR SHARE`,
        [targetId]
      );
      if (!target.rowCount) {
        throw new DomainError("NOT_FOUND", "用户不存在", 404);
      }
      const inserted = await client.query(
        `INSERT INTO user_follows (follower_user_id, followed_user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING follower_user_id`,
        [session.user_id, targetId]
      );
      created = inserted.rowCount === 1;
      if (created) {
        const firstNotification = await client.query(
          `INSERT INTO user_follow_notifications
            (follower_user_id, followed_user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING
           RETURNING follower_user_id`,
          [session.user_id, targetId]
        );
        if (firstNotification.rowCount === 1) {
          const follower = await client.query(
            `SELECT u.username, p.nickname
             FROM users u
             JOIN community_profiles p ON p.user_id = u.id
             WHERE u.id = $1`,
            [session.user_id]
          );
          await addSiteMessage(
            client,
            targetId,
            `${follower.rows[0].nickname} 关注了你`,
            `@${follower.rows[0].username} 开始关注你。`
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return {
      ok: true,
      user: await publicUserById(session.user_id, targetId),
      following: true,
      created
    };
  }

  async function unfollowUser(accessToken, targetUserId) {
    const session = await authenticateAccess(accessToken);
    const targetId = uuidValue(targetUserId);
    if (targetId === session.user_id) {
      throw new DomainError("INVALID_INPUT", "不能取消关注自己");
    }
    const user = await publicUserById(session.user_id, targetId);
    const removed = await pool.query(
      `DELETE FROM user_follows
       WHERE follower_user_id = $1 AND followed_user_id = $2`,
      [session.user_id, targetId]
    );
    user.social.isFollowing = false;
    if (removed.rowCount) {
      user.social.followers = Math.max(0, user.social.followers - 1);
    }
    return {
      ok: true,
      user,
      following: false,
      removed: removed.rowCount === 1
    };
  }

  async function accountSocialSummary(accessToken) {
    const session = await authenticateAccess(accessToken);
    const result = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM user_follows
          WHERE followed_user_id = $1) AS followers,
         (SELECT count(*)::int FROM user_follows
          WHERE follower_user_id = $1) AS following,
         (SELECT count(*)::int FROM direct_messages
          WHERE recipient_user_id = $1 AND read_at IS NULL) AS unread_messages`,
      [session.user_id]
    );
    return {
      followers: Number(result.rows[0].followers || 0),
      following: Number(result.rows[0].following || 0),
      unreadDirectMessages: Number(result.rows[0].unread_messages || 0)
    };
  }

  async function listDirectConversations(accessToken, input = {}) {
    const session = await authenticateAccess(accessToken);
    const limit = boundedLimit(input.limit);
    const offset = boundedOffset(input.offset);
    const result = await pool.query(
      `WITH mine AS (
         SELECT dm.*,
                CASE WHEN dm.sender_user_id = $1
                  THEN dm.recipient_user_id ELSE dm.sender_user_id
                END AS peer_user_id
         FROM direct_messages dm
         WHERE dm.sender_user_id = $1 OR dm.recipient_user_id = $1
       ), ranked AS (
         SELECT mine.*,
                row_number() OVER (
                  PARTITION BY peer_user_id
                  ORDER BY created_at DESC, id DESC
                ) AS position,
                count(*) FILTER (
                  WHERE recipient_user_id = $1 AND read_at IS NULL
                ) OVER (PARTITION BY peer_user_id)::int AS unread_count
         FROM mine
       )
       SELECT ranked.id, ranked.sender_user_id, ranked.recipient_user_id,
              ranked.body, ranked.read_at, ranked.created_at,
              ranked.unread_count,
              u.id AS peer_id, u.username AS peer_username,
              p.nickname AS peer_nickname, p.avatar_url AS peer_avatar_url,
              p.bio AS peer_bio,
              (SELECT count(*)::int FROM user_follows
               WHERE followed_user_id = u.id) AS peer_followers_count,
              (SELECT count(*)::int FROM user_follows
               WHERE follower_user_id = u.id) AS peer_following_count,
              EXISTS (
                SELECT 1 FROM user_follows
                WHERE follower_user_id = $1 AND followed_user_id = u.id
              ) AS peer_is_following
       FROM ranked
       JOIN users u ON u.id = ranked.peer_user_id AND u.status = 'active'
       JOIN community_profiles p ON p.user_id = u.id
       WHERE ranked.position = 1
       ORDER BY ranked.created_at DESC, ranked.id DESC
       LIMIT $2 OFFSET $3`,
      [session.user_id, limit + 1, offset]
    );
    const conversations = result.rows.slice(0, limit).map((row) => ({
      peer: publicUserRow(
        {
          id: row.peer_id,
          username: row.peer_username,
          nickname: row.peer_nickname,
          avatar_url: row.peer_avatar_url,
          bio: row.peer_bio,
          followers_count: row.peer_followers_count,
          following_count: row.peer_following_count,
          is_following: row.peer_is_following,
          is_me: false
        },
        publicOrigin
      ),
      lastMessage: directMessageRow(row),
      unreadCount: Number(row.unread_count || 0)
    }));
    return {
      conversations,
      hasMore: result.rows.length > limit,
      nextOffset: result.rows.length > limit ? offset + limit : null
    };
  }

  async function listDirectMessages(accessToken, peerUserId, input = {}) {
    const session = await authenticateAccess(accessToken);
    const peerId = uuidValue(peerUserId);
    if (peerId === session.user_id) {
      throw new DomainError("INVALID_INPUT", "不能与自己建立私信会话");
    }
    const peer = await publicUserById(session.user_id, peerId);
    let beforeCreatedAt = null;
    let beforeId = null;
    if (input.before) {
      beforeId = uuidValue(input.before, "分页消息标识");
      const cursor = await pool.query(
        `SELECT id, created_at FROM direct_messages
         WHERE id = $1 AND (
           (sender_user_id = $2 AND recipient_user_id = $3) OR
           (sender_user_id = $3 AND recipient_user_id = $2)
         )`,
        [beforeId, session.user_id, peerId]
      );
      if (!cursor.rows[0]) {
        throw new DomainError("NOT_FOUND", "分页消息不存在", 404);
      }
      beforeCreatedAt = cursor.rows[0].created_at;
    }
    const limit = boundedLimit(input.limit);
    const result = await pool.query(
      `SELECT id, sender_user_id, recipient_user_id, body, read_at, created_at
       FROM direct_messages
       WHERE (
         (sender_user_id = $1 AND recipient_user_id = $2) OR
         (sender_user_id = $2 AND recipient_user_id = $1)
       )
         AND (
           $3::timestamptz IS NULL OR
           (created_at, id) < ($3::timestamptz, $4::uuid)
         )
       ORDER BY created_at DESC, id DESC
       LIMIT $5`,
      [
        session.user_id,
        peerId,
        beforeCreatedAt,
        beforeId,
        limit + 1
      ]
    );
    const rows = result.rows.slice(0, limit);
    return {
      peer,
      messages: rows.reverse().map(directMessageRow),
      hasMore: result.rows.length > limit,
      nextBefore:
        result.rows.length > limit && rows.length ? rows[0].id : null
    };
  }

  async function sendDirectMessage(accessToken, peerUserId, input) {
    const session = await authenticateAccess(accessToken);
    const peerId = uuidValue(peerUserId);
    if (peerId === session.user_id) {
      throw new DomainError("INVALID_INPUT", "不能给自己发送私信");
    }
    const body = boundedText(input?.body, "私信", 1, 4000);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await publicUserById(session.user_id, peerId, client);
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`,
        [session.user_id]
      );
      const recent = await client.query(
        `SELECT count(*)::int AS count FROM direct_messages
         WHERE sender_user_id = $1
           AND created_at > now() - interval '1 minute'`,
        [session.user_id]
      );
      if (Number(recent.rows[0].count) >= DIRECT_MESSAGE_RATE_LIMIT_PER_MINUTE) {
        throw new DomainError(
          "RATE_LIMITED",
          "私信发送过于频繁，请稍后再试",
          429
        );
      }
      const result = await client.query(
        `INSERT INTO direct_messages
          (id, sender_user_id, recipient_user_id, body)
         VALUES ($1, $2, $3, $4)
         RETURNING id, sender_user_id, recipient_user_id, body, read_at, created_at`,
        [uuid(), session.user_id, peerId, body]
      );
      await client.query("COMMIT");
      return directMessageRow(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function markDirectMessagesRead(
    accessToken,
    peerUserId,
    throughMessageId
  ) {
    const session = await authenticateAccess(accessToken);
    const peerId = uuidValue(peerUserId);
    const throughId = uuidValue(throughMessageId, "消息标识");
    const through = await pool.query(
      `SELECT id, created_at FROM direct_messages
       WHERE id = $1 AND sender_user_id = $2 AND recipient_user_id = $3`,
      [throughId, peerId, session.user_id]
    );
    if (!through.rows[0]) {
      throw new DomainError("NOT_FOUND", "消息不存在", 404);
    }
    const result = await pool.query(
      `UPDATE direct_messages
       SET read_at = now()
       WHERE sender_user_id = $1 AND recipient_user_id = $2
         AND read_at IS NULL
         AND (created_at, id) <= ($3::timestamptz, $4::uuid)
       RETURNING read_at`,
      [peerId, session.user_id, through.rows[0].created_at, throughId]
    );
    return {
      ok: true,
      readCount: result.rowCount,
      readAt: result.rows[0]?.read_at || null
    };
  }

  async function requestRegistrationCode(input, context) {
    const email = emailValue(input.email);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT 1 FROM users WHERE normalized_email = $1`,
        [email]
      );
      if (existing.rowCount) {
        throw new DomainError(
          "REGISTRATION_ALREADY_EXISTS",
          "该邮箱已经注册"
        );
      }
      const recent = await client.query(
        `SELECT count(*)::int AS count
         FROM registration_challenges
         WHERE normalized_email = $1
           AND created_at > now() - interval '1 hour'`,
        [email]
      );
      if (recent.rows[0].count >= 5) {
        throw new DomainError(
          "RATE_LIMITED",
          "验证码发送过于频繁，请稍后再试",
          429
        );
      }
      await client.query(
        `UPDATE registration_challenges
         SET consumed_at = now()
         WHERE normalized_email = $1 AND consumed_at IS NULL`,
        [email]
      );
      const challengeId = uuid();
      const code = verificationCode();
      const expiresAt = new Date(now().getTime() + CHALLENGE_LIFETIME_MS);
      await client.query(
        `INSERT INTO registration_challenges
          (id, normalized_email, code_hash, expires_at, created_ip)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          challengeId,
          email,
          digestCredential(`${challengeId}:${code}`),
          expiresAt,
          context.remoteAddress || "unknown"
        ]
      );
      await audit(client, "registration.code-requested", context);
      await client.query("COMMIT");
      await sendVerification({ email, code, expiresAt });
      return {
        challengeId,
        expiresAt: expiresAt.toISOString(),
        localMailViewerUrl: process.env.AIHUB_LOCAL_MAIL_VIEWER_URL || ""
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function register(input, context) {
    const email = emailValue(input.email);
    const { username, normalized } = normalizeUsername(input.username);
    const password = validatePassword(input.password);
    const nickname = boundedText(
      input.nickname || username,
      "昵称",
      2,
      32
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const challenge = await client.query(
        `SELECT * FROM registration_challenges
         WHERE id = $1 FOR UPDATE`,
        [input.challengeId]
      );
      const row = challenge.rows[0];
      if (
        !row ||
        row.normalized_email !== email ||
        row.consumed_at ||
        new Date(row.expires_at).getTime() <= now().getTime()
      ) {
        throw new DomainError(
          "VERIFICATION_EXPIRED",
          "验证码已失效，请重新获取"
        );
      }
      if (row.attempts >= 5) {
        throw new DomainError(
          "VERIFICATION_INVALID",
          "验证码尝试次数过多，请重新获取"
        );
      }
      const validCode =
        digestCredential(`${row.id}:${String(input.code || "")}`) ===
        row.code_hash;
      if (!validCode) {
        await client.query(
          `UPDATE registration_challenges
           SET attempts = attempts + 1 WHERE id = $1`,
          [row.id]
        );
        await client.query("COMMIT");
        throw new DomainError("VERIFICATION_INVALID", "验证码错误");
      }
      const userId = uuid();
      await client.query(
        `INSERT INTO users
          (id, email, normalized_email, username, normalized_username,
            community_username, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          email,
          email,
          username,
          normalized,
          communityUsername({ id: userId }),
          hashPassword(password)
        ]
      );
      await client.query(
        `INSERT INTO community_profiles (user_id, nickname)
         VALUES ($1, $2)`,
        [userId, nickname]
      );
      await client.query(
        `INSERT INTO site_messages (id, user_id, title, body, action_path)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          uuid(),
          userId,
          "欢迎来到枕星 AI",
          "你的 PC 客户端与社区已经使用同一个用户身份。",
          "/community"
        ]
      );
      await client.query(
        `UPDATE registration_challenges SET consumed_at = now() WHERE id = $1`,
        [row.id]
      );
      const session = await issueSession(client, userId, input, context);
      await audit(client, "registration.completed", context, userId, session.sessionId);
      const user = await userView(client, userId);
      await client.query("COMMIT");
      return { user, ...session };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error?.code === "23505") {
        throw new DomainError(
          "REGISTRATION_ALREADY_EXISTS",
          "邮箱或用户名已经注册"
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function login(input, context) {
    const identifier = String(input.identifier || "").trim();
    const normalizedIdentifier = identifier.toLocaleLowerCase("en-US");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT * FROM users
         WHERE status = 'active'
           AND (normalized_email = $1 OR normalized_username = $1)
         FOR UPDATE`,
        [normalizedIdentifier]
      );
      const user = result.rows[0];
      if (!user || !verifyPassword(input.password, user.password_hash)) {
        await audit(client, "login.failed", context, user?.id || null);
        await client.query("COMMIT");
        throw new DomainError(
          "AUTHENTICATION_FAILED",
          "邮箱、用户名或密码错误",
          401
        );
      }
      const session = await issueSession(client, user.id, input, context);
      const view = await userView(client, user.id);
      await client.query("COMMIT");
      return { user: view, ...session };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function authenticateAccess(accessToken) {
    if (!accessToken) {
      throw new DomainError("SESSION_REVOKED", "请先登录", 401);
    }
    const result = await pool.query(
      `SELECT id, user_id, device_id
       FROM sessions
       WHERE access_hash = $1
         AND revoked_at IS NULL
         AND access_expires_at > now()`,
      [digestCredential(accessToken)]
    );
    if (!result.rows[0]) {
      throw new DomainError("SESSION_EXPIRED", "登录状态已过期", 401);
    }
    return result.rows[0];
  }

  async function refresh(input, context) {
    const refreshHash = digestCredential(input.refreshToken);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const reused = await client.query(
        `SELECT session_id FROM used_refresh_credentials
         WHERE refresh_hash = $1 AND expires_at > now()`,
        [refreshHash]
      );
      if (reused.rows[0]) {
        await client.query(
          `UPDATE sessions SET revoked_at = now()
           WHERE id = $1 AND revoked_at IS NULL`,
          [reused.rows[0].session_id]
        );
        await audit(
          client,
          "session.refresh-reused",
          context,
          null,
          reused.rows[0].session_id
        );
        await client.query("COMMIT");
        throw new DomainError("SESSION_REVOKED", "会话已被撤销", 401);
      }
      const current = await client.query(
        `SELECT * FROM sessions
         WHERE refresh_hash = $1
           AND revoked_at IS NULL
           AND refresh_expires_at > now()
         FOR UPDATE`,
        [refreshHash]
      );
      const session = current.rows[0];
      if (!session) {
        throw new DomainError("SESSION_REVOKED", "会话已失效", 401);
      }
      const accessToken = randomCredential();
      const refreshToken = randomCredential();
      const accessExpiresAt = new Date(now().getTime() + ACCESS_LIFETIME_MS);
      const refreshExpiresAt = new Date(now().getTime() + REFRESH_LIFETIME_MS);
      await client.query(
        `INSERT INTO used_refresh_credentials
          (refresh_hash, session_id, expires_at)
         VALUES ($1, $2, $3)`,
        [session.refresh_hash, session.id, session.refresh_expires_at]
      );
      await client.query(
        `UPDATE sessions
         SET access_hash = $1, access_expires_at = $2,
             refresh_hash = $3, refresh_expires_at = $4,
             last_seen_at = now()
         WHERE id = $5`,
        [
          digestCredential(accessToken),
          accessExpiresAt,
          digestCredential(refreshToken),
          refreshExpiresAt,
          session.id
        ]
      );
      await client.query(
        `UPDATE devices
         SET last_seen_at = now()
         WHERE user_id = $1 AND id = $2`,
        [session.user_id, session.device_id]
      );
      const user = await userView(client, session.user_id);
      await audit(client, "session.refreshed", context, session.user_id, session.id);
      await client.query("COMMIT");
      return {
        user,
        accessToken,
        accessExpiresAt: accessExpiresAt.toISOString(),
        refreshToken,
        refreshExpiresAt: refreshExpiresAt.toISOString(),
        sessionId: session.id
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function me(accessToken) {
    const session = await authenticateAccess(accessToken);
    return {
      user: await userView(pool, session.user_id),
      sessionId: session.id
    };
  }

  async function logout(accessToken, context) {
    const session = await authenticateAccess(accessToken);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE sessions SET revoked_at = now()
         WHERE id = $1 AND revoked_at IS NULL`,
        [session.id]
      );
      await audit(client, "session.logged-out", context, session.user_id, session.id);
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function listSessions(accessToken) {
    const session = await authenticateAccess(accessToken);
    const result = await pool.query(
      `SELECT s.id, s.device_id, d.name AS device_name,
              s.created_at, s.last_seen_at
       FROM sessions s
       JOIN devices d ON d.user_id = s.user_id AND d.id = s.device_id
       WHERE s.user_id = $1 AND s.revoked_at IS NULL
         AND s.refresh_expires_at > now()
       ORDER BY s.last_seen_at DESC`,
      [session.user_id]
    );
    return result.rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      current: row.id === session.id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at
    }));
  }

  async function revokeSession(accessToken, targetSessionId, context) {
    const session = await authenticateAccess(accessToken);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE sessions SET revoked_at = now()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
         RETURNING id`,
        [targetSessionId, session.user_id]
      );
      if (!result.rowCount) {
        throw new DomainError("INVALID_INPUT", "设备会话不存在", 404);
      }
      await audit(
        client,
        "session.revoked",
        context,
        session.user_id,
        targetSessionId
      );
      await client.query("COMMIT");
      return { ok: true, revokedCurrent: targetSessionId === session.id };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function requireCurrentPassword(client, userId, password) {
    const result = await client.query(
      `SELECT password_hash FROM users
       WHERE id = $1 AND status = 'active'
       FOR UPDATE`,
      [userId]
    );
    if (
      !result.rows[0] ||
      !verifyPassword(String(password || ""), result.rows[0].password_hash)
    ) {
      throw new DomainError(
        "AUTHENTICATION_FAILED",
        "当前密码错误",
        401
      );
    }
  }

  async function addSiteMessage(
    client,
    userId,
    title,
    body,
    actionPath = ""
  ) {
    await client.query(
      `INSERT INTO site_messages
        (id, user_id, title, body, action_path)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''))`,
      [uuid(), userId, title, body, actionPath]
    );
  }

  async function updateProfile(accessToken, input) {
    const session = await authenticateAccess(accessToken);
    const nickname = boundedText(input.nickname, "昵称", 2, 32);
    const bio = String(input.bio || "").trim();
    if (bio.length > 200) {
      throw new DomainError("INVALID_INPUT", "简介不能超过 200 个字符");
    }
    if (Object.hasOwn(input, "avatarUrl")) {
      throw new DomainError("INVALID_INPUT", "头像仅支持上传接口");
    }
    await pool.query(
      `UPDATE community_profiles
       SET nickname = $1, bio = $2, updated_at = now()
       WHERE user_id = $3`,
      [nickname, bio, session.user_id]
    );
    return { user: await userView(pool, session.user_id) };
  }

  async function updateAvatar(accessToken, input, context) {
    const session = await authenticateAccess(accessToken);
    let avatar;
    try {
      avatar = parseAvatarDataUrl(input?.dataUrl);
    } catch (error) {
      throw new DomainError("INVALID_INPUT", error.message);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (avatar) {
        const version = crypto.randomBytes(8).toString("hex");
        await client.query(
          `INSERT INTO profile_avatars (user_id, mime_type, content, updated_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (user_id) DO UPDATE
           SET mime_type = EXCLUDED.mime_type,
               content = EXCLUDED.content,
               updated_at = now()`,
          [session.user_id, avatar.mimeType, avatar.data]
        );
        await client.query(
          `UPDATE community_profiles
           SET avatar_url = $1, updated_at = now()
           WHERE user_id = $2`,
          [`/v1/avatars/${session.user_id}?v=${version}`, session.user_id]
        );
      } else {
        await client.query(
          "DELETE FROM profile_avatars WHERE user_id = $1",
          [session.user_id]
        );
        await client.query(
          `UPDATE community_profiles
           SET avatar_url = NULL, updated_at = now()
           WHERE user_id = $1`,
          [session.user_id]
        );
      }
      await audit(
        client,
        avatar ? "profile.avatar.updated" : "profile.avatar.removed",
        context,
        session.user_id,
        session.id
      );
      const user = await userView(client, session.user_id);
      await client.query("COMMIT");
      return { user };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function getAvatar(userId) {
    const result = await pool.query(
      `SELECT mime_type, content
       FROM profile_avatars
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async function updatePhone(accessToken, input, context) {
    const session = await authenticateAccess(accessToken);
    const phoneValue = normalizedPhone(input.phone);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await requireCurrentPassword(
        client,
        session.user_id,
        input.currentPassword
      );
      await client.query(
        `UPDATE users
         SET phone = NULLIF($1, ''), normalized_phone = NULLIF($2, ''),
             updated_at = now()
         WHERE id = $3`,
        [phoneValue.phone, phoneValue.normalized, session.user_id]
      );
      await addSiteMessage(
        client,
        session.user_id,
        phoneValue.phone ? "手机号已更新" : "手机号已移除",
        phoneValue.phone
          ? `个人中心已绑定手机号 ${phoneValue.phone}。`
          : "个人中心已移除原绑定手机号。"
      );
      await audit(
        client,
        "contact.phone-updated",
        context,
        session.user_id,
        session.id
      );
      const user = await userView(client, session.user_id);
      await client.query("COMMIT");
      return { user };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error?.code === "23505") {
        throw new DomainError("CONTACT_ALREADY_BOUND", "该手机号已经绑定", 409);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function requestEmailChange(accessToken, input, context) {
    const session = await authenticateAccess(accessToken);
    const email = emailValue(input.email);
    const client = await pool.connect();
    let delivery = null;
    try {
      await client.query("BEGIN");
      await requireCurrentPassword(
        client,
        session.user_id,
        input.currentPassword
      );
      const existing = await client.query(
        `SELECT id FROM users WHERE normalized_email = $1`,
        [email]
      );
      if (
        existing.rows[0] &&
        existing.rows[0].id !== session.user_id
      ) {
        throw new DomainError(
          "CONTACT_ALREADY_BOUND",
          "该邮箱已经绑定其他用户",
          409
        );
      }
      const recent = await client.query(
        `SELECT count(*)::int AS count
         FROM email_change_challenges
         WHERE user_id = $1
           AND created_at > now() - interval '1 hour'`,
        [session.user_id]
      );
      if (recent.rows[0].count >= 5) {
        throw new DomainError(
          "RATE_LIMITED",
          "验证码发送过于频繁，请稍后再试",
          429
        );
      }
      await client.query(
        `UPDATE email_change_challenges
         SET consumed_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [session.user_id]
      );
      const challengeId = uuid();
      const code = verificationCode();
      const expiresAt = new Date(now().getTime() + CHALLENGE_LIFETIME_MS);
      await client.query(
        `INSERT INTO email_change_challenges
          (id, user_id, normalized_email, code_hash, expires_at, created_ip)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          challengeId,
          session.user_id,
          email,
          digestCredential(`${challengeId}:${code}`),
          expiresAt,
          context.remoteAddress || "unknown"
        ]
      );
      await audit(
        client,
        "contact.email-change-requested",
        context,
        session.user_id,
        session.id
      );
      await client.query("COMMIT");
      delivery = { email, code, expiresAt };
      await sendVerification({
        ...delivery,
        purpose: "email-change"
      });
      return {
        challengeId,
        expiresAt: expiresAt.toISOString(),
        localMailViewerUrl: process.env.AIHUB_LOCAL_MAIL_VIEWER_URL || ""
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function completeEmailChange(accessToken, input, context) {
    const session = await authenticateAccess(accessToken);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const challenge = await client.query(
        `SELECT * FROM email_change_challenges
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [input.challengeId, session.user_id]
      );
      const row = challenge.rows[0];
      if (
        !row ||
        row.consumed_at ||
        new Date(row.expires_at).getTime() <= now().getTime()
      ) {
        throw new DomainError(
          "VERIFICATION_EXPIRED",
          "验证码已失效，请重新获取"
        );
      }
      if (row.attempts >= 5) {
        throw new DomainError(
          "VERIFICATION_INVALID",
          "验证码尝试次数过多，请重新获取"
        );
      }
      const validCode =
        digestCredential(`${row.id}:${String(input.code || "")}`) ===
        row.code_hash;
      if (!validCode) {
        await client.query(
          `UPDATE email_change_challenges
           SET attempts = attempts + 1 WHERE id = $1`,
          [row.id]
        );
        await client.query("COMMIT");
        throw new DomainError("VERIFICATION_INVALID", "验证码错误");
      }
      await client.query(
        `UPDATE users
         SET email = $1, normalized_email = $1, updated_at = now()
         WHERE id = $2`,
        [row.normalized_email, session.user_id]
      );
      await client.query(
        `UPDATE email_change_challenges
         SET consumed_at = now() WHERE id = $1`,
        [row.id]
      );
      await addSiteMessage(
        client,
        session.user_id,
        "邮箱已更新",
        `登录邮箱已更新为 ${row.normalized_email}。`
      );
      await audit(
        client,
        "contact.email-updated",
        context,
        session.user_id,
        session.id
      );
      const user = await userView(client, session.user_id);
      await client.query("COMMIT");
      return { user };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error?.code === "23505") {
        throw new DomainError(
          "CONTACT_ALREADY_BOUND",
          "该邮箱已经绑定其他用户",
          409
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function changePassword(accessToken, input, context) {
    const session = await authenticateAccess(accessToken);
    let nextPassword;
    try {
      nextPassword = validatePassword(input.newPassword);
    } catch {
      throw new DomainError(
        "INVALID_INPUT",
        "密码至少 10 位，并同时包含字母和数字"
      );
    }
    if (String(input.currentPassword || "") === nextPassword) {
      throw new DomainError("INVALID_INPUT", "新密码不能与当前密码相同");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await requireCurrentPassword(
        client,
        session.user_id,
        input.currentPassword
      );
      await client.query(
        `UPDATE users SET password_hash = $1, updated_at = now()
         WHERE id = $2`,
        [hashPassword(nextPassword), session.user_id]
      );
      await client.query(
        `UPDATE sessions SET revoked_at = now()
         WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
        [session.user_id, session.id]
      );
      await addSiteMessage(
        client,
        session.user_id,
        "密码已更新",
        "登录密码已更新，其他设备的会话已经退出。"
      );
      await audit(
        client,
        "credential.password-updated",
        context,
        session.user_id,
        session.id
      );
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function listSiteMessages(accessToken, input = {}) {
    const session = await authenticateAccess(accessToken);
    const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
    const result = await pool.query(
      `SELECT id, title, body, action_path, read_at, created_at
       FROM site_messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [session.user_id, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      actionPath: row.action_path || "",
      read: Boolean(row.read_at),
      readAt: row.read_at,
      createdAt: row.created_at
    }));
  }

  async function markSiteMessageRead(accessToken, messageId) {
    const session = await authenticateAccess(accessToken);
    const result = await pool.query(
      `UPDATE site_messages
       SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND user_id = $2
       RETURNING id, read_at`,
      [messageId, session.user_id]
    );
    if (!result.rowCount) {
      throw new DomainError("NOT_FOUND", "站内信不存在", 404);
    }
    return { ok: true, readAt: result.rows[0].read_at };
  }

  async function getPersonalCenter(accessToken) {
    const [{ user }, sessions, siteMessages, accountSummary] = await Promise.all([
      me(accessToken),
      listSessions(accessToken),
      listSiteMessages(accessToken),
      accountSocialSummary(accessToken)
    ]);
    let community = {
      notifications: [],
      interactions: [],
      history: [],
      historyCapped: false
    };
    let communityStatus = "ready";
    if (!communityPersonalCenter) {
      communityStatus = "unavailable";
    } else {
      try {
        const loadedCommunity = await communityPersonalCenter.list(
          communityUsername(user)
        );
        community = {
          notifications: loadedCommunity.notifications || [],
          interactions: loadedCommunity.interactions || [],
          history: loadedCommunity.history || [],
          historyCapped: Boolean(loadedCommunity.historyCapped)
        };
      } catch {
        communityStatus = "unavailable";
      }
    }
    const notifications = [
      ...siteMessages.map((message) => ({
        ...message,
        source: "account"
      })),
      ...community.notifications
    ].sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt)
    );
    return {
      user,
      sessions,
      social: {
        followers: accountSummary.followers,
        following: accountSummary.following
      },
      notifications,
      interactions: community.interactions,
      readingHistory: community.history,
      readingHistoryCapped: community.historyCapped,
      summary: {
        unreadNotifications: notifications.filter((item) => !item.read)
          .length,
        unreadDirectMessages: accountSummary.unreadDirectMessages,
        favorites: community.interactions.filter((item) => item.favorited)
          .length,
        likes: community.interactions.filter((item) => item.liked).length
      },
      sources: {
        account: "ready",
        community: communityStatus
      },
      generatedAt: now().toISOString()
    };
  }

  async function markPersonalCenterNotificationRead(
    accessToken,
    source,
    notificationId
  ) {
    if (source === "account") {
      return markSiteMessageRead(accessToken, notificationId);
    }
    if (source !== "community" || !communityPersonalCenter) {
      throw new DomainError("INVALID_INPUT", "提醒来源无效");
    }
    const { user } = await me(accessToken);
    try {
      return await communityPersonalCenter.markRead(
        communityUsername(user),
        notificationId
      );
    } catch (error) {
      throw new DomainError(
        error?.status === 404 ? "NOT_FOUND" : "COMMUNITY_UNAVAILABLE",
        error?.status === 404 ? "社区提醒不存在" : "社区提醒暂时不可用",
        error?.status === 404 ? 404 : 503
      );
    }
  }

  function communityTarget(input, discussionId) {
    const id = String(discussionId || "").trim();
    if (!/^[0-9]{1,20}$/.test(id)) {
      throw new DomainError("INVALID_INPUT", "讨论标识无效");
    }
    const title = boundedText(input.title, "讨论标题", 1, 160);
    const discussionPath = String(input.path || "").trim();
    if (
      discussionPath.length > 300 ||
      !/^\/d\/[0-9]+(?:-[^/?#]+)?(?:\/[0-9]+)?$/.test(discussionPath) ||
      discussionPath.includes("..")
    ) {
      throw new DomainError("INVALID_INPUT", "讨论地址无效");
    }
    return { id, title, discussionPath };
  }

  async function setCommunityInteraction(
    accessToken,
    discussionId,
    input
  ) {
    const session = await authenticateAccess(accessToken);
    const target = communityTarget(input, discussionId);
    const favorited = Boolean(input.favorited);
    const liked = Boolean(input.liked);
    if (!favorited && !liked) {
      await pool.query(
        `DELETE FROM community_interactions
         WHERE user_id = $1 AND discussion_id = $2`,
        [session.user_id, target.id]
      );
      return {
        discussionId: target.id,
        favorited: false,
        liked: false
      };
    }
    const result = await pool.query(
      `INSERT INTO community_interactions
        (user_id, discussion_id, discussion_title, discussion_path,
         favorited, liked)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, discussion_id) DO UPDATE
       SET discussion_title = EXCLUDED.discussion_title,
           discussion_path = EXCLUDED.discussion_path,
           favorited = EXCLUDED.favorited,
           liked = EXCLUDED.liked,
           updated_at = now()
       RETURNING discussion_id, discussion_title, discussion_path,
                 favorited, liked, updated_at`,
      [
        session.user_id,
        target.id,
        target.title,
        target.discussionPath,
        favorited,
        liked
      ]
    );
    const row = result.rows[0];
    return {
      discussionId: row.discussion_id,
      title: row.discussion_title,
      path: row.discussion_path,
      favorited: row.favorited,
      liked: row.liked,
      updatedAt: row.updated_at
    };
  }

  async function listCommunityInteractions(accessToken) {
    const session = await authenticateAccess(accessToken);
    const result = await pool.query(
      `SELECT discussion_id, discussion_title, discussion_path,
              favorited, liked, updated_at
       FROM community_interactions
       WHERE user_id = $1 AND (favorited OR liked)
       ORDER BY updated_at DESC`,
      [session.user_id]
    );
    return result.rows.map((row) => ({
      discussionId: row.discussion_id,
      title: row.discussion_title,
      path: row.discussion_path,
      favorited: row.favorited,
      liked: row.liked,
      updatedAt: row.updated_at
    }));
  }

  async function createCommunityHandoff(accessToken) {
    const session = await authenticateAccess(accessToken);
    const ticket = randomCredential();
    const expiresAt = new Date(
      now().getTime() + COMMUNITY_HANDOFF_LIFETIME_MS
    );
    await pool.query(
      `INSERT INTO community_handoffs
        (credential_hash, user_id, audience, expires_at)
       VALUES ($1, $2, 'community-browser', $3)`,
      [digestCredential(ticket), session.user_id, expiresAt]
    );
    const origin = new URL(
      process.env.AIHUB_COMMUNITY_PUBLIC_ORIGIN ||
        "http://127.0.0.1:8088"
    );
    if (
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      !(
        origin.protocol === "https:" ||
        (origin.protocol === "http:" &&
          ["127.0.0.1", "localhost"].includes(origin.hostname))
      )
    ) {
      throw new Error("AIHUB_COMMUNITY_PUBLIC_ORIGIN is not approved");
    }
    const launchUrl = new URL("/aihub-sso.php", origin);
    launchUrl.searchParams.set("ticket", ticket);
    return {
      launchUrl: launchUrl.href,
      expiresAt: expiresAt.toISOString()
    };
  }

  async function redeemCommunityHandoff(input, context) {
    const ticket = String(input.ticket || "");
    if (!/^[A-Za-z0-9_-]{32,}$/.test(ticket)) {
      throw new DomainError("HANDOFF_INVALID", "社区登录票据无效", 401);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const consumed = await client.query(
        `UPDATE community_handoffs
         SET consumed_at = now()
         WHERE credential_hash = $1
           AND audience = 'community-browser'
           AND consumed_at IS NULL
           AND expires_at > now()
         RETURNING user_id`,
        [digestCredential(ticket)]
      );
      if (!consumed.rowCount) {
        throw new DomainError(
          "HANDOFF_INVALID",
          "社区登录票据已失效或已经使用",
          401
        );
      }
      const user = await userView(client, consumed.rows[0].user_id);
      await audit(
        client,
        "community.handoff-consumed",
        context,
        consumed.rows[0].user_id
      );
      await client.query("COMMIT");
      return { user, communityUsername: communityUsername(user) };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function listDiscussions(input = {}) {
    const limit = Math.min(50, Math.max(1, Number(input.limit) || 30));
    const values = [];
    let productClause = "";
    if (input.productId) {
      values.push(String(input.productId));
      productClause = `AND d.product_id = $${values.length}`;
    }
    values.push(limit);
    const result = await pool.query(
      `SELECT d.id, d.product_id, d.title, d.body, d.created_at,
              p.nickname, p.avatar_url,
              count(r.id)::int AS reply_count
       FROM discussions d
       JOIN community_profiles p ON p.user_id = d.user_id
       LEFT JOIN discussion_replies r
         ON r.discussion_id = d.id AND r.status = 'published'
       WHERE d.status = 'published' ${productClause}
       GROUP BY d.id, p.nickname, p.avatar_url
       ORDER BY d.created_at DESC
       LIMIT $${values.length}`,
      values
    );
    return result.rows.map((row) => ({
      id: row.id,
      productId: row.product_id || "",
      title: row.title,
      body: row.body,
      author: {
        nickname: row.nickname,
        avatarUrl: resolvedAvatarUrl(row.avatar_url, publicOrigin)
      },
      replyCount: row.reply_count,
      createdAt: row.created_at
    }));
  }

  async function getDiscussion(discussionId) {
    const discussion = await pool.query(
      `SELECT d.id, d.product_id, d.title, d.body, d.created_at,
              p.nickname, p.avatar_url
       FROM discussions d
       JOIN community_profiles p ON p.user_id = d.user_id
       WHERE d.id = $1 AND d.status = 'published'`,
      [discussionId]
    );
    if (!discussion.rows[0]) {
      throw new DomainError("NOT_FOUND", "讨论不存在", 404);
    }
    const replies = await pool.query(
      `SELECT r.id, r.body, r.created_at, p.nickname, p.avatar_url
       FROM discussion_replies r
       JOIN community_profiles p ON p.user_id = r.user_id
       WHERE r.discussion_id = $1 AND r.status = 'published'
       ORDER BY r.created_at`,
      [discussionId]
    );
    const row = discussion.rows[0];
    return {
      id: row.id,
      productId: row.product_id || "",
      title: row.title,
      body: row.body,
      author: {
        nickname: row.nickname,
        avatarUrl: resolvedAvatarUrl(row.avatar_url, publicOrigin)
      },
      createdAt: row.created_at,
      replies: replies.rows.map((reply) => ({
        id: reply.id,
        body: reply.body,
        author: {
          nickname: reply.nickname,
          avatarUrl: resolvedAvatarUrl(reply.avatar_url, publicOrigin)
        },
        createdAt: reply.created_at
      }))
    };
  }

  async function createDiscussion(accessToken, input) {
    const session = await authenticateAccess(accessToken);
    const title = boundedText(input.title, "标题", 3, 120);
    const body = boundedText(input.body, "正文", 3, 10_000);
    const productId = String(input.productId || "").trim();
    if (productId && !(await publishedProductIds()).has(productId)) {
      throw new DomainError(
        "PRODUCT_NOT_PUBLISHED",
        "只能关联已发布产品",
        400
      );
    }
    const id = uuid();
    await pool.query(
      `INSERT INTO discussions (id, user_id, product_id, title, body)
       VALUES ($1, $2, NULLIF($3, ''), $4, $5)`,
      [id, session.user_id, productId, title, body]
    );
    return getDiscussion(id);
  }

  async function reply(accessToken, discussionId, input) {
    const session = await authenticateAccess(accessToken);
    const body = boundedText(input.body, "回复", 1, 5_000);
    const exists = await pool.query(
      `SELECT 1 FROM discussions
       WHERE id = $1 AND status = 'published'`,
      [discussionId]
    );
    if (!exists.rowCount) {
      throw new DomainError("NOT_FOUND", "讨论不存在", 404);
    }
    await pool.query(
      `INSERT INTO discussion_replies (id, discussion_id, user_id, body)
       VALUES ($1, $2, $3, $4)`,
      [uuid(), discussionId, session.user_id, body]
    );
    return getDiscussion(discussionId);
  }

  return {
    changePassword,
    completeEmailChange,
    createCommunityHandoff,
    createDiscussion,
    followUser,
    getDiscussion,
    getAvatar,
    getPersonalCenter,
    getPublicUserByUsername,
    listCommunityInteractions,
    listDirectConversations,
    listDirectMessages,
    listDiscussions,
    listFollowers,
    listFollowing,
    listSiteMessages,
    listSessions,
    login,
    logout,
    markPersonalCenterNotificationRead,
    markDirectMessagesRead,
    markSiteMessageRead,
    me,
    refresh,
    redeemCommunityHandoff,
    register,
    reply,
    requestEmailChange,
    requestRegistrationCode,
    revokeSession,
    sendDirectMessage,
    setCommunityInteraction,
    unfollowUser,
    updatePhone,
    updateAvatar,
    updateProfile
  };
}

module.exports = {
  DomainError,
  communityUsername,
  createIdentityCommunity
};
