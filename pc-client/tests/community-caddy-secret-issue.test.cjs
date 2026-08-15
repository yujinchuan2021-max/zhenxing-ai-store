"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const issueScript = path.join(root, "deployment", "community-production", "issue-caddy-gateway-secret.sh");
const linuxImage = "mariadb:11.8@sha256:efb4959ef2c835cd735dbc388eb9ad6aab0c78dd64febcd51bc17481111890c4";

function docker(args, { allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`docker ${args[0]} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result;
}

function uniqueVolume() {
  return `aihub-issue-secret-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`.toLowerCase();
}

function createFixture(setup) {
  const volume = uniqueVolume();
  docker(["volume", "create", volume]);
  docker([
    "run", "--rm", "--user", "0:0", "-v", `${volume}:/fixture`, linuxImage,
    "/bin/bash", "-ec", setup
  ]);
  return volume;
}

function removeFixture(volume) {
  docker(["volume", "rm", volume], { allowFailure: true });
}

function runIssue(volume, { target = "/fixture/source", inUse = false, failRandom = false, extraArgs = [] } = {}) {
  const setup = `
set -eu
mkdir -p /fixture/bin /fixture/scripts
cp /input/issue.sh /fixture/scripts/issue.sh
chmod 644 /fixture/scripts/issue.sh
cat > /fixture/bin/docker <<'EOF'
#!/bin/sh
case "$1" in
  ps) [ ! -e /fixture/in-use ] || printf '%s\\n' running-container ;;
  inspect) [ ! -e /fixture/in-use ] || printf '%s\\n' /fixture/source ;;
esac
exit 0
EOF
chmod 755 /fixture/bin/docker
${inUse ? ": > /fixture/in-use" : "rm -f /fixture/in-use"}
${failRandom ? "cat > /fixture/bin/openssl <<'EOF'\n#!/bin/sh\nexit 1\nEOF\nchmod 755 /fixture/bin/openssl" : ""}
PATH=/fixture/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \\
  /bin/bash /fixture/scripts/issue.sh ${target} ${extraArgs.join(" ")}
`;
  return docker([
    "run", "--rm", "--user", "0:0", "-e", "SUDO_UID=1000", "-e", "SUDO_GID=1000",
    "-v", `${volume}:/fixture`, "-v", `${issueScript}:/input/issue.sh:ro`,
    linuxImage, "/bin/bash", "-ec", setup
  ], { allowFailure: true });
}

function readSource(volume) {
  return docker([
    "run", "--rm", "--user", "0:0", "-v", `${volume}:/fixture:ro`, linuxImage,
    "/bin/bash", "-ec", "stat -c '%u:%g:%a:%h:%s' /fixture/source; cat /fixture/source"
  ]).stdout;
}

test("issue script atomically replaces a caller-owned source with 64 hex bytes and no newline", () => {
  const oldValue = `${"a".repeat(64)}\n`;
  const volume = createFixture("printf '%s\\n' 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source");
  try {
    const result = runIssue(volume);
    assert.equal(result.status, 0, result.stderr);
    const output = readSource(volume);
    const [metadata, value] = output.split("\n", 2);
    assert.equal(metadata, "1000:1000:600:1:64");
    assert.match(value, /^[0-9a-f]{64}$/);
    assert.notEqual(`${value}\n`, oldValue);
    assert.equal((result.stdout + result.stderr).includes(value), false);
    const tempCount = docker([
      "run", "--rm", "--user", "0:0", "-v", `${volume}:/fixture:ro`, linuxImage,
      "/bin/bash", "-ec", "find /fixture -maxdepth 1 -name '.community_cms_gateway.issue.*' | wc -l"
    ]).stdout.trim();
    assert.equal(tempCount, "0");
  } finally {
    removeFixture(volume);
  }
});

test("generation failure preserves the existing authority and removes temporary files", () => {
  const oldValue = `${"b".repeat(64)}\n`;
  const volume = createFixture("printf '%s\\n' 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source");
  try {
    const result = runIssue(volume, { failRandom: true });
    assert.notEqual(result.status, 0);
    const output = readSource(volume);
    assert.equal(output, `1000:1000:600:1:65\n${oldValue}`);
    assert.equal((result.stdout + result.stderr).includes(oldValue.trim()), false);
    assert.equal(docker([
      "run", "--rm", "--user", "0:0", "-v", `${volume}:/fixture:ro`, linuxImage,
      "/bin/bash", "-ec", "test -z \"$(find /fixture -maxdepth 1 -name '.community_cms_gateway.issue.*' -print -quit)\""
    ], { allowFailure: true }).status, 0);
  } finally {
    removeFixture(volume);
  }
});

test("issue script rejects unsafe path, ownership, links, and active consumption", async (t) => {
  const cases = [
    ["relative path", "printf '%s' 'old' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source", { target: "fixture/source" }],
    ["wrong owner", "printf '%s' 'old' > /fixture/source; chown 1001:1001 /fixture/source; chmod 600 /fixture/source", {}],
    ["group-readable mode", "printf '%s' 'old' > /fixture/source; chown 1000:1000 /fixture/source; chmod 640 /fixture/source", {}],
    ["symlink", "printf '%s' 'old' > /fixture/real; chown 1000:1000 /fixture/real; chmod 600 /fixture/real; ln -s /fixture/real /fixture/source", {}],
    ["multiple links", "printf '%s' 'old' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source; ln /fixture/source /fixture/other", {}],
    ["active consumer", "printf '%s' 'old' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source", { inUse: true }]
  ];
  for (const [name, setup, options] of cases) {
    await t.test(name, () => {
      const volume = createFixture(setup);
      try {
        const before = readSource(volume);
        const result = runIssue(volume, options);
        assert.notEqual(result.status, 0);
        assert.equal(readSource(volume), before);
        assert.doesNotMatch(result.stdout + result.stderr, /bbbbbbbb|aaaaaaaa/);
      } finally {
        removeFixture(volume);
      }
    });
  }
});

test("issue script accepts no secret, owner, or policy override parameter", () => {
  const volume = createFixture("printf '%s' 'old' > /fixture/source; chown 1000:1000 /fixture/source; chmod 600 /fixture/source");
  try {
    const result = runIssue(volume, { extraArgs: ["1000:1000"] });
    assert.notEqual(result.status, 0);
    assert.equal(readSource(volume), "1000:1000:600:1:3\nold");
  } finally {
    removeFixture(volume);
  }
});
