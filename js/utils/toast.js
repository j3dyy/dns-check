/**
 * DNS.usectl.com - Toast Notification System
 */
let toastTimeout = null;

export function showToast(message, type = "info", duration = 2400) {
  let container = document.getElementById("dns-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "dns-toast-container";
    container.className = "dns-toast-container";
    document.body.appendChild(container);
  }

  // Remove existing toast
  container.innerHTML = "";
  if (toastTimeout) clearTimeout(toastTimeout);

  const toast = document.createElement("div");
  toast.className = `dns-toast-item ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-dot"></span>
      <span class="toast-msg">${message}</span>
    </div>
  `;

  container.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  toastTimeout = setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}
