const { RingBuffer } = require("../recorder/ringBuffer");
const { detectFall } = require("../ai/fallDetector");

function createPipeline({ eventEngine, fps = 30, seconds = 10 }) {
  const maxFrames = fps * seconds;
  const buffers = new Map();

  function getBuffer(deviceId) {
    if (!buffers.has(deviceId)) {
      buffers.set(deviceId, new RingBuffer(maxFrames));
    }
    return buffers.get(deviceId);
  }

  async function ingestFrame({ deviceId, frameBuffer, meta = {} }) {
    const buffer = getBuffer(deviceId);
    buffer.push({ buffer: frameBuffer, ts: Date.now(), meta });

    if (detectFall(meta)) {
      await eventEngine.handleFall({
        deviceId,
        frame: frameBuffer,
        frames: buffer.getFrames(),
        meta
      });
    }
  }

  return {
    ingestFrame
  };
}

module.exports = {
  createPipeline
};