/**
 * DNS.usectl.com - Hero Search & Record Type Selector
 */
import { icons } from "../utils/icons.js";
import { store } from "../state.js";

const RECORD_TYPES = ["ALL", "A", "AAAA", "CNAME", "MX", "TXT", "NS", "CAA", "SOA", "PTR"];

let isMounted = false;

export function renderSearchBar(mountEl) {
  if (isMounted) {
    updateSearchBarState();
    return;
  }

  isMounted = true;
  const isQuerying = store.isLoading;

  mountEl.innerHTML = `
    <section class="hero-radar-strip">
      <div class="container">
        <div class="hero-search-card">
          <!-- Domain Input Row -->
          <form id="dns-query-form" class="search-form-wrap">
            <div class="search-input-box">
              <div class="search-icon-wrap">${icons.search(18)}</div>
              <input
                type="text"
                id="domain-input"
                class="domain-input"
                placeholder="Enter domain or IP (e.g. usectl.com, github.com)"
                value="${store.domain || ""}"
                autocomplete="off"
                spellcheck="false"
                required
              />
              <button type="button" id="btn-clear-domain" class="btn-clear-domain ${store.domain ? '' : 'is-hidden'}" title="Clear input" aria-label="Clear input">
                ${icons.x(14)}
              </button>
            </div>
            <button type="submit" class="query-action-btn" id="btn-submit-query">
              <span id="btn-query-icon" class="${isQuerying ? "is-spinning" : ""}">${icons.refresh(16)}</span>
              <span id="btn-query-text">${isQuerying ? "Probing..." : "Test DNS"}</span>
            </button>
          </form>

          <!-- Recent Searches History Strip -->
          <div class="sample-try-row recent-history-row" id="recent-searches-row" style="${store.recentSearches.length > 0 ? '' : 'display: none;'}">
            <span class="sample-label">RECENT:</span>
            <div class="recent-chips-wrap sample-chips-scroll" id="recent-chips-container">
              ${renderRecentChips(store.recentSearches)}
            </div>
          </div>

          <!-- Quick Demo Suggestions Strip -->
          <div class="sample-try-row">
            <span class="sample-label">QUICK TEST:</span>
            <div class="sample-chips-scroll">
              <button type="button" class="sample-chip" data-domain="usectl.com">usectl.com</button>
              <button type="button" class="sample-chip" data-domain="github.com">github.com</button>
              <button type="button" class="sample-chip" data-domain="cloudflare.com">cloudflare.com</button>
              <button type="button" class="sample-chip" data-domain="google.com">google.com</button>
            </div>
          </div>

          <!-- Record Type Selector Row -->
          <div class="record-types-row" id="record-types-container">
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
              <span class="expected-label">EXPECTED:</span>
              <input
                type="text"
                id="expected-input"
                placeholder="Optional expected IP / host (e.g. 76.76.21.21)"
                value="${store.expectedValue}"
              />
            </div>
            <div class="desktop-shortcut-hints">
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

  // Quick Demo Chips
  mountEl.querySelectorAll(".sample-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const d = chip.getAttribute("data-domain");
      const input = document.getElementById("domain-input");
      if (input && d) {
        input.value = d;
        store.setDomain(d);
        store.queryAll();
      }
    });
  });

  // Record Type Switchers
  const pills = mountEl.querySelectorAll(".record-type-pill");
  pills.forEach((p) => {
    p.addEventListener("click", () => {
      const type = p.getAttribute("data-type");
      const input = document.getElementById("domain-input");
      if (input && input.value && input.value !== store.domain) {
        store.setDomain(input.value);
      }
      store.setRecordType(type);
    });
  });

  // Clear domain button
  const clearBtn = document.getElementById("btn-clear-domain");
  const domainInput = document.getElementById("domain-input");
  
  domainInput?.addEventListener("input", (e) => {
    if (clearBtn) {
      if (e.target.value) {
        clearBtn.classList.remove("is-hidden");
      } else {
        clearBtn.classList.add("is-hidden");
      }
    }
  });

  clearBtn?.addEventListener("click", () => {
    if (domainInput) {
      domainInput.value = "";
      domainInput.focus();
      clearBtn.classList.add("is-hidden");
    }
  });

  // Expected Value Input
  const expInput = document.getElementById("expected-input");
  expInput?.addEventListener("input", (e) => {
    store.setExpectedValue(e.target.value);
  });

  // Attach Recent search listeners
  const recentContainer = document.getElementById("recent-chips-container");
  if (recentContainer) {
    attachRecentListeners(recentContainer);
  }
}

function renderRecentChips(recents) {
  if (!recents || recents.length === 0) return "";
  return recents.map((d) => `
    <div class="recent-chip-item">
      <button type="button" class="sample-chip recent-domain-chip" data-domain="${d}">${d}</button>
      <button type="button" class="recent-remove-btn" data-remove="${d}" title="Remove ${d} from history">&times;</button>
    </div>
  `).join("");
}

function attachRecentListeners(container) {
  container.querySelectorAll(".recent-domain-chip").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const d = btn.getAttribute("data-domain");
      const input = document.getElementById("domain-input");
      if (input && d) {
        input.value = d;
        store.setDomain(d);
        store.queryAll();
      }
    });
  });

  container.querySelectorAll(".recent-remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const d = btn.getAttribute("data-remove");
      if (d) {
        store.removeRecentSearch(d);
      }
    });
  });
}

export function updateSearchBarState() {
  const icon = document.getElementById("btn-query-icon");
  const text = document.getElementById("btn-query-text");
  const domainInput = document.getElementById("domain-input");
  const clearBtn = document.getElementById("btn-clear-domain");

  if (domainInput && document.activeElement !== domainInput && domainInput.value !== store.domain) {
    domainInput.value = store.domain;
  }

  if (clearBtn && domainInput) {
    if (domainInput.value) {
      clearBtn.classList.remove("is-hidden");
    } else {
      clearBtn.classList.add("is-hidden");
    }
  }

  if (icon && text) {
    if (store.isLoading) {
      icon.classList.add("is-spinning");
      text.textContent = "Probing...";
    } else {
      icon.classList.remove("is-spinning");
      text.textContent = "Test DNS";
    }
  }

  // Update Recent Searches Strip
  const recentRow = document.getElementById("recent-searches-row");
  const recentContainer = document.getElementById("recent-chips-container");
  if (recentRow && recentContainer) {
    if (store.recentSearches && store.recentSearches.length > 0) {
      recentRow.style.display = "";
      recentContainer.innerHTML = renderRecentChips(store.recentSearches);
      attachRecentListeners(recentContainer);
    } else {
      recentRow.style.display = "none";
    }
  }

  const pills = document.querySelectorAll(".record-type-pill");
  pills.forEach((p) => {
    const type = p.getAttribute("data-type");
    if (type === store.recordType) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });
}
