const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("./files");

function getOnlineDbPath() {
  const paths = getStoragePaths();
  return path.join(paths.base, "online-time.json");
}

function loadOnlineDb() {
  ensureStorage();
  const dbPath = getOnlineDbPath();
  if (!fs.existsSync(dbPath)) return {};
  const raw = fs.readFileSync(dbPath, "utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveOnlineDb(data) {
  ensureStorage();
  fs.writeFileSync(getOnlineDbPath(), JSON.stringify(data, null, 2));
}

function toDateKey(timestampMs) {
  const d = new Date(timestampMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(timestampMs) {
  const d = new Date(timestampMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addOnlineDuration(deviceId, startMs, endMs) {
  if (!deviceId) return;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
  if (endMs <= startMs) return;

  const db = loadOnlineDb();
  if (!db[deviceId]) db[deviceId] = {};

  let cursor = startMs;
  while (cursor < endMs) {
    const dayStart = startOfDay(cursor);
    const nextDay = dayStart + 24 * 60 * 60 * 1000;
    const sliceEnd = Math.min(endMs, nextDay);
    const key = toDateKey(dayStart);
    db[deviceId][key] = (db[deviceId][key] || 0) + (sliceEnd - cursor);
    cursor = sliceEnd;
  }

  saveOnlineDb(db);
}

function getOnlineDuration(deviceId, dateKey) {
  const db = loadOnlineDb();
  if (!deviceId || !dateKey) return 0;
  return Number(db[deviceId]?.[dateKey] || 0);
}

module.exports = {
  addOnlineDuration,
  getOnlineDuration,
  toDateKey,
  startOfDay
};
