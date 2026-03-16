import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const SERVER_URL = "http://localhost:3000";

export default function EventDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${SERVER_URL}/events/${id}`)
      .then((res) => res.json())
      .then((data) => setEvent(data.event || null))
      .catch(() => setEvent(null));
  }, [id]);

  return (
    <main>
      <header>
        <h1>Event Detail</h1>
        <nav>
          <Link href="/events">Events</Link>
          <Link href="/live">Live</Link>
        </nav>
      </header>

      {!event ? (
        <div className="card">Loading event...</div>
      ) : (
        <div className="grid">
          <div className="card">
            <h3>Metadata</h3>
            <p>
              <strong>ID:</strong> {event.id}
            </p>
            <p>
              <strong>Device:</strong> {event.deviceId}
            </p>
            <p>
              <strong>Type:</strong> {event.type}
            </p>
            <p>
              <strong>Timestamp:</strong> {new Date(event.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="card">
            <h3>Files</h3>
            <p className="mono">Snapshot: {event.snapshot}</p>
            <p className="mono">Video: {event.video}</p>
          </div>
        </div>
      )}
    </main>
  );
}
