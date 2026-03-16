const express = require("express");
const fs = require("fs");
const path = require("path");
const { verifyDevice } = require("./auth");
const { createEventEngine } = require("../events/eventEngine");
const { createPipeline } = require("../stream/pipeline");
const { loadEvents, getEvent } = require("../storage/db");
const { appendInputEvent, filterInputEvents } = require("../storage/inputDb");
const { appendAudioEvent, filterAudioEvents } = require("../storage/audioDb");
const { ensureStorage, getStoragePaths } = require("../storage/files");

const screenFrames = new Map();
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

router.post("/screen/frame", verifyDevice, (req, res) => {
  const body = req.body || {};
  if (!body.deviceId) return res.status(400).json({ error: "missing deviceId" });
  if (!body.frameBase64) return res.status(400).json({ error: "missing frameBase64" });

  const buffer = Buffer.from(body.frameBase64, "base64");
  screenFrames.set(body.deviceId, { buffer, timestamp: body.timestamp || new Date().toISOString() });
  res.json({ ok: true });
});

router.get("/screen/latest", (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });
  const record = screenFrames.get(deviceId);
  if (!record) return res.status(404).json({ error: "not found" });

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "no-store");
  res.end(record.buffer);
});

router.post("/audio/segment", verifyDevice, (req, res) => {
  const body = req.body || {};
  if (!body.deviceId) return res.status(400).json({ error: "missing deviceId" });
  if (!body.dataBase64) return res.status(400).json({ error: "missing dataBase64" });

  ensureStorage();
  const paths = getStoragePaths();
  const filename = body.filename || `${Date.now()}.ogg`;
  const filePath = path.join(paths.audio, filename);
  const buffer = Buffer.from(body.dataBase64, "base64");
  fs.writeFileSync(filePath, buffer);

  const event = {
    deviceId: body.deviceId,
    file: filePath,
    timestamp: body.timestamp || new Date().toISOString()
  };
  appendAudioEvent(event);
  res.json({ ok: true });
});

router.get("/audio/list", (req, res) => {
  const deviceId = req.query.deviceId || null;
  res.json({ segments: filterAudioEvents({ deviceId }) });
});

module.exports = router;
