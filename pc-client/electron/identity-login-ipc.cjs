"use strict";

const CHANNEL = "identity:login";
const INPUT_FIELDS = new Set(["identifier", "password"]);
const SNAPSHOT_FIELDS = new Set(["status", "user", "sessionId"]);
const USER_FIELDS = new Set(["id", "email", "phone", "username", "profile"]);
const PROFILE_FIELDS = new Set(["nickname", "avatarUrl", "bio"]);

function plainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactObject(value, fields) {
  return (
    plainObject(value) &&
    Object.keys(value).length === fields.size &&
    Object.keys(value).every((key) => fields.has(key))
  );
}

function boundedString(value, maximum, { allowEmpty = false } = {}) {
  return (
    typeof value === "string" &&
    value.length <= maximum &&
    (allowEmpty || value.length > 0) &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function loginInput(value) {
  if (
    !exactObject(value, INPUT_FIELDS) ||
    !boundedString(value.identifier, 320) ||
    !boundedString(value.password, 4096)
  ) {
    const error = new Error("invalid identity login input");
    error.code = "INVALID_INPUT";
    error.status = 400;
    throw error;
  }
  const identifier = value.identifier.trim();
  if (!identifier) {
    const error = new Error("invalid identity login input");
    error.code = "INVALID_INPUT";
    error.status = 400;
    throw error;
  }
  return { identifier, password: value.password };
}

function loginSnapshot(value) {
  if (
    !exactObject(value, SNAPSHOT_FIELDS) ||
    value.status !== "authenticated" ||
    !boundedString(value.sessionId, 160) ||
    !exactObject(value.user, USER_FIELDS) ||
    !boundedString(value.user.id, 160) ||
    !boundedString(value.user.email, 320) ||
    !boundedString(value.user.phone, 40, { allowEmpty: true }) ||
    !boundedString(value.user.username, 160) ||
    !exactObject(value.user.profile, PROFILE_FIELDS) ||
    !boundedString(value.user.profile.nickname, 160) ||
    !boundedString(value.user.profile.avatarUrl, 2048, { allowEmpty: true }) ||
    !boundedString(value.user.profile.bio, 1000, { allowEmpty: true })
  ) {
    const error = new Error("invalid identity login response");
    error.code = "INVALID_IDENTITY_RESPONSE";
    error.status = 502;
    throw error;
  }
  return {
    status: "authenticated",
    user: {
      id: value.user.id,
      email: value.user.email,
      phone: value.user.phone,
      username: value.user.username,
      profile: {
        nickname: value.user.profile.nickname,
        avatarUrl: value.user.profile.avatarUrl,
        bio: value.user.profile.bio
      }
    },
    sessionId: value.sessionId
  };
}

function loginFailure(error) {
  if (error?.code === "AUTHENTICATION_FAILED" && error?.status === 401) {
    return { code: "AUTHENTICATION_FAILED", status: 401, messageKey: "identity.login.invalidCredentials" };
  }
  if (error?.code === "INVALID_INPUT" && error?.status === 400) {
    return { code: "INVALID_INPUT", status: 400, messageKey: "identity.login.invalid" };
  }
  if (error?.code === "RATE_LIMITED" || error?.status === 429) {
    return { code: "RATE_LIMITED", status: 429, messageKey: "identity.login.rateLimited" };
  }
  if (error?.code === "INVALID_IDENTITY_RESPONSE") {
    return { code: "INVALID_IDENTITY_RESPONSE", status: 502, messageKey: "identity.login.failed" };
  }
  return { code: "TEMPORARILY_UNAVAILABLE", status: 503, messageKey: "identity.login.serviceUnavailable" };
}

function registerIdentityLoginIpc(ipcMain, { getIdentityClient, logError = () => {} }) {
  ipcMain.handle(CHANNEL, async (_event, input) => {
    try {
      return {
        ok: true,
        value: loginSnapshot(await getIdentityClient().login(loginInput(input)))
      };
    } catch (error) {
      const failure = loginFailure(error);
      logError("identity login failed", { code: failure.code, status: failure.status });
      return { ok: false, error: failure };
    }
  });
}

module.exports = { CHANNEL, registerIdentityLoginIpc };
