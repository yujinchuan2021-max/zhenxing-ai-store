const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isMissingExactRegistryValueQuery
} = require("../shared/environment-registry-query.cjs");

test("treats exact reg.exe value-query exit code 1 as missing despite mojibake", () => {
  assert.equal(
    isMissingExactRegistryValueQuery({
      code: 1,
      killed: false,
      stderr: "����: ϵͳ�Ҳ���ָ����ע����ֵ��"
    }),
    true
  );
});

test("keeps interrupted and unexpected registry queries fail closed", () => {
  assert.equal(
    isMissingExactRegistryValueQuery({ code: 1, killed: true }),
    false
  );
  assert.equal(
    isMissingExactRegistryValueQuery({ code: 1, signal: "SIGTERM" }),
    false
  );
  assert.equal(
    isMissingExactRegistryValueQuery({ code: 1, timedOut: true }),
    false
  );
  assert.equal(isMissingExactRegistryValueQuery({ code: 2 }), false);
  assert.equal(isMissingExactRegistryValueQuery({ code: "1" }), false);
});
