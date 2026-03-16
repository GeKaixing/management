#!/usr/bin/env node

const { resolveConfig } = require("./config");
const { startCamera } = require("./camera");
const { startInputMonitor } = require("./inputMonitor");
const { startScreenMonitor } = require("./screenMonitor");
const { startMicRecorder } = require("./micRecorder");
const { startCameraFrameMonitor } = require("./cameraFrameMonitor");

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function hasFlag(args, name) {
  return args.includes(name);
}

async function registerDevice(serverUrl, deviceId, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["x-device-token"] = token;

  const res = await fetch(`${serverUrl}/device/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: deviceId })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Device register failed: ${res.status} ${text}`);
  }

  return res.json().catch(() => ({}));
}

async function sendHeartbeat(serverUrl, deviceId, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["x-device-token"] = token;
  await fetch(`${serverUrl}/device/heartbeat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ deviceId })
  });
}

async function notifyOffline(serverUrl, deviceId, token, reason) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["x-device-token"] = token;

  await fetch(`${serverUrl}/device/offline`, {
    method: "POST",
    headers,
    body: JSON.stringify({ deviceId, reason })
  });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function printUsage() {
  console.log("Usage:");
  console.log("  node agent/cli.js start [options]");
  console.log("Options:");
  console.log("  --device <id>");
  console.log("  --server <url>");
  console.log("  --token <token>");
  console.log("  --camera <input>");
  console.log("  --format <format>");
  console.log("  --fps <number>");
  console.log("  --resolution <WxH>");
  console.log("  --protocol <rtsp>");
  console.log("  --stream-url <url>");
  console.log("  --input");
  console.log("  --screen");
  console.log("  --screen-interval <ms>");
  console.log("  --mic");
  console.log("  --mic-input <input>");
  console.log("  --mic-format <format>");
  console.log("  --mic-segment <seconds>");
  console.log("  --mic-bitrate <rate>");
  console.log("  --camera-frames");
  console.log("  --camera-frames-interval <ms>");
  console.log("  --no-camera");
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "-h" || cmd === "--help") {
    printUsage();
    process.exit(0);
  }

  if (cmd !== "start") {
    printUsage();
    process.exit(1);
  }

  const overrides = {};
  const deviceId = getArgValue(args, "--device");
  const serverUrl = getArgValue(args, "--server");
  const token = getArgValue(args, "--token");

  if (deviceId) overrides.deviceId = deviceId;
  if (serverUrl) overrides.serverUrl = serverUrl;

  const cameraInput = getArgValue(args, "--camera");
  const cameraFormat = getArgValue(args, "--format");
  const fps = getArgValue(args, "--fps");
  const resolution = getArgValue(args, "--resolution");

  if (cameraInput || cameraFormat || fps || resolution) {
    overrides.camera = {};
    if (cameraInput) overrides.camera.input = cameraInput;
    if (cameraFormat) overrides.camera.format = cameraFormat;
    if (fps) overrides.camera.fps = Number(fps);
    if (resolution) overrides.camera.resolution = resolution;
  }

  const protocol = getArgValue(args, "--protocol");
  const streamUrl = getArgValue(args, "--stream-url");
  if (protocol || streamUrl) {
    overrides.stream = {};
    if (protocol) overrides.stream.protocol = protocol;
    if (streamUrl) overrides.stream.url = streamUrl;
  }

  if (hasFlag(args, "--input")) {
    overrides.inputMonitoring = { enabled: true };
  }

  if (hasFlag(args, "--screen")) {
    overrides.screenMonitoring = { enabled: true };
  }

  const screenInterval = getArgValue(args, "--screen-interval");
  if (screenInterval) {
    overrides.screenMonitoring = overrides.screenMonitoring || {};
    overrides.screenMonitoring.intervalMs = Number(screenInterval);
  }

  if (hasFlag(args, "--mic")) {
    overrides.micMonitoring = { enabled: true };
  }

  const micInput = getArgValue(args, "--mic-input");
  const micFormat = getArgValue(args, "--mic-format");
  const micSegment = getArgValue(args, "--mic-segment");
  const micBitrate = getArgValue(args, "--mic-bitrate");
  if (micInput || micFormat || micSegment || micBitrate) {
    overrides.micMonitoring = overrides.micMonitoring || {};
    if (micInput) overrides.micMonitoring.input = micInput;
    if (micFormat) overrides.micMonitoring.format = micFormat;
    if (micSegment) overrides.micMonitoring.segmentSeconds = Number(micSegment);
    if (micBitrate) overrides.micMonitoring.bitrate = micBitrate;
  }

  if (hasFlag(args, "--camera-frames")) {
    overrides.cameraFrameMonitoring = { enabled: true };
  }

  const camFrameInterval = getArgValue(args, "--camera-frames-interval");
  if (camFrameInterval) {
    overrides.cameraFrameMonitoring = overrides.cameraFrameMonitoring || {};
    overrides.cameraFrameMonitoring.intervalMs = Number(camFrameInterval);
  }

  const noCamera = hasFlag(args, "--no-camera");

  const config = resolveConfig(overrides);

  await registerDevice(config.serverUrl, config.deviceId, token);
  console.log("Device registered:", config.deviceId);

  const heartbeatTimer = setInterval(() => {
    sendHeartbeat(config.serverUrl, config.deviceId, token).catch(() => {
      // Best-effort heartbeat only.
    });
  }, 5000);

  let cameraProc = null;
  if (!noCamera) {
    cameraProc = startCamera(config);
  } else {
    console.log("Camera capture disabled (--no-camera).");
  }
  const inputMonitor = startInputMonitor({
    deviceId: config.deviceId,
    serverUrl: config.serverUrl,
    token,
    enabled: config.inputMonitoring && config.inputMonitoring.enabled
  });
  const screenMonitor = startScreenMonitor({
    deviceId: config.deviceId,
    serverUrl: config.serverUrl,
    token,
    enabled: config.screenMonitoring && config.screenMonitoring.enabled,
    intervalMs: config.screenMonitoring && config.screenMonitoring.intervalMs
  });
  const micRecorder = startMicRecorder({
    deviceId: config.deviceId,
    serverUrl: config.serverUrl,
    token,
    enabled: config.micMonitoring && config.micMonitoring.enabled,
    segmentSeconds: config.micMonitoring && config.micMonitoring.segmentSeconds,
    format: config.micMonitoring && config.micMonitoring.format,
    input: config.micMonitoring && config.micMonitoring.input,
    bitrate: config.micMonitoring && config.micMonitoring.bitrate
  });
  const cameraFrameMonitor = startCameraFrameMonitor({
    deviceId: config.deviceId,
    serverUrl: config.serverUrl,
    token,
    enabled: config.cameraFrameMonitoring && config.cameraFrameMonitoring.enabled,
    intervalMs: config.cameraFrameMonitoring && config.cameraFrameMonitoring.intervalMs,
    format: config.camera && config.camera.format,
    input: config.camera && config.camera.input,
    resolution: config.camera && config.camera.resolution
  });
  console.log("Camera streaming started.");

  let shuttingDown = false;
  async function gracefulShutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;

    try {
      clearInterval(heartbeatTimer);
      inputMonitor && inputMonitor.stop && inputMonitor.stop();
      screenMonitor && screenMonitor.stop && screenMonitor.stop();
      micRecorder && micRecorder.stop && micRecorder.stop();
      cameraFrameMonitor && cameraFrameMonitor.stop && cameraFrameMonitor.stop();
      if (cameraProc && cameraProc.kill) cameraProc.kill();
    } catch (err) {
      // Ignore shutdown errors.
    }

    try {
      await withTimeout(
        notifyOffline(config.serverUrl, config.deviceId, token, reason || "shutdown"),
        2000
      );
    } catch (err) {
      // Best-effort notify.
    }

    process.exit(0);
  }

  process.on("SIGINT", () => gracefulShutdown("sigint"));
  process.on("SIGTERM", () => gracefulShutdown("sigterm"));
  process.on("uncaughtException", (err) => {
    console.error(err && err.message ? err.message : err);
    gracefulShutdown("uncaughtException");
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
