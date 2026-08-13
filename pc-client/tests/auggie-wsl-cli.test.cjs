"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const catalog = require("../admin/data/catalog-v1.json");
const { cliInstallPlans } = require("../shared/install-registry.cjs");
const {
  createManagedWslBootstrapAction,
  createManagedWslDeployAction,
  createManagedWslOpenAction,
  createManagedWslProbeAction,
  createManagedWslRepairAction,
  createManagedWslRepairProbeAction,
  createManagedWslReceipt,
  createManagedWslUpdateAction,
  createManagedWslUninstallActions,
  managedWslReceiptOwnsPrefix,
  managedWslArtifact
} = require("../shared/managed-wsl-cli.cjs");
const {
  CLI_REVIEW_BLOCKERS
} = require("../shared/windows-cli-review-decisions.cjs");

const productId = "augment-auggie-cli";
const plan = cliInstallPlans()[productId];
const wsl = "C:\\Windows\\System32\\wsl.exe";
const cmd = "C:\\Windows\\System32\\cmd.exe";
const managementId = "3".repeat(48);

function receiptFor() {
  return createManagedWslReceipt({
    productId,
    plan,
    distributionIdentity: "Ubuntu-24.04",
    managementId,
    now: () => "2026-08-04T00:00:00.000Z"
  });
}

test("Auggie uses one fixed isolated WSL install contract", () => {
  assert.deepEqual(
    {
      driver: plan.driver,
      distribution: plan.distribution,
      version: plan.version,
      nodeVersion: plan.nodeVersion,
      commandName: plan.commandName,
      managedPrefix: plan.managedPrefix,
      repairStrategy: plan.repairStrategy,
      packageName: plan.packageName,
      installArguments: plan.installArguments,
      launchArguments: plan.launchArguments,
      serviceUninstallArguments: plan.serviceUninstallArguments
    },
    {
      driver: "wsl-managed",
      distribution: "Ubuntu-24.04",
      version: "0.34.0",
      nodeVersion: "22.23.2",
      commandName: "auggie",
      managedPrefix: "$HOME/.aihub-auggie",
      repairStrategy: "rebuild-owned-prefix",
      packageName: "@augmentcode/auggie",
      installArguments: [],
      launchArguments: [],
      serviceUninstallArguments: []
    }
  );
  assert.deepEqual(plan.bootstrapPackages, [
    "ca-certificates", "curl", "git", "xz-utils"
  ]);
  assert.deepEqual(plan.linuxDependencies, ["node", "npm", "git"]);
  assert.equal(CLI_REVIEW_BLOCKERS[productId], undefined);
});

test("Auggie packaged script is immutable and pins only official Node and npm artifacts", () => {
  const artifact = managedWslArtifact(plan);
  assert.deepEqual(artifact, {
    source: "packaged",
    relativePath: "managed-wsl-scripts/augment-auggie-0.34.0.sh",
    fileName: "augment-auggie-0.34.0.sh",
    sha256: "03054bf581b75d472940693ec1c11759f221fee7b424ae9203a9a8e34a4c7c10",
    maximumBytes: 8 * 1024
  });
  const scriptPath = path.join(
    __dirname,
    "..",
    "shared",
    ...artifact.relativePath.split("/")
  );
  const scriptBytes = fs.readFileSync(scriptPath);
  const script = scriptBytes.toString("utf8");
  assert.equal(
    crypto.createHash("sha256").update(scriptBytes).digest("hex"),
    artifact.sha256
  );
  assert.match(script, /node-v22\.23\.2-linux-x64\.tar\.xz/);
  assert.match(script, /d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307/);
  assert.match(script, /auggie-0\.34\.0\.tgz/);
  assert.match(script, /cabcd3fbdd912e457b9626eadc4033c2eeb8b5ac53e506725d14e3b9994f3bb29b6082a56028a4fed6e8b7fd8faccc0e4077fd904c632d29cd90a5f99bc3ac86/);
  assert.match(script, /--ignore-scripts --omit=optional/);
  assert.match(script, /--offline --cache/);
  assert.match(script, /--no-audit --no-fund/);
  assert.match(script, /export AUGMENT_DISABLE_AUTO_UPDATE=1/);
  assert.match(script, /--management-id/);
  assert.match(script, /--update/);
  assert.match(script, /--repair/);
  assert.match(script, /\^\[a-f0-9\]\{48\}\$/);
  assert.match(script, /Refusing existing managed prefix/);
  assert.match(script, /mktemp -d "\$HOME\/\.aihub-auggie\.stage\.XXXXXX"/);
  assert.match(script, /mv --no-clobber --no-target-directory/);
  assert.match(script, /\.aihub-auggie\.backup/);
  assert.match(script, /previous_moved=1/);
  assert.match(script, /set -o noclobber/);
  assert.doesNotMatch(script, /@latest|npmjs\.com|curl[^\n]+\|[^\n]+(?:sh|bash)/);
  assert.doesNotMatch(script, /\.augment\/(?!settings\.json)/);
});

test("Auggie install, detect, open, and uninstall stay inside its managed prefix", () => {
  const bootstrap = createManagedWslBootstrapAction({ plan, wslExecutable: wsl });
  assert.match(bootstrap.args.at(-1), /ca-certificates curl git xz-utils/);
  const receipt = receiptFor();
  const deploy = createManagedWslDeployAction({
    productId,
    plan,
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\AppData\\Local\\Temp\\augment-auggie-0.34.0.sh",
    managementId
  });
  assert.deepEqual(deploy.args.slice(-4), [
    "bash", "/mnt/c/Users/test/AppData/Local/Temp/augment-auggie-0.34.0.sh",
    "--management-id", managementId
  ]);

  const probe = createManagedWslProbeAction({ productId, plan, receipt, wslExecutable: wsl });
  assert.match(probe.args.at(-1), /\.aihub-owner/);
  assert.match(probe.args.at(-1), new RegExp(managementId));
  assert.match(probe.args.at(-1), /"\$command" --version/);
  const open = createManagedWslOpenAction({
    productId,
    plan,
    receipt,
    status: { installed: true, managed: true },
    wslExecutable: wsl,
    commandExecutable: cmd
  });
  assert.match(open.args.at(-1), /\.aihub-owner/);
  assert.match(open.args.at(-1), /exec "\$command"$/);
  const update = createManagedWslUpdateAction({
    productId,
    plan,
    receipt,
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\AppData\\Local\\Temp\\augment-auggie-0.34.0.sh"
  });
  assert.equal(managedWslReceiptOwnsPrefix(receipt, productId, plan), true);
  assert.deepEqual(update.args.slice(-3), ["--update", "--management-id", managementId]);
  const repairProbe = createManagedWslRepairProbeAction({ productId, plan, receipt, wslExecutable: wsl });
  assert.match(repairProbe.args.at(-1), /\.aihub-owner/);
  assert.doesNotMatch(repairProbe.args.at(-1), /command_real/);
  const repair = createManagedWslRepairAction({
    productId,
    plan,
    receipt,
    wslExecutable: wsl,
    scriptWindowsPath: "C:\\Users\\test\\AppData\\Local\\Temp\\augment-auggie-0.34.0.sh"
  });
  assert.deepEqual(repair.args.slice(-3), ["--repair", "--management-id", managementId]);
  const uninstall = createManagedWslUninstallActions({
    productId,
    plan,
    receipt,
    wslExecutable: wsl
  });
  assert.equal(uninstall.length, 1);
  assert.match(uninstall[0].args.at(-1), /\.aihub-owner/);
  assert.match(uninstall[0].args.at(-1), new RegExp(managementId));
  assert.match(uninstall[0].args.at(-1), /rm -rf -- "\$prefix"/);
  assert.doesNotMatch(uninstall[0].args.at(-1), /unregister/i);
});

test("Auggie is catalog-managed and packaged paths cannot escape the local whitelist", () => {
  const product = catalog.vendors
    .flatMap((vendor) => vendor.products || [])
    .find((entry) => entry.id === productId);
  assert.equal(product.productType, "cli");
  assert.equal(product.moduleId, "cli-managed");
  assert.equal(product.installProfileId, "cli.augment-auggie");
  assert.deepEqual(product.requirements, ["wsl"]);
  assert.deepEqual(product.capabilities, [
    "website", "tutorial", "install", "open", "uninstall"
  ]);
  assert.equal(
    managedWslArtifact({
      ...plan,
      installScript: {
        ...plan.installScript,
        relativePath: "../managed-wsl-scripts/augment-auggie-0.34.0.sh"
      }
    }),
    null
  );
});

test("Electron confirms fixed shared WSL packages before root bootstrap", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const deploy = main.slice(
    main.indexOf("async function deployManagedWslCli"),
    main.indexOf("async function uninstallManagedWslCli")
  );
  assert.ok(deploy.indexOf("createManagedWslInstallPreflightAction") < deploy.indexOf("showLocalizedMessageBox"));
  assert.ok(deploy.indexOf("showLocalizedMessageBox") < deploy.indexOf("createManagedWslBootstrapAction"));
  assert.match(deploy, /plan\.bootstrapPackages\.join/);
  assert.match(deploy, /共享 WSL 环境/);
  assert.match(deploy, /不会注销 WSL 发行版/);
  assert.match(deploy, /environmentConfirmation\.response !== 1/);
});

test("Electron repairs only a marker-owned exact WSL receipt and rechecks it", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const update = main.slice(
    main.indexOf("async function updateManagedWslCli"),
    main.indexOf("async function uninstallManagedWslCli")
  );
  assert.match(update, /managedWslReceiptOwnsPrefix/);
  assert.match(update, /createManagedWslUpdateAction/);
  assert.match(update, /setManagedCliRecord\(productId, receipt\)/);
  const repair = main.slice(
    main.indexOf("async function repairManagedWslCli"),
    main.indexOf("async function uninstallManagedWslCli")
  );
  assert.match(repair, /managedWslReceiptMatchesPlan/);
  assert.match(repair, /createManagedWslRepairProbeAction/);
  assert.match(repair, /createManagedWslRepairAction/);
  assert.match(repair, /原受管前缀已由修复脚本回滚/);
  assert.match(main, /intent === "update"\s*\? updateManagedWslCli/);
  assert.match(main, /repairManagedWslCli\(sender, productId, plan\)/);
});
