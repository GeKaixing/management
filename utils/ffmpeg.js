function resolveFfmpegBin() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  try {
    // ffmpeg-static returns absolute binary path.
    // eslint-disable-next-line global-require
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) return ffmpegStatic;
  } catch {
    // ignore
  }

  return "ffmpeg";
}

module.exports = {
  resolveFfmpegBin
};
