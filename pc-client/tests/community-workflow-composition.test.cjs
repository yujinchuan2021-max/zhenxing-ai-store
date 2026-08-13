"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  WORKFLOW_COMPOSITION_CONTRACT_VERSION,
  WorkflowCompositionError,
  normalizeWorkflowComposition
} = require("../community/workflow-composition.cjs");

const WORKFLOW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function release(overrides = {}) {
  return {
    workflowId: WORKFLOW_ID,
    version: 3,
    content: {
      title: "Image summary",
      summary: "A reviewed data-only workflow release.",
      inputs: [
        { name: "source_image", type: "image", required: true, description: "Selected image" },
        { name: "user_note", type: "text", required: false, description: "Optional context" }
      ],
      outputs: [
        { name: "summary", type: "text", description: "Generated summary" }
      ],
      instructions: ["Use reviewed resources only."],
      dependencies: [
        {
          kind: "product",
          canonicalId: "example-agent",
          permissions: ["none"]
        },
        {
          kind: "resource",
          canonicalId: "reviewed-image-skill",
          hostProductId: "example-agent",
          bindingKind: "skill-context",
          permissions: ["read-selected-input"]
        },
        {
          kind: "resource",
          canonicalId: "reviewed-summary-tool",
          hostProductId: "example-agent",
          bindingKind: "mcp-tool",
          permissions: ["read-selected-input", "write-selected-output"]
        }
      ],
      secretPlaceholders: [],
      ...overrides
    }
  };
}

function validInput(overrides = {}) {
  return {
    workflowRelease: release(),
    steps: [
      {
        stepId: "prepare_image",
        dependency: {
          kind: "resource",
          canonicalId: "reviewed-image-skill",
          hostProductId: "example-agent",
          bindingKind: "skill-context"
        },
        inputs: [
          {
            name: "image",
            type: "image",
            from: { kind: "workflow-input", name: "source_image" }
          }
        ],
        outputs: [{ name: "prepared_image", type: "image" }]
      },
      {
        stepId: "summarize",
        dependency: {
          kind: "resource",
          canonicalId: "reviewed-summary-tool",
          hostProductId: "example-agent",
          bindingKind: "mcp-tool"
        },
        inputs: [
          {
            name: "image",
            type: "image",
            from: { kind: "step-output", stepId: "prepare_image", name: "prepared_image" }
          },
          {
            name: "note",
            type: "text",
            from: { kind: "workflow-input", name: "user_note" }
          }
        ],
        outputs: [{ name: "summary", type: "text" }]
      }
    ],
    runSelection: { primaryAgentProductId: "example-agent" },
    ...overrides
  };
}

function expectCompositionError(action, code) {
  assert.throws(
    action,
    (error) => error instanceof WorkflowCompositionError && error.code === code
  );
}

test("normalizes an ordered composition and exposes a frozen Agent Bridge DTO", () => {
  const result = normalizeWorkflowComposition(validInput());

  assert.equal(result.composition.contractVersion, WORKFLOW_COMPOSITION_CONTRACT_VERSION);
  assert.deepEqual(result.composition.workflow, { workflowId: WORKFLOW_ID, version: 3 });
  assert.deepEqual(result.composition.steps.map((step) => step.stepId), ["prepare_image", "summarize"]);
  assert.deepEqual(result.composition.steps[1].inputs[0].from, {
    kind: "step-output",
    stepId: "prepare_image",
    name: "prepared_image"
  });
  assert.equal(result.runSelection.primaryAgentProductId, "example-agent");
  assert.equal(result.agentBridgePlanInput.requiredAgentHostProductId, "example-agent");
  assert.deepEqual(
    result.agentBridgePlanInput.requirements.map((dependency) => dependency.canonicalId),
    ["reviewed-image-skill", "reviewed-summary-tool"]
  );
  assert.deepEqual(result.agentBridgePlanInput.requirements[1].permissions, [
    "read-selected-input",
    "write-selected-output"
  ]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.composition.steps), true);
  assert.equal(Object.isFrozen(result.agentBridgePlanInput.requirements[0].permissions), true);
  assert.throws(() => {
    result.composition.steps[0].stepId = "changed";
  }, TypeError);
});

test("rejects future, self, cyclic, and DAG output dependencies in ordered V1", () => {
  const future = validInput();
  future.steps[0].inputs[0].from = {
    kind: "step-output",
    stepId: "summarize",
    name: "summary"
  };
  expectCompositionError(() => normalizeWorkflowComposition(future), "UNKNOWN_STEP_OUTPUT");

  const self = validInput();
  self.steps[0].inputs[0].from = {
    kind: "step-output",
    stepId: "prepare_image",
    name: "prepared_image"
  };
  expectCompositionError(() => normalizeWorkflowComposition(self), "UNKNOWN_STEP_OUTPUT");

  const cycle = validInput();
  cycle.steps[0].inputs[0].from = {
    kind: "step-output",
    stepId: "summarize",
    name: "summary"
  };
  cycle.steps[1].inputs[0].from = {
    kind: "step-output",
    stepId: "prepare_image",
    name: "prepared_image"
  };
  expectCompositionError(() => normalizeWorkflowComposition(cycle), "UNKNOWN_STEP_OUTPUT");

  const dag = validInput();
  dag.steps[1].dependsOn = ["prepare_image"];
  expectCompositionError(() => normalizeWorkflowComposition(dag), "DAG_NOT_SUPPORTED");
});

test("rejects unknown, altered, and over-privileged dependency references", () => {
  const unknown = validInput();
  unknown.steps[0].dependency.canonicalId = "unreviewed-resource";
  expectCompositionError(() => normalizeWorkflowComposition(unknown), "DEPENDENCY_NOT_ALLOWED");

  const alteredTuple = validInput();
  alteredTuple.steps[0].dependency.bindingKind = "mcp-prompt";
  expectCompositionError(() => normalizeWorkflowComposition(alteredTuple), "DEPENDENCY_NOT_ALLOWED");

  const overPrivileged = validInput();
  overPrivileged.steps[0].dependency.permissions = ["approved-network"];
  expectCompositionError(() => normalizeWorkflowComposition(overPrivileged), "INVALID_SCHEMA");
});

test("rejects executable, secret, URL, path, node, and commercial fields", () => {
  for (const [field, value] of Object.entries({
    command: "run",
    script: "alert(1)",
    url: "https://example.invalid",
    path: "C:\\secret.txt",
    secret: "value",
    nodes: [],
    price: 1,
    order: "order-1"
  })) {
    const input = clone(validInput());
    input.steps[0][field] = value;
    expectCompositionError(() => normalizeWorkflowComposition(input), "INVALID_SCHEMA");
  }
});

test("rejects invalid output declarations and preserves local Agent selection boundaries", () => {
  const missingWorkflowOutput = validInput();
  missingWorkflowOutput.steps[1].outputs = [{ name: "intermediate_summary", type: "text" }];
  expectCompositionError(() => normalizeWorkflowComposition(missingWorkflowOutput), "WORKFLOW_OUTPUT_MISMATCH");

  const sourceTypeMismatch = validInput();
  sourceTypeMismatch.steps[1].inputs[0].type = "text";
  expectCompositionError(() => normalizeWorkflowComposition(sourceTypeMismatch), "SOURCE_TYPE_MISMATCH");

  const hostMismatch = validInput({ runSelection: { primaryAgentProductId: "another-agent" } });
  expectCompositionError(() => normalizeWorkflowComposition(hostMismatch), "AGENT_HOST_MISMATCH");

  const multiHostRelease = release({
    dependencies: [
      ...release().content.dependencies,
      {
        kind: "resource",
        canonicalId: "other-host-resource",
        hostProductId: "other-agent",
        bindingKind: "mcp-resource",
        permissions: ["read-selected-input"]
      }
    ]
  });
  const multiHost = validInput({ workflowRelease: multiHostRelease });
  multiHost.steps[1].dependency = {
    kind: "resource",
    canonicalId: "other-host-resource",
    hostProductId: "other-agent",
    bindingKind: "mcp-resource"
  };
  expectCompositionError(() => normalizeWorkflowComposition(multiHost), "MULTIPLE_AGENT_HOSTS_UNSUPPORTED");
});
