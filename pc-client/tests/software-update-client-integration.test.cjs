"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const {
  buildInstalledProductManagement
} = require("../shared/installed-product-management.cjs");

test("projects published CLI update availability into installed management", () => {
  const management = buildInstalledProductManagement({
    vendors: [
      {
        id: "future-vendor",
        name: "Future Vendor",
        enabled: true,
        products: [
          {
            id: "future-cli",
            name: "Future CLI",
            enabled: true,
            productType: "cli",
            capabilities: ["install", "update", "open", "uninstall"]
          }
        ]
      }
    ],
    localInventory: [
      {
        id: "cli.future",
        productId: "future-cli",
        vendorId: "future-vendor",
        productType: "cli",
        mode: "managed-cli",
        capabilities: ["install", "update", "open", "uninstall"]
      }
    ],
    cliStatuses: {
      "future-cli": {
        installed: true,
        version: "1.0.0",
        availableVersion: "1.1.0",
        directory: "C:\\Tools\\Future",
        managed: true,
        canOpen: true,
        canUninstall: true,
        canUpdate: true
      }
    }
  });

  assert.equal(management.products.length, 1);
  assert.equal(management.products[0].canUpdate, true);
  assert.equal(management.products[0].availableVersion, "1.1.0");
});

test("Electron checks the signed software feed and gates every update executor", () => {
  const main = read("electron/main.cjs");
  const preload = read("electron/preload.cjs");
  const types = read("src/vite-env.d.ts");

  assert.match(main, /verifySoftwareUpdateRelease/);
  assert.match(main, /ipcMain\.handle\("software-updates:check"/);
  assert.match(main, /assertSoftwareUpdatePublished/);
  assert.match(main, /ipcMain\.handle\("desktop:update"/);
  assert.match(main, /filterPublishedExtensionUpdates/);
  assert.match(preload, /checkSoftwareUpdates:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("software-updates:check"\)/);
  assert.match(preload, /updateDesktopProduct:\s*\(productId\)/);
  assert.match(types, /type SoftwareUpdateCheckResult/);
  assert.match(types, /checkSoftwareUpdates\(\): Promise<SoftwareUpdateCheckResult>/);
});

test("renderer auto-checks on startup and offers individual and bulk updates", () => {
  const app = read("src/App.tsx");

  assert.match(app, /\.checkSoftwareUpdates\(\)/);
  assert.match(app, /data-aihub-action="update-all-installed"/);
  assert.match(app, /data-aihub-action="update-installed-cli"/);
  assert.match(app, /onUpdateCli=/);
  assert.match(app, /softwareUpdates\.updateAll/);
});
