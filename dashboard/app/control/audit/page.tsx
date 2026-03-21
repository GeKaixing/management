"use client";

import { useEffect, useState } from "react";
import DashboardShell from "../../components/DashboardShell";
import ControlNav from "../ControlNav";
import { useLang, t } from "../../../lib/i18n";
import { getAudit, type AuditLog } from "../../../lib/controlApi";

export default function ControlAuditPage() {
  const { lang, setLang } = useLang();
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const items = await getAudit(200);
      setAudit(items);
      setStatus(null);
    } catch (e) {
      setStatus(`${t(lang, "加载失败", "Load failed")}: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "控制平面 - 审计", "Control Plane - Audit")}>
      <ControlNav lang={lang} />

      <section className="card">
        <div className="card-title">
          <h3>{t(lang, "审计日志", "Audit Logs")}</h3>
          <button className="ghost-button" type="button" onClick={loadData} disabled={loading}>
            {loading ? t(lang, "刷新中", "Refreshing") : t(lang, "刷新", "Refresh")}
          </button>
        </div>
        {status && <div className="status-text">{status}</div>}
        <div className="report-table-wrap">
          <table className="table report-table">
            <thead>
              <tr>
                <th>{t(lang, "时间", "Time")}</th>
                <th>{t(lang, "操作者", "Actor")}</th>
                <th>{t(lang, "操作", "Operation")}</th>
                <th>{t(lang, "目标", "Target")}</th>
                <th>{t(lang, "详情", "Detail")}</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>{item.actor}</td>
                  <td>{item.operation}</td>
                  <td className="mono">{item.target || "-"}</td>
                  <td className="mono">{JSON.stringify(item.detail || {})}</td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={5}>{t(lang, "暂无数据", "No data")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
