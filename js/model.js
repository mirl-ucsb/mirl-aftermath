/* model.js: namespace, controlled vocabularies, the dossier state, persistence,
   and hashing. A dossier documents one site: what it was, what happened to it,
   and a series of dated assessments, each a condition report with a before and
   after photograph. Every source image is hashed, so a figure in the dossier
   stays tethered to the exact file it came from. */

window.AM = window.AM || {};

/* ---------- tiny DOM + misc helpers ---------- */
AM.util = {
  h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const c of kids) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
  toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(AM._tt); AM._tt = setTimeout(() => t.classList.remove('show'), 2300);
  },
  download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  },
  downloadText(name, text, type = 'text/plain') { this.download(name, new Blob([text], { type })); },
  slug(s) { return String(s || 'dossier').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'dossier'; },
  nowISO() { return new Date().toISOString(); },
  today() { return new Date().toISOString().slice(0, 10); },
  isRTL(s) { return /^[\s"'(\[]*[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(String(s || '')); },
  uid() { return 'x' + Math.random().toString(36).slice(2, 9); },
};

/* ---------- controlled vocabularies ---------- */
AM.vocab = {
  /* what happened, drawn from the kinds of event heritage assessments record */
  EVENTTYPE: ['armed conflict', 'shelling or airstrike', 'fire', 'earthquake', 'flood',
    'deliberate demolition', 'looting', 'neglect', 'other'],

  /* a damage typology in the manner of ICOMOS / ICCROM post-event condition
     surveys: the categories an assessor assigns to a part of a site */
  DAMAGE: [
    { key: 'collapse',   label: 'Structural collapse' },
    { key: 'structural', label: 'Structural damage' },
    { key: 'ballistic',  label: 'Ballistic / blast' },
    { key: 'fire',       label: 'Fire / smoke' },
    { key: 'water',      label: 'Water / moisture' },
    { key: 'looting',    label: 'Looting / theft' },
    { key: 'vandalism',  label: 'Vandalism / defacement' },
    { key: 'material',   label: 'Material loss / detachment' },
    { key: 'cracking',   label: 'Cracking / deformation' },
    { key: 'biological', label: 'Biological / vegetation' },
    { key: 'weathering', label: 'Weathering / surface' },
    { key: 'other',      label: 'Other' },
  ],

  /* an escalating severity grade, legible in print and aligned with the way
     satellite and field damage assessments report (none to total loss) */
  SEVERITY: [
    { key: 'none',      label: 'No visible damage', cls: 'sv-none',     n: 0 },
    { key: 'minor',     label: 'Minor',             cls: 'sv-minor',    n: 1 },
    { key: 'moderate',  label: 'Moderate',          cls: 'sv-moderate', n: 2 },
    { key: 'severe',    label: 'Severe',            cls: 'sv-severe',   n: 3 },
    { key: 'destroyed', label: 'Destroyed',         cls: 'sv-destroyed', n: 4 },
  ],

  /* who may see a source image, in the rescue-archiving manner */
  CONSENT: [
    { key: 'public',     label: 'public',     gloss: 'may appear in the dossier and exports' },
    { key: 'restricted', label: 'restricted', gloss: 'kept out of exports by default' },
  ],
};
AM.vocab.damageOf = k => AM.vocab.DAMAGE.find(d => d.key === k) || AM.vocab.DAMAGE[AM.vocab.DAMAGE.length - 1];
AM.vocab.severityOf = k => AM.vocab.SEVERITY.find(s => s.key === k) || AM.vocab.SEVERITY[0];

/* ---------- state ---------- */
AM.blankProject = () => ({
  site: {
    name: '', place: '', lat: null, lon: null, safe: false,
    designation: '', identifier: '', description: '',
  },
  dossier: { reference: '', assessor: '', organization: '', contact: '', note: '' },
  events: [],        /* { id, date, type, source, note } */
  assessments: [],   /* see newAssessment */
  created: AM.util.nowISO(),
  modified: AM.util.nowISO(),
});

AM.state = {
  project: AM.blankProject(),
  route: { view: 'site', id: null },
};

/* ---------- a single photograph in a before/after pair ---------- */
AM.blankPhoto = () => ({
  id: AM.util.uid(),
  name: '', dataUrl: '', natW: 0, natH: 0,
  sha256: '', date: '', provenance: '', consent: 'public',
});

/* ---------- assessments ---------- */
AM.Model = (function () {
  const S = AM.state;

  function newAssessment() {
    let max = 0;
    S.project.assessments.forEach(a => { const m = /^A-(\d+)$/.exec(a.id || ''); if (m) max = Math.max(max, +m[1]); });
    return {
      id: 'A-' + String(max + 1).padStart(3, '0'),
      area: '', date: AM.util.today(), assessor: '',
      category: 'structural', severity: 'moderate',
      eventId: null,
      summary: '', recommendation: '',
      before: AM.blankPhoto(), after: AM.blankPhoto(),
      align: { beforePts: [], afterPts: [], H: null, rms: null },
      created: AM.util.nowISO(), modified: AM.util.nowISO(),
    };
  }

  function normPhoto(p) {
    return Object.assign(AM.blankPhoto(), p || {}, { id: (p && p.id) || AM.util.uid() });
  }

  function normalize(a) {
    const d = newAssessment();
    const out = Object.assign({}, d, a);
    out.before = normPhoto(a.before);
    out.after = normPhoto(a.after);
    out.align = Object.assign({ beforePts: [], afterPts: [], H: null, rms: null }, a.align || {});
    if (!AM.vocab.DAMAGE.some(x => x.key === out.category)) out.category = 'other';
    if (!AM.vocab.SEVERITY.some(x => x.key === out.severity)) out.severity = 'moderate';
    out.eventId = typeof a.eventId === 'string' && a.eventId ? a.eventId : null;
    return out;
  }

  function get(id) { return S.project.assessments.find(a => a.id === id) || null; }

  function add() {
    const a = newAssessment();
    S.project.assessments.push(a);
    touch(a);
    return a;
  }

  function remove(id) {
    const i = S.project.assessments.findIndex(a => a.id === id);
    if (i >= 0) S.project.assessments.splice(i, 1);
    S.project.modified = AM.util.nowISO();
  }

  function touch(a) {
    if (a) a.modified = AM.util.nowISO();
    S.project.modified = AM.util.nowISO();
  }

  function eventOf(id) { return (S.project.events || []).find(e => e.id === id) || null; }

  function addEvent() {
    let max = 0;
    (S.project.events || []).forEach(e => { const m = /^evt-(\d+)$/.exec(e.id || ''); if (m) max = Math.max(max, +m[1]); });
    const ev = { id: 'evt-' + (max + 1), date: '', type: 'armed conflict', source: '', note: '' };
    S.project.events.push(ev);
    S.project.modified = AM.util.nowISO();
    return ev;
  }

  function removeEvent(id) {
    S.project.events = (S.project.events || []).filter(e => e.id !== id);
    let cleared = 0;
    S.project.assessments.forEach(a => { if (a.eventId === id) { a.eventId = null; cleared++; } });
    S.project.modified = AM.util.nowISO();
    return cleared;
  }

  /* every source image with its fingerprint and provenance: the appendix */
  function sources() {
    const out = [];
    S.project.assessments.forEach(a => {
      ['before', 'after'].forEach(role => {
        const p = a[role];
        if (p && (p.name || p.sha256 || p.dataUrl)) out.push({ assessment: a.id, role, photo: p });
      });
    });
    return out;
  }

  /* ---------- one JSON document per dossier ---------- */
  function serialize(publicOnly) {
    const project = publicOnly ? publicClone().project : workingProject();
    return { format: 'mirl-aftermath', version: 1, project };
  }

  /* the working file, minus the transient registered-overlay image */
  function workingProject() {
    return Object.assign({}, S.project, {
      assessments: (S.project.assessments || []).map(a => {
        const align = Object.assign({}, a.align); delete align._overlayUrl;
        return Object.assign({}, a, { align });
      }),
    });
  }

  /* a copy fit to circulate: restricted images withheld (data and hash kept
     out), the site's coordinates withheld unless marked safe to publish */
  function publicClone() {
    const clone = JSON.parse(JSON.stringify({ project: S.project }));
    const site = clone.project.site;
    if (!site.safe) { site.lat = null; site.lon = null; }
    clone.project.assessments.forEach(a => {
      if (a.align) delete a.align._overlayUrl;
      ['before', 'after'].forEach(role => {
        const p = a[role];
        if (p && p.consent === 'restricted') {
          a[role] = Object.assign(AM.blankPhoto(), { id: p.id, consent: 'restricted', name: p.name, withheld: true });
        }
      });
    });
    return clone;
  }

  function loadData(data) {
    if (!data || data.format !== 'mirl-aftermath' || !data.project) {
      throw new Error('Not an Aftermath dossier file.');
    }
    const p = Object.assign(AM.blankProject(), data.project);
    p.site = Object.assign(AM.blankProject().site, data.project.site || {});
    p.dossier = Object.assign(AM.blankProject().dossier, data.project.dossier || {});
    p.events = (Array.isArray(data.project.events) ? data.project.events : [])
      .filter(e => e && e.id)
      .map(e => ({ id: e.id, date: e.date || '', type: e.type || 'other', source: e.source || '', note: e.note || '' }));
    p.assessments = (Array.isArray(data.project.assessments) ? data.project.assessments : []).map(normalize);
    S.project = p;
  }

  function reset() { S.project = AM.blankProject(); }

  return { newAssessment, normalize, get, add, remove, touch, eventOf, addEvent, removeEvent,
    sources, serialize, publicClone, loadData, reset };
})();

/* ---------- autosave in the browser ---------- */
AM.Store = (function () {
  const KEY = 'mirl-aftermath-project';
  let timer = null, warned = false;

  function save() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(AM.Model.serialize(false)));
      } catch (e) {
        if (!warned) { warned = true; AM.util.toast('Too large to autosave here. Save your dossier file.'); }
      }
    }, 400);
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      AM.Model.loadData(JSON.parse(raw));
      return true;
    } catch (e) { return false; }
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  return { save, load, clear };
})();

/* ---------- sha-256 + a downsized, embeddable copy of each source ---------- */
AM.Hash = (function () {
  async function sha256(buf) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      const d = await crypto.subtle.digest('SHA-256', buf);
      let s = ''; const b = new Uint8Array(d);
      for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
      return s;
    }
    return '';
  }

  /* a JPEG copy at a sane size, so the dossier is self-contained and prints,
     while the sha-256 is taken from the ORIGINAL file for evidence */
  function embed(file) {
    return new Promise(resolve => {
      if (!/^image\//.test(file.type)) return resolve(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k));
        c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let dataUrl = '';
        try { dataUrl = c.toDataURL('image/jpeg', 0.85); } catch (e) {}
        resolve({ dataUrl, natW: img.naturalWidth, natH: img.naturalHeight });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* attach a chosen file to a photo slot: hash the original, embed a copy */
  async function attach(photo, file) {
    photo.name = file.name;
    try { photo.sha256 = await sha256(await file.arrayBuffer()); } catch (e) { photo.sha256 = ''; }
    const e = await embed(file);
    if (e) { photo.dataUrl = e.dataUrl; photo.natW = e.natW; photo.natH = e.natH; }
    return photo;
  }

  return { sha256, embed, attach };
})();
