const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { verifyDevice } = require("./auth");
const { createEventEngine } = require("../events/eventEngine");
const { createPipeline } = require("../stream/pipeline");
const { loadEvents, getEvent } = require("../storage/db");
const { loadInputEvents, appendInputEvent, filterInputEvents } = require("../storage/inputDb");
const { appendAudioEvent, filterAudioEvents } = require("../storage/audioDb");
const { ensureStorage, getStoragePaths } = require("../storage/files");
const { loadSettings, updateSettings } = require("../storage/settingsDb");
const { addOnlineDuration, getOnlineDuration, toDateKey, startOfDay } = require("../storage/onlineDb");

const screenFrames = new Map();
const cameraFrames = new Map();
const router = express.Router();
const devices = new Map();

const eventEngine = createEventEngine();
const pipeline = createPipeline({ eventEngine, fps: 30, seconds: 10 });
const OFFLINE_TIMEOUT_MS = Number(process.env.DEVICE_OFFLINE_MS || 15000);
const OFFLINE_CHECK_INTERVAL_MS = Number(process.env.DEVICE_OFFLINE_CHECK_MS || 5000);
const LAZE_SCREEN_WINDOW_MS = Number(process.env.LAZE_SCREEN_WINDOW_MS || 10 * 60 * 1000);
const LAZE_BUCKET_MS = Number(process.env.LAZE_BUCKET_MS || 10 * 60 * 1000);
const LAZE_WINDOW_MS = Number(process.env.LAZE_WINDOW_MS || 6 * 60 * 60 * 1000);

function hashBuffer(buffer) {
  if (!buffer || buffer.length === 0) return null;
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function getInputBuckets(events, deviceId, type, nowMs) {
  const start = nowMs - LAZE_WINDOW_MS;
  const buckets = new Map();
  for (const evt of events) {
    if (evt.deviceId !== deviceId || evt.type !== type) continue;
    const ts = evt.timestamp ? new Date(evt.timestamp).getTime() : 0;
    if (!ts || ts < start || ts > nowMs) continue;
    const bucket = Math.floor(ts / LAZE_BUCKET_MS) * LAZE_BUCKET_MS;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }
  return buckets;
}

function isInputLaze(events, deviceId, type, nowMs) {
  const buckets = getInputBuckets(events, deviceId, type, nowMs);
  if (buckets.size === 0) return false;
  const currentBucket = Math.floor(nowMs / LAZE_BUCKET_MS) * LAZE_BUCKET_MS;
  const currentCount = buckets.get(currentBucket) || 0;
  let sum = 0;
  let count = 0;
  for (const [bucket, value] of buckets.entries()) {
    if (bucket >= currentBucket) continue;
    sum += value;
    count += 1;
  }
  if (count === 0) return false;
  const avg = sum / count;
  if (avg <= 0) return false;
  return currentCount < avg;
}

function isScreenLaze(deviceId, nowMs) {
  const screen = screenFrames.get(deviceId);
  if (!screen || !screen.sameSinceMs) return false;
  return nowMs - screen.sameSinceMs >= LAZE_SCREEN_WINDOW_MS;
}

function computeDeviceLaze(deviceId, events, nowMs) {
  const screenLaze = isScreenLaze(deviceId, nowMs);
  const keyboardLaze = isInputLaze(events, deviceId, "keyboard", nowMs);
  const mouseLaze = isInputLaze(events, deviceId, "mouse", nowMs);
  return screenLaze || keyboardLaze || mouseLaze;
}

function touchDevice(id, source) {
  const device = devices.get(id) || { id };
  const now = Date.now();
  if (device.status !== "online") {
    device.onlineSince = now;
  } else if (!device.onlineSince) {
    device.onlineSince = now;
  }
  device.lastSeen = now;
  device.status = "online";
  if (source) device.source = source;
  device.offlineAt = null;
  device.offlineReason = null;
  devices.set(id, device);
  return device;
}

function markDeviceOffline(id, reason) {
  const device = devices.get(id) || { id };
  if (device.status === "offline") return { device, changed: false };
  const now = Date.now();
  if (device.onlineSince) {
    addOnlineDuration(id, device.onlineSince, now);
  }
  device.onlineSince = null;
  device.status = "offline";
  device.offlineAt = new Date().toISOString();
  device.offlineReason = reason || "unknown";
  devices.set(id, device);
  return { device, changed: true };
}

async function persistDeviceData(deviceId, reason) {
  const device = devices.get(deviceId) || { id: deviceId };
  const screen = screenFrames.get(deviceId) || null;
  const camera = cameraFrames.get(deviceId) || null;
  const frames = pipeline.getFrames(deviceId);
  const lastFrame = frames.length > 0 ? frames[frames.length - 1] : null;
  const fps = lastFrame && lastFrame.meta && lastFrame.meta.fps ? Number(lastFrame.meta.fps) : null;

  await eventEngine.handleDeviceOffline({
    deviceId,
    screenBuffer: screen && screen.buffer,
    cameraBuffer: camera && camera.buffer,
    frames,
    meta: {
      reason: reason || "unknown",
      lastSeen: device.lastSeen ? new Date(device.lastSeen).toISOString() : null,
      offlineAt: new Date().toISOString(),
      screenTimestamp: screen && screen.timestamp,
      cameraTimestamp: camera && camera.timestamp,
      fps
    }
  });

  pipeline.clearFrames(deviceId);
}

setInterval(() => {
  const now = Date.now();
  for (const device of devices.values()) {
    if (device.status === "offline") continue;
    if (!device.lastSeen) continue;
    if (now - device.lastSeen > OFFLINE_TIMEOUT_MS) {
      const { changed } = markDeviceOffline(device.id, "timeout");
      if (changed) {
        persistDeviceData(device.id, "timeout").catch((err) => {
          console.error("Failed to persist offline device data:", err);
        });
      }
    }
  }
}, OFFLINE_CHECK_INTERVAL_MS);

router.post("/device/register", verifyDevice, (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: "missing device id" });

  touchDevice(id, "register");
  return res.json({ ok: true, id });
});

router.get("/devices", (req, res) => {
  const nowMs = Date.now();
  const settings = loadSettings();
  const requiredHours = Number(settings.workHoursPerDay || 8);
  const requiredMs = Math.max(requiredHours, 0) * 60 * 60 * 1000;
  const todayKey = toDateKey(nowMs);
  const todayStart = startOfDay(nowMs);
  const inputEvents = loadInputEvents();
  const list = Array.from(devices.values()).map((device) => {
    const baseMs = getOnlineDuration(device.id, todayKey);
    const currentMs = device.onlineSince ? Math.max(0, nowMs - Math.max(device.onlineSince, todayStart)) : 0;
    const onlineMsToday = baseMs + currentMs;
    return {
      ...device,
      laze: computeDeviceLaze(device.id, inputEvents, nowMs),
      onlineMsToday,
      workHoursPerDay: requiredHours,
      lazyByWorkHours: requiredMs > 0 ? onlineMsToday < requiredMs : false
    };
  });
  res.json({ devices: list });
});

router.post("/device/offline", verifyDevice, async (req, res) => {
  const deviceId = req.body && req.body.deviceId;
  const reason = (req.body && req.body.reason) || "client";
  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });

  const { changed } = markDeviceOffline(deviceId, reason);
  if (changed) {
    try {
      await persistDeviceData(deviceId, reason);
    } catch (err) {
      return res.status(500).json({ error: "failed to persist device data" });
    }
  }

  res.json({ ok: true });
});

router.post("/stream/frame", verifyDevice, async (req, res) => {
  const deviceId = req.body && req.body.deviceId;
  const frameBase64 = req.body && req.body.frameBase64;
  const meta = (req.body && req.body.meta) || {};

  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });

  const frameBuffer = frameBase64 ? Buffer.from(frameBase64, "base64") : Buffer.alloc(0);
  await pipeline.ingestFrame({ deviceId, frameBuffer, meta });

  touchDevice(deviceId, "stream");

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
  touchDevice(body.deviceId, "input");
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
  const timestampMs = body.timestamp ? new Date(body.timestamp).getTime() : Date.now();
  const timestamp = new Date(timestampMs).toISOString();
  const hash = hashBuffer(buffer);
  const prev = screenFrames.get(body.deviceId);
  const sameSinceMs =
    prev && prev.hash && prev.hash === hash
      ? prev.sameSinceMs || prev.timestampMs || timestampMs
      : timestampMs;
  screenFrames.set(body.deviceId, {
    buffer,
    timestamp,
    timestampMs,
    hash,
    sameSinceMs
  });
  touchDevice(body.deviceId, "screen");
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

router.post("/camera/frame", verifyDevice, (req, res) => {
  const body = req.body || {};
  if (!body.deviceId) return res.status(400).json({ error: "missing deviceId" });
  if (!body.frameBase64) return res.status(400).json({ error: "missing frameBase64" });

  const buffer = Buffer.from(body.frameBase64, "base64");
  cameraFrames.set(body.deviceId, { buffer, timestamp: body.timestamp || new Date().toISOString() });
  touchDevice(body.deviceId, "camera");
  res.json({ ok: true });
});

router.get("/camera/latest", (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });
  const record = cameraFrames.get(deviceId);
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
  touchDevice(body.deviceId, "audio");
  res.json({ ok: true });
});

router.get("/audio/list", (req, res) => {
  const deviceId = req.query.deviceId || null;
  res.json({ segments: filterAudioEvents({ deviceId }) });
});

router.get("/settings/work-hours", (req, res) => {
  const settings = loadSettings();
  res.json({ workHoursPerDay: Number(settings.workHoursPerDay || 8) });
});

router.post("/settings/work-hours", (req, res) => {
  const body = req.body || {};
  const hours = Number(body.workHoursPerDay);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return res.status(400).json({ error: "invalid workHoursPerDay" });
  }
  const next = updateSettings({ workHoursPerDay: hours });
  return res.json({ ok: true, workHoursPerDay: next.workHoursPerDay });
});

module.exports = router;
