"use client";

import { useEffect, useState } from "react";
import DashboardShell from "../components/DashboardShell";
import ControlNav from "./ControlNav";
import { useLang, t } from "../../lib/i18n";
import { getControlHealth, getControlReport } from "../../lib/controlApi";

export default function ControlOverviewPage() {
  const { lang, setLang } = useLang();
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [healthText, setHealthText] = useState("-");
  const [statusData, setStatusData] = useState<Array<{ status: string; count: number }>>([]);
  const [riskData, setRiskData] = useState<Array<{ riskLevel: string; count: number }>>([]);
  const [subsystemData, setSubsystemData] = useState<Array<{ status: string; count: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setError(null);
      try {
        const [health, report] = await Promise.all([getControlHealth(), getControlReport(24)]);
        if (!mounted) return;
        setHealthOk(Boolean(health.ok));
        setHealthText(health.db.url || "-");
        setStatusData(report.tasksByStatus || []);
        setRiskData(report.tasksByRisk || []);
        setSubsystemData(report.subsystemsByStatus || []);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "load_failed");
      }
    }

    load();
    const timer = setInterval(load, 10000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "AI 控制平面", "AI Control Plane")}>
      <ControlNav lang={lang} />

      <section className="grid report-summary" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="badge">{t(lang, "数据库健康", "Database Health")}</div>
          <h3>{healthOk === null ? "-" : healthOk ? t(lang, "正常", "OK") : t(lang, "异常", "Down")}</h3>
          <p className="mono">{healthText}</p>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "任务状态数", "Task Status Count")}</div>
          <h3>{statusData.reduce((sum, item) => sum + Number(item.count || 0), 0)}</h3>
          <p className="mono">{t(lang, "最近 24 小时", "Last 24 hours")}</p>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "风险任务数", "Risk Tasks")}</div>
          <h3>{riskData.reduce((sum, item) => sum + Number(item.count || 0), 0)}</h3>
          <p className="mono">{t(lang, "按风险级别汇总", "Grouped by risk level")}</p>
        </div>
        <div className="card">
          <div className="badge">{t(lang, "子系统数", "Subsystems")}</div>
          <h3>{subsystemData.reduce((sum, item) => sum + Number(item.count || 0), 0)}</h3>
          <p className="mono">{t(lang, "活跃与停用", "Active and inactive")}</p>
        </div>
      </section>

      {error && (
        <section className="card">
          <div className="status-text">{t(lang, "加载失败", "Load failed")}: {error}</div>
        </section>
      )}

      <section className="grid">
        <div className="card">
          <h3>{t(lang, "任务状态分布", "Task Status Distribution")}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>{t(lang, "状态", "Status")}</th>
                <th>{t(lang, "数量", "Count")}</th>
              </tr>
            </thead>
            <tbody>
              {statusData.map((item) => (
                <tr key={`status_${item.status}`}>
                  <td>{item.status}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
              {statusData.length === 0 && (
                <tr>
                  <td colSpan={2}>{t(lang, "暂无数据", "No data")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>{t(lang, "任务风险分布", "Task Risk Distribution")}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>{t(lang, "风险", "Risk")}</th>
                <th>{t(lang, "数量", "Count")}</th>
              </tr>
            </thead>
            <tbody>
              {riskData.map((item) => (
                <tr key={`risk_${item.riskLevel}`}>
                  <td>{item.riskLevel}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
              {riskData.length === 0 && (
                <tr>
                  <td colSpan={2}>{t(lang, "暂无数据", "No data")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
