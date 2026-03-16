const { exec } = require("child_process");

function parseWindowsTasklist(output) {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const names = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const first = trimmed.split(",")[0] || "";
    const name = first.replace(/^"|"$/g, "");
    if (name) names.push(name);
  }
  return names;
}

function parseUnixPs(output) {
  const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines;
}

function aggregate(names, topN = 8) {
  const counts = new Map();
  for (const name of names) {
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const list = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    total: names.length,
    top: list.slice(0, topN)
  };
}

function collectProcessSnapshot() {
  return new Promise((resolve) => {
    const platform = process.platform;
    if (platform === "win32") {
      exec("tasklist /FO CSV /NH", { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (err) return resolve({ total: 0, top: [] });
        const names = parseWindowsTasklist(stdout || "");
        resolve(aggregate(names));
      });
      return;
    }

    exec("ps -A -o comm=", { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve({ total: 0, top: [] });
      const names = parseUnixPs(stdout || "");
      resolve(aggregate(names));
    });
  });
}

function startProcessMonitor({ deviceId, serverUrl, token, enabled, intervalMs = 60000 }) {
  if (!enabled) return { stop: () => {} };

  let timer = null;
  let inFlight = false;

  async function sendSnapshot() {
    if (inFlight) return;
    inFlight = true;
    try {
      const snapshot = await collectProcessSnapshot();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["x-device-token"] = token;

      await fetch(`${serverUrl}/process/snapshot`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceId,
          timestamp: new Date().toISOString(),
          total: snapshot.total,
          top: snapshot.top
        })
      });
    } catch {
      // Best-effort only.
    } finally {
      inFlight = false;
    }
  }

  timer = setInterval(sendSnapshot, intervalMs);
  sendSnapshot();

  return {
    stop: () => {
      if (timer) clearInterval(timer);
    }
  };
}

module.exports = {
  startProcessMonitor
};
