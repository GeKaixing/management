"use client";

import Link from "next/link";
import { useLang, t } from "../lib/i18n";

export default function Home() {
  const { lang, setLang } = useLang();

  return (
    <main>
      <header>
        <h1>{t(lang, "远程监控仪表盘", "Remote Camera Dashboard")}</h1>
        <nav>
          <Link href="/live">{t(lang, "实时", "Live")}</Link>
          <Link href="/events">{t(lang, "事件", "Events")}</Link>
          <Link href="/docs">{t(lang, "说明", "Docs")}</Link>
        </nav>
        <button className="lang-toggle" type="button" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </header>

      <section className="hero">
        <div className="card">
          <span className="badge">{t(lang, "系统状态", "System Status")}</span>
          <h3>{t(lang, "服务端 + Agent 框架", "Server + Agent Skeleton")}</h3>
          <p>
            {t(lang, "此 UI 默认连接到本机服务端：", "This UI connects to the core server at ")}
            <span className="mono">http://localhost:3000</span>
            {t(lang, "。如需修改请在页面内替换 URL。", ". Update the URL in pages if your server runs elsewhere.")}
          </p>
          <div>
            <Link className="button" href="/live">
              {t(lang, "查看实时", "View Live")}
            </Link>
          </div>
        </div>
        <div className="video-frame">{t(lang, "实时画面占位", "Live stream placeholder")}</div>
      </section>

      <section style={{ marginTop: 32 }} className="grid">
        <div className="card">
          <h3>{t(lang, "设备注册", "Device Registry")}</h3>
          <p className="mono">GET /devices</p>
          <p>{t(lang, "查看设备在线与最后心跳。", "Check connected devices and last seen timestamps.")}</p>
        </div>
        <div className="card">
          <h3>{t(lang, "事件记录", "Event History")}</h3>
          <p className="mono">GET /events</p>
          <p>{t(lang, "查看事件与录像。", "Browse fall detection events and recorded clips.")}</p>
        </div>
        <div className="card">
          <h3>{t(lang, "手动触发", "Manual Trigger")}</h3>
          <p className="mono">POST /events/test</p>
          <p>{t(lang, "触发测试事件用于验证。", "Create a test event to verify snapshot + video storage.")}</p>
        </div>
      </section>
    </main>
  );
}