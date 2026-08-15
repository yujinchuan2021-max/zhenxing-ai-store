"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED_ROOT = String.raw`D:\AIhub\AIHUB备份\pc-client`;
const CREDENTIAL_ROOT = path.join(ROOT, "output", "protected-login-credentials");
const SSH = String.raw`C:\Windows\System32\OpenSSH\ssh.exe`;
const SSH_KEY = String.raw`C:\Users\yujin\.ssh\zhenxingai_deploy_ed25519`;
const KNOWN_HOSTS = String.raw`C:\Users\yujin\.ssh\known_hosts_aihub_production`;
const SSH_TARGET = "admin@47.236.62.189";
const IDENTITY_CONTAINER = "zhenxing-community-production-identity-1";
const IDENTITY_ORIGIN = "https://zhenxingai.com";
const EMAIL = "aihub-login-test@users.invalid";
const USERNAME = "aihub_login_test";
const DISPLAY_NAME = "振兴AI测试用户";
const EXPECTED_SECURITY_SHA256 =
  "21da15c2a5cc5a8cd8e06817ca3ba96239a7e2f1816e3f6173deaa954505be92";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assertAuthoritativeWorkspace() {
  const actual = fs.realpathSync.native(ROOT);
  if (actual.toLocaleLowerCase("en-US") !== EXPECTED_ROOT.toLocaleLowerCase("en-US")) {
    fail("AUTHORITATIVE_WORKSPACE_MISMATCH");
  }
  const securityFile = path.join(ROOT, "shared", "identity-security.cjs");
  if (sha256(fs.readFileSync(securityFile)) !== EXPECTED_SECURITY_SHA256) {
    fail("LOCAL_IDENTITY_SECURITY_DRIFT");
  }
  const security = require(securityFile);
  if (security.normalizeEmail(EMAIL) !== EMAIL) fail("ACCOUNT_EMAIL_INVALID");
  if (security.normalizeUsername(USERNAME).normalized !== USERNAME) {
    fail("ACCOUNT_USERNAME_INVALID");
  }
}

function currentWindowsIdentity() {
  const result = spawnSync("whoami.exe", [], { encoding: "utf8", windowsHide: true });
  const identity = String(result.stdout || "").trim();
  if (result.status !== 0 || !identity || /[\r\n]/.test(identity)) {
    fail("WINDOWS_IDENTITY_UNAVAILABLE");
  }
  return identity;
}

function setPrivateAcl(target, identity, container) {
  const permission = container ? `(OI)(CI)F` : "F";
  const result = spawnSync(
    "icacls.exe",
    [target, "/inheritance:r", "/grant:r", `${identity}:${permission}`],
    { encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) fail("CREDENTIAL_ACL_WRITE_FAILED");
}

function inspectPrivatePath(target, identity, expectDirectory) {
  const quotedTarget = target.replaceAll("'", "''");
  const ps = String.raw`
$ErrorActionPreference='Stop'
$target='${quotedTarget}'
$item=Get-Item -LiteralPath $target -Force
$acl=Get-Acl -LiteralPath $target
$rules=@($acl.Access | ForEach-Object {
  [pscustomobject]@{ identity=$_.IdentityReference.Value; type=$_.AccessControlType.ToString(); inherited=$_.IsInherited }
})
[pscustomobject]@{
  directory=$item.PSIsContainer
  reparse=[bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
  rules=$rules
} | ConvertTo-Json -Compress -Depth 4
`;
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", ps],
    { encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) fail("CREDENTIAL_ACL_READ_FAILED");
  let value;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    fail("CREDENTIAL_ACL_READ_FAILED");
  }
  const rules = Array.isArray(value.rules) ? value.rules : value.rules ? [value.rules] : [];
  const allowed = rules.filter((rule) => rule.type === "Allow");
  if (
    Boolean(value.directory) !== expectDirectory ||
    value.reparse !== false ||
    allowed.length !== 1 ||
    allowed[0].identity.toLocaleLowerCase("en-US") !== identity.toLocaleLowerCase("en-US") ||
    allowed[0].inherited !== false ||
    rules.some((rule) => rule.identity.toLocaleLowerCase("en-US") !== identity.toLocaleLowerCase("en-US"))
  ) {
    fail("CREDENTIAL_ACL_NOT_PRIVATE");
  }
  return true;
}

function createCredentialFile(password) {
  fs.mkdirSync(CREDENTIAL_ROOT, { recursive: true });
  const rootStat = fs.lstatSync(CREDENTIAL_ROOT);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("CREDENTIAL_ROOT_UNSAFE");
  const identity = currentWindowsIdentity();
  setPrivateAcl(CREDENTIAL_ROOT, identity, true);
  inspectPrivatePath(CREDENTIAL_ROOT, identity, true);

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const directory = path.join(CREDENTIAL_ROOT, `production-login-${stamp}-${crypto.randomBytes(4).toString("hex")}`);
  fs.mkdirSync(directory, { recursive: false });
  setPrivateAcl(directory, identity, true);
  inspectPrivatePath(directory, identity, true);

  const file = path.join(directory, "credentials.json");
  const document = `${JSON.stringify(
    {
      service: "AI Hub Identity production",
      origin: IDENTITY_ORIGIN,
      identifier: EMAIL,
      username: USERNAME,
      displayName: DISPLAY_NAME,
      temporaryPassword: password,
      forceChangeSupported: false,
      createdAt: new Date().toISOString()
    },
    null,
    2
  )}\n`;
  fs.writeFileSync(file, document, { encoding: "utf8", flag: "wx" });
  setPrivateAcl(file, identity, false);
  inspectPrivatePath(file, identity, false);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    fail("CREDENTIAL_FILE_UNSAFE");
  }
  return {
    directory,
    file,
    bytes: stat.size,
    sha256: sha256(fs.readFileSync(file)),
    aclPrivate: true,
    regular: true,
    nonReparse: true,
    linkCountOne: true
  };
}

function removeCredentialFile(metadata) {
  if (!metadata) return;
  const resolvedRoot = fs.realpathSync.native(CREDENTIAL_ROOT);
  const resolvedDirectory = fs.realpathSync.native(metadata.directory);
  if (!resolvedDirectory.startsWith(`${resolvedRoot}${path.sep}`)) {
    fail("CREDENTIAL_CLEANUP_SCOPE_INVALID");
  }
  fs.unlinkSync(metadata.file);
  fs.rmdirSync(metadata.directory);
}

function randomPassword() {
  for (;;) {
    const value = crypto.randomBytes(24).toString("base64url");
    if (value.length >= 24 && /[A-Za-z]/.test(value) && /\d/.test(value)) return value;
  }
}

function remoteProgram({ mode, userId, password }) {
  const input = JSON.stringify({ mode, userId, email: EMAIL, username: USERNAME, nickname: DISPLAY_NAME, password });
  return `"use strict";
const crypto=require("node:crypto"),fs=require("node:fs"),{Pool}=require("pg");
const input=${input};
const securityPath="/app/shared/identity-security.cjs";
const expectedSecurity=${JSON.stringify(EXPECTED_SECURITY_SHA256)};
const hash=crypto.createHash("sha256").update(fs.readFileSync(securityPath)).digest("hex");
if(hash!==expectedSecurity){process.stdout.write(JSON.stringify({ok:false,code:"IDENTITY_SECURITY_DRIFT"})+"\\n");process.exit(20)}
const {hashPassword,normalizeEmail,normalizeUsername,verifyPassword}=require(securityPath);
const output=(value,code=0)=>{process.stdout.write(JSON.stringify(value)+"\\n");process.exitCode=code};
const reject=(code)=>{const error=new Error(code);error.safeCode=code;throw error};
const expectedUserColumns=["id:uuid:NO","email:text:YES","normalized_email:text:YES","phone:text:YES","normalized_phone:text:YES","username:text:NO","normalized_username:text:NO","community_username:text:NO","password_hash:text:YES","status:text:NO","created_at:timestamp with time zone:NO","updated_at:timestamp with time zone:NO","identity_kind:text:NO"];
const expectedProfileColumns=["user_id:uuid:NO","nickname:text:NO","avatar_url:text:YES","bio:text:NO","created_at:timestamp with time zone:NO","updated_at:timestamp with time zone:NO"];
const readColumns=async(client,table)=>(await client.query("SELECT column_name||':'||data_type||':'||is_nullable AS value FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[table])).rows.map(row=>row.value);
const passwordFile="/run/secrets/identity_db_password";
const dbPassword=fs.readFileSync(passwordFile,"utf8").trim();
if(dbPassword.length<32||dbPassword.length>512||/[\\r\\n]/.test(dbPassword)) reject("DATABASE_SECRET_INVALID");
const pool=new Pool({host:"identity-database",port:5432,database:"aihub",user:"aihub",password:dbPassword,max:1,application_name:"aihub-one-time-user-provision"});
(async()=>{
  const client=await pool.connect();
  try{
    const target=await client.query("SELECT current_database() AS database,current_user AS username");
    if(target.rows[0]?.database!=="aihub"||target.rows[0]?.username!=="aihub") reject("DATABASE_TARGET_MISMATCH");
    if(JSON.stringify(await readColumns(client,"users"))!==JSON.stringify(expectedUserColumns)) reject("USERS_SCHEMA_MISMATCH");
    if(JSON.stringify(await readColumns(client,"community_profiles"))!==JSON.stringify(expectedProfileColumns)) reject("PROFILE_SCHEMA_MISMATCH");
    const contract=await client.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname='users_identity_kind_contract'");
    if(contract.rowCount!==1||!contract.rows[0].definition.includes("identity_kind = 'person'")) reject("IDENTITY_KIND_CONTRACT_MISMATCH");
    if(normalizeEmail(input.email)!==input.email||normalizeUsername(input.username).normalized!==input.username) reject("IDENTIFIER_CONTRACT_MISMATCH");
    if(input.mode==="provision"){
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SET LOCAL lock_timeout='3s'");
      await client.query("SET LOCAL statement_timeout='8s'");
      await client.query("LOCK TABLE public.users IN EXCLUSIVE MODE");
      const counts=await client.query("SELECT (SELECT count(*)::int FROM public.users WHERE identity_kind='person') AS persons,(SELECT count(*)::int FROM public.users WHERE normalized_email=$1 OR normalized_username=$2) AS conflicts",[input.email,input.username]);
      if(counts.rows[0].persons!==0) reject("ORDINARY_ACCOUNT_ALREADY_EXISTS");
      if(counts.rows[0].conflicts!==0) reject("ACCOUNT_IDENTIFIER_CONFLICT");
      const passwordHash=hashPassword(input.password);
      if(!verifyPassword(input.password,passwordHash)) reject("PASSWORD_HASH_CONTRACT_FAILED");
      const communityUsername="zx_"+input.userId.replaceAll("-","").toLowerCase().slice(0,27);
      await client.query("INSERT INTO public.users (id,email,normalized_email,phone,normalized_phone,username,normalized_username,community_username,password_hash,status,identity_kind) VALUES ($1,$2,$2,NULL,NULL,$3,$3,$4,$5,'active','person')",[input.userId,input.email,input.username,communityUsername,passwordHash]);
      await client.query("INSERT INTO public.community_profiles (user_id,nickname,avatar_url,bio) VALUES ($1,$2,NULL,'')",[input.userId,input.nickname]);
      const exact=await client.query("SELECT count(*)::int AS count,bool_and(status='active' AND identity_kind='person' AND email=$2 AND normalized_email=$2 AND username=$3 AND normalized_username=$3 AND phone IS NULL AND normalized_phone IS NULL) AS exact,array_agg(password_hash) AS hashes FROM public.users WHERE id=$1",[input.userId,input.email,input.username]);
      if(exact.rows[0].count!==1||exact.rows[0].exact!==true||exact.rows[0].hashes.length!==1||!verifyPassword(input.password,exact.rows[0].hashes[0])) reject("ACCOUNT_INSERT_VERIFY_FAILED");
      const profile=await client.query("SELECT count(*)::int AS count,bool_and(nickname=$2 AND avatar_url IS NULL AND bio='') AS exact FROM public.community_profiles WHERE user_id=$1",[input.userId,input.nickname]);
      if(profile.rows[0].count!==1||profile.rows[0].exact!==true) reject("PROFILE_INSERT_VERIFY_FAILED");
      const relations=await client.query("SELECT (SELECT count(*)::int FROM public.devices WHERE user_id=$1) AS devices,(SELECT count(*)::int FROM public.sessions WHERE user_id=$1) AS sessions,(SELECT count(*)::int FROM public.community_handoffs WHERE user_id=$1) AS handoffs,(SELECT count(*)::int FROM public.profile_avatars WHERE user_id=$1) AS avatars,(SELECT count(*)::int FROM public.email_change_challenges WHERE user_id=$1) AS email_changes",[input.userId]);
      if(Object.values(relations.rows[0]).some(value=>value!==0)) reject("UNEXPECTED_BROWSER_RELATION");
      await client.query("COMMIT");
      output({ok:true,code:"ACCOUNT_CREATED"});
      return;
    }
    if(input.mode==="final"){
      const result=await client.query("SELECT (SELECT count(*)::int FROM public.users WHERE id=$1 AND identity_kind='person' AND status='active' AND normalized_email=$2 AND normalized_username=$3) AS account,(SELECT count(*)::int FROM public.community_profiles WHERE user_id=$1 AND nickname=$4) AS profile,(SELECT count(*)::int FROM public.sessions WHERE user_id=$1 AND revoked_at IS NULL AND refresh_expires_at>now()) AS active_sessions,(SELECT count(*)::int FROM public.community_handoffs WHERE user_id=$1 AND consumed_at IS NULL AND expires_at>now()) AS active_handoffs,(SELECT count(*)::int FROM public.users WHERE identity_kind='person') AS ordinary_users",[input.userId,input.email,input.username,input.nickname]);
      const row=result.rows[0];
      if(row.account!==1||row.profile!==1||row.active_sessions!==0||row.active_handoffs!==0||row.ordinary_users!==1) reject("FINAL_ACCOUNT_STATE_INVALID");
      output({ok:true,code:"FINAL_STATE_VERIFIED",ordinaryUsers:1,activeSessions:0,activeHandoffs:0});
      return;
    }
    if(input.mode==="compensate"){
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SET LOCAL lock_timeout='3s'");
      await client.query("SET LOCAL statement_timeout='8s'");
      const row=await client.query("SELECT id,email,normalized_email,username,normalized_username,password_hash,status,identity_kind FROM public.users WHERE id=$1 FOR UPDATE",[input.userId]);
      if(row.rowCount===0){await client.query("ROLLBACK");output({ok:true,code:"ACCOUNT_ABSENT"});return}
      const user=row.rows[0];
      if(user.email!==input.email||user.normalized_email!==input.email||user.username!==input.username||user.normalized_username!==input.username||user.status!=="active"||user.identity_kind!=="person"||!verifyPassword(input.password,user.password_hash)) reject("COMPENSATION_IDENTITY_MISMATCH");
      await client.query("DELETE FROM public.users WHERE id=$1",[input.userId]);
      await client.query("COMMIT");
      output({ok:true,code:"ACCOUNT_COMPENSATED"});
      return;
    }
    reject("INVALID_MODE");
  }catch(error){await client.query("ROLLBACK").catch(()=>{});output({ok:false,code:error.safeCode||"PROVISION_FAILED"},1)}finally{client.release()}
})().catch(()=>output({ok:false,code:"PROVISION_FAILED"},1)).finally(()=>pool.end());
`;
}

function runRemote(input) {
  const result = spawnSync(
    SSH,
    [
      "-F", "NUL",
      "-o", "BatchMode=yes",
      "-o", "IdentitiesOnly=yes",
      "-o", "StrictHostKeyChecking=yes",
      "-o", `UserKnownHostsFile=${KNOWN_HOSTS}`,
      "-i", SSH_KEY,
      SSH_TARGET,
      `sudo -n docker exec -i ${IDENTITY_CONTAINER} node -`
    ],
    { input: remoteProgram(input), encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 }
  );
  const lines = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  let value;
  try {
    value = JSON.parse(lines.at(-1) || "{}");
  } catch {
    fail("REMOTE_RESULT_INVALID");
  }
  if (result.status !== 0 || value.ok !== true) fail(value.code || "REMOTE_EXECUTION_FAILED");
  return value;
}

function requestJson(pathname, { method = "GET", body, accessToken } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const request = https.request(
      new URL(pathname, IDENTITY_ORIGIN),
      {
        method,
        headers: {
          accept: "application/json",
          ...(payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {}),
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
        },
        timeout: 10000
      },
      (response) => {
        const chunks = [];
        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > 128 * 1024) request.destroy();
          else chunks.push(chunk);
        });
        response.on("end", () => {
          let value = null;
          try {
            value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch {}
          resolve({ status: response.statusCode, value });
        });
      }
    );
    request.on("timeout", () => request.destroy());
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function verifyLoginAndLogout({ userId, password }) {
  const deviceId = crypto.randomUUID();
  const login = await requestJson("/v1/sessions/login", {
    method: "POST",
    body: { identifier: EMAIL, password, deviceId, deviceName: "AI Hub credential verification" }
  });
  if (
    login.status !== 200 ||
    login.value?.user?.id !== userId ||
    login.value?.user?.email !== EMAIL ||
    login.value?.user?.username !== USERNAME ||
    login.value?.user?.profile?.nickname !== DISPLAY_NAME ||
    typeof login.value?.accessToken !== "string" ||
    typeof login.value?.refreshToken !== "string" ||
    typeof login.value?.sessionId !== "string"
  ) {
    fail("HTTPS_LOGIN_VERIFY_FAILED");
  }
  let accessToken = login.value.accessToken;
  login.value.refreshToken = null;
  const logout = await requestJson("/v1/sessions/logout", { method: "POST", accessToken });
  if (logout.status !== 200 || logout.value?.ok !== true) fail("HTTPS_LOGOUT_FAILED");
  const after = await requestJson("/v1/me", { accessToken });
  accessToken = null;
  login.value.accessToken = null;
  if (after.status !== 401) fail("LOGGED_OUT_TOKEN_STILL_ACTIVE");
  return true;
}

function selfTest() {
  assertAuthoritativeWorkspace();
  const password = randomPassword();
  if (password.length < 24 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    fail("PASSWORD_GENERATOR_FAILED");
  }
  const identity = currentWindowsIdentity();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aihub-credential-acl-"));
  const file = path.join(directory, "probe.txt");
  try {
    setPrivateAcl(directory, identity, true);
    inspectPrivatePath(directory, identity, true);
    fs.writeFileSync(file, "acl-probe", { flag: "wx" });
    setPrivateAcl(file, identity, false);
    inspectPrivatePath(file, identity, false);
    if (fs.lstatSync(file).nlink !== 1) fail("CREDENTIAL_LINK_COUNT_INVALID");
  } finally {
    if (fs.existsSync(file)) fs.rmSync(file);
    if (fs.existsSync(directory)) fs.rmdirSync(directory);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, selfTest: true })}\n`);
}

async function execute() {
  assertAuthoritativeWorkspace();
  const password = randomPassword();
  const userId = crypto.randomUUID();
  let credentials;
  let created = false;
  try {
    credentials = createCredentialFile(password);
    runRemote({ mode: "provision", userId, password });
    created = true;
    await verifyLoginAndLogout({ userId, password });
    const final = runRemote({ mode: "final", userId, password });
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        identifier: EMAIL,
        displayName: DISPLAY_NAME,
        ordinary: true,
        nonAdmin: true,
        forceChangeSupported: false,
        credentials: {
          path: credentials.file,
          bytes: credentials.bytes,
          sha256: credentials.sha256,
          aclPrivate: credentials.aclPrivate,
          regular: credentials.regular,
          nonReparse: credentials.nonReparse,
          linkCountOne: credentials.linkCountOne
        },
        loginVerified: true,
        logoutVerified: true,
        activeSessions: final.activeSessions,
        activeHandoffs: final.activeHandoffs,
        ordinaryUsers: final.ordinaryUsers
      })}\n`
    );
  } catch (error) {
    let compensated = !created;
    if (created) {
      try {
        runRemote({ mode: "compensate", userId, password });
        compensated = true;
      } catch {}
    }
    if (compensated && credentials) {
      try {
        removeCredentialFile(credentials);
        credentials = null;
      } catch {}
    }
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        code: error?.code || "PROVISION_FAILED",
        compensated,
        credentialRetained: Boolean(credentials),
        credentialPath: credentials?.file || null
      })}\n`
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  if (process.argv.length !== 3 || !["--self-test", "--execute"].includes(process.argv[2])) {
    process.stdout.write(`${JSON.stringify({ ok: false, code: "EXPLICIT_MODE_REQUIRED" })}\n`);
    process.exitCode = 2;
  } else if (process.argv[2] === "--self-test") {
    selfTest();
  } else {
    execute();
  }
}
