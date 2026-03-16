"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardShell from "../components/DashboardShell";
import { useLang, t } from "../../lib/i18n";

const SERVER_URL = "http://localhost:3000";

type EventItem = {
  id: string;
  deviceId: string;
  type: string;
  timestamp: string;
};

export default function Events() {
  const { lang, setLang } = useLang();
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    fetch(`${SERVER_URL}/events`)
      .then((res) => res.json())
      .then((data) => setEvents(Array.isArray(data.events) ? data.events : []))
      .catch(() => setEvents([]));
  }, []);

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "事件记录", "Event History")}>
      <div className="page-links">
        <Link href="/live">{t(lang, "查看实时监控", "Go to Live Monitor")}</Link>
        <Link href="/docs">{t(lang, "阅读说明", "Read Docs")}</Link>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>{t(lang, "ID", "ID")}</th>
              <th>{t(lang, "设备", "Device")}</th>
              <th>{t(lang, "类型", "Type")}</th>
              <th>{t(lang, "时间", "Timestamp")}</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4}>{t(lang, "暂无事件。", "No events found.")}</td>
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
    </DashboardShell>
  );
}
