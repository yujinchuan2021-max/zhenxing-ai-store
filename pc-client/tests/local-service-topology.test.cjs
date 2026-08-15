"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertLocalServiceTopology
} = require("../shared/local-service-topology.cjs");

function validModel() {
  return {
    services: {
      admin: {},
      community: {},
      "identity-community": {
        environment: {
          AIHUB_CATALOG_URL: "http://admin:4173/catalog-v1.json",
          AIHUB_CATALOG_FILE: "/app/catalog/catalog-v1.json"
        },
        depends_on: {
          admin: { condition: "service_healthy", required: true },
          "identity-database": {
            condition: "service_healthy",
            required: true
          }
        },
        volumes: [
          {
            type: "bind",
            source: "C:/project/admin/data",
            target: "/app/catalog",
            read_only: true
          }
        ]
      }
    }
  };
}

test("local identity topology requires the active URL and exact rollback file contract", () => {
  assert.deepEqual(assertLocalServiceTopology(validModel()), {
    catalogUrl: "http://admin:4173/catalog-v1.json",
    catalogFile: "/app/catalog/catalog-v1.json",
    adminDependency: "service_healthy",
    rollbackContract: "identity-catalog-file-v1"
  });

  const missingUrl = validModel();
  delete missingUrl.services["identity-community"].environment.AIHUB_CATALOG_URL;
  assert.throws(
    () => assertLocalServiceTopology(missingUrl),
    /dual catalog runtime contract drift/
  );

  const missingFile = validModel();
  delete missingFile.services["identity-community"].environment.AIHUB_CATALOG_FILE;
  assert.throws(
    () => assertLocalServiceTopology(missingFile),
    /dual catalog runtime contract drift/
  );

  const wrongUrl = validModel();
  wrongUrl.services["identity-community"].environment.AIHUB_CATALOG_URL =
    "http://admin:4173/api/catalog";
  assert.throws(
    () => assertLocalServiceTopology(wrongUrl),
    /dual catalog runtime contract drift/
  );

  const unhealthyDependency = validModel();
  unhealthyDependency.services["identity-community"].depends_on.admin.condition =
    "service_started";
  assert.throws(
    () => assertLocalServiceTopology(unhealthyDependency),
    /healthy admin runtime contract drift/
  );

  const wrongMount = validModel();
  wrongMount.services["identity-community"].volumes = [{
    type: "bind",
    source: "C:/project/admin/published",
    target: "/app/catalog",
    read_only: true
  }];
  assert.throws(
    () => assertLocalServiceTopology(wrongMount),
    /rollback mount contract drift/
  );
});

test("catalog publication and self-built image gates both verify the resolved service topology", () => {
  const publishSource = fs.readFileSync(
    path.resolve(__dirname, "../scripts/publish-local-catalog.cjs"),
    "utf8"
  );
  const imageGateSource = fs.readFileSync(
    path.resolve(__dirname, "../scripts/rebuild-local-app-services.ps1"),
    "utf8"
  );
  const verifierSource = fs.readFileSync(
    path.resolve(__dirname, "../scripts/verify-local-service-topology.cjs"),
    "utf8"
  );
  const liveSourceVerifier = fs.readFileSync(
    path.resolve(__dirname, "../scripts/verify-live-local-service-source.cjs"),
    "utf8"
  );

  assert.match(publishSource, /verify-local-service-topology\.cjs/);
  assert.match(publishSource, /verify-live-local-service-source\.cjs/);
  assert.match(publishSource, /"--service",\s*"admin"/);
  assert.doesNotMatch(publishSource, /"(?:build|up)"\s*,/);
  assert.match(imageGateSource, /local-service-release-policy\.cjs/);
  assert.match(imageGateSource, /"manifest"/);
  assert.match(imageGateSource, /"verify-candidate"/);
  assert.match(imageGateSource, /--network", "none"/);
  assert.match(verifierSource, /docker[\s\S]*compose[\s\S]*config[\s\S]*--format[\s\S]*json/);
  assert.match(verifierSource, /assertLocalServiceTopology/);
  assert.match(liveSourceVerifier, /sourcePathsForService/);
  assert.match(liveSourceVerifier, /docker[\s\S]*exec[\s\S]*sha256sum/);
  assert.match(liveSourceVerifier, /Running local service source drift detected/);
});
