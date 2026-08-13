"use strict";

const path = require("node:path");
const { app, BrowserWindow, Menu, Tray } = require("electron");

let tray = null;
let window = null;
let isQuitting = false;
let taskCenterOpened = false;

function finish(result, exitCode) {
  try {
    isQuitting = true;
    if (window && !window.isDestroyed()) window.destroy();
    if (tray && !tray.isDestroyed()) tray.destroy();
  } finally {
    console.log(JSON.stringify(result));
    app.exit(exitCode);
  }
}

app
  .whenReady()
  .then(() => {
    const iconPath = path.join(__dirname, "..", "build", "icon.png");
    tray = new Tray(iconPath);
    const menu = Menu.buildFromTemplate([
      {
        label: "2 个任务进行中",
        click: () => {
          taskCenterOpened = true;
        }
      },
      {
        label: "打开任务中心",
        click: () => {
          taskCenterOpened = true;
        }
      },
      { label: "打开枕星 AI" },
      { type: "separator" },
      { label: "完全退出" }
    ]);
    tray.setToolTip("枕星 AI · 2 个任务进行中");
    tray.setContextMenu(menu);
    menu.items[0].click();

    window = new BrowserWindow({ show: false });
    window.on("close", (event) => {
      if (isQuitting || !tray || tray.isDestroyed()) return;
      event.preventDefault();
      window.hide();
    });
    window.close();
    setTimeout(() => {
      const result = {
        trayCreated: !tray.isDestroyed(),
        menuLabels: menu.items
          .filter((item) => item.type !== "separator")
          .map((item) => item.label),
        closeKeptWindowAlive: !window.isDestroyed(),
        closeHidWindow: !window.isVisible(),
        taskCenterOpened
      };
      const ok =
        result.trayCreated &&
        result.closeKeptWindowAlive &&
        result.closeHidWindow &&
        result.taskCenterOpened &&
        JSON.stringify(result.menuLabels) ===
          JSON.stringify([
            "2 个任务进行中",
            "打开任务中心",
            "打开枕星 AI",
            "完全退出"
          ]);
      finish(result, ok ? 0 : 1);
    }, 200);
  })
  .catch((error) =>
    finish(
      {
        trayCreated: false,
        error: error instanceof Error ? error.message : String(error)
      },
      1
    )
  );
