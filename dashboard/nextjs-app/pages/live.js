import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const SERVER_URL = "http://localhost:3000";

export default function Live() {
  const [devices, setDevices] = useState([]);
  const [inputEvents, setInputEvents] = useState([]);
  const [audioSegments, setAudioSegments] = useState([]);
  const [expanded, setExpanded] = useState({});
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
        <h1>Live View</h1>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/events">Events</Link>
        </nav>
      </header>

      {deviceCards.map((device) => {
        const keyboardEvents = inputEvents.filter(
          (evt) => evt.type === "keyboard" && evt.deviceId === device.id
        );
        const mouseEvents = inputEvents.filter(
          (evt) => evt.type === "mouse" && evt.deviceId === device.id
        );
        const audioForDevice = audioSegments.filter((seg) => seg.deviceId === device.id);

        return (
          <section key={device.id} className="device-card">
            <div className="device-header">
              <div>
                <h2>{userNames[device.id] || "Monitored User"}</h2>
                <div className="mono">Device ID: {device.id}</div>
              </div>
              <div className="status-pill">{device.lastSeen ? "Online" : "Offline"}</div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-title">
                  <h3>Screen</h3>
                  <span className="mono">/screen/latest</span>
                </div>
                <div className="video-frame" style={{ padding: 0 }}>
                  <img
                    src={`${SERVER_URL}/screen/latest?deviceId=${device.id}&ts=${tick}`}
                    alt="Screen Stream"
                    style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 16 }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-title">
                  <h3>Camera</h3>
                  <span className="mono">/camera/latest</span>
                </div>
                <div className="video-frame" style={{ padding: 0 }}>
                  <img
                    src={`${SERVER_URL}/camera/latest?deviceId=${device.id}&ts=${tick}`}
                    alt="Camera Stream"
                    style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 16 }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="input-grid">
              <button className="input-row" type="button" onClick={() => toggleExpanded(device.id, "keyboard")}>
                <div>
                  <strong>Keyboard</strong>
                  <div className="mono">{summarize(keyboardEvents)}</div>
                </div>
                <span className="mono">{expanded[device.id] === "keyboard" ? "Hide" : "Details"}</span>
              </button>

              {expanded[device.id] === "keyboard" && (
                <div className="input-detail">
                  <MiniChart events={keyboardEvents} />
                </div>
              )}

              <button className="input-row" type="button" onClick={() => toggleExpanded(device.id, "mouse")}>
                <div>
                  <strong>Mouse</strong>
                  <div className="mono">{summarize(mouseEvents)}</div>
                </div>
                <span className="mono">{expanded[device.id] === "mouse" ? "Hide" : "Details"}</span>
              </button>

              {expanded[device.id] === "mouse" && (
                <div className="input-detail">
                  <MiniChart events={mouseEvents} />
                </div>
              )}

              <button className="input-row" type="button" onClick={() => toggleExpanded(device.id, "audio")}>
                <div>
                  <strong>Audio</strong>
                  <div className="mono">
                    {audioForDevice.length > 0
                      ? `${audioForDevice.length} segments · last ${new Date(
                          audioForDevice[audioForDevice.length - 1].timestamp
                        ).toLocaleString()}`
                      : "No data"}
                  </div>
                </div>
                <span className="mono">{expanded[device.id] === "audio" ? "Hide" : "Details"}</span>
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
