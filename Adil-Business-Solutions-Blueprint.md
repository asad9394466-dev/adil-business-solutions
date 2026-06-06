/* =====================================================================
   Adil Business Solutions — UI helpers
   Small, dependency-free helpers used across screens.
   ===================================================================== */

const UI = {

  // --- DOM -------------------------------------------------------------
  el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  },
  $(sel, root = document) { return root.querySelector(sel); },
  $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); },

  escape(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },

  // --- formatting ------------------------------------------------------
  money(n) {
    const sym = window.ABS_CONFIG.COMPANY.currency_symbol || "";
    const v = Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (sym ? sym + " " : "") + v;
  },
  date(d) {
    if (!d) return "";
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString();
  },

  // --- loading overlay -------------------------------------------------
  loading(show, msg = "Loading…") {
    let o = document.getElementById("abs-loading");
    if (show) {
      if (!o) {
        o = this.el(`<div id="abs-loading" class="abs-loading"><div class="abs-spinner"></div><div class="abs-loading-msg"></div></div>`);
        document.body.appendChild(o);
      }
      o.querySelector(".abs-loading-msg").textContent = msg;
      o.style.display = "flex";
    } else if (o) {
      o.style.display = "none";
    }
  },

  // --- toast notifications --------------------------------------------
  toast(message, type = "info") {
    let wrap = document.getElementById("abs-toasts");
    if (!wrap) {
      wrap = this.el(`<div id="abs-toasts" class="abs-toasts"></div>`);
      document.body.appendChild(wrap);
    }
    const t = this.el(`<div class="abs-toast abs-toast--${type}">${this.escape(message)}</div>`);
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 250);
    }, 3800);
  },

  // --- icons (inline SVG, no icon-font dependency) --------------------
  icon(name) {
    const p = {
      home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
      box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
      users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M17 7.5a3 3 0 0 1 0 5.5M21 20c0-2.4-1.4-4-3.5-4.6"/>',
      truck: '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
      'file-text': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
      cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/><path d="M3 4h2l2.2 11h10l2-7H6"/>',
      layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
      chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
      tag: '<path d="M3 12 12 3h7v7l-9 9Z"/><circle cx="15.5" cy="8.5" r="1.3"/>',
      menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
      logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/>',
      check: '<path d="m5 13 4 4L19 7"/>',
      alert: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17h.01"/>'
    };
    return `<svg class="abs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p[name] || p.box}</svg>`;
  }
};

window.UI = UI;
