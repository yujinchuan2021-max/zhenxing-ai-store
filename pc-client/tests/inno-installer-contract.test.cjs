"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("server-connected review uses the pinned Inno installer seam instead of NSIS", () => {
  const required = [
    "build/inno/installer.iss",
    "build/inno/toolchain.json",
    "scripts/lib/inno-setup.cjs"
  ];

  for (const relative of required) {
    assert.equal(
      fs.existsSync(path.join(root, relative)),
      true,
      `${relative} must exist`
    );
  }
});

test("the Inno toolchain and compiler arguments are pinned and fail closed", () => {
  const {
    assertToolchainManifest,
    buildCompilerArguments,
  } = require("../scripts/lib/inno-setup.cjs");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "build/inno/toolchain.json"), "utf8")
  );

  assert.deepEqual(assertToolchainManifest(manifest), manifest);
  assert.equal(
    manifest.defaultCompilerPath,
    "%LOCALAPPDATA%\\ZhenXingAI\\toolchains\\inno-7.1.0\\ISCC.exe"
  );
  assert.doesNotMatch(JSON.stringify(manifest), /[A-Za-z]:\\\\Users\\\\/i);
  assert.deepEqual(
    buildCompilerArguments({
      scriptPath: "D:\\repo\\build\\inno\\installer.iss",
      appVersion: "0.1.100",
      sourceDir: "D:\\tmp\\win-unpacked",
      outputDir: "D:\\tmp\\output",
      outputBaseFilename:
        "ZhenXing-AI-Server-Connected-Review-0.1.100-Windows-x64-Setup",
    }),
    [
      "/Qp",
      "/DAppVersion=0.1.100",
      "/DSourceDir=D:\\tmp\\win-unpacked",
      "/DOutputDir=D:\\tmp\\output",
      "/DOutputBaseFilename=ZhenXing-AI-Server-Connected-Review-0.1.100-Windows-x64-Setup",
      "D:\\repo\\build\\inno\\installer.iss",
    ]
  );
  assert.throws(
    () => buildCompilerArguments({
      scriptPath: "D:\\repo\\build\\inno\\installer.iss",
      appVersion: "0.1.100",
      sourceDir: "D:\\tmp\\win-unpacked",
      outputDir: "D:\\tmp\\output",
      outputBaseFilename: "..\\outside",
    }),
    /output filename/i
  );
  assert.throws(
    () => assertToolchainManifest({ ...manifest, version: "7.0.2" }),
    /toolchain manifest/i
  );
});

test("the Inno script is per-machine, branded, and migrates only the exact legacy NSIS entry", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  assert.match(source, /^AppId=\{\{2DEAF0FA-7B3E-594E-A5DC-B880B184D4A8\}$/m);
  assert.match(source, /^AppName=枕星AI助手$/m);
  assert.match(source, /^PrivilegesRequired=admin$/m);
  assert.doesNotMatch(source, /^PrivilegesRequiredOverridesAllowed=/m);
  assert.match(source, /^DefaultDirName=\{autopf\}\\aihub-pc-client$/m);
  assert.match(source, /^ArchitecturesAllowed=x64compatible$/m);
  assert.match(source, /^ArchitecturesInstallIn64BitMode=x64compatible$/m);
  assert.match(source, /^WizardStyle=modern dark hidebevels$/m);
  assert.match(source, /^WizardBackColor=#071421$/m);
  assert.doesNotMatch(source, /^WizardBackImageFile=/m);
  assert.match(source, /^SetupIconFile=\.\.\\icon\.ico$/m);
  assert.match(source, /Source: "\{#SourceDir\}\\\*"; DestDir: "\{app\}"; Flags: ignoreversion recursesubdirs createallsubdirs/);

  assert.match(source, /SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\2deaf0fa-7b3e-594e-a5dc-b880b184d4a8/);
  assert.match(source, /RegQueryStringValue\(HKLM64, LegacyUninstallKey, 'QuietUninstallString'/);
  assert.match(source, /CompareText\(ExtractFileName\(LegacyExe\), LegacyUninstallerName\)/);
  assert.match(source, /CompareText\(LegacyArgs, '\/allusers \/S'\)/);
  assert.match(source, /Exec\(LegacyExe, LegacyArgs, '', SW_SHOWNORMAL, ewWaitUntilTerminated/);
  assert.match(source, /RegKeyExists\(HKLM64, LegacyUninstallKey\)/);
  assert.doesNotMatch(source, /cmd\.exe|powershell(?:\.exe)?|ShellExec/i);

  assert.match(source, /procedure InitializeWizard;/);
  assert.match(source, /procedure CurInstallProgressChanged\(CurProgress, MaxProgress: Integer\);/);
  assert.match(source, /procedure InitializeUninstallProgressForm;/);
  assert.match(source, /procedure CurUninstallStepChanged\(CurUninstallStep: TUninstallStep\);/);
  assert.match(source, /PngImage\.LoadFromFile/);
  assert.match(source, /procedure CacheUninstallFrames;/);
  assert.match(source, /FileCopy\(SourceName, TargetName, False\)/);
  assert.doesNotMatch(source, /PngImage\.LoadFromFile\(ExpandConstant\('\{app\}/);
  assert.match(source, /Flags: nowait postinstall skipifsilent runasoriginaluser/);
});

test("the visible installer is one custom star-over-controls shell instead of the stock wizard", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  assert.match(source, /^DisableWelcomePage=yes$/m);
  assert.match(source, /^DisableReadyPage=yes$/m);
  assert.match(source, /procedure BuildCustomInstallerShell;/);
  assert.match(source, /procedure ShowInstallerState\(State: Integer\);/);
  assert.match(source, /WizardForm\.OuterNotebook\.Hide/);
  assert.match(source, /WizardForm\.InnerNotebook\.Hide/);
  assert.match(source, /WizardForm\.MainPanel\.Hide/);
  assert.match(source, /WizardForm\.Bevel\.Hide/);
  assert.match(source, /ShellStar := TBitmapImage\.Create\(WizardForm\)/);
  assert.match(source, /PrepareStarImage\(ShellStar, WizardForm, 150, 24, 220\)/);
  assert.match(source, /ShellFrame := TPanel\.Create\(WizardForm\)/);
  assert.match(source, /ShellPanel := TPanel\.Create\(WizardForm\)/);
  assert.match(source, /PrepareRoundedShell\(ShellFrame, ShellPanel, WizardForm\)/);
  assert.match(source, /PrepareProgressImage\(ShellProgressTrack, ShellPanel/);
  assert.match(source, /ShellProgressFill\.Width := ScaleX\(\(338 \* CurProgress\) div MaxProgress\)/);
  assert.match(source, /Panel\.Color := \$00362920/);
  assert.match(source, /ShellAccent\.Color := \$00DCD664/);
  assert.match(source, /procedure ApplyBorderlessWindow\(FormHandle: HWND\);/);
  assert.match(source, /Style := Style and not \(WSCaption or WSThickFrame or WSSystemMenu/);
  assert.match(source, /ApplyBorderlessWindow\(WizardForm\.Handle\)/);
  assert.match(source, /WizardForm\.DirEdit\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.DirBrowseButton\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.ProgressGauge\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.NextButton\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.CancelButton\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.NextButton\.Caption := '安装'/);
  assert.match(source, /ShellLaunchButton\.Caption := '打开枕星AI助手'/);
  assert.match(source, /WizardForm\.NextButton\.Caption := '关闭窗口'/);
  assert.match(source, /ShellProgressText\.Caption := IntToStr\(\(CurProgress \* 100\) div MaxProgress\) \+ '%'/);
  assert.match(source, /if CurrentInstallFrame < 7 then[\s\S]*CurrentInstallFrame := CurrentInstallFrame \+ 1/);
  assert.match(source, /CurrentUninstallFrame > 0\) then[\s\S]*CurrentUninstallFrame := CurrentUninstallFrame - 1/);
  assert.match(source, /\(AnimationTickCounter mod 6\) = 0/);
  assert.match(source, /SetTimer\(0, 0, 180, CreateCallback\(@BrandTimerProc\)\)/);
  assert.doesNotMatch(source, /CurrentInstallFrame := \(CurProgress \* 7\) div MaxProgress/);
  assert.match(source, /枕星AI助手将安装到这台电脑，所有用户都可以使用/);
  assert.match(source, /#ifdef PreviewMode[\s\S]*PrivilegesRequired=lowest[\s\S]*#else[\s\S]*PrivilegesRequired=admin[\s\S]*#endif/);
  assert.match(source, /\{param:ZPREVIEW\|ready\}/);
  assert.doesNotMatch(source, /WelcomeLabel1\.|WelcomeLabel2\./);
});

test("the uninstaller uses the same borderless star shell for confirmation, progress, and completion", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  assert.match(source, /function ShowCustomUninstallConfirmation: Boolean;/);
  assert.match(source, /function InitializeUninstall: Boolean;/);
  assert.match(source, /\{param:ZCONFIRMED\|0\}/);
  assert.match(source, /'\/SILENT \/ZCONFIRMED=1'/);
  assert.match(source, /ApplyBorderlessWindow\(ConfirmForm\.Handle\)/);
  assert.match(source, /PrepareStarImage\(ConfirmStar, ConfirmForm, 150, 24, 220\)/);
  assert.match(source, /ConfirmButton\.Caption := '确认卸载'/);
  assert.match(source, /CancelButton\.Caption := '取消卸载'/);
  assert.match(source, /PrepareRoundedShell\(ConfirmFrame, ConfirmPanel, ConfirmForm\)/);

  assert.match(source, /procedure BuildCustomUninstallerShell;/);
  assert.match(source, /ApplyBorderlessWindow\(UninstallProgressForm\.Handle\)/);
  assert.match(source, /PrepareStarImage\(UninstallStar, UninstallProgressForm, 150, 24, 220\)/);
  assert.match(source, /PrepareRoundedShell\(UninstallFrame, UninstallPanel, UninstallProgressForm\)/);
  assert.match(source, /PrepareProgressImage\(UninstallProgressTrack, UninstallPanel/);
  assert.match(source, /UninstallProgressFill\.Width := ScaleX\(\(328 \* ProgressPercent\) div 100\)/);
  assert.match(source, /UninstallProgressText\.Caption := IntToStr\(ProgressPercent\) \+ '%'/);
  assert.match(source, /UninstallProgressForm\.CancelButton\.Visible := False/);
  assert.match(source, /procedure ShowUninstallFinished;/);
  assert.match(source, /FinishedText\.Caption := '卸载完成，后会有期！'/);
  assert.match(source, /GoodbyeButton\.Caption := '再见！'/);
  assert.match(source, /ShowUninstallFinished;/);
});

test("server-connected packaging builds Portable once and hands win-unpacked to Inno", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts/package-server-connected-review.cjs"),
    "utf8"
  );

  assert.match(source, /require\("\.\/lib\/inno-setup\.cjs"\)/);
  assert.match(source, /generate-inno-brand-assets\.cjs/);
  assert.match(source, /compileInnoSetup\(\{/);
  assert.match(source, /sourceDir:\s*path\.join\(temporary, "win-unpacked"\)/);
  assert.match(source, /outputBaseFilename:\s*setupBaseName/);
  assert.match(source, /"--win",\s*"portable"/);
  assert.doesNotMatch(source, /"--win",\s*"portable",\s*"nsis"/);
  assert.doesNotMatch(source, /Setup\.exe\.blockmap/);
});

test("generated installer star frames preserve the supplied star silhouette", async () => {
  for (const name of ["star-0.png", "star-7.png", "star-7-twinkle.png"]) {
    const file = path.join(root, "build", "inno", "brand", name);
    const { data, info } = await sharp(file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];

    assert.equal(info.width, 320);
    assert.equal(info.height, 320);
    assert.ok(alphaAt(0, 0) <= 8, `${name} corner must be transparent`);
    assert.ok(alphaAt(160, 160) >= 220, `${name} center must remain opaque`);
  }
});
