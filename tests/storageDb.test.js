const test = global.test;
const assert = global.assert || require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

if (typeof test !== "function") {
  throw new Error("Test runner not initialized. Run with `node tests/run.js`.");
}

function loadDbModules() {
  const filesPath = path.resolve(__dirname, "..", "storage", "files.js");
  const dbPath = path.resolve(__dirname, "..", "storage", "db.js");
  delete require.cache[filesPath];
  delete require.cache[dbPath];
  return require(dbPath);
}

test("storage db persists events to disk", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rcs-test-"));
  const originalCwd = process.cwd();

  process.chdir(tempDir);
  try {
    const { appendEvent, loadEvents, getEvent } = loadDbModules();
    const event = {
      id: "evt-1",
      timestamp: new Date().toISOString(),
      deviceId: "dev-1",
      type: "fall",
      snapshot: "snap.jpg",
      video: "clip.mp4"
    };

    assert.deepEqual(loadEvents(), []);
    appendEvent(event);

    const events = loadEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0].id, "evt-1");
    assert.equal(getEvent("evt-1").deviceId, "dev-1");
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
