// ==================== THEME MANAGER ====================
const ThemeManager = {
  STORAGE_KEY: "barbercloud_theme",

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    this.setTheme(theme);

    document.querySelectorAll(".theme-toggle").forEach(btn => {
      btn.addEventListener("click", () => this.toggle());
    });
  },

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.updateIcons(theme);
  },

  toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    this.setTheme(next);
  },

  updateIcons(theme) {
    document.querySelectorAll(".theme-toggle").forEach(btn => {
      const sun = btn.querySelector(".icon-sun");
      const moon = btn.querySelector(".icon-moon");
      if (sun && moon) {
        sun.classList.toggle("hidden", theme !== "light");
        moon.classList.toggle("hidden", theme !== "dark");
      }
    });
  }
};

// ==================== TOAST NOTIFICATIONS ====================
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "toast-container";
      this.container.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;
      document.body.appendChild(this.container);
    }
  },

  show(message, type = "info", duration = 3500) {
    this.init();

    const colors = {
      success: { bg: "rgba(74, 222, 128, 0.1)", border: "rgba(74, 222, 128, 0.4)", color: "#4ade80" },
      error: { bg: "rgba(248, 113, 113, 0.1)", border: "rgba(248, 113, 113, 0.4)", color: "#f87171" },
      warning: { bg: "rgba(251, 191, 36, 0.1)", border: "rgba(251, 191, 36, 0.4)", color: "#fbbf24" },
      info: { bg: "rgba(74, 122, 235, 0.1)", border: "rgba(74, 122, 235, 0.4)", color: "#4a7aeb" }
    };

    const style = colors[type] || colors.info;

    const toast = document.createElement("div");
    toast.style.cssText = `
      padding: 14px 20px;
      background: ${style.bg};
      border: 1px solid ${style.border};
      border-left: 4px solid ${style.color};
      border-radius: 8px;
      color: ${style.color};
      font-weight: 500;
      min-width: 280px;
      max-width: 400px;
      animation: toastSlideIn 0.3s ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "toastSlideOut 0.3s ease forwards";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

// ==================== XSS PROTECTION ====================
const escapeHtml = (str) => {
  if (str == null) return "";
  const s = String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ==================== LOADING STATES ====================
const Loading = {
  button(btn, show) {
    if (show) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = `<span class="spinner"></span> Procesando...`;
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || "Aceptar";
      btn.disabled = false;
    }
  }
};

// ==================== DATE FORMATTING ====================
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

// Add toast animation styles
const style = document.createElement("style");
style.textContent = `
  @keyframes toastSlideIn {
    from { opacity: 0; transform: translateX(100px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes toastSlideOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100px); }
  }
`;
document.head.appendChild(style);

// Initialize theme on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.init();
  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", () => AUTH.logout());
  });
});
