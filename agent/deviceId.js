const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const DEVICE_ID_FILE = path.join(os.homedir(), ".remote-camera-device-id");

function readDeviceId() {
  try {
    if (!fs.existsSync(DEVICE_ID_FILE)) return null;
    const raw = fs.readFileSync(DEVICE_ID_FILE, "utf8").trim();
    return raw || null;
  } catch {
    return null;
  }
}

function writeDeviceId(deviceId) {
  try {
    fs.writeFileSync(DEVICE_ID_FILE, String(deviceId), "utf8");
  } catch {
    // Best effort persistence only.
  }
}

function getMachineSignature() {
  const ifaces = os.networkInterfaces();
  const macs = [];
  Object.values(ifaces || {}).forEach((list) => {
    (list || []).forEach((item) => {
      if (!item || item.internal || !item.mac) return;
      macs.push(item.mac);
    });
  });
  macs.sort();
  const base = [
    os.hostname(),
    os.platform(),
    os.arch(),
    macs[0] || "no-mac"
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 10);
}

function getOrCreateDeviceId(preferredId) {
  if (preferredId) {
    writeDeviceId(preferredId);
    return preferredId;
  }
  const existing = readDeviceId();
  if (existing) return existing;

  const suffix = getMachineSignature();
  const generated = `cam-${suffix}`;
  writeDeviceId(generated);
  return generated;
}

module.exports = {
  getOrCreateDeviceId,
  readDeviceId,
  writeDeviceId
};
