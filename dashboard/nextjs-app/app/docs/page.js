"use client";

import Link from "next/link";
import { useLang, t } from "../../lib/i18n";

export default function Docs() {
  const { lang, setLang } = useLang();

  return (
    <main>
      <header>
        <h1>{t(lang, "产品说明", "Documentation")}</h1>
        <nav>
          <Link href="/">{t(lang, "首页", "Home")}</Link>
          <Link href="/live">{t(lang, "实时", "Live")}</Link>
          <Link href="/events">{t(lang, "事件", "Events")}</Link>
        </nav>
        <button className="lang-toggle" type="button" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </header>

      <section className="card">
        <h3>{t(lang, "这是什么", "What is this?")}</h3>
        <p>
          {t(
            lang,
            "这是一个远程监控系统，用于在获得授权的前提下查看设备屏幕、摄像头、输入行为与语音片段。",
            "This is a remote monitoring system for viewing device screen, camera, input activity, and audio segments with consent."
          )}
        </p>
      </section>

      <section className="card">
        <h3>{t(lang, "如何安装", "How to install")}</h3>
        <p className="mono">npm install</p>
        <p className="mono">node agent/cli.js start --device cam-001 --server http://&lt;server-host&gt;:3000 --input --screen --mic --camera-frames</p>
        <p>
          {t(
            lang,
            "请确保设备已安装 Node.js 与 FFmpeg，并在被监控端明确授权。",
            "Ensure Node.js and FFmpeg are installed, and that the monitored user has explicitly consented."
          )}
        </p>
      </section>

      <section className="card">
        <h3>{t(lang, "隐私与数据", "Privacy & Data")}</h3>
        <p>
          {t(
            lang,
            "系统设计为仅向你控制的服务端上传数据。我们建议最小化采集范围、设置访问控制并定期清理数据。",
            "The system is designed to send data only to the server you control. We recommend minimizing collection, enforcing access control, and rotating/deleting data regularly."
          )}
        </p>
        <p>{t(lang, "不应在未授权的情况下启用监控。", "Do not enable monitoring without authorization.")}</p>
      </section>

      <section className="card">
        <h3>{t(lang, "涉及的权限", "Required permissions")}</h3>
        <ul>
          <li>{t(lang, "屏幕录制权限（用于屏幕流）", "Screen recording permission (screen stream)")}</li>
          <li>{t(lang, "摄像头权限（用于摄像头帧）", "Camera permission (camera frames)")}</li>
          <li>{t(lang, "麦克风权限（用于音频录制）", "Microphone permission (audio recording)")}</li>
          <li>{t(lang, "输入监听权限（键盘/鼠标）", "Input monitoring permission (keyboard/mouse)")}</li>
          <li>{t(lang, "网络访问权限（上传数据）", "Network access (upload data)")}</li>
        </ul>
      </section>
    </main>
  );
}