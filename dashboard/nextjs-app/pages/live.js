import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLang, t } from "../lib/i18n";

const SERVER_URL = "http://localhost:3000";

export default function Live() {
  const { lang, setLang } = useLang();
  const [devices, setDevices] = useState([]);
  const [inputEvents, setInputEvents] = useState([]);
  const [audioSegments, setAudioSegments] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [cameraOk, setCameraOk] = useState({});
  const [screenOk, setScreenOk] = useState({});
  const [tick, setTick] = useState(0);

  const userNames = {
    "cam-001": "Monitored User"
  };

  useEffect(() => {
    fetch(`${SERVER_URL}/devices`)
      .then((res) => res.json())
      .then((data) => setDevices(data.devices || []))
      .catch(() => setDevices([]));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInputs() {
      try {
        const res = await fetch(`${SERVER_URL}/input/events`);
        const data = await res.json();
        if (active) setInputEvents(data.events || []);
      } catch (err) {
        if (active) setInputEvents([]);
      }
    }

    async function loadAudio() {
      try {
        const res = await fetch(`${SERVER_URL}/audio/list`);
        const data = await res.json();
        if (active) setAudioSegments(data.segments || []);
      } catch (err) {
        if (active) setAudioSegments([]);
      }
    }

    loadInputs();
    loadAudio();

    const timer = setInterval(() => {
      loadInputs();
      loadAudio();
    }, 3000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  function summarize(events) {
    if (events.length === 0) return "No data";
    const last = events[events.length - 1];
    const time = last.timestamp ? new Date(last.timestamp).toLocaleString() : "unknown";
    const count = events.length;
    return `${count} events · last ${time}`;
  }

  function buildBuckets(events, bucketMs = 10000, windowMs = 10 * 60 * 1000) {
    const now = Date.now();
    const start = now - windowMs;
    const buckets = new Map();
    for (const evt of events) {
      const ts = evt.timestamp ? new Date(evt.timestamp).getTime() : 0;
      if (ts < start) continue;
      const bucket = Math.floor(ts / bucketMs) * bucketMs;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-60);
  }

  function MiniChart({ events }) {
    const buckets = buildBuckets(events);
    if (buckets.length === 0) return <div className="chart-empty">No chart data</div>;
    const max = Math.max(...buckets.map((b) => b[1]), 1);
    return (
      <div className="chart">
        {buckets.map(([ts, value]) => (
          <div key={ts} className="bar">
            <span style={{ height: `${Math.max(10, (value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
    );
  }

  function toggleExpanded(deviceId, type) {
    setExpanded((prev) => ({
      ...prev,
      [deviceId]: prev[deviceId] === type ? null : type
    }));
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
          (evt) => evt.type === "keyboard" && evt.deviceId === device.id
        );
        const mouseEvents = inputEvents.filter(
          (evt) => evt.type === "mouse" && evt.deviceId === device.id
        );
        const audioForDevice = audioSegments.filter((seg) => seg.deviceId === device.id);

        const cameraKey = device.id;

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
              <div className="status-pill">{device.lastSeen ? t(lang, "在线", "Online") : t(lang, "离线", "Offline")}</div>
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
                    alt="Screen Stream"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 16,
                      display: screenOk[device.id] === false ? "none" : "block"
                    }}
                    onLoad={() =>
                      setScreenOk((prev) => ({
                        ...prev,
                        [device.id]: true
                      }))
                    }
                    onError={() =>
                      setScreenOk((prev) => ({
                        ...prev,
                        [device.id]: false
                      }))
                    }
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-title">
                  <h3>{t(lang, "摄像头", "Camera")}</h3>
                  <span className="mono">/camera/latest</span>
                </div>
                <div className="video-frame" style={{ padding: 0 }}>
                  {cameraOk[cameraKey] === false && (
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
                    alt="Camera Stream"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 16,
                      display: cameraOk[cameraKey] === false ? "none" : "block"
                    }}
                    onLoad={() =>
                      setCameraOk((prev) => ({
                        ...prev,
                        [cameraKey]: true
                      }))
                    }
                    onError={() =>
                      setCameraOk((prev) => ({
                        ...prev,
                        [cameraKey]: false
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="input-grid">
              <button className="input-row" type="button" onClick={() => toggleExpanded(device.id, "keyboard")}>
                <div>
                  <strong>{t(lang, "键盘", "Keyboard")}</strong>
                  <div className="mono">
                    {keyboardEvents.length === 0 ? t(lang, "无数据", "No data") : summarize(keyboardEvents)}
                  </div>
                </div>
                <span className="mono">
                  {expanded[device.id] === "keyboard" ? t(lang, "收起", "Hide") : t(lang, "详情", "Details")}
                </span>
              </button>

              {expanded[device.id] === "keyboard" && (
                <div className="input-detail">
                  <MiniChart events={keyboardEvents} />
                </div>
              )}

              <button className="input-row" type="button" onClick={() => toggleExpanded(device.id, "mouse")}>
                <div>
                  <strong>{t(lang, "鼠标", "Mouse")}</strong>
                  <div className="mono">{mouseEvents.length === 0 ? t(lang, "无数据", "No data") : summarize(mouseEvents)}</div>
                </div>
                <span className="mono">
                  {expanded[device.id] === "mouse" ? t(lang, "收起", "Hide") : t(lang, "详情", "Details")}
                </span>
              </button>

              {expanded[device.id] === "mouse" && (
                <div className="input-detail">
                  <MiniChart events={mouseEvents} />
                </div>
              )}

              <button className="input-row" type="button" onClick={() => toggleExpanded(device.id, "audio")}>
                <div>
                  <strong>{t(lang, "语音", "Audio")}</strong>
                  <div className="mono">
                    {audioForDevice.length > 0
                      ? t(
                          lang,
                          `${audioForDevice.length} 段 · 最近 ${new Date(
                            audioForDevice[audioForDevice.length - 1].timestamp
                          ).toLocaleString()}`,
                          `${audioForDevice.length} segments · last ${new Date(
                            audioForDevice[audioForDevice.length - 1].timestamp
                          ).toLocaleString()}`
                        )
                      : t(lang, "无数据", "No data")}
                  </div>
                </div>
                <span className="mono">
                  {expanded[device.id] === "audio" ? t(lang, "收起", "Hide") : t(lang, "详情", "Details")}
                </span>
              </button>

              {expanded[device.id] === "audio" && (
                <div className="input-detail">
                  <MiniChart events={audioForDevice} />
                </div>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
