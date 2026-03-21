const { spawnSync } = require("child_process");

function resolveFfmpegBin() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  return "ffmpeg";
}

function canExecuteFfmpeg(binPath) {
  const target = binPath || resolveFfmpegBin();
  try {
    const result = spawnSync(target, ["-version"], { stdio: "ignore" });
    return !result.error;
  } catch {
    return false;
  }
}

module.exports = {
  resolveFfmpegBin,
  canExecuteFfmpeg
};
