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

  return {
    handleFall
  };
}

module.exports = {
  createEventEngine
};