/* =====================================================================
   Adil Business Solutions — App bootstrap
   Decides login vs app, builds the chrome, starts the router.
   ===================================================================== */

const App = {
  start() {
    const cfg = window.ABS_CONFIG;
    document.title = cfg.APP_NAME;
    if (Session.get()) this.showApp(); else this.showLogin();
  },

  // --- Login screen ----------------------------------------------------
  showLogin() {
    const cfg = window.ABS_CONFIG;
    document.body.className = "view-login";
    document.body.innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <div class="brand brand--lg">
            <span class="brand-mark">${UI.escape(cfg.APP_SHORT)}</span>
            <span class="brand-text">
              <strong>${UI.escape(cfg.APP_NAME)}</strong>
              <em>${UI.escape(cfg.TAGLINE)}</em>
            </span>
          </div>
          <form id="login-form" class="login-form" autocomplete="on">
            <label>Username
              <input name="username" type="text" required autofocus>
            </label>
            <label>Password
              <input name="password" type="password" required>
            </label>
            <button type="submit" class="btn btn--primary btn--block">Sign in</button>
            <div id="login-error" class="login-error"></div>
          </form>
          <div class="login-foot">${UI.escape(cfg.VERSION)}</div>
        </div>
      </div>`;

    const form = document.getElementById("login-form");
    const err  = document.getElementById("login-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const fd = new FormData(form);
      UI.loading(true, "Signing in…");
      try {
        const res = await API.login(fd.get("username").trim(), fd.get("password"));
        Session.set({ token: res.token, user: res.user });
        UI.loading(false);
        this.showApp();
      } catch (ex) {
        UI.loading(false);
        err.textContent = ex.message;
      }
    });
  },

  // --- Main application chrome -----------------------------------------
  showApp() {
    const cfg = window.ABS_CONFIG;
    const user = Session.user() || { name: "User" };
    document.body.className = "view-app";
    document.body.innerHTML = `
      <aside id="sidebar" class="sidebar">
        <div class="brand">
          <span class="brand-mark">${UI.escape(cfg.APP_SHORT)}</span>
          <span class="brand-text"><strong>${UI.escape(cfg.APP_NAME)}</strong><em>${UI.escape(cfg.TAGLINE)}</em></span>
        </div>
        <nav class="nav">${this.buildNav(cfg.MENU)}</nav>
        <div class="sidebar-foot">v${UI.escape(cfg.VERSION)}</div>
      </aside>

      <div class="app-main">
        <header class="topbar">
          <button id="menu-toggle" class="icon-btn" title="Menu">${UI.icon("menu")}</button>
          <div class="topbar-search">
            <input id="global-search" type="search" autocomplete="off" placeholder="Find invoices, bills, receipts, refunds…">
            <div id="search-results" class="search-results"></div>
          </div>
          <div class="topbar-right">
            <span class="user-chip">${UI.icon("users")} ${UI.escape(user.name || user.username || "User")}</span>
            <button id="logout-btn" class="icon-btn" title="Sign out">${UI.icon("logout")}</button>
          </div>
        </header>
        <main id="content" class="content"></main>
      </div>
      <div id="scrim" class="scrim"></div>`;

    // interactions
    document.getElementById("logout-btn").addEventListener("click", () => {
      Session.clear();
      this.showLogin();
    });
    this.wireGlobalSearch();
    const sidebar = document.getElementById("sidebar");
    const scrim = document.getElementById("scrim");
    document.getElementById("menu-toggle").addEventListener("click", () => {
      sidebar.classList.toggle("open"); scrim.classList.toggle("show");
    });
    scrim.addEventListener("click", () => { sidebar.classList.remove("open"); scrim.classList.remove("show"); });

    // expandable groups
    UI.$$(".nav-group > .nav-group-head").forEach(h => {
      h.addEventListener("click", () => h.parentElement.classList.toggle("open"));
    });
    // close mobile sidebar on navigation
    UI.$$(".nav-link").forEach(a => a.addEventListener("click", () => {
      sidebar.classList.remove("open"); scrim.classList.remove("show");
    }));

    Router.init("#content");
    if (window.CompanySettings) CompanySettings.loadCompany();
  },

  wireGlobalSearch() {
    const input = document.getElementById("global-search");
    const panel = document.getElementById("search-results");
    if (!input || !panel) return;
    let timer = null, lastQ = "";
    const hide = () => { panel.classList.remove("show"); panel.innerHTML = ""; };
    const run = async (q) => {
      try {
        const rows = await API.searchDocuments(q);
        if (input.value.trim() !== q) return; // stale
        if (!rows.length) { panel.innerHTML = `<div class="search-empty">No matches for “${UI.escape(q)}”</div>`; panel.classList.add("show"); return; }
        panel.innerHTML = rows.map(r => `
          <a class="search-row" data-route="${UI.escape(r.route)}" data-id="${UI.escape(r.id)}">
            <span class="search-type">${UI.escape(r.type)}</span>
            <span class="search-main"><strong>${UI.escape(r.number)}</strong>${r.name ? " · " + UI.escape(r.name) : ""}</span>
            <span class="search-meta">${UI.escape(UI.date(r.date))}${r.total ? " · " + UI.money(r.total) : ""}</span>
          </a>`).join("");
        panel.classList.add("show");
        panel.querySelectorAll(".search-row").forEach(a => a.onclick = () => {
          hide(); input.value = "";
          Router.go(a.dataset.route + "?id=" + a.dataset.id);
        });
      } catch (e) { panel.innerHTML = `<div class="search-empty">${UI.escape(e.message)}</div>`; panel.classList.add("show"); }
    };
    input.addEventListener("input", () => {
      const q = input.value.trim();
      clearTimeout(timer);
      if (q.length < 2) { hide(); return; }
      if (q === lastQ) return; lastQ = q;
      panel.innerHTML = `<div class="search-empty">Searching…</div>`; panel.classList.add("show");
      timer = setTimeout(() => run(q), 250);
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".topbar-search")) hide();
    });
  },

  buildNav(menu) {
    const built = new Set(window.ABS_CONFIG.BUILT_ROUTES || []);
    const link = (item) => {
      const ready = built.has(item.route) ? "" : " is-soon";
      return `<a class="nav-link${ready}" data-route="${item.route}" href="#${item.route}">
        <span class="nav-label">${UI.escape(item.label)}</span>
        ${built.has(item.route) ? "" : '<span class="soon-dot" title="Planned"></span>'}
      </a>`;
    };
    return menu.map(item => {
      if (item.children) {
        return `<div class="nav-group">
          <div class="nav-group-head">${UI.icon(item.icon)}<span>${UI.escape(item.label)}</span>
            <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          <div class="nav-group-body">${item.children.map(link).join("")}</div>
        </div>`;
      }
      return `<a class="nav-link nav-top" data-route="${item.route}" href="#${item.route}">
        ${UI.icon(item.icon)}<span class="nav-label">${UI.escape(item.label)}</span></a>`;
    }).join("");
  }
};

document.addEventListener("DOMContentLoaded", () => App.start());
window.App = App;
