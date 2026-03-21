const test = global.test;
const assert = global.assert || require("node:assert/strict");

if (typeof test !== "function") {
  throw new Error("Test runner not initialized. Run with `node tests/run.js`.");
}

const { buildReportPayload, buildFallbackSummary } = require("../server/aiSummary");

test("buildReportPayload marks long offline devices", () => {
  const nowMs = Date.parse("2026-03-18T00:00:00.000Z");
  const longOfflineMs = 30 * 60 * 1000;
  const devices = [
    { id: "a", status: "offline", offlineAt: "2026-03-17T22:00:00.000Z" },
    { id: "b", status: "offline", offlineAt: "2026-03-17T23:45:00.000Z" },
    { id: "c", status: "online", lastSeen: nowMs }
  ];

  const payload = buildReportPayload(devices, nowMs, longOfflineMs);
  const longOffline = payload.devices.filter((d) => d.longOffline).map((d) => d.id);

  assert.deepEqual(longOffline, ["a"]);
});

test("buildFallbackSummary returns bilingual summary", () => {
  const payload = {
    now: "2026-03-18T00:00:00.000Z",
    total: 2,
    devices: [
      { id: "a", status: "online", onlineMsToday: 3600 * 1000, requiredHours: 8, lazy: false, longOffline: false },
      { id: "b", status: "offline", onlineMsToday: 0, requiredHours: 8, lazy: true, longOffline: true }
    ]
  };
  const summary = buildFallbackSummary(payload);
  assert.ok(summary.includes("中文摘要"));
  assert.ok(summary.includes("English Summary"));
  assert.ok(summary.includes("总设备"));
  assert.ok(summary.includes("Total devices"));
});
