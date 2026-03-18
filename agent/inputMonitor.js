const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

let ioHook = null;
let ioHookTypes = null;

function loadIoHook() {
  if (ioHook) return { hook: ioHook, EventType: ioHookTypes };
  try {
    // uiohook-napi is optional and requires native build.
    const mod = require("uiohook-napi");
    ioHook = mod.uIOhook || mod;
    ioHookTypes = mod.EventType || null;
  } catch (err) {
    ioHook = null;
    ioHookTypes = null;
  }
  return ioHook ? { hook: ioHook, EventType: ioHookTypes } : null;
}

function buildMacInputHelper() {
  const srcPath = path.join(__dirname, "native", "macos", "input_tap.swift");
  const binDir = path.join(__dirname, "bin", "macos");
  const binPath = path.join(binDir, "input_tap");

  if (!fs.existsSync(srcPath)) {
    console.warn("mac input helper source missing:", srcPath);
    return { ok: false, error: "missing source" };
  }

  if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

  if (fs.existsSync(binPath)) return { ok: true, binPath };

  console.log("mac input helper: building swift binary...");
  const result = spawnSync(
    "xcrun",
    ["swiftc", srcPath, "-O", "-o", binPath],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    console.warn("mac input helper build failed.");
    return { ok: false, error: "build failed" };
  }

  console.log("mac input helper build ok:", binPath);
  return { ok: true, binPath };
}

function startMacInputMonitor({ deviceId, serverUrl, token, enabled }) {
  if (!enabled) return { stop: () => {} };

  const build = buildMacInputHelper();
  if (!build.ok) {
    console.warn("mac input helper build failed. Falling back to uiohook.");
    return null;
  }

  console.log("mac input helper: starting");
  let keyPresses = 0;
  let mouseClicks = 0;
  const child = spawn(build.binPath, [], { stdio: ["ignore", "pipe", "pipe"] });

  const onLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let evt;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (!evt || !evt.type) return;

    if (evt.type === "keyboard") {
      keyPresses += 1;
      const payload = {
        deviceId,
        type: "keyboard",
        action: "keydown",
        detail: {
          keycode: evt.keycode,
          rawcode: evt.rawcode,
          count: keyPresses
        },
        timestamp: evt.timestamp || new Date().toISOString()
      };
      postInputEvent({ serverUrl, token, payload });
      return;
    }

    if (evt.type === "mouse") {
      mouseClicks += 1;
      const payload = {
        deviceId,
        type: "mouse",
        action: evt.action || "click",
        detail: {
          button: evt.button,
          clicks: mouseClicks,
          x: evt.x,
          y: evt.y,
          amount: evt.amount,
          rotation: evt.rotation,
          direction: evt.direction
        },
        timestamp: evt.timestamp || new Date().toISOString()
      };
      postInputEvent({ serverUrl, token, payload });
    }
  };

  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";
    parts.forEach(onLine);
  });

  child.stderr.on("data", (chunk) => {
    const msg = chunk.toString().trim();
    if (msg) console.warn("[mac-input]", msg);
  });

  child.on("exit", (code) => {
    console.warn(`mac input helper exited (${code}).`);
  });

  return {
    stop: () => {
      child.kill();
    }
  };
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

  if (os.platform() === "darwin") {
    const mac = startMacInputMonitor({ deviceId, serverUrl, token, enabled });
    if (mac) return mac;
  }

  const loaded = loadIoHook();
  if (!loaded) {
    console.warn("uiohook-napi not installed. Input monitoring disabled.");
    return { stop: () => {} };
  }
  const { hook, EventType } = loaded;

  let mouseClicks = 0;
  let keyPresses = 0;

  function sendMouseEvent(action, event, extra) {
    mouseClicks += 1;
    const payload = {
      deviceId,
      type: "mouse",
      action,
      detail: {
        button: event && event.button,
        clicks: mouseClicks,
        ...extra
      },
      timestamp: new Date().toISOString()
    };
    postInputEvent({ serverUrl, token, payload });
  }

  if (EventType) {
    hook.on("input", (event) => {
      switch (event && event.type) {
        case EventType.EVENT_KEY_PRESSED: {
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
          break;
        }
        case EventType.EVENT_MOUSE_PRESSED:
          sendMouseEvent("mousedown", event);
          break;
        case EventType.EVENT_MOUSE_RELEASED:
          sendMouseEvent("mouseup", event);
          break;
        case EventType.EVENT_MOUSE_CLICKED:
          sendMouseEvent("click", event);
          break;
        case EventType.EVENT_MOUSE_WHEEL:
          sendMouseEvent("wheel", event, {
            amount: event && event.amount,
            rotation: event && event.rotation,
            direction: event && event.direction
          });
          break;
        default:
          break;
      }
    });
  } else {
    hook.on("mousedown", (event) => {
      sendMouseEvent("mousedown", event);
    });

    hook.on("mouseup", (event) => {
      sendMouseEvent("mouseup", event);
    });

    hook.on("click", (event) => {
      sendMouseEvent("click", event);
    });

    hook.on("mousewheel", (event) => {
      sendMouseEvent("wheel", event, {
        amount: event && event.amount,
        rotation: event && event.rotation,
        direction: event && event.direction
      });
    });
  }

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
      hook.removeAllListeners("input");
      hook.removeAllListeners("mousedown");
      hook.removeAllListeners("mouseup");
      hook.removeAllListeners("click");
      hook.removeAllListeners("mousewheel");
      hook.removeAllListeners("keydown");
      hook.stop();
    }
  };
}

module.exports = {
  startInputMonitor
};
