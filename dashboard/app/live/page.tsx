"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "../components/DashboardShell";
import { useLang, t } from "../../lib/i18n";
import { safeDateString } from "../../lib/time";
import MiniLineChart from "./MiniLineChart";
import { getServerUrl } from "../../lib/serverUrl";

const SERVER_URL = getServerUrl();

type Device = {
  id: string;
  lastSeen?: number | null;
  status?: string;
  laze?: boolean;
  lazyByWorkHours?: boolean;
  onlineMsToday?: number;
  workHoursPerDay?: number;
  name?: string | null;
  note?: string | null;
  offlineAt?: string | null;
  offlineReason?: string | null;
  source?: string | null;
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

type ProcessSnapshot = {
  deviceId: string;
  total?: number;
  top?: { name: string; count: number }[];
  timestamp?: string;
};

export default function Live() {
  const { lang, setLang } = useLang();
  const [devices, setDevices] = useState<Device[]>([]);
  const [inputEvents, setInputEvents] = useState<InputEvent[]>([]);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [processSnapshots, setProcessSnapshots] = useState<ProcessSnapshot[]>([]);
  const [cameraOk, setCameraOk] = useState<Record<string, boolean>>({});
  const [screenOk, setScreenOk] = useState<Record<string, boolean>>({});
  const [hideOfflineMedia, setHideOfflineMedia] = useState(true);
  const [tick, setTick] = useState(0);
  const [editState, setEditState] = useState<Record<string, { name: string; note: string }>>({});
  const [detailOpen, setDetailOpen] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const userNames: Record<string, string> = {
    "cam-001": "Monitored User"
  };

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      try {
        const res = await fetch(`${SERVER_URL}/devices`);
        const data = await res.json();
        if (active) setDevices(Array.isArray(data.devices) ? data.devices : []);
      } catch {
        if (active) setDevices([]);
      }
    }

    loadDevices();
    const timer = setInterval(loadDevices, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    fetch(`${SERVER_URL}/settings/live-view`)
      .then((res) => res.json())
      .then((data) => {
        setHideOfflineMedia(data.hideOfflineMedia !== false);
      })
      .catch(() => {
        setHideOfflineMedia(true);
      });
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

    async function loadProcesses() {
      try {
        const res = await fetch(`${SERVER_URL}/process/latest`);
        const data = await res.json();
        setProcessSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
      } catch {
        setProcessSnapshots([]);
      }
    }

    loadInputs();
    loadAudio();
    loadProcesses();

    const timer = setInterval(() => {
      loadInputs();
      loadAudio();
      loadProcesses();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setEditState((prev) => {
      const next = { ...prev };
      devices.forEach((device) => {
        if (!next[device.id]) {
          next[device.id] = {
            name: device.name ? String(device.name) : "",
            note: device.note ? String(device.note) : ""
          };
        }
      });
      return next;
    });
  }, [devices]);

  function summarize(events: InputEvent[]) {
    if (events.length === 0) return t(lang, "无数据", "No data");
    const last = events[events.length - 1];
    const time = last.timestamp ? safeDateString(last.timestamp) : "unknown";
    const count = events.length;
    return `${count} events · last ${time}`;
  }

  function formatHours(ms?: number) {
    const safeMs = Number(ms || 0);
    if (!Number.isFinite(safeMs)) return "0.0";
    return (safeMs / (60 * 60 * 1000)).toFixed(1);
  }

  function buildSeries(events: { timestamp?: string }[], bucketMs = 5 * 60 * 1000, windowMs = 6 * 60 * 60 * 1000) {
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

    const maxPoints = Math.min(totalBuckets, Math.floor(windowMs / bucketMs));
    return {
      labels: labels.slice(-maxPoints),
      values: values.slice(-maxPoints)
    };
  }

  async function refreshDevices() {
    try {
      const res = await fetch(`${SERVER_URL}/devices`);
      const data = await res.json();
      setDevices(Array.isArray(data.devices) ? data.devices : []);
    } catch {
      setDevices([]);
    }
  }

  async function saveDevice(deviceId: string) {
    const current = editState[deviceId] || { name: "", note: "" };
    await fetch(`${SERVER_URL}/device/${encodeURIComponent(deviceId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: current.name, note: current.note })
    });
    await refreshDevices();
  }

  async function deleteDevice(deviceId: string) {
    const ok = window.confirm(t(lang, "确定删除该设备？", "Delete this device?"));
    if (!ok) return;
    await fetch(`${SERVER_URL}/device/${encodeURIComponent(deviceId)}`, { method: "DELETE" });
    await refreshDevices();
  }

  const deviceCards = devices.length > 0 ? devices : [{ id: "cam-001", lastSeen: null }];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredDevices = normalizedQuery
    ? deviceCards.filter((device) => {
        const edit = editState[device.id];
        const name = edit?.name || device.name || userNames[device.id] || "";
        return String(name).toLowerCase().includes(normalizedQuery);
      })
    : deviceCards;

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "实时监控", "Live View")}>
      <div className="page-links">
        <Link className="ghost-button" href="/">
          {t(lang, "返回概览", "Back to Overview")}
        </Link>
        <Link className="ghost-button" href="/settings">
          {t(lang, "设置工作时间", "Work Hours Settings")}
        </Link>
        <div className="device-field" style={{ marginLeft: "auto", minWidth: 220 }}>
          <label>{t(lang, "搜索名称", "Search name")}</label>
          <input
            className="device-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t(lang, "输入姓名过滤", "Type to filter")}
          />
        </div>
      </div>
      <div className="device-grid">
        {filteredDevices.map((device) => {
        const isLazy = Boolean(device.laze || device.lazyByWorkHours);
        const isOnline = device.status ? device.status === "online" : Boolean(device.lastSeen);
        const hideMedia = hideOfflineMedia && !isOnline;
        const edit = editState[device.id] || { name: "", note: "" };
        const keyboardEvents = inputEvents.filter(
          (e) => e.type === "keyboard" && e.deviceId === device.id
        );

        const mouseEvents = inputEvents.filter(
          (e) => e.type === "mouse" && e.deviceId === device.id
        );

        const audioForDevice = audioSegments.filter((e) => e.deviceId === device.id);
        const processInfo = processSnapshots.find((p) => p.deviceId === device.id) || null;
        const processKey = `${device.id}-process`;
        const maxProcessCount = processInfo?.top?.reduce((max, item) => Math.max(max, item.count || 0), 0) || 0;

        const keyboardSeries = buildSeries(keyboardEvents, 5 * 60 * 1000, 60 * 60 * 1000);
        const mouseSeries = buildSeries(mouseEvents, 5 * 60 * 1000, 60 * 60 * 1000);

        const onlineHours = formatHours(device.onlineMsToday);
        const requiredHours = device.workHoursPerDay ?? 8;
        const displayName = edit.name || device.name || userNames[device.id] || t(lang, "被监控用户", "Monitored User");
        const lastSeenText = device.lastSeen
          ? safeDateString(new Date(device.lastSeen).toISOString())
          : t(lang, "未知", "unknown");

        return (
          <section key={device.id} className={`device-card${isLazy ? " laze" : ""}`}>
            <div className="device-header">
              <div>
                <h2>{displayName}</h2>
                <div className="mono">
                  {t(lang, "设备 ID：", "Device ID: ")}
                  {device.id}
                </div>
                <div className="mono">
                  {t(
                    lang,
                    `今日在线 ${onlineHours} 小时 / 要求 ${requiredHours} 小时`,
                    `Online today ${onlineHours}h / Required ${requiredHours}h`
                  )}
                </div>
              </div>
              <div className="status-group">
                <div className="status-pill">
                  {isOnline ? t(lang, "在线", "Online") : t(lang, "离线", "Offline")}
                </div>
                {isLazy && <div className="laze-pill">LAZY 😴</div>}
              </div>
            </div>

            <div className="device-actions">
              <div className="device-field">
                <label>{t(lang, "名称", "Name")}</label>
                <input
                  className="device-input"
                  value={edit.name}
                  onChange={(event) =>
                    setEditState((prev) => ({
                      ...prev,
                      [device.id]: { ...edit, name: event.target.value }
                    }))
                  }
                  placeholder={t(lang, "例如：张三", "e.g. Alex")}
                />
              </div>
              <div className="device-field">
                <label>{t(lang, "备注", "Note")}</label>
                <input
                  className="device-input"
                  value={edit.note}
                  onChange={(event) =>
                    setEditState((prev) => ({
                      ...prev,
                      [device.id]: { ...edit, note: event.target.value }
                    }))
                  }
                  placeholder={t(lang, "例如：研发部工位", "e.g. R&D desk")}
                />
              </div>
              <div className="device-buttons">
                <button className="button" type="button" onClick={() => saveDevice(device.id)}>
                  {t(lang, "保存", "Save")}
                </button>
                <button className="danger-button" type="button" onClick={() => deleteDevice(device.id)}>
                  {t(lang, "删除", "Delete")}
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    setDetailOpen((prev) => ({
                      ...prev,
                      [device.id]: !prev[device.id]
                    }))
                  }
                >
                  {detailOpen[device.id] ? t(lang, "收起", "Hide") : t(lang, "查看", "View")}
                </button>
              </div>
            </div>

            {detailOpen[device.id] && (
              <div className="device-detail">
                <div>
                  <strong>{t(lang, "状态", "Status")}:</strong>{" "}
                  {isOnline ? t(lang, "在线", "Online") : t(lang, "离线", "Offline")}
                </div>
                <div>
                  <strong>{t(lang, "最近在线", "Last seen")}:</strong> {lastSeenText}
                </div>
                <div>
                  <strong>{t(lang, "离线原因", "Offline reason")}:</strong>{" "}
                  {device.offlineReason || t(lang, "无", "n/a")}
                </div>
                <div>
                  <strong>{t(lang, "来源", "Source")}:</strong> {device.source || t(lang, "无", "n/a")}
                </div>
                <div>
                  <strong>{t(lang, "离线时间", "Offline at")}:</strong>{" "}
                  {device.offlineAt ? safeDateString(device.offlineAt) : t(lang, "无", "n/a")}
                </div>
              </div>
            )}

            <div className="grid-2">
              <div className="card">
                <div className="card-title">
                  <h3>{t(lang, "屏幕", "Screen")}</h3>
                  <span className="mono">/screen/latest</span>
                </div>
                <div className="video-frame" style={{ padding: 0 }}>
                  {hideMedia && (
                    <div style={{ padding: 16, textAlign: "center" }}>
                      {t(lang, "设备离线", "Device offline")}
                    </div>
                  )}
                  {!hideMedia && screenOk[device.id] === false && (
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
                      display: hideMedia || screenOk[device.id] === false ? "none" : "block"
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
                  {hideMedia && (
                    <div style={{ padding: 16, textAlign: "center" }}>
                      {t(lang, "设备离线", "Device offline")}
                    </div>
                  )}
                  {!hideMedia && cameraOk[device.id] === false && (
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
                      display: hideMedia || cameraOk[device.id] === false ? "none" : "block"
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
                {audioForDevice.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {audioForDevice.slice(-3).map((segment, idx) => (
                      <a
                        key={`${segment.timestamp || "audio"}-${idx}`}
                        className="button"
                        href={`${SERVER_URL}/audio/play?file=${encodeURIComponent(segment.file || "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t(lang, "播放", "Play")} {idx + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="input-row"
                onClick={() =>
                  setDetailOpen((prev) => ({
                    ...prev,
                    [processKey]: !prev[processKey]
                  }))
                }
              >
                <div>
                  <strong>{t(lang, "进程", "Processes")}</strong>
                  <div className="mono">
                    {processInfo
                      ? t(
                          lang,
                          `总数 ${processInfo.total ?? 0} · 最近 ${safeDateString(processInfo.timestamp)}`,
                          `Total ${processInfo.total ?? 0} · last ${safeDateString(processInfo.timestamp)}`
                        )
                      : t(lang, "无数据", "No data")}
                  </div>
                </div>
                <div className="process-toggle">
                  {detailOpen[processKey] ? t(lang, "收起", "Hide") : t(lang, "展开", "Show")}
                </div>
              </div>
              {detailOpen[processKey] && processInfo?.top?.length ? (
                <div className="input-detail process-detail">
                  {processInfo.top.map((item) => {
                    const count = item.count || 0;
                    const percent = maxProcessCount ? Math.min(100, Math.round((count / maxProcessCount) * 100)) : 0;
                    return (
                      <div className="process-item" key={item.name}>
                        <div className="process-name">{item.name}</div>
                        <div className="process-count">{count}</div>
                        <div className="process-bar">
                          <span style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>
        );
        })}
      </div>
    </DashboardShell>
  );
}
