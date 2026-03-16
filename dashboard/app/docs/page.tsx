"use client";

import DashboardShell from "../components/DashboardShell";
import { useLang, t } from "../../lib/i18n";

export default function Docs() {
  const { lang, setLang } = useLang();

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "使用文档", "Documentation")}>
      <article className="docs-article">
        <p className="docs-lead">
          {t(
            lang,
            "这是一个远程监控系统，用于在获得授权的前提下查看设备屏幕、摄像头、输入行为与语音片段。",
            "This is a remote monitoring system for viewing device screen, camera, input activity, and audio segments with consent."
          )}
        </p>

        <section className="docs-section">
          <h2>{t(lang, "快速开始", "Quick Start")}</h2>
          <div className="docs-code">
            <div>npm install</div>
            <div>
              node agent/cli.js start --device cam-001 --server http://&lt;server-host&gt;:3000 --screen --input --mic --camera-frames
            </div>
          </div>
          <p className="docs-note">
            {t(
              lang,
              "首次运行建议从“实时监控”确认屏幕、摄像头、输入与语音均正常上报。",
              "After first run, verify screen, camera, input, and audio in Live Monitor."
            )}
          </p>
        </section>

        <section className="docs-section">
          <h2>{t(lang, "监控与告警规则", "Monitoring Rules")}</h2>
          <ul className="docs-list">
            <li>{t(lang, "屏幕长时间静止会被标记为 LAZY。", "Stale screen frames can trigger LAZY.")}</li>
            <li>{t(lang, "键盘/鼠标活跃度显著下降会被标记为 LAZY。", "Low input activity can trigger LAZY.")}</li>
            <li>
              {t(
                lang,
                "每日在线不足设置的工作时长也会被标记为 LAZY。",
                "Falling below daily required online hours triggers LAZY."
              )}
            </li>
          </ul>
        </section>

        <section className="docs-section">
          <h2>{t(lang, "工作时间设置", "Work Hours Settings")}</h2>
          <p>
            {t(
              lang,
              "进入“设置”页可调整每日在线要求（1~24 小时）。该阈值会影响 LAZY 判断。",
              "Use Settings to adjust required daily online hours (1–24). This threshold affects LAZY."
            )}
          </p>
          <p className="mono">/settings → 工作时间阈值</p>
        </section>

        <section className="docs-section">
          <h2>{t(lang, "一键安装", "One-line install")}</h2>
          <div className="docs-code">
            <div>
              curl -fsSL https://raw.githubusercontent.com/GeKaixing/management/main/install.sh | bash -s -- --install-method git
            </div>
            <div>
              powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr -useb https://raw.githubusercontent.com/GeKaixing/management/main/install.ps1 | iex"
            </div>
          </div>
        </section>

        <section className="docs-section">
          <h2>{t(lang, "接口速览", "API Quick Reference")}</h2>
          <ul className="docs-list">
            <li>GET /devices</li>
            <li>GET /events</li>
            <li>GET /input/events</li>
            <li>GET /audio/list</li>
            <li>GET /settings/work-hours</li>
            <li>POST /settings/work-hours</li>
          </ul>
        </section>

        <section className="docs-section">
          <h2>{t(lang, "隐私与数据", "Privacy & Data")}</h2>
          <p>
            {t(
              lang,
              "系统设计为仅向你控制的服务端上传数据。我们建议最小化采集范围、设置访问控制并定期清理数据。",
              "The system is designed to send data only to the server you control. We recommend minimizing collection, enforcing access control, and rotating/deleting data regularly."
            )}
          </p>
          <p className="docs-note">
            {t(lang, "不应在未授权的情况下启用监控。", "Do not enable monitoring without authorization.")}
          </p>
        </section>

        <section className="docs-section">
          <h2>{t(lang, "涉及的权限", "Required permissions")}</h2>
          <ul className="docs-list">
            <li>{t(lang, "屏幕录制权限（用于屏幕流）", "Screen recording permission (screen stream)")}</li>
            <li>{t(lang, "摄像头权限（用于摄像头帧）", "Camera permission (camera frames)")}</li>
            <li>{t(lang, "麦克风权限（用于音频录制）", "Microphone permission (audio recording)")}</li>
            <li>{t(lang, "输入监听权限（键盘/鼠标）", "Input monitoring permission (keyboard/mouse)")}</li>
            <li>{t(lang, "网络访问权限（上传数据）", "Network access (upload data)")}</li>
          </ul>
        </section>
      </article>
    </DashboardShell>
  );
}
