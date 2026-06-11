/* =====================================================================
   Adil Business Solutions — Hash router
   #route?key=value  ->  registered handler(container, params)
   Routes not yet built show a "planned for a later phase" placeholder.
   ===================================================================== */

const Router = {
  routes: {},
  mount: null,

  register(route, handler) { this.routes[route] = handler; },

  init(mountSelector) {
    this.mount = document.querySelector(mountSelector);
    window.addEventListener("hashchange", () => this.resolve());
    this.resolve();
  },

  parse() {
    const raw = location.hash.replace(/^#/, "");
    const [route, query] = raw.split("?");
    const params = {};
    if (query) query.split("&").forEach(pair => {
      const [k, v] = pair.split("=");
      params[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
    return { route: route || "home", params };
  },

  go(route) { location.hash = "#" + route; },

  async resolve() {
    if (!this.mount) return;
    const { route, params } = this.parse();
    this.highlight(route);
    const label = this.menuLabel(route);
    const short = (window.ABS_CONFIG && window.ABS_CONFIG.APP_SHORT) || "ABS";
    document.title = label ? `${label} · ${short}` : ((window.ABS_CONFIG && window.ABS_CONFIG.APP_NAME) || "Adil Business Solutions");
    window.scrollTo(0, 0);

    const handler = this.routes[route];
    if (handler) {
      try {
        this.mount.innerHTML = "";
        await handler(this.mount, params);
      } catch (e) {
        this.mount.innerHTML = `<div class="card"><div class="empty">
          ${UI.icon("alert")}<h3>Something went wrong</h3><p>${UI.escape(e.message)}</p></div></div>`;
      }
    } else {
      this.placeholder(route);
    }
  },

  highlight(route) {
    UI.$$(".nav-link").forEach(a => {
      a.classList.toggle("active", a.dataset.route === route);
    });
  },

  // friendly placeholder for routes that exist in the menu but aren't built yet
  placeholder(route) {
    const label = this.menuLabel(route) || route;
    this.mount.innerHTML = `
      <div class="page-head"><h1>${UI.escape(label)}</h1></div>
      <div class="card"><div class="empty">
        ${UI.icon("layers")}
        <h3>Coming in a later phase</h3>
        <p>The <strong>${UI.escape(label)}</strong> screen is on the roadmap. Phase 0 sets up the
        shell, login and backend connection — modules are added phase by phase.</p>
      </div></div>`;
  },

  menuLabel(route) {
    for (const item of window.ABS_CONFIG.MENU) {
      if (item.route === route) return item.label;
      if (item.children) {
        const c = item.children.find(x => x.route === route);
        if (c) return c.label;
      }
    }
    return null;
  }
};

window.Router = Router;
