const express = require("express");
const {
  listSubsystems,
  upsertSubsystem,
  listTasks,
  createTask,
  executeTask,
  approveAndExecute,
  listAuditLogs,
  buildControlReport,
  checkDbHealth
} = require("./service");

const router = express.Router();

function verifyAdmin(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return next();
  const token = req.headers["x-admin-token"];
  if (token !== expected) return res.status(401).json({ error: "admin_unauthorized" });
  return next();
}

function actorFromReq(req) {
  const actor = req.headers["x-admin-user"];
  if (typeof actor === "string" && actor.trim()) return actor.trim();
  return "admin";
}

router.use(verifyAdmin);

router.get("/health", async (req, res) => {
  const db = await checkDbHealth();
  return res.status(db.ok ? 200 : 503).json({ ok: db.ok, db });
});

router.get("/subsystems", async (req, res) => {
  try {
    const subsystems = await listSubsystems();
    return res.json({ subsystems });
  } catch (error) {
    return res.status(500).json({ error: "subsystems_fetch_failed", message: error.message });
  }
});

router.post("/subsystems", async (req, res) => {
  try {
    const subsystem = await upsertSubsystem(req.body || {}, actorFromReq(req));
    return res.json({ ok: true, subsystem });
  } catch (error) {
    if (error.message === "id_name_kind_required") {
      return res.status(400).json({ error: "id_name_kind_required" });
    }
    return res.status(500).json({ error: "subsystem_upsert_failed", message: error.message });
  }
});

router.get("/tasks", async (req, res) => {
  try {
    const tasks = await listTasks({
      status: req.query.status ? String(req.query.status) : null,
      limit: req.query.limit ? Number(req.query.limit) : 50
    });
    return res.json({ tasks });
  } catch (error) {
    return res.status(500).json({ error: "tasks_fetch_failed", message: error.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const task = await createTask(req.body || {}, actorFromReq(req));
    return res.json({ ok: true, task });
  } catch (error) {
    if (error.message === "target_action_required") {
      return res.status(400).json({ error: "target_action_required" });
    }
    return res.status(500).json({ error: "task_create_failed", message: error.message });
  }
});

router.post("/tasks/:id/run", async (req, res) => {
  try {
    const task = await executeTask(req.params.id, actorFromReq(req));
    return res.json({ ok: true, task });
  } catch (error) {
    if (error.message === "task_not_found") return res.status(404).json({ error: "task_not_found" });
    return res.status(400).json({ error: "task_run_failed", message: error.message });
  }
});

router.post("/tasks/:id/approve", async (req, res) => {
  try {
    const task = await approveAndExecute(req.params.id, actorFromReq(req));
    return res.json({ ok: true, task });
  } catch (error) {
    if (error.message === "task_not_found") return res.status(404).json({ error: "task_not_found" });
    return res.status(400).json({ error: "task_approve_failed", message: error.message });
  }
});

router.get("/audit", async (req, res) => {
  try {
    const audit = await listAuditLogs(req.query.limit ? Number(req.query.limit) : 100);
    return res.json({ audit });
  } catch (error) {
    return res.status(500).json({ error: "audit_fetch_failed", message: error.message });
  }
});

router.get("/report", async (req, res) => {
  try {
    const report = await buildControlReport(req.query.hours ? Number(req.query.hours) : 24);
    return res.json({ report });
  } catch (error) {
    return res.status(500).json({ error: "report_failed", message: error.message });
  }
});

module.exports = router;
