const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { resolveFfmpegBin } = require("../utils/ffmpeg");
const { ensureStorage, getStoragePaths } = require("../storage/files");

function saveVideoClip(frames, opts = {}) {
  ensureStorage();
  const paths = getStoragePaths();
  const eventId = opts.eventId || `event-${Date.now()}`;
  const outputPath = path.join(paths.recordings, `${eventId}.mp4`);

  if (!frames || frames.length === 0) {
    fs.writeFileSync(outputPath, "");
    return outputPath;
  }

  const tmpDir = path.join(paths.tmp, eventId);
  fs.mkdirSync(tmpDir, { recursive: true });

  let frameCount = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (!frame || !frame.buffer) continue;
    const name = `frame${String(frameCount).padStart(6, "0")}.jpg`;
    fs.writeFileSync(path.join(tmpDir, name), frame.buffer);
    frameCount += 1;
  }

  if (frameCount === 0) {
    fs.writeFileSync(outputPath, "");
    return outputPath;
  }

  const fps = Number(opts.fps || 30);
  const inputPattern = path.join(tmpDir, "frame%06d.jpg");

  const ffmpegBin = resolveFfmpegBin();
  const result = spawnSync(
    ffmpegBin,
    [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      inputPattern,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      outputPath
    ],
    { stdio: "ignore" }
  );

  if (result.error) {
    fs.writeFileSync(outputPath, "");
  }

  return outputPath;
}

module.exports = {
  saveVideoClip
};
