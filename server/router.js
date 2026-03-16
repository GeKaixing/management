const express = require("express");
const { verifyDevice } = require("./auth");
const { createEventEngine } = require("../events/eventEngine");
const { createPipeline } = require("../stream/pipeline");
const { loadEvents, getEvent } = require("../storage/db");
const { appendInputEvent, filterInputEvents } = require("../storage/inputDb");

const router = express.Router();
const devices = new Map();

const eventEngine = createEventEngine();
const pipeline = createPipeline({ eventEngine, fps: 30, seconds: 10 });

router.post("/device/register", verifyDevice, (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: "missing device id" });

  devices.set(id, { id, lastSeen: Date.now() });
  return res.json({ ok: true, id });
});

router.get("/devices", (req, res) => {
  const list = Array.from(devices.values());
  res.json({ devices: list });
});

router.post("/stream/frame", verifyDevice, async (req, res) => {
  const deviceId = req.body && req.body.deviceId;
  const frameBase64 = req.body && req.body.frameBase64;
  const meta = (req.body && req.body.meta) || {};

  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });

  const frameBuffer = frameBase64 ? Buffer.from(frameBase64, "base64") : Buffer.alloc(0);
  await pipeline.ingestFrame({ deviceId, frameBuffer, meta });

  const device = devices.get(deviceId) || { id: deviceId };
  device.lastSeen = Date.now();
  devices.set(deviceId, device);

  res.json({ ok: true });
});

router.post("/events/test", async (req, res) => {
  const deviceId = (req.body && req.body.deviceId) || "test-device";
  const frameBuffer = Buffer.alloc(0);
  const meta = { debugFall: true, fps: 30 };

  const event = await eventEngine.handleFall({
    deviceId,
    frame: frameBuffer,
    frames: [],
    meta
  });

  res.json({ ok: true, event });
});

router.get("/events", (req, res) => {
  res.json({ events: loadEvents() });
});

router.get("/events/:id", (req, res) => {
  const event = getEvent(req.params.id);
  if (!event) return res.status(404).json({ error: "not found" });
  res.json({ event });
});

router.post("/input/event", verifyDevice, (req, res) => {
  const body = req.body || {};
  if (!body.deviceId) return res.status(400).json({ error: "missing deviceId" });
  if (!body.type) return res.status(400).json({ error: "missing type" });

  const event = {
    deviceId: body.deviceId,
    type: body.type,
    action: body.action || null,
    detail: body.detail || {},
    timestamp: body.timestamp || new Date().toISOString()
  };

  appendInputEvent(event);
  res.json({ ok: true });
});

router.get("/input/events", (req, res) => {
  const deviceId = req.query.deviceId || null;
  res.json({ events: filterInputEvents({ deviceId }) });
});

module.exports = router;
