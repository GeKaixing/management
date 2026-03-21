const path = require("node:path");
const assert = require("node:assert/strict");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

global.test = test;
global.assert = assert;

require(path.join(__dirname, "ringBuffer.test.js"));
require(path.join(__dirname, "fallDetector.test.js"));
require(path.join(__dirname, "storageDb.test.js"));
require(path.join(__dirname, "aiSummary.test.js"));

async function run() {
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      process.stdout.write(`ok - ${t.name}\n`);
    } catch (err) {
      failed += 1;
      process.stdout.write(`not ok - ${t.name}\n`);
      process.stderr.write(`${err && err.stack ? err.stack : err}\n`);
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run();
