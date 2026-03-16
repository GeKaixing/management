#!/usr/bin/env node

const { resolveConfig } = require("./config");
const { startCamera } = require("./camera");
const { startInputMonitor } = require("./inputMonitor");

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

  const config = resolveConfig(overrides);

  await registerDevice(config.serverUrl, config.deviceId, token);
  console.log("Device registered:", config.deviceId);

  startCamera(config);
  startInputMonitor({
    deviceId: config.deviceId,
    serverUrl: config.serverUrl,
    token,
    enabled: config.inputMonitoring && config.inputMonitoring.enabled
  });
  console.log("Camera streaming started.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
