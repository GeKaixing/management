const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { verifyDevice } = require("./auth");
const controlPlaneRouter = require("./controlPlane/router");
const { createEventEngine } = require("../events/eventEngine");
const { createPipeline } = require("../stream/pipeline");
const { loadEvents, getEvent } = require("../storage/db");
const { loadInputEvents, appendInputEvent, filterInputEvents } = require("../storage/inputDb");
const { appendAudioEvent, filterAudioEvents } = require("../storage/audioDb");
const { appendProcessSnapshot, getLatestProcessSnapshot, getLatestProcessSnapshots } = require("../storage/processDb");
const { ensureStorage, getStoragePaths } = require("../storage/files");
const { loadSettings, updateSettings } = require("../storage/settingsDb");
const { loadEmployees, updateEmployee } = require("../storage/employeeDb");
const { loadDeviceMeta, getDeviceMeta, updateDeviceMeta, deleteDeviceMeta } = require("../storage/deviceDb");
const { addOnlineDuration, getOnlineDuration, toDateKey, startOfDay } = require("../storage/onlineDb");

const screenFrames = new Map();
const cameraFrames = new Map();
const visionResults = new Map();
const lastPersonSeen = new Map();
const phoneSeenSince = new Map();
const lastVisionState = new Map();
const detectInFlight = new Set();
const lastDetectAt = new Map();

const DETECT_URL = process.env.DETECT_URL || "http://127.0.0.1:8010/detect";
const DETECT_INTERVAL_MS = Number(process.env.DETECT_INTERVAL_MS || 2000);
const OFF_DUTY_MS = Number(process.env.OFF_DUTY_MS || 60000);
const PHONE_USE_MS = Number(process.env.PHONE_USE_MS || 15000);
const router = express.Router();
const devices = new Map();
router.use("/control", controlPlaneRouter);

const eventEngine = createEventEngine();
const pipeline = createPipeline({ eventEngine, fps: 30, seconds: 10 });
const OFFLINE_TIMEOUT_MS = Number(process.env.DEVICE_OFFLINE_MS || 15000);
const OFFLINE_CHECK_INTERVAL_MS = Number(process.env.DEVICE_OFFLINE_CHECK_MS || 5000);
const LAZE_SCREEN_WINDOW_MS = Number(process.env.LAZE_SCREEN_WINDOW_MS || 10 * 60 * 1000);
const LAZE_BUCKET_MS = Number(process.env.LAZE_BUCKET_MS || 10 * 60 * 1000);
const LAZE_WINDOW_MS = Number(process.env.LAZE_WINDOW_MS || 6 * 60 * 60 * 1000);
const LONG_OFFLINE_MS = Number(process.env.LONG_OFFLINE_MS || 30 * 60 * 1000);
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 8000);
const AI_MODELS = (process.env.GEMINI_MODELS || "gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

function updateEnvFile(filePath, updates) {
  const nextUpdates = updates || {};
  const keys = Object.keys(nextUpdates);
  if (keys.length === 0) return { ok: true, changed: false };

  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const lines = content.split(/\r?\n/);
  const seen = new Set();
  const nextLines = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) return line;
    const key = match[1];
    if (!Object.prototype.hasOwnProperty.call(nextUpdates, key)) return line;
    seen.add(key);
    return `${key}=${nextUpdates[key]}`;
  });

  for (const key of keys) {
    if (!seen.has(key)) {
      nextLines.push(`${key}=${nextUpdates[key]}`);
    }
  }

  const nextContent = nextLines.join("\n").replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(filePath, `${nextContent.trim()}\n`, "utf8");
  return { ok: true, changed: true };
}

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

function buildDeviceList(nowMs) {
  const settings = loadSettings();
  const requiredHours = Number(settings.workHoursPerDay || 8);
  const requiredMs = Math.max(requiredHours, 0) * 60 * 60 * 1000;
  const todayKey = toDateKey(nowMs);
  const todayStart = startOfDay(nowMs);
  const inputEvents = loadInputEvents();
  const deviceMeta = loadDeviceMeta();
  const deviceIds = new Set([
    ...Array.from(devices.keys()),
    ...Object.keys(deviceMeta || {})
  ]);

  return Array.from(deviceIds)
    .map((id) => {
      const meta = deviceMeta[id] || {};
      if (meta.deleted) return null;
      const device = devices.get(id) || { id, status: "offline", lastSeen: null };
      const lastSeen = device.lastSeen || null;
      const isOnlineNow = lastSeen ? nowMs - lastSeen <= OFFLINE_TIMEOUT_MS : false;
      const status = isOnlineNow ? "online" : "offline";
      if (isOnlineNow && !device.onlineSince) {
        device.onlineSince = nowMs;
      }
      const baseMs = getOnlineDuration(id, todayKey);
      const currentMs = device.onlineSince ? Math.max(0, nowMs - Math.max(device.onlineSince, todayStart)) : 0;
      const onlineMsToday = baseMs + currentMs;
      return {
        ...device,
        status,
        name: meta.name || device.name || null,
        note: meta.note || device.note || null,
        laze: computeDeviceLaze(id, inputEvents, nowMs),
        cameraDetect: visionResults.get(id) || null,
        onlineMsToday,
        workHoursPerDay: requiredHours,
        lazyByWorkHours: requiredMs > 0 ? onlineMsToday < requiredMs : false
      };
    })
    .filter(Boolean);
}

function getDetectSettings() {
  const settings = loadSettings();
  const offDutyMs = Number(settings.offDutyMs || OFF_DUTY_MS);
  const phoneUseMs = Number(settings.phoneUseMs || PHONE_USE_MS);
  return {
    offDutyMs: Number.isFinite(offDutyMs) ? offDutyMs : OFF_DUTY_MS,
    phoneUseMs: Number.isFinite(phoneUseMs) ? phoneUseMs : PHONE_USE_MS
  };
}

  async function updateVision(deviceId, data, cameraBuffer) {
  const now = Date.now();
  const { offDutyMs, phoneUseMs } = getDetectSettings();
  const personPresent = Number(data.personCount || 0) > 0;
  const phonePresent = Number(data.phoneCount || 0) > 0;
  if (personPresent) {
    lastPersonSeen.set(deviceId, now);
  }
  if (phonePresent) {
    if (!phoneSeenSince.has(deviceId)) phoneSeenSince.set(deviceId, now);
  } else {
    phoneSeenSince.delete(deviceId);
  }
  const lastSeen = lastPersonSeen.get(deviceId) || null;
  const offDuty = lastSeen ? now - lastSeen >= offDutyMs : !personPresent;
  const phoneSince = phoneSeenSince.get(deviceId);
  const phoneUse = Boolean(phoneSince && now - phoneSince >= phoneUseMs);
  const lazy = phoneUse || offDuty;
  const result = {
    timestamp: new Date(now).toISOString(),
    personPresent,
    phonePresent,
    phoneUse,
    offDuty,
    lazy,
    personCount: Number(data.personCount || 0),
    phoneCount: Number(data.phoneCount || 0),
    boxes: Array.isArray(data.boxes) ? data.boxes : [],
    inferenceMs: Number(data.inferenceMs || 0),
    detectConf: Number(data.conf || 0)
  };
  visionResults.set(deviceId, result);
  const prev = lastVisionState.get(deviceId) || {};
  lastVisionState.set(deviceId, result);
  try {
    if (!prev.lazy && lazy) {
      await eventEngine.handleBehavior({
        deviceId,
        type: "lazy",
        cameraBuffer,
        meta: {
          ...result,
          thresholds: { offDutyMs, phoneUseMs }
        }
      });
    }
  } catch {
    // Ignore event write failures.
  }
  return result;
}

async function runDetect(deviceId, buffer) {
  if (!DETECT_URL) return;
  const now = Date.now();
  const lastAt = lastDetectAt.get(deviceId) || 0;
  if (now - lastAt < DETECT_INTERVAL_MS) return;
  if (detectInFlight.has(deviceId)) return;
  detectInFlight.add(deviceId);
  lastDetectAt.set(deviceId, now);
  try {
    const settings = loadSettings();
    const res = await fetchWithTimeout(
      DETECT_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: buffer.toString("base64"),
          conf: Number(settings.detectConf || 0.25),
          iou: Number(settings.detectIou || 0.45)
        })
      },
      5000
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) await updateVision(deviceId, data, buffer);
  } catch {
    // Ignore detection failures.
  } finally {
    detectInFlight.delete(deviceId);
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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

router.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

router.post("/device/register", verifyDevice, (req, res) => {
  const id = req.body && req.body.id;
  if (!id) return res.status(400).json({ error: "missing device id" });

  touchDevice(id, "register");
  updateDeviceMeta(id, { deleted: false });
  return res.json({ ok: true, id });
});

router.post("/device/heartbeat", verifyDevice, (req, res) => {
  const deviceId = req.body && req.body.deviceId;
  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });
  touchDevice(deviceId, "heartbeat");
  return res.json({ ok: true });
});

router.get("/devices", (req, res) => {
  const list = buildDeviceList(Date.now());
  res.json({ devices: list });
});

router.get("/device/:id", (req, res) => {
  const deviceId = req.params.id;
  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });
  const meta = getDeviceMeta(deviceId) || {};
  if (meta.deleted) return res.status(404).json({ error: "not found" });
  const device = devices.get(deviceId) || { id: deviceId, status: "offline" };
  res.json({
    device: {
      ...device,
      name: meta.name || device.name || null,
      note: meta.note || device.note || null
    }
  });
});

router.put("/device/:id", (req, res) => {
  const deviceId = req.params.id;
  const body = req.body || {};
  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const meta = updateDeviceMeta(deviceId, { name, note, deleted: false });
  const device = devices.get(deviceId) || { id: deviceId };
  res.json({
    ok: true,
    device: {
      ...device,
      name: meta.name || null,
      note: meta.note || null
    }
  });
});

router.delete("/device/:id", (req, res) => {
  const deviceId = req.params.id;
  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });
  deleteDeviceMeta(deviceId);
  devices.delete(deviceId);
  screenFrames.delete(deviceId);
  cameraFrames.delete(deviceId);
  pipeline.clearFrames(deviceId);
  res.json({ ok: true });
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
  const intervalMs = Number(body.intervalMs);
  const fps = Number.isFinite(intervalMs) && intervalMs > 0 ? Math.max(1, Math.round(1000 / intervalMs)) : 2;
  pipeline.ingestFrame({ deviceId: body.deviceId, frameBuffer: buffer, meta: { fps, source: "screen" } }).catch(() => {
    // Best-effort, ignore pipeline errors.
  });
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
  runDetect(body.deviceId, buffer);
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

router.get("/camera/detect/latest", (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId) return res.status(400).json({ error: "missing deviceId" });
  const record = visionResults.get(deviceId);
  if (!record) return res.status(404).json({ error: "not found" });
  res.json({ detection: record });
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

router.post("/process/snapshot", verifyDevice, (req, res) => {
  const body = req.body || {};
  if (!body.deviceId) return res.status(400).json({ error: "missing deviceId" });
  const snapshot = {
    deviceId: body.deviceId,
    total: Number(body.total || 0),
    top: Array.isArray(body.top) ? body.top : [],
    timestamp: body.timestamp || new Date().toISOString()
  };
  appendProcessSnapshot(snapshot);
  touchDevice(body.deviceId, "process");
  res.json({ ok: true });
});

router.get("/process/latest", (req, res) => {
  const deviceId = req.query.deviceId || null;
  if (deviceId) {
    const snapshot = getLatestProcessSnapshot(deviceId);
    if (!snapshot) return res.status(404).json({ error: "not found" });
    return res.json({ snapshot });
  }
  const snapshots = getLatestProcessSnapshots();
  return res.json({ snapshots });
});

router.get("/audio/play", (req, res) => {
  const filePath = req.query.file;
  if (!filePath) return res.status(400).json({ error: "missing file" });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "not found" });
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(filePath);
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

router.get("/settings/live-view", (req, res) => {
  const settings = loadSettings();
  res.json({ hideOfflineMedia: settings.hideOfflineMedia !== false });
});

router.post("/settings/live-view", (req, res) => {
  const body = req.body || {};
  const hideOfflineMedia = body.hideOfflineMedia !== false;
  const next = updateSettings({ hideOfflineMedia });
  return res.json({ ok: true, hideOfflineMedia: next.hideOfflineMedia !== false });
});

router.get("/settings/email-templates", (req, res) => {
  const settings = loadSettings();
  res.json({
    emailTemplateLazy: settings.emailTemplateLazy || "",
    emailTemplateDone: settings.emailTemplateDone || ""
  });
});

router.post("/settings/email-templates", (req, res) => {
  const body = req.body || {};
  const emailTemplateLazy = typeof body.emailTemplateLazy === "string" ? body.emailTemplateLazy.trim() : "";
  const emailTemplateDone = typeof body.emailTemplateDone === "string" ? body.emailTemplateDone.trim() : "";
  const next = updateSettings({ emailTemplateLazy, emailTemplateDone });
  return res.json({
    ok: true,
    emailTemplateLazy: next.emailTemplateLazy || "",
    emailTemplateDone: next.emailTemplateDone || ""
  });
});

router.get("/settings/detect-thresholds", (req, res) => {
  const settings = loadSettings();
  res.json({
    offDutySeconds: Math.round(Number(settings.offDutyMs || OFF_DUTY_MS) / 1000),
    phoneUseSeconds: Math.round(Number(settings.phoneUseMs || PHONE_USE_MS) / 1000)
  });
});

router.post("/settings/detect-thresholds", (req, res) => {
  const body = req.body || {};
  const offDutySeconds = Number(body.offDutySeconds);
  const phoneUseSeconds = Number(body.phoneUseSeconds);
  if (!Number.isFinite(offDutySeconds) || offDutySeconds < 5 || offDutySeconds > 3600) {
    return res.status(400).json({ error: "invalid offDutySeconds" });
  }
  if (!Number.isFinite(phoneUseSeconds) || phoneUseSeconds < 1 || phoneUseSeconds > 3600) {
    return res.status(400).json({ error: "invalid phoneUseSeconds" });
  }
  const next = updateSettings({
    offDutyMs: Math.round(offDutySeconds * 1000),
    phoneUseMs: Math.round(phoneUseSeconds * 1000)
  });
  return res.json({
    ok: true,
    offDutySeconds: Math.round(Number(next.offDutyMs || OFF_DUTY_MS) / 1000),
    phoneUseSeconds: Math.round(Number(next.phoneUseMs || PHONE_USE_MS) / 1000)
  });
});

router.get("/settings/detect-model", (req, res) => {
  const settings = loadSettings();
  res.json({
    detectConf: Number(settings.detectConf || 0.25),
    detectIou: Number(settings.detectIou || 0.45)
  });
});

router.post("/settings/detect-model", (req, res) => {
  const body = req.body || {};
  const detectConf = Number(body.detectConf);
  const detectIou = Number(body.detectIou);
  if (!Number.isFinite(detectConf) || detectConf < 0.05 || detectConf > 0.95) {
    return res.status(400).json({ error: "invalid detectConf" });
  }
  if (!Number.isFinite(detectIou) || detectIou < 0.1 || detectIou > 0.9) {
    return res.status(400).json({ error: "invalid detectIou" });
  }
  const next = updateSettings({ detectConf, detectIou });
  return res.json({ ok: true, detectConf: next.detectConf, detectIou: next.detectIou });
});

router.get("/employees", (req, res) => {
  const employees = loadEmployees();
  return res.json({ employees });
});

router.get("/employees/:id", (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "missing deviceId" });
  const employees = loadEmployees();
  return res.json({ employee: employees[id] || null });
});

router.put("/employees/:id", (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  if (!id) return res.status(400).json({ error: "missing deviceId" });
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const tasksRemaining =
    body.tasksRemaining === null || body.tasksRemaining === undefined
      ? null
      : Number(body.tasksRemaining);
  if (tasksRemaining !== null && (!Number.isFinite(tasksRemaining) || tasksRemaining < 0)) {
    return res.status(400).json({ error: "invalid tasksRemaining" });
  }
  const next = updateEmployee(id, {
    email,
    tasksRemaining
  });
  return res.json({ ok: true, employee: next[id] || null });
});

router.get("/settings/ai", (req, res) => {
  const settings = loadSettings();
  res.json({
    provider: settings.aiProvider || "gemini",
    hasKey: Boolean(settings.geminiApiKey)
  });
});

router.post("/settings/server-url", (req, res) => {
  const body = req.body || {};
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return res.status(400).json({ error: "missing url" });
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "invalid url protocol" });
  }
  try {
    const envPath = path.resolve(__dirname, "..", ".env");
    updateEnvFile(envPath, { SERVER_URL: url, NEXT_PUBLIC_SERVER_URL: url });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Failed to update .env:", err);
    return res.status(500).json({ error: "env_update_failed" });
  }
});

router.post("/settings/ai", (req, res) => {
  const body = req.body || {};
  const provider = typeof body.provider === "string" ? body.provider : "gemini";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) return res.status(400).json({ error: "missing apiKey" });
  const next = updateSettings({ aiProvider: provider, geminiApiKey: apiKey });
  return res.json({ ok: true, provider: next.aiProvider, hasKey: Boolean(next.geminiApiKey) });
});

const { buildReportPayload, buildPrompt, buildFallbackSummary } = require("./aiSummary");

async function generateAiSummary(devicesList) {
  const settings = loadSettings();
  const apiKey = settings.geminiApiKey;
  if (!apiKey) throw new Error("missing_api_key");
  const nowMs = Date.now();
  const payload = buildReportPayload(devicesList, nowMs, LONG_OFFLINE_MS);
  const prompt = buildPrompt(payload);

  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 512 }
  });

  for (const model of AI_MODELS) {
    let response;
    try {
      response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody
        },
        AI_TIMEOUT_MS
      );
    } catch (err) {
      const reason = err && err.name === "AbortError" ? "timeout" : "network_error";
      return { text: buildFallbackSummary(payload), fallback: true, warning: reason };
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || "gemini_error";
      const status = Number(data?.error?.code || response.status || 0);
      if (status === 404 || /not found|not supported/i.test(message)) {
        continue;
      }
      if (status === 429 || /quota exceeded|rate limit|resource_exhausted/i.test(message)) {
        continue;
      }
      return { text: buildFallbackSummary(payload), fallback: true, warning: message };
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { text: buildFallbackSummary(payload), fallback: true, warning: "empty_response" };
    }
    const normalized = String(text).trim();
    const tooShort = normalized.length < 120;
    const lacksDetails = !/员工|设备/.test(normalized);
    if (tooShort || lacksDetails) {
      return {
        text: buildFallbackSummary(payload),
        fallback: true,
        warning: "model_output_too_short"
      };
    }
    return { text: normalized, fallback: false, warning: null };
  }

  return { text: buildFallbackSummary(payload), fallback: true, warning: "no_supported_model" };
}

router.post("/report/ai-summary", async (req, res) => {
  const devicesList = buildDeviceList(Date.now());
  try {
    const result = await generateAiSummary(devicesList);
    res.json({ ok: true, summary: result.text, fallback: result.fallback, warning: result.warning });
  } catch (err) {
    const message = err && err.message ? err.message : "ai_error";
    if (message === "missing_api_key") {
      return res.status(400).json({ error: "ai_key_not_configured" });
    }
    return res.status(500).json({ error: "ai_summary_failed", message });
  }
});

module.exports = router;
