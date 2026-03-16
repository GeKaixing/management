"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLang, t } from "../../../lib/i18n";

const SERVER_URL = "http://localhost:3000";

export default function EventDetail() {
  const { lang, setLang } = useLang();
  const params = useParams();
  const id = params?.id;
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
        <h1>{t(lang, "事件详情", "Event Detail")}</h1>
        <nav>
          <Link href="/events">{t(lang, "事件", "Events")}</Link>
          <Link href="/live">{t(lang, "实时", "Live")}</Link>
          <Link href="/docs">{t(lang, "说明", "Docs")}</Link>
        </nav>
        <button className="lang-toggle" type="button" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </header>

      {!event ? (
        <div className="card">{t(lang, "正在加载事件...", "Loading event...")}</div>
      ) : (
        <div className="grid">
          <div className="card">
            <h3>{t(lang, "元数据", "Metadata")}</h3>
            <p>
              <strong>{t(lang, "ID：", "ID:")}</strong> {event.id}
            </p>
            <p>
              <strong>{t(lang, "设备：", "Device:")}</strong> {event.deviceId}
            </p>
            <p>
              <strong>{t(lang, "类型：", "Type:")}</strong> {event.type}
            </p>
            <p>
              <strong>{t(lang, "时间：", "Timestamp:")}</strong> {new Date(event.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="card">
            <h3>{t(lang, "文件", "Files")}</h3>
            <p className="mono">
              {t(lang, "快照：", "Snapshot:")} {event.snapshot}
            </p>
            <p className="mono">
              {t(lang, "视频：", "Video:")} {event.video}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
