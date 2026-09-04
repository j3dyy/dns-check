/**
 * DNS.usectl.com - Application Bootstrap & Coordinator (No-Jump Reactive Flow)
 */
import { store } from "./state.js";
import { renderHeader } from "./components/header.js";
import { renderSearchBar, updateSearchBarState } from "./components/search-bar.js";
import { renderConsensusBar } from "./components/consensus-bar.js";
import { renderResolverGrid, updateResolverCard, updateAllResolverCards } from "./components/resolver-grid.js";
import { initCliModal } from "./components/cli-modal.js";
import { initSslModal } from "./components/ssl-modal.js";

async function init() {
  const headerMount = document.getElementById("header-mount");
  const searchMount = document.getElementById("search-mount");
  const consensusMount = document.getElementById("consensus-mount");
  const gridMount = document.getElementById("grid-mount");
  const modalMount = document.getElementById("modal-mount");

  // Initialize theme
  document.documentElement.setAttribute("data-theme", store.theme);

  // Parse deep link params
  store.parseUrlParams();

  // Setup modals
  initCliModal(modalMount);
  initSslModal(modalMount);

  // Render stable structures once
  renderHeader(headerMount);
  renderSearchBar(searchMount);
  renderConsensusBar(consensusMount);

  // Subscribe fine-grained reactive updates
  store.subscribe((state, action) => {
    // 1. Consensus bar updates smoothly
    renderConsensusBar(consensusMount);

    // 2. Search bar updates button spinner & active pills without rebuilding inputs
    updateSearchBarState();

    // 3. Resolver cards update in-place with zero DOM destruction
    if (action?.type === "resolver-update") {
      updateResolverCard(action.resolverId);
    } else if (action?.type === "resolvers-loaded") {
      renderResolverGrid(gridMount);
    } else if (action?.type === "expected-updated") {
      updateAllResolverCards();
    } else if (action?.type === "start-probing") {
      // Mark cards as probing smoothly without layout shift
      document.querySelectorAll(".resolver-card").forEach((card) => {
        card.classList.add("is-probing");
      });
    } else if (action?.type === "theme-toggled") {
      renderHeader(headerMount);
    } else {
      updateAllResolverCards();
    }
  });

  // Setup Global Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    // Focus search with '/'
    if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
      e.preventDefault();
      const input = document.getElementById("domain-input");
      input?.focus();
      input?.select();
    }
    // Refresh with 'r'
    if ((e.key === "r" || e.key === "R") && document.activeElement?.tagName !== "INPUT" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      store.queryAll();
    }
    // Close modals with Escape
    if (e.key === "Escape") {
      modalMount.innerHTML = "";
    }
  });

  // Load resolvers dataset & trigger initial query
  await store.loadResolvers();
  store.queryAll();
}

document.addEventListener("DOMContentLoaded", init);
