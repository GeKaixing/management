const { Pool } = require("pg");

const DEFAULT_PG_URL = "postgres://postgres:postgres@localhost:5432/management";

let pool = null;

function getPgUrl() {
  return process.env.PG_URL || process.env.DATABASE_URL || DEFAULT_PG_URL;
}

function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: getPgUrl(),
    max: Number(process.env.PG_POOL_MAX || 10)
  });
  return pool;
}

async function query(text, params = []) {
  const db = getPool();
  return db.query(text, params);
}

async function initControlPlaneDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS cp_subsystems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      base_url TEXT,
      api_key TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cp_tasks (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'ai',
      target TEXT NOT NULL,
      action TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      risk_level TEXT NOT NULL DEFAULT 'low',
      status TEXT NOT NULL DEFAULT 'queued',
      requires_approval BOOLEAN NOT NULL DEFAULT false,
      approved_by TEXT,
      executed_at TIMESTAMPTZ,
      result JSONB,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cp_audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL DEFAULT 'system',
      operation TEXT NOT NULL,
      target TEXT,
      detail JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function checkDbHealth() {
  try {
    await query("SELECT 1");
    return { ok: true, url: getPgUrl() };
  } catch (error) {
    return { ok: false, url: getPgUrl(), error: error.message || "db_error" };
  }
}

module.exports = {
  query,
  initControlPlaneDb,
  checkDbHealth
};
