"use client";

import { getServerUrl } from "./serverUrl";

export type Subsystem = {
  id: string;
  name: string;
  kind: string;
  baseUrl?: string | null;
  status: "active" | "inactive";
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type ControlTask = {
  id: string;
  source: string;
  target: string;
  action: string;
  payload: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: string;
  requiresApproval: boolean;
  approvedBy?: string | null;
  executedAt?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actor: string;
  operation: string;
  target?: string | null;
  detail?: Record<string, unknown>;
  createdAt: string;
};

export type ControlReport = {
  windowHours: number;
  db: { ok: boolean; url: string; error?: string };
  tasksByStatus: Array<{ status: string; count: number }>;
  tasksByRisk: Array<{ riskLevel: string; count: number }>;
  subsystemsByStatus: Array<{ status: string; count: number }>;
  recentAudit: AuditLog[];
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { message?: string }).message || "request_failed";
    throw new Error(message);
  }
  return data as T;
}

export async function getControlHealth() {
  const res = await fetch(`${getServerUrl()}/control/health`, { cache: "no-store" });
  return parseJson<{ ok: boolean; db: { ok: boolean; url: string; error?: string } }>(res);
}

export async function getSubsystems() {
  const res = await fetch(`${getServerUrl()}/control/subsystems`, { cache: "no-store" });
  const data = await parseJson<{ subsystems: Subsystem[] }>(res);
  return data.subsystems || [];
}

export async function upsertSubsystem(payload: {
  id: string;
  name: string;
  kind: string;
  baseUrl?: string;
  status?: "active" | "inactive";
  capabilities?: string[];
}) {
  const res = await fetch(`${getServerUrl()}/control/subsystems`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<{ ok: true; subsystem: Subsystem }>(res);
}

export async function getTasks(params?: { status?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query}` : "";
  const res = await fetch(`${getServerUrl()}/control/tasks${suffix}`, { cache: "no-store" });
  const data = await parseJson<{ tasks: ControlTask[] }>(res);
  return data.tasks || [];
}

export async function createTask(payload: {
  target: string;
  action: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  payload: Record<string, unknown>;
}) {
  const res = await fetch(`${getServerUrl()}/control/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<{ ok: true; task: ControlTask }>(res);
}

export async function runTask(taskId: string) {
  const res = await fetch(`${getServerUrl()}/control/tasks/${encodeURIComponent(taskId)}/run`, {
    method: "POST"
  });
  return parseJson<{ ok: true; task: ControlTask }>(res);
}

export async function approveTask(taskId: string) {
  const res = await fetch(`${getServerUrl()}/control/tasks/${encodeURIComponent(taskId)}/approve`, {
    method: "POST"
  });
  return parseJson<{ ok: true; task: ControlTask }>(res);
}

export async function getAudit(limit = 100) {
  const res = await fetch(`${getServerUrl()}/control/audit?limit=${limit}`, { cache: "no-store" });
  const data = await parseJson<{ audit: AuditLog[] }>(res);
  return data.audit || [];
}

export async function getControlReport(hours = 24) {
  const res = await fetch(`${getServerUrl()}/control/report?hours=${hours}`, { cache: "no-store" });
  const data = await parseJson<{ report: ControlReport }>(res);
  return data.report;
}
