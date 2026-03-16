const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("./files");

function getProcessPath() {
  const paths = getStoragePaths();
  return path.join(paths.base, "process-events.json");
}

function loadProcessEvents() {
  ensureStorage();
  const filePath = getProcessPath();
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProcessEvents(events) {
  ensureStorage();
  fs.writeFileSync(getProcessPath(), JSON.stringify(events, null, 2));
}

function appendProcessSnapshot(snapshot) {
  const all = loadProcessEvents();
  all.push(snapshot);
  if (all.length > 10000) {
    all.splice(0, all.length - 10000);
  }
  saveProcessEvents(all);
  return snapshot;
}

function getLatestProcessSnapshot(deviceId) {
  const all = loadProcessEvents();
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const evt = all[i];
    if (!deviceId || evt.deviceId === deviceId) return evt;
  }
  return null;
}

function getLatestProcessSnapshots() {
  const all = loadProcessEvents();
  const map = new Map();
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const evt = all[i];
    if (!evt || !evt.deviceId) continue;
    if (!map.has(evt.deviceId)) map.set(evt.deviceId, evt);
  }
  return Array.from(map.values());
}

module.exports = {
  appendProcessSnapshot,
  getLatestProcessSnapshot,
  getLatestProcessSnapshots
};
