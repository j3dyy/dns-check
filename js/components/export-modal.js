/**
 * DNS.usectl.com - Zone File & JSON Export Modal
 * Generates RFC 1035 BIND Zone syntax and structured JSON data.
 */
import { store } from "../state.js";
import { icons } from "../utils/icons.js";
import { showToast } from "../utils/toast.js";

export function initExportModal(mountEl) {
  window.addEventListener("open-export-modal", (e) => {
    const initialFormat = e.detail?.format || "bind";
    renderExportModal(mountEl, initialFormat);
  });
}

function generateBindZone(domain, zone) {
  const records = zone?.records || {};
  const dateStr = new Date().toISOString();
  const d = domain.endsWith(".") ? domain : `${domain}.`;

  const lines = [
    `; ====================================================================`,
    `; BIND 9 Zone File for: ${domain}`,
    `; Exported from: DNS.usectl.com ⚡ Global DNS Radar`,
    `; Timestamp: ${dateStr}`,
    `; ====================================================================`,
    `$ORIGIN ${d}`,
    `$TTL 3600`,
    ``
  ];

  // 1. SOA
  const soa = records.SOA && records.SOA.length > 0 ? records.SOA[0].value : null;
  if (soa) {
    const parts = soa.split(" ");
    const mname = parts[0] || `ns1.${d}`;
    const rname = parts[1] || `hostmaster.${d}`;
    const serial = parts[2] || `${new Date().toISOString().slice(0,10).replace(/-/g,'')}01`;
    const refresh = parts[3] || "7200";
    const retry = parts[4] || "3600";
    const expire = parts[5] || "1209600";
    const minimum = parts[6] || "3600";

    lines.push(`; SOA Authority`);
    lines.push(`@       IN      SOA     ${mname} ${rname} (`);
    lines.push(`                        ${serial.padEnd(10)} ; Serial`);
    lines.push(`                        ${refresh.padEnd(10)} ; Refresh`);
    lines.push(`                        ${retry.padEnd(10)} ; Retry`);
    lines.push(`                        ${expire.padEnd(10)} ; Expire`);
    lines.push(`                        ${minimum.padEnd(10)} ; Minimum TTL`);
    lines.push(`                        )`);
    lines.push(``);
  }

  // 2. NS Records
  if (records.NS && records.NS.length > 0) {
    lines.push(`; Authoritative Nameservers`);
    records.NS.forEach((r) => {
      const nsHost = r.value.endsWith(".") ? r.value : `${r.value}.`;
      lines.push(`@       ${(r.ttl || 3600).toString().padEnd(7)} IN      NS      ${nsHost}`);
    });
    lines.push(``);
  }

  // 3. MX Records
  if (records.MX && records.MX.length > 0) {
    lines.push(`; Mail Routing (MX)`);
    records.MX.forEach((r) => {
      const parts = r.value.split(" ");
      const prio = parts.length > 1 ? parts[0] : "10";
      let host = parts.length > 1 ? parts.slice(1).join(" ") : r.value;
      if (!host.endsWith(".")) host += ".";
      lines.push(`@       ${(r.ttl || 3600).toString().padEnd(7)} IN      MX      ${prio.padEnd(4)} ${host}`);
    });
    lines.push(``);
  }

  // 4. A Records
  const aRecs = (records.A || []).filter((r) => r.type === "A");
  if (aRecs.length > 0) {
    lines.push(`; IPv4 Host Addresses (A)`);
    aRecs.forEach((r) => {
      lines.push(`@       ${(r.ttl || 300).toString().padEnd(7)} IN      A       ${r.value}`);
    });
    lines.push(``);
  }

  // 5. AAAA Records
  if (records.AAAA && records.AAAA.length > 0) {
    lines.push(`; IPv6 Host Addresses (AAAA)`);
    records.AAAA.forEach((r) => {
      lines.push(`@       ${(r.ttl || 300).toString().padEnd(7)} IN      AAAA    ${r.value}`);
    });
    lines.push(``);
  }

  // 6. CNAME Records
  const cnames = (records.CNAME || []).concat(
    (records.A || []).filter((r) => r.type === "CNAME")
  );
  if (cnames.length > 0) {
    lines.push(`; Canonical Name Aliases (CNAME)`);
    const seen = new Set();
    cnames.forEach((r) => {
      if (seen.has(r.value)) return;
      seen.add(r.value);
      let target = r.value.endsWith(".") ? r.value : `${r.value}.`;
      lines.push(`www     ${(r.ttl || 300).toString().padEnd(7)} IN      CNAME   ${target}`);
    });
    lines.push(``);
  }

  // 7. TXT Records & DMARC
  const txts = records.TXT || [];
  if (txts.length > 0 || (zone.dmarc && zone.dmarc.hasDmarc)) {
    lines.push(`; Text Records, SPF & Verification`);
    txts.forEach((r) => {
      const cleanVal = r.value.replace(/^"|"$/g, "");
      lines.push(`@       ${(r.ttl || 300).toString().padEnd(7)} IN      TXT     "${cleanVal}"`);
    });
    if (zone.dmarc && zone.dmarc.hasDmarc && zone.dmarc.raw) {
      const cleanDmarc = zone.dmarc.raw.replace(/^"|"$/g, "");
      lines.push(`_dmarc  ${(300).toString().padEnd(7)} IN      TXT     "${cleanDmarc}"`);
    }
    lines.push(``);
  }

  // 8. CAA Records
  if (records.CAA && records.CAA.length > 0) {
    lines.push(`; Certificate Authority Authorization (CAA)`);
    records.CAA.forEach((r) => {
      lines.push(`@       ${(r.ttl || 3600).toString().padEnd(7)} IN      CAA     ${r.value}`);
    });
    lines.push(``);
  }

  return lines.join("\n");
}

function generateJsonExport(domain, zone) {
  const exportPayload = {
    domain,
    exportedAt: new Date().toISOString(),
    generator: "DNS.usectl.com",
    dnssec: store.dnssec,
    dmarc: zone?.dmarc || null,
    httpHealth: store.httpInfo || null,
    sslCertificate: store.sslInfo || null,
    records: zone?.records || {},
    asnMapping: store.asnInfo || {}
  };
  return JSON.stringify(exportPayload, null, 2);
}

function renderExportModal(mountEl, activeFormat = "bind") {
  let currentFormat = activeFormat;

  function getContent() {
    const domain = store.domain || "example.com";
    const zone = store.zoneRecords;
    return currentFormat === "bind" ? generateBindZone(domain, zone) : generateJsonExport(domain, zone);
  }

  function getFilename() {
    const domain = store.domain || "example.com";
    return currentFormat === "bind" ? `${domain}.zone` : `${domain}-dns-export.json`;
  }

  const domain = store.domain || "example.com";

  mountEl.innerHTML = `
    <div class="modal-backdrop" id="export-modal-backdrop">
      <div class="modal-content fade-in" style="max-width: 780px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--brand-cyan);">${icons.database(20)}</span>
            <div>
              <h2 class="modal-title" style="margin: 0; font-size: 1.15rem;">Export DNS Zone &amp; Configuration</h2>
              <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 2px;">Domain: <strong>${domain}</strong> &bull; Production-ready format</div>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-close-export-modal">${icons.x(20)}</button>
        </div>

        <div class="export-format-tabs">
          <button type="button" class="export-tab ${currentFormat === 'bind' ? 'active' : ''}" id="tab-bind">
            ${icons.fileText(14)}
            <span>RFC 1035 BIND Zone File</span>
          </button>
          <button type="button" class="export-tab ${currentFormat === 'json' ? 'active' : ''}" id="tab-json">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>Full JSON Structure</span>
          </button>
        </div>

        <div class="export-code-preview-wrap">
          <div class="export-code-toolbar">
            <span class="code-filename-label" id="export-filename-label">${getFilename()}</span>
            <div class="export-code-actions">
              <button type="button" class="btn-copy-code" id="btn-copy-export">
                ${icons.copy(13)}
                <span id="copy-btn-label">Copy to Clipboard</span>
              </button>
              <button type="button" class="btn-download-code" id="btn-download-export">
                ${icons.download(13)}
                <span>Download</span>
              </button>
            </div>
          </div>
          <pre class="export-pre"><code id="export-code-block" class="export-code">${getContent()}</code></pre>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 14px; margin-top: 8px;">
          <span style="font-size: 0.76rem; color: var(--text-dim);">
            Compatible with BIND 9, Cloudflare Import, Route53, PowerDNS &amp; DigitalOcean
          </span>
          <button type="button" class="btn-done" id="btn-done-export">Done</button>
        </div>
      </div>
    </div>
  `;

  // Switch tabs
  const tabBind = mountEl.querySelector("#tab-bind");
  const tabJson = mountEl.querySelector("#tab-json");
  const codeBlock = mountEl.querySelector("#export-code-block");
  const fileLabel = mountEl.querySelector("#export-filename-label");

  function updateView(format) {
    currentFormat = format;
    if (format === "bind") {
      tabBind.classList.add("active");
      tabJson.classList.remove("active");
    } else {
      tabJson.classList.add("active");
      tabBind.classList.remove("active");
    }
    codeBlock.textContent = getContent();
    fileLabel.textContent = getFilename();
  }

  tabBind?.addEventListener("click", () => updateView("bind"));
  tabJson?.addEventListener("click", () => updateView("json"));

  // Copy action
  const copyBtn = mountEl.querySelector("#btn-copy-export");
  const copyLabel = mountEl.querySelector("#copy-btn-label");
  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getContent());
      copyBtn.classList.add("copied");
      copyLabel.textContent = "Copied!";
      showToast(`${currentFormat.toUpperCase()} exported to clipboard!`, "success");
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyLabel.textContent = "Copy to Clipboard";
      }, 1800);
    } catch {
      showToast("Could not access clipboard", "error");
    }
  });

  // Download action
  const downloadBtn = mountEl.querySelector("#btn-download-export");
  downloadBtn?.addEventListener("click", () => {
    const text = getContent();
    const filename = getFilename();
    const mime = currentFormat === "bind" ? "text/plain;charset=utf-8" : "application/json;charset=utf-8";
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Saved ${filename}`, "success");
  });

  // Reactive subscription to zone records loading
  const unsub = store.subscribe((st, act) => {
    if (act?.type === "zone-records-update" || act?.type === "zone-loaded") {
      updateView(currentFormat);
    }
  });

  // Close handlers
  const close = () => {
    unsub();
    mountEl.innerHTML = "";
  };

  mountEl.querySelector("#btn-close-export-modal")?.addEventListener("click", close);
  mountEl.querySelector("#btn-done-export")?.addEventListener("click", close);
  mountEl.querySelector("#export-modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "export-modal-backdrop") close();
  });
}
