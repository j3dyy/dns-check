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
        const targetRec = data.records.find((r) => r.type === type) || data.records[0];
        return {
          resolverId: resolver.id,
          success: true,
          status: data.status,
          records: data.records,
          primaryValue: targetRec?.value || null,
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
    const targetRec = parsed.records.find((r) => r.type === type) || parsed.records[0];

    return {
      resolverId: resolver.id,
      success: true,
      status: parsed.status,
      records: parsed.records,
      primaryValue: targetRec?.value || null,
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
      status: isTimeout ? "timeout" : "error",
      error: isTimeout ? "Query timed out (>3.5s)" : err.message,
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
 * Fetch complete DNS Zone records overview for a domain (MX, NS, CNAME, TXT, A, AAAA, CAA, SOA)
 */
export async function fetchZoneRecords(domain) {
  if (!domain) return null;
  const clean = domain.trim().toLowerCase();

  // 1. Try Backend UDP endpoint first (fast parallel socket queries)
  try {
    const res = await fetch(`/api/records?domain=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return data;
      }
    }
  } catch (e) {
    // Backend unavailable, fallback to client DoH below
  }

  // 2. Client DoH fallback (Cloudflare DNS over HTTPS)
  const types = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "CAA", "SOA"];
  const results = {};
  let totalCount = 0;

  await Promise.allSettled(
    types.map(async (t) => {
      try {
        const dohRes = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(clean)}&type=${t}`,
          { headers: { Accept: "application/dns-json" } }
        );
        if (dohRes.ok) {
          const data = await dohRes.json();
          const parsed = parseDoHResponse(data, t);
          results[t] = parsed.records || [];
          totalCount += results[t].length;
        } else {
          results[t] = [];
        }
      } catch {
        results[t] = [];
      }
    })
  );

  return {
    success: true,
    domain: clean,
    records: results,
    totalCount
  };
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
