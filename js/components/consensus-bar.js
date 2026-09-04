/**
 * DNS.usectl.com - Propagation Consensus Summary Bar
 */
import { icons } from "../utils/icons.js";
import { store } from "../state.js";

export function renderConsensusBar(mountEl) {
  const consensus = store.getConsensus();
  const ssl = store.sslInfo;
  const http = store.httpInfo;
  const dnssec = store.dnssec;
  const asn = consensus.dominantValue ? store.asnInfo[consensus.dominantValue] : null;

  let badgeClass = "idle";
  let statusText = "Ready to Probe";

  if (store.isLoading) {
    statusText = `Probing ${consensus.completed} / ${consensus.total} Nodes...`;
    badgeClass = "partial";
  } else if (consensus.completed > 0) {
    if (consensus.isFullySynced) {
      statusText = `100% Globally Propagated (${consensus.syncedCount}/${consensus.total})`;
      badgeClass = "synced";
    } else {
      statusText = `${consensus.percent}% Propagated (${consensus.syncedCount}/${consensus.total})`;
      badgeClass = "partial";
    }
  }

  mountEl.innerHTML = `
    <div class="container">
      <div class="consensus-summary-card">
        <div class="consensus-left">
          <div class="consensus-badge ${badgeClass}">
            <span class="radar-live-dot" style="${badgeClass === 'synced' ? '' : badgeClass === 'partial' ? 'background-color: var(--brand-amber);' : 'background-color: var(--text-dim);'}"></span>
            <span>${statusText}</span>
          </div>

          <div class="consensus-stats">
            ${consensus.dominantValue ? `
              <div class="consensus-val-group">
                <span>Consensus:</span>
                <strong class="dominant-val-text">${consensus.dominantValue}</strong>
                ${asn && asn.asn ? `
                  <span class="asn-pill" title="Network ASN: ${asn.asn} • Route: ${asn.route || 'BGP Anycast'}">
                    <span class="asn-dot"></span>
                    <span>${asn.org || asn.asn}</span>
                  </span>
                ` : ""}
              </div>
            ` : ""}
            ${consensus.avgLatency > 0 ? `
              <div>Avg Latency: <strong>${consensus.avgLatency}ms</strong></div>
            ` : ""}
          </div>
        </div>

        <div class="consensus-right">
          <div class="consensus-badges-group">
            ${dnssec !== null ? `
              <div class="dnssec-pill ${dnssec ? 'valid' : 'unsigned'}" title="${dnssec ? 'DNSSEC Authenticated Data (AD) Flag Verified' : 'DNSSEC Not Configured or Unsigned'}">
                ${dnssec ? icons.shield(12) : ''}
                <span>${dnssec ? 'DNSSEC Valid' : 'DNSSEC Unsigned'}</span>
              </div>
            ` : ""}

            ${http && http.status ? `
              <div class="http-pill ${http.status < 400 ? 'ok' : 'warn'}" title="Web Server: ${http.server || 'Unknown'} • Redirect: ${http.redirectCount || 0} hops">
                <span class="http-live-dot"></span>
                <span>HTTP ${http.status} &bull; ${http.ttfb}ms</span>
              </div>
            ` : ""}

            ${ssl && ssl.success ? `
              <button class="ssl-pill" id="btn-open-ssl-modal" title="SSL Certificate Valid: ${ssl.daysRemaining}d left (${ssl.issuer}) - Click to inspect">
                ${icons.lock(13)}
                <span>SSL Valid: ${ssl.daysRemaining}d</span>
              </button>
            ` : ssl && ssl.error ? `
              <button class="ssl-pill" style="color: var(--brand-rose); border-color: rgba(244,63,94,0.3); background: rgba(244,63,94,0.08);" id="btn-open-ssl-modal" title="SSL Certificate Error or Warning">
                ${icons.alertTriangle(13)}
                <span>SSL Warning</span>
              </button>
            ` : ""}
          </div>

          <div class="view-mode-toggle">
            <button class="view-mode-btn ${store.viewMode === 'grid' ? 'active' : ''}" id="btn-view-grid" title="Standard Resolver Grid View">
              ${icons.grid(13)}
              <span>Grid View</span>
            </button>
            <button class="view-mode-btn ${store.viewMode === 'nslookup' ? 'active' : ''}" id="btn-view-nslookup" title="nslookup Cross-Check Terminal Workstation">
              ${icons.terminal(13)}
              <span>nslookup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-view-grid")?.addEventListener("click", () => {
    store.setViewMode("grid");
  });

  document.getElementById("btn-view-nslookup")?.addEventListener("click", () => {
    store.setViewMode("nslookup");
  });

  document.getElementById("btn-open-ssl-modal")?.addEventListener("click", () => {
    const ev = new CustomEvent("open-ssl-modal");
    window.dispatchEvent(ev);
  });
}
