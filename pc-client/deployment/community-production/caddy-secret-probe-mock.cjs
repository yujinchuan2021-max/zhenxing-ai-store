"use strict";

const http = require("node:http");

function approvedSecret(value) {
  return typeof value === "string" && value.length >= 32 && value.length <= 512 && /^[\x20-\x7e]+$/.test(value);
}

http.createServer((request, response) => {
  const path = new URL(request.url, "http://admin").pathname;
  const authorized = approvedSecret(request.headers["x-aihub-cms-secret"]);
  if (request.method === "GET" && path === "/api/community-management") {
    response.writeHead(authorized ? 200 : 403).end();
    return;
  }
  if (request.method === "POST" && path === "/api/community-management/actions") {
    const approved = authorized &&
      request.headers.origin === "http://127.0.0.1:4174" &&
      request.headers["x-aihub-csrf"] === "1" &&
      String(request.headers["content-type"] || "").startsWith("application/json");
    response.writeHead(approved ? 200 : 403).end();
    return;
  }
  response.writeHead(request.method === "GET" ? 404 : 503).end();
}).listen(4173, "0.0.0.0");
