/**
 * DNS.usectl.com - Global Resolver Grid Component (Stable In-Place Updates)
 */
import { icons } from "../utils/icons.js";
import { formatLatency, formatTTL } from "../utils/formatters.js";
import { store } from "../state.js";

let isMounted = false;

export function renderResolverGrid(mountEl) {
  const firstId = store.resolvers[0]?.id;
  if (!isMounted || !document.getElementById(`card-${firstId}`)) {
    mountGridStructure(mountEl);
    isMounted = true;
  }
  updateAllResolverCards();
}

/**
 * Mount DOM elements ONCE with fixed geometry
 */
function mountGridStructure(mountEl) {
  const regions = store.regions;
  const resolvers = store.resolvers;

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
          ${regResolvers.map((r) => `
            <div class="resolver-card" id="card-${r.id}">
              <div class="resolver-card-top">
                <div class="resolver-info" id="info-${r.id}" title="Click to inspect nslookup session">
                  <span class="resolver-flag">${r.flag || "🌐"}</span>
                  <div class="resolver-title-col">
                    <span class="resolver-name">${r.name}</span>
                    <span class="resolver-location">${r.location}</span>
                  </div>
                </div>

                <div class="resolver-meta-badges">
                  <button class="btn-card-nslookup" id="btn-nslookup-${r.id}" title="Inspect nslookup session">
                    ${icons.terminal(12)}
                  </button>
                  <span class="latency-badge" id="latency-${r.id}" style="display: none;"></span>
                  <span id="status-icon-${r.id}"></span>
                </div>
              </div>

              <div class="resolver-card-bottom" id="bottom-${r.id}" title="Click to copy record value">
                <div class="record-val-row">
                  <span class="record-val-text" id="val-${r.id}">
                    <span class="record-val-idle">Ready to probe</span>
                  </span>
                  <span class="record-ttl" id="ttl-${r.id}"></span>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  html += `</div>`;
  mountEl.innerHTML = html;

  // Add click to copy and click to open nslookup drawer
  resolvers.forEach((r) => {
    // Copy record
    const bottom = document.getElementById(`bottom-${r.id}`);
    bottom?.addEventListener("click", () => {
      const val = bottom.getAttribute("data-copy");
      if (val) {
        navigator.clipboard.writeText(val);
        const textEl = document.getElementById(`val-${r.id}`);
        if (textEl) {
          const original = textEl.textContent;
          textEl.innerHTML = `<span style="color: var(--brand-emerald);">${icons.check(13)} Copied!</span>`;
          setTimeout(() => {
            textEl.textContent = original;
          }, 1200);
        }
      }
    });

    // Open nslookup drawer
    const openDrawer = () => {
      window.dispatchEvent(new CustomEvent("open-nslookup-drawer", { detail: { resolverId: r.id } }));
    };

    document.getElementById(`btn-nslookup-${r.id}`)?.addEventListener("click", (e) => {
      e.stopPropagation();
      openDrawer();
    });

    document.getElementById(`info-${r.id}`)?.addEventListener("click", openDrawer);
  });
}

/**
 * Update a single resolver card in-place with zero layout shift
 */
export function updateResolverCard(resolverId) {
  const card = document.getElementById(`card-${resolverId}`);
  if (!card) return;

  const res = store.results[resolverId];
  const expected = store.expectedValue;
  const consensus = store.getConsensus();

  const latencyEl = document.getElementById(`latency-${resolverId}`);
  const statusIconEl = document.getElementById(`status-icon-${resolverId}`);
  const valEl = document.getElementById(`val-${resolverId}`);
  const ttlEl = document.getElementById(`ttl-${resolverId}`);
  const bottomEl = document.getElementById(`bottom-${resolverId}`);

  card.classList.remove("is-matched", "is-differing", "is-error", "is-probing");

  if (!res) {
    if (store.isLoading) {
      card.classList.add("is-probing");
      if (valEl) valEl.innerHTML = `<span class="skeleton-loading">Querying node...</span>`;
    } else {
      card.classList.remove("is-probing", "is-matched", "is-differing", "is-error");
      if (valEl) valEl.innerHTML = `<span class="record-val-idle">Ready to probe</span>`;
      if (latencyEl) latencyEl.style.display = "none";
      if (statusIconEl) statusIconEl.innerHTML = "";
      if (ttlEl) ttlEl.textContent = "";
    }
    return;
  }

  // Update Latency
  if (latencyEl && res.latency) {
    const latObj = formatLatency(res.latency);
    latencyEl.textContent = latObj.label;
    latencyEl.className = `latency-badge ${latObj.status}`;
    latencyEl.style.display = "inline-block";
  }

  // Update Status & Value
  if (res.success && res.primaryValue) {
    const val = res.primaryValue;
    if (valEl) valEl.textContent = val;
    if (ttlEl) ttlEl.textContent = res.ttl ? `TTL ${formatTTL(res.ttl)}` : "";
    if (bottomEl) bottomEl.setAttribute("data-copy", val);

    // Matching logic
    if (expected) {
      if (res.rawValues.includes(expected)) {
        card.classList.add("is-matched");
        if (statusIconEl) statusIconEl.innerHTML = `<span style="color: var(--brand-emerald);">${icons.check(14)}</span>`;
      } else {
        card.classList.add("is-differing");
        if (statusIconEl) statusIconEl.innerHTML = `<span style="color: var(--brand-amber);">${icons.alertTriangle(14)}</span>`;
      }
    } else if (consensus.dominantValue && res.primaryValue === consensus.dominantValue) {
      card.classList.add("is-matched");
      if (statusIconEl) statusIconEl.innerHTML = `<span style="color: var(--brand-emerald);">${icons.check(14)}</span>`;
    } else {
      card.classList.add("is-differing");
      if (statusIconEl) statusIconEl.innerHTML = `<span style="color: var(--brand-amber);">${icons.alertTriangle(14)}</span>`;
    }
  } else if (res.status === "nxdomain") {
    card.classList.add("is-error");
    if (valEl) valEl.innerHTML = `<span style="color: var(--text-dim);">NXDOMAIN (Not Found)</span>`;
    if (ttlEl) ttlEl.textContent = "";
    if (statusIconEl) statusIconEl.innerHTML = `<span style="color: var(--brand-rose);">${icons.x(14)}</span>`;
  } else if (res.status === "empty") {
    card.classList.add("is-differing");
    if (valEl) valEl.innerHTML = `<span style="color: var(--text-dim);">No ${store.recordType} Records</span>`;
    if (ttlEl) ttlEl.textContent = "";
    if (statusIconEl) statusIconEl.innerHTML = `<span style="color: var(--brand-amber);">${icons.alertTriangle(14)}</span>`;
  } else {
    card.classList.add("is-error");
    if (valEl) valEl.innerHTML = `<span style="color: var(--brand-rose);">${res.error || "Lookup Failed"}</span>`;
    if (ttlEl) ttlEl.textContent = "";
    if (statusIconEl) statusIconEl.innerHTML = `<span style="color: var(--brand-rose);">${icons.x(14)}</span>`;
  }
}

/**
 * Update all resolver cards in-place
 */
export function updateAllResolverCards() {
  for (const r of store.resolvers) {
    updateResolverCard(r.id);
  }
}
