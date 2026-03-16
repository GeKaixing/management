export function safeParseTime(ts?: string) {
  if (!ts) return null;
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

export function safeTimeString(ts?: string) {
  const d = safeParseTime(ts);
  return d ? d.toLocaleTimeString() : "";
}

export function safeDateString(ts?: string) {
  const d = safeParseTime(ts);
  return d ? d.toLocaleString() : "unknown";
}