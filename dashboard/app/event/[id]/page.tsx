"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "../../components/DashboardShell";
import { useLang, t } from "../../../lib/i18n";
import { safeDateString } from "../../../lib/time";
import { getServerUrl } from "../../../lib/serverUrl";

const SERVER_URL = getServerUrl();

type EventRecord = {
  id: string;
  deviceId: string;
  timestamp: string;
  type: string;
  snapshot?: string | null;
  screenSnapshot?: string | null;
  cameraSnapshot?: string | null;
  video?: string | null;
  meta?: Record<string, unknown>;
};

export default function EventDetail() {
  const { id } = useParams();
  const { lang, setLang } = useLang();
  const [event, setEvent] = useState<EventRecord | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${SERVER_URL}/events/${id}`)
      .then((res) => res.json())
      .then((data) => setEvent(data.event || null))
      .catch(() => setEvent(null));
  }, [id]);

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "事件详情", "Event Detail")}>
      <div className="page-links">
        <Link className="ghost-button" href="/events">
          {t(lang, "返回事件", "Back to Events")}
        </Link>
      </div>

      {!event && <div className="card">{t(lang, "未找到事件", "Event not found")}</div>}
      {event && (
        <div className="card">
          <div className="card-title">
            <h3>{event.type}</h3>
            <span className="mono">{safeDateString(event.timestamp)}</span>
          </div>
          <p className="mono">
            {t(lang, "设备", "Device")}: {event.deviceId}
          </p>
          <div className="grid-2" style={{ marginTop: 16 }}>
            {event.snapshot && (
              <div>
                <div className="badge">Snapshot</div>
                <img src={event.snapshot} alt="snapshot" style={{ width: "100%", borderRadius: 16 }} />
              </div>
            )}
            {event.screenSnapshot && (
              <div>
                <div className="badge">Screen</div>
                <img src={event.screenSnapshot} alt="screen" style={{ width: "100%", borderRadius: 16 }} />
              </div>
            )}
            {event.cameraSnapshot && (
              <div>
                <div className="badge">Camera</div>
                <img src={event.cameraSnapshot} alt="camera" style={{ width: "100%", borderRadius: 16 }} />
              </div>
            )}
          </div>
          {event.video && (
            <div style={{ marginTop: 16 }}>
              <div className="badge">Video</div>
              <video controls style={{ width: "100%", borderRadius: 16 }} src={event.video} />
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
