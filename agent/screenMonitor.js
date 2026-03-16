const screenshot = require("screenshot-desktop");

function startScreenMonitor({ deviceId, serverUrl, token, enabled, intervalMs = 500 }) {
  if (!enabled) return { stop: () => {} };

  let timer = null;
  let inFlight = false;

  async function sendFrame() {
    if (inFlight) return;
    inFlight = true;
    try {
      const buffer = await screenshot({ format: "jpg" });
      const headers = { "Content-Type": "application/json" };
      if (token) headers["x-device-token"] = token;

      await fetch(`${serverUrl}/screen/frame`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceId,
          frameBase64: buffer.toString("base64"),
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
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