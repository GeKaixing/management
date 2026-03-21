"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "../../components/DashboardShell";
import ControlNav from "../ControlNav";
import { useLang, t } from "../../../lib/i18n";
import { getControlReport, type ControlReport } from "../../../lib/controlApi";

export default function ControlReportPage() {
  const { lang, setLang } = useLang();
  const [hours, setHours] = useState(24);
  const [report, setReport] = useState<ControlReport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadData(nextHours = hours) {
    setLoading(true);
    setStatus(null);
    try {
      const data = await getControlReport(nextHours);
      setReport(data);
    } catch (e) {
      setStatus(`${t(lang, "加载失败", "Load failed")}: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(24);
  }, []);

  const taskTotal = useMemo(() => {
    return (report?.tasksByStatus || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
  }, [report]);

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "控制平面 - 报告", "Control Plane - Report")}>
      <ControlNav lang={lang} />

      <section className="card">
        <div className="settings-row">
          <label className="settings-label">{t(lang, "统计窗口(小时)", "Window (hours)")}</label>
          <input
            className="settings-input"
            type="number"
            min={1}
            max={336}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={() => loadData(hours)} disabled={loading}>
            {loading ? t(lang, "加载中", "Loading") : t(lang, "生成报告", "Generate")}
          </button>
          {status && <div className="status-text">{status}</div>}
        </div>
      </section>

      <section className="grid report-summary" style={{ marginTop: 24 }}>
        <div className="card">
          <div className="badge">{t(lang, "数据库状态", "Database")}</div>
          <h3>{report?.db?.ok ? t(lang, "正常", "OK") : t(lang, "异常", "Down")}</h3>
          <p className="mono">{report?.db?.url || "-"}</p>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "总任务数", "Total Tasks")}</div>
          <h3>{taskTotal}</h3>
          <p className="mono">{t(lang, "窗口内", "In window")}</p>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "高风险任务", "High Risk Tasks")}</div>
          <h3>
            {(report?.tasksByRisk || [])
              .filter((item) => item.riskLevel === "high" || item.riskLevel === "critical")
              .reduce((sum, item) => sum + Number(item.count || 0), 0)}
          </h3>
          <p className="mono">high + critical</p>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "活跃子系统", "Active Subsystems")}</div>
          <h3>
            {(report?.subsystemsByStatus || [])
              .filter((item) => item.status === "active")
              .reduce((sum, item) => sum + Number(item.count || 0), 0)}
          </h3>
          <p className="mono">{t(lang, "当前状态", "Current state")}</p>
        </div>
      </section>

      <section className="grid" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>{t(lang, "任务状态", "Tasks by Status")}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>{t(lang, "状态", "Status")}</th>
                <th>{t(lang, "数量", "Count")}</th>
              </tr>
            </thead>
            <tbody>
              {(report?.tasksByStatus || []).map((item) => (
                <tr key={`status_${item.status}`}>
                  <td>{item.status}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>{t(lang, "风险分布", "Tasks by Risk")}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>{t(lang, "风险", "Risk")}</th>
                <th>{t(lang, "数量", "Count")}</th>
              </tr>
            </thead>
            <tbody>
              {(report?.tasksByRisk || []).map((item) => (
                <tr key={`risk_${item.riskLevel}`}>
                  <td>{item.riskLevel}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
