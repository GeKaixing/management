const path = require("path");

const defaultConfig = {
  deviceId: "cam-001",
  serverUrl: "http://localhost:3000",
  stream: {
    protocol: "rtsp",
    url: "rtsp://localhost:8554/live/{deviceId}"
  },
  camera: {
    format: "dshow",
    input: "video=Integrated Camera",
    fps: 30,
    resolution: "1280x720"
  },
  inputMonitoring: {
    enabled: false
  }
};

function resolveConfig(overrides = {}) {
  const config = {
    ...defaultConfig,
    ...overrides,
    stream: {
      ...defaultConfig.stream,
      ...(overrides.stream || {})
    },
    camera: {
      ...defaultConfig.camera,
      ...(overrides.camera || {})
    }
  };

  if (process.env.DEVICE_ID) config.deviceId = process.env.DEVICE_ID;
  if (process.env.SERVER_URL) config.serverUrl = process.env.SERVER_URL;

  if (config.stream && typeof config.stream.url === "string") {
    config.stream.url = config.stream.url.replace("{deviceId}", config.deviceId);
  }

  return config;
}

module.exports = {
  defaultConfig,
  resolveConfig
};
