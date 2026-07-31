"use strict";

const ACCEPTED_STATUS_CODES = new Set([200, 206]);
const CURL_MAX_FILESIZE_EXIT_CODE = 63;
const EXECUTABLE_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/vnd.microsoft.portable-executable",
  "application/zip",
  "application/x-7z-compressed"
]);

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCurlProbeOutput(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("curl probe did not return response metadata");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error("curl probe returned invalid response metadata");
  }
  if (!plainObject(parsed)) {
    throw new Error("curl probe response metadata is not an object");
  }
  const statusCode = Number(parsed.response_code);
  if (!Number.isInteger(statusCode) || statusCode < 0 || statusCode > 999) {
    throw new Error("curl probe returned an invalid HTTP status");
  }
  return {
    statusCode,
    finalUrl:
      typeof parsed.url_effective === "string" ? parsed.url_effective : "",
    contentType:
      typeof parsed.content_type === "string" ? parsed.content_type : ""
  };
}

function normalizedContentType(value) {
  return String(value || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
}

function normalizedAllowedHosts(plan) {
  if (!Array.isArray(plan?.allowedHosts)) return new Set();
  return new Set(
    plan.allowedHosts
      .filter((host) => typeof host === "string")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function evaluateDesktopSourceProbe({ plan, probe }) {
  const reasons = [];
  const warnings = [];
  const allowedHosts = normalizedAllowedHosts(plan);
  const statusCode = Number(probe?.statusCode || 0);
  const exitCode = Number(probe?.exitCode || 0);

  if (!ACCEPTED_STATUS_CODES.has(statusCode)) {
    reasons.push(`HTTP ${statusCode || "unknown"} is not a downloadable response`);
  }

  let finalUrl;
  try {
    finalUrl = new URL(String(probe?.finalUrl || ""));
  } catch {
    reasons.push("final download URL is invalid");
  }
  if (finalUrl) {
    if (finalUrl.protocol !== "https:") {
      reasons.push("final download URL is not HTTPS");
    }
    if (!allowedHosts.has(finalUrl.hostname.toLowerCase())) {
      reasons.push(
        `final host ${finalUrl.hostname || "unknown"} is outside the reviewed host list`
      );
    }
  }

  const contentType = normalizedContentType(probe?.contentType);
  const hasWindowsExecutableMagic = String(probe?.magicHex || "")
    .toLowerCase()
    .startsWith("4d5a");
  if (!contentType) {
    warnings.push("response did not declare a content type");
  } else if (
    contentType.startsWith("text/") ||
    contentType.includes("html") ||
    contentType.includes("json") ||
    contentType.includes("xml")
  ) {
    if (hasWindowsExecutableMagic) {
      warnings.push(`server mislabeled an MZ executable as ${contentType}`);
    } else {
      reasons.push(`content type ${contentType} is not an installer payload`);
    }
  } else if (!EXECUTABLE_CONTENT_TYPES.has(contentType)) {
    warnings.push(`uncommon installer content type: ${contentType}`);
  }

  if (exitCode === CURL_MAX_FILESIZE_EXIT_CODE) {
    if (ACCEPTED_STATUS_CODES.has(statusCode)) {
      warnings.push(
        statusCode === 200
          ? "server ignored Range; max-filesize stopped body transfer"
          : "max-filesize stopped body transfer after response headers"
      );
    } else {
      reasons.push("curl stopped the transfer before a valid response was confirmed");
    }
  } else if (exitCode !== 0) {
    reasons.push(
      `curl exited with code ${exitCode}${probe?.error ? `: ${probe.error}` : ""}`
    );
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings
  };
}

module.exports = {
  evaluateDesktopSourceProbe,
  parseCurlProbeOutput
};
