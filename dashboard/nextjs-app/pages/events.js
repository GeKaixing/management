import { useEffect, useState } from "react";
import Link from "next/link";

const SERVER_URL = "http://localhost:3000";

export default function Events() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetch(`${SERVER_URL}/events`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]));
  }, []);

  return (
    <main>
      <header>
        <h1>Event History</h1>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/live">Live</Link>
        </nav>
      </header>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Device</th>
              <th>Type</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan="4">No events found.</td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <Link href={`/event/${event.id}`}>{event.id.slice(0, 8)}</Link>
                  </td>
                  <td>{event.deviceId}</td>
                  <td>{event.type}</td>
                  <td>{new Date(event.timestamp).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}