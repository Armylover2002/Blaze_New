/**
 * Porter schedule timezone helpers.
 * Browsers in India may report Asia/Calcutta (legacy IANA); always persist Asia/Kolkata.
 */
export function getPorterClientTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    if (tz === "Asia/Calcutta" || tz === "local") return "Asia/Kolkata";
    return tz;
  } catch {
    return "Asia/Kolkata";
  }
}

export function normalizePorterTimezone(tz) {
  if (!tz || tz === "local") return "Asia/Kolkata";
  if (String(tz) === "Asia/Calcutta") return "Asia/Kolkata";
  return String(tz);
}
