const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("./files");

function getDeviceMetaPath() {
  const paths = getStoragePaths();
  return path.join(paths.base, "devices.json");
}

function loadDeviceMeta() {
  ensureStorage();
  const filePath = getDeviceMetaPath();
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDeviceMeta(next) {
  ensureStorage();
  fs.writeFileSync(getDeviceMetaPath(), JSON.stringify(next, null, 2));
  return next;
}

function getDeviceMeta(id) {
  const all = loadDeviceMeta();
  return all[id] || null;
}

function updateDeviceMeta(id, patch) {
  const all = loadDeviceMeta();
  const current = all[id] || { id };
  const next = {
    ...current,
    ...patch,
    id,
    updatedAt: new Date().toISOString()
  };
  all[id] = next;
  saveDeviceMeta(all);
  return next;
}

function deleteDeviceMeta(id) {
  return updateDeviceMeta(id, { deleted: true });
}

module.exports = {
  loadDeviceMeta,
  getDeviceMeta,
  updateDeviceMeta,
  deleteDeviceMeta
};
