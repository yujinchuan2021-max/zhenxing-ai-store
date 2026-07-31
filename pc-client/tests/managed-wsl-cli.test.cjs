"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createManagedWslBootstrapAction,
  createManagedWslDeployAction,
  createManagedWslDistributionAction,
  createManagedWslOpenAction,
  createManagedWslProbeAction,
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
  const deploy = createManagedWslDeployAction({
    productId: "example-agent-wsl",
    plan,
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\AppData\\Local\\Temp\\example-agent-install-1.2.3.sh"
  });
  assert.equal(deploy.executable, wsl);
  assert.deepEqual(deploy.args, [
    "--distribution", "Ubuntu-24.04", "--exec", "bash",
    "/mnt/c/Users/test/AppData/Local/Temp/example-agent-install-1.2.3.sh",
    "--version", "1.2.3"
  ]);
});

test("WSL probe, open and uninstall actions stay inside the local reviewed profile", () => {
  const probe = createManagedWslProbeAction({ plan, wslExecutable: wsl });
  assert.equal(probe.executable, wsl);
  assert.match(probe.args.at(-1), /\.example-agent\/bin\/example-agent/);

  const open = createManagedWslOpenAction({
    plan,
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
    receipt: createManagedWslReceipt({
      productId: "example-agent-wsl",
      plan,
      distributionIdentity: "Ubuntu-24.04",
      now: () => "2026-08-01T00:00:00.000Z",
      randomBytes: () => Buffer.alloc(24, 1)
    }),
    wslExecutable: wsl
  });
  assert.equal(uninstall.length, 2);
  assert.match(uninstall[0].args.at(-1), /uninstall --service --yes/);
  assert.match(uninstall[1].args.at(-1), /npm.*uninstall.*example-agent/);
  assert.match(uninstall[1].args.at(-1), /tools\/node-v24\.18\.0/);
  assert.doesNotMatch(uninstall[1].args.at(-1), /rm -rf|unregister/i);
});

test("managed WSL status requires an exact receipt and exact version", () => {
  const receipt = createManagedWslReceipt({
    productId: "example-agent-wsl",
    plan,
    distributionIdentity: "Ubuntu-24.04",
    now: () => "2026-08-01T00:00:00.000Z",
    randomBytes: () => Buffer.alloc(24, 2)
  });
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
  assert.equal(createManagedWslProbeAction({ plan: hostile, wslExecutable: wsl }), null);
});
