/**
 * DNS.usectl.com - CLI Snippets Modal
 */
import { icons } from "../utils/icons.js";
import { store } from "../state.js";

export function initCliModal(mountEl) {
  window.addEventListener("open-cli-modal", () => {
    const d = store.domain || "usectl.com";
    const t = store.recordType || "A";

    mountEl.innerHTML = `
      <div class="modal-backdrop" id="cli-modal-backdrop">
        <div class="modal-content fade-in">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${icons.terminal(20)}
              <h2 class="modal-title">CLI DNS Commands</h2>
            </div>
            <button class="modal-close-btn" id="btn-close-cli-modal">${icons.x(20)}</button>
          </div>

          <p style="font-size: 0.88rem; color: var(--text-muted);">
            Query <code>${d}</code> (<code>${t}</code> record) directly from your terminal:
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <span style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">dig (Cloudflare @1.1.1.1)</span>
              <div class="cli-snippet-block" data-copy="dig +short ${t} ${d} @1.1.1.1">
                <code>dig +short ${t} ${d} @1.1.1.1</code>
                <button class="btn-copy-code">${icons.copy(14)}</button>
              </div>
            </div>

            <div>
              <span style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">dig (Google @8.8.8.8)</span>
              <div class="cli-snippet-block" data-copy="dig +short ${t} ${d} @8.8.8.8">
                <code>dig +short ${t} ${d} @8.8.8.8</code>
                <button class="btn-copy-code">${icons.copy(14)}</button>
              </div>
            </div>

            <div>
              <span style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">nslookup</span>
              <div class="cli-snippet-block" data-copy="nslookup -type=${t} ${d} 1.1.1.1">
                <code>nslookup -type=${t} ${d} 1.1.1.1</code>
                <button class="btn-copy-code">${icons.copy(14)}</button>
              </div>
            </div>

            <div>
              <span style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">curl (DNS-over-HTTPS JSON)</span>
              <div class="cli-snippet-block" data-copy="curl -s -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=${d}&type=${t}'">
                <code>curl -s -H 'accept: application/dns-json' 'https://cloudflare-dns.com/dns-query?name=${d}&type=${t}'</code>
                <button class="btn-copy-code">${icons.copy(14)}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Copy handlers
    mountEl.querySelectorAll(".cli-snippet-block").forEach((block) => {
      block.addEventListener("click", () => {
        const cmd = block.getAttribute("data-copy");
        if (cmd) {
          navigator.clipboard.writeText(cmd);
          const btn = block.querySelector(".btn-copy-code");
          if (btn) {
            btn.innerHTML = icons.check(14);
            setTimeout(() => {
              btn.innerHTML = icons.copy(14);
            }, 1200);
          }
        }
      });
    });

    // Close Modal
    document.getElementById("btn-close-cli-modal")?.addEventListener("click", () => {
      mountEl.innerHTML = "";
    });

    document.getElementById("cli-modal-backdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "cli-modal-backdrop") {
        mountEl.innerHTML = "";
      }
    });
  });
}
