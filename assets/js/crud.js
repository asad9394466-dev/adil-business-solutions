/* =====================================================================
   Adil Business Solutions — Generic CRUD engine
   ---------------------------------------------------------------------
   Drives every list/add/edit/delete screen from a small config object,
   so each module file just describes its fields. Reused across phases.

   Config shape:
   {
     entity:  'Items',          // must match a Sheet tab / SCHEMA key
     title:   'Items',          // page heading + search label
     singular:'Item',           // used on the "New X" button
     columns: [ {key,label,type?,ref?} ],   // table columns
     fields:  [ {key,label,type?,required?,ref?,options?,step?,wide?,default?} ]
   }
   type: text | number | money | textarea | date | select
   ref : another entity name; renders a dropdown of its records (id -> name)
         and, in a column, resolves the id to that record's name.
   ===================================================================== */

const CRUD = {
  cache: {},

  async options(entity) {
    if (!this.cache[entity]) this.cache[entity] = await API.list(entity);
    return this.cache[entity];
  },
  invalidate(entity) { if (entity) delete this.cache[entity]; else this.cache = {}; },

  // ---- main page render ----------------------------------------------
  async page(mount, cfg, opts = {}) {
    UI.loading(true);
    let rows;
    try {
      const refs = new Set();
      (cfg.columns || []).forEach(c => { if (c.ref) refs.add(c.ref); });
      (cfg.fields  || []).forEach(f => { if (f.ref) refs.add(f.ref); });
      for (const r of refs) await this.options(r);
      rows = await API.list(cfg.entity);
    } catch (e) {
      UI.loading(false);
      mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}
        <h3>Couldn't load ${UI.escape(cfg.title)}</h3><p>${UI.escape(e.message)}</p></div></div>`;
      return;
    }
    UI.loading(false);

    mount.innerHTML = `
      <div class="page-head">
        <h1>${UI.escape(cfg.title)}</h1>
        <span class="page-sub" id="crud-count"></span>
        <div class="page-actions">
          <input id="crud-search" class="search-input" placeholder="Search ${UI.escape(cfg.title.toLowerCase())}…">
          <button class="btn btn--primary" id="crud-new">+ New ${UI.escape(cfg.singular)}</button>
        </div>
      </div>
      <div class="card no-pad"><div id="crud-table" class="table-wrap"></div></div>`;

    const state = { rows, filtered: rows.slice() };
    const tableEl = mount.querySelector('#crud-table');
    const countEl = mount.querySelector('#crud-count');

    const render = () => {
      const n = state.filtered.length;
      countEl.textContent = `${n} ${n === 1 ? cfg.singular.toLowerCase() : cfg.title.toLowerCase()}`;
      tableEl.innerHTML = this.tableHtml(cfg, state.filtered);
      tableEl.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.openForm(cfg, state, render, b.dataset.edit));
      tableEl.querySelectorAll('[data-del]').forEach(b => b.onclick = () => this.del(cfg, state, render, b.dataset.del));
    };
    render();

    const search = mount.querySelector('#crud-search');
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      state.filtered = !q ? state.rows.slice()
        : state.rows.filter(r => (cfg.columns || []).some(c => this.cellText(cfg, r, c).toLowerCase().indexOf(q) !== -1));
      render();
    };

    mount.querySelector('#crud-new').onclick = () => this.openForm(cfg, state, render, null);
    if (opts.openNew) this.openForm(cfg, state, render, null);
  },

  // ---- table ----------------------------------------------------------
  cellText(cfg, row, col) {
    let v = row[col.key];
    if (col.ref) {
      const o = (this.cache[col.ref] || []).find(x => String(x.id) === String(v));
      v = o ? (o[col.labelKey] || o.name || o.text || '') : '';
    }
    if (col.type === 'money') return (v === '' || v == null) ? '' : UI.money(v);
    return v == null ? '' : String(v);
  },

  tableHtml(cfg, rows) {
    if (!rows.length) {
      return `<div class="empty">${UI.icon('box')}<h3>No ${UI.escape(cfg.title.toLowerCase())} yet</h3>
        <p>Click “New ${UI.escape(cfg.singular)}” to add the first one.</p></div>`;
    }
    const numCls = c => (c.type === 'money' || c.type === 'number') ? ' class="num"' : '';
    const head = (cfg.columns || []).map(c => `<th${numCls(c)}>${UI.escape(c.label)}</th>`).join('') + '<th class="actions"></th>';
    const body = rows.map(r => {
      const tds = (cfg.columns || []).map(c => `<td${numCls(c)}>${UI.escape(this.cellText(cfg, r, c))}</td>`).join('');
      return `<tr>${tds}<td class="actions">
        <button class="link-btn" data-edit="${UI.escape(r.id)}">Edit</button>
        <button class="link-btn link-btn--danger" data-del="${UI.escape(r.id)}">Delete</button></td></tr>`;
    }).join('');
    return `<table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  },

  // ---- form modal -----------------------------------------------------
  QUICK_FIELDS: {
    Suppliers: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name', required: true }, { key: 'phone', label: 'Contact' }, { key: 'address', label: 'Address' }],
    Brands: [{ key: 'name', label: 'Name', required: true }],
    Customers: [{ key: 'name', label: 'Name', required: true }, { key: 'phone', label: 'Phone' }],
    Categories: [{ key: 'name', label: 'Name', required: true }]
  },
  quickAdd(entity, onCreated) {
    const fields = this.QUICK_FIELDS[entity] || [{ key: 'name', label: 'Name', required: true }];
    const singular = entity.replace(/s$/, '');
    const body = fields.map(f => `<label class="field field--wide"><span class="field-label">${UI.escape(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</span><input data-k="${f.key}"></label>`).join('');
    const modal = UI.el(`<div class="modal-overlay"><div class="modal">
      <div class="modal-head"><h2>New ${UI.escape(singular)}</h2><button class="icon-btn modal-close" title="Close">✕</button></div>
      <form class="modal-body">${body}</form>
      <div class="modal-foot"><button type="button" class="btn modal-close">Cancel</button><button type="button" class="btn btn--primary" id="qa-save">Create</button></div>
    </div></div>`);
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll('.modal-close').forEach(b => b.onclick = close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    const first = modal.querySelector('input'); if (first) first.focus();
    modal.querySelector('#qa-save').onclick = async () => {
      const data = {};
      fields.forEach(f => { data[f.key] = modal.querySelector(`[data-k="${f.key}"]`).value.trim(); });
      if (fields.some(f => f.required && !data[f.key])) { UI.toast('Please fill in the required fields.', 'error'); return; }
      UI.loading(true, 'Creating…');
      try { const rec = await API.create(entity, data); UI.loading(false); UI.toast(`${singular} created.`, 'success'); close(); onCreated(rec); }
      catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    };
  },

  async openForm(cfg, state, render, id) {
    const record = id ? (state.rows.find(r => String(r.id) === String(id)) || {}) : {};

    let bodyHtml, large = '';
    if (cfg.tabs && cfg.tabs.length) {
      large = ' modal--lg';
      const tabBar = cfg.tabs.map((t, idx) =>
        `<button type="button" class="tab-btn${idx === 0 ? ' active' : ''}" data-tab="${idx}">${UI.escape(t.label)}</button>`).join('');
      const panes = await Promise.all(cfg.tabs.map(async (t, idx) => {
        const tabFields = cfg.fields.filter(f => (f.tab || cfg.tabs[0].label) === t.label);
        const inner = tabFields.length
          ? `<div class="form-grid">${(await Promise.all(tabFields.map(f => this.fieldHtml(f, record)))).join('')}</div>`
          : `<div class="tab-note">${UI.escape(t.note || 'No fields yet.')}</div>`;
        return `<div class="tab-pane${idx === 0 ? ' active' : ''}" data-pane="${idx}">${inner}</div>`;
      }));
      bodyHtml = `<div class="tab-bar">${tabBar}</div><div>${panes.join('')}</div>`;
    } else {
      bodyHtml = `<div class="form-grid">${(await Promise.all(cfg.fields.map(f => this.fieldHtml(f, record)))).join('')}</div>`;
    }

    const modal = UI.el(`<div class="modal-overlay"><div class="modal${large}">
      <div class="modal-head"><h2>${id ? 'Edit' : 'New'} ${UI.escape(cfg.singular)}</h2>
        <button class="icon-btn modal-close" title="Close">✕</button></div>
      <form class="modal-body"></form>
      <div class="modal-foot">
        <button type="button" class="btn modal-close">Cancel</button>
        <button type="button" class="btn btn--primary" id="crud-save">${id ? 'Save changes' : 'Create'}</button>
      </div></div></div>`);
    modal.querySelector('.modal-body').innerHTML = bodyHtml;
    document.body.appendChild(modal);

    // tab switching
    modal.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => {
      modal.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      modal.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === btn.dataset.tab));
    });

    // inline quick-add (+) next to select fields
    modal.querySelectorAll('.quick-add-btn').forEach(btn => btn.onclick = () => {
      const entity = btn.dataset.entity, field = btn.dataset.field, labelKey = btn.dataset.label;
      this.quickAdd(entity, (rec) => {
        if (!this.cache[entity]) this.cache[entity] = [];
        this.cache[entity].push(rec);
        const sel = modal.querySelector(`select[name="${field}"]`);
        if (sel) {
          const opt = document.createElement('option');
          opt.value = rec.id; opt.textContent = rec[labelKey] || rec.name || rec.text || rec.id;
          sel.appendChild(opt); sel.value = rec.id;
        }
      });
    });

    const close = () => modal.remove();
    modal.querySelectorAll('.modal-close').forEach(b => b.onclick = close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    const first = modal.querySelector('input,select,textarea'); if (first) first.focus();

    modal.querySelector('#crud-save').onclick = async () => {
      const form = modal.querySelector('form');
      const data = {};
      let valid = true;
      cfg.fields.forEach(f => {
        const inp = form.querySelector(`[name="${f.key}"]`);
        const val = inp ? inp.value : '';
        if (f.required && !String(val).trim()) { if (inp) inp.classList.add('invalid'); valid = false; }
        else if (inp) inp.classList.remove('invalid');
        data[f.key] = val;
      });
      if (!valid) { UI.toast('Please fill in the required fields.', 'error'); return; }

      UI.loading(true, id ? 'Saving…' : 'Creating…');
      try {
        if (id) {
          const upd = await API.update(cfg.entity, id, data);
          Object.assign(record, upd);
        } else {
          const created = await API.create(cfg.entity, data);
          state.rows.push(created);
        }
        this.invalidate(cfg.entity);
        UI.loading(false);
        close();
        state.filtered = state.rows.slice();
        render();
        UI.toast(id ? 'Saved.' : 'Created.', 'success');
      } catch (e) {
        UI.loading(false);
        UI.toast(e.message, 'error');
      }
    };
  },

  async fieldHtml(f, record) {
    const v = (record[f.key] != null && record[f.key] !== '') ? record[f.key] : (f.default != null ? f.default : '');
    const req = f.required ? ' <span class="req">*</span>' : '';
    const wide = f.wide ? ' field--wide' : '';
    let input;

    if (f.type === 'textarea') {
      input = `<textarea name="${f.key}" rows="2">${UI.escape(v)}</textarea>`;
    } else if (f.type === 'select') {
      let opts = f.options || [];
      if (f.ref) opts = (await this.options(f.ref)).map(o => ({ value: o.id, label: o[f.labelKey] || o.name || o.text }));
      const optsHtml = `<option value="">— none —</option>` + opts.map(o => {
        const val = (o.value !== undefined) ? o.value : o;
        const lab = (o.label !== undefined) ? o.label : o;
        return `<option value="${UI.escape(val)}"${String(val) === String(v) ? ' selected' : ''}>${UI.escape(lab)}</option>`;
      }).join('');
      input = `<select name="${f.key}">${optsHtml}</select>`;
      if (f.quickAdd) {
        input = `<span class="input-with-btn">${input}<button type="button" class="btn quick-add-btn" data-field="${f.key}" data-entity="${f.quickAdd}"${f.labelKey ? ` data-label="${f.labelKey}"` : ''} title="Add new">＋</button></span>`;
      }
    } else {
      const t = f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : (f.type === 'password' ? 'password' : 'text'));
      input = `<input type="${t}" name="${f.key}"${f.step ? ` step="${f.step}"` : ''} value="${UI.escape(v)}">`;
    }
    return `<label class="field${wide}"><span class="field-label">${UI.escape(f.label)}${req}</span>${input}</label>`;
  },

  // ---- delete ---------------------------------------------------------
  async del(cfg, state, render, id) {
    const rec = state.rows.find(r => String(r.id) === String(id));
    const name = rec ? (rec.name || rec.text || id) : id;
    if (!confirm(`Delete "${name}"?`)) return;
    UI.loading(true, 'Deleting…');
    try {
      await API.remove(cfg.entity, id);
      state.rows = state.rows.filter(r => String(r.id) !== String(id));
      state.filtered = state.filtered.filter(r => String(r.id) !== String(id));
      this.invalidate(cfg.entity);
      UI.loading(false);
      render();
      UI.toast('Deleted.', 'success');
    } catch (e) {
      UI.loading(false);
      UI.toast(e.message, 'error');
    }
  }
};

window.CRUD = CRUD;
