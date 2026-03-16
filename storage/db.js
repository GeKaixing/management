const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("./files");

function getDbPath() {
  const paths = getStoragePaths();
  return path.join(paths.base, "events.json");
}

function loadEvents() {
  ensureStorage();
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return [];
  const raw = fs.readFileSync(dbPath, "utf8");
  if (!raw) return [];
  return JSON.parse(raw);
}

function appendEvent(event) {
  const events = loadEvents();
  events.push(event);
  fs.writeFileSync(getDbPath(), JSON.stringify(events, null, 2));
  return event;
}

function getEvent(id) {
  const events = loadEvents();
  return events.find((evt) => evt.id === id) || null;
}

module.exports = {
  loadEvents,
  appendEvent,
  getEvent
};