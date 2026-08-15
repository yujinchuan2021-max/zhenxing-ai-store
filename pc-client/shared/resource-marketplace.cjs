"use strict";

const {
  normalizeResourceSourceChannel,
  normalizeResourceStoreKind,
  resourceSourceChannel
} = require("./resource-store.cjs");
const {
  canonicalScenarioTags,
  scenarioTag
} = require("./catalog-taxonomy.cjs");
const {
  projectVendorsByDirectory
} = require("./catalog-projections.cjs");

const CONNECTION_FIELDS = new Set([
  "resourceId",
  "hostProductId",
  "connectionMode",
  "bindingKind"
]);
const CONNECTION_MODE_BINDINGS = Object.freeze({
  "remote-mcp": new Set(["mcp-tool", "mcp-resource", "mcp-prompt"]),
  "chatgpt-app": new Set(["connector-authorized-connection"]),
  "claude-connector": new Set(["connector-authorized-connection"]),
  "claude-integration": new Set(["connector-authorized-connection"])
});
const BINDING_RESOURCE_TYPE = Object.freeze({
  "skill-context": "skill",
  "mcp-tool": "mcp",
  "mcp-resource": "mcp",
  "mcp-prompt": "mcp",
  "plugin-host-extension": "plugin",
  "connector-authorized-connection": "connector"
});
const COMPATIBILITY_VALUES = new Set([
  "official",
  "verified",
  "protocol-compatible"
]);

function createResourceMarketplace({ resources, vendors, connections = [] }) {
  const catalogResources = Array.isArray(resources) ? resources : [];
  const resourceById = new Map();
  for (const resource of catalogResources) {
    if (resourceById.has(resource?.id)) {
      throw new Error("resource marketplace duplicate resource id");
    }
    resourceById.set(resource?.id, resource);
  }
  const enabledVendors = (Array.isArray(vendors) ? vendors : []).filter(
    (vendor) => vendor?.enabled !== false
  );
  const publisherById = new Map(
    enabledVendors.map((vendor) => [vendor.id, vendor])
  );
  const hostById = new Map();

  for (const vendor of projectVendorsByDirectory(enabledVendors, "ai-tool")) {
    for (const product of vendor.products) {
      hostById.set(product.id, { vendor, product });
    }
  }
  if (!Array.isArray(connections)) {
    throw new Error("resource marketplace connections invalid");
  }
  const connectionsByResourceId = new Map();
  const connectionKeys = new Set();
  for (const connection of connections) {
    if (
      !connection ||
      typeof connection !== "object" ||
      Array.isArray(connection) ||
      Object.keys(connection).length !== CONNECTION_FIELDS.size ||
      !Object.keys(connection).every((field) => CONNECTION_FIELDS.has(field)) ||
      [...CONNECTION_FIELDS].some(
        (field) => typeof connection[field] !== "string" || !connection[field]
      )
    ) {
      throw new Error("resource marketplace connection fields invalid");
    }
    const allowedBindings = CONNECTION_MODE_BINDINGS[connection.connectionMode];
    if (!allowedBindings) {
      throw new Error("resource marketplace connection mode invalid");
    }
    const resourceType = BINDING_RESOURCE_TYPE[connection.bindingKind];
    if (!resourceType) {
      throw new Error("resource marketplace connection binding invalid");
    }
    const resource = resourceById.get(connection.resourceId);
    if (!resource || resource.enabled === false) {
      throw new Error("resource marketplace connection resource invalid");
    }
    if (!resource.resourceTypes?.includes(resourceType)) {
      throw new Error("resource marketplace connection resource type invalid");
    }
    if (!allowedBindings.has(connection.bindingKind)) {
      throw new Error("resource marketplace connection mode binding invalid");
    }
    if (!hostById.has(connection.hostProductId)) {
      throw new Error("resource marketplace connection host invalid");
    }
    if (
      !resource.targets?.some(
        (target) =>
          target.enabled !== false &&
          target.productId === connection.hostProductId
      )
    ) {
      throw new Error("resource marketplace connection target invalid");
    }
    const key = [
      connection.resourceId,
      connection.hostProductId,
      connection.connectionMode,
      connection.bindingKind
    ].join("\u0000");
    if (connectionKeys.has(key)) {
      throw new Error("resource marketplace duplicate connection");
    }
    connectionKeys.add(key);
    const grouped = connectionsByResourceId.get(connection.resourceId) || [];
    grouped.push(connection);
    connectionsByResourceId.set(connection.resourceId, grouped);
  }

  const entries = catalogResources
    .filter((resource) => resource?.enabled !== false)
    .map((resource) => {
      const hosts = [];
      const seenHostIds = new Set();
      for (const target of resource.targets || []) {
        const host = target?.enabled === false
          ? null
          : hostById.get(target?.productId);
        if (!host || seenHostIds.has(host.product.id)) continue;
        seenHostIds.add(host.product.id);
        hosts.push({ target, ...host });
      }
      hosts.sort(
        (left, right) =>
          (left.vendor.order ?? 0) - (right.vendor.order ?? 0) ||
          left.vendor.name.localeCompare(right.vendor.name, "zh-CN") ||
          (left.product.order ?? 0) - (right.product.order ?? 0) ||
          left.product.name.localeCompare(right.product.name, "zh-CN") ||
          left.product.id.localeCompare(right.product.id)
      );

      const publisherVendor = publisherById.get(resource.publisherVendorId);
      return {
        resource,
        publisher: publisherVendor
          ? { id: publisherVendor.id, name: publisherVendor.name }
          : resource.publisher
            ? { id: null, name: resource.publisher }
            : null,
        hosts,
        connections: connectionsByResourceId.get(resource.id) || []
      };
    })
    .filter((entry) => entry.hosts.length > 0)
    .sort(
      (left, right) =>
        (left.resource.order ?? 0) - (right.resource.order ?? 0) ||
        left.resource.name.localeCompare(right.resource.name, "zh-CN") ||
        left.resource.id.localeCompare(right.resource.id)
    );
  const byId = new Map(entries.map((entry) => [entry.resource.id, entry]));

  function browse({ store = "all", category = "all", hostId = "all", source = "all", compatibility = "all" } = {}) {
    if (store !== "all") store = normalizeResourceStoreKind(store);
    if (source !== "all") source = normalizeResourceSourceChannel(source);
    if (category !== "all") {
      const canonical = scenarioTag(category)?.id;
      if (!canonical) throw new Error("resource marketplace category invalid");
      category = canonical;
    }
    if (typeof hostId !== "string" || !hostId) {
      throw new Error("resource marketplace host invalid");
    }
    if (compatibility !== "all" && !COMPATIBILITY_VALUES.has(compatibility)) {
      throw new Error("resource marketplace compatibility invalid");
    }

    return entries.filter(({ resource, hosts }) =>
      (store === "all" || resource.resourceTypes?.includes(store)) &&
      (category === "all" || canonicalScenarioTags(resource.scenarioTags).includes(category)) &&
      hosts.some(({ product, target }) =>
        (hostId === "all" || product.id === hostId) &&
        (compatibility === "all" || target.compatibility === compatibility)
      ) &&
      (source === "all" || resourceSourceChannel(resource) === source)
    );
  }

  function detail(resourceId) {
    return typeof resourceId === "string" ? byId.get(resourceId) || null : null;
  }

  function facets({ store = "all", source = "all" } = {}) {
    const scenarios = {};
    const compatibility = {
      official: 0,
      verified: 0,
      "protocol-compatible": 0
    };
    for (const entry of browse({ store, source })) {
      for (const tag of canonicalScenarioTags(entry.resource.scenarioTags)) {
        scenarios[tag] = (scenarios[tag] || 0) + 1;
      }
      const seen = new Set(
        entry.hosts
          .map(({ target }) => target.compatibility)
          .filter((value) => COMPATIBILITY_VALUES.has(value))
      );
      for (const value of seen) compatibility[value] += 1;
    }
    return { scenarios, compatibility };
  }

  return Object.freeze({ browse, detail, facets });
}

module.exports = { createResourceMarketplace };
