import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header>
        <h1>Remote Camera Dashboard</h1>
        <nav>
          <Link href="/live">Live</Link>
          <Link href="/events">Events</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="card">
          <span className="badge">System Status</span>
          <h3>Server + Agent Skeleton</h3>
          <p>
            This UI connects to the core server at <span className="mono">http://localhost:3000</span>.
            Update the URL in pages if your server runs elsewhere.
          </p>
          <div>
            <Link className="button" href="/live">
              View Live
            </Link>
          </div>
        </div>
        <div className="video-frame">Live stream placeholder</div>
      </section>

      <section style={{ marginTop: 32 }} className="grid">
        <div className="card">
          <h3>Device Registry</h3>
          <p className="mono">GET /devices</p>
          <p>Check connected devices and last seen timestamps.</p>
        </div>
        <div className="card">
          <h3>Event History</h3>
          <p className="mono">GET /events</p>
          <p>Browse fall detection events and recorded clips.</p>
        </div>
        <div className="card">
          <h3>Manual Trigger</h3>
          <p className="mono">POST /events/test</p>
          <p>Create a test event to verify snapshot + video storage.</p>
        </div>
      </section>
    </main>
  );
}