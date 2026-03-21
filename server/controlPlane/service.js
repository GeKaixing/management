const crypto = require("crypto");
const { query, checkDbHealth } = require("./db");

const HIGH_RISK_ACTIONS = new Set(["sql_write", "subsystem_command"]);
const BLOCKED_SQL = /\b(drop|truncate|alter|grant|revoke|create\s+role|create\s+user)\b/i;

function toId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function normalizeRisk(input) {
  const risk = String(input || "low").toLowerCase();
  if (["low", "medium", "high", "critical"].includes(risk)) return risk;
  return "low";
}

function requiresApproval(action, riskLevel) {
  return riskLevel === "high" || riskLevel === "critical" || HIGH_RISK_ACTIONS.has(action);
}

function ensureSingleStatement(sql) {
  const text = String(sql || "").trim();
  if (!text) throw new Error("empty_sql");
  const compact = text.replace(/\s+/g, " ");
  if (compact.includes(";")) throw new Error("single_statement_only");
  if (BLOCKED_SQL.test(compact)) throw new Error("blocked_sql_keyword");
  return compact;
}

async function appendAudit({ actor = "system", operation, target = null, detail = {} }) {
  const id = toId("audit");
  await query(
    `INSERT INTO cp_audit_logs (id, actor, operation, target, detail)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [id, actor, operation, target, JSON.stringify(detail || {})]
  );
}

async function listSubsystems() {
  const res = await query(
    `SELECT id, name, kind, base_url AS "baseUrl", status, capabilities, metadata, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM cp_subsystems
     ORDER BY created_at DESC`
  );
  return res.rows;
}

async function upsertSubsystem(input, actor) {
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim();
  const kind = String(input.kind || "").trim();
  if (!id || !name || !kind) throw new Error("id_name_kind_required");

  const baseUrl = input.baseUrl ? String(input.baseUrl).trim() : null;
  const status = input.status === "inactive" ? "inactive" : "active";
  const capabilities = Array.isArray(input.capabilities) ? input.capabilities : [];
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const apiKey = input.apiKey ? String(input.apiKey).trim() : null;

  const res = await query(
    `INSERT INTO cp_subsystems (id, name, kind, base_url, api_key, status, capabilities, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       kind = EXCLUDED.kind,
       base_url = EXCLUDED.base_url,
       api_key = COALESCE(EXCLUDED.api_key, cp_subsystems.api_key),
       status = EXCLUDED.status,
       capabilities = EXCLUDED.capabilities,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING id, name, kind, base_url AS "baseUrl", status, capabilities, metadata, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, name, kind, baseUrl, apiKey, status, JSON.stringify(capabilities), JSON.stringify(metadata)]
  );

  await appendAudit({
    actor,
    operation: "subsystem_upsert",
    target: id,
    detail: { name, kind, baseUrl, status }
  });
  return res.rows[0];
}

async function listTasks({ status, limit = 50 }) {
  const rowsLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  if (status) {
    const res = await query(
      `SELECT id, source, target, action, payload, risk_level AS "riskLevel", status, requires_approval AS "requiresApproval",
              approved_by AS "approvedBy", executed_at AS "executedAt", result, error, created_at AS "createdAt"
       FROM cp_tasks
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [status, rowsLimit]
    );
    return res.rows;
  }
  const res = await query(
    `SELECT id, source, target, action, payload, risk_level AS "riskLevel", status, requires_approval AS "requiresApproval",
            approved_by AS "approvedBy", executed_at AS "executedAt", result, error, created_at AS "createdAt"
     FROM cp_tasks
     ORDER BY created_at DESC
     LIMIT $1`,
    [rowsLimit]
  );
  return res.rows;
}

async function createTask(input, actor) {
  const target = String(input.target || "").trim();
  const action = String(input.action || "").trim();
  if (!target || !action) throw new Error("target_action_required");

  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  const riskLevel = normalizeRisk(input.riskLevel);
  const approvalRequired = requiresApproval(action, riskLevel);
  const status = approvalRequired ? "pending_approval" : "queued";
  const id = toId("task");

  const res = await query(
    `INSERT INTO cp_tasks (id, source, target, action, payload, risk_level, status, requires_approval)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
     RETURNING id, source, target, action, payload, risk_level AS "riskLevel", status, requires_approval AS "requiresApproval",
               approved_by AS "approvedBy", executed_at AS "executedAt", result, error, created_at AS "createdAt"`,
    [id, "ai", target, action, JSON.stringify(payload), riskLevel, status, approvalRequired]
  );

  await appendAudit({
    actor,
    operation: "task_created",
    target: id,
    detail: { target, action, riskLevel, approvalRequired }
  });

  return res.rows[0];
}

async function fetchTask(taskId) {
  const res = await query(
    `SELECT id, source, target, action, payload, risk_level AS "riskLevel", status, requires_approval AS "requiresApproval",
            approved_by AS "approvedBy", executed_at AS "executedAt", result, error, created_at AS "createdAt"
     FROM cp_tasks
     WHERE id = $1
     LIMIT 1`,
    [taskId]
  );
  return res.rows[0] || null;
}

async function executePostgresTask(task) {
  const sql = ensureSingleStatement(task.payload && task.payload.sql);
  const isRead = /^select\s+/i.test(sql);
  if (task.action === "sql_read" && !isRead) throw new Error("sql_read_requires_select");
  if (task.action === "sql_write" && isRead) throw new Error("sql_write_requires_mutation");
  if (!["sql_read", "sql_write"].includes(task.action)) throw new Error("unsupported_postgres_action");

  const response = await query(sql);
  return {
    rowCount: response.rowCount || 0,
    rows: Array.isArray(response.rows) ? response.rows.slice(0, 200) : []
  };
}

async function executeSubsystemTask(task) {
  const subsystemId = task.target.replace(/^subsystem:/, "");
  const sub = await query(
    `SELECT id, base_url AS "baseUrl", api_key AS "apiKey", status FROM cp_subsystems WHERE id = $1 LIMIT 1`,
    [subsystemId]
  );
  const subsystem = sub.rows[0];
  if (!subsystem) throw new Error("subsystem_not_found");
  if (subsystem.status !== "active") throw new Error("subsystem_inactive");
  if (!subsystem.baseUrl) throw new Error("subsystem_base_url_required");

  const method = String((task.payload && task.payload.method) || "POST").toUpperCase();
  const path = String((task.payload && task.payload.path) || "/").trim();
  const body = task.payload && task.payload.body ? task.payload.body : {};
  const targetUrl = new URL(path, subsystem.baseUrl).toString();

  const headers = { "Content-Type": "application/json" };
  if (subsystem.apiKey) headers.Authorization = `Bearer ${subsystem.apiKey}`;
  const response = await fetch(targetUrl, { method, headers, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`subsystem_error_${response.status}`);
  }
  return {
    subsystemId,
    status: response.status,
    data
  };
}

async function executeTask(taskId, actor) {
  const task = await fetchTask(taskId);
  if (!task) throw new Error("task_not_found");
  if (task.status === "completed") return task;

  let result;
  try {
    if (task.target === "postgres") {
      result = await executePostgresTask(task);
    } else if (task.target.startsWith("subsystem:")) {
      result = await executeSubsystemTask(task);
    } else {
      throw new Error("unsupported_target");
    }

    await query(
      `UPDATE cp_tasks
       SET status = 'completed', result = $2::jsonb, executed_at = NOW(), error = NULL
       WHERE id = $1`,
      [taskId, JSON.stringify(result)]
    );

    await appendAudit({
      actor,
      operation: "task_executed",
      target: taskId,
      detail: { target: task.target, action: task.action }
    });
  } catch (error) {
    await query(
      `UPDATE cp_tasks
       SET status = 'failed', error = $2, executed_at = NOW()
       WHERE id = $1`,
      [taskId, error.message || "task_failed"]
    );
    await appendAudit({
      actor,
      operation: "task_failed",
      target: taskId,
      detail: { error: error.message || "task_failed" }
    });
    throw error;
  }

  return fetchTask(taskId);
}

async function approveAndExecute(taskId, actor) {
  const task = await fetchTask(taskId);
  if (!task) throw new Error("task_not_found");
  if (!task.requiresApproval) return executeTask(taskId, actor);
  if (task.status !== "pending_approval") throw new Error("task_not_pending_approval");

  await query(`UPDATE cp_tasks SET status = 'approved', approved_by = $2 WHERE id = $1`, [taskId, actor]);
  await appendAudit({
    actor,
    operation: "task_approved",
    target: taskId,
    detail: { approvedBy: actor }
  });
  return executeTask(taskId, actor);
}

async function listAuditLogs(limit = 100) {
  const rowsLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const res = await query(
    `SELECT id, actor, operation, target, detail, created_at AS "createdAt"
     FROM cp_audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [rowsLimit]
  );
  return res.rows;
}

async function buildControlReport(hours = 24) {
  const rangeHours = Math.min(Math.max(Number(hours) || 24, 1), 24 * 14);
  const statusRows = await query(
    `SELECT status, COUNT(*)::int AS count
     FROM cp_tasks
     WHERE created_at >= NOW() - ($1 || ' hours')::interval
     GROUP BY status`,
    [String(rangeHours)]
  );
  const riskRows = await query(
    `SELECT risk_level AS "riskLevel", COUNT(*)::int AS count
     FROM cp_tasks
     WHERE created_at >= NOW() - ($1 || ' hours')::interval
     GROUP BY risk_level`,
    [String(rangeHours)]
  );
  const subsystemRows = await query(`SELECT status, COUNT(*)::int AS count FROM cp_subsystems GROUP BY status`);
  const recentAudit = await listAuditLogs(20);
  const health = await checkDbHealth();
  return {
    windowHours: rangeHours,
    db: health,
    tasksByStatus: statusRows.rows,
    tasksByRisk: riskRows.rows,
    subsystemsByStatus: subsystemRows.rows,
    recentAudit
  };
}

module.exports = {
  listSubsystems,
  upsertSubsystem,
  listTasks,
  createTask,
  executeTask,
  approveAndExecute,
  listAuditLogs,
  buildControlReport,
  checkDbHealth
};
