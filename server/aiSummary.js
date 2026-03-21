function buildReportPayload(devicesList, nowMs, longOfflineMs) {
  const now = new Date(nowMs).toISOString();
  const reportData = (devicesList || []).map((device) => {
    const lastTs = device.lastSeen
      ? device.lastSeen
      : device.offlineAt
        ? Date.parse(device.offlineAt)
        : null;
    const longOffline =
      device.status === "offline" && (!lastTs || nowMs - lastTs >= longOfflineMs);
    return {
      id: device.id,
      name: device.name || null,
      displayName: device.name || device.id,
      status: device.status || "offline",
      onlineMsToday: Number(device.onlineMsToday || 0),
      requiredHours: Number(device.workHoursPerDay || 0),
      onlineHoursToday: Number((Number(device.onlineMsToday || 0) / 3600000).toFixed(2)),
      requiredMs: Math.max(Number(device.workHoursPerDay || 0), 0) * 60 * 60 * 1000,
      lazy: Boolean(device.laze || device.lazyByWorkHours),
      longOffline,
      lastSeen: device.lastSeen || null,
      source: device.source || null
    };
  });

  const withRates = reportData.map((item) => {
    const attendanceRate = item.requiredMs > 0
      ? Number(((item.onlineMsToday / item.requiredMs) * 100).toFixed(1))
      : null;
    return { ...item, attendanceRate };
  });

  return {
    now,
    total: withRates.length,
    online: withRates.filter((d) => d.status === "online").length,
    offline: withRates.filter((d) => d.status !== "online").length,
    devices: withRates
  };
}

function buildPrompt(payload) {
  return [
    "你是考勤与工作状态分析助手。请输出“今日员工工作情况报告”（中文）。",
    "必须遵守：",
    "- 只能基于给定数据，不能杜撰。",
    "- 不允许给出开除、降薪等HR决策。",
    "- 必须覆盖每一位员工（每个设备一条）。",
    "- 语气简洁、管理者可直接阅读。",
    "",
    "输出格式（严格按此结构）：",
    "【今日总览】",
    "- 在线/离线设备数",
    "- 今日达标人数（onlineMsToday >= requiredHours）",
    "- 重点风险人数（lazy=true 或 longOffline=true）",
    "",
    "【员工逐项情况】",
    "- <姓名或设备ID>：在线X小时（要求Y小时，达成Z%），状态<在线/离线>，风险<低/中/高>，说明<一句话>",
    "",
    "【管理建议（仅3条）】",
    "1) ...",
    "2) ...",
    "3) ...",
    "",
    "DATA:",
    JSON.stringify(payload)
  ].join("\n");
}

function buildFallbackSummary(payload) {
  const devices = payload.devices || [];
  const total = devices.length;
  const online = devices.filter((d) => d.status === "online").length;
  const offline = total - online;
  const lazy = devices.filter((d) => d.lazy).length;
  const longOffline = devices.filter((d) => d.longOffline).length;
  const metHours = devices.filter((d) => {
    const requiredMs = Math.max(Number(d.requiredHours || 0), 0) * 60 * 60 * 1000;
    if (!requiredMs) return true;
    return Number(d.onlineMsToday || 0) >= requiredMs;
  }).length;
  const underHours = Math.max(0, total - metHours);

  const rows = devices.map((d) => {
    const hours = Number((Number(d.onlineMsToday || 0) / 3600000).toFixed(2));
    const required = Number(d.requiredHours || 0);
    const rate = required > 0 ? Number(((hours / required) * 100).toFixed(1)) : null;
    const highRisk = Boolean(d.longOffline || d.lazy);
    const midRisk = !highRisk && d.status !== "online";
    const risk = highRisk ? "高" : midRisk ? "中" : "低";
    const reason = d.longOffline
      ? "长时间离线"
      : d.lazy
        ? "活跃度偏低"
        : d.status === "online"
          ? "当前在线"
          : "当前离线";
    return `- ${d.displayName || d.id}：在线${hours}小时（要求${required}小时，达成${rate ?? "n/a"}%），状态${d.status === "online" ? "在线" : "离线"}，风险${risk}，说明${reason}`;
  });

  const zh = [
    "【今日总览】",
    `- 在线/离线设备：${online}/${offline}`,
    `- 今日达标人数：${metHours}/${total}`,
    `- 重点风险人数：${lazy + longOffline}（活跃度偏低${lazy}，长时间离线${longOffline}）`,
    "",
    "【员工逐项情况】",
    ...rows,
    "",
    "【管理建议（仅3条）】",
    `1) 优先跟进风险为高的员工，确认离线或低活跃原因。`,
    `2) 对未达标员工（${underHours}人）明确今日剩余时段目标。`,
    "3) 明日继续按同口径追踪在线时长与活跃度变化。"
  ].join("\n");

  return zh;
}

module.exports = {
  buildReportPayload,
  buildPrompt,
  buildFallbackSummary
};
