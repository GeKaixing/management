const fs = require("fs");
const path = require("path");
const { ensureStorage, getStoragePaths } = require("./files");

function getEmployeePath() {
  const paths = getStoragePaths();
  return path.join(paths.base, "employees.json");
}

function loadEmployees() {
  ensureStorage();
  const filePath = getEmployeePath();
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

function saveEmployees(next) {
  ensureStorage();
  fs.writeFileSync(getEmployeePath(), JSON.stringify(next, null, 2));
  return next;
}

function updateEmployee(deviceId, patch) {
  const current = loadEmployees();
  const prev = current[deviceId] || {};
  const next = {
    ...current,
    [deviceId]: {
      ...prev,
      ...patch
    }
  };
  return saveEmployees(next);
}

module.exports = {
  loadEmployees,
  updateEmployee
};
