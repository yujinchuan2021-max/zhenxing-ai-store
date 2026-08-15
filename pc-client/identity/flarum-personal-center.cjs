"use strict";

function normalizedTimestamp(value) {
  const text = String(value || "").trim();
  const candidate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? `${text.replace(" ", "T")}Z`
    : text;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : new Date(0).toISOString();
}

function discussionPath(value, postNumber = null) {
  const discussionId = String(value.discussionId || "");
  const slug = String(value.discussionSlug || value.slug || "");
  if (
    !/^[1-9][0-9]{0,19}$/.test(discussionId) ||
    !/^[a-z0-9-]{1,255}$/i.test(slug)
  ) {
    return "";
  }
  const base = `/d/${discussionId}-${slug}`;
  return Number.isInteger(postNumber) && postNumber > 0
    ? `${base}/${postNumber}`
    : base;
}

function notificationTitle(type, actorDisplayName) {
  const actor = actorDisplayName || "社区用户";
  const titles = {
    postLiked: `${actor} 喜欢了你的回复`,
    newPost: `${actor} 回复了你关注的讨论`,
    postMentioned: `${actor} 在回复中提到了你`,
    userMentioned: `${actor} 在社区中提到了你`,
    newDiscussionInTag: "你关注的板块有新讨论"
  };
  return titles[type] || "社区有新提醒";
}

async function defaultRequest(url, options) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5000)
  });
  const text = await response.text();
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`社区个人中心返回了无效响应（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    const error = new Error(value?.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return value;
}

function createFlarumPersonalCenterClient({
  origin,
  secret,
  request = defaultRequest
}) {
  const parsed = new URL(origin);
  if (
    parsed.origin !== origin ||
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("社区内部个人中心地址无效");
  }
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("社区内部个人中心密钥无效");
  }

  async function call(input) {
    return request(
      new URL("/aihub-personal-center.php", `${origin}/`).href,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AIHub-Community-Secret": secret
        },
        body: JSON.stringify(input)
      }
    );
  }

  return {
    async list(username) {
      const result = await call({ action: "list", username, limit: 100 });
      const notifications = Array.isArray(result?.notifications)
        ? result.notifications
        : [];
      const interactions = Array.isArray(result?.interactions)
        ? result.interactions
        : [];
      const history = Array.isArray(result?.history) ? result.history : [];
      return {
        notifications: notifications
          .filter((item) => /^[1-9][0-9]{0,19}$/.test(String(item?.id || "")))
          .map((item) => ({
            id: String(item.id),
            source: "community",
            title: notificationTitle(
              item.type,
              item.actorDisplayName || item.actorUsername
            ),
            body: String(item.discussionTitle || "打开社区查看详情").slice(
              0,
              300
            ),
            actionPath: discussionPath(item, item.postNumber),
            read: Boolean(item.read),
            readAt: item.readAt
              ? normalizedTimestamp(item.readAt)
              : null,
            createdAt: normalizedTimestamp(item.createdAt)
          })),
        interactions: interactions
          .filter((item) =>
            /^[1-9][0-9]{0,19}$/.test(
              String(item?.discussionId || "")
            )
          )
          .map((item) => ({
            discussionId: String(item.discussionId),
            title: String(item.title || "社区讨论").slice(0, 160),
            path: discussionPath(item),
            favorited: Boolean(item.favorited),
            liked: Boolean(item.liked),
            updatedAt: normalizedTimestamp(item.updatedAt)
          }))
          .filter((item) => item.path && (item.favorited || item.liked)),
        history: history
          .filter((item) => {
            const discussionId = String(item?.discussionId || "");
            const path = String(item?.path || "");
            return (
              item?.visibleToActor === true &&
              /^[1-9][0-9]{0,19}$/.test(discussionId) &&
              new RegExp(`^/d/${discussionId}-[a-z0-9-]{1,255}$`, "i").test(path)
            );
          })
          .map((item) => ({
            discussionId: String(item.discussionId),
            title: String(item.title || "社区讨论").slice(0, 160),
            path: String(item.path),
            viewedAt: normalizedTimestamp(item.viewedAt)
          })),
        historyCapped: history.length >= 100
      };
    },
    async markRead(username, notificationId) {
      if (!/^[1-9][0-9]{0,19}$/.test(String(notificationId || ""))) {
        const error = new Error("社区提醒标识无效");
        error.status = 400;
        throw error;
      }
      return call({
        action: "mark-read",
        username,
        notificationId: String(notificationId)
      });
    }
  };
}

module.exports = {
  createFlarumPersonalCenterClient,
  discussionPath,
  normalizedTimestamp,
  notificationTitle
};
