const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createManagedCliTerminalAction
} = require("../shared/cli-terminal.cjs");

test("opens a managed CLI in a visible persistent command window", () => {
  const prefix = "D:\\AI Hub\\CLI";
  const launcher = `${prefix}\\codex.cmd`;
  const command = "C:\\Windows\\System32\\cmd.exe";
  assert.deepEqual(
    createManagedCliTerminalAction({
      productId: "codex-cli",
      plan: { commandName: "codex" },
      status: {
        installed: true,
        managed: true,
        directory: prefix
      },
      commandExecutable: command,
      exists: (candidate) => [prefix, launcher, command].includes(candidate),
      realpath: (candidate) => candidate
    }),
    {
      executable: command,
      args: ["/d", "/k", "call", launcher],
      options: {
        cwd: prefix,
        detached: true,
        shell: false,
        stdio: "ignore",
        windowsHide: false
      }
    }
  );
});
test("refuses to open an external or untrusted CLI", () => {
  assert.equal(
    createManagedCliTerminalAction({
      productId: "codex-cli",
      plan: { commandName: "codex" },
      status: {
        installed: true,
        managed: false,
        directory: "D:\\AI Hub\\CLI"
      },
      commandExecutable: "C:\\Windows\\System32\\cmd.exe",
      exists: () => true,
      realpath: (candidate) => candidate
    }),
    null
  );
});

test("opens OpenClaw directly in the reviewed onboarding flow", () => {
  const prefix = "D:\\AI Hub\\CLI";
  const launcher = `${prefix}\\openclaw.cmd`;
  const command = "C:\\Windows\\System32\\cmd.exe";
  assert.deepEqual(
    createManagedCliTerminalAction({
      productId: "openclaw-agent",
      plan: {
        commandName: "openclaw",
        launchArgs: ["onboard", "--install-daemon"]
      },
      status: { installed: true, managed: true, directory: prefix },
      commandExecutable: command,
      exists: (candidate) => [prefix, launcher, command].includes(candidate),
      realpath: (candidate) => candidate
    })?.args,
    ["/d", "/k", "call", launcher, "onboard", "--install-daemon"]
  );
});

test("refuses renderer-shaped command arguments", () => {
  assert.equal(
    createManagedCliTerminalAction({
      productId: "openclaw-agent",
      plan: { commandName: "openclaw", launchArgs: ["& whoami"] },
      status: {
        installed: true,
        managed: true,
        directory: "D:\\AI Hub\\CLI"
      },
      commandExecutable: "C:\\Windows\\System32\\cmd.exe",
      exists: () => true,
      realpath: (candidate) => candidate
    }),
    null
  );
});
