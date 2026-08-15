"use strict";

function isAdminReadOnly(env = process.env) {
  return env.AIHUB_ADMIN_READ_ONLY === "1";
}

function isAdminReadOnlyWriteBlocked(readOnly, method, pathname) {
  if (!readOnly || method === "GET") return false;
  return !(method === "POST" && pathname === "/api/community-management/actions");
}

module.exports = { isAdminReadOnly, isAdminReadOnlyWriteBlocked };
