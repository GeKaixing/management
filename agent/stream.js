const os = require("os");
const { spawn } = require("child_process");

function getDefaultCameraConfig() {
  if (os.platform() === "darwin") {
    return {
      format: "avfoundation",
      input: "0"
    };
  }

  return {
    format: "dshow",
    input: "video=Integrated Camera"
  };
}

function buildFfmpegArgs(config) {
  const camera = config.camera || {};
  const stream = config.stream || {};

  if (stream.protocol !== "rtsp") {
    throw new Error("Only RTSP is implemented in the agent skeleton.");
  }

  const defaults = getDefaultCameraConfig();
  const format = camera.format || defaults.format;
  const input = camera.input || defaults.input;

  const args = [
    "-f",
    format,
    "-i",
    input,
    "-r",
    String(camera.fps || 30),
    "-s",
    camera.resolution || "1280x720",
    "-vcodec",
    "libx264",
    "-f",
    "rtsp",
    stream.url
  ];

  return args;
}

function startStream(config) {
  const args = buildFfmpegArgs(config);
  const ffmpeg = spawn("ffmpeg", args, { stdio: "inherit" });

  ffmpeg.on("exit", (code) => {
    if (code !== 0) {
      console.error("ffmpeg exited with code", code);
    }
  });

  return ffmpeg;
}

module.exports = {
  startStream
};