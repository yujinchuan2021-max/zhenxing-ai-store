"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  registrationMailSettings
} = require("../identity/smtp-config.cjs");

test("registration stays disabled without SMTP configuration", () => {
  assert.deepEqual(registrationMailSettings({}), {
    enabled: false,
    from: "ZhenXing AI <no-reply@zhenxingai.com>",
    transportOptions: null
  });
});

test("enabled registration requires an SMTP host", () => {
  assert.throws(
    () => registrationMailSettings({ AIHUB_REGISTRATION_ENABLED: "true" }),
    /AIHUB_SMTP_HOST/
  );
});

test("SMTP authentication and TLS settings are explicit", () => {
  assert.deepEqual(
    registrationMailSettings({
      AIHUB_REGISTRATION_ENABLED: "true",
      AIHUB_SMTP_HOST: "smtp.example.com",
      AIHUB_SMTP_PORT: "587",
      AIHUB_SMTP_USER: "mailer",
      AIHUB_SMTP_PASSWORD: "secret"
    }),
    {
      enabled: true,
      from: "ZhenXing AI <no-reply@zhenxingai.com>",
      transportOptions: {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: "mailer", pass: "secret" }
      }
    }
  );
});

