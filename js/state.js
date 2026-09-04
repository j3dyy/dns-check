/**
 * DNS.usectl.com - Reactive State Store
 */
import { queryResolver } from "./utils/doh.js";
import { cleanDomain, isValidDomain } from "./utils/formatters.js";

class DNSStore {
  constructor() {
    this.domain = "usectl.com";
    this.recordType = "A";
    this.expectedValue = "";
    this.theme = localStorage.getItem("dns_theme") || "dark";
    
    this.resolvers = [];
    this.regions = [];
    this.results = {};
    this.sslInfo = null;
    this.isLoading = false;
    
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  }

  async loadResolvers() {
    try {
      const res = await fetch("./data/resolvers.json");
      const data = await res.json();
      this.resolvers = data.resolvers || [];
      this.regions = data.regions || [];
      this.notify();
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
    this.queryAll();
  }

  setExpectedValue(val) {
    this.expectedValue = val.trim();
    this.notify();
  }

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    localStorage.setItem("dns_theme", this.theme);
    document.documentElement.setAttribute("data-theme", this.theme);
    this.notify();
  }

  updateUrlParams() {
    const url = new URL(window.location);
    if (this.domain) url.searchParams.set("d", this.domain);
    if (this.recordType) url.searchParams.set("t", this.recordType);
    window.history.replaceState({}, "", url);
  }

  parseUrlParams() {
    const url = new URL(window.location);
    const d = url.searchParams.get("d") || url.searchParams.get("q");
    const t = url.searchParams.get("t") || url.searchParams.get("type");
    if (d) this.domain = cleanDomain(d);
    if (t) this.recordType = t.toUpperCase();
  }

  async queryAll() {
    if (!this.domain || !isValidDomain(this.domain)) return;

    this.isLoading = true;
    this.results = {};
    this.sslInfo = null;
    this.notify();

    // Trigger SSL inspection in parallel
    this.fetchSSLInfo(this.domain);

    // Query all DoH resolvers concurrently
    const promises = this.resolvers.map(async (resolver) => {
      const result = await queryResolver(resolver, this.domain, this.recordType);
      this.results[resolver.id] = result;
      this.notify();
    });

    await Promise.allSettled(promises);
    this.isLoading = false;
    this.notify();
  }

  async fetchSSLInfo(domain) {
    try {
      const res = await fetch(`/api/ssl?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.sslInfo = data;
          this.notify();
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
