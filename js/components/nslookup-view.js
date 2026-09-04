/**
 * DNS.usectl.com - nslookup Cross-Check & Terminal Workstation View
 */
import { icons } from "../utils/icons.js";
import { store } from "../state.js";
import { formatLatency, formatTTL } from "../utils/formatters.js";
import {
  generateNslookupOutput,
  generateDigOutput,
  getNslookupCommand,
  getDigCommand
} from "../utils/nslookup.js";

let selectedResolverId = null;
let activeTool = "nslookup"; // "nslookup" | "dig"
let filterTerm = "";

export function renderNslookupView(mountEl) {
  const resolvers = store.resolvers;
  const results = store.results;
  const d = store.domain || "usectl.com";
  const t = store.recordType || "A";

  if (resolvers.length === 0) {
    mountEl.innerHTML = `<div class="container" style="text-align: center; padding: 40px; color: var(--text-dim);">Loading resolvers...</div>`;
    return;
  }

  // Set default selected resolver if not set or invalid
  if (!selectedResolverId || !resolvers.some((r) => r.id === selectedResolverId)) {
    selectedResolverId = resolvers[0].id;
  }

  const selectedResolver = resolvers.find((r) => r.id === selectedResolverId) || resolvers[0];
  const selectedResult = results[selectedResolver.id];

  const nslookupCmd = getNslookupCommand(d, t, selectedResolver);
  const digCmd = getDigCommand(d, t, selectedResolver);
  const activeCmd = activeTool === "nslookup" ? nslookupCmd : digCmd;

  const terminalOutput = activeTool === "nslookup"
    ? generateNslookupOutput(d, t, selectedResolver, selectedResult)
    : generateDigOutput(d, t, selectedResolver, selectedResult);

  // Group resolvers by value for Consensus Clustering ("Overcross" breakdown)
  const clusters = {};
  for (const r of resolvers) {
    const res = results[r.id];
    let key = "Pending...";
    if (res) {
      if (res.success && res.primaryValue) {
        key = res.primaryValue;
      } else if (res.status === "nxdomain") {
        key = "NXDOMAIN (Not Found)";
      } else if (res.status === "empty") {
        key = "No Records";
      } else {
        key = "Query Error";
      }
    }
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(r);
  }

  // Filter resolvers for the list
  const filteredResolvers = resolvers.filter((r) => {
    if (!filterTerm) return true;
    const term = filterTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.ip.toLowerCase().includes(term) ||
      r.location.toLowerCase().includes(term)
    );
  });

  mountEl.innerHTML = `
    <div class="container cross-view-container fade-in">
      <!-- Top Title & Filter Strip -->
      <div class="cross-header-strip">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${icons.terminal(18)}
            <h2 class="cross-title">nslookup Cross-Check Terminal</h2>
            <span class="cross-tag">Live Node Stream</span>
          </div>
          <p class="cross-subtitle">
            Side-by-side terminal inspection, live transport telemetry, and consensus clustering across 16 global resolvers.
          </p>
        </div>

        <div class="cross-search-filter">
          ${icons.search(14)}
          <input
            type="text"
            id="cross-filter-input"
            placeholder="Filter resolvers by name, IP, or location..."
            value="${escapeHtml(filterTerm)}"
          />
          ${filterTerm ? `<button id="btn-clear-cross-filter" class="btn-clear-filter">${icons.x(12)}</button>` : ""}
        </div>
      </div>

      <!-- Main Two-Column Terminal Workstation -->
      <div class="cross-workstation-grid">
        <!-- Left Column: Resolver Selector List -->
        <div class="cross-resolver-sidebar">
          <div class="cross-sidebar-header">
            <span>Edge Resolvers (${filteredResolvers.length})</span>
            <span style="font-size: 0.72rem; color: var(--text-dim);">Click to inspect</span>
          </div>

          <div class="cross-resolver-list">
            ${filteredResolvers.map((r) => {
              const res = results[r.id];
              const isSelected = r.id === selectedResolverId;
              const lat = res?.latency ? formatLatency(res.latency) : null;
              const isMatched = res?.success && res?.primaryValue && (store.expectedValue ? res.rawValues.includes(store.expectedValue) : true);

              return `
                <div class="cross-node-item ${isSelected ? 'active' : ''}" data-resolver-id="${r.id}">
                  <div class="cross-node-left">
                    <span class="cross-node-flag">${r.flag || "🌐"}</span>
                    <div class="cross-node-details">
                      <span class="cross-node-name">${r.name}</span>
                      <span class="cross-node-ip">${r.ip}</span>
                    </div>
                  </div>

                  <div class="cross-node-right">
                    ${lat ? `<span class="latency-badge-sm ${lat.status}">${lat.label}</span>` : ""}
                    <span class="status-indicator-dot ${res?.success ? 'success' : res?.status === 'nxdomain' ? 'warning' : 'danger'}"></span>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Right Column: Active Terminal Inspector -->
        <div class="cross-terminal-col">
          <div class="terminal-card large-terminal">
            <!-- Window Titlebar -->
            <div class="terminal-titlebar">
              <div class="terminal-dots">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
              </div>

              <div class="terminal-center-title">
                ${icons.terminal(13)}
                <span>nslookup &mdash; ${selectedResolver.name} (${selectedResolver.ip}#53)</span>
              </div>

              <div class="terminal-tab-switch">
                <button class="term-tab ${activeTool === 'nslookup' ? 'active' : ''}" id="tab-cross-nslookup">
                  nslookup
                </button>
                <button class="term-tab ${activeTool === 'dig' ? 'active' : ''}" id="tab-cross-dig">
                  dig
                </button>
              </div>

              <div class="terminal-actions">
                <button class="btn-copy-term" id="btn-cross-copy-cmd" title="Copy Command">
                  ${icons.copy(13)}
                  <span>Copy Cmd</span>
                </button>
                <button class="btn-copy-term" id="btn-cross-copy-output" title="Copy Output">
                  ${icons.copy(13)}
                  <span>Copy Output</span>
                </button>
              </div>
            </div>

            <!-- Terminal Info Bar -->
            <div class="terminal-info-strip">
              <div class="strip-item">
                <span class="strip-label">Resolver:</span>
                <span class="strip-value">${selectedResolver.name} (${selectedResolver.location})</span>
              </div>
              <div class="strip-item">
                <span class="strip-label">Roundtrip:</span>
                <span class="strip-value ${selectedResult?.latency ? formatLatency(selectedResult.latency).status : ''}">
                  ${selectedResult?.latency ? `${selectedResult.latency} ms` : 'Probing...'}
                </span>
              </div>
              <div class="strip-item">
                <span class="strip-label">Socket:</span>
                <span class="strip-value mono">UDP / 53 (RFC 6891 EDNS0)</span>
              </div>
            </div>

            <!-- Command Prompt Bar -->
            <div class="terminal-cmd-row">
              <span class="term-prompt">$</span>
              <span class="term-cmd-text">${activeCmd}</span>
            </div>

            <!-- Monospace Output Area -->
            <pre class="terminal-body cross-terminal-body">${escapeHtml(terminalOutput)}</pre>
          </div>
        </div>
      </div>

      <!-- Bottom Panel: Consensus Clustering Matrix ("Overcross" breakdown) -->
      <div class="consensus-clustering-card">
        <div class="clustering-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${icons.columns(16)}
            <h3 style="margin: 0; font-size: 0.96rem; font-weight: 700; color: var(--text-main);">
              Consensus Cross-Verification Clusters
            </h3>
          </div>
          <span style="font-size: 0.78rem; color: var(--text-dim);">
            Resolvers grouped by returned value to spot edge propagation divergence
          </span>
        </div>

        <div class="clustering-body">
          ${Object.entries(clusters).map(([val, group]) => {
            const isDominant = group.length >= Math.ceil(resolvers.length / 2);
            return `
              <div class="cluster-row ${isDominant ? 'dominant-cluster' : 'divergent-cluster'}">
                <div class="cluster-value-col">
                  <div class="cluster-badge ${isDominant ? 'badge-dominant' : 'badge-divergent'}">
                    ${isDominant ? `${icons.check(12)} Consensus Answer` : `${icons.alertTriangle(12)} Divergent Answer`}
                  </div>
                  <code class="cluster-val-code">${escapeHtml(val)}</code>
                  <span class="cluster-count">${group.length} of ${resolvers.length} nodes (${Math.round((group.length / resolvers.length) * 100)}%)</span>
                </div>

                <div class="cluster-nodes-col">
                  ${group.map((r) => `
                    <button class="cluster-node-pill ${r.id === selectedResolverId ? 'active-pill' : ''}" data-resolver-id="${r.id}" title="Click to view nslookup for ${r.name}">
                      <span>${r.flag || '🌐'}</span>
                      <span>${r.name}</span>
                    </button>
                  `).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;

  // Event handlers
  mountEl.querySelectorAll(".cross-node-item").forEach((item) => {
    item.addEventListener("click", () => {
      const rid = item.getAttribute("data-resolver-id");
      if (rid) {
        selectedResolverId = rid;
        renderNslookupView(mountEl);
      }
    });
  });

  mountEl.querySelectorAll(".cluster-node-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const rid = pill.getAttribute("data-resolver-id");
      if (rid) {
        selectedResolverId = rid;
        renderNslookupView(mountEl);
      }
    });
  });

  const filterInput = document.getElementById("cross-filter-input");
  filterInput?.addEventListener("input", (e) => {
    filterTerm = e.target.value;
    renderNslookupView(mountEl);
    const refreshedInput = document.getElementById("cross-filter-input");
    if (refreshedInput) {
      refreshedInput.focus();
      refreshedInput.selectionStart = refreshedInput.selectionEnd = refreshedInput.value.length;
    }
  });

  document.getElementById("btn-clear-cross-filter")?.addEventListener("click", () => {
    filterTerm = "";
    renderNslookupView(mountEl);
  });

  document.getElementById("tab-cross-nslookup")?.addEventListener("click", () => {
    activeTool = "nslookup";
    renderNslookupView(mountEl);
  });

  document.getElementById("tab-cross-dig")?.addEventListener("click", () => {
    activeTool = "dig";
    renderNslookupView(mountEl);
  });

  document.getElementById("btn-cross-copy-cmd")?.addEventListener("click", (e) => {
    navigator.clipboard.writeText(activeCmd);
    showCopyFeedback(e.currentTarget, "Cmd Copied!");
  });

  document.getElementById("btn-cross-copy-output")?.addEventListener("click", (e) => {
    navigator.clipboard.writeText(terminalOutput);
    showCopyFeedback(e.currentTarget, "Output Copied!");
  });
}

function showCopyFeedback(btnEl, msg) {
  if (!btnEl) return;
  const original = btnEl.innerHTML;
  btnEl.innerHTML = `<span style="color: var(--brand-emerald); display: inline-flex; align-items: center; gap: 4px;">${icons.check(13)} ${msg}</span>`;
  setTimeout(() => {
    btnEl.innerHTML = original;
  }, 1200);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
