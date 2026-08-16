const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { goBackOrFallback } = require("../shared/navigation-back.cjs");

test("uses embedded history before falling back to the parent page", () => {
  const calls = [];
  const result = goBackOrFallback({
    canGoBack: () => true,
    goBack: () => calls.push("history"),
    fallback: () => calls.push("parent")
  });

  assert.equal(result, "history");
  assert.deepEqual(calls, ["history"]);
});

test("uses the explicit parent page for a direct deep link", () => {
  const calls = [];
  const result = goBackOrFallback({
    canGoBack: () => false,
    goBack: () => calls.push("history"),
    fallback: () => calls.push("parent")
  });

  assert.equal(result, "fallback");
  assert.deepEqual(calls, ["parent"]);
});

test("the shared back control is a floating circular target with focus-visible treatment", () => {
  const styles = fs.readFileSync(path.join(__dirname, "../src/styles.css"), "utf8");
  assert.match(styles, /\.backButton\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;[\s\S]*?border-radius:\s*50%;/);
  assert.match(styles, /\.backButton:focus-visible\s*\{[\s\S]*?outline:/);
});
