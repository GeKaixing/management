const fs = require("fs");
const path = require("path");

const base = path.join(process.cwd(), "storage_data");
const paths = {
  base,
  snapshots: path.join(base, "snapshots"),
  recordings: path.join(base, "recordings"),
  tmp: path.join(base, "tmp"),
  audio: path.join(base, "audio"),
  audioTmp: path.join(base, "audio_tmp")
};

function ensureStorage() {
  Object.values(paths).forEach((p) => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

function getStoragePaths() {
  return paths;
}

module.exports = {
  ensureStorage,
  getStoragePaths
};
