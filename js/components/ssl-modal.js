/**
 * DNS.usectl.com - SSL/TLS Certificate Details Modal
 */
import { icons } from "../utils/icons.js";
import { store } from "../state.js";

export function initSslModal(mountEl) {
  window.addEventListener("open-ssl-modal", () => {
    const ssl = store.sslInfo;
    if (!ssl) return;

    mountEl.innerHTML = `
      <div class="modal-backdrop" id="ssl-modal-backdrop">
        <div class="modal-content fade-in">
          <div class="modal-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${icons.lock(20)}
              <h2 class="modal-title">SSL/TLS Certificate Radar</h2>
            </div>
            <button class="modal-close-btn" id="btn-close-ssl-modal">${icons.x(20)}</button>
          </div>

          ${ssl.success ? `
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <!-- Expiration Banner -->
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 16px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-size: 1.25rem; font-weight: 800; color: var(--brand-emerald);">
                    ${ssl.daysRemaining} Days Remaining
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">
                    Expires: ${ssl.expiresAt}
                  </div>
                </div>
                <div style="font-size: 0.82rem; font-weight: 700; background: rgba(16, 185, 129, 0.2); color: var(--brand-emerald); padding: 4px 10px; border-radius: 9999px;">
                  Active &amp; Valid
                </div>
              </div>

              <!-- Certificate Meta Table -->
              <div style="background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 0.86rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-dim);">Domain</span>
                  <span style="font-weight: 600; font-family: var(--font-mono);">${ssl.domain}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-dim);">Issuer</span>
                  <span style="font-weight: 600;">${ssl.issuer}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-dim);">Protocol</span>
                  <span style="font-weight: 600; font-family: var(--font-mono);">${ssl.tlsVersion}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-dim);">Cipher Suite</span>
                  <span style="font-weight: 600; font-family: var(--font-mono); font-size: 0.78rem;">${ssl.cipher}</span>
                </div>
              </div>

              <!-- Subject Alternative Names -->
              ${ssl.sans && ssl.sans.length > 0 ? `
                <div>
                  <span style="font-size: 0.78rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">Covered Hostnames (SANs)</span>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                    ${ssl.sans.map((s) => `
                      <span style="background: var(--bg-surface); padding: 3px 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--brand-cyan);">
                        ${s}
                      </span>
                    `).join("")}
                  </div>
                </div>
              ` : ""}
            </div>
          ` : `
            <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: var(--radius-md); padding: 16px; color: var(--brand-rose);">
              <strong>SSL Check Error:</strong> ${ssl.error || "Unable to inspect certificate on port 443"}
            </div>
          `}
        </div>
      </div>
    `;

    document.getElementById("btn-close-ssl-modal")?.addEventListener("click", () => {
      mountEl.innerHTML = "";
    });

    document.getElementById("ssl-modal-backdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "ssl-modal-backdrop") {
        mountEl.innerHTML = "";
      }
    });
  });
}
