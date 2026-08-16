'use strict';
/* eslint-disable @typescript-eslint/no-require-imports */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SOURCE = 'D:\\AIhub\\AIHUB备份';
const STAGING = 'D:\\AIhub\\github-staging\\zhenxing-ai-store-source-20260817-0199-ui-v3';
const TOOL_REL = 'tools/stage-public-source.cjs';
const MANIFEST_REL = 'SOURCE-MANIFEST.json';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ROOT_FILES = Object.freeze([
  '.dockerignore', '.openai/hosting.json',
  'build/sites-vite-plugin.ts',
  'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md',
  'drizzle.config.ts', 'eslint.config.mjs', 'next.config.ts', 'package-lock.json',
  'package.json', 'postcss.config.mjs', 'tsconfig.json', 'vite.config.ts',
]);
const ROOT_DIRS = Object.freeze(['app', 'db', 'drizzle', 'examples', 'public', 'tests', 'worker']);
const PC_FILES = Object.freeze([
  'pc-client/.dockerignore', 'pc-client/.gitattributes',
  'pc-client/admin/data/catalog-v1.json',
  'pc-client/assets/brand/zhenxing-star.png',
  'pc-client/build/icon.ico', 'pc-client/build/icon.png',
  'pc-client/CONTEXT.md', 'pc-client/README.md', 'pc-client/index.html',
  'pc-client/electron-builder.local-release.cjs', 'pc-client/package-lock.json',
  'pc-client/package.json', 'pc-client/postcss.config.mjs', 'pc-client/tsconfig.json',
  'pc-client/vite.config.ts',
]);
const PC_DIRS = Object.freeze([
  'pc-client/admin', 'pc-client/catalog', 'pc-client/community', 'pc-client/electron',
  'pc-client/extension-resources', 'pc-client/identity', 'pc-client/public',
  'pc-client/scripts', 'pc-client/shared', 'pc-client/src', 'pc-client/tests',
]);
const RESEARCH_ONLY_FILES = new Set([
  'pc-client/scripts/clawhub-public-feed-intake.mjs',
  'pc-client/scripts/generate-adadvisor-adramp-mcp-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-adeu-mcp-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-agentic-news-affiliate-hermes-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-auralogs-mcp-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-aws-agents-build-skill-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-brave-search-mcp-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-catalog-v3-resource-connections-candidate.cjs',
  'pc-client/scripts/generate-community-skill-scenario-tags-overlay-candidate.cjs',
  'pc-client/scripts/generate-deepseek-harness-product-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-desktop-edition-gap-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-official-mcp-registry-run3-final-disposition.cjs',
  'pc-client/scripts/generate-official-mcp-registry-run3-ready4-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-official-unbound-mcp-d12-d16-catalog-v3-candidate.cjs',
  'pc-client/scripts/generate-resource-store-next-major-catalog-candidate.cjs',
  'pc-client/scripts/generate-skill-scenario-classification-catalog-v3-candidate.cjs',
  'pc-client/scripts/official-mcp-registry-intake.mjs',
  'pc-client/scripts/official-mcp-registry-run3-triage.cjs',
  'pc-client/scripts/test-identity-catalog-readiness-docker.cjs',
  'pc-client/scripts/test-workflow-node-runtime-linux.cjs',
  'pc-client/scripts/test-workflow-temporary-acceptance-linux-cleanup.cjs',
  'pc-client/shared/clawhub-public-feed.cjs',
  'pc-client/shared/official-mcp-registry-final-disposition.cjs',
  'pc-client/shared/official-mcp-registry-intake.cjs',
  'pc-client/tests/adadvisor-adramp-mcp-catalog-v3-candidate.test.cjs',
  'pc-client/tests/adeu-mcp-catalog-v3-candidate.test.cjs',
  'pc-client/tests/agentic-news-affiliate-hermes-catalog-v3-candidate.test.cjs',
  'pc-client/tests/auralogs-mcp-catalog-v3-candidate.test.cjs',
  'pc-client/tests/aws-agents-build-skill-catalog-v3-candidate.test.cjs',
  'pc-client/tests/brave-search-mcp-catalog-v3-candidate.test.cjs',
  'pc-client/tests/catalog-v3-resource-connections.test.cjs',
  'pc-client/tests/catalog-active7-state-activation.test.cjs',
  'pc-client/tests/clawhub-public-feed-intake.test.cjs',
  'pc-client/tests/cocoloop-skill-metadata-phase2-stop-4069.test.cjs',
  'pc-client/tests/community-skill-scenario-tags-overlay-candidate.test.cjs',
  'pc-client/tests/community-workflow-persistence.test.cjs',
  'pc-client/tests/community-skill-store-cocoloop-next-batch-candidate.test.cjs',
  'pc-client/tests/community-skill-store-cocoloop-small-batch2-candidate.test.cjs',
  'pc-client/tests/community-skill-store-cocoloop-small-batch3-candidate.test.cjs',
  'pc-client/tests/deepseek-harness-product-catalog-v3-candidate.test.cjs',
  'pc-client/tests/desktop-edition-gap-catalog-v3-candidate.test.cjs',
  'pc-client/tests/identity-resource-submissions.test.cjs',
  'pc-client/tests/identity-source-image-closure.test.cjs',
  'pc-client/tests/local-catalog-proxy.test.cjs',
  'pc-client/tests/local-release-version.test.cjs',
  'pc-client/tests/mcp-connector-official-public-samples-active7-candidate.test.cjs',
  'pc-client/tests/mcp-connector-official-small-batch2-active7-candidate.test.cjs',
  'pc-client/tests/mcp-connector-small-batch-active7-candidate.test.cjs',
  'pc-client/tests/official-mcp-registry-intake.test.cjs',
  'pc-client/tests/official-mcp-registry-run3-final-disposition.test.cjs',
  'pc-client/tests/official-mcp-registry-run3-ready4-catalog-v3-candidate.test.cjs',
  'pc-client/tests/official-mcp-registry-run3-triage.test.cjs',
  'pc-client/tests/official-skill-seeds-active7-candidate.test.cjs',
  'pc-client/tests/official-unbound-mcp-d12-d16-catalog-v3-candidate.test.cjs',
  'pc-client/tests/resource-connection-relations-next-major-candidate.test.cjs',
  'pc-client/tests/resource-store-next-major-catalog-candidate.test.cjs',
  'pc-client/tests/resource-store-next-major-consolidation-active7.test.cjs',
  'pc-client/tests/resource-marketplace-projection.test.cjs',
  'pc-client/tests/resource-store-channel-ui.test.cjs',
  'pc-client/tests/resource-store.test.cjs',
  'pc-client/tests/skill-scenario-classification-catalog-v3-candidate.test.cjs',
  'pc-client/tests/workflow-image-archive.test.cjs',
]);
const PUBLIC_DOCS = Object.freeze([
  'pc-client/docs/account-integration-boundary.md',
  'pc-client/docs/community-options.md',
  'pc-client/docs/flarum-sso-integration.md',
  'pc-client/docs/identity-community-architecture.md',
  'pc-client/docs/language-module.md',
  'pc-client/docs/local-release-server.md',
  'pc-client/docs/product-intake-approval.md',
  'pc-client/docs/product-module-admin-model.md',
  'pc-client/docs/resource-submission-client-seam.md',
  'pc-client/docs/unified-installation-protocol.md',
  'pc-client/docs/windows-desktop-certification.md',
]);
const PUBLIC_BUILD_INPUTS = new Set([
  'build/sites-vite-plugin.ts',
  'pc-client/admin/data/catalog-v1.json',
  'pc-client/assets/brand/zhenxing-star.png',
  'pc-client/build/icon.ico',
  'pc-client/build/icon.png',
]);

const DENIED_SEGMENTS = new Set([
  '.git', '.next', '.playwright-cli', '.wrangler', 'build', 'cache', 'caches',
  'coverage', 'dist', 'node_modules', 'out', 'output', 'prototypes', 'temp', 'updates',
]);
const DENIED_EXTENSIONS = new Set([
  '.7z', '.bak', '.db', '.dll', '.dmg', '.exe', '.gz', '.iso', '.jks', '.key',
  '.msi', '.p12', '.pfx', '.pem', '.sqlite', '.sqlite3', '.tar', '.tgz', '.zip',
]);
const OPERATIONAL_NAME = /(?:production|server-connected|fresh-host|cutover|preflight|stage0|transfer-prepare|provision|release-review|candidate)/i;
const SCRIPT_TEST_OPERATIONAL = /(?:production|current-identity|server-connected|fresh-host|cutover|preflight|stage0|transfer-prepare|provision|bootstrap|deploy|publish|key-rotation|signing-key)/i;

const PRIVATE_HEADER = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
const PROD_IP = ['47', '236', '62', '189'].join('.');
const PROD_FINGERPRINT = ['SHA256:q4aNRJbw9Pday5Wfq9W1bVErTe1b4Yz6', 'nn7aM+gLDrI'].join('');
const AUTHORITY_BINDINGS = [
  ['known', 'hosts', 'aihub', 'production'].join('_'),
  ['zhenxingai', 'deploy'].join('-'),
];
const PUBLIC_README = `# 枕星AI商店

枕星AI商店，让每个人都能更轻松地发现、安装和使用值得信赖的 AI 工具。我们希望把复杂留给系统，把探索与创造还给用户，让技术真正贴近日常、陪伴成长。

此商店源码全部由 Codex 编写。

作者从 2012 年开始做开源与基础互联网教育。新时代来临时，希望做更多普世性教育；AI 的发展应该惠及每一个人，而不是高高在上。

所以我做了这款产品，希望把 AI 的使用门槛降到最低。

希望有更多志同道合的朋友加入。项目会持续开源和开放；如果你在此基础上改版或使用，也欢迎（但不强制）告诉我你的使用场景。谢谢！

## 使命

我们希望建立一个清晰、可信、对普通用户友好的 AI 工具入口，让发现、安装和日常管理不再需要理解复杂的技术细节。

## 主要能力

- 发现、安装和管理 AI 工具。
- 检测本机环境，并在用户明确确认后执行更新。
- 通过统一账号使用个人中心与社区功能。

## 仓库内容

Windows 客户端与服务器源码位于同一仓库：

- \`app/\`、\`worker/\`、\`db/\`：网站与服务器源码。
- \`pc-client/src/\`、\`pc-client/electron/\`：Windows 客户端界面与桌面能力。
- \`pc-client/shared/\`、\`pc-client/identity/\`、\`pc-client/community/\`、\`pc-client/catalog/\`、\`pc-client/admin/\`：共享业务、账号、社区、目录与管理端源码。
- \`public/\`、\`pc-client/public/\`、\`pc-client/extension-resources/\`：公开静态资源与扩展资源。
- \`tests/\`、\`pc-client/tests/\`：可公开的自动化测试。

## 本地开发

安装 Node.js 与 npm 后，在仓库根目录运行：

\`\`\`text
npm install
npm run dev
npm run build
\`\`\`

开发 Windows 客户端：

\`\`\`text
cd pc-client
npm install
npm run dev
npm run build
npm run desktop
\`\`\`

## 安全

本仓库不提交凭据、私钥、生产环境秘密或用户数据。请不要把安全漏洞提交为公开 Issue；应通过仓库所有者提供的私下安全联系方式报告，并在修复公开前保密。

## 版本

当前已完成本地验收的产品版本为 **0.1.99**。根站点 \`0.1.0\` 与 PC 客户端内部 package \`0.1.40\` 是独立开发包版本，不表示它们已经统一为产品发布版本。0.1.99 的 Windows 安装包尚未签名，不属于公开下载或自动更新发布物。

## 语言与内容边界

客户端支持中文与英文界面。目录中的厂商、产品和资源可使用经审核的英文本地化内容；缺少英文内容时保留原文。社区帖子属于用户内容，不由本仓库自动翻译，也不保证提供英文版本。

## 开源许可证

除另有说明外，本仓库中由项目方原创的软件源代码采用 Apache License 2.0 开源。

详见 [LICENSE](./LICENSE)、[NOTICE](./NOTICE) 和 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

第三方依赖、厂商商标与图标、目录元数据、社区内容及另附许可证的扩展资源，不因本许可证而重新授权，分别遵循其原始许可证或条款。
`;
const PUBLIC_GITIGNORE = `# Dependencies and generated output
node_modules/
**/node_modules/
.next/
**/.next/
dist/
**/dist/
build/
**/build/
!pc-client/build/
pc-client/build/*
!pc-client/build/icon.ico
!pc-client/build/icon.png
out/
**/out/
output/
outputs/
**/output/
**/outputs/
release-review*/
**/release-review*/
release-local*/
**/release-local*/

# Caches, temporary files, and logs
.cache/
.wrangler/
cache/
caches/
**/.cache/
**/cache/
**/caches/
temp/
Temp/
tmp/
**/temp/
**/Temp/
**/tmp/
*.log
logs/
**/logs/
*.tsbuildinfo
next-env.d.ts

# Local state, databases, volumes, and backups
.remote-state.json
*.db
*.db-*
*.sqlite
*.sqlite3
**/volumes/
**/backups/
**/private/
pc-client/admin/data/
pc-client/admin/published/

# Credentials and environment files
.env
.env.*
**/.env
**/.env.*
*.pem
*.key
*.p12
*.pfx
*.jks
*.jwk
credentials/
**/credentials/
secrets/
**/secrets/

# Production deployment and provisioning are not part of this public snapshot
deployment/
pc-client/deployment/

# Archives and compiled binaries
*.7z
*.bak
*.dll
*.dmg
*.exe
*.gz
*.iso
*.msi
*.tar
*.tgz
*.zip

# Existing reviewed public example
!pc-client/catalog/catalog-v1.example.json
`;

function slash(value) { return value.replaceAll('\\', '/'); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function fail(message) { throw new Error(message); }

function normalizeRel(value) {
  const rel = slash(value).replace(/^\.\//, '');
  if (!rel || path.posix.isAbsolute(rel) || rel.split('/').some((part) => !part || part === '.' || part === '..')) {
    fail('invalid relative path');
  }
  return rel;
}

function denyReason(value) {
  const rel = normalizeRel(value);
  const lower = rel.toLowerCase();
  const parts = lower.split('/');
  const base = parts.at(-1);
  const ext = path.posix.extname(lower);
  if (PUBLIC_BUILD_INPUTS.has(lower)) return null;
  if (RESEARCH_ONLY_FILES.has(lower)) return 'internal-research-dependent-tooling';
  if (DENIED_SEGMENTS.has(base) || parts.some((part) => DENIED_SEGMENTS.has(part))) return 'generated-or-cache';
  if (parts.some((part) => part.startsWith('release-review-'))) return 'release-review';
  if (DENIED_EXTENSIONS.has(ext) || base === '.env' || base.startsWith('.env.')) return 'credential-binary-or-database';
  if (lower === '.remote-state.json' || lower === 'agents.md') return 'private-or-governance';
  if (lower.startsWith('deployment/') || lower.startsWith('pc-client/deployment/')) return 'production-deployment';
  if (lower.startsWith('pc-client/admin/data/') || lower.startsWith('pc-client/admin/published/')) return 'private-admin-store';
  if (lower.startsWith('docs/') || lower.startsWith('pc-client/docs/incident-feedback/') ||
      lower.startsWith('pc-client/docs/research/') || lower.startsWith('pc-client/docs/audit/') ||
      lower.startsWith('pc-client/docs/audits/') || lower.startsWith('pc-client/docs/acceptance/')) return 'internal-governance-or-evidence';
  if (lower === 'pc-client/docs/cto-operating-manual.md' || lower === 'pc-client/docs/team-ownership-and-coordination.md' ||
      lower === 'pc-client/docs/development-status.md' || lower === 'pc-client/docs/future-development-roadmap.md' ||
      lower === 'pc-client/electron-builder.server-connected-review.cjs') return 'internal-governance-or-release';
  if ((lower.startsWith('pc-client/scripts/') || lower.startsWith('pc-client/tests/')) && SCRIPT_TEST_OPERATIONAL.test(base)) return 'operational-tooling-or-test';
  if ((lower.startsWith('pc-client/community/') || lower.startsWith('pc-client/identity/')) && /(?:production|provision|bootstrap)/i.test(base)) return 'production-provisioning';
  if (OPERATIONAL_NAME.test(base) && (lower.startsWith('pc-client/catalog/') || lower.startsWith('pc-client/community/'))) return 'candidate-or-production-data';
  return null;
}

function contentFindings(rel, bytes) {
  if (bytes.includes(0)) return [];
  const text = bytes.toString('utf8');
  const findings = [];
  const secretRules = [
    ['private-key', PRIVATE_HEADER],
    ['openai-token', /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ['github-token', /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/],
    ['aws-key', /\bAKIA[0-9A-Z]{16}\b/],
    ['credential-url', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@/i],
    ['private-jwk', /["']d["']\s*:\s*["'][A-Za-z0-9_-]{20,}["']/],
    ['literal-secret', /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|private[_-]?key)\b\s*[:=]\s*["'][A-Za-z0-9+/_=-]{16,}["']/i],
  ];
  for (const [name, rule] of secretRules) {
    const hit = typeof rule === 'string' ? text.includes(rule) : rule.test(text);
    if (hit) findings.push(`secret:${name}`);
  }
  const operationalRules = [
    ['production-ip', PROD_IP],
    ['host-fingerprint', PROD_FINGERPRINT],
    ['local-user-path', /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/i],
    ['authority-binding', (value) => AUTHORITY_BINDINGS.some((binding) => value.toLowerCase().includes(binding))],
    ['production-private-root', /\/opt\/zhenxing-ai\/(?:staging|releases|shared\/(?:backups|control|evidence|secrets))/i],
  ];
  for (const [name, rule] of operationalRules) {
    const hit = typeof rule === 'string' ? text.includes(rule) : typeof rule === 'function' ? rule(text) : rule.test(text);
    if (hit) findings.push(`operational:${name}`);
  }
  return findings;
}

function gitSet(args) {
  const output = execFileSync('git', args, { cwd: SOURCE, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  return new Set(output.toString('utf8').split('\0').filter(Boolean).map(slash));
}

function sourceStates() {
  return {
    tracked: gitSet(['ls-files', '-z']),
    modified: gitSet(['diff', '--name-only', '-z', 'HEAD', '--']),
    untracked: gitSet(['ls-files', '--others', '--exclude-standard', '-z']),
    ignored: gitSet(['ls-files', '--others', '-i', '--exclude-standard', '-z']),
  };
}

function stateFor(rel, states) {
  if (states.modified.has(rel)) return 'tracked-modified';
  if (states.tracked.has(rel)) return 'tracked-clean';
  if (states.untracked.has(rel)) return 'untracked';
  if (states.ignored.has(rel)) return 'ignored';
  return 'untracked';
}

function assertSafeSourceFile(rel, counters) {
  const safeRel = normalizeRel(rel);
  const denied = denyReason(safeRel);
  if (denied) fail(`denied source selected: ${safeRel}`);
  const absolute = path.join(SOURCE, ...safeRel.split('/'));
  counters.sourceMetadataReads += 1;
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & fs.constants.S_IFMT) !== fs.constants.S_IFREG || stat.nlink !== 1) {
    fail(`unsafe source file: ${safeRel}`);
  }
  const canonical = fs.realpathSync.native(absolute);
  if (canonical !== path.resolve(absolute)) fail(`non-canonical source file: ${safeRel}`);
  if (stat.size > MAX_FILE_BYTES) fail(`source file too large: ${safeRel}`);
  return { absolute, stat };
}

function collectDirectory(relDir, selected, exclusions, counters) {
  const safeDir = normalizeRel(relDir);
  const denied = denyReason(safeDir);
  if (denied) fail(`denied source directory selected: ${safeDir}`);
  const absolute = path.join(SOURCE, ...safeDir.split('/'));
  counters.sourceMetadataReads += 1;
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync.native(absolute) !== path.resolve(absolute)) {
    fail(`unsafe source directory: ${safeDir}`);
  }
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const rel = `${safeDir}/${entry.name}`;
    const reason = denyReason(rel);
    if (reason) { exclusions.push({ path: rel, reason }); continue; }
    if (entry.isSymbolicLink()) { exclusions.push({ path: rel, reason: 'reparse' }); continue; }
    if (entry.isDirectory()) collectDirectory(rel, selected, exclusions, counters);
    else if (entry.isFile()) selected.add(rel);
    else exclusions.push({ path: rel, reason: 'non-regular' });
  }
}

function copySelected(selected, exclusions, counters, states) {
  const entries = [];
  for (const rel of [...selected].sort((a, b) => a.localeCompare(b, 'en'))) {
    const sourceState = stateFor(rel, states);
    if (sourceState === 'ignored') {
      exclusions.push({ path: rel, reason: 'git-ignored-source' });
      continue;
    }
    const { absolute, stat } = assertSafeSourceFile(rel, counters);
    counters.sourceContentReads += 1;
    const bytes = fs.readFileSync(absolute);
    const findings = contentFindings(rel, bytes);
    if (findings.length) {
      exclusions.push({ path: rel, reason: findings.join(',') });
      continue;
    }
    const target = path.join(STAGING, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(absolute, target, fs.constants.COPYFILE_EXCL);
    const copied = fs.readFileSync(target);
    if (copied.length !== stat.size || !copied.equals(bytes)) fail(`copy mismatch: ${rel}`);
    entries.push({ path: rel, bytes: bytes.length, sha256: sha256(bytes), sourceState });
  }
  return entries;
}

function writeGeneratedMetadata(rel, content) {
  const safeRel = normalizeRel(rel);
  const bytes = Buffer.from(content, 'utf8');
  if (contentFindings(safeRel, bytes).length) fail(`generated metadata failed safety scan: ${safeRel}`);
  const target = path.join(STAGING, ...safeRel.split('/'));
  fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o644 });
  return { path: safeRel, bytes: bytes.length, sha256: sha256(bytes), sourceState: 'generated-release-metadata' };
}

function inspectStaging(expectedPaths) {
  const actual = [];
  let reparseCount = 0;
  const walk = (absolute, relDir = '') => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink() || stat.attributes & fs.constants.UV_FS_O_FILEMAP) reparseCount += 1;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const child = path.join(absolute, entry.name);
      const childStat = fs.lstatSync(child);
      if (entry.isSymbolicLink() || (childStat.isFile() && childStat.nlink !== 1)) reparseCount += 1;
      if (entry.isDirectory()) walk(child, rel);
      else if (entry.isFile()) actual.push(rel);
      else reparseCount += 1;
    }
  };
  walk(STAGING);
  actual.sort((a, b) => a.localeCompare(b, 'en'));
  const expected = [...expectedPaths].sort((a, b) => a.localeCompare(b, 'en'));
  return { actual, reparseCount, unknownCount: actual.filter((item) => !expected.includes(item)).length,
    missingCount: expected.filter((item) => !actual.includes(item)).length };
}

function scanStaging(files) {
  const findings = [];
  for (const rel of files) {
    const bytes = fs.readFileSync(path.join(STAGING, ...rel.split('/')));
    for (const finding of contentFindings(rel, bytes)) findings.push({ path: rel, finding });
  }
  return findings;
}

function selfTest() {
  assert.equal(denyReason('pc-client/admin/data/catalog-signing-private.pem'), 'credential-binary-or-database');
  assert.equal(denyReason('pc-client/admin/data/catalog-v1.json'), null);
  assert.equal(denyReason('build/sites-vite-plugin.ts'), null);
  assert.equal(denyReason('pc-client/assets/brand/zhenxing-star.png'), null);
  assert.equal(denyReason('pc-client/build/icon.ico'), null);
  assert.equal(denyReason('pc-client/build/icon.png'), null);
  assert.equal(denyReason('pc-client/deployment/local/private/update/catalog-signing-private.pem'), 'credential-binary-or-database');
  assert.equal(denyReason('pc-client/src/App.tsx'), null);
  assert.equal(denyReason('pc-client/tests/auralogs-mcp-catalog-v3-candidate.test.cjs'), 'internal-research-dependent-tooling');
  assert.equal(denyReason('pc-client/scripts/generate-desktop-edition-gap-catalog-v3-candidate.cjs'), 'internal-research-dependent-tooling');
  assert.equal(denyReason('pc-client/tests/skill-scenario-classification-catalog-v3-candidate.test.cjs'), 'internal-research-dependent-tooling');
  assert.equal(denyReason('pc-client/tests/workflow-image-archive.test.cjs'), 'internal-research-dependent-tooling');
  assert.equal(denyReason('pc-client/scripts/workflow-current-identity-temporary-acceptance.cjs'), 'operational-tooling-or-test');
  assert.equal(denyReason('pc-client/tests/workflow-current-identity-release-bundle.test.cjs'), 'operational-tooling-or-test');
  assert.equal(denyReason('pc-client/shared/cocoloop-skill-metadata-parser.cjs'), null);
  assert.deepEqual(contentFindings('safe.js', Buffer.from('const value = "public";')), []);
  assert(contentFindings('bad.js', Buffer.from(PRIVATE_HEADER)).includes('secret:private-key'));
  assert(contentFindings('bad.js', Buffer.from(PROD_IP)).includes('operational:production-ip'));
  assert.throws(() => normalizeRel('../secret'));
  assert(PUBLIC_README.startsWith('# 枕星AI商店\n\n枕星AI商店，让每个人都能更轻松地发现、安装和使用值得信赖的 AI 工具。'));
  assert(PUBLIC_GITIGNORE.includes('pc-client/admin/published/'));
  assert(PUBLIC_GITIGNORE.includes('!pc-client/build/icon.ico'));
  assert(PUBLIC_GITIGNORE.includes('!pc-client/build/icon.png'));
  assert(PUBLIC_GITIGNORE.includes('.wrangler/'));
  process.stdout.write(JSON.stringify({ status: 'pass', selfTest: true }) + '\n');
}

function main() {
  if (process.argv.length !== 2) fail('arguments are not accepted');
  const sourceCanonical = fs.realpathSync.native(SOURCE);
  const stageCanonicalParent = fs.realpathSync.native(path.dirname(STAGING));
  if (path.resolve(sourceCanonical) === path.resolve(STAGING) || path.resolve(STAGING).startsWith(`${path.resolve(sourceCanonical)}${path.sep}`)) {
    fail('staging must be outside source');
  }
  if (stageCanonicalParent !== path.resolve(path.dirname(STAGING))) fail('staging parent is not canonical');
  const existing = fs.readdirSync(STAGING).sort();
  if (existing.join('\0') !== 'tools') fail('staging must initially contain only tools');
  const toolStat = fs.lstatSync(path.join(STAGING, ...TOOL_REL.split('/')));
  if (!toolStat.isFile() || toolStat.isSymbolicLink() || toolStat.nlink !== 1) fail('unsafe staging tool');

  const counters = { protectedReadAttempts: 0, sourceMetadataReads: 0, sourceContentReads: 0 };
  const selected = new Set();
  const exclusions = [];
  for (const rel of [...ROOT_FILES, ...PC_FILES, ...PUBLIC_DOCS]) {
    if (!fs.existsSync(path.join(SOURCE, ...rel.split('/')))) fail(`missing allowlisted file: ${rel}`);
    selected.add(rel);
  }
  for (const dir of [...ROOT_DIRS, ...PC_DIRS]) collectDirectory(dir, selected, exclusions, counters);
  const states = sourceStates();
  const files = copySelected(selected, exclusions, counters, states);
  files.push(writeGeneratedMetadata('README.md', PUBLIC_README));
  files.push(writeGeneratedMetadata('.gitignore', PUBLIC_GITIGNORE));
  const toolBytes = fs.readFileSync(path.join(STAGING, ...TOOL_REL.split('/')));
  files.push({ path: TOOL_REL, bytes: toolBytes.length, sha256: sha256(toolBytes), sourceState: 'staging-tool' });
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));

  const exclusionSummary = Object.entries(exclusions.reduce((map, item) => {
    map[item.reason] = (map[item.reason] || 0) + 1; return map;
  }, {})).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([reason, count]) => ({ reason, count }));
  const manifest = {
    schemaVersion: 1,
    status: 'pass',
    sourceRootKind: 'dirty-working-tree-snapshot',
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: SOURCE, encoding: 'utf8' }).trim(),
    stagingPurpose: 'public-source-snapshot-candidate-only',
    files,
    totals: { files: files.length, bytes: files.reduce((sum, item) => sum + item.bytes, 0) },
    safety: { unknown: 0, secretFindings: 0, reparse: 0, protectedReads: counters.protectedReadAttempts },
    exclusions: exclusionSummary,
    notes: ['SOURCE-MANIFEST.json is the detached manifest and is not self-listed.'],
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(STAGING, MANIFEST_REL), manifestBytes, { flag: 'wx', mode: 0o600 });

  const expected = new Set([...files.map((item) => item.path), MANIFEST_REL]);
  const closure = inspectStaging(expected);
  const secretFindings = scanStaging(closure.actual);
  const finalStatus = closure.unknownCount === 0 && closure.missingCount === 0 && closure.reparseCount === 0 &&
    counters.protectedReadAttempts === 0 && secretFindings.length === 0 ? 'pass' : 'blocked';
  process.stdout.write(`${JSON.stringify({
    status: finalStatus,
    staging: STAGING,
    sourceHead: manifest.sourceHead,
    files: files.length,
    bytes: manifest.totals.bytes,
    manifestBytes: manifestBytes.length,
    manifestSha256: sha256(manifestBytes),
    topLevel: [...new Set(closure.actual.map((item) => item.split('/')[0]))].sort(),
    exclusionSummary,
    unknown: closure.unknownCount,
    missing: closure.missingCount,
    reparse: closure.reparseCount,
    protectedReads: counters.protectedReadAttempts,
    secretFindings: secretFindings.length,
  })}\n`);
  if (finalStatus !== 'pass') process.exitCode = 1;
}

if (process.argv[2] === '--self-test' && process.argv.length === 3) selfTest();
else main();
