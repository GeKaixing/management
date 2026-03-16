"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import DashboardShell from "../../components/DashboardShell";
import { useLang, t } from "../../../lib/i18n";

const SERVER_URL = "http://localhost:3000";

type EventItem = {
  id: string;
  deviceId: string;
  type: string;
  timestamp: string;
  snapshot?: string;
  video?: string;
};

export default function EventDetail() {
  const { lang, setLang } = useLang();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params?.id[0] : "";
  const [event, setEvent] = useState<EventItem | null>(null);

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
        <Link href="/events">{t(lang, "返回事件列表", "Back to Events")}</Link>
        <Link href="/live">{t(lang, "查看监控", "Go to Monitor")}</Link>
      </div>

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
    </DashboardShell>
  );
}
