"use client";

import { useEffect, useState } from "react";
import DashboardShell from "../components/DashboardShell";
import { useLang, t } from "../../lib/i18n";

const SERVER_URL = "http://localhost:3000";

export default function Settings() {
  const { lang, setLang } = useLang();
  const [workHoursPerDay, setWorkHoursPerDay] = useState(8);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${SERVER_URL}/settings/work-hours`)
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

  async function saveSettings() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`${SERVER_URL}/settings/work-hours`, {
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

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "系统设置", "Settings")}>
      <section className="card">
        <h3>{t(lang, "工作时间阈值", "Daily Work Hours Threshold")}</h3>
        <p className="mono">
          {t(
            lang,
            "被监控用户每日在线不足该时长将标记为 LAZY。",
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
    </DashboardShell>
  );
}
