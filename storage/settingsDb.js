const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("./files");

const DEFAULT_SETTINGS = {
  workHoursPerDay: 8,
  hideOfflineMedia: true,
  emailTemplateLazy: "最近监测到你有些偷懒，请注意按时完成任务。",
  emailTemplateDone: "干得真棒了！任务已完成。",
  aiProvider: "gemini",
  geminiApiKey: ""
};

function getSettingsPath() {
  const paths = getStoragePaths();
  return path.join(paths.base, "settings.json");
}

function loadSettings() {
  ensureStorage();
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) return { ...DEFAULT_SETTINGS };
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(next) {
  ensureStorage();
  fs.writeFileSync(getSettingsPath(), JSON.stringify(next, null, 2));
  return next;
}

function updateSettings(patch) {
  const current = loadSettings();
  const next = { ...current, ...patch };
  return saveSettings(next);
}

module.exports = {
  loadSettings,
  updateSettings
};
