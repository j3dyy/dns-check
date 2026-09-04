/**
 * DNS.usectl.com - Active DNS Zone Records Overview (MX, NS, CNAME, TXT, A, AAAA, CAA, SOA)
 */
import { store } from "../state.js";
import { icons } from "../utils/icons.js";
import { formatTTL, isValidDomain } from "../utils/formatters.js";

let isCollapsed = false;

export function renderZoneRecords(mountEl) {
  if (!mountEl) return;

  if (!store.domain || !isValidDomain(store.domain)) {
    mountEl.innerHTML = "";
    return;
  }

  const d = store.domain;
  const isLoading = store.isLoadingZone;
  const zone = store.zoneRecords;

  if (isLoading && !zone) {
    mountEl.innerHTML = `
      <section class="zone-overview-section">
        <div class="container">
          <div class="zone-overview-card is-loading">
            <div class="zone-card-header">
              <div class="zone-title-wrap">
                <span class="is-spinning" style="color: var(--brand-cyan);">${icons.refresh(16)}</span>
                <span class="zone-header-title">Discovering DNS Records for <strong>${d}</strong>...</span>
              </div>
              <span class="zone-count-badge pulse-badge">Querying Zone...</span>
            </div>
            <div class="zone-grid-skeleton">
              <div class="zone-cell-skeleton"></div>
              <div class="zone-cell-skeleton"></div>
              <div class="zone-cell-skeleton"></div>
              <div class="zone-cell-skeleton"></div>
            </div>
          </div>
        </div>
      </section>
    `;
    return;
  }

  if (!zone || !zone.records) {
    mountEl.innerHTML = "";
    return;
  }

  const recs = zone.records;
  const totalCount = zone.totalCount || 0;

  // Extract categorised data
  const aRecs = (recs.A || []).filter((r) => r.type === "A");
  const aaaaRecs = (recs.AAAA || []).filter((r) => r.type === "AAAA");
  const cnameRecs = (recs.CNAME || []).concat(
    (recs.A || []).filter((r) => r.type === "CNAME")
  );
  // Deduplicate CNAMEs
  const uniqueCnames = Array.from(new Set(cnameRecs.map((r) => r.value))).map((val) =>
    cnameRecs.find((r) => r.value === val)
  );

  const mxRecs = recs.MX || [];
  const nsRecs = recs.NS || [];
  const txtRecs = recs.TXT || [];
  const caaRecs = recs.CAA || [];
  const soaRecs = recs.SOA || [];

  mountEl.innerHTML = `
    <section class="zone-overview-section">
      <div class="container">
        <div class="zone-overview-card">
          <!-- Card Header -->
          <div class="zone-card-header">
            <div class="zone-title-wrap">
              <span class="zone-header-icon">${icons.database(18)}</span>
              <div class="zone-header-text">
                <span class="zone-header-title">DNS Records Snapshot</span>
                <span class="zone-header-sub">Complete active DNS zone profile for <strong class="zone-domain-name">${d}</strong></span>
              </div>
            </div>

            <div class="zone-header-actions">
              <button type="button" class="btn-zone-export" id="btn-export-bind" title="Export as standard RFC 1035 BIND Zone File" aria-label="Export BIND Zone File">
                ${icons.fileText(12)} <span>BIND Zone</span>
              </button>
              <button type="button" class="btn-zone-export" id="btn-export-json" title="Export DNS Records as JSON" aria-label="Export JSON">
                ${icons.download(12)} <span>JSON</span>
              </button>
              <span class="zone-count-badge">
                <span class="count-num">${totalCount}</span> <span class="badge-text-full">Records Discovered</span><span class="badge-text-short">Records</span>
              </span>
              <button type="button" class="btn-zone-toggle" id="btn-toggle-zone" title="${isCollapsed ? "Expand" : "Collapse"} Zone Overview">
                ${isCollapsed ? "Show All ▼" : "Hide ▲"}
              </button>
            </div>
          </div>

          <!-- Card Body (Grid of Record Groups) -->
          <div class="zone-card-body ${isCollapsed ? "is-hidden" : ""}">
            <div class="zone-records-grid">

              <!-- 1. Mail Exchange (MX) & DMARC -->
              <div class="zone-group-card">
                <div class="zone-group-top">
                  <div class="zone-group-title">
                    <span class="zone-icon-chip">${icons.mail(14)}</span>
                    <span class="group-name">Mail Routing (MX)</span>
                    <span class="group-pill">${mxRecs.length}</span>
                  </div>
                  <button type="button" class="btn-probe-group" data-type="MX" title="Test MX propagation across 16 global edge resolvers">
                    Probe Globally ↗
                  </button>
                </div>
                <div class="zone-group-content">
                  ${zone.dmarc ? `
                    <div class="dmarc-badge-row">
                      <span class="dmarc-pill ${zone.dmarc.hasDmarc ? (zone.dmarc.policy === 'reject' ? 'dmarc-reject' : zone.dmarc.policy === 'quarantine' ? 'dmarc-quarantine' : 'dmarc-none') : 'dmarc-missing'}">
                        ${icons.shield(11)}
                        <span>${zone.dmarc.hasDmarc ? `DMARC: p=${zone.dmarc.policy?.toUpperCase() || 'NONE'}` : 'No DMARC'}</span>
                      </span>
                      <span class="dmarc-meta-text">${zone.dmarc.hasDmarc ? (zone.dmarc.policy === 'reject' ? 'Spoofed emails rejected' : zone.dmarc.policy === 'quarantine' ? 'Spoofed emails quarantined' : 'Monitoring only') : 'Spoofing risk'}</span>
                    </div>
                  ` : ""}
                  ${mxRecs.length > 0
                    ? mxRecs.map((r) => {
                        const parts = r.value.split(" ");
                        const prio = parts.length > 1 ? parts[0] : "—";
                        const host = parts.length > 1 ? parts.slice(1).join(" ") : r.value;
                        return `
                          <div class="zone-record-row">
                            <span class="mx-prio-tag" title="MX Priority">prio ${prio}</span>
                            <span class="rec-val-mono" title="${host}">${host}</span>
                            <span class="zone-ttl">${r.ttl ? `TTL ${formatTTL(r.ttl)}` : ""}</span>
                            <button type="button" class="btn-copy-tiny" data-copy="${host}" title="Copy MX Host">
                              ${icons.copy(12)}
                            </button>
                          </div>
                        `;
                      }).join("")
                    : `<div class="zone-empty-row">No MX records configured</div>`
                  }
                </div>
              </div>

              <!-- 2. Authoritative Nameservers (NS) -->
              <div class="zone-group-card">
                <div class="zone-group-top">
                  <div class="zone-group-title">
                    <span class="zone-icon-chip">${icons.globe(14)}</span>
                    <span class="group-name">Nameservers (NS)</span>
                    <span class="group-pill">${nsRecs.length}</span>
                  </div>
                  <button type="button" class="btn-probe-group" data-type="NS" title="Test NS propagation across 16 global edge resolvers">
                    Probe Globally ↗
                  </button>
                </div>
                <div class="zone-group-content">
                  ${nsRecs.length > 0
                    ? nsRecs.map((r) => `
                        <div class="zone-record-row">
                          <span class="rec-val-mono" title="${r.value}">${r.value}</span>
                          <span class="zone-ttl">${r.ttl ? `TTL ${formatTTL(r.ttl)}` : ""}</span>
                          <button type="button" class="btn-copy-tiny" data-copy="${r.value}" title="Copy Nameserver">
                            ${icons.copy(12)}
                          </button>
                        </div>
                      `).join("")
                    : `<div class="zone-empty-row">No NS records configured</div>`
                  }
                </div>
              </div>

              <!-- 3. Canonical Aliases (CNAME) -->
              <div class="zone-group-card">
                <div class="zone-group-top">
                  <div class="zone-group-title">
                    <span class="zone-icon-chip">${icons.link(14)}</span>
                    <span class="group-name">Canonical Name (CNAME)</span>
                    <span class="group-pill">${uniqueCnames.length}</span>
                  </div>
                  <button type="button" class="btn-probe-group" data-type="CNAME" title="Test CNAME propagation across 16 global edge resolvers">
                    Probe Globally ↗
                  </button>
                </div>
                <div class="zone-group-content">
                  ${uniqueCnames.length > 0
                    ? uniqueCnames.map((r) => `
                        <div class="zone-record-row">
                          <span class="cname-badge">Alias</span>
                          <span class="rec-val-mono" title="${r.value}">→ ${r.value}</span>
                          <span class="zone-ttl">${r.ttl ? `TTL ${formatTTL(r.ttl)}` : ""}</span>
                          <button type="button" class="btn-copy-tiny" data-copy="${r.value}" title="Copy Target Alias">
                            ${icons.copy(12)}
                          </button>
                        </div>
                      `).join("")
                    : `<div class="zone-empty-row zone-hint-text">Apex Domain / Direct Address (No CNAME alias)</div>`
                  }
                </div>
              </div>

              <!-- 4. Host Addresses (A & AAAA) -->
              <div class="zone-group-card">
                <div class="zone-group-top">
                  <div class="zone-group-title">
                    <span class="zone-icon-chip">${icons.mapPin(14)}</span>
                    <span class="group-name">Host Addresses (A / AAAA)</span>
                    <span class="group-pill">${aRecs.length + aaaaRecs.length}</span>
                  </div>
                  <button type="button" class="btn-probe-group" data-type="A" title="Test A record propagation across 16 global edge resolvers">
                    Probe Globally ↗
                  </button>
                </div>
                <div class="zone-group-content">
                  ${aRecs.length > 0 || aaaaRecs.length > 0
                    ? `
                        ${aRecs.map((r) => {
                          const asn = store.asnInfo[r.value];
                          return `
                            <div class="zone-record-row">
                              <span class="ip-type-tag ipv4">IPv4</span>
                              <span class="rec-val-mono ip-highlight" title="${r.value}">${r.value}</span>
                              ${asn && asn.asn ? `<span class="asn-pill-tiny" title="${asn.asn}">${asn.org || asn.asn}</span>` : ""}
                              <span class="zone-ttl">${r.ttl ? `TTL ${formatTTL(r.ttl)}` : ""}</span>
                              <button type="button" class="btn-copy-tiny" data-copy="${r.value}" title="Copy IPv4">
                                ${icons.copy(12)}
                              </button>
                            </div>
                          `;
                        }).join("")}
                        ${aaaaRecs.map((r) => `
                          <div class="zone-record-row">
                            <span class="ip-type-tag ipv6">IPv6</span>
                            <span class="rec-val-mono" title="${r.value}">${r.value}</span>
                            <span class="zone-ttl">${r.ttl ? `TTL ${formatTTL(r.ttl)}` : ""}</span>
                            <button type="button" class="btn-copy-tiny" data-copy="${r.value}" title="Copy IPv6">
                              ${icons.copy(12)}
                            </button>
                          </div>
                        `).join("")}
                      `
                    : `<div class="zone-empty-row">No IP addresses resolved</div>`
                  }
                </div>
              </div>

              <!-- 5. TXT Records (SPF, DMARC & Verification) -->
              <div class="zone-group-card zone-span-2">
                <div class="zone-group-top">
                  <div class="zone-group-title">
                    <span class="zone-icon-chip">${icons.fileText(14)}</span>
                    <span class="group-name">TXT &amp; SPF Verification Policies</span>
                    <span class="group-pill">${txtRecs.length}</span>
                  </div>
                  <button type="button" class="btn-probe-group" data-type="TXT" title="Test TXT propagation across 16 global edge resolvers">
                    Probe Globally ↗
                  </button>
                </div>
                <div class="zone-group-content">
                  ${txtRecs.length > 0
                    ? txtRecs.map((r) => {
                        let badgeType = "TXT";
                        let badgeClass = "txt-generic";
                        if (r.value.startsWith("v=spf1")) {
                          badgeType = "SPF";
                          badgeClass = "txt-spf";
                        } else if (r.value.startsWith("v=DMARC1")) {
                          badgeType = "DMARC";
                          badgeClass = "txt-dmarc";
                        } else if (r.value.includes("google-site-verification")) {
                          badgeType = "Google";
                          badgeClass = "txt-verify";
                        } else if (r.value.includes("facebook-domain-verification")) {
                          badgeType = "Facebook";
                          badgeClass = "txt-verify";
                        }
                        return `
                          <div class="zone-record-row txt-row">
                            <span class="txt-type-badge ${badgeClass}">${badgeType}</span>
                            <span class="rec-val-mono txt-wrap" title="${r.value}">${r.value}</span>
                            <span class="zone-ttl">${r.ttl ? `TTL ${formatTTL(r.ttl)}` : ""}</span>
                            <button type="button" class="btn-copy-tiny" data-copy="${r.value}" title="Copy TXT value">
                              ${icons.copy(12)}
                            </button>
                          </div>
                        `;
                      }).join("")
                    : `<div class="zone-empty-row">No TXT records configured</div>`
                  }
                </div>
              </div>

              <!-- 6. Security & Authority (CAA & SOA) -->
              <div class="zone-group-card zone-span-2">
                <div class="zone-group-top">
                  <div class="zone-group-title">
                    <span class="zone-icon-chip">${icons.shield(14)}</span>
                    <span class="group-name">Security &amp; Authority Policies (CAA / SOA)</span>
                    <span class="group-pill">${caaRecs.length + soaRecs.length}</span>
                  </div>
                  <button type="button" class="btn-probe-group" data-type="CAA" title="Test CAA propagation across 16 global edge resolvers">
                    Probe Globally ↗
                  </button>
                </div>
                <div class="zone-group-content">
                  ${caaRecs.length > 0 || soaRecs.length > 0
                    ? `
                        ${caaRecs.map((r) => `
                          <div class="zone-record-row">
                            <span class="caa-badge">CAA</span>
                            <span class="rec-val-mono" title="${r.value}">Authorized: ${r.value}</span>
                            <span class="zone-ttl">${r.ttl ? `TTL ${formatTTL(r.ttl)}` : ""}</span>
                            <button type="button" class="btn-copy-tiny" data-copy="${r.value}" title="Copy CAA Policy">
                              ${icons.copy(12)}
                            </button>
                          </div>
                        `).join("")}
                        ${soaRecs.map((r) => `
                          <div class="zone-record-row">
                            <span class="soa-badge">SOA Authority</span>
                            <span class="rec-val-mono" title="${r.value}">${r.value}</span>
                            <span class="zone-ttl">${r.ttl ? `TTL ${formatTTL(r.ttl)}` : ""}</span>
                            <button type="button" class="btn-copy-tiny" data-copy="${r.value}" title="Copy SOA Data">
                              ${icons.copy(12)}
                            </button>
                          </div>
                        `).join("")}
                      `
                    : `<div class="zone-empty-row">No CAA or SOA policies retrieved</div>`
                  }
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  // Attach event listeners
  // 1. Toggle expand/collapse
  const toggleBtn = mountEl.querySelector("#btn-toggle-zone");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isCollapsed = !isCollapsed;
      renderZoneRecords(mountEl);
    });
  }

  // 2. 1-Click "Probe Globally ↗" buttons
  mountEl.querySelectorAll(".btn-probe-group").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const type = btn.getAttribute("data-type");
      if (type) {
        store.setRecordType(type);
      }
    });
  });

  // 3. 1-Click copy buttons
  mountEl.querySelectorAll(".btn-copy-tiny").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const text = btn.getAttribute("data-copy");
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          const original = btn.innerHTML;
          btn.innerHTML = `<span style="color: var(--brand-emerald);">${icons.check(12)}</span>`;
          setTimeout(() => {
            btn.innerHTML = original;
          }, 1500);
        } catch {
          // Clipboard write failed
        }
      }
    });
  });

  // 4. Export BIND and JSON triggers
  mountEl.querySelector("#btn-export-bind")?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("open-export-modal", { detail: { format: "bind" } }));
  });

  mountEl.querySelector("#btn-export-json")?.addEventListener("click", (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("open-export-modal", { detail: { format: "json" } }));
  });
}
