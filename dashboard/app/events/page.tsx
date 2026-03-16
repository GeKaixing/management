"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "../components/DashboardShell";
import { useLang, t } from "../../lib/i18n";
import { safeDateString } from "../../lib/time";
import { getServerUrl } from "../../lib/serverUrl";

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
};

export default function EventsPage() {
  const { lang, setLang } = useLang();
  const [events, setEvents] = useState<EventRecord[]>([]);

  useEffect(() => {
    fetch(`${SERVER_URL}/events`)
      .then((res) => res.json())
      .then((data) => setEvents(Array.isArray(data.events) ? data.events : []))
      .catch(() => setEvents([]));
  }, []);

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "事件", "Events")}
    >
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>{t(lang, "时间", "Time")}</th>
              <th>{t(lang, "设备", "Device")}</th>
              <th>{t(lang, "类型", "Type")}</th>
              <th>{t(lang, "查看", "View")}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{safeDateString(event.timestamp)}</td>
                <td className="mono">{event.deviceId}</td>
                <td>{event.type}</td>
                <td>
                  <Link className="button" href={`/event/${event.id}`}>
                    {t(lang, "打开", "Open")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <div className="mono">{t(lang, "暂无事件", "No events")}</div>}
      </div>
    </DashboardShell>
  );
}
