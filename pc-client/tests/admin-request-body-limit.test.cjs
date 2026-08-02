"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const test = require("node:test");
const {
  CATALOG_JSON_BODY_LIMIT_BYTES,
  DEFAULT_JSON_BODY_LIMIT_BYTES,
  readJson
} = require("../admin/request-json.cjs");

function jsonWithByteLength(byteLength) {
  const wrapperBytes = Buffer.byteLength('{"value":""}');
  return `{"value":"${"a".repeat(byteLength - wrapperBytes)}"}`;
}

test("admin JSON bodies keep a 1 MiB default and a 4 MiB catalog boundary", async () => {
  for (const limit of [
    DEFAULT_JSON_BODY_LIMIT_BYTES,
    CATALOG_JSON_BODY_LIMIT_BYTES
  ]) {
    const accepted = jsonWithByteLength(limit);
    assert.equal(Buffer.byteLength(accepted), limit);
    assert.equal(
      (await readJson(Readable.from([Buffer.from(accepted)]), limit)).value.length,
      limit - Buffer.byteLength('{"value":""}')
    );
    await assert.rejects(
      readJson(
        Readable.from([Buffer.from(jsonWithByteLength(limit + 1))]),
        limit
      ),
      new RegExp(`${limit / (1024 * 1024)} MB`)
    );
  }
});

test("only PUT /api/catalog opts into the 4 MiB request limit", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "admin", "server.cjs"),
    "utf8"
  );
  const routeStart = source.indexOf(
    'request.method === "PUT" && pathname === "/api/catalog"'
  );
  const routeEnd = source.indexOf(
    'request.method === "GET" && pathname === "/api/release"',
    routeStart
  );
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  assert.match(
    source.slice(routeStart, routeEnd),
    /readJson\(request, CATALOG_JSON_BODY_LIMIT_BYTES\)/
  );
  assert.doesNotMatch(
    source.slice(0, routeStart) + source.slice(routeEnd),
    /readJson\(request, CATALOG_JSON_BODY_LIMIT_BYTES\)/
  );
});
