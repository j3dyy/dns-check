/**
 * DNS.usectl.com - Reactive State Store
 */
import { queryResolver, fetchZoneRecords } from "./utils/doh.js";
import { cleanDomain, isValidDomain } from "./utils/formatters.js";

class DNSStore {
  constructor() {
    this.domain = "";
    this.recordType = "A";
    this.expectedValue = "";
    this.theme = localStorage.getItem("dns_theme") || "dark";
    this.viewMode = "grid"; // "grid" | "nslookup"
    
    this.resolvers = [];
    this.regions = [];
    this.results = {};
    this.sslInfo = null;
    this.zoneRecords = null;
    this.isLoadingZone = false;
    this.isLoading = false;
    
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(action = null) {
    for (const listener of this.listeners) {
      listener(this, action);
    }
  }

  async loadResolvers() {
    try {
      const res = await fetch("./data/resolvers.json");
      const data = await res.json();
      this.resolvers = data.resolvers || [];
      this.regions = data.regions || [];
      this.notify({ type: "resolvers-loaded" });
    } catch (err) {
      console.error("[DNS.usectl.com] Failed to load resolvers:", err);
    }
  }

  setDomain(domain) {
    this.domain = cleanDomain(domain);
    this.updateUrlParams();
  }

  setRecordType(type) {
    this.recordType = type.toUpperCase();
    this.updateUrlParams();
    if (this.domain && isValidDomain(this.domain)) {
      this.queryAll();
    } else {
      this.notify({ type: "record-type-changed" });
    }
  }

  setExpectedValue(val) {
    this.expectedValue = val.trim();
    this.notify({ type: "expected-updated" });
  }

  setViewMode(mode) {
    if (mode !== "grid" && mode !== "nslookup") return;
    this.viewMode = mode;
    this.updateUrlParams();
    this.notify({ type: "view-mode-changed", viewMode: mode });
  }

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    localStorage.setItem("dns_theme", this.theme);
    document.documentElement.setAttribute("data-theme", this.theme);
    this.notify({ type: "theme-toggled" });
  }

  updateUrlParams() {
    const url = new URL(window.location);
    if (this.domain) {
      url.searchParams.set("d", this.domain);
    } else {
      url.searchParams.delete("d");
      url.searchParams.delete("q");
    }
    if (this.recordType && this.recordType !== "A") {
      url.searchParams.set("t", this.recordType);
    } else if (!this.domain) {
      url.searchParams.delete("t");
      url.searchParams.delete("type");
    }
    if (this.viewMode && this.viewMode !== "grid") {
      url.searchParams.set("view", this.viewMode);
    } else {
      url.searchParams.delete("view");
    }
    window.history.replaceState({}, "", url);
  }

  parseUrlParams() {
    const url = new URL(window.location);
    const d = url.searchParams.get("d") || url.searchParams.get("q");
    const t = url.searchParams.get("t") || url.searchParams.get("type");
    const v = url.searchParams.get("view");
    if (d) this.domain = cleanDomain(d);
    if (t) this.recordType = t.toUpperCase();
    if (v === "nslookup" || v === "grid") this.viewMode = v;
  }

  async queryAll() {
    if (!this.domain || !isValidDomain(this.domain)) return;

    this.isLoading = true;
    this.sslInfo = null;
    this.notify({ type: "start-probing" });

    // Trigger SSL inspection & Zone records discovery concurrently
    this.fetchSSLInfo(this.domain);
    this.fetchZone(this.domain);

    // Target type for 16 edge resolvers (if 'ALL', defaults edge cards to 'A' record)
    const probeType = this.recordType === "ALL" ? "A" : this.recordType;

    // Query all DoH resolvers concurrently
    const promises = this.resolvers.map(async (resolver) => {
      const result = await queryResolver(resolver, this.domain, probeType);
      this.results[resolver.id] = result;
      this.notify({ type: "resolver-update", resolverId: resolver.id });
    });

    await Promise.allSettled(promises);
    this.isLoading = false;
    this.notify({ type: "finished-probing" });
  }

  async fetchZone(domain) {
    if (!domain || !isValidDomain(domain)) return;
    this.isLoadingZone = true;
    this.zoneRecords = null;
    this.notify({ type: "zone-loading" });
    try {
      const data = await fetchZoneRecords(domain);
      if (data && data.success) {
        this.zoneRecords = data;
        this.notify({ type: "zone-records-update", data });
      }
    } catch (err) {
      console.error("[DNS.usectl.com] Failed to fetch zone records:", err);
    } finally {
      this.isLoadingZone = false;
      this.notify({ type: "zone-loaded" });
    }
  }

  async fetchSSLInfo(domain) {
    try {
      const res = await fetch(`/api/ssl?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.sslInfo = data;
          this.notify({ type: "ssl-update" });
        }
      }
    } catch (e) {
      // Backend /api/ssl might not be reached if running on pure static host, silently ignore
    }
  }

  /**
   * Consensus metrics
   */
  getConsensus() {
    const total = this.resolvers.length;
    let completed = 0;
    let syncedCount = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    const valueFreq = {};

    for (const r of this.resolvers) {
      const res = this.results[r.id];
      if (res) {
        completed++;
        if (res.success && res.primaryValue) {
          const val = res.primaryValue;
          valueFreq[val] = (valueFreq[val] || 0) + 1;
        }
        if (res.latency) {
          totalLatency += res.latency;
          latencyCount++;
        }
      }
    }

    // Determine consensus winner value
    let dominantValue = null;
    let maxCount = 0;
    for (const [val, count] of Object.entries(valueFreq)) {
      if (count > maxCount) {
        maxCount = count;
        dominantValue = val;
      }
    }

    syncedCount = maxCount;
    const percent = total > 0 ? Math.round((syncedCount / total) * 100) : 0;
    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

    return {
      total,
      completed,
      syncedCount,
      percent,
      dominantValue,
      avgLatency,
      isFullySynced: percent >= 95
    };
  }
}

export const store = new DNSStore();
