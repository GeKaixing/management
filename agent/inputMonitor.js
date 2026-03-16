let ioHook = null;

function loadIoHook() {
  if (ioHook) return ioHook;
  try {
    // uiohook-napi is optional and requires native build.
    const mod = require("uiohook-napi");
    ioHook = mod.uIOhook || mod;
  } catch (err) {
    ioHook = null;
  }
  return ioHook;
}

async function postInputEvent({ serverUrl, token, payload }) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["x-device-token"] = token;

  try {
    await fetch(`${serverUrl}/input/event`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // Best-effort; ignore network errors.
  }
}

function startInputMonitor({ deviceId, serverUrl, token, enabled }) {
  if (!enabled) return { stop: () => {} };

  const hook = loadIoHook();
  if (!hook) {
    console.warn("uiohook-napi not installed. Input monitoring disabled.");
    return { stop: () => {} };
  }

  let mouseClicks = 0;
  let keyPresses = 0;

  hook.on("mousedown", (event) => {
    mouseClicks += 1;
    const payload = {
      deviceId,
      type: "mouse",
      action: "click",
      detail: {
        button: event && event.button,
        clicks: mouseClicks
      },
      timestamp: new Date().toISOString()
    };
    postInputEvent({ serverUrl, token, payload });
  });

  hook.on("keydown", (event) => {
    keyPresses += 1;
    const payload = {
      deviceId,
      type: "keyboard",
      action: "keydown",
      detail: {
        keycode: event && event.keycode,
        rawcode: event && event.rawcode,
        count: keyPresses
      },
      timestamp: new Date().toISOString()
    };
    postInputEvent({ serverUrl, token, payload });
  });

  hook.start();

  return {
    stop: () => {
      hook.removeAllListeners("mousedown");
      hook.removeAllListeners("keydown");
      hook.stop();
    }
  };
}

module.exports = {
  startInputMonitor
};
