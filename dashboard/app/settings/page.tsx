"use client";

import { useEffect, useState } from "react";
import DashboardShell from "../components/DashboardShell";
import { useLang, t } from "../../lib/i18n";
import { getServerUrl, setServerUrl } from "../../lib/serverUrl";

export default function Settings() {
  const { lang, setLang } = useLang();
  const [workHoursPerDay, setWorkHoursPerDay] = useState(8);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [hideOfflineMedia, setHideOfflineMedia] = useState(true);
  const [liveViewSaving, setLiveViewSaving] = useState(false);
  const [liveViewStatus, setLiveViewStatus] = useState<string | null>(null);

  const [serverUrl, setServerUrlState] = useState(getServerUrl());
  const [serverSaving, setServerSaving] = useState(false);
  const [serverStatus, setServerStatus] = useState<string | null>(null);

  const [aiKey, setAiKey] = useState("");
  const [aiHasKey, setAiHasKey] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${getServerUrl()}/settings/work-hours`)
      .then((res) => res.json())
      .then((data) => {
        if (Number.isFinite(data.workHoursPerDay)) {
          setWorkHoursPerDay(Number(data.workHoursPerDay));
        }
      })
      .catch(() => {
        setStatus(t(lang, "无法加载设置", "Failed to load settings"));
      });
  }, [lang]);

  useEffect(() => {
    fetch(`${getServerUrl()}/settings/live-view`)
      .then((res) => res.json())
      .then((data) => {
        setHideOfflineMedia(data.hideOfflineMedia !== false);
      })
      .catch(() => {
        setLiveViewStatus(t(lang, "无法加载实时设置", "Failed to load live view settings"));
      });
  }, [lang]);

  useEffect(() => {
    fetch(`${getServerUrl()}/settings/ai`)
      .then((res) => res.json())
      .then((data) => {
        setAiHasKey(Boolean(data.hasKey));
      })
      .catch(() => {
        setAiStatus(t(lang, "无法加载AI设置", "Failed to load AI settings"));
      });
  }, [lang]);

  async function saveServerUrl() {
    setServerSaving(true);
    setServerStatus(null);
    try {
      const next = serverUrl.trim();
      if (!next) throw new Error("empty");
      setServerUrl(next);
      setServerStatus(t(lang, "已保存", "Saved"));
    } catch {
      setServerStatus(t(lang, "保存失败", "Save failed"));
    } finally {
      setServerSaving(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${getServerUrl()}/settings/work-hours`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workHoursPerDay })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(t(lang, "保存失败，请检查输入", "Save failed. Please check your input."));
      } else {
        setWorkHoursPerDay(Number(data.workHoursPerDay));
        setStatus(t(lang, "已保存", "Saved"));
      }
    } catch {
      setStatus(t(lang, "保存失败", "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveLiveViewSettings() {
    setLiveViewSaving(true);
    setLiveViewStatus(null);
    try {
      const res = await fetch(`${getServerUrl()}/settings/live-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideOfflineMedia })
      });
      const data = await res.json();
      if (!res.ok) {
        setLiveViewStatus(t(lang, "保存失败", "Save failed"));
      } else {
        setHideOfflineMedia(data.hideOfflineMedia !== false);
        setLiveViewStatus(t(lang, "已保存", "Saved"));
      }
    } catch {
      setLiveViewStatus(t(lang, "保存失败", "Save failed"));
    } finally {
      setLiveViewSaving(false);
    }
  }

  async function saveAiKey() {
    if (!aiKey.trim()) {
      setAiStatus(t(lang, "请输入有效的Key", "Please enter a valid key"));
      return;
    }
    setAiSaving(true);
    setAiStatus(null);
    try {
      const res = await fetch(`${getServerUrl()}/settings/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "gemini", apiKey: aiKey.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setAiStatus(t(lang, "保存失败", "Save failed"));
      } else {
        setAiHasKey(Boolean(data.hasKey));
        setAiKey("");
        setAiStatus(t(lang, "已保存", "Saved"));
      }
    } catch {
      setAiStatus(t(lang, "保存失败", "Save failed"));
    } finally {
      setAiSaving(false);
    }
  }

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "系统设置", "Settings")}>
      <section className="card">
        <h3>{t(lang, "服务端地址", "Server URL")}</h3>
        <p className="mono">
          {t(
            lang,
            "Dashboard 将使用该地址请求数据。",
            "Dashboard will use this base URL for API requests."
          )}
        </p>
        <div className="settings-row">
          <label className="settings-label" htmlFor="serverUrl">
            {t(lang, "服务端地址", "Server URL")}
          </label>
          <input
            id="serverUrl"
            className="settings-input"
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrlState(e.target.value)}
          />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={saveServerUrl} disabled={serverSaving}>
            {serverSaving ? t(lang, "保存中...", "Saving...") : t(lang, "保存地址", "Save URL")}
          </button>
          {serverStatus && <div className="status-text">{serverStatus}</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>{t(lang, "工作时间阈值", "Daily Work Hours Threshold")}</h3>
        <p className="mono">
          {t(
            lang,
            "被监控用户每日在线不达标将标记为 LAZY。",
            "Monitored users below this daily online time will be marked LAZY."
          )}
        </p>
        <div className="settings-row">
          <label className="settings-label" htmlFor="workHours">
            {t(lang, "每日在线要求（小时）", "Required hours per day")}
          </label>
          <input
            id="workHours"
            className="settings-input"
            type="number"
            min={1}
            max={24}
            step={0.5}
            value={workHoursPerDay}
            onChange={(e) => {
              const nextValue = Number(e.target.value);
              setWorkHoursPerDay(Number.isFinite(nextValue) ? nextValue : 0);
            }}
          />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={saveSettings} disabled={saving}>
            {saving ? t(lang, "保存中...", "Saving...") : t(lang, "保存设置", "Save Settings")}
          </button>
          {status && <div className="status-text">{status}</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>{t(lang, "实时画面设置", "Live View Settings")}</h3>
        <p className="mono">
          {t(
            lang,
            "设备离线时是否隐藏屏幕/摄像头画面。",
            "Hide screen/camera frames when the device is offline."
          )}
        </p>
        <div className="settings-row">
          <label className="settings-label" htmlFor="hideOfflineMedia">
            {t(lang, "离线隐藏画面", "Hide offline media")}
          </label>
          <input
            id="hideOfflineMedia"
            className="settings-input"
            type="checkbox"
            checked={hideOfflineMedia}
            onChange={(e) => setHideOfflineMedia(e.target.checked)}
          />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={saveLiveViewSettings} disabled={liveViewSaving}>
            {liveViewSaving ? t(lang, "保存中...", "Saving...") : t(lang, "保存设置", "Save Settings")}
          </button>
          {liveViewStatus && <div className="status-text">{liveViewStatus}</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>{t(lang, "AI 配置", "AI Configuration")}</h3>
        <p className="mono">
          {t(
            lang,
            "用于汇报页 AI 总结（仅做事实汇总与风险提示）。",
            "Used for AI summaries on the report page (facts and risk signals only)."
          )}
        </p>
        <div className="settings-row">
          <label className="settings-label" htmlFor="aiKey">
            {t(lang, "Gemini API Key", "Gemini API Key")}
          </label>
          <input
            id="aiKey"
            className="settings-input"
            type="password"
            value={aiKey}
            onChange={(e) => setAiKey(e.target.value)}
            placeholder={aiHasKey ? t(lang, "已配置（重新输入可替换）", "Configured (enter to replace)") : ""}
          />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={saveAiKey} disabled={aiSaving}>
            {aiSaving ? t(lang, "保存中...", "Saving...") : t(lang, "保存AI Key", "Save AI Key")}
          </button>
          {aiStatus && <div className="status-text">{aiStatus}</div>}
        </div>
      </section>
    </DashboardShell>
  );
}
