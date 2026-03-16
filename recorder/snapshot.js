const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("../storage/files");

function saveSnapshot(buffer, opts = {}) {
  ensureStorage();
  const paths = getStoragePaths();
  const name = opts.eventId ? `${opts.eventId}.jpg` : `${Date.now()}.jpg`;
  const fullPath = path.join(paths.snapshots, name);
  fs.writeFileSync(fullPath, buffer || Buffer.alloc(0));
  return fullPath;
}

module.exports = {
  saveSnapshot
};