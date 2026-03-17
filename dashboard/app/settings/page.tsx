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
  const [emailTemplateLazy, setEmailTemplateLazy] = useState("");
  const [emailTemplateDone, setEmailTemplateDone] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [offDutySeconds, setOffDutySeconds] = useState(60);
  const [phoneUseSeconds, setPhoneUseSeconds] = useState(15);
  const [detectSaving, setDetectSaving] = useState(false);
  const [detectStatus, setDetectStatus] = useState<string | null>(null);
  const [detectConf, setDetectConf] = useState(0.25);
  const [detectIou, setDetectIou] = useState(0.45);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelStatus, setModelStatus] = useState<string | null>(null);

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

  useEffect(() => {
    fetch(`${getServerUrl()}/settings/email-templates`)
      .then((res) => res.json())
      .then((data) => {
        setEmailTemplateLazy(String(data.emailTemplateLazy || ""));
        setEmailTemplateDone(String(data.emailTemplateDone || ""));
      })
      .catch(() => {
        setEmailStatus(t(lang, "无法加载邮件模板", "Failed to load email templates"));
      });
  }, [lang]);

  useEffect(() => {
    fetch(`${getServerUrl()}/settings/detect-thresholds`)
      .then((res) => res.json())
      .then((data) => {
        if (Number.isFinite(data.offDutySeconds)) setOffDutySeconds(Number(data.offDutySeconds));
        if (Number.isFinite(data.phoneUseSeconds)) setPhoneUseSeconds(Number(data.phoneUseSeconds));
      })
      .catch(() => {
        setDetectStatus(t(lang, "无法加载检测阈值", "Failed to load detection thresholds"));
      });
  }, [lang]);

  useEffect(() => {
    fetch(`${getServerUrl()}/settings/detect-model`)
      .then((res) => res.json())
      .then((data) => {
        if (Number.isFinite(data.detectConf)) setDetectConf(Number(data.detectConf));
        if (Number.isFinite(data.detectIou)) setDetectIou(Number(data.detectIou));
      })
      .catch(() => {
        setModelStatus(t(lang, "无法加载检测参数", "Failed to load detection params"));
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

  async function saveEmailTemplates() {
    setEmailSaving(true);
    setEmailStatus(null);
    try {
      const res = await fetch(`${getServerUrl()}/settings/email-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailTemplateLazy: emailTemplateLazy.trim(),
          emailTemplateDone: emailTemplateDone.trim()
        })
      });
      if (!res.ok) {
        setEmailStatus(t(lang, "保存失败", "Save failed"));
      } else {
        setEmailStatus(t(lang, "已保存", "Saved"));
      }
    } catch {
      setEmailStatus(t(lang, "保存失败", "Save failed"));
    } finally {
      setEmailSaving(false);
    }
  }

  async function saveDetectThresholds() {
    setDetectSaving(true);
    setDetectStatus(null);
    try {
      const res = await fetch(`${getServerUrl()}/settings/detect-thresholds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offDutySeconds,
          phoneUseSeconds
        })
      });
      if (!res.ok) {
        setDetectStatus(t(lang, "保存失败", "Save failed"));
      } else {
        setDetectStatus(t(lang, "已保存", "Saved"));
      }
    } catch {
      setDetectStatus(t(lang, "保存失败", "Save failed"));
    } finally {
      setDetectSaving(false);
    }
  }

  async function saveDetectModel() {
    setModelSaving(true);
    setModelStatus(null);
    try {
      const res = await fetch(`${getServerUrl()}/settings/detect-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          detectConf,
          detectIou
        })
      });
      if (!res.ok) {
        setModelStatus(t(lang, "保存失败", "Save failed"));
      } else {
        setModelStatus(t(lang, "已保存", "Saved"));
      }
    } catch {
      setModelStatus(t(lang, "保存失败", "Save failed"));
    } finally {
      setModelSaving(false);
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

      <section className="card" style={{ marginTop: 24 }}>
        <h3>{t(lang, "邮件模板", "Email Templates")}</h3>
        <p className="mono">
          {t(
            lang,
            "用于汇报页发送邮件的默认内容。",
            "Default email content used by the report page."
          )}
        </p>
        <div className="settings-row">
          <label className="settings-label" htmlFor="emailTemplateLazy">
            {t(lang, "偷懒提醒模板", "Lazy Reminder Template")}
          </label>
          <textarea
            id="emailTemplateLazy"
            className="settings-input settings-input--wide"
            rows={3}
            value={emailTemplateLazy}
            onChange={(e) => setEmailTemplateLazy(e.target.value)}
          />
        </div>
        <div className="settings-row">
          <label className="settings-label" htmlFor="emailTemplateDone">
            {t(lang, "完成表扬模板", "Completion Praise Template")}
          </label>
          <textarea
            id="emailTemplateDone"
            className="settings-input settings-input--wide"
            rows={3}
            value={emailTemplateDone}
            onChange={(e) => setEmailTemplateDone(e.target.value)}
          />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={saveEmailTemplates} disabled={emailSaving}>
            {emailSaving ? t(lang, "保存中...", "Saving...") : t(lang, "保存设置", "Save Settings")}
          </button>
          {emailStatus && <div className="status-text">{emailStatus}</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>{t(lang, "检测阈值", "Detection Thresholds")}</h3>
        <p className="mono">
          {t(
            lang,
            "调整离岗/玩手机的判定时间（秒）。",
            "Adjust off-duty and phone-use thresholds (seconds)."
          )}
        </p>
        <div className="settings-row">
          <label className="settings-label" htmlFor="offDutySeconds">
            {t(lang, "离岗判定(秒)", "Off-duty (seconds)")}
          </label>
          <input
            id="offDutySeconds"
            className="settings-input"
            type="number"
            min={5}
            max={3600}
            value={offDutySeconds}
            onChange={(e) => setOffDutySeconds(Number(e.target.value))}
          />
        </div>
        <div className="settings-row">
          <label className="settings-label" htmlFor="phoneUseSeconds">
            {t(lang, "玩手机判定(秒)", "Phone use (seconds)")}
          </label>
          <input
            id="phoneUseSeconds"
            className="settings-input"
            type="number"
            min={1}
            max={3600}
            value={phoneUseSeconds}
            onChange={(e) => setPhoneUseSeconds(Number(e.target.value))}
          />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={saveDetectThresholds} disabled={detectSaving}>
            {detectSaving ? t(lang, "保存中...", "Saving...") : t(lang, "保存设置", "Save Settings")}
          </button>
          {detectStatus && <div className="status-text">{detectStatus}</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>{t(lang, "检测模型参数", "Detection Model Params")}</h3>
        <p className="mono">
          {t(
            lang,
            "调整检测置信度与重叠阈值（IOU）。",
            "Adjust detection confidence and IoU thresholds."
          )}
        </p>
        <div className="settings-row">
          <label className="settings-label" htmlFor="detectConf">
            {t(lang, "置信度阈值", "Confidence")}
          </label>
          <input
            id="detectConf"
            className="settings-input"
            type="number"
            step="0.05"
            min={0.05}
            max={0.95}
            value={detectConf}
            onChange={(e) => setDetectConf(Number(e.target.value))}
          />
        </div>
        <div className="settings-row">
          <label className="settings-label" htmlFor="detectIou">
            {t(lang, "IOU 阈值", "IoU")}
          </label>
          <input
            id="detectIou"
            className="settings-input"
            type="number"
            step="0.05"
            min={0.1}
            max={0.9}
            value={detectIou}
            onChange={(e) => setDetectIou(Number(e.target.value))}
          />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={saveDetectModel} disabled={modelSaving}>
            {modelSaving ? t(lang, "保存中...", "Saving...") : t(lang, "保存设置", "Save Settings")}
          </button>
          {modelStatus && <div className="status-text">{modelStatus}</div>}
        </div>
      </section>
    </DashboardShell>
  );
}
