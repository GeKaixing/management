const screenshot = require("screenshot-desktop");

function startScreenMonitor({ deviceId, serverUrl, token, enabled, intervalMs = 500 }) {
  if (!enabled) return { stop: () => {} };

  let timer = null;
  let inFlight = false;

  async function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timerId = setTimeout(() => reject(new Error("screen_capture_timeout")), ms);
      promise
        .then((value) => {
          clearTimeout(timerId);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timerId);
          reject(err);
        });
    });
  }

  async function sendFrame() {
    if (inFlight) return;
    inFlight = true;
    try {
      const buffer = await withTimeout(screenshot({ format: "jpg" }), 3000);
      const headers = { "Content-Type": "application/json" };
      if (token) headers["x-device-token"] = token;

      await fetch(`${serverUrl}/screen/frame`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceId,
          frameBase64: buffer.toString("base64"),
          timestamp: new Date().toISOString(),
          intervalMs
        })
      });
    } catch (err) {
      console.warn("screen capture failed:", err && err.message ? err.message : err);
      // Best-effort, ignore errors to keep capture loop alive.
    } finally {
      inFlight = false;
    }
  }

  timer = setInterval(sendFrame, intervalMs);
  sendFrame();

  return {
    stop: () => {
      if (timer) clearInterval(timer);
    }
  };
}

module.exports = {
  startScreenMonitor
};
