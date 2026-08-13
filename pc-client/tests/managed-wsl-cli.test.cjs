"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createManagedWslBootstrapAction,
  createManagedWslDeployAction,
  createManagedWslDistributionAction,
  createManagedWslInstallPreflightAction,
  createManagedWslOpenAction,
  createManagedWslProbeAction,
  createManagedWslRepairAction,
  createManagedWslRepairProbeAction,
  createManagedWslReceipt,
  createManagedWslUninstallActions,
  inspectManagedWslCli,
  managedWslArtifact
} = require("../shared/managed-wsl-cli.cjs");

const plan = Object.freeze({
  name: "Example Agent",
  driver: "wsl-managed",
  distribution: "Ubuntu-24.04",
  version: "1.2.3",
  nodeVersion: "24.18.0",
  bootstrapPackages: Object.freeze(["ca-certificates", "curl", "git"]),
  commandName: "example-agent",
  managedPrefix: "$HOME/.example-agent",
  installScript: Object.freeze({
    url: "https://downloads.example.com/example-agent/install-1.2.3.sh",
    fileName: "example-agent-install-1.2.3.sh",
    sha256: "a".repeat(64),
    maximumBytes: 256 * 1024,
    allowedHosts: Object.freeze(["downloads.example.com"])
  }),
  installArguments: Object.freeze(["--version", "1.2.3"]),
  launchArguments: Object.freeze(["onboard"]),
  serviceUninstallArguments: Object.freeze(["uninstall", "--service", "--yes"]),
  packageName: "example-agent"
});

const wsl = "C:\\Windows\\System32\\wsl.exe";
const cmd = "C:\\Windows\\System32\\cmd.exe";
const managementId = "1".repeat(48);

function receiptFor(productId = "example-agent-wsl") {
  return createManagedWslReceipt({
    productId,
    plan,
    distributionIdentity: "Ubuntu-24.04",
    managementId,
    now: () => "2026-08-01T00:00:00.000Z"
  });
}

test("WSL bootstrap installs only fixed local-profile prerequisites as root", () => {
  const action = createManagedWslBootstrapAction({
    plan,
    wslExecutable: wsl
  });
  assert.deepEqual(action.args.slice(0, 6), [
    "--distribution",
    "Ubuntu-24.04",
    "--user",
    "root",
    "--exec",
    "/bin/sh"
  ]);
  assert.match(
    action.args.at(-1),
    /apt-get install -y --no-install-recommends ca-certificates curl git/
  );
  assert.equal(
    createManagedWslBootstrapAction({
      plan: { ...plan, bootstrapPackages: ["curl;rm -rf /"] },
      wslExecutable: wsl
    }),
    null
  );
});

test("one reviewed WSL driver creates reusable distribution and deploy actions", () => {
  assert.deepEqual(managedWslArtifact(plan), {
    url: plan.installScript.url,
    fileName: plan.installScript.fileName,
    sha256: plan.installScript.sha256,
    maximumBytes: plan.installScript.maximumBytes,
    allowedHosts: ["downloads.example.com"]
  });
  assert.deepEqual(createManagedWslDistributionAction({ plan, wslExecutable: wsl }), {
    executable: wsl,
    args: ["--install", "--distribution", "Ubuntu-24.04", "--no-launch"],
    options: { windowsHide: false, shell: false }
  });
  assert.match(
    createManagedWslInstallPreflightAction({ plan, wslExecutable: wsl }).args.at(-1),
    /\[ ! -e "\$prefix" \].*\[ ! -L "\$prefix" \]/
  );
  const deploy = createManagedWslDeployAction({
    productId: "example-agent-wsl",
    plan,
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\AppData\\Local\\Temp\\example-agent-install-1.2.3.sh",
    managementId
  });
  assert.equal(deploy.executable, wsl);
  assert.deepEqual(deploy.args, [
    "--distribution", "Ubuntu-24.04", "--exec", "bash",
    "/mnt/c/Users/test/AppData/Local/Temp/example-agent-install-1.2.3.sh",
    "--version", "1.2.3", "--management-id", managementId
  ]);
});

test("WSL probe, open and uninstall actions stay inside the local reviewed profile", () => {
  const receipt = receiptFor();
  const probe = createManagedWslProbeAction({
    productId: "example-agent-wsl",
    plan,
    receipt,
    wslExecutable: wsl
  });
  assert.equal(probe.executable, wsl);
  assert.match(probe.args.at(-1), /\.aihub-owner/);
  assert.match(probe.args.at(-1), new RegExp(managementId));
  assert.match(probe.args.at(-1), /command_real.*prefix_real\/bin\/example-agent/);

  const open = createManagedWslOpenAction({
    productId: "example-agent-wsl",
    plan,
    receipt,
    status: { installed: true, managed: true },
    wslExecutable: wsl,
    commandExecutable: cmd
  });
  assert.equal(open.executable, cmd);
  assert.deepEqual(open.args.slice(0, 5), ["/d", "/k", wsl, "--distribution", "Ubuntu-24.04"]);
  assert.match(open.args.at(-1), /onboard/);

  const uninstall = createManagedWslUninstallActions({
    productId: "example-agent-wsl",
    plan,
    receipt,
    wslExecutable: wsl
  });
  assert.equal(uninstall.length, 2);
  assert.match(uninstall[0].args.at(-1), /uninstall --service --yes/);
  assert.match(uninstall[1].args.at(-1), /\.aihub-owner/);
  assert.match(uninstall[1].args.at(-1), /rm -rf -- "\$prefix"/);
  assert.doesNotMatch(uninstall[1].args.at(-1), /unregister/i);
});

test("WSL repair requires an exact receipt and a marker-owned fixed rebuild strategy", () => {
  const repairPlan = { ...plan, repairStrategy: "rebuild-owned-prefix" };
  const receipt = receiptFor();
  const ownership = createManagedWslRepairProbeAction({
    productId: "example-agent-wsl", plan: repairPlan, receipt, wslExecutable: wsl
  });
  assert.match(ownership.args.at(-1), /\.aihub-owner/);
  assert.doesNotMatch(ownership.args.at(-1), /command_real/);
  const repair = createManagedWslRepairAction({
    productId: "example-agent-wsl",
    plan: repairPlan,
    receipt,
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\AppData\\Local\\Temp\\example-agent-install-1.2.3.sh"
  });
  assert.deepEqual(repair.args.slice(-3), ["--repair", "--management-id", managementId]);
  assert.equal(createManagedWslRepairAction({
    productId: "example-agent-wsl",
    plan,
    receipt,
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\AppData\\Local\\Temp\\example-agent-install-1.2.3.sh"
  }), null);
  assert.equal(createManagedWslRepairAction({
    productId: "example-agent-wsl",
    plan: repairPlan,
    receipt: { ...receipt, installScriptSha256: "b".repeat(64) },
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\AppData\\Local\\Temp\\example-agent-install-1.2.3.sh"
  }), null);
});

test("managed WSL status requires an exact receipt and exact version", () => {
  const receipt = receiptFor();
  assert.equal(inspectManagedWslCli({ productId: "example-agent-wsl", plan, receipt, probe: { ok: true, version: "1.2.3" } }).canUninstall, true);
  assert.equal(inspectManagedWslCli({ productId: "example-agent-wsl", plan, receipt, probe: { ok: true, version: "9.9.9" } }).ownership, "mismatch");
  assert.equal(inspectManagedWslCli({ productId: "example-agent-wsl", plan, receipt: null, probe: { ok: true, version: "1.2.3" } }).ownership, "untracked");
});

test("backend-like shell payloads cannot become WSL actions", () => {
  const hostile = {
    ...plan,
    launchArguments: ["onboard; calc.exe"]
  };
  assert.equal(managedWslArtifact(hostile), null);
  assert.equal(createManagedWslDeployAction({
    productId: "example-agent-wsl",
    plan,
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\install.sh",
    managementId: "not-an-id"
  }), null);
  assert.equal(createManagedWslProbeAction({
    productId: "example-agent-wsl",
    plan: hostile,
    receipt: receiptFor(),
    wslExecutable: wsl
  }), null);
});
