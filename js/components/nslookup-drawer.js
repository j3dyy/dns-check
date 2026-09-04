/**
 * DNS.usectl.com - Slide-Over nslookup Overlay Drawer
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

let activeResolverIndex = 0;
let activeTool = "nslookup"; // "nslookup" | "dig"

export function initNslookupDrawer(mountEl) {
  window.addEventListener("open-nslookup-drawer", (e) => {
    const resolverId = e.detail?.resolverId;
    const idx = store.resolvers.findIndex((r) => r.id === resolverId);
    activeResolverIndex = idx !== -1 ? idx : 0;
    renderDrawer(mountEl);
  });
}

function renderDrawer(mountEl) {
  const resolvers = store.resolvers;
  if (resolvers.length === 0) return;

  const resolver = resolvers[activeResolverIndex] || resolvers[0];
  const result = store.results[resolver.id];
  const d = store.domain || "usectl.com";
  const t = store.recordType || "A";

  const nslookupCmd = getNslookupCommand(d, t, resolver);
  const digCmd = getDigCommand(d, t, resolver);
  const activeCmd = activeTool === "nslookup" ? nslookupCmd : digCmd;

  const terminalOutput = activeTool === "nslookup"
    ? generateNslookupOutput(d, t, resolver, result)
    : generateDigOutput(d, t, resolver, result);

  const lat = result?.latency ? formatLatency(result.latency) : null;
  const ttlStr = result?.ttl ? formatTTL(result.ttl) : null;

  mountEl.innerHTML = `
    <div class="drawer-backdrop" id="nslookup-drawer-backdrop">
      <div class="nslookup-drawer slide-in-right">
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="drawer-title-group">
            <span class="drawer-flag">${resolver.flag || "🌐"}</span>
            <div>
              <div class="drawer-resolver-title">
                <h3>${resolver.name}</h3>
                <span class="drawer-ip-tag">${resolver.ip}#53</span>
              </div>
              <p class="drawer-location">${resolver.location} &bull; ${resolver.provider}</p>
            </div>
          </div>

          <div class="drawer-actions-top">
            <!-- Prev / Next Flip Buttons -->
            <div class="drawer-nav-group">
              <button class="icon-btn-sm" id="btn-drawer-prev" title="Previous Resolver (Left Arrow)">
                ${icons.chevronLeft(16)}
              </button>
              <span class="drawer-step-indicator">${activeResolverIndex + 1} / ${resolvers.length}</span>
              <button class="icon-btn-sm" id="btn-drawer-next" title="Next Resolver (Right Arrow)">
                ${icons.chevronRight(16)}
              </button>
            </div>

            <button class="modal-close-btn" id="btn-close-nslookup-drawer" title="Close (Escape)">
              ${icons.x(18)}
            </button>
          </div>
        </div>

        <!-- Telemetry Summary Strip -->
        <div class="drawer-telemetry-bar">
          <div class="telemetry-item">
            <span class="tel-label">Latency</span>
            <span class="tel-value ${lat ? lat.status : ''}">
              ${lat ? lat.label : 'Waiting...'}
            </span>
          </div>

          <div class="telemetry-item">
            <span class="tel-label">TTL</span>
            <span class="tel-value mono">${ttlStr || '—'}</span>
          </div>

          <div class="telemetry-item">
            <span class="tel-label">Transport</span>
            <span class="tel-value">UDP 53 (EDNS0)</span>
          </div>

          <div class="telemetry-item">
            <span class="tel-label">Status</span>
            <span class="tel-value ${result?.success ? 'success' : result?.status === 'nxdomain' ? 'warning' : 'danger'}">
              ${result?.status ? result.status.toUpperCase() : 'PENDING'}
            </span>
          </div>
        </div>

        <!-- Terminal Inspector Window -->
        <div class="terminal-card">
          <!-- Window Titlebar -->
          <div class="terminal-titlebar">
            <div class="terminal-dots">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
            </div>

            <div class="terminal-tab-switch">
              <button class="term-tab ${activeTool === 'nslookup' ? 'active' : ''}" id="tab-nslookup">
                ${icons.terminal(12)} nslookup
              </button>
              <button class="term-tab ${activeTool === 'dig' ? 'active' : ''}" id="tab-dig">
                dig
              </button>
            </div>

            <div class="terminal-actions">
              <button class="btn-copy-term" id="btn-copy-cmd" title="Copy Command">
                ${icons.copy(13)}
                <span>Copy Cmd</span>
              </button>
              <button class="btn-copy-term" id="btn-copy-output" title="Copy Output">
                ${icons.copy(13)}
                <span>Copy Output</span>
              </button>
            </div>
          </div>

          <!-- Command Prompt Bar -->
          <div class="terminal-cmd-row">
            <span class="term-prompt">$</span>
            <span class="term-cmd-text">${activeCmd}</span>
          </div>

          <!-- Monospace Output Area -->
          <pre class="terminal-body">${escapeHtml(terminalOutput)}</pre>
        </div>

        <!-- Quick Equivalent Commands -->
        <div class="drawer-cli-alternatives">
          <span class="alt-label">One-Click Copy Commands:</span>
          <div class="alt-cmd-chips">
            <button class="alt-chip" data-copy="${nslookupCmd}">
              ${icons.terminal(12)}
              <code>${nslookupCmd}</code>
            </button>
            <button class="alt-chip" data-copy="dig +short ${t} ${d} @${resolver.ip}">
              <code>dig +short ${t} ${d} @${resolver.ip}</code>
            </button>
          </div>
        </div>

        <!-- Keyboard Help -->
        <div class="drawer-footer-hint">
          <span>Keyboard: <kbd>&larr;</kbd> <kbd>&rarr;</kbd> flip resolvers &bull; <kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  `;

  // Attach events
  document.getElementById("btn-close-nslookup-drawer")?.addEventListener("click", closeDrawer);
  document.getElementById("nslookup-drawer-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "nslookup-drawer-backdrop") closeDrawer();
  });

  document.getElementById("btn-drawer-prev")?.addEventListener("click", () => {
    activeResolverIndex = (activeResolverIndex - 1 + resolvers.length) % resolvers.length;
    renderDrawer(mountEl);
  });

  document.getElementById("btn-drawer-next")?.addEventListener("click", () => {
    activeResolverIndex = (activeResolverIndex + 1) % resolvers.length;
    renderDrawer(mountEl);
  });

  document.getElementById("tab-nslookup")?.addEventListener("click", () => {
    activeTool = "nslookup";
    renderDrawer(mountEl);
  });

  document.getElementById("tab-dig")?.addEventListener("click", () => {
    activeTool = "dig";
    renderDrawer(mountEl);
  });

  // Copy command
  document.getElementById("btn-copy-cmd")?.addEventListener("click", (e) => {
    navigator.clipboard.writeText(activeCmd);
    showCopyFeedback(e.currentTarget, "Cmd Copied!");
  });

  // Copy output
  document.getElementById("btn-copy-output")?.addEventListener("click", (e) => {
    navigator.clipboard.writeText(terminalOutput);
    showCopyFeedback(e.currentTarget, "Output Copied!");
  });

  // Alt chips copy
  mountEl.querySelectorAll(".alt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const text = chip.getAttribute("data-copy");
      if (text) {
        navigator.clipboard.writeText(text);
        showCopyFeedback(chip, "Copied!");
      }
    });
  });

  // Keydown handler for Left/Right arrows inside drawer
  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      activeResolverIndex = (activeResolverIndex - 1 + resolvers.length) % resolvers.length;
      renderDrawer(mountEl);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      activeResolverIndex = (activeResolverIndex + 1) % resolvers.length;
      renderDrawer(mountEl);
    } else if (e.key === "Escape") {
      closeDrawer();
    }
  };

  window.removeEventListener("keydown", window._drawerKeyHandler);
  window._drawerKeyHandler = onKeyDown;
  window.addEventListener("keydown", onKeyDown);

  function closeDrawer() {
    window.removeEventListener("keydown", window._drawerKeyHandler);
    mountEl.innerHTML = "";
  }
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
