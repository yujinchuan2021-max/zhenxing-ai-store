const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildWslEnvironmentDefinitions,
  createWslEnvironmentProbeAction,
  createWslPlatformUninstallAction,
  parseWslEnvironmentProbe,
  wslPlatformManagementStatus
} = require("../shared/wsl-environment-management.cjs");

const plan = {
  driver: "wsl-managed",
  distribution: "Ubuntu-24.04",
  managedPrefix: "$HOME/.openclaw",
  nodeVersion: "24.18.0",
  linuxDependencies: ["node", "npm", "git"]
};

test("WSL platform uninstall uses the reviewed platform command and never unregisters a distro", () => {
  const action = createWslPlatformUninstallAction({
    wslExecutable: "C:\\Windows\\System32\\wsl.exe"
  });

  assert.deepEqual(action, {
    executable: "C:\\Windows\\System32\\wsl.exe",
    args: ["--uninstall"],
    options: { windowsHide: true, shell: false }
  });
  assert.equal(action.args.includes("--unregister"), false);
});

test("an installed WSL platform always exposes its reviewed uninstall capability", () => {
  assert.deepEqual(
    wslPlatformManagementStatus({ installed: true, canUninstall: false }),
    { installed: true, canUninstall: true }
  );
  assert.deepEqual(
    wslPlatformManagementStatus({ installed: false, canUninstall: false }),
    { installed: false, canUninstall: false }
  );
});

test("builds a generic WSL subdirectory from the local approved product profile", () => {
  assert.deepEqual(
    buildWslEnvironmentDefinitions({
      productId: "openclaw-wsl-gateway",
      productName: "OpenClaw WSL Gateway",
      plan
    }),
    [
      {
        id: "node",
        name: "Node.js",
        expectedVersion: "24.18.0",
        ownerProductId: "openclaw-wsl-gateway",
        ownerProductName: "OpenClaw WSL Gateway",
        scope: "product-private"
      },
      {
        id: "npm",
        name: "npm",
        expectedVersion: "",
        ownerProductId: "openclaw-wsl-gateway",
        ownerProductName: "OpenClaw WSL Gateway",
        scope: "product-private"
      },
      {
        id: "git",
        name: "Git",
        expectedVersion: "",
        ownerProductId: "openclaw-wsl-gateway",
        ownerProductName: "OpenClaw WSL Gateway",
        scope: "distribution-shared"
      }
    ]
  );
});

test("creates only fixed probes for approved WSL dependencies", () => {
  const action = createWslEnvironmentProbeAction({
    wslExecutable: "C:\\Windows\\System32\\wsl.exe",
    distribution: "Ubuntu-24.04",
    dependencyId: "node",
    plan
  });

  assert.equal(action.executable, "C:\\Windows\\System32\\wsl.exe");
  assert.deepEqual(action.args.slice(0, 4), [
    "--distribution",
    "Ubuntu-24.04",
    "--",
    "/bin/sh"
  ]);
  assert.match(action.args.at(-1), /\.openclaw\/tools\/node\/bin\/node/);
  assert.equal(
    createWslEnvironmentProbeAction({
      wslExecutable: "C:\\Windows\\System32\\wsl.exe",
      distribution: "Ubuntu-24.04",
      dependencyId: "rm -rf /",
      plan
    }),
    null
  );
});

test("parses a WSL dependency probe into a child environment status", () => {
  assert.deepEqual(
    parseWslEnvironmentProbe({
      definition: buildWslEnvironmentDefinitions({
        productId: "openclaw-wsl-gateway",
        productName: "OpenClaw WSL Gateway",
        plan
      })[0],
      distribution: "Ubuntu-24.04",
      stdout: "v24.18.0\n/home/user/.openclaw/tools/node/bin/node\n"
    }),
    {
      id: "node",
      name: "Node.js",
      installed: true,
      version: "24.18.0",
      location: "/home/user/.openclaw/tools/node/bin/node",
      ownerProductId: "openclaw-wsl-gateway",
      ownerProductName: "OpenClaw WSL Gateway",
      scope: "product-private",
      canRepair: true
    }
  );
});
