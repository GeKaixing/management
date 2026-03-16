import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang, t } from "../lib/i18n";

const SERVER_URL = "http://localhost:3000";

export default function Events() {
  const { lang, setLang } = useLang();
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
        <h1>{t(lang, "事件记录", "Event History")}</h1>
        <nav>
          <Link href="/">{t(lang, "首页", "Home")}</Link>
          <Link href="/live">{t(lang, "实时", "Live")}</Link>
          <Link href="/docs">{t(lang, "说明", "Docs")}</Link>
        </nav>
        <button className="lang-toggle" type="button" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </header>

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
                <td colSpan="4">{t(lang, "暂无事件。", "No events found.")}</td>
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
