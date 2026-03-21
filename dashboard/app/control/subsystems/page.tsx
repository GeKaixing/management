"use client";

import { useEffect, useState } from "react";
import DashboardShell from "../../components/DashboardShell";
import ControlNav from "../ControlNav";
import { useLang, t } from "../../../lib/i18n";
import { getSubsystems, upsertSubsystem, type Subsystem } from "../../../lib/controlApi";

export default function ControlSubsystemsPage() {
  const { lang, setLang } = useLang();
  const [subsystems, setSubsystems] = useState<Subsystem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("generic");
  const [baseUrl, setBaseUrl] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [subStatus, setSubStatus] = useState<"active" | "inactive">("active");

  async function loadData() {
    setLoading(true);
    try {
      const items = await getSubsystems();
      setSubsystems(items);
    } catch (e) {
      setStatus(`${t(lang, "加载失败", "Load failed")}: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveSubsystem() {
    setStatus(null);
    if (!id.trim() || !name.trim() || !kind.trim()) {
      setStatus(t(lang, "请填写 id/name/kind", "Please fill id/name/kind"));
      return;
    }
    try {
      await upsertSubsystem({
        id: id.trim(),
        name: name.trim(),
        kind: kind.trim(),
        baseUrl: baseUrl.trim() || undefined,
        capabilities: capabilities
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        status: subStatus
      });
      setStatus(t(lang, "保存成功", "Saved"));
      await loadData();
    } catch (e) {
      setStatus(`${t(lang, "保存失败", "Save failed")}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  return (
    <DashboardShell lang={lang} setLang={setLang} title={t(lang, "控制平面 - 子系统", "Control Plane - Subsystems")}>
      <ControlNav lang={lang} />

      <section className="card">
        <h3>{t(lang, "注册/更新子系统", "Register/Update Subsystem")}</h3>
        <div className="settings-row">
          <label className="settings-label">ID</label>
          <input className="settings-input settings-input--wide" value={id} onChange={(e) => setId(e.target.value)} placeholder="frappe-hr" />
        </div>
        <div className="settings-row">
          <label className="settings-label">{t(lang, "名称", "Name")}</label>
          <input className="settings-input settings-input--wide" value={name} onChange={(e) => setName(e.target.value)} placeholder="Frappe HR" />
        </div>
        <div className="settings-row">
          <label className="settings-label">Kind</label>
          <input className="settings-input settings-input--wide" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="hr" />
        </div>
        <div className="settings-row">
          <label className="settings-label">Base URL</label>
          <input className="settings-input settings-input--wide" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://frappe-hr:8000" />
        </div>
        <div className="settings-row">
          <label className="settings-label">{t(lang, "能力", "Capabilities")}</label>
          <input className="settings-input settings-input--wide" value={capabilities} onChange={(e) => setCapabilities(e.target.value)} placeholder="employee_query,employee_update" />
        </div>
        <div className="settings-row">
          <label className="settings-label">{t(lang, "状态", "Status")}</label>
          <select className="settings-input" value={subStatus} onChange={(e) => setSubStatus(e.target.value as "active" | "inactive")}>
            <option value="active">{t(lang, "启用", "Active")}</option>
            <option value="inactive">{t(lang, "停用", "Inactive")}</option>
          </select>
        </div>
        <div className="settings-actions">
          <button className="button" type="button" onClick={saveSubsystem}>{t(lang, "保存", "Save")}</button>
          <button className="ghost-button" type="button" onClick={loadData} disabled={loading}>{loading ? t(lang, "刷新中", "Refreshing") : t(lang, "刷新", "Refresh")}</button>
          {status && <div className="status-text">{status}</div>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3>{t(lang, "子系统列表", "Subsystem List")}</h3>
        <div className="report-table-wrap">
          <table className="table report-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t(lang, "名称", "Name")}</th>
                <th>Kind</th>
                <th>Base URL</th>
                <th>{t(lang, "状态", "Status")}</th>
                <th>{t(lang, "能力", "Capabilities")}</th>
              </tr>
            </thead>
            <tbody>
              {subsystems.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.kind}</td>
                  <td className="mono">{item.baseUrl || "-"}</td>
                  <td>{item.status}</td>
                  <td>{(item.capabilities || []).join(", ") || "-"}</td>
                </tr>
              ))}
              {subsystems.length === 0 && (
                <tr>
                  <td colSpan={6}>{t(lang, "暂无数据", "No data")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
