/**
 * DNS.usectl.com - Header Navigation Component
 */
import { icons } from "../utils/icons.js";
import { store } from "../state.js";
import { showToast } from "../utils/toast.js";

export function renderHeader(mountEl) {
  const isDark = store.theme === "dark";

  mountEl.innerHTML = `
    <header class="site-header">
      <div class="container site-header-inner">
        <div class="brand-group">
          <a href="./" class="brand-logo-wrap" title="DNS.usectl.com">
            ${icons.logo(38)}
          </a>
          <div class="brand-text">
            <span class="brand-title">DNS<span class="brand-accent">.usectl</span></span>
            <span class="brand-subtitle">Global Edge Propagation &amp; SSL Radar</span>
          </div>
        </div>

        <div class="header-actions">
          <button class="text-btn header-action-btn" id="btn-cli-modal" title="View CLI dig &amp; nslookup commands" aria-label="CLI dig and nslookup commands">
            ${icons.terminal(16)}
            <span class="btn-text-cli">CLI Dig</span>
          </button>
          
          <button class="icon-btn header-action-btn" id="btn-share-url" title="Share or Copy Link" aria-label="Share URL">
            ${icons.share(16)}
          </button>

          <button class="icon-btn header-action-btn" id="btn-theme-toggle" title="Toggle Light/Dark Theme" aria-label="Toggle Theme">
            ${isDark ? icons.sun(16) : icons.moon(16)}
          </button>

          <a href="https://github.com/j3dyy/dns-check" target="_blank" rel="noopener" class="icon-btn header-action-btn" title="GitHub Repository" aria-label="GitHub Repository">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
        </div>
      </div>
    </header>
  `;

  // Attach Event Listeners
  document.getElementById("btn-theme-toggle")?.addEventListener("click", () => {
    store.toggleTheme();
  });

  document.getElementById("btn-share-url")?.addEventListener("click", async () => {
    store.updateUrlParams();
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Permalink copied to clipboard! Ready to share.", "success");
      const btn = document.getElementById("btn-share-url");
      btn.innerHTML = icons.check(16);
      setTimeout(() => {
        btn.innerHTML = icons.share(16);
      }, 1500);
    } catch {
      showToast("Unable to copy permalink", "error");
    }
  });

  document.getElementById("btn-cli-modal")?.addEventListener("click", () => {
    const event = new CustomEvent("open-cli-modal");
    window.dispatchEvent(event);
  });
}
