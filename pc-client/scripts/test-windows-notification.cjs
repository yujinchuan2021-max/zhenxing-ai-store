"use strict";

const { app, Notification } = require("electron");

let notification = null;
let settled = false;

function finish(result, exitCode) {
  if (settled) return;
  settled = true;
  console.log(JSON.stringify(result));
  setTimeout(() => {
    app.exit(exitCode);
  }, 300);
}

app
  .whenReady()
  .then(() => {
    // Keep the legacy application id so existing Windows notification
    // permissions continue to apply after the public product rename.
    app.setAppUserModelId("com.aihub.desktop");
    if (!Notification.isSupported()) {
      finish({ supported: false, shown: false }, 1);
      return;
    }
    notification = new Notification({
      title: "枕星AI助手通知验收",
      body: "Windows 原生通知通道已成功调用。",
      silent: true,
      timeoutType: "default"
    });
    notification.once("show", () =>
      finish({ supported: true, shown: true }, 0)
    );
    notification.once("failed", (_event, error) =>
      finish({ supported: true, shown: false, error }, 1)
    );
    notification.show();
    setTimeout(
      () =>
        finish(
          {
            supported: true,
            shown: false,
            error: "notification show event timed out"
          },
          1
        ),
      5_000
    );
  })
  .catch((error) =>
    finish(
      {
        supported: false,
        shown: false,
        error: error instanceof Error ? error.message : String(error)
      },
      1
    )
  );
