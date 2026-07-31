"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  approvedCommunityOrigin,
  communityDiscussionLocation,
  isApprovedCommunityNavigation,
  validateCommunityLaunchUrl
} = require("../shared/community-embed.cjs");

test("accepts only a fixed HTTPS or loopback community origin", () => {
  assert.equal(
    approvedCommunityOrigin("http://127.0.0.1:8088"),
    "http://127.0.0.1:8088"
  );
  assert.equal(
    approvedCommunityOrigin("https://community.example.com"),
    "https://community.example.com"
  );
  assert.throws(() => approvedCommunityOrigin("http://community.example.com"));
  assert.throws(() =>
    approvedCommunityOrigin("https://community.example.com/forum")
  );
});

test("validates one-time embedded community launch URLs exactly", () => {
  const ticket = "a".repeat(43);
  assert.equal(
    validateCommunityLaunchUrl(
      `http://127.0.0.1:8088/aihub-sso.php?ticket=${ticket}`,
      "http://127.0.0.1:8088"
    ),
    `http://127.0.0.1:8088/aihub-sso.php?ticket=${ticket}`
  );
  assert.throws(() =>
    validateCommunityLaunchUrl(
      `http://127.0.0.1:8088/aihub-sso.php?ticket=${ticket}&next=https://evil.example`,
      "http://127.0.0.1:8088"
    )
  );
  assert.throws(() =>
    validateCommunityLaunchUrl(
      `https://evil.example/aihub-sso.php?ticket=${ticket}`,
      "http://127.0.0.1:8088"
    )
  );
});

test("keeps embedded navigation same-origin and identifies discussions", () => {
  const origin = "http://127.0.0.1:8088";
  assert.equal(
    isApprovedCommunityNavigation(`${origin}/all`, origin),
    true
  );
  assert.equal(
    isApprovedCommunityNavigation("https://evil.example/", origin),
    false
  );
  assert.deepEqual(
    communityDiscussionLocation(`${origin}/d/42-ai-hub/3`, origin),
    { discussionId: "42", path: "/d/42-ai-hub/3" }
  );
  assert.equal(communityDiscussionLocation(`${origin}/tags`, origin), null);
});
