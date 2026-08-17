"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { BRAND } = require("../shared/brand.cjs");
const packageJson = require("../package.json");
const serverConnectedReviewConfig = require("../electron-builder.server-connected-review.cjs");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const readBinary = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath));

const readBmp24 = (relativePath) => {
  const buffer = readBinary(relativePath);
  assert.equal(buffer.subarray(0, 2).toString("ascii"), "BM");
  const pixelOffset = buffer.readUInt32LE(10);
  const width = buffer.readInt32LE(18);
  const height = Math.abs(buffer.readInt32LE(22));
  assert.equal(buffer.readUInt16LE(28), 24);
  const rowStride = (width * 3 + 3) & ~3;
  let luminance = 0;
  for (let y = 0; y < height; y += 1) {
    const rowOffset = pixelOffset + y * rowStride;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + x * 3;
      luminance +=
        buffer[offset + 2] * 0.2126 +
        buffer[offset + 1] * 0.7152 +
        buffer[offset] * 0.0722;
    }
  }
  return { width, height, meanLuminance: luminance / (width * height) };
};

test("public surfaces use the ZhenXing AI Assistant brand without breaking legacy identities and paths", () => {
  const catalog = JSON.parse(read("admin/data/catalog-v1.json"));
  const communityMigrationEntrypoint = read("community/flarum/migration-entrypoint.sh");
  const language = read("src/language/index.ts");
  const index = read("index.html");
  const main = read("electron/main.cjs");
  const app = read("src/App.tsx");

  assert.deepEqual(
    { name: BRAND.name, englishName: BRAND.englishName, domain: BRAND.domain },
    { name: "枕星AI助手", englishName: "ZhenXing AI Assistant", domain: "zhenxingai.com" }
  );

  const installerSidebar = readBmp24("build/installerSidebar.bmp");
  const uninstallerSidebar = readBmp24("build/uninstallerSidebar.bmp");
  assert.ok(
    uninstallerSidebar.meanLuminance > installerSidebar.meanLuminance,
    "uninstall must begin brighter than install"
  );
  assert.equal(packageJson.build.productName, BRAND.name);
  assert.equal(packageJson.build.nsis.shortcutName, BRAND.name);
  assert.match(packageJson.build.nsis.artifactName, /^ZhenXing-AI-/);
  assert.match(packageJson.build.portable.artifactName, /^ZhenXing-AI-/);
  assert.equal(packageJson.build.appId, BRAND.legacyAppId);
  assert.equal(BRAND.legacyManagedDirectoryName, "枕星 AI");
  assert.equal(catalog.brand.name, BRAND.name);
  assert.equal(catalog.brand.mark, BRAND.mark);
  assert.equal(catalog.community.title, `${BRAND.name} 社区`);
  assert.match(communityMigrationEntrypoint, /forum_title[^\n]+枕星AI助手 社区/);
  assert.match(main, /BRAND\.legacyUserDataDirectory/);
  assert.match(main, /BRAND\.legacyManagedDirectoryName/);
  assert.match(app, /BRAND\.legacyManagedDirectoryName/);
  assert.match(main, /title: BRAND\.name/);
  assert.doesNotMatch(main, /title: `\$\{BRAND\.name\} Windows`/);
  assert.match(index, /<title>枕星AI助手<\/title>/);
  assert.equal([...language.matchAll(/"chrome\.pc": "Windows"/g)].length, 2);
  assert.doesNotMatch(app, /<small>\{uiText\("chrome\.pc"\)\}<\/small>/);
  assert.match(app, /data-aihub-brand-easter-egg-trigger/);
  assert.match(app, /brandClickCountRef\.current >= 5/);
  assert.match(app, /now - brandLastClickAtRef\.current <= 5000/);
  assert.match(app, /data-aihub-brand-easter-egg/);
  assert.match(app, /你咋知道作者有个儿子叫于枕星？哈哈哈！/);
  assert.doesNotMatch(language, /"chrome\.pc": "PC"/);
  assert.match(language, /"community\.provider": "官方社区"/);
  assert.doesNotMatch(language, /"community\.provider": "FLARUM/);
  assert.doesNotMatch(app, /community\?\.provider \|\| communityText\.text\("community\.provider"\)/);
});

test("the supplied star asset is the only client and Windows package brand icon", () => {
  const app = read("src/App.tsx");
  const styles = read("src/styles.css");
  const index = read("index.html");
  const main = read("electron/main.cjs");
  const browserIcon = readBinary("public/brand-icon.png");
  const packageIcon = readBinary("build/icon.png");
  const windowsIcon = readBinary("build/icon.ico");

  assert.equal(fs.existsSync(path.join(root, "assets/brand/zhenxing-star.png")), true);
  assert.deepEqual(browserIcon, packageIcon);
  assert.deepEqual([...packageIcon.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  assert.equal(packageIcon.readUInt32BE(16), 512);
  assert.equal(packageIcon.readUInt32BE(20), 512);

  assert.equal(windowsIcon.readUInt16LE(0), 0);
  assert.equal(windowsIcon.readUInt16LE(2), 1);
  const iconSizes = new Set();
  for (let index = 0; index < windowsIcon.readUInt16LE(4); index += 1) {
    const offset = 6 + index * 16;
    iconSizes.add(windowsIcon[offset] || 256);
  }
  assert.deepEqual(
    [16, 24, 32, 48, 64, 128, 256].filter((size) => !iconSizes.has(size)),
    []
  );

  assert.equal(packageJson.build.win.icon, "build/icon.ico");
  assert.equal(packageJson.build.nsis.installerIcon, "build/icon.ico");
  assert.equal(packageJson.build.nsis.uninstallerIcon, "build/icon.ico");
  assert.equal(serverConnectedReviewConfig.win.icon, "build/icon.ico");
  assert.equal(serverConnectedReviewConfig.nsis.installerIcon, "build/icon.ico");
  assert.equal(serverConnectedReviewConfig.nsis.uninstallerIcon, "build/icon.ico");
  assert.equal(packageJson.build.files.includes("build/icon.ico"), true);
  assert.match(main, /icon:\s*path\.join\(__dirname, "\.\.", "build", "icon\.png"\)/);
  assert.match(main, /new Tray\(trayIconPath\)/);
  assert.match(index, /<link rel="icon" type="image\/png" href="\.\/brand-icon\.png" \/>/);
  assert.match(app, /const BRAND_ICON_SRC = "\.\/brand-icon\.png";/);
  assert.equal([...app.matchAll(/<BrandMark \/>/g)].length, 6);
  assert.doesNotMatch(app, /<span>◎<\/span>/);
  assert.doesNotMatch(app, /className="brandMark">\{(?:BRAND|brand)\.mark\}/);
  assert.match(styles, /\.brandMark img\s*\{/);
  assert.equal(fs.existsSync(path.join(root, "build/icon.svg")), false);
});

test("assisted install and uninstall windows use one progress-bound star presentation", () => {
  const nsis = packageJson.build.nsis;
  const serverNsis = serverConnectedReviewConfig.nsis;
  const include = read("build/installer.nsh");

  assert.equal(nsis.include, "build/installer.nsh");
  assert.equal(nsis.installerHeader, "build/installerHeader.bmp");
  assert.equal(nsis.installerSidebar, "build/installerSidebar.bmp");
  assert.equal(nsis.uninstallerSidebar, "build/uninstallerSidebar.bmp");
  assert.equal(serverNsis.include, nsis.include);
  assert.equal(serverNsis.installerHeader, nsis.installerHeader);
  assert.equal(serverNsis.installerSidebar, nsis.installerSidebar);
  assert.equal(serverNsis.uninstallerSidebar, nsis.uninstallerSidebar);
  assert.equal(nsis.oneClick, false);
  assert.equal(nsis.perMachine, true);
  assert.equal(nsis.allowElevation, true);
  assert.equal(serverNsis.perMachine, true);
  assert.equal(serverNsis.allowElevation, true);

  assert.deepEqual(
    ["build/installerHeader.bmp", "build/installerSidebar.bmp", "build/uninstallerSidebar.bmp"].map(
      (asset) => {
        const { width, height } = readBmp24(asset);
        return [asset, width, height];
      }
    ),
    [
      ["build/installerHeader.bmp", 150, 57],
      ["build/installerSidebar.bmp", 164, 314],
      ["build/uninstallerSidebar.bmp", 164, 314],
    ]
  );

  const frames = Array.from({ length: 8 }, (_, index) =>
    readBmp24(`build/installer-brand/star-shell-${index}.bmp`)
  );
  const twinkleFrames = Array.from({ length: 8 }, (_, index) =>
    readBmp24(`build/installer-brand/star-shell-${index}-twinkle.bmp`)
  );
  assert.equal(frames.every(({ width, height }) => width === 620 && height === 620), true);
  assert.equal(
    twinkleFrames.every(({ width, height }) => width === 620 && height === 620),
    true
  );
  for (let index = 1; index < frames.length; index += 1) {
    assert.ok(
      frames[index].meanLuminance > frames[index - 1].meanLuminance,
      `star frame ${index} must be brighter than frame ${index - 1}`
    );
  }
  for (let index = 0; index < twinkleFrames.length; index += 1) {
    assert.ok(
      twinkleFrames[index].meanLuminance > frames[index].meanLuminance,
      `twinkle frame ${index} must add a silver highlight without changing its progress level`
    );
  }

  assert.match(
    include,
    /!ifndef BUILD_UNINSTALLER[\s\S]*MUI_CUSTOMFUNCTION_GUIINIT BrandInstallerGuiInit[\s\S]*!else[\s\S]*MUI_CUSTOMFUNCTION_UNGUIINIT un\.BrandUninstallerGuiInit[\s\S]*!endif/
  );
  assert.match(
    include,
    /!ifndef BUILD_UNINSTALLER[\s\S]*Function BrandInstallerGuiInit[\s\S]*FunctionEnd[\s\S]*!endif/
  );
  assert.match(
    include,
    /!ifdef BUILD_UNINSTALLER[\s\S]*Function un\.BrandUninstallerGuiInit[\s\S]*FunctionEnd[\s\S]*!endif/
  );
  for (const functionName of [
    "BrandSetWindowIcon",
    "BrandApplyInstallFrame",
    "BrandApplyProgressLayout",
    "BrandApplyDirectoryLayout",
    "BrandInstallTick",
    "BrandInstallerGuiInit",
  ]) {
    assert.equal(
      include.includes(`!ifndef BUILD_UNINSTALLER\nFunction ${functionName}`),
      true,
      `${functionName} must be excluded from the uninstaller build pass`
    );
  }
  for (const functionName of [
    "un.BrandSetWindowIcon",
    "un.BrandApplyUninstallFrame",
    "un.BrandApplyProgressLayout",
    "un.BrandUninstallTick",
    "un.BrandUninstallerGuiInit",
  ]) {
    assert.equal(
      include.includes(`!ifdef BUILD_UNINSTALLER\nFunction ${functionName}`),
      true,
      `${functionName} must be excluded from the installer build pass`
    );
  }
  assert.match(include, /!macro customWelcomePage/);
  assert.match(include, /MUI_PAGE_CUSTOMFUNCTION_SHOW BrandWelcomeShow/);
  assert.match(include, /MUI_PAGE_CUSTOMFUNCTION_SHOW BrandDirectoryShow/);
  assert.match(include, /MUI_PAGE_CUSTOMFUNCTION_SHOW BrandProgressShow/);
  assert.match(include, /MUI_PAGE_CUSTOMFUNCTION_SHOW BrandFinishShow/);
  assert.match(include, /!macro customUnWelcomePage/);
  assert.match(include, /MUI_PAGE_CUSTOMFUNCTION_SHOW un\.BrandWelcomeShow/);
  assert.match(include, /MUI_PAGE_CUSTOMFUNCTION_SHOW un\.BrandProgressShow/);
  assert.match(include, /MUI_PAGE_CUSTOMFUNCTION_SHOW un\.BrandFinishShow/);
  assert.doesNotMatch(include, /CreatePolygonRgn|SetWindowRgn|System::Alloc 384/);
  assert.match(include, /GetWindowLongW\(p \$HWNDPARENT, i-16\)/);
  assert.match(include, /SetWindowLongW\(p \$HWNDPARENT, i-16/);
  assert.match(include, /GetWindowLongW\(p \$HWNDPARENT, i-20\)/);
  assert.match(include, /SetWindowLongW\(p \$HWNDPARENT, i-20/);
  assert.match(include, /SetLayeredWindowAttributes\(p \$HWNDPARENT, i0x00211407, i255, i1\)/);
  assert.match(include, /SetWindowPos\(p \$HWNDPARENT, p0, i r\d+, i r\d+, i620, i620/);
  assert.match(include, /CreateWindowExW\([^\n]+i620, i620/);
  assert.doesNotMatch(include, /CreateRoundRectRgn|CombineRgn/);
  assert.match(include, /BrandPositionButtonsBody[\s\S]*i184, i540, i82, i32/);
  assert.match(include, /BrandPositionButtonsBody[\s\S]*i269, i540, i96, i32/);
  assert.match(include, /BrandPositionButtonsBody[\s\S]*i368, i540, i82, i32/);
  assert.match(include, /BrandWelcomeShow[\s\S]*i185, i348, i250, i44/);
  assert.match(include, /BrandWelcomeShow[\s\S]*i160, i396, i300, i56/);
  assert.match(include, /BrandApplyDirectoryLayout[\s\S]*i145, i360, i330, i28/);
  assert.match(include, /BrandApplyProgressLayout[\s\S]*i160, i372, i300, i28/);
  assert.doesNotMatch(include, /欢迎安装枕星AI助手|卸载枕星AI助手/);
  assert.match(include, /PBM_GETPOS/);
  assert.match(include, /PBM_GETRANGE/);
  assert.match(include, /BrandApplyInstallFrame/);
  assert.match(include, /BrandApplyUninstallFrame/);
  assert.match(include, /IntOp \$\d+ 7 - \$\d+/);
  assert.match(include, /WM_SETICON/);
  assert.match(include, /PBM_SETBARCOLOR/);
  assert.match(include, /BrandApplyProgressLayout/);
  assert.match(include, /BrandApplyDirectoryLayout/);
  assert.match(include, /BrandTwinklePhase/);
  assert.match(include, /BrandTwinkleTick/);
  assert.match(include, /brand-star-shell-\$BrandRequestedFrame-twinkle\.bmp/);
  assert.match(include, /NSD_CreateTimer[^\n]+90/);
  assert.match(include, /BrandTwinkleTick >= 5/);
  assert.match(include, /GetDlgItem \$\d+ \$0 1019/);
  assert.match(include, /Function BrandApplyDirectoryLayout[\s\S]*StrCpy \$BrandRequestedFrame 0/);
  assert.match(include, /SetWindowPos\(p r\d+, p0, i0, i0, i620, i620/);
  assert.match(include, /安装给这台电脑上的所有用户/);
  assert.match(include, /IntOp \$\d+ \$\d+ & 0xFF30FFFF/);
  assert.doesNotMatch(include, /Sleep\s/);
});
