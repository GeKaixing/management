export function getServerUrl() {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("dashboard:serverUrl");
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
}

export function setServerUrl(url) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("dashboard:serverUrl", url);
  }
}
