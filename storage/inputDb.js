const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("./files");

function getInputDbPath() {
  const paths = getStoragePaths();
  return path.join(paths.base, "input-events.json");
}

function loadInputEvents() {
  ensureStorage();
  const dbPath = getInputDbPath();
  if (!fs.existsSync(dbPath)) return [];
  const raw = fs.readFileSync(dbPath, "utf8");
  if (!raw) return [];
  return JSON.parse(raw);
}

function appendInputEvent(event) {
  const events = loadInputEvents();
  events.push(event);
  fs.writeFileSync(getInputDbPath(), JSON.stringify(events, null, 2));
  return event;
}

function filterInputEvents({ deviceId } = {}) {
  const events = loadInputEvents();
  if (!deviceId) return events;
  return events.filter((evt) => evt.deviceId === deviceId);
}

module.exports = {
  loadInputEvents,
  appendInputEvent,
  filterInputEvents
};