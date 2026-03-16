const { spawn } = require("child_process");
const { getDefaultCameraConfig } = require("./cameraDefaults");
const { resolveFfmpegBin } = require("../utils/ffmpeg");

function captureFrame({ format, input, resolution, fps, ffmpegPath }) {
  return new Promise((resolve, reject) => {
    const frameRate = String(fps || 30);
    const size = resolution || "1280x720";
    let args;
    if (format === "avfoundation") {
      args = [
        "-f",
        format,
        "-framerate",
        frameRate,
        "-video_size",
        size,
        "-i",
        input,
        "-vframes",
        "1",
        "-q:v",
        "4",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-"
      ];
    } else {
      args = [
        "-f",
        format,
        "-i",
        input,
        "-vframes",
        "1",
        "-q:v",
        "4",
        "-s",
        size,
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-"
      ];
    }

    const ffmpegBin = ffmpegPath || resolveFfmpegBin();
    const ffmpeg = spawn(ffmpegBin, args, { stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];

    ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}`));
      resolve(Buffer.concat(chunks));
    });
  });
}

function startCameraFrameMonitor({
  deviceId,
  serverUrl,
  token,
  enabled,
  intervalMs = 1000,
  format,
  input,
  fps,
  resolution,
  ffmpegPath
}) {
  if (!enabled) return { stop: () => {} };

  const defaults = getDefaultCameraConfig();
  const camFormat = format || defaults.format;
  const camInput = input || defaults.input;

  let timer = null;
  let inFlight = false;

  async function sendFrame() {
    if (inFlight) return;
    inFlight = true;
    try {
      const buffer = await captureFrame({
        format: camFormat,
        input: camInput,
        resolution,
        fps,
        ffmpegPath
      });
      const headers = { "Content-Type": "application/json" };
      if (token) headers["x-device-token"] = token;

      await fetch(`${serverUrl}/camera/frame`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          deviceId,
          frameBase64: buffer.toString("base64"),
          timestamp: new Date().toISOString()
        })
      });
    } catch (err) {
      // Best-effort.
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
  startCameraFrameMonitor
};
