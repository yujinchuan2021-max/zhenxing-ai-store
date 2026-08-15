"use strict";

const fs = require("node:fs");
const http = require("node:http");

const secret = fs.readFileSync("/run/secrets/community-internal", "utf8");
const consumed = new Set();

http.createServer((request, response) => {
  if (
    request.method !== "POST" ||
    request.url !== "/v1/internal/community/handoffs/redeem" ||
    request.headers["x-aihub-community-secret"] !== secret
  ) {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 4096) request.destroy();
  });
  request.on("end", () => {
    let ticket = "";
    try { ticket = JSON.parse(body).ticket; } catch {}
    if (typeof ticket !== "string" || !/^[A-Za-z0-9_-]{32,}$/.test(ticket) || consumed.has(ticket)) {
      response.writeHead(401, { "Content-Type": "application/json" }).end('{"error":"expired"}');
      return;
    }
    consumed.add(ticket);
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({
      user: {
        id: "11111111-2222-4333-8444-555555555555",
        email: "phasea@example.invalid",
        profile: { nickname: "Phase A", avatarUrl: "" }
      },
      communityUsername: "phasea_user"
    }));
  });
}).listen(3000, "0.0.0.0");
