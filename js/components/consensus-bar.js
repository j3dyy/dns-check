/**
 * DNS.usectl.com - Propagation Consensus Summary Bar
 */
import { icons } from "../utils/icons.js";
import { store } from "../state.js";

export function renderConsensusBar(mountEl) {
  const consensus = store.getConsensus();
  const ssl = store.sslInfo;

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
              <div>Consensus: <strong>${consensus.dominantValue}</strong></div>
            ` : ""}
            ${consensus.avgLatency > 0 ? `
              <div>Avg Latency: <strong>${consensus.avgLatency}ms</strong></div>
            ` : ""}
          </div>
        </div>

        <div class="consensus-right">
          ${ssl && ssl.success ? `
            <button class="ssl-pill" id="btn-open-ssl-modal" title="View SSL/TLS Certificate Info">
              ${icons.lock(14)}
              <span>SSL Valid: ${ssl.daysRemaining}d left (${ssl.issuer})</span>
            </button>
          ` : ssl && ssl.error ? `
            <button class="ssl-pill" style="color: var(--brand-rose); border-color: rgba(244,63,94,0.3); background: rgba(244,63,94,0.08);" id="btn-open-ssl-modal">
              ${icons.alertTriangle(14)}
              <span>SSL Warning</span>
            </button>
          ` : ""}

          <div class="view-mode-toggle">
            <button class="view-mode-btn ${store.viewMode === 'grid' ? 'active' : ''}" id="btn-view-grid" title="Standard Resolver Grid View">
              ${icons.grid(13)}
              <span>Grid</span>
            </button>
            <button class="view-mode-btn ${store.viewMode === 'nslookup' ? 'active' : ''}" id="btn-view-nslookup" title="nslookup Cross-Check Terminal Workstation">
              ${icons.terminal(13)}
              <span>nslookup Cross-Check</span>
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
