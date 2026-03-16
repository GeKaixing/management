const test = global.test;
const assert = global.assert || require("node:assert/strict");
const { detectFall } = require("../ai/fallDetector");

if (typeof test !== "function") {
  throw new Error("Test runner not initialized. Run with `node tests/run.js`.");
}

test("detectFall returns true for debug flag", () => {
  assert.equal(detectFall({ debugFall: true }), true);
});

test("detectFall returns true for pose-based fall", () => {
  assert.equal(
    detectFall({ pose: { tiltDeg: 72, heightDrop: 0.5 } }),
    true
  );
});

test("detectFall returns true for motion-based fall", () => {
  assert.equal(
    detectFall({ motion: { state: "lying", immobileSeconds: 1.2 } }),
    true
  );
});

test("detectFall returns false when thresholds are not met", () => {
  assert.equal(
    detectFall({ pose: { tiltDeg: 30, heightDrop: 0.1 }, motion: { state: "standing", immobileSeconds: 0 } }),
    false
  );
});
