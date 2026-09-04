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
          ` : `
            <span style="font-size: 0.78rem; color: var(--text-dim);">
              Checking ${store.resolvers.length} Global Edge Nodes
            </span>
          `}
        </div>
      </div>
    </div>
  `;

  document.getElementById("btn-open-ssl-modal")?.addEventListener("click", () => {
    const ev = new CustomEvent("open-ssl-modal");
    window.dispatchEvent(ev);
  });
}
