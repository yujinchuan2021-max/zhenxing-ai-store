"use strict";

function approvedCommunityOrigin(value) {
  const parsed = new URL(value || "http://127.0.0.1:8088");
  if (
    parsed.href !== `${parsed.origin}/` ||
    !(
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(parsed.hostname))
    )
  ) {
    throw new Error("社区地址必须使用 HTTPS 或本机回环地址");
  }
  return parsed.origin;
}

function validateCommunityLaunchUrl(value, originValue) {
  const origin = approvedCommunityOrigin(originValue);
  const parsed = new URL(value);
  const keys = [...parsed.searchParams.keys()];
  if (
    parsed.origin !== origin ||
    parsed.pathname !== "/aihub-sso.php" ||
    keys.length !== 1 ||
    keys[0] !== "ticket" ||
    !/^[A-Za-z0-9_-]{32,}$/.test(parsed.searchParams.get("ticket") || "") ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error("社区登录地址未通过客户端校验");
  }
  return parsed.href;
}

function isApprovedCommunityNavigation(value, originValue) {
  try {
    const origin = approvedCommunityOrigin(originValue);
    const parsed = new URL(value);
    return (
      parsed.origin === origin &&
      !parsed.username &&
      !parsed.password &&
      ["http:", "https:"].includes(parsed.protocol)
    );
  } catch {
    return false;
  }
}

function communityDiscussionLocation(value, originValue) {
  if (!isApprovedCommunityNavigation(value, originValue)) return null;
  const parsed = new URL(value);
  const match = parsed.pathname.match(/^\/d\/([0-9]{1,20})(?:-[^/?#]+)?(?:\/[0-9]+)?$/);
  if (!match) return null;
  return {
    discussionId: match[1],
    path: parsed.pathname
  };
}

module.exports = {
  approvedCommunityOrigin,
  communityDiscussionLocation,
  isApprovedCommunityNavigation,
  validateCommunityLaunchUrl
};
