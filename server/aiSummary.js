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
      status: device.status || "offline",
      onlineMsToday: Number(device.onlineMsToday || 0),
      requiredHours: Number(device.workHoursPerDay || 0),
      lazy: Boolean(device.laze || device.lazyByWorkHours),
      longOffline
    };
  });

  return {
    now,
    total: reportData.length,
    devices: reportData
  };
}

function buildPrompt(payload) {
  return [
    "You are an operations assistant. Provide a concise, factual summary in Chinese and English.",
    "Rules:",
    "- Only summarize the data given. Do NOT make HR decisions (no firing, promotion, workload changes).",
    "- Highlight risks and trends without judgments.",
    "- Output two sections: Chinese then English.",
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
  const underHours = devices.filter((d) => {
    const requiredMs = Math.max(Number(d.requiredHours || 0), 0) * 60 * 60 * 1000;
    if (!requiredMs) return false;
    return Number(d.onlineMsToday || 0) < requiredMs;
  }).length;

  const zh = [
    "中文摘要：",
    `- 总设备：${total}，在线：${online}，离线：${offline}（长时间离线：${longOffline}）`,
    `- 疑似偷懒：${lazy}`,
    `- 今日在线不足（低于要求）：${underHours}`
  ].join("\n");

  const en = [
    "English Summary:",
    `- Total devices: ${total}, online: ${online}, offline: ${offline} (long offline: ${longOffline})`,
    `- Potentially idle: ${lazy}`,
    `- Under required hours today: ${underHours}`
  ].join("\n");

  return `${zh}\n\n${en}`;
}

module.exports = {
  buildReportPayload,
  buildPrompt,
  buildFallbackSummary
};
