const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("./files");

function getAudioDbPath() {
  const paths = getStoragePaths();
  return path.join(paths.base, "audio-events.json");
}

function loadAudioEvents() {
  ensureStorage();
  const dbPath = getAudioDbPath();
  if (!fs.existsSync(dbPath)) return [];
  const raw = fs.readFileSync(dbPath, "utf8");
  if (!raw) return [];
  return JSON.parse(raw);
}

function appendAudioEvent(event) {
  const events = loadAudioEvents();
  events.push(event);
  fs.writeFileSync(getAudioDbPath(), JSON.stringify(events, null, 2));
  return event;
}

function filterAudioEvents({ deviceId } = {}) {
  const events = loadAudioEvents();
  if (!deviceId) return events;
  return events.filter((evt) => evt.deviceId === deviceId);
}

module.exports = {
  loadAudioEvents,
  appendAudioEvent,
  filterAudioEvents
};