import { useEffect, useState } from "react";
import Link from "next/link";

const SERVER_URL = "http://localhost:3000";

export default function Live() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    fetch(`${SERVER_URL}/devices`)
      .then((res) => res.json())
      .then((data) => setDevices(data.devices || []))
      .catch(() => setDevices([]));
  }, []);

  return (
    <main>
      <header>
        <h1>Live View</h1>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/events">Events</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="video-frame">Live stream placeholder</div>
        <div className="card">
          <h3>Devices</h3>
          {devices.length === 0 ? (
            <p>No devices registered.</p>
          ) : (
            <ul>
              {devices.map((device) => (
                <li key={device.id}>
                  <strong>{device.id}</strong>
                  <div className="mono">Last seen: {new Date(device.lastSeen).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}