const { randomUUID } = require("crypto");
const { saveSnapshot } = require("../recorder/snapshot");
const { saveVideoClip } = require("../recorder/videoRecorder");
const { appendEvent } = require("../storage/db");
const { notify } = require("./alert");

function createEventEngine() {
  async function handleFall({ deviceId, frame, frames, meta }) {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const snapshotPath = saveSnapshot(frame, { eventId: id });
    const videoPath = saveVideoClip(frames, { eventId: id, fps: meta && meta.fps });

    const event = {
      id,
      timestamp,
      deviceId,
      type: "fall",
      snapshot: snapshotPath,
      video: videoPath,
      meta: meta || {}
    };

    appendEvent(event);
    notify(event);

    return event;
  }

  async function handleDeviceOffline({ deviceId, screenBuffer, cameraBuffer, frames, meta }) {
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const screenSnapshot = screenBuffer
      ? saveSnapshot(screenBuffer, { eventId: `${id}-screen` })
      : null;
    const cameraSnapshot = cameraBuffer
      ? saveSnapshot(cameraBuffer, { eventId: `${id}-camera` })
      : null;

    const videoPath = frames && frames.length > 0 ? saveVideoClip(frames, { eventId: `${id}-stream`, fps: meta && meta.fps }) : null;

    const event = {
      id,
      timestamp,
      deviceId,
      type: "device_offline",
      screenSnapshot,
      cameraSnapshot,
      video: videoPath,
      meta: meta || {}
    };

    appendEvent(event);
    notify(event);

    return event;
  }

  return {
    handleFall,
    handleDeviceOffline
  };
}

module.exports = {
  createEventEngine
};
