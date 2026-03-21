#!/usr/bin/env node

const { resolveConfig } = require("./config");
const { startCamera } = require("./camera");
const { startInputMonitor } = require("./inputMonitor");
const { startScreenMonitor } = require("./screenMonitor");
const { startMicRecorder } = require("./micRecorder");
const { startCameraFrameMonitor } = require("./cameraFrameMonitor");
const { startProcessMonitor } = require("./processMonitor");
const { resolveFfmpegBin, canExecuteFfmpeg } = require("../utils/ffmpeg");
const { ensureRtspServer } = require("./rtspServer");

function getArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function hasFlag(args, name) {
  return args.includes(name);
}

function resolveFfmpegPath(config) {
  return (config && config.ffmpegPath) || resolveFfmpegBin();
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
  console.log("  --process");
  console.log("  --process-interval <ms>");
  console.log("  --no-camera");
  console.log("  --no-rtsp-server");
}

async function main() {
  let args = process.argv.slice(2);
  if (args.length <= 1 && process.env.npm_config_argv) {
    try {
      const parsed = JSON.parse(process.env.npm_config_argv);
      if (parsed && Array.isArray(parsed.remain) && parsed.remain.length > 0) {
        args = [args[0], ...parsed.remain];
      }
    } catch {
      // Ignore npm_config_argv parsing errors.
    }
  }
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

  const flagInput = hasFlag(args, "--input");
  const flagScreen = hasFlag(args, "--screen");
  const flagMic = hasFlag(args, "--mic");
  const flagCameraFrames = hasFlag(args, "--camera-frames");
  const flagProcess = hasFlag(args, "--process");
  const anyExplicitMonitors = flagInput || flagScreen || flagMic || flagCameraFrames || flagProcess;

  if (flagInput) {
    overrides.inputMonitoring = { enabled: true };
  }

  if (flagScreen) {
    overrides.screenMonitoring = { enabled: true };
  }

  const screenInterval = getArgValue(args, "--screen-interval");
  if (screenInterval) {
    overrides.screenMonitoring = overrides.screenMonitoring || {};
    overrides.screenMonitoring.intervalMs = Number(screenInterval);
  }

  if (flagMic) {
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

  if (flagCameraFrames) {
    overrides.cameraFrameMonitoring = { enabled: true };
  }

  if (flagProcess) {
    overrides.processMonitoring = { enabled: true };
  }

  if (!anyExplicitMonitors) {
    overrides.inputMonitoring = { enabled: true };
    overrides.screenMonitoring = { enabled: true };
    overrides.micMonitoring = { enabled: true };
    overrides.cameraFrameMonitoring = { enabled: true };
    overrides.processMonitoring = { enabled: true };
  }

  const camFrameInterval = getArgValue(args, "--camera-frames-interval");
  if (camFrameInterval) {
    overrides.cameraFrameMonitoring = overrides.cameraFrameMonitoring || {};
    overrides.cameraFrameMonitoring.intervalMs = Number(camFrameInterval);
  }

  const processInterval = getArgValue(args, "--process-interval");
  if (processInterval) {
    overrides.processMonitoring = overrides.processMonitoring || {};
    overrides.processMonitoring.intervalMs = Number(processInterval);
  }

  const noCamera = hasFlag(args, "--no-camera");
  const noRtspServer = hasFlag(args, "--no-rtsp-server");

  const config = resolveConfig(overrides);
  const ffmpegPath = resolveFfmpegPath(config);
  const ffmpegAvailable = canExecuteFfmpeg(ffmpegPath);
  config.ffmpegPath = ffmpegPath;

  const rtspServer = await ensureRtspServer({ config, disabled: noRtspServer });

  await registerDevice(config.serverUrl, config.deviceId, token);
  console.log("Device registered:", config.deviceId);

  const heartbeatTimer = setInterval(() => {
    sendHeartbeat(config.serverUrl, config.deviceId, token).catch(() => {
      // Best-effort heartbeat only.
    });
  }, 5000);

  const cameraStreamEnabled = !noCamera && ffmpegAvailable;
  let cameraProc = null;
  if (cameraStreamEnabled) {
    cameraProc = startCamera(config);
  } else {
    if (noCamera) {
      console.log("Camera capture disabled (--no-camera).");
    } else {
      console.warn("FFmpeg not found. Camera stream disabled.");
    }
  }

  const micConfigured = Boolean(config.micMonitoring && config.micMonitoring.enabled);
  const micEnabled = micConfigured && ffmpegAvailable;
  if (micConfigured && !ffmpegAvailable) {
    console.warn("FFmpeg not found. Microphone recording disabled.");
  }

  const cameraFramesConfigured = Boolean(config.cameraFrameMonitoring && config.cameraFrameMonitoring.enabled);
  const cameraFramesEnabled = cameraFramesConfigured && ffmpegAvailable;
  if (cameraFramesConfigured && !ffmpegAvailable) {
    console.warn("FFmpeg not found. Camera frame capture disabled.");
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
    enabled: micEnabled,
    segmentSeconds: config.micMonitoring && config.micMonitoring.segmentSeconds,
    format: config.micMonitoring && config.micMonitoring.format,
    input: config.micMonitoring && config.micMonitoring.input,
    bitrate: config.micMonitoring && config.micMonitoring.bitrate,
    ffmpegPath: ffmpegPath
  });
  const cameraFrameMonitor = startCameraFrameMonitor({
    deviceId: config.deviceId,
    serverUrl: config.serverUrl,
    token,
    enabled: cameraFramesEnabled,
    intervalMs: config.cameraFrameMonitoring && config.cameraFrameMonitoring.intervalMs,
    format: config.camera && config.camera.format,
    input: config.camera && config.camera.input,
    fps: config.camera && config.camera.fps,
    resolution: config.camera && config.camera.resolution,
    ffmpegPath: ffmpegPath
  });
  const processMonitor = startProcessMonitor({
    deviceId: config.deviceId,
    serverUrl: config.serverUrl,
    token,
    enabled: config.processMonitoring && config.processMonitoring.enabled,
    intervalMs: config.processMonitoring && config.processMonitoring.intervalMs
  });
  const enabledFlags = {
    input: Boolean(config.inputMonitoring && config.inputMonitoring.enabled),
    screen: Boolean(config.screenMonitoring && config.screenMonitoring.enabled),
    mic: micEnabled,
    cameraFrames: cameraFramesEnabled,
    process: Boolean(config.processMonitoring && config.processMonitoring.enabled),
    cameraStream: cameraStreamEnabled
  };
  console.log("Agent started with monitors:", enabledFlags);
  if (!enabledFlags.input && !enabledFlags.screen && !enabledFlags.mic && !enabledFlags.cameraFrames && !enabledFlags.cameraStream) {
    console.log("Warning: no monitors enabled. Use --screen/--input/--mic/--camera-frames or --no-camera.");
  }

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
      processMonitor && processMonitor.stop && processMonitor.stop();
      if (cameraProc && cameraProc.kill) cameraProc.kill();
      if (rtspServer && rtspServer.stop) rtspServer.stop();
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
