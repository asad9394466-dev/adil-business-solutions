/* =====================================================================
   Adil Business Solutions — API layer
   ---------------------------------------------------------------------
   The ONLY module that talks to the backend. Every screen calls these
   helpers, never fetch() directly. When we later swap Google Sheets for
   a real database, only this file (and the backend) changes.

   We POST JSON as text/plain on purpose: it keeps the request "simple"
   so the browser does not send a CORS preflight, which Apps Script
   handles awkwardly. Apps Script reads e.postData.contents.
   ===================================================================== */

const Session = {
  key: "abs_session",
  get() {
    try { return JSON.parse(localStorage.getItem(this.key)) || null; }
    catch { return null; }
  },
  set(data) { localStorage.setItem(this.key, JSON.stringify(data)); },
  clear() { localStorage.removeItem(this.key); },
  token() { const s = this.get(); return s ? s.token : null; },
  user()  { const s = this.get(); return s ? s.user  : null; }
};

const API = {

  configured() {
    const u = window.ABS_CONFIG.API_URL;
    return u && u !== "PASTE_YOUR_WEB_APP_URL_HERE" && /^https:\/\//.test(u);
  },

  async call(action, payload = {}) {
    if (!this.configured()) {
      throw new Error("Backend not configured. Set API_URL in assets/js/config.js (see docs/SETUP.md).");
    }
    const body = JSON.stringify(Object.assign({ action, token: Session.token() }, payload));
    let res;
    try {
      res = await fetch(window.ABS_CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        redirect: "follow"
      });
    } catch (e) {
      throw new Error("Could not reach the backend. Check the Web App URL and that it is deployed for 'Anyone'.");
    }
    let json;
    try { json = await res.json(); }
    catch { throw new Error("Backend returned an unexpected response (not JSON). Re-check the deployment."); }
    if (!json.ok) throw new Error(json.error || "Request failed.");
    return json.data;
  },

  // --- convenience wrappers -------------------------------------------
  ping()                       { return this.call("ping"); },
  login(username, password)    { return this.call("login", { username, password }); },
  dashboard()                  { return this.call("dashboard"); },
  salesSummary(from, to)       { return this.call("salesSummary", { from, to }); },
  weeklySummary()              { return this.call("weeklySummary"); },
  dashboardExtra()             { return this.call("dashboardExtra"); },
  inventoryAlerts()            { return this.call("inventoryAlerts"); },
  searchDocuments(q)           { return this.call("searchDocuments", { q }); },

  list(entity, params = {})    { return this.call("list",   Object.assign({ entity }, params)); },
  get(entity, id)              { return this.call("get",    { entity, id }); },
  create(entity, data)         { return this.call("create", { entity, data }); },
  update(entity, id, data)     { return this.call("update", { entity, id, data }); },
  remove(entity, id)           { return this.call("delete", { entity, id }); },
  nextNumber(name)             { return this.call("nextNumber", { name }); }
};

window.API = API;
window.Session = Session;
