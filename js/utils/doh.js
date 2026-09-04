/**
 * DNS.usectl.com - Robust DNS Engine (Fast UDP API + Client DoH Fallback)
 */
import { formatRecordValue } from "./formatters.js";

// Standard DNS Record Type IDs
export const RECORD_TYPE_IDS = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257
};

/**
 * Query a resolver endpoint via backend UDP socket or client DoH
 */
export async function queryResolver(resolver, domain, type = "A", timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = performance.now();

  // 1. Try Backend Socket Resolver (/api/dns) first for 100% accuracy and zero CORS issues
  try {
    const apiUrl = `/api/dns?server=${encodeURIComponent(resolver.ip)}&name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`;
    const apiRes = await fetch(apiUrl, {
      signal: controller.signal,
      cache: "no-store"
    });

    if (apiRes.ok) {
      clearTimeout(timer);
      const data = await apiRes.json();
      if (data.success) {
        return {
          resolverId: resolver.id,
          success: true,
          status: data.status,
          records: data.records,
          primaryValue: data.records[0]?.value || null,
          rawValues: data.records.map((r) => r.value),
          ttl: data.ttl,
          dnssec: false,
          latency: data.latency || Math.round(performance.now() - startTime)
        };
      }
    }
  } catch (e) {
    // Backend API unavailable (e.g. static CDN deploy), continue to DoH fallback below
  }

  // 2. Direct DoH Client-side Fallback
  try {
    let queryUrl = "";
    const headers = { Accept: "application/dns-json" };

    if (resolver.format === "google") {
      queryUrl = `${resolver.url}?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}&cd=false`;
    } else {
      queryUrl = `${resolver.url}?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`;
    }

    const response = await fetch(queryUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
      cache: "no-store",
      mode: "cors"
    });

    clearTimeout(timer);
    const latency = performance.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const parsed = parseDoHResponse(data, type);

    return {
      resolverId: resolver.id,
      success: true,
      status: parsed.status,
      records: parsed.records,
      primaryValue: parsed.records[0]?.value || null,
      rawValues: parsed.records.map((r) => r.value),
      ttl: parsed.minTTL,
      dnssec: data.AD === true,
      latency: Math.round(latency)
    };
  } catch (err) {
    clearTimeout(timer);
    const latency = performance.now() - startTime;
    const isTimeout = err.name === "AbortError";

    return {
      resolverId: resolver.id,
      success: false,
      status: "error",
      error: isTimeout ? "Timeout (>3.5s)" : (err.message || "Query Failed"),
      records: [],
      primaryValue: null,
      rawValues: [],
      ttl: null,
      dnssec: false,
      latency: Math.round(latency)
    };
  }
}

/**
 * Parse standard DoH JSON responses (RFC 8427 / Cloudflare / Google)
 */
function parseDoHResponse(data, requestedType) {
  const rcode = data.Status;
  const targetTypeId = RECORD_TYPE_IDS[requestedType.toUpperCase()] || null;

  if (rcode === 3) {
    return { status: "nxdomain", records: [], minTTL: null };
  }

  if (rcode !== 0 || !data.Answer || data.Answer.length === 0) {
    return { status: "empty", records: [], minTTL: null };
  }

  const records = [];
  let minTTL = Infinity;

  for (const item of data.Answer) {
    const isMatch = targetTypeId ? item.type === targetTypeId : true;
    const isCNAME = item.type === 5;

    if (isMatch || isCNAME) {
      const formatted = formatRecordValue(item.data, requestedType);
      records.push({
        value: formatted,
        ttl: item.TTL,
        type: item.type === 5 ? "CNAME" : requestedType
      });

      if (item.TTL && item.TTL < minTTL) {
        minTTL = item.TTL;
      }
    }
  }

  if (minTTL === Infinity) minTTL = null;

  return {
    status: records.length > 0 ? "synced" : "empty",
    records,
    minTTL
  };
}
