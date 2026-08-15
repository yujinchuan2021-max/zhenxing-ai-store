"use strict";

function enabled(value) {
  return ["1", "true", "yes"].includes(String(value || "").trim().toLowerCase());
}

function registrationMailSettings(env = process.env) {
  const active = enabled(env.AIHUB_REGISTRATION_ENABLED);
  const from = String(
    env.AIHUB_MAIL_FROM || "ZhenXing AI <no-reply@zhenxingai.com>"
  ).trim();
  if (!active) {
    return { enabled: false, from, transportOptions: null };
  }

  const host = String(env.AIHUB_SMTP_HOST || "").trim();
  const port = Number(env.AIHUB_SMTP_PORT || 587);
  if (!host) throw new Error("AIHUB_SMTP_HOST is required when registration is enabled");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("AIHUB_SMTP_PORT is invalid");
  }

  const secure = enabled(env.AIHUB_SMTP_SECURE);
  const user = String(env.AIHUB_SMTP_USER || "").trim();
  const password = String(env.AIHUB_SMTP_PASSWORD || "");
  if (Boolean(user) !== Boolean(password)) {
    throw new Error("AIHUB_SMTP_USER and AIHUB_SMTP_PASSWORD must be set together");
  }

  const transportOptions = { host, port, secure };
  if (!secure && env.AIHUB_SMTP_REQUIRE_TLS !== "false") {
    transportOptions.requireTLS = true;
  }
  if (user) transportOptions.auth = { user, pass: password };
  return { enabled: true, from, transportOptions };
}

module.exports = { registrationMailSettings };

