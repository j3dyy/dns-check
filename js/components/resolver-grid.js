/**
 * DNS.usectl.com - Global Resolver Grid Component
 */
import { icons } from "../utils/icons.js";
import { formatLatency, formatTTL } from "../utils/formatters.js";
import { store } from "../state.js";

export function renderResolverGrid(mountEl) {
  const regions = store.regions;
  const resolvers = store.resolvers;
  const results = store.results;
  const expected = store.expectedValue;
  const consensus = store.getConsensus();

  if (resolvers.length === 0) {
    mountEl.innerHTML = `
      <div class="container" style="text-align: center; padding: 40px 0; color: var(--text-dim);">
        Loading resolvers...
      </div>
    `;
    return;
  }

  let html = `<div class="container">`;

  for (const reg of regions) {
    const regResolvers = resolvers.filter((r) => r.region === reg.id);
    if (regResolvers.length === 0) continue;

    html += `
      <section class="region-group">
        <div class="region-header">
          ${icons.globe(14)}
          <span>${reg.name}</span>
          <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 500;">(${regResolvers.length} nodes)</span>
        </div>

        <div class="resolvers-grid">
          ${regResolvers.map((r) => {
            const res = results[r.id];
            const isLoading = store.isLoading && !res;
            const latencyObj = res ? formatLatency(res.latency) : null;

            let cardClass = "";
            let statusIcon = "";
            let displayVal = "";
            let ttlText = "";

            if (isLoading) {
              displayVal = `<span class="skeleton-loading">Querying node...</span>`;
            } else if (res) {
              if (res.success && res.primaryValue) {
                displayVal = res.primaryValue;
                ttlText = res.ttl ? `TTL ${formatTTL(res.ttl)}` : "";

                // Check expected value matching
                if (expected) {
                  if (res.rawValues.includes(expected)) {
                    cardClass = "is-matched";
                    statusIcon = `<span style="color: var(--brand-emerald);">${icons.check(14)}</span>`;
                  } else {
                    cardClass = "is-differing";
                    statusIcon = `<span style="color: var(--brand-amber);">${icons.alertTriangle(14)}</span>`;
                  }
                } else if (consensus.dominantValue && res.primaryValue === consensus.dominantValue) {
                  cardClass = "is-matched";
                  statusIcon = `<span style="color: var(--brand-emerald);">${icons.check(14)}</span>`;
                } else {
                  cardClass = "is-differing";
                  statusIcon = `<span style="color: var(--brand-amber);">${icons.alertTriangle(14)}</span>`;
                }
              } else if (res.status === "nxdomain") {
                displayVal = `<span style="color: var(--text-dim);">NXDOMAIN (Not Found)</span>`;
                cardClass = "is-error";
                statusIcon = `<span style="color: var(--brand-rose);">${icons.x(14)}</span>`;
              } else if (res.status === "empty") {
                displayVal = `<span style="color: var(--text-dim);">No ${store.recordType} Records</span>`;
                cardClass = "is-differing";
                statusIcon = `<span style="color: var(--brand-amber);">${icons.alertTriangle(14)}</span>`;
              } else {
                displayVal = `<span style="color: var(--brand-rose);">${res.error || "Lookup Failed"}</span>`;
                cardClass = "is-error";
                statusIcon = `<span style="color: var(--brand-rose);">${icons.x(14)}</span>`;
              }
            } else {
              displayVal = `<span style="color: var(--text-dim);">Waiting to query...</span>`;
            }

            return `
              <div class="resolver-card ${cardClass} fade-in" id="card-${r.id}">
                <div class="resolver-card-top">
                  <div class="resolver-info">
                    <span class="resolver-flag">${r.flag || "🌐"}</span>
                    <div class="resolver-title-col">
                      <span class="resolver-name">${r.name}</span>
                      <span class="resolver-location">${r.location}</span>
                    </div>
                  </div>

                  <div class="resolver-meta-badges">
                    ${latencyObj ? `
                      <span class="latency-badge ${latencyObj.status}">
                        ${latencyObj.label}
                      </span>
                    ` : ""}
                    ${statusIcon}
                  </div>
                </div>

                <div class="resolver-card-bottom" title="Click to copy record value" data-copy="${res?.primaryValue || ""}">
                  <div class="record-val-row">
                    <span class="record-val-text">${displayVal}</span>
                    ${ttlText ? `<span class="record-ttl">${ttlText}</span>` : ""}
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  html += `</div>`;
  mountEl.innerHTML = html;

  // Add 1-click copy on cards
  mountEl.querySelectorAll(".resolver-card-bottom").forEach((box) => {
    box.addEventListener("click", () => {
      const val = box.getAttribute("data-copy");
      if (val) {
        navigator.clipboard.writeText(val);
        const original = box.innerHTML;
        box.innerHTML = `
          <div class="record-val-row" style="color: var(--brand-emerald);">
            <span>${icons.check(14)} Copied to clipboard!</span>
          </div>
        `;
        setTimeout(() => {
          box.innerHTML = original;
        }, 1200);
      }
    });
  });
}
