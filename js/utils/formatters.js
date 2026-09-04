/**
 * DNS.usectl.com - UI Formatters & Domain Helpers
 */

export function cleanDomain(input = "") {
  let d = input.trim().toLowerCase();
  // Strip protocol
  d = d.replace(/^https?:\/\//i, "");
  // Strip paths, query strings, fragments, and ports
  d = d.split("/")[0].split("?")[0].split("#")[0].split(":")[0];
  // Remove leading/trailing dots
  d = d.replace(/^\.+|\.+$/g, "");
  return d;
}

export function isValidDomain(domain = "") {
  if (!domain || domain.length < 3 || domain.length > 253) return false;
  // Allow IPv4 directly
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  if (ipv4Regex.test(domain)) return true;
  // Domain regex
  const domainRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;
  return domainRegex.test(domain);
}

export function formatTTL(seconds) {
  if (seconds === undefined || seconds === null) return "-";
  const s = parseInt(seconds, 10);
  if (isNaN(s)) return "-";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60 ? `${s % 60}s` : ""}`.trim();
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return `${hours}h ${mins ? `${mins}m` : ""}`.trim();
}

export function formatLatency(ms) {
  if (ms === undefined || ms === null || isNaN(ms)) return "-";
  const roundMs = Math.round(ms);
  let status = "fast";
  if (roundMs > 350) status = "slow";
  else if (roundMs > 150) status = "medium";
  return {
    label: `${roundMs}ms`,
    status,
    value: roundMs
  };
}

export function formatRecordValue(data, type) {
  if (!data) return "";
  let val = String(data).trim();

  // Strip enclosing quotes from TXT records
  if (type === "TXT") {
    val = val.replace(/^["']|["']$/g, "");
  }
  // Strip trailing dot from CNAME, MX, NS
  if (["CNAME", "NS", "MX"].includes(type)) {
    val = val.replace(/\.$/, "");
  }
  return val;
}
