const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { resolveFfmpegBin } = require("../utils/ffmpeg");

function getDefaultMicConfig() {
  const platform = process.platform;
  if (platform === "darwin") {
    return {
      format: "avfoundation",
      input: ":0"
    };
  }

  return {
    format: "dshow",
    input: "audio=Microphone"
  };
}

function startMicRecorder({
  deviceId,
  serverUrl,
  token,
  enabled,
  segmentSeconds = 10,
  format,
  input,
  bitrate = "64k",
  ffmpegPath
}) {
  if (!enabled) return { stop: () => {} };

  const defaults = getDefaultMicConfig();
  const micFormat = format || defaults.format;
  const micInput = input || defaults.input;

  const tmpDir = path.join(process.cwd(), "storage_data", "audio_tmp", deviceId);
  fs.mkdirSync(tmpDir, { recursive: true });

  const outputPattern = path.join(tmpDir, "segment_%05d.ogg");

  const args = [
    "-f",
    micFormat,
    "-i",
    micInput,
    "-c:a",
    "libopus",
    "-b:a",
    bitrate,
    "-f",
    "segment",
    "-segment_time",
    String(segmentSeconds),
    "-reset_timestamps",
    "1",
    outputPattern
  ];

  const ffmpegBin = ffmpegPath || resolveFfmpegBin();
  const ffmpeg = spawn(ffmpegBin, args, { stdio: "ignore" });

  const uploaded = new Set();
  let pollTimer = null;

  async function uploadFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-device-token"] = token;

    await fetch(`${serverUrl}/audio/segment`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        deviceId,
        filename: path.basename(filePath),
        dataBase64: buffer.toString("base64"),
        timestamp: new Date().toISOString()
      })
    });
  }

  async function poll() {
    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".ogg"));
    for (const file of files) {
      const fullPath = path.join(tmpDir, file);
      if (uploaded.has(fullPath)) continue;

      try {
        await uploadFile(fullPath);
        uploaded.add(fullPath);
        fs.unlinkSync(fullPath);
      } catch (err) {
        // Keep file for retry.
      }
    }
  }

  pollTimer = setInterval(poll, Math.max(2000, segmentSeconds * 1000));

  ffmpeg.on("exit", (code) => {
    if (code !== 0) {
      console.error("ffmpeg mic recorder exited", code);
    }
  });
  ffmpeg.on("error", (err) => {
    console.error("ffmpeg mic recorder failed to start", err && err.message ? err.message : err);
  });

  return {
    stop: () => {
      if (pollTimer) clearInterval(pollTimer);
      ffmpeg.kill();
    }
  };
}

module.exports = {
  startMicRecorder
};
