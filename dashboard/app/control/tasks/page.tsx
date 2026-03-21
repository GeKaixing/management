"use client";

import { useEffect, useState } from "react";
import DashboardShell from "../../components/DashboardShell";
import ControlNav from "../ControlNav";
import { useLang, t } from "../../../lib/i18n";
import { createTask, getTasks, runTask, approveTask, type ControlTask } from "../../../lib/controlApi";

type RiskLevel = "low" | "medium" | "high" | "critical";

export default function ControlTasksPage() {
  const { lang, setLang } = useLang();
  const [tasks, setTasks] = useState<ControlTask[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState("postgres");
  const [action, setAction] = useState("sql_read");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");
  const [sql, setSql] = useState("SELECT id, name, kind, status FROM cp_subsystems");

  async function loadData() {
    setLoading(true);
    try {
      const items = await getTasks({ limit: 100 });
      setTasks(items);
    } catch (e) {
      setStatus(`${t(lang, "加载失败", "Load failed")}: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 7000);
    return () => clearInterval(timer);
  }, []);

  async function createPostgresTask() {
    setStatus(null);
    if (!sql.trim()) {
      setStatus(t(lang, "请输入 SQL", "Please input SQL"));
      return;
    }
    try {
      await createTask({
        target,
        action,
        riskLevel,
        payload: { sql: sql.trim() }
      });
      setStatus(t(lang, "任务已创建", "Task created"));
      await loadData();
    } catch (e) {
      setStatus(`${t(lang, "创建失败", "Create failed")}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  async function run(taskId: string) {
    setStatus(null);
    try {
      await runTask(taskId);
      setStatus(t(lang, "任务执行完成", "Task executed"));
      await loadData();
    } catch (e) {
      setStatus(`${t(lang, "执行失败", "Run failed")}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  async function approve(taskId: string) {
    setStatus(null);
    try {
      await approveTask(taskId);
      setStatus(t(lang, "审批并执行成功", "Approved and executed"));
      await loadData();
    } catch (e) {
      setStatus(`${t(lang, "审批失败", "Approval failed")}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "控制平面 - 任务", "Control Plane - Tasks")}>
      <ControlNav lang={lang} />

      <section className="card">
        <h3>{t(lang, "创建任务", "Create Task")}</h3>
        <div className="settings-row">
          <label className="settings-label">{t(lang, "目标", "Target")}</label>
          <select className="settings-input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="postgres">postgres</option>
          </select>
        </div>
        <div className="settings-row">
          <label className="settings-label">{t(lang, "动作", "Action")}</label>
          <select className="settings-input" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="sql_read">sql_read</option>
            <option value="sql_write">sql_write</option>
          </select>
        </div>
        <div className="settings-row">
          <label className="settings-label">{t(lang, "风险级别", "Risk Level")}</label>
          <select className="settings-input" value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </div>
        <div className="settings-row">
          <label className="settings-label">SQL</label>
          <textarea className="settings-input settings-input--wide" rows={4} value={sql} onChange={(e) => setSql(e.target.value)} />
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={createPostgresTask}>{t(lang, "创建", "Create")}</button>
          <button className="ghost-button" type="button" onClick={loadData} disabled={loading}>{loading ? t(lang, "刷新中", "Refreshing") : t(lang, "刷新", "Refresh")}</button>
          {status && <div className="status-text">{status}</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>{t(lang, "任务列表", "Task List")}</h3>
        <div className="report-table-wrap">
          <table className="table report-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t(lang, "目标", "Target")}</th>
                <th>{t(lang, "动作", "Action")}</th>
                <th>{t(lang, "风险", "Risk")}</th>
                <th>{t(lang, "状态", "Status")}</th>
                <th>{t(lang, "错误", "Error")}</th>
                <th>{t(lang, "操作", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td className="mono">{task.id}</td>
                  <td>{task.target}</td>
                  <td>{task.action}</td>
                  <td>{task.riskLevel}</td>
                  <td>{task.status}</td>
                  <td>{task.error || "-"}</td>
                  <td>
                    <div className="report-actions">
                      {task.status === "pending_approval" ? (
                        <button className="button report-button-sm" type="button" onClick={() => approve(task.id)}>
                          {t(lang, "审批执行", "Approve")}
                        </button>
                      ) : (
                        <button
                          className="ghost-button report-button-sm"
                          type="button"
                          onClick={() => run(task.id)}
                          disabled={task.status === "completed"}
                        >
                          {t(lang, "执行", "Run")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={7}>{t(lang, "暂无数据", "No data")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
