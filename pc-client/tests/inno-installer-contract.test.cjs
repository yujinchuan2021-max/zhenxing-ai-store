"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
  assert.match(source, /^WizardStyle=modern hidebevels$/m);
  assert.match(source, /^WizardBackColor=#F4F8FB$/m);
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
  assert.match(source, /WizardForm\.StatusLabel\.Caption := '正在安装中…';/);
  assert.match(source, /procedure InitializeUninstallProgressForm;/);
  assert.match(source, /procedure CurUninstallStepChanged\(CurUninstallStep: TUninstallStep\);/);
  assert.match(source, /PngImage\.LoadFromFile/);
  assert.match(source, /procedure CacheUninstallAssets;/);
  assert.match(source, /FileCopy\(SourceName, TargetName, False\)/);
  assert.doesNotMatch(source, /PngImage\.LoadFromFile\(ExpandConstant\('\{app\}/);
  assert.match(source, /Flags: nowait postinstall skipifsilent runasoriginaluser/);
});

test("the visible installer is one custom star-over-controls shell instead of the stock wizard", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  const readNumericConstant = (name) => {
    const match = source.match(new RegExp(`\\b${name}\\s*=\\s*(\\d+);`));
    assert.ok(match, `${name} must be declared`);
    return Number(match[1]);
  };

  assert.match(source, /^DisableWelcomePage=yes$/m);
  assert.match(source, /^DisableReadyPage=yes$/m);
  assert.match(
    source,
    /function ShouldSkipPage\(PageID: Integer\): Boolean;\s*begin\s*Result := PageID = wpSelectTasks;\s*end;/
  );
  assert.match(source, /^Compression=lzma2\/fast$/m);
  assert.match(source, /^SolidCompression=no$/m);
  assert.doesNotMatch(source, /^LZMAUseSeparateProcess=/m);
  assert.match(source, /^CloseApplications=force$/m);
  assert.match(source, /^RestartApplications=no$/m);
  assert.match(source, /procedure BuildCustomInstallerShell;/);
  assert.match(source, /procedure ShowInstallerState\(State: Integer\);/);
  assert.match(source, /WizardForm\.OuterNotebook\.Hide/);
  assert.match(source, /WizardForm\.InnerNotebook\.Hide/);
  assert.match(source, /WizardForm\.MainPanel\.Hide/);
  assert.match(source, /WizardForm\.Bevel\.Hide/);
  assert.match(source, /StarBaseForm := CreateCustomForm\(ScaleX\(220\), ScaleY\(220\), False, True\)/);
  assert.match(source, /CreateStarOverlay\(WizardForm, False\)/);
  assert.match(source, /ShellFrame := TPanel\.Create\(WizardForm\)/);
  assert.match(source, /ShellPanel := TPanel\.Create\(WizardForm\)/);
  assert.match(source, /PrepareRoundedShell\(ShellFrame, ShellPanel, WizardForm\)/);
  assert.match(source, /PrepareProgressImage\(ShellProgressTrack, ShellPanel/);
  assert.match(source, /ShellProgressFill\.Width := ScaleX\(\(338 \* CurProgress\) div MaxProgress\)/);
  assert.match(source, /Panel\.Color := \$00FEFCF8/);
  assert.match(source, /ShellAccent\.Color := \$008B7E08/);
  assert.match(source, /procedure ApplyBorderlessWindow\(FormHandle: HWND\);/);
  assert.match(source, /Style := Style and not \(WSCaption or WSThickFrame or WSSystemMenu/);
  assert.match(source, /ApplyBorderlessWindow\(WizardForm\.Handle\)/);
  assert.match(source, /procedure ApplyTransparentBackdrop\(FormHandle: HWND\);/);
  assert.match(source, /SetLayeredWindowAttributes\(FormHandle, TransparentKeyColor, 255, LWAColorKey\)/);
  assert.match(source, /procedure InstallDragWindowProc\(Form: TSetupForm; var OriginalProc: Longint; var FormHandle: HWND\);/);
  assert.match(source, /if \(Message = WMNCHitTest\)[\s\S]*Result := HTCaption/);
  assert.match(source, /InstallDragWindowProc\(WizardForm, WizardOriginalWndProc, WizardDragHandle\)/);
  assert.match(source, /WizardForm\.DirEdit\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.DirBrowseButton\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.ProgressGauge\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.NextButton\.Parent := ShellPanel/);
  assert.match(source, /WizardForm\.CancelButton\.Parent := ShellPanel/);
  assert.match(
    source,
    /procedure ShowInstallerState\(State: Integer\);[\s\S]*?WizardForm\.BackButton\.Visible := False;/
  );
  assert.match(source, /WizardForm\.NextButton\.Caption := '安装'/);
  assert.match(
    source,
    /else if \(CurPageID = wpPreparing\) or \(CurPageID = wpInstalling\) then\s+ShowInstallerState\(ShellInstallingState\)/
  );
  assert.match(source, /ShellLaunchButton\.Caption := '打开枕星AI助手'/);
  assert.match(source, /WizardForm\.NextButton\.Caption := '关闭窗口'/);
  assert.match(source, /ShellProgressText\.Caption := IntToStr\(\(CurProgress \* 100\) div MaxProgress\) \+ '%'/);
  assert.match(source, /procedure AdvanceStarOverlay;/);
  assert.doesNotMatch(source, /BrandTwinkle := not BrandTwinkle/);
  assert.match(source, /SetTimer\(0, 0, BrandTimerIntervalMs, CreateCallback\(@BrandTimerProc\)\)/);
  assert.ok(
    readNumericConstant("BrandTimerIntervalMs") *
      readNumericConstant("BrandBreathCycleSteps") >= 4000,
    "one complete star breathing cycle must last at least four seconds"
  );
  assert.ok(
    readNumericConstant("BrandTimerIntervalMs") <= 125,
    "the star animation must refresh at least eight times per second"
  );
  assert.equal(readNumericConstant("BrandTimerIntervalMs"), 33);
  assert.equal(readNumericConstant("BrandBreathHalfSteps"), 96);
  assert.equal(readNumericConstant("BrandBreathCycleSteps"), 192);
  assert.doesNotMatch(source, /CurrentInstallFrame := \(CurProgress \* 7\) div MaxProgress/);
  assert.doesNotMatch(source, /管理员全机安装 · 保留现有设置 · 可安全卸载/);
  assert.doesNotMatch(source, /枕星AI助手将安装到这台电脑，所有用户都可以使用/);
  assert.match(
    source,
    /State = ShellInstallingState[\s\S]*WizardForm\.CancelButton\.Caption := '取消安装';[\s\S]*WizardForm\.CancelButton\.Visible := True/
  );
  assert.match(source, /#ifdef PreviewMode[\s\S]*PrivilegesRequired=lowest[\s\S]*#else[\s\S]*PrivilegesRequired=admin[\s\S]*#endif/);
  assert.match(source, /\{param:ZPREVIEW\|ready\}/);
  assert.doesNotMatch(source, /WelcomeLabel1\.|WelcomeLabel2\./);
});

test("star breathing is compositor-driven and never swaps a visible bitmap frame", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  assert.match(source, /StarOverlayForm: TSetupForm;/);
  assert.match(source, /StarOverlayImage: TBitmapImage;/);
  assert.match(source, /StarOverlayOwner: TSetupForm;/);
  assert.match(source, /procedure CreateStarOverlay\(OwnerForm: TSetupForm; StartSilver: Boolean\);/);
  assert.match(source, /StarOverlayImage\.Bitmap\.AlphaFormat := afPremultiplied;[\s\S]*StarOverlayImage\.Bitmap\.LoadFromFile\([\s\S]*star-silver\.bmp/);
  assert.match(source, /StarOverlayForm\.PopupParent := OwnerForm;/);
  assert.match(source, /StarOverlayForm\.PopupMode := pmExplicit;/);
  assert.match(
    source,
    /ApplyBorderlessWindow\(StarOverlayForm\.Handle\);[\s\S]*StarOverlayForm\.ClientWidth := ScaleX\(220\);[\s\S]*StarOverlayForm\.ClientHeight := ScaleY\(220\);/
  );
  assert.match(source, /WSExTransparent|WSExNoActivate|WSExToolWindow/);
  assert.match(source, /ClientToScreen\(StarOverlayOwner\.Handle, Point\)/);
  assert.match(
    source,
    /Point\.X := ScaleX\(150\);[\s\S]*Point\.Y := ScaleY\(24\);[\s\S]*SetWindowPos\(StarOverlayForm\.Handle, 0,\s*Point\.X, Point\.Y/
  );
  assert.doesNotMatch(
    source,
    /StarOverlayOwner\.Left \+ ScaleX\(150\)|StarOverlayOwner\.Top \+ ScaleY\(24\)/
  );
  assert.match(source, /function UpdateLayeredWindow\(/);
  assert.match(source, /ULWAlpha\s*=\s*\$00000002/);
  assert.match(source, /ACSrcAlpha\s*=\s*\$01/);
  assert.match(source, /procedure RenderStarLayer\(Form: TSetupForm; Image: TBitmapImage; Alpha: Byte\);/);
  assert.match(source, /Blend\.SourceConstantAlpha := Alpha/);
  assert.match(source, /Blend\.AlphaFormat := ACSrcAlpha/);
  assert.match(source, /UpdateLayeredWindow\(Form\.Handle,[\s\S]*Image\.Bitmap\.Canvas\.Handle[\s\S]*ULWAlpha\)/);
  assert.match(source, /RenderStarLayer\(StarOverlayForm, StarOverlayImage, Alpha\)/);
  assert.doesNotMatch(source, /SetLayeredWindowAttributes\(Star(?:Base|Overlay)Form\.Handle/);
  assert.doesNotMatch(source, /Star(?:Base|Overlay)Image\.BackColor := TransparentKeyColor/);
  assert.match(source, /procedure AdvanceStarOverlay;/);
  assert.doesNotMatch(source, /LoadBrandFrameBuffered|PngImage\.Assign|ShellStarBuffer|ConfirmStarBuffer|UninstallStarBuffer|FinishedStarBuffer/);
  assert.doesNotMatch(source, /star-\d+-twinkle\.png/);

  const baseRender = source.indexOf(
    "RenderStarLayer(StarBaseForm, StarBaseImage, 255);"
  );
  const overlayRender = source.indexOf("ResetStarOverlay(StartSilver);");
  const baseShow = source.indexOf("StarBaseForm.Show;");
  const overlayShow = source.indexOf("StarOverlayForm.Show;");
  assert.ok(baseRender >= 0 && baseRender < baseShow,
    "the opaque star layer must be composed before its window is shown");
  assert.ok(overlayRender >= 0 && overlayRender < overlayShow,
    "the breathing layer must be composed before its window is shown");
});

test("overwrite install keeps the user on the ready screen until the running client exits", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  assert.match(source, /WizardForm\.Caption := '枕星AI助手 安装'/);
  assert.match(source, /function EnsureInstalledClientClosed: Boolean;/);
  assert.match(source, /FindWindowByWindowName\('\{#AppName\}'\)/);
  assert.match(source, /MB_RETRYCANCEL/);
  assert.match(
    source,
    /function NextButtonClick\(CurPageID: Integer\): Boolean;[\s\S]*CurPageID = wpSelectDir[\s\S]*EnsureInstalledClientClosed/
  );
  assert.doesNotMatch(source, /TerminateProcess|taskkill/i);
});

test("installer and uninstaller leave the desktop visible outside the card", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  assert.match(source, /WizardForm\.Color := TransparentKeyColor/);
  assert.match(source, /ConfirmForm\.Color := TransparentKeyColor/);
  assert.match(source, /UninstallProgressForm\.Color := TransparentKeyColor/);
  assert.match(source, /FinishedForm\.Color := TransparentKeyColor/);
  assert.match(source, /StarBaseForm: TSetupForm;/);
  assert.match(source, /StarBaseImage: TBitmapImage;/);
  assert.match(source, /procedure ApplyCardWindowRegion\(FormHandle: HWND\);/);
  assert.match(
    source,
    /CreateRoundRectRgn\(ScaleX\(24\), ScaleY\(252\), ScaleX\(496\),\s*ScaleY\(528\), ScaleX\(26\), ScaleY\(26\)\)/
  );
  for (const form of [
    "WizardForm.Handle",
    "ConfirmForm.Handle",
    "UninstallProgressForm.Handle",
    "FinishedForm.Handle",
  ]) {
    assert.match(source, new RegExp(`ApplyCardWindowRegion\\(${form.replace(".", "\\.")}\\)`));
  }
  assert.match(source, /StarBaseImage\.Bitmap\.AlphaFormat := afPremultiplied;[\s\S]*StarBaseImage\.Bitmap\.LoadFromFile\([\s\S]*star-base\.bmp/);
  assert.match(source, /RenderStarLayer\(StarBaseForm, StarBaseImage, 255\)/);
  assert.match(source, /RenderStarLayer\(StarOverlayForm, StarOverlayImage,/);
  assert.doesNotMatch(source, /PrepareStarImage\((?:ShellStar|ConfirmStar|UninstallStar|FinishedStar),/);
  assert.doesNotMatch(source, /wizard-back\.png|PrepareBackdropImage|ShellBackdrop|ConfirmBackdrop|UninstallBackdrop|FinishedBackdrop/);
});

test("closing the finished installer never launches the client implicitly", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  assert.match(
    source,
    /Flags: nowait postinstall skipifsilent runasoriginaluser unchecked/
  );
  assert.match(
    source,
    /procedure LaunchInstalledAppClick\(Sender: TObject\);[\s\S]*WizardForm\.RunList\.Checked\[0\] := True;[\s\S]*WizardForm\.NextButton\.OnClick/
  );
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
  assert.match(source, /CreateStarOverlay\(ConfirmForm, True\)/);
  assert.match(source, /ConfirmButton\.Caption := '确认卸载'/);
  assert.match(source, /CancelButton\.Caption := '取消卸载'/);
  assert.match(source, /PrepareRoundedShell\(ConfirmFrame, ConfirmPanel, ConfirmForm\)/);

  assert.match(source, /procedure BuildCustomUninstallerShell;/);
  assert.match(source, /ApplyBorderlessWindow\(UninstallProgressForm\.Handle\)/);
  assert.match(source, /CreateStarOverlay\(UninstallProgressForm, True\)/);
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

test("installer and uninstaller timers fail closed after their controls stop being valid", () => {
  const source = fs.readFileSync(
    path.join(root, "build/inno/installer.iss"),
    "utf8"
  );

  for (const name of [
    "InstallerAnimationReady",
    "ConfirmAnimationReady",
    "UninstallAnimationReady",
    "FinishedAnimationReady",
  ]) {
    assert.match(source, new RegExp(`\\b${name}: Boolean;`));
  }
  assert.match(
    source,
    /procedure BrandTimerProc[\s\S]*?begin\s+if not InstallerAnimationReady then\s+Exit;/
  );
  assert.match(
    source,
    /procedure ConfirmTimerProc[\s\S]*?begin\s+if not ConfirmAnimationReady then\s+Exit;/
  );
  assert.match(
    source,
    /procedure UninstallTimerProc[\s\S]*?begin\s+if not UninstallAnimationReady then\s+Exit;/
  );
  assert.match(
    source,
    /procedure FinishedTimerProc[\s\S]*?begin\s+if not FinishedAnimationReady then\s+Exit;/
  );
  assert.match(
    source,
    /CurUninstallStep = usDone[\s\S]*?UninstallAnimationReady := False;[\s\S]*?KillTimer\(0, UninstallTimerId\)/
  );
  assert.match(
    source,
    /procedure DeinitializeUninstall;\s*begin\s+ConfirmAnimationReady := False;\s+FinishedAnimationReady := False;\s+UninstallAnimationReady := False;/
  );
});

test("installer progress assets use the client mist-blue palette", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts/generate-inno-brand-assets.cjs"),
    "utf8"
  ).toLowerCase();

  assert.match(source, /#b9cad8/);
  assert.match(source, /#e8f1f6/);
  assert.match(source, /#16aabd/);
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

test("generated installer stars preserve the supplied silhouette without frame sequences", async () => {
  const generated = fs.readdirSync(path.join(root, "build", "inno", "brand"));
  assert.deepEqual(
    generated.filter((name) => /^star-(?:base|silver)\.bmp$/.test(name)).sort(),
    ["star-base.bmp", "star-silver.bmp"]
  );
  assert.equal(generated.filter((name) => /^star-\d+(?:-twinkle)?\.png$/.test(name)).length, 0);

  for (const name of ["star-base.bmp", "star-silver.bmp"]) {
    const file = path.join(root, "build", "inno", "brand", name);
    const data = fs.readFileSync(file);
    assert.equal(data.toString("ascii", 0, 2), "BM");
    const pixelOffset = data.readUInt32LE(10);
    const width = data.readInt32LE(18);
    const height = data.readInt32LE(22);
    assert.equal(data.readUInt16LE(28), 32);
    assert.equal(data.readUInt32LE(30), 0);
    assert.equal(width, 220);
    assert.equal(height, -220, "the DIB must be top-down for direct layered-window composition");
    const pixelAt = (x, y) => {
      const offset = pixelOffset + (y * width + x) * 4;
      return {
        b: data[offset],
        g: data[offset + 1],
        r: data[offset + 2],
        a: data[offset + 3]
      };
    };
    const alphaAt = (x, y) => pixelAt(x, y).a;

    assert.ok(alphaAt(0, 0) <= 8, `${name} corner must be transparent`);
    assert.ok(alphaAt(110, 110) >= 220, `${name} center must remain opaque`);
    for (const [x, y] of [[0, 0], [110, 110], [60, 110], [110, 60]]) {
      const pixel = pixelAt(x, y);
      assert.ok(pixel.r <= pixel.a && pixel.g <= pixel.a && pixel.b <= pixel.a,
        `${name} pixels must be premultiplied for UpdateLayeredWindow`);
    }
  }
});
