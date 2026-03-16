const test = global.test;
const assert = global.assert || require("node:assert/strict");
const { RingBuffer } = require("../recorder/ringBuffer");

if (typeof test !== "function") {
  throw new Error("Test runner not initialized. Run with `node tests/run.js`.");
}

test("RingBuffer caps length and preserves order", () => {
  const buffer = new RingBuffer(3);
  buffer.push(1);
  buffer.push(2);
  buffer.push(3);
  assert.deepEqual(buffer.getFrames(), [1, 2, 3]);

  buffer.push(4);
  assert.deepEqual(buffer.getFrames(), [2, 3, 4]);
});

test("RingBuffer clear resets items", () => {
  const buffer = new RingBuffer(2);
  buffer.push("a");
  buffer.push("b");
  buffer.clear();
  assert.deepEqual(buffer.getFrames(), []);
});
