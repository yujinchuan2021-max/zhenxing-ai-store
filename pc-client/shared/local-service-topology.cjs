"use strict";

const {
  EXPECTED_IDENTITY_CATALOG_FILE,
  EXPECTED_IDENTITY_CATALOG_URL,
  assertLocalServiceRuntimeContracts
} = require("./local-service-release-policy.cjs");

function assertLocalServiceTopology(model) {
  const services = model?.services;
  const admin = services?.admin;
  const identity = services?.["identity-community"];
  if (!admin || !identity || typeof identity !== "object") {
    throw new Error("Local identity/admin service topology is incomplete");
  }

  const contracts = assertLocalServiceRuntimeContracts(model);

  return {
    catalogUrl: EXPECTED_IDENTITY_CATALOG_URL,
    catalogFile: EXPECTED_IDENTITY_CATALOG_FILE,
    adminDependency: "service_healthy",
    rollbackContract: contracts.identityRollback
  };
}

module.exports = {
  EXPECTED_IDENTITY_CATALOG_URL,
  EXPECTED_IDENTITY_CATALOG_FILE,
  assertLocalServiceTopology
};
