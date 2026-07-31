const assert = require("node:assert/strict");
const test = require("node:test");

const {
  findTrustedProductExecutable,
  findTrustedUninstallRecord,
  parseMsiProductCode,
  resolveTrustedUninstallAction
} = require("../shared/windows-uninstall.cjs");

const comfyPolicy = {
  displayName: /^(?:ComfyUI|ComfyUI Desktop|Comfy Desktop)(?:\s+\d+(?:\.\d+){1,3})?$/i,
  publisher: /^(?:Comfy Org|Drip Artificial(?: Intelligence, Inc\.)?)$/i,
  executableName: /^Uninstall (?:ComfyUI|ComfyUI Desktop|Comfy Desktop)\.exe$/i,
  allowedArguments: [[], ["/currentuser"], ["/allusers"]],
  allowMsi: false
};
const ollamaPolicy = {
  displayName: /^Ollama(?:\s+(?:version\s+)?\d+(?:\.\d+){1,3})?$/i,
  publisher: /^Ollama(?:,? Inc\.?)?$/i,
  executableName: /^unins\d{3}\.exe$/i,
  allowedArguments: [[], ["/SILENT"]],
  launchWithoutArguments: true,
  allowMsi: false
};
const claudePolicy = {
  displayName: /^Claude(?:\s+\d+(?:\.\d+){1,3})?$/i,
  publisher: /^Anthropic(?:,?\s+PBC)?$/i,
  executableName: /^Update\.exe$/i,
  allowedArguments: [["--uninstall"], ["--uninstall", "-s"]],
  allowMsi: false
};

function fakeFileSystem(paths) {
  const known = new Set(paths.map((value) => value.toLowerCase()));
  return {
    exists: (value) => known.has(value.toLowerCase()),
    realpath: (value) => value
  };
}

test("accepts a product-specific uninstaller inside its registered installation", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\ComfyUI",
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\ComfyUI\\Uninstall ComfyUI.exe"
  ]);
  const action = resolveTrustedUninstallAction({
    entry: {
      displayname: "Comfy Desktop 1.0.31",
      publisher: "Drip Artificial Intelligence, Inc.",
      installlocation: "C:\\Users\\Tester\\AppData\\Local\\Programs\\ComfyUI",
      uninstallstring: '"C:\\Users\\Tester\\AppData\\Local\\Programs\\ComfyUI\\Uninstall ComfyUI.exe" /currentuser'
    },
    policy: comfyPolicy,
    ...fileSystem
  });
  assert.deepEqual(action, {
    kind: "executable",
    executable: "C:\\Users\\Tester\\AppData\\Local\\Programs\\ComfyUI\\Uninstall ComfyUI.exe",
    args: ["/currentuser"]
  });
});

test("accepts Claude's reviewed Squirrel uninstaller", () => {
  const installLocation =
    "C:\\Users\\Tester\\AppData\\Local\\AnthropicClaude";
  const update = `${installLocation}\\Update.exe`;
  const fileSystem = fakeFileSystem([installLocation, update]);
  const action = resolveTrustedUninstallAction({
    entry: {
      displayname: "Claude",
      publisher: "Anthropic PBC",
      installlocation: installLocation,
      uninstallstring: `"${update}" --uninstall`
    },
    policy: claudePolicy,
    ...fileSystem
  });
  assert.deepEqual(action, {
    kind: "executable",
    executable: update,
    args: ["--uninstall"]
  });
});

test("accepts Docker's quoted reviewed uninstall argument", () => {
  const installLocation =
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\DockerDesktop";
  const installer = `${installLocation}\\Docker Desktop Installer.exe`;
  const fileSystem = fakeFileSystem([installLocation, installer]);
  const action = resolveTrustedUninstallAction({
    entry: {
      displayname: "Docker Desktop",
      publisher: "Docker Inc.",
      installlocation: installLocation,
      uninstallstring: `"${installer}" "uninstall"`
    },
    policy: {
      displayName: /^Docker Desktop$/i,
      publisher: /^Docker Inc\.?$/i,
      executableName: /^Docker Desktop Installer\.exe$/i,
      allowedArguments: [["uninstall"]],
      allowMsi: false
    },
    ...fileSystem
  });
  assert.deepEqual(action, {
    kind: "executable",
    executable: installer,
    args: ["uninstall"]
  });
});

test("uses the display icon directory when InstallLocation is omitted", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama",
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe"
  ]);
  const action = resolveTrustedUninstallAction({
    entry: {
      displayname: "Ollama",
      publisher: "Ollama, Inc.",
      displayicon: '"C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\ollama app.exe",0',
      uninstallstring: '"C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe"'
    },
    policy: ollamaPolicy,
    ...fileSystem
  });
  assert.equal(action?.executable, "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe");
});

test("rejects a lookalike entry with an unexpected publisher", () => {
  const fileSystem = fakeFileSystem(["C:\\Apps\\Ollama", "C:\\Apps\\Ollama\\unins000.exe"]);
  const action = resolveTrustedUninstallAction({
    entry: {
      displayname: "Ollama",
      publisher: "Unknown Vendor",
      installlocation: "C:\\Apps\\Ollama",
      uninstallstring: '"C:\\Apps\\Ollama\\unins000.exe"'
    },
    policy: ollamaPolicy,
    ...fileSystem
  });
  assert.equal(action, null);
});

test("rejects shell commands and commands with extra arguments", () => {
  const fileSystem = fakeFileSystem(["C:\\Apps\\Ollama", "C:\\Apps\\Ollama\\unins000.exe"]);
  for (const uninstallstring of [
    'cmd.exe /c "C:\\Apps\\Ollama\\unins000.exe"',
    '"C:\\Apps\\Ollama\\unins000.exe" & calc.exe',
    '"C:\\Apps\\Ollama\\unins000.exe" /S'
  ]) {
    assert.equal(
      resolveTrustedUninstallAction({
        entry: {
          displayname: "Ollama",
          publisher: "Ollama",
          installlocation: "C:\\Apps\\Ollama",
          uninstallstring
        },
        policy: ollamaPolicy,
        ...fileSystem
      }),
      null
    );
  }
});

test("accepts only the reviewed electron-builder NSIS install scopes", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Apps\\Comfy Desktop",
    "C:\\Apps\\Comfy Desktop\\Uninstall Comfy Desktop.exe"
  ]);
  for (const scope of ["/currentuser", "/allusers"]) {
    const action = resolveTrustedUninstallAction({
      entry: {
        displayname: "Comfy Desktop 1.0.31",
        publisher: "Comfy Org",
        installlocation: "C:\\Apps\\Comfy Desktop",
        uninstallstring: `"C:\\Apps\\Comfy Desktop\\Uninstall Comfy Desktop.exe" ${scope}`
      },
      policy: comfyPolicy,
      ...fileSystem
    });
    assert.deepEqual(action?.args, [scope]);
  }
});

test("turns Ollama's registered silent Inno command back into an interactive launch", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama",
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe"
  ]);
  const action = resolveTrustedUninstallAction({
    entry: {
      displayname: "Ollama version 0.12.11",
      publisher: "Ollama",
      installlocation: "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama",
      uninstallstring:
        '"C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe" /SILENT'
    },
    policy: ollamaPolicy,
    ...fileSystem
  });
  assert.deepEqual(action?.args, []);
});

test("rejects an allowed filename outside the registered installation", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Apps\\Ollama",
    "C:\\Temp\\unins000.exe"
  ]);
  const action = resolveTrustedUninstallAction({
    entry: {
      displayname: "Ollama",
      publisher: "Ollama",
      installlocation: "C:\\Apps\\Ollama",
      uninstallstring: '"C:\\Temp\\unins000.exe"'
    },
    policy: ollamaPolicy,
    ...fileSystem
  });
  assert.equal(action, null);
});

test("normalizes a registry MSI install action into an interactive uninstall", () => {
  const productCode = "{12345678-1234-1234-1234-123456789ABC}";
  assert.equal(parseMsiProductCode(`MsiExec.exe /I${productCode}`), productCode);
  const fileSystem = fakeFileSystem(["D:\\Windows\\System32\\msiexec.exe"]);
  const action = resolveTrustedUninstallAction({
    entry: {
      displayname: "Ollama",
      publisher: "Ollama",
      uninstallstring: `MsiExec.exe /I${productCode}`
    },
    policy: { ...ollamaPolicy, allowMsi: true },
    systemRoot: "D:\\Windows",
    ...fileSystem
  });
  assert.deepEqual(action, {
    kind: "msi",
    executable: "D:\\Windows\\System32\\msiexec.exe",
    args: ["/x", productCode]
  });
});

test("rejects MSI for products whose reviewed installer is not MSI", () => {
  const productCode = "{12345678-1234-1234-1234-123456789ABC}";
  const fileSystem = fakeFileSystem(["C:\\Windows\\System32\\msiexec.exe"]);
  assert.equal(
    resolveTrustedUninstallAction({
      entry: {
        displayname: "Ollama",
        publisher: "Ollama",
        uninstallstring: `MsiExec.exe /I${productCode}`
      },
      policy: ollamaPolicy,
      ...fileSystem
    }),
    null
  );
});

test("rejects MSI commands with arbitrary trailing switches", () => {
  assert.equal(
    parseMsiProductCode(
      "MsiExec.exe /I{12345678-1234-1234-1234-123456789ABC} /quiet"
    ),
    ""
  );
});

test("skips an untrusted duplicate and selects the trusted registry record", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Apps\\Ollama",
    "C:\\Apps\\Ollama\\unins000.exe"
  ]);
  const trusted = {
    displayname: "Ollama",
    displayversion: "1.2.3",
    publisher: "Ollama",
    installlocation: "C:\\Apps\\Ollama",
    uninstallstring: '"C:\\Apps\\Ollama\\unins000.exe"'
  };
  const result = findTrustedUninstallRecord({
    registry: [
      { ...trusted, publisher: "Unknown Vendor", uninstallstring: "cmd.exe /c calc.exe" },
      trusted
    ],
    policy: ollamaPolicy,
    ...fileSystem
  });
  assert.equal(result?.entry, trusted);
  assert.equal(result?.location, "C:\\Apps\\Ollama");
});

test("rejects two distinct trusted uninstall records instead of guessing", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Apps\\Ollama",
    "C:\\Apps\\Ollama\\unins000.exe",
    "D:\\Apps\\Ollama",
    "D:\\Apps\\Ollama\\unins000.exe"
  ]);
  const registry = ["C", "D"].map((drive) => ({
    displayname: "Ollama",
    publisher: "Ollama",
    installlocation: `${drive}:\\Apps\\Ollama`,
    uninstallstring: `"${drive}:\\Apps\\Ollama\\unins000.exe"`
  }));
  assert.equal(
    findTrustedUninstallRecord({
      registry,
      policy: ollamaPolicy,
      ...fileSystem
    }),
    null
  );
});

test("does not mistake Ollama's uninstall display icon for the main app", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama",
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe",
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\ollama app.exe"
  ]);
  const executable = findTrustedProductExecutable({
    entry: {
      installlocation: "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama",
      displayicon:
        "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe"
    },
    executableNames: ["ollama app.exe"],
    ...fileSystem
  });
  assert.equal(
    executable,
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\ollama app.exe"
  );
});

test("finds Ollama's main app beside its uninstall display icon", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama",
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe",
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\ollama app.exe"
  ]);
  const executable = findTrustedProductExecutable({
    entry: {
      displayicon:
        "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\unins000.exe"
    },
    executableNames: ["ollama app.exe"],
    ...fileSystem
  });
  assert.equal(
    executable,
    "C:\\Users\\Tester\\AppData\\Local\\Programs\\Ollama\\ollama app.exe"
  );
});

test("rejects a product display icon outside the registered installation", () => {
  const fileSystem = fakeFileSystem([
    "C:\\Apps\\ComfyUI",
    "C:\\Temp\\ComfyUI.exe"
  ]);
  assert.equal(
    findTrustedProductExecutable({
      entry: {
        installlocation: "C:\\Apps\\ComfyUI",
        displayicon: "C:\\Temp\\ComfyUI.exe"
      },
      executableNames: ["ComfyUI.exe"],
      ...fileSystem
    }),
    ""
  );
});
