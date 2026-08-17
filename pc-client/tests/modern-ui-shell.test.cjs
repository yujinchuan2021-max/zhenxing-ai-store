"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const entry = fs.readFileSync(path.join(root, "src", "main.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const language = fs.readFileSync(path.join(root, "src", "language", "index.ts"), "utf8");
const main = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

test("desktop chrome integrates native Windows controls into the draggable app header", () => {
  const windowOptions = main.slice(
    main.indexOf("const window = new BrowserWindow({"),
    main.indexOf("webPreferences:", main.indexOf("const window = new BrowserWindow({"))
  );

  assert.match(windowOptions, /title:\s*BRAND\.name/);
  assert.match(windowOptions, /titleBarStyle:\s*"hidden"/);
  assert.match(
    windowOptions,
    /titleBarOverlay:\s*\{[\s\S]*?color:\s*"#00000000"[\s\S]*?symbolColor:\s*"#10203b"[\s\S]*?height:\s*88[\s\S]*?\}/
  );
  assert.doesNotMatch(windowOptions, /frame:\s*false/);
  assert.match(index, /<title>枕星AI助手<\/title>/);
  assert.doesNotMatch(index, /<title>枕星AI助手 Windows<\/title>/);
  assert.match(styles, /--window-controls-width:\s*138px/);
  assert.match(
    styles,
    /\.topbar\s*\{[\s\S]*?-webkit-app-region:\s*drag[\s\S]*?app-region:\s*drag/
  );
  assert.match(
    styles,
    /\.topbar :is\([^}]+\)\s*\{[\s\S]*?-webkit-app-region:\s*no-drag[\s\S]*?app-region:\s*no-drag/
  );
});

test("modern shell uses the pinned icon system and replaces legacy chrome glyphs", () => {
  assert.equal(packageJson.dependencies["@tabler/icons-react"], "3.46.0");
  assert.match(app, /@tabler\/icons-react\/dist\/esm\/icons\/IconSearch\.mjs/);
  const chrome = app.slice(
    app.indexOf('<AppShell.Header className="topbar">'),
    app.indexOf('</AppShell.Header>')
  );
  assert.ok(chrome.length > 0, "top chrome seam must remain observable");
  assert.doesNotMatch(chrome, /⌕|⚙|🔔|>↓</);
  assert.match(styles, /--mint:\s*var\(--zx-accent\)/);
  assert.match(styles, /\.navItem\.active::before/);
});

test("client update stays at the bottom of the sidebar and only offers an action when available", () => {
  const topbar = app.slice(
    app.indexOf('<AppShell.Header className="topbar">'),
    app.indexOf('</AppShell.Header>')
  );
  const sidebar = app.slice(
    app.indexOf('<AppShell.Navbar'),
    app.indexOf('</AppShell.Navbar>')
  );

  assert.equal((app.match(/data-aihub-client-update-status/g) || []).length, 1);
  assert.doesNotMatch(topbar, /data-aihub-client-update-status/);
  assert.match(sidebar, /className=\{`clientUpdateBadge[^`]*sidebarUpdate/);
  assert.match(sidebar, /data-aihub-client-update-status/);
  assert.match(
    sidebar,
    /updateResult\?\.status === "available"\s*&&\s*\([\s\S]*?onClick=\{installUpdate\}[\s\S]*?update\.availableAction/
  );
  assert.doesNotMatch(sidebar, /checkForUpdate\(true\)/);
  assert.match(app, /void checkForUpdate\(false\)\.catch\(\(\) => undefined\)/);
  for (const key of [
    "update.version",
    "update.availableAction",
    "update.installing"
  ]) {
    assert.equal((language.match(new RegExp(`"${key}"`, "g")) || []).length, 2);
  }
  assert.match(
    styles,
    /\.sidebar\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column/
  );
  const sidebarUpdateStyles = styles.slice(
    styles.indexOf(".sidebarUpdate {"),
    styles.indexOf("}", styles.indexOf(".sidebarUpdate {")) + 1
  );
  assert.match(sidebarUpdateStyles, /position:\s*sticky/);
  assert.match(sidebarUpdateStyles, /bottom:\s*0/);
  assert.match(sidebarUpdateStyles, /margin-top:\s*auto/);
  assert.doesNotMatch(
    styles,
    /@media \(max-width:\s*1280px\) \{\r?\n\s{2}\.clientUpdateBadge\s*\{/
  );
  const updateFetch = main.slice(
    main.indexOf("async function fetchUpdateManifest"),
    main.indexOf("async function checkForUpdate")
  );
  assert.match(updateFetch, /redirect:\s*"manual"/);
  assert.match(updateFetch, /Accept:\s*"application\/json"/);
  assert.match(updateFetch, /finalUrl\.toString\(\) !== channel\.releaseUrl/);
  assert.match(updateFetch, /contentType !== "application\/json"/);

  const settingsPanel = app.slice(
    app.indexOf("function SettingsPanel({"),
    app.indexOf("function SettingBlock({")
  );
  assert.doesNotMatch(settingsPanel, /auto\.42e40f432b6d/);
});

test("vendor directories reuse the resource-store hero treatment", () => {
  const vendorDirectory = app.slice(
    app.indexOf("function VendorsPage({"),
    app.indexOf("function FilterRow({")
  );
  assert.match(vendorDirectory, /<header className="pageHeader resourceStoreHeader">/);
  assert.match(styles, /\.resourceStoreHeader::after/);
});

test("theme has one persisted owner and the dark palette stays soft and coherent", () => {
  assert.match(
    app,
    /const \{ colorScheme, setColorScheme \} = useMantineColorScheme\(\)/
  );
  assert.match(
    app,
    /const theme: "light" \| "dark" = colorScheme === "dark" \? "dark" : "light"/
  );
  assert.doesNotMatch(app, /useState<"light" \| "dark">\("light"\)/);

  const changeTheme = app.slice(
    app.indexOf("const changeTheme"),
    app.indexOf("const openSettings", app.indexOf("const changeTheme"))
  );
  assert.doesNotMatch(changeTheme, /setTheme\(/);
  assert.match(changeTheme, /setColorScheme\(next\)/);

  assert.match(
    styles,
    /\.pcApp\[data-theme="dark"\]\s*\{[\s\S]*?--zx-surface-canvas:\s*#151b24[\s\S]*?--zx-surface-raised:\s*#202936/
  );
  assert.match(
    styles,
    /\.pcApp\s*\{[\s\S]*?linear-gradient\(180deg,\s*var\(--zx-surface-hero\)[\s\S]*?var\(--paper\)/
  );

  const settingsPanel = app.slice(
    app.indexOf("function SettingsPanel({"),
    app.indexOf("function SettingBlock({")
  );
  assert.match(settingsPanel, /overlayProps=\{\{ backgroundOpacity: 0\.18, blur: 0 \}\}/);
});

test("dark surfaces keep primary actions and supporting copy readable", () => {
  const rootTokens = styles.slice(styles.indexOf(":root {"), styles.indexOf("\n}\n\n*"));
  assert.match(rootTokens, /--on-deep:\s*#f8fbff/);

  const searchButtonStart = styles.lastIndexOf(".search button {");
  const searchButton = styles.slice(
    searchButtonStart,
    styles.indexOf("}", searchButtonStart) + 1
  );
  assert.match(searchButton, /color:\s*var\(--on-deep\)/);

  const primaryActionStart = styles.lastIndexOf(".primaryAction {");
  const primaryAction = styles.slice(
    primaryActionStart,
    styles.indexOf("}", primaryActionStart) + 1
  );
  assert.match(primaryAction, /color:\s*var\(--on-deep\)/);
  assert.match(primaryAction, /background:\s*var\(--deep\)/);

  const resourceOutcomeStart = styles.indexOf(".resourceOutcomeItem {");
  const resourceOutcome = styles.slice(
    resourceOutcomeStart,
    styles.indexOf("}", resourceOutcomeStart) + 1
  );
  assert.match(resourceOutcome, /color:\s*var\(--ink\)/);

  const productKindStart = styles.indexOf(".productKind {");
  const productKind = styles.slice(
    productKindStart,
    styles.indexOf("}", productKindStart) + 1
  );
  assert.match(productKind, /color:\s*var\(--muted\)/);
  assert.doesNotMatch(productKind, /#6da23f/i);
});

test("catalog and resource surfaces omit redundant decorative overlines", () => {
  const homePage = app.slice(
    app.indexOf("function HomePage({"),
    app.indexOf("function SearchResultsPage({")
  );
  const searchResults = app.slice(
    app.indexOf("function SearchResultsPage({"),
    app.indexOf("function VendorsPage({")
  );
  const vendorDirectory = app.slice(
    app.indexOf("function VendorsPage({"),
    app.indexOf("function FilterRow({")
  );
  const vendorPage = app.slice(
    app.indexOf("function VendorPage({"),
    app.indexOf("function ResourceStorePage({")
  );
  const resourceStorePage = app.slice(
    app.indexOf("function ResourceStorePage({"),
    app.indexOf("function ResourceRow({")
  );

  assert.doesNotMatch(homePage, /carousel\.eyebrow|catalogDisplayField\(banner, "eyebrow"|auto\.cf2b91fc1b4a|auto\.2e10281b39c0/);
  assert.doesNotMatch(searchResults, /<p>\{uiText\("resources\.eyebrow"\)\}<\/p>|directory\.(?:ai|connectable)\.eyebrow|resourceStoreDisplayLabel\(result\.store/);
  assert.doesNotMatch(vendorDirectory, /directory\.(?:ai|connectable)\.eyebrow/);
  assert.doesNotMatch(vendorPage, /auto\.1ffe67baf7b9|auto\.47935eda89dd|auto\.ca89fe5c9aa4/);
  assert.doesNotMatch(resourceStorePage, /resources\.eyebrow|<small>\{storeLabel\}<\/small>/);
});

test("resource store uses a split filter rail and icon-led full-width cards", () => {
  const resourceStorePage = app.slice(
    app.indexOf("function ResourceStorePage({"),
    app.indexOf("function ResourceRow({")
  );

  assert.match(resourceStorePage, /className=\{`resourceStorePage/);
  assert.match(resourceStorePage, /data-aihub-resource-store-window=\{store\.id\}/);
  assert.match(resourceStorePage, /className="resourceStoreBrowse"/);
  assert.match(resourceStorePage, /data-aihub-resource-filter-panel/);
  assert.match(resourceStorePage, /data-aihub-resource-results-scroll/);
  assert.match(resourceStorePage, /tabIndex=\{0\}/);
  assert.match(resourceStorePage, /className="resourceCardIcon"/);
  assert.doesNotMatch(resourceStorePage, /marker="scenario"/);
  assert.doesNotMatch(resourceStorePage, /resourceFilterUnavailable/);
  const resourceDetailHeader = resourceStorePage.slice(
    resourceStorePage.indexOf('<header className="resourceLevelHeader">'),
    resourceStorePage.indexOf("</header>", resourceStorePage.indexOf('<header className="resourceLevelHeader">'))
  );
  assert.doesNotMatch(resourceDetailHeader, /<small>\{storeLabel\}<\/small>/);
  assert.match(styles, /\.resourceStorePage\s*\{[\s\S]*?height:\s*calc\(100dvh - 190px\)[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*?overflow:\s*hidden/);
  assert.match(styles, /\.resourceStoreBrowse\s*\{[\s\S]*?grid-template-columns:\s*minmax\(300px, 360px\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.resourceFilterPanel\s*\{[\s\S]*?height:\s*100%[\s\S]*?overflow-y:\s*auto/);
  assert.match(styles, /\.resourceStoreResults\s*\{[\s\S]*?height:\s*100%[\s\S]*?overflow-y:\s*auto[\s\S]*?overscroll-behavior:\s*contain/);
  assert.match(styles, /\.resourceStoreResults \.resourceCardGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(styles, /\.resourceLevel\s*\{[\s\S]*?align-content:\s*start[\s\S]*?overflow-y:\s*auto/);
  assert.match(styles, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.resourceStorePage\s*\{[\s\S]*?height:\s*auto[\s\S]*?overflow:\s*visible/);
});

test("every resource detail leads with a useful overview and keeps install facts compact", () => {
  const page = app.slice(app.indexOf("function ResourceStorePage({"), app.indexOf("function ResourceRow({"));
  const row = app.slice(app.indexOf("function ResourceRow({"), app.indexOf("function FixedCliLifecycleActions({"));
  assert.match(page, /data-aihub-resource-overview/);
  assert.match(page, /data-aihub-resource-purpose/);
  assert.match(app, /const RESOURCE_TYPE_OUTCOME_KEYS/);
  assert.match(app, /function resourceOutcomeKeys/);
  assert.match(app, /resource\.scenarioTags/);
  assert.match(page, /resourceOutcomeKeys\(selectedEntry\.resource\)\.map/);
  assert.match(page, /data-aihub-resource-outcome/);
  assert.match(page, /resources\.whatItDoes/);
  assert.match(page, /resources\.outcomeIntro/);
  assert.match(page, /resources\.resourceNote/);
  assert.match(row, /className="resourceRowMain"/);
  assert.match(row, /resources\.installAndTrust/);
  assert.doesNotMatch(row, /className="resourceRowHeading"/);
  assert.doesNotMatch(row, /className="resourceRowDescription"/);
  assert.match(styles, /\.resourceOverview\s*\{/);
  assert.match(styles, /\.resourcePurpose\s*\{/);
  assert.match(styles, /\.resourceOutcomeList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.resourceOutcomeItem\s*\{/);
  assert.match(styles, /@media \(max-width:\s*720px\)\s*\{[\s\S]*?\.resourceOutcomeList\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(language, /代码审查[^"\r\n]*重复逻辑[^"\r\n]*重复代码[^"\r\n]*返工/);
  assert.match(styles, /\.resourceRow\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.resourceFacts\s*\{[\s\S]*?display:\s*grid[\s\S]*?repeat\(auto-fit, minmax\(200px, 1fr\)\)/);
});

test("dense product, installed and environment cards separate identity, status and actions", () => {
  const productRow = app.slice(app.indexOf("function ProductRow({"), app.indexOf("function AuthModal"));
  const installedPage = app.slice(app.indexOf("function InstalledProductsPage({"), app.indexOf("function SettingsPanel({"));
  const settingsPanel = app.slice(app.indexOf("function SettingsPanel({"), app.indexOf("function SettingBlock({"));

  assert.match(productRow, /className="productInfoMain"/);
  assert.match(productRow, /className="productStatusStack"/);
  assert.match(installedPage, /className="managementCard installedProductCard"/);
  assert.match(installedPage, /className="managementIdentity"/);
  assert.match(installedPage, /className="managementStatusStack"/);
  assert.match(settingsPanel, /className="environmentItem"/);
  assert.match(settingsPanel, /className="environmentItemMain"/);
  assert.match(settingsPanel, /className="environmentItemActions"/);

  assert.match(styles, /\.productInfo\s*\{[\s\S]*?display:\s*grid/);
  assert.match(styles, /\.installedProductCard \.managementStatusStack\s*\{[\s\S]*?display:\s*grid/);
  assert.match(styles, /\.environmentItemActions\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-wrap:\s*wrap/);
});

test("Mantine phase one stays a shell layer over existing navigation and task state", () => {
  for (const dependency of [
    "@mantine/core",
    "@mantine/hooks",
    "@mantine/notifications",
    "@mantine/spotlight"
  ]) {
    assert.equal(packageJson.dependencies[dependency], "9.5.1");
  }

  assert.match(entry, /@mantine\/core\/styles\.css/);
  assert.match(entry, /@mantine\/notifications\/styles\.css/);
  assert.match(entry, /@mantine\/spotlight\/styles\.css/);
  assert.match(entry, /<MantineProvider[^>]*theme=\{aiHubTheme\}/);
  assert.match(entry, /<Notifications[^>]*className="aiHubNotifications"/);

  assert.match(app, /<Spotlight[\s\S]*?actions=\{spotlightActions\}/);
  assert.match(app, /shortcut="mod \+ K"/);
  assert.match(app, /limit=\{7\}/);
  assert.match(app, /data-aihub-command-center/);
  assert.match(app, /onClick=\{spotlight\.open\}/);
  assert.match(app, /<Popover[\s\S]*?data-aihub-download-trigger/);

  const commandCenter = app.slice(
    app.indexOf("const spotlightActions"),
    app.indexOf("if (catalogStartupPending)")
  );
  assert.match(commandCenter, /navigate\("home"\)/);
  assert.match(commandCenter, /openVendorDirectory\("ai-tool"\)/);
  assert.match(commandCenter, /openResourceStore\(store\.id\)/);
  assert.match(commandCenter, /openInstalledManagement\(\)/);
  assert.match(commandCenter, /setSettingsOpen\(true\)/);
  assert.doesNotMatch(
    commandCenter,
    /requestUnifiedInstall|uninstallManagedProduct|deployCli|downloadProduct/
  );

  assert.match(app, /downloadNotificationsReady/);
  assert.match(app, /notifications\.show/);
  assert.match(app, /if \(!downloadNotificationsReady\.current\)/);
  assert.match(app, /const checkForUpdate = async \(announce = false\)/);
  assert.match(app, /void checkForUpdate\(false\)/);
});

test("Mantine phase two keeps navigation and compact filters on the existing public seams", () => {
  assert.match(app, /import \{[\s\S]*?AppShell[\s\S]*?Burger[\s\S]*?Select[\s\S]*?\} from "@mantine\/core"/);
  assert.match(app, /<AppShell[\s\S]*?data-aihub-app-shell/);
  assert.match(app, /<AppShell\.Header className="topbar">/);
  assert.match(app, /<AppShell\.Navbar[\s\S]*?id="primary-navigation"[\s\S]*?className="sidebar"/);
  assert.match(app, /<AppShell\.Main[\s\S]*?className=\{`appShellMain/);
  assert.match(app, /data-aihub-mobile-nav-toggle/);
  assert.match(app, /aria-controls="primary-navigation"/);
  assert.match(app, /aria-expanded=\{mobileNavigationOpen\}/);
  assert.match(app, /useMediaQuery\("\(max-width: 47\.99em\)"\)/);
  assert.match(app, /mobileViewport && !mobileNavigationOpen[\s\S]*?translateX\(-100%\)[\s\S]*?translateX\(0\)/);

  const filterRow = app.slice(
    app.indexOf("function FilterRow({"),
    app.indexOf("type ContributionForm")
  );
  assert.match(filterRow, /<Select/);
  assert.match(filterRow, /data-aihub-filter-compact=\{marker\}/);
  assert.match(filterRow, /value=\{active\}/);
  assert.match(filterRow, /onChange=\{\(value\) => value && onChange\(value\)\}/);
  assert.match(filterRow, /className="filterChipGroup"/);
  assert.match(filterRow, /data-aihub-filter-value=\{value\}/);
});

test("settings uses an accessible Mantine drawer without changing its public controls", () => {
  assert.match(app, /import \{[\s\S]*?ActionIcon[\s\S]*?Drawer[\s\S]*?\} from "@mantine\/core"/);

  const settingsPanel = app.slice(
    app.indexOf("function SettingsPanel({"),
    app.indexOf("function SettingBlock({")
  );
  assert.match(settingsPanel, /opened:\s*boolean/);
  assert.match(settingsPanel, /<Drawer[\s\S]*?opened=\{opened\}[\s\S]*?onClose=\{onClose\}/);
  assert.match(settingsPanel, /data-aihub-settings-drawer/);
  assert.match(settingsPanel, /<aside className="settingsPanel"/);
  assert.match(settingsPanel, /<ActionIcon[\s\S]*?onClick=\{onClose\}[\s\S]*?aria-label/);
  assert.match(settingsPanel, /<IconX size=\{18\}/);
  assert.doesNotMatch(settingsPanel, /className="overlay"/);
});

test("authentication keeps its existing service calls inside Mantine form controls", () => {
  assert.match(app, /import \{[\s\S]*?Modal[\s\S]*?PasswordInput[\s\S]*?TextInput[\s\S]*?\} from "@mantine\/core"/);

  const authModal = app.slice(
    app.indexOf("function AuthModal({"),
    app.indexOf("type PersonalCenterTab")
  );
  assert.match(authModal, /<Modal[\s\S]*?opened[\s\S]*?onClose=\{onClose\}/);
  assert.match(authModal, /data-aihub-auth-modal/);
  assert.match(authModal, /<TextInput[\s\S]*?autoComplete="username"/);
  assert.match(authModal, /<PasswordInput[\s\S]*?autoComplete="current-password"/);
  assert.match(authModal, /<PasswordInput[\s\S]*?autoComplete="new-password"/);
  assert.match(authModal, /window\.aihubPC\.login\(\{ identifier, password \}\)/);
  assert.match(authModal, /window\.aihubPC\.register\(\{/);
  assert.doesNotMatch(authModal, /className="modalBackdrop"/);
  assert.match(styles, /\.authForm \.mantine-Input-input\s*\{[\s\S]*?border:[\s\S]*?background:/);
  assert.match(styles, /\.authForm \.mantine-InputWrapper-label\s*\{/);
  assert.doesNotMatch(styles, /\.authForm label\s*\{/);
  const rootTokens = styles.slice(styles.indexOf(":root {"), styles.indexOf("\n}\n\n*"));
  assert.match(rootTokens, /--ink:/);
  assert.match(rootTokens, /--surface:/);
  assert.match(rootTokens, /--paper:/);
  assert.match(rootTokens, /--cyan:/);
  assert.match(styles, /html\[data-mantine-color-scheme="dark"\]\s*\{[\s\S]*?--ink:[\s\S]*?--surface:[\s\S]*?--paper:/);
});

test("installed software exposes one batch update action with Mantine loading feedback", () => {
  assert.match(app, /import \{[\s\S]*?Button[\s\S]*?\} from "@mantine\/core"/);

  const installedPage = app.slice(
    app.indexOf("function InstalledProductsPage({"),
    app.indexOf("function SettingsPanel({")
  );
  assert.match(installedPage, /const updateAllInstalled = async \(\) =>/);
  assert.match(installedPage, /<Button[\s\S]*?data-aihub-action="update-all-installed"/);
  assert.match(installedPage, /loading=\{updatingAll\}/);
  assert.match(installedPage, /onClick=\{\(\) => void updateAllInstalled\(\)\}/);
  assert.match(installedPage, /await runExtensionInventoryAction\(entry, "update"\)/);
  assert.match(installedPage, /await onRefresh\(\)/);
});

test("disabled batch update action stays neutral and readable", () => {
  assert.match(
    styles,
    /\.managementHeaderActions \.accentButton:disabled,\s*\.managementHeaderActions \.accentButton\[data-disabled\]\s*\{[\s\S]*?color:\s*var\(--muted\)[\s\S]*?border-color:\s*var\(--line\)[\s\S]*?background:\s*color-mix\([\s\S]*?opacity:\s*1/
  );
});

test("installed management removes redundant overlines and the shell uses one accent hue", () => {
  const installedPage = app.slice(
    app.indexOf("function InstalledProductsPage({"),
    app.indexOf("function SettingsPanel({")
  );

  assert.doesNotMatch(installedPage, /uiText\("extensions\.managementEyebrow"\)/);
  assert.doesNotMatch(installedPage, /uiText\("auto\.57e88a43ef2b"\)/);
  assert.match(styles, /--danger:\s*#[0-9a-f]{6}/i);
  assert.match(styles, /--zx-atmosphere:\s*var\(--zx-accent\)/);
  assert.match(styles, /--mint:\s*var\(--zx-accent\)/);
  assert.match(styles, /--cyan:\s*var\(--zx-accent\)/);
  assert.match(
    styles,
    /\.managementInfo > span,[\s\S]*?\.sectionHeading > span\s*\{[\s\S]*?color:\s*var\(--muted\)/
  );
  assert.doesNotMatch(
    styles,
    /#(?:6da23f|4f9c3c|70bb45|29d7b3|7465e8|756ca8|5b4b9a|b45309|d96a56|f2a65a)\b/i
  );
});
