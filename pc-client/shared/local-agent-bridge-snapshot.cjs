"use strict";

const ID = /^[a-z0-9][a-z0-9._:-]{0,159}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEWED = new Set(["automated-reviewed", "manually-reviewed"]);

function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exact(value, fields) {
  return plain(value) && Object.keys(value).length === fields.length &&
    Object.keys(value).every((field) => fields.includes(field));
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function planningRelease(value, workflow) {
  return exact(value, ["workflowId", "version", "reviewStatus", "riskLevel", "content"]) &&
    value.workflowId === workflow.workflowId && value.version === workflow.version &&
    REVIEWED.has(value.reviewStatus) && ["low", "guarded"].includes(value.riskLevel) &&
    exact(value.content, ["title", "summary", "inputs", "outputs", "instructions", "dependencies", "secretPlaceholders"]) &&
    Array.isArray(value.content.inputs) && Array.isArray(value.content.outputs) &&
    Array.isArray(value.content.instructions) && Array.isArray(value.content.dependencies) &&
    Array.isArray(value.content.secretPlaceholders) &&
    value.content.secretPlaceholders.every((entry) => exact(entry, ["name", "description"]) &&
      typeof entry.name === "string" && typeof entry.description === "string");
}

function planInput(value, workflow) {
  return exact(value, [
    "contractVersion", "workflow", "primaryAgentProductId", "requiredAgentHostProductId",
    "requirements", "steps"
  ]) && value.contractVersion === 1 && exact(value.workflow, ["workflowId", "version"]) &&
    value.workflow.workflowId === workflow.workflowId && value.workflow.version === workflow.version &&
    (value.primaryAgentProductId === null || ID.test(value.primaryAgentProductId)) &&
    (value.requiredAgentHostProductId === null || ID.test(value.requiredAgentHostProductId)) &&
    Array.isArray(value.requirements) && Array.isArray(value.steps);
}

function validRequest(request) {
  return exact(request, ["agentId", "sessionId", "workflow"]) &&
    (request.agentId === null || ID.test(request.agentId)) &&
    (request.sessionId === null || ID.test(request.sessionId)) &&
    (request.workflow === null || (exact(request.workflow, ["workflowId", "version"]) &&
      UUID.test(request.workflow.workflowId) && Number.isSafeInteger(request.workflow.version) && request.workflow.version > 0));
}

function createLocalAgentBridgeSnapshotAdapter({
  readCatalogResult,
  readSession,
  listPublicWorkflows = async () => [],
  resolvePlanningRelease,
  resolveAgentBridgePlanInput
} = {}) {
  if (typeof readCatalogResult !== "function" || typeof readSession !== "function" ||
      typeof listPublicWorkflows !== "function" || typeof resolvePlanningRelease !== "function" ||
      typeof resolveAgentBridgePlanInput !== "function") {
    throw new TypeError("Local Agent Bridge snapshot dependencies are invalid");
  }

  return async function readSnapshot(request) {
    if (!validRequest(request)) return freeze({});
    const [catalogResult, publicWorkflows, session] = await Promise.all([
      readCatalogResult().catch(() => null),
      listPublicWorkflows().catch(() => []),
      request.agentId && request.sessionId
        ? readSession({ agentId: request.agentId, sessionId: request.sessionId }).catch(() => null)
        : Promise.resolve(null)
    ]);
    let planning = null;
    if (request.workflow) {
      const release = await resolvePlanningRelease(request.workflow).catch(() => null);
      if (planningRelease(release, request.workflow)) {
        const candidate = await resolveAgentBridgePlanInput({
          workflowRelease: release,
          agentId: request.agentId,
          sessionId: request.sessionId
        }).catch(() => null);
        const agentBridgePlanInput = candidate?.agentBridgePlanInput || candidate;
        if (planInput(agentBridgePlanInput, request.workflow)) {
          planning = freeze({
            workflowRelease: copy(release),
            agentBridgePlanInput: copy(agentBridgePlanInput)
          });
        }
      }
    }
    return freeze({
      catalogResult: catalogResult || null,
      publicWorkflows: Array.isArray(publicWorkflows) ? copy(publicWorkflows) : [],
      ownerWorkflows: [],
      planning,
      session: session || null
    });
  };
}

module.exports = { createLocalAgentBridgeSnapshotAdapter };
