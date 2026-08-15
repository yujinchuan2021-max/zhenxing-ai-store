"use strict";

const {
  DEPENDENCY_PERMISSIONS,
  RESOURCE_BINDING_KINDS
} = require("./workflow-store.cjs");

const WORKFLOW_COMPOSITION_CONTRACT_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANONICAL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const STEP_ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const DATA_TYPES = new Set(["text", "number", "boolean", "image", "file-reference"]);
const RESOURCE_BINDING_SET = new Set(RESOURCE_BINDING_KINDS);
const PERMISSION_SET = new Set(DEPENDENCY_PERMISSIONS);

class WorkflowCompositionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkflowCompositionError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new WorkflowCompositionError(code, message);
}

function isObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactObject(value, allowed, required = allowed) {
  if (!isObject(value)) fail("INVALID_SCHEMA", "Expected a plain JSON object");
  const keys = Object.keys(value);
  if (
    keys.some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    fail("INVALID_SCHEMA", "Object fields are outside the composition contract");
  }
  return value;
}

function canonicalId(value, field) {
  const normalized = String(value || "").trim();
  if (!CANONICAL_ID_PATTERN.test(normalized)) {
    fail("INVALID_SCHEMA", `${field} is not a canonical identifier`);
  }
  return normalized;
}

function fieldName(value, field) {
  const normalized = String(value || "").trim();
  if (!FIELD_NAME_PATTERN.test(normalized)) {
    fail("INVALID_SCHEMA", `${field} is not a field name`);
  }
  return normalized;
}

function stepId(value) {
  const normalized = String(value || "").trim();
  if (!STEP_ID_PATTERN.test(normalized)) {
    fail("INVALID_SCHEMA", "stepId is invalid");
  }
  return normalized;
}

function workflowId(value) {
  const normalized = String(value || "").trim();
  if (!UUID_PATTERN.test(normalized)) {
    fail("INVALID_RELEASE_SOURCE", "workflowId is invalid");
  }
  return normalized.toLowerCase();
}

function version(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail("INVALID_RELEASE_SOURCE", "version must be a positive integer");
  }
  return value;
}

function dataType(value, field) {
  if (!DATA_TYPES.has(value)) fail("INVALID_SCHEMA", `${field} has an unsupported type`);
  return value;
}

function dependencyKey(dependency) {
  return [
    dependency.kind,
    dependency.canonicalId,
    dependency.hostProductId || "",
    dependency.bindingKind || ""
  ].join("\u0000");
}

function copyDependency(dependency) {
  return {
    kind: dependency.kind,
    canonicalId: dependency.canonicalId,
    ...(dependency.kind === "resource"
      ? {
          hostProductId: dependency.hostProductId,
          bindingKind: dependency.bindingKind
        }
      : {}),
    permissions: [...dependency.permissions]
  };
}

function copyDependencyReference(dependency) {
  return {
    kind: dependency.kind,
    canonicalId: dependency.canonicalId,
    ...(dependency.kind === "resource"
      ? {
          hostProductId: dependency.hostProductId,
          bindingKind: dependency.bindingKind
        }
      : {})
  };
}

function normalizePermissions(value) {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > DEPENDENCY_PERMISSIONS.length ||
    new Set(value).size !== value.length ||
    value.some((permission) => typeof permission !== "string" || !PERMISSION_SET.has(permission))
  ) {
    fail("INVALID_RELEASE_SOURCE", "Release dependency permissions are invalid");
  }
  if (value.includes("none") && value.length !== 1) {
    fail("INVALID_RELEASE_SOURCE", "none cannot be combined with another permission");
  }
  return [...value];
}

function normalizeReleaseFields(entries, kind) {
  if (!Array.isArray(entries) || entries.length > 32) {
    fail("INVALID_RELEASE_SOURCE", `Release ${kind}s are invalid`);
  }
  const names = new Set();
  const allowed = kind === "input"
    ? ["name", "type", "required", "description"]
    : ["name", "type", "description"];
  return entries.map((entry) => {
    exactObject(entry, allowed);
    const name = fieldName(entry.name, `Release ${kind}.name`);
    if (names.has(name)) fail("INVALID_RELEASE_SOURCE", `Release ${kind} names must be unique`);
    names.add(name);
    dataType(entry.type, `Release ${kind}.type`);
    if (kind === "input" && typeof entry.required !== "boolean") {
      fail("INVALID_RELEASE_SOURCE", "Release input.required must be boolean");
    }
    if (typeof entry.description !== "string") {
      fail("INVALID_RELEASE_SOURCE", `Release ${kind}.description must be text`);
    }
    return { name, type: entry.type };
  });
}

function normalizeReleaseDependencies(entries) {
  if (!Array.isArray(entries) || entries.length > 32) {
    fail("INVALID_RELEASE_SOURCE", "Release dependencies are invalid");
  }
  const seen = new Set();
  return entries.map((entry) => {
    if (!isObject(entry) || (entry.kind !== "product" && entry.kind !== "resource")) {
      fail("INVALID_RELEASE_SOURCE", "Release dependency kind is invalid");
    }
    exactObject(
      entry,
      entry.kind === "product"
        ? ["kind", "canonicalId", "permissions"]
        : ["kind", "canonicalId", "hostProductId", "bindingKind", "permissions"]
    );
    const normalized = {
      kind: entry.kind,
      canonicalId: canonicalId(entry.canonicalId, "Release dependency.canonicalId"),
      permissions: normalizePermissions(entry.permissions)
    };
    if (entry.kind === "resource") {
      normalized.hostProductId = canonicalId(entry.hostProductId, "Release dependency.hostProductId");
      if (!RESOURCE_BINDING_SET.has(entry.bindingKind)) {
        fail("INVALID_RELEASE_SOURCE", "Release dependency.bindingKind is invalid");
      }
      normalized.bindingKind = entry.bindingKind;
    }
    const key = dependencyKey(normalized);
    if (seen.has(key)) fail("INVALID_RELEASE_SOURCE", "Release dependencies must be unique");
    seen.add(key);
    return normalized;
  });
}

function normalizeReleaseSource(value) {
  if (!isObject(value) || !Object.hasOwn(value, "workflowId") || !Object.hasOwn(value, "version")) {
    fail("INVALID_RELEASE_SOURCE", "workflowRelease is required");
  }
  if (!isObject(value.content)) {
    fail("INVALID_RELEASE_SOURCE", "workflowRelease.content is required");
  }
  const content = value.content;
  const allowedContent = [
    "title",
    "summary",
    "inputs",
    "outputs",
    "instructions",
    "dependencies",
    "secretPlaceholders"
  ];
  exactObject(content, allowedContent);
  if (
    typeof content.title !== "string" ||
    typeof content.summary !== "string" ||
    !Array.isArray(content.instructions) ||
    !Array.isArray(content.secretPlaceholders)
  ) {
    fail("INVALID_RELEASE_SOURCE", "workflowRelease.content is not a WorkflowRelease content snapshot");
  }
  return {
    workflow: {
      workflowId: workflowId(value.workflowId),
      version: version(value.version)
    },
    inputs: normalizeReleaseFields(content.inputs, "input"),
    outputs: normalizeReleaseFields(content.outputs, "output"),
    dependencies: normalizeReleaseDependencies(content.dependencies)
  };
}

function normalizeStepDependency(value, releaseDependencies) {
  if (!isObject(value) || (value.kind !== "product" && value.kind !== "resource")) {
    fail("INVALID_SCHEMA", "Step dependency kind is invalid");
  }
  exactObject(
    value,
    value.kind === "product"
      ? ["kind", "canonicalId"]
      : ["kind", "canonicalId", "hostProductId", "bindingKind"]
  );
  const reference = {
    kind: value.kind,
    canonicalId: canonicalId(value.canonicalId, "Step dependency.canonicalId")
  };
  if (value.kind === "resource") {
    reference.hostProductId = canonicalId(value.hostProductId, "Step dependency.hostProductId");
    if (!RESOURCE_BINDING_SET.has(value.bindingKind)) {
      fail("INVALID_SCHEMA", "Step dependency.bindingKind is invalid");
    }
    reference.bindingKind = value.bindingKind;
  }
  const source = releaseDependencies.get(dependencyKey(reference));
  if (!source) {
    fail("DEPENDENCY_NOT_ALLOWED", "Step dependency is not an exact WorkflowRelease dependency");
  }
  return { reference, source };
}

function normalizeStepInput(entry, workflowInputs, priorOutputs) {
  exactObject(entry, ["name", "type", "from"]);
  const name = fieldName(entry.name, "Step input.name");
  const type = dataType(entry.type, "Step input.type");
  if (!isObject(entry.from)) fail("INVALID_SCHEMA", "Step input.from is required");

  let source;
  let from;
  if (entry.from.kind === "workflow-input") {
    exactObject(entry.from, ["kind", "name"]);
    const sourceName = fieldName(entry.from.name, "workflow-input.name");
    source = workflowInputs.get(sourceName);
    if (!source) fail("UNKNOWN_WORKFLOW_INPUT", "Step input does not reference a WorkflowRelease input");
    from = { kind: "workflow-input", name: sourceName };
  } else if (entry.from.kind === "step-output") {
    exactObject(entry.from, ["kind", "stepId", "name"]);
    const sourceStepId = stepId(entry.from.stepId);
    const sourceName = fieldName(entry.from.name, "step-output.name");
    source = priorOutputs.get(sourceName);
    if (!source || source.stepId !== sourceStepId) {
      fail("UNKNOWN_STEP_OUTPUT", "Step input must reference a declared prior step output");
    }
    from = { kind: "step-output", stepId: sourceStepId, name: sourceName };
  } else {
    fail("INVALID_SCHEMA", "Step input source kind is invalid");
  }
  if (source.type !== type) {
    fail("SOURCE_TYPE_MISMATCH", "Step input type must match its declared source");
  }
  return { name, type, from };
}

function normalizeSteps(steps, release) {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 32) {
    fail("INVALID_SCHEMA", "steps must contain 1-32 ordered entries");
  }
  const workflowInputs = new Map(release.inputs.map((entry) => [entry.name, entry]));
  const workflowOutputs = new Map(release.outputs.map((entry) => [entry.name, entry]));
  const releaseDependencies = new Map(
    release.dependencies.map((entry) => [dependencyKey(entry), entry])
  );
  const stepIds = new Set();
  const outputNames = new Set();
  const priorOutputs = new Map();
  const usedDependencies = new Map();
  const normalized = steps.map((entry) => {
    if (isObject(entry) && Object.hasOwn(entry, "dependsOn")) {
      fail("DAG_NOT_SUPPORTED", "dependsOn is not supported by the ordered V1 composition contract");
    }
    exactObject(entry, ["stepId", "dependency", "inputs", "outputs"]);
    const normalizedStepId = stepId(entry.stepId);
    if (stepIds.has(normalizedStepId)) fail("INVALID_SCHEMA", "stepId values must be unique");
    stepIds.add(normalizedStepId);
    const dependency = normalizeStepDependency(entry.dependency, releaseDependencies);
    const dependencyKeyValue = dependencyKey(dependency.source);
    if (!usedDependencies.has(dependencyKeyValue)) {
      usedDependencies.set(dependencyKeyValue, copyDependency(dependency.source));
    }

    if (!Array.isArray(entry.inputs) || entry.inputs.length > 32) {
      fail("INVALID_SCHEMA", "Step inputs must contain at most 32 entries");
    }
    const inputNames = new Set();
    const inputs = entry.inputs.map((input) => {
      const normalizedInput = normalizeStepInput(input, workflowInputs, priorOutputs);
      if (inputNames.has(normalizedInput.name)) {
        fail("INVALID_SCHEMA", "Step input names must be unique");
      }
      inputNames.add(normalizedInput.name);
      return normalizedInput;
    });

    if (!Array.isArray(entry.outputs) || entry.outputs.length < 1 || entry.outputs.length > 32) {
      fail("INVALID_SCHEMA", "Step outputs must contain 1-32 declared entries");
    }
    const outputs = entry.outputs.map((output) => {
      exactObject(output, ["name", "type"]);
      const name = fieldName(output.name, "Step output.name");
      const type = dataType(output.type, "Step output.type");
      if (workflowInputs.has(name) || outputNames.has(name)) {
        fail("DUPLICATE_OUTPUT", "Step outputs cannot shadow workflow inputs or another step output");
      }
      const workflowOutput = workflowOutputs.get(name);
      if (workflowOutput && workflowOutput.type !== type) {
        fail("WORKFLOW_OUTPUT_MISMATCH", "Step output type must match the declared WorkflowRelease output");
      }
      outputNames.add(name);
      priorOutputs.set(name, { stepId: normalizedStepId, type });
      return { name, type };
    });
    return {
      stepId: normalizedStepId,
      dependency: copyDependencyReference(dependency.source),
      inputs,
      outputs
    };
  });

  for (const output of release.outputs) {
    const actual = priorOutputs.get(output.name);
    if (!actual || actual.type !== output.type) {
      fail("WORKFLOW_OUTPUT_MISMATCH", "Each WorkflowRelease output must be declared by one composition step");
    }
  }
  return { steps: normalized, usedDependencies: [...usedDependencies.values()] };
}

function normalizeRunSelection(value, workflow, requiredAgentHostProductId) {
  if (value === undefined) return null;
  exactObject(value, ["primaryAgentProductId"]);
  const primaryAgentProductId = canonicalId(value.primaryAgentProductId, "runSelection.primaryAgentProductId");
  if (requiredAgentHostProductId && primaryAgentProductId !== requiredAgentHostProductId) {
    fail("AGENT_HOST_MISMATCH", "Selected primary Agent does not match the composition host constraint");
  }
  return {
    workflow: { ...workflow },
    primaryAgentProductId
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizeWorkflowComposition(input) {
  exactObject(input, ["workflowRelease", "steps", "runSelection"], ["workflowRelease", "steps"]);
  const release = normalizeReleaseSource(input.workflowRelease);
  const normalizedSteps = normalizeSteps(input.steps, release);
  const hostProductIds = new Set(
    normalizedSteps.usedDependencies
      .filter((dependency) => dependency.kind === "resource")
      .map((dependency) => dependency.hostProductId)
  );
  if (hostProductIds.size > 1) {
    fail("MULTIPLE_AGENT_HOSTS_UNSUPPORTED", "Ordered V1 compositions support one resource host only");
  }
  const requiredAgentHostProductId = hostProductIds.values().next().value || null;
  const runSelection = normalizeRunSelection(
    input.runSelection,
    release.workflow,
    requiredAgentHostProductId
  );
  const composition = {
    contractVersion: WORKFLOW_COMPOSITION_CONTRACT_VERSION,
    workflow: { ...release.workflow },
    steps: normalizedSteps.steps
  };
  return deepFreeze({
    composition,
    runSelection,
    agentBridgePlanInput: {
      contractVersion: WORKFLOW_COMPOSITION_CONTRACT_VERSION,
      workflow: { ...release.workflow },
      primaryAgentProductId: runSelection ? runSelection.primaryAgentProductId : null,
      requiredAgentHostProductId,
      requirements: normalizedSteps.usedDependencies,
      steps: normalizedSteps.steps
    }
  });
}

module.exports = {
  WORKFLOW_COMPOSITION_CONTRACT_VERSION,
  WorkflowCompositionError,
  normalizeWorkflowComposition
};
