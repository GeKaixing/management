const { spawn } = require("child_process");
const { getDefaultCameraConfig } = require("./cameraDefaults");
const { resolveFfmpegBin } = require("../utils/ffmpeg");

function buildFfmpegArgs(config) {
  const camera = config.camera || {};
  const stream = config.stream || {};

  if (stream.protocol !== "rtsp") {
    throw new Error("Only RTSP is implemented in the agent skeleton.");
  }

  const defaults = getDefaultCameraConfig();
  const format = camera.format || defaults.format;
  const input = camera.input || defaults.input;

  const fps = String(camera.fps || 30);
  const resolution = camera.resolution || "1280x720";

  let args;
  if (format === "avfoundation") {
    args = [
      "-f",
      format,
      "-framerate",
      fps,
      "-video_size",
      resolution,
      "-i",
      input,
      "-vcodec",
      "libx264",
      "-f",
      "rtsp",
      stream.url
    ];
  } else {
    args = [
      "-f",
      format,
      "-i",
      input,
      "-r",
      fps,
      "-s",
      resolution,
      "-vcodec",
      "libx264",
      "-f",
      "rtsp",
      stream.url
    ];
  }

  return args;
}

function startStream(config) {
  const args = buildFfmpegArgs(config);
  const ffmpegBin = (config && config.ffmpegPath) || resolveFfmpegBin();
  const ffmpeg = spawn(ffmpegBin, args, { stdio: "inherit" });

  ffmpeg.on("exit", (code) => {
    if (code !== 0) {
      console.error("ffmpeg exited with code", code);
    }
  });
  ffmpeg.on("error", (err) => {
    console.error("ffmpeg failed to start", err && err.message ? err.message : err);
  });

  return ffmpeg;
}

module.exports = {
  startStream
};
