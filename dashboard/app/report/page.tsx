"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "../components/DashboardShell";
import { useLang, t } from "../../lib/i18n";
import { safeDateString } from "../../lib/time";
import { getServerUrl } from "../../lib/serverUrl";

const LONG_OFFLINE_MS = 30 * 60 * 1000;

type Device = {
  id: string;
  lastSeen?: number | null;
  status?: string;
  laze?: boolean;
  lazyByWorkHours?: boolean;
  onlineMsToday?: number;
  workHoursPerDay?: number;
  name?: string | null;
  note?: string | null;
  offlineAt?: string | null;
  offlineReason?: string | null;
  source?: string | null;
};

type EmployeeMeta = {
  email?: string;
  tasksRemaining?: number | null;
};

function formatHours(ms?: number) {
  const safeMs = Number(ms || 0);
  if (!Number.isFinite(safeMs)) return "0.0";
  return (safeMs / (60 * 60 * 1000)).toFixed(1);
}

export default function ReportPage() {
  const { lang, setLang } = useLang();
  const [devices, setDevices] = useState<Device[]>([]);
  const [employeeMeta, setEmployeeMeta] = useState<Record<string, EmployeeMeta>>({});
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});
  const [nameSaving, setNameSaving] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({});
  const [tasksEdits, setTasksEdits] = useState<Record<string, string>>({});
  const [metaSaving, setMetaSaving] = useState<Record<string, boolean>>({});
  const [emailTemplateLazy, setEmailTemplateLazy] = useState("最近监测到你有些偷懒，请注意按时完成任务。");
  const [emailTemplateDone, setEmailTemplateDone] = useState("干得真棒了！任务已完成。");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDevices() {
      try {
        const [deviceRes, employeeRes, templateRes] = await Promise.all([
          fetch(`${getServerUrl()}/devices`),
          fetch(`${getServerUrl()}/employees`),
          fetch(`${getServerUrl()}/settings/email-templates`)
        ]);
        const deviceData = await deviceRes.json();
        const employeeData = await employeeRes.json().catch(() => ({}));
        const templateData = await templateRes.json().catch(() => ({}));
        if (active) {
          setDevices(Array.isArray(deviceData.devices) ? deviceData.devices : []);
          setEmployeeMeta(employeeData.employees || {});
          if (templateData.emailTemplateLazy) {
            setEmailTemplateLazy(String(templateData.emailTemplateLazy));
          }
          if (templateData.emailTemplateDone) {
            setEmailTemplateDone(String(templateData.emailTemplateDone));
          }
        }
      } catch {
        if (active) setDevices([]);
      }
    }

    loadDevices();
    const timer = setInterval(loadDevices, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  async function saveEmployeeMeta(deviceId: string) {
    const email = (emailEdits[deviceId] ?? "").trim();
    const rawTasks = tasksEdits[deviceId];
    const tasksRemaining = rawTasks === undefined || rawTasks === "" ? null : Number(rawTasks);
    setMetaSaving((prev) => ({ ...prev, [deviceId]: true }));
    try {
      const res = await fetch(`${getServerUrl()}/employees/${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tasksRemaining })
      });
      const data = await res.json();
      if (res.ok && data.employee) {
        setEmployeeMeta((prev) => ({ ...prev, [deviceId]: data.employee }));
      }
    } finally {
      setMetaSaving((prev) => ({ ...prev, [deviceId]: false }));
    }
  }

  function buildMailto(deviceId: string) {
    const meta = employeeMeta[deviceId] || {};
    const email = (meta.email || "").trim();
    if (!email) return "";
    const tasksRemaining = meta.tasksRemaining;
    const isDone = tasksRemaining === 0;
    const subject = isDone ? "工作完成确认" : "工作提醒";
    const body = isDone ? emailTemplateDone : emailTemplateLazy;
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function saveName(deviceId: string) {
    const nextName = (nameEdits[deviceId] ?? "").trim();
    setNameSaving((prev) => ({ ...prev, [deviceId]: true }));
    try {
      await fetch(`${getServerUrl()}/device/${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName })
      });
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, name: nextName || null } : d))
      );
    } finally {
      setNameSaving((prev) => ({ ...prev, [deviceId]: false }));
    }
  }

  async function loadAiSummary() {
    setAiLoading(true);
    setAiStatus(null);
    try {
      const res = await fetch(`${getServerUrl()}/report/ai-summary`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "ai_key_not_configured") {
          setAiStatus(t(lang, "请先在设置中配置AI Key", "Please configure the AI key in Settings"));
        } else {
          const message = data?.message ? String(data.message) : "";
          const base = t(lang, "AI生成失败", "AI generation failed");
          const friendly =
            message === "timeout"
              ? t(lang, "AI请求超时，请检查网络/代理", "AI request timed out. Check network/proxy.")
              : message === "network_error"
                ? t(lang, "无法连接到Gemini，请检查网络/代理", "Unable to reach Gemini. Check network/proxy.")
                : message;
          setAiStatus(friendly ? `${base}: ${friendly}` : base);
        }
        setAiSummary(null);
      } else {
        setAiSummary(String(data.summary || ""));
      }
    } catch {
      setAiStatus(t(lang, "AI生成失败", "AI generation failed"));
      setAiSummary(null);
    } finally {
      setAiLoading(false);
    }
  }

  const summary = useMemo(() => {
    const now = Date.now();
    const total = devices.length;
    const online = devices.filter((d) => d.status === "online").length;
    const lazy = devices.filter((d) => d.laze || d.lazyByWorkHours).length;
    const longOffline = devices.filter((d) => {
      if (d.status !== "offline") return false;
      const last = d.lastSeen ? d.lastSeen : d.offlineAt ? Date.parse(d.offlineAt) : null;
      if (!last) return true;
      return now - last >= LONG_OFFLINE_MS;
    }).length;
    return { total, online, lazy, longOffline };
  }, [devices]);

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "今日汇报", "Daily Report")}>
      <section className="grid report-summary" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="badge">{t(lang, "总设备", "Total")}</div>
          <h3>{summary.total}</h3>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "在线", "Online")}</div>
          <h3>{summary.online}</h3>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "疑似偷懒", "Lazy")}</div>
          <h3>{summary.lazy}</h3>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "长时间离线", "Long Offline")}</div>
          <h3>{summary.longOffline}</h3>
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <h3>{t(lang, "员工今日状态", "Employee Status Today")}</h3>
        </div>
        <table className="table report-table">
          <thead>
            <tr>
              <th>{t(lang, "姓名", "Name")}</th>
              <th>{t(lang, "电子邮件", "Email")}</th>
              <th>{t(lang, "任务剩余", "Tasks Remaining")}</th>
              <th>{t(lang, "设备ID", "Device ID")}</th>
              <th>{t(lang, "状态", "Status")}</th>
              <th>{t(lang, "今日在线(h)", "Online Today (h)")}</th>
              <th>{t(lang, "偷懒", "Lazy")}</th>
              <th>{t(lang, "长离线", "Long Offline")}</th>
              <th>{t(lang, "最近在线", "Last Seen")}</th>
              <th>{t(lang, "操作", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const isLazy = Boolean(device.laze || device.lazyByWorkHours);
              const lastSeen = device.lastSeen
                ? safeDateString(new Date(device.lastSeen).toISOString())
                : device.offlineAt
                  ? safeDateString(device.offlineAt)
                  : t(lang, "未知", "unknown");
              const lastTs = device.lastSeen
                ? device.lastSeen
                : device.offlineAt
                  ? Date.parse(device.offlineAt)
                  : null;
              const longOffline =
                device.status === "offline" && (!lastTs || Date.now() - lastTs >= LONG_OFFLINE_MS);

              return (
                <tr key={device.id}>
                  <td className="report-name-cell">
                  {editingId === device.id ? (
                    <div className="report-name-edit">
                      <input
                        className="settings-input report-name-input"
                        value={nameEdits[device.id] ?? device.name ?? ""}
                        onChange={(e) =>
                          setNameEdits((prev) => ({ ...prev, [device.id]: e.target.value }))
                        }
                        placeholder={t(lang, "未命名", "Unnamed")}
                        autoFocus
                      />
                      <button
                        className="button report-button-sm"
                        type="button"
                        onClick={async () => {
                          await saveName(device.id);
                          setEditingId(null);
                        }}
                        disabled={Boolean(nameSaving[device.id])}
                      >
                        {nameSaving[device.id]
                          ? t(lang, "保存中...", "Saving...")
                          : t(lang, "保存", "Save")}
                      </button>
                      <button
                        className="ghost-button report-button-sm"
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setNameEdits((prev) => ({
                            ...prev,
                            [device.id]: device.name ?? ""
                          }));
                        }}
                      >
                        {t(lang, "取消", "Cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button report-name-button"
                        onClick={() => {
                          setNameEdits((prev) => ({ ...prev, [device.id]: device.name ?? "" }));
                          setEditingId(device.id);
                        }}
                      >
                        {device.name || t(lang, "未命名", "Unnamed")}
                      </button>
                    )}
                  </td>
                  <td>
                    <input
                      className="settings-input report-email-input"
                      type="email"
                      value={emailEdits[device.id] ?? employeeMeta[device.id]?.email ?? ""}
                      onChange={(e) =>
                        setEmailEdits((prev) => ({ ...prev, [device.id]: e.target.value }))
                      }
                      placeholder={t(lang, "未填写", "Not set")}
                    />
                  </td>
                  <td>
                    <input
                      className="settings-input report-tasks-input"
                      type="number"
                      min={0}
                      value={
                        tasksEdits[device.id] ??
                        (employeeMeta[device.id]?.tasksRemaining ?? "").toString()
                      }
                      onChange={(e) =>
                        setTasksEdits((prev) => ({ ...prev, [device.id]: e.target.value }))
                      }
                      placeholder="0"
                    />
                  </td>
                  <td className="mono">{device.id}</td>
                  <td>{device.status === "online" ? t(lang, "在线", "Online") : t(lang, "离线", "Offline")}</td>
                  <td>{formatHours(device.onlineMsToday)}</td>
                  <td>{isLazy ? t(lang, "是", "Yes") : t(lang, "否", "No")}</td>
                  <td>{longOffline ? t(lang, "是", "Yes") : t(lang, "否", "No")}</td>
                  <td>{lastSeen}</td>
                  <td>
                    <div className="report-actions">
                      <button
                        className="button report-button-sm"
                        type="button"
                        onClick={() => saveEmployeeMeta(device.id)}
                        disabled={Boolean(metaSaving[device.id])}
                      >
                        {metaSaving[device.id]
                          ? t(lang, "保存中...", "Saving...")
                          : t(lang, "保存", "Save")}
                      </button>
                      <a
                        className="ghost-button report-button-sm"
                        href={buildMailto(device.id)}
                        onClick={(e) => {
                          if (!buildMailto(device.id)) e.preventDefault();
                        }}
                      >
                        {t(lang, "邮件", "Email")}
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-title">
          <h3>{t(lang, "AI 汇总", "AI Summary")}</h3>
          <button className="button" type="button" onClick={loadAiSummary} disabled={aiLoading}>
            {aiLoading ? t(lang, "生成中...", "Generating...") : t(lang, "生成汇报", "Generate")}
          </button>
        </div>
        <p className="mono" style={{ marginTop: 0 }}>
          {t(
            lang,
            "AI 仅做事实汇总与风险提示，不做用工决策。",
            "AI provides factual summaries and risk signals only, not HR decisions."
          )}
        </p>
        {aiStatus && <div className="status-text">{aiStatus}</div>}
        {aiSummary && (
          <pre className="docs-code" style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
            {aiSummary}
          </pre>
        )}
      </section>
    </DashboardShell>
  );
}
