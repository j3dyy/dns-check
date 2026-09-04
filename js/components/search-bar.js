/**
 * DNS.usectl.com - Hero Search & Record Type Selector
 */
import { icons } from "../utils/icons.js";
import { store } from "../state.js";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA", "SOA", "PTR"];

export function renderSearchBar(mountEl) {
  const isQuerying = store.isLoading;

  mountEl.innerHTML = `
    <section class="hero-radar-strip">
      <div class="container">
        <div class="hero-search-card">
          <!-- Domain Input Row -->
          <form id="dns-query-form" class="search-input-row">
            <div class="search-icon-wrap">${icons.search(20)}</div>
            <input
              type="text"
              id="domain-input"
              class="domain-input"
              placeholder="Enter domain or IP (e.g. usectl.com, github.com)"
              value="${store.domain}"
              autocomplete="off"
              spellcheck="false"
              required
            />
            <button type="submit" class="query-action-btn" id="btn-submit-query">
              <span class="${isQuerying ? "is-spinning" : ""}">${icons.refresh(16)}</span>
              <span>${isQuerying ? "Probing..." : "Test DNS"}</span>
            </button>
          </form>

          <!-- Record Type Selector Row -->
          <div class="record-types-row">
            ${RECORD_TYPES.map((type) => `
              <button
                type="button"
                class="record-type-pill ${store.recordType === type ? "active" : ""}"
                data-type="${type}"
              >
                ${type}
              </button>
            `).join("")}
          </div>

          <!-- Expected Value Row (Optional diff checker) -->
          <div class="expected-toggle-row">
            <div class="expected-input-wrap">
              <span style="color: var(--text-dim); font-size: 0.8rem; font-weight: 600;">EXPECTED:</span>
              <input
                type="text"
                id="expected-input"
                placeholder="Optional expected IP / host (e.g. 76.76.21.21)"
                value="${store.expectedValue}"
              />
            </div>
            <div style="font-size: 0.78rem; color: var(--text-dim);">
              Press <kbd style="background: var(--bg-surface); padding: 2px 5px; border-radius: 4px; font-family: var(--font-mono);">/</kbd> to search &bull; Press <kbd style="background: var(--bg-surface); padding: 2px 5px; border-radius: 4px; font-family: var(--font-mono);">R</kbd> to refresh
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  // Attach Form Submit
  const form = document.getElementById("dns-query-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("domain-input");
    if (input && input.value) {
      store.setDomain(input.value);
      store.queryAll();
    }
  });

  // Record Type Switchers
  const pills = mountEl.querySelectorAll(".record-type-pill");
  pills.forEach((p) => {
    p.addEventListener("click", () => {
      const type = p.getAttribute("data-type");
      store.setRecordType(type);
    });
  });

  // Expected Value Input
  const expInput = document.getElementById("expected-input");
  expInput?.addEventListener("input", (e) => {
    store.setExpectedValue(e.target.value);
  });
}
