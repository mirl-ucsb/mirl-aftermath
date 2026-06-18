/* sheets.js: the survey sheets and their live forms.

   Three sheets, numbered like folios:
   - S-01 Site: the title block, the site and dossier metadata, and the events
     that harmed the site.
   - S-02 Schedule: a ruled register of every assessment.
   - S-03 Assessment: one condition report, rendered above its working form (the
     desk), in the manner of MIRL Lacuna's record page: every keystroke on the
     desk updates the report above, so what you will print is always in view.

   The report renderer (reportHTML) and the schedule table (scheduleTableHTML)
   are pure functions over data, so the printed dossier reuses them unchanged. */

window.AM = window.AM || {};

AM.Sheets = (function () {
  const S = AM.state;
  const U = AM.util;
  const V = AM.vocab;
  let current = null;
  let curSheet = { no: 'S-01', name: 'Site' };

  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
  function dirAttr(s) { return U.isRTL(s) ? ' dir="rtl"' : ''; }
  function fmtCoord(lat, lon) {
    return Math.abs(lat).toFixed(4) + (lat >= 0 ? ' N' : ' S') + ', ' +
      Math.abs(lon).toFixed(4) + (lon >= 0 ? ' E' : ' W');
  }

  /* =====================================================================
     Pure renderers, shared by the live sheets and the printed dossier.
     ===================================================================== */
  function titleBlockHTML(sheetNo, sheetName) {
    const p = S.project, s = p.site, d = p.dossier;
    const e = U.esc;
    const org = d.organization || 'Material / Image Research Lab, UC Santa Barbara';
    const date = (p.created || '').slice(0, 10) || U.today();
    const cell = (label, val, cls) =>
      '<div class="tb-cell"><span>' + label + '</span><b' + (cls ? ' class="' + cls + '"' : '') + '>' +
      (val ? e(val) : '<span class="none">-</span>') + '</b></div>';
    let h = '<div class="titleblock">';
    h += '<div class="tb-org">' + e(org) + '</div>';
    h += '<div class="tb-title"' + dirAttr(s.name) + '>' +
      (s.name ? e(s.name) : '<span class="tb-untitled">Untitled site</span>') +
      (s.designation ? ' <span style="font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)">· ' + e(s.designation) + '</span>' : '') +
      '</div>';
    h += '<div class="tb-cells">';
    h += '<div class="tb-cell"><span>Sheet</span><b class="sheetno">' + e(sheetNo) +
      '</b><b style="font-weight:400;color:var(--ink-2);margin-left:8px">' + e(sheetName) + '</b></div>';
    h += cell('Reference', d.reference);
    h += cell('Assessor', d.assessor);
    h += cell('Dossier date', date);
    h += '</div></div>';
    return h;
  }

  function scheduleTableHTML(list, opts) {
    opts = opts || {};
    const e = U.esc;
    if (!list.length) return '';
    let h = '<table class="register"><tr>' +
      '<th>No.</th><th>Area or element</th><th>Date</th><th>Assessor</th><th>Damage type</th><th>Severity</th></tr>';
    list.forEach(a => {
      const sev = V.severityOf(a.severity), cat = V.damageOf(a.category);
      const attr = opts.static ? '' : ' class="entry" data-id="' + e(a.id) + '"';
      h += '<tr' + attr + '>' +
        '<td class="no">' + e(a.id) + '</td>' +
        '<td class="area"' + dirAttr(a.area) + '><span class="t">' + (a.area ? e(a.area) : '<span style="color:var(--ink-3);font-style:italic">untitled</span>') + '</span></td>' +
        '<td class="mono">' + (a.date ? e(a.date) : '-') + '</td>' +
        '<td>' + (a.assessor ? e(a.assessor) : '-') + '</td>' +
        '<td>' + e(cat.label) + '</td>' +
        '<td><span class="mark ' + sev.cls + '">' + cap(sev.key) + '</span></td>' +
        '</tr>';
    });
    return h + '</table>';
  }

  /* one source-image line in the report */
  function srcRow(role, ph, opts) {
    const e = U.esc;
    if (!ph || (!ph.name && !ph.sha256 && !ph.dataUrl && !ph.withheld)) {
      return '<tr><td class="role">' + role + '</td><td><span class="rp-none">not supplied</span></td><td class="cnt"></td></tr>';
    }
    let meta = [];
    if (ph.withheld) {
      meta = ['withheld from this dossier under restriction'];
    } else {
      if (ph.date) meta.push(e(ph.date));
      if (ph.provenance) meta.push(e(ph.provenance));
      if (ph.sha256) meta.push('<span title="sha-256 ' + e(ph.sha256) + '">sha-256 ' + e(ph.sha256.slice(0, 16)) + '…</span>');
    }
    let h = '<tr><td class="role">' + role + '</td><td>';
    h += '<div class="src-name"' + dirAttr(ph.name) + '>' + (ph.name ? e(ph.name) : '(unnamed file)') + '</div>';
    if (meta.length) h += '<div class="src-meta">' + meta.join(' · ') + '</div>';
    if (!opts.publicMode && ph.consent === 'restricted' && !ph.withheld) {
      h += '<div class="src-meta" style="color:var(--red)">restricted: withheld from every export</div>';
    }
    h += '</td><td class="cnt"><span class="consent ' + e(ph.consent || 'public') + '">' + e(ph.consent || 'public') + '</span></td></tr>';
    return h;
  }

  /* the condition report for one assessment: header, severity stamp, category,
     the before/after figure, the findings, and the source lines */
  function reportHTML(a, opts) {
    opts = opts || {};
    const e = U.esc;
    const events = opts.events || S.project.events || [];
    const sev = V.severityOf(a.severity), cat = V.damageOf(a.category);
    const ev = a.eventId && events.find(x => x.id === a.eventId);

    let h = '<div class="report"><div class="inner">';
    h += '<div class="rp-top"><div class="rp-no">Assessment ' + e(a.id) + '</div>' +
      '<div class="rp-stamp"><span class="mark ' + sev.cls + '">' + cap(sev.key) + '</span>' +
      '<span class="rp-cat">' + e(cat.label) + '</span></div></div>';
    h += '<h2 class="rp-area"' + dirAttr(a.area) + '>' +
      (a.area ? e(a.area) : '<span class="rp-untitled">Untitled area</span>') + '</h2>';
    const vital = [a.date, a.assessor ? 'assessed by ' + a.assessor : '', ev ? (ev.type || 'event') + (ev.date ? ', ' + ev.date : '') : '']
      .filter(s => s && s.trim()).join('  ·  ');
    if (vital) h += '<div class="rp-vital">' + e(vital) + '</div>';

    /* the figure */
    h += '<div class="rp-sect"><h3>Before and after</h3>' +
      AM.Figure.figureHTML(a, { n: opts.n, caption: opts.caption, overlay: opts.overlay }) + '</div>';

    /* the findings */
    h += '<div class="rp-sect"><h3>Condition and damage</h3>';
    if (a.summary && a.summary.trim()) {
      h += '<div class="rp-prose"' + dirAttr(a.summary) + '>' +
        a.summary.trim().split(/\n\s*\n|\n/).map(x => '<p>' + e(x) + '</p>').join('') + '</div>';
    } else h += '<div class="rp-none">No condition summary recorded.</div>';
    h += '</div>';

    if (a.recommendation && a.recommendation.trim()) {
      h += '<div class="rp-sect"><h3>Recommendation</h3>' +
        '<div class="rp-prose recommend"' + dirAttr(a.recommendation) + '>' +
        a.recommendation.trim().split(/\n\s*\n|\n/).map(x => '<p>' + e(x) + '</p>').join('') + '</div></div>';
    }

    /* the sources of the figure */
    h += '<div class="rp-sect"><h3>Source photographs</h3><table class="src-table">' +
      srcRow('Before', a.before, opts) + srcRow('After', a.after, opts) + '</table></div>';

    h += '</div></div>';
    return h;
  }

  /* =====================================================================
     Small desk builders (the working forms).
     ===================================================================== */
  function field(a, label, get, set, opts) {
    opts = opts || {};
    const input = opts.textarea
      ? U.h('textarea', { rows: opts.rows || '5', placeholder: opts.ph || '', dir: 'auto' })
      : U.h('input', { type: opts.type || 'text', value: get() == null ? '' : get(), placeholder: opts.ph || '', dir: 'auto' });
    if (opts.textarea) input.value = get() || '';
    input.addEventListener('input', () => { set(input.value); AM.App.changed(a); });
    const f = U.h('div', { class: 'field' }, U.h('label', null, label), input);
    if (opts.note) f.append(U.h('div', { class: 'note' }, opts.note));
    return f;
  }
  function pfield(label, get, set, opts) {
    opts = opts || {};
    const input = opts.textarea
      ? U.h('textarea', { rows: opts.rows || '4', placeholder: opts.ph || '', dir: 'auto' })
      : U.h('input', { type: opts.type || 'text', value: get() == null ? '' : get(), placeholder: opts.ph || '', dir: 'auto' });
    if (opts.textarea) input.value = get() || '';
    input.addEventListener('input', () => { set(input.value); AM.App.projectChanged(); });
    const f = U.h('div', { class: 'field' }, U.h('label', null, label), input);
    if (opts.note) f.append(U.h('div', { class: 'note' }, opts.note));
    return f;
  }
  function sect(title, small, ...kids) {
    const h4 = U.h('h4', null, title);
    if (small) h4.append(U.h('small', null, small));
    return U.h('div', { class: 'desk-sect' }, h4, ...kids);
  }

  /* =====================================================================
     Attaching a photograph: hash the original, embed a downsized copy.
     ===================================================================== */
  function attachPhoto(a, role, file) {
    if (!file) { AM.App.pickFile(f => doAttach(a, role, f)); return; }
    doAttach(a, role, file);
  }
  async function doAttach(a, role, file) {
    if (!file || !/^image\//.test(file.type)) return U.toast('Choose an image file.');
    const ph = a[role];
    const hadImage = !!ph.dataUrl;
    U.toast('Hashing ' + file.name + '…');
    try { await AM.Hash.attach(ph, file); }
    catch (e) { return U.toast('Could not read that image.'); }
    ph.consent = ph.consent || 'public';
    /* points placed on the previous image no longer mean anything */
    if (hadImage && (a.align.beforePts.length || a.align.afterPts.length)) {
      a.align = { beforePts: [], afterPts: [], H: null, rms: null };
      U.toast(cap(role) + ' photograph replaced; the alignment was cleared');
    } else {
      U.toast(cap(role) + ' photograph attached');
    }
    a.align._overlayUrl = null;
    AM.Model.touch(a);
    AM.Store.save();
    rerenderAssessment();
  }

  /* =====================================================================
     S-01 · the site sheet.
     ===================================================================== */
  function eventsSect() {
    const box = U.h('div');
    const redraw = () => {
      box.innerHTML = '';
      if (!(S.project.events || []).length) {
        box.append(U.h('div', { class: 'hint', style: { fontStyle: 'italic', padding: '4px 0 12px' } },
          'No events recorded yet. Add the shelling, fire, earthquake, or other cause that harmed the site.'));
      }
      (S.project.events || []).forEach(ev => {
        const dateI = U.h('input', { type: 'text', value: ev.date || '', placeholder: 'e.g. 14 March 2024', style: { width: '100%' } });
        dateI.addEventListener('input', () => { ev.date = dateI.value; AM.App.projectChanged(); });
        const typeSel = U.h('select', { style: { width: '100%' } },
          ...V.EVENTTYPE.map(t => U.h('option', { value: t, selected: ev.type === t ? '' : null }, t)));
        typeSel.addEventListener('change', () => { ev.type = typeSel.value; AM.App.projectChanged(); });
        const srcI = U.h('input', { type: 'text', value: ev.source || '', placeholder: 'source: a report, a witness, a bulletin', dir: 'auto', style: { width: '100%' } });
        srcI.addEventListener('input', () => { ev.source = srcI.value; AM.App.projectChanged(); });
        const noteI = U.h('input', { type: 'text', value: ev.note || '', placeholder: 'what happened', dir: 'auto', style: { width: '100%' } });
        noteI.addEventListener('input', () => { ev.note = noteI.value; AM.App.projectChanged(); });
        const body = U.h('div', { class: 'evbody' },
          U.h('div', { class: 'row2' },
            U.h('div', { class: 'field', style: { marginBottom: '12px' } }, U.h('label', null, 'Date'), dateI),
            U.h('div', { class: 'field', style: { marginBottom: '12px' } }, U.h('label', null, 'Type'), typeSel)),
          U.h('div', { class: 'field', style: { marginBottom: '12px' } }, U.h('label', null, 'Source'), srcI),
          U.h('div', { class: 'field', style: { marginBottom: '0' } }, U.h('label', null, 'Note'), noteI));
        box.append(U.h('div', { class: 'event-row' },
          U.h('div', { class: 'evno' }, ev.id),
          body,
          U.h('div', { class: 'evdel' }, U.h('button', {
            class: 'act', onclick: () => {
              const cleared = AM.Model.removeEvent(ev.id);
              AM.Store.save(); redraw();
              U.toast('Event removed' + (cleared ? '; unlinked from ' + cleared + (cleared === 1 ? ' assessment' : ' assessments') : ''));
            },
          }, 'Remove'))));
      });
    };
    redraw();
    return sect('Events', 'the harm done to the site; assessments are assigned to these',
      box,
      U.h('div', { class: 'add-line' }, U.h('button', {
        class: 'act', onclick: () => { AM.Model.addEvent(); AM.App.projectChanged(); redraw(); },
      }, '+ Add an event')));
  }

  function renderSite() {
    AM.Figure.teardown();
    curSheet = { no: 'S-01', name: 'Site' };
    const sect_ = document.getElementById('view-site');
    sect_.innerHTML = '';
    const sheet = U.h('div', { class: 'sheet narrow' });
    const tb = U.h('div'); tb.innerHTML = titleBlockHTML('S-01', 'Site');
    sheet.append(tb.firstElementChild);

    const desk = U.h('div', { class: 'desk' });
    desk.append(U.h('div', { class: 'desk-head' },
      U.h('h3', null, 'The site and its dossier'),
      U.h('span', { class: 'hint' }, 'the cover of the dossier; the title block above fills in as you type')));

    const s = S.project.site;
    desk.append(sect('The site', 'what it is, and where',
      pfield('Name', () => s.name, v => { s.name = v; }, { ph: 'the building, site, or collection' }),
      U.h('div', { class: 'row2' },
        pfield('Place', () => s.place, v => { s.place = v; }, { ph: 'town, region, country' }),
        pfield('Designation', () => s.designation, v => { s.designation = v; }, { ph: 'e.g. UNESCO World Heritage, national monument' })),
      pfield('Identifier', () => s.identifier, v => { s.identifier = v; }, { ph: 'a reference number, where one exists' }),
      pfield('Description', () => s.description, v => { s.description = v; }, { textarea: true, rows: '4', ph: 'what the site is, and why it matters' })));

    const safeBox = U.h('input', { type: 'checkbox' });
    safeBox.checked = !!s.safe;
    safeBox.addEventListener('change', () => { s.safe = safeBox.checked; AM.App.projectChanged(); });
    desk.append(sect('Location', 'coordinates are withheld from exports unless marked safe to publish',
      U.h('div', { class: 'row2' },
        pfield('Latitude', () => s.lat == null ? '' : s.lat, v => { const n = parseFloat(v); s.lat = isFinite(n) ? n : null; }, { ph: 'e.g. 33.51' }),
        pfield('Longitude', () => s.lon == null ? '' : s.lon, v => { const n = parseFloat(v); s.lon = isFinite(n) ? n : null; }, { ph: 'e.g. 36.29' })),
      U.h('div', { class: 'field' },
        U.h('label', { class: 'inline', style: { fontFamily: 'var(--serif)', textTransform: 'none', letterSpacing: '0' } },
          safeBox, 'Safe to publish these coordinates'),
        U.h('div', { class: 'note' },
          'Off by default. Coordinates can guide looters and targeting; until you tick this, the location stays out of the public data and the dossier.'))));

    const d = S.project.dossier;
    desk.append(sect('The dossier', 'who compiled it, and on whose authority',
      U.h('div', { class: 'row2' },
        pfield('Reference', () => d.reference, v => { d.reference = v; }, { ph: 'your file or case number' }),
        pfield('Assessor', () => d.assessor, v => { d.assessor = v; }, { ph: 'who carried out the assessment' })),
      U.h('div', { class: 'row2' },
        pfield('Organization', () => d.organization, v => { d.organization = v; }, { ph: 'institution or mission' }),
        pfield('Contact', () => d.contact, v => { d.contact = v; }, { ph: 'email or address, if any' })),
      pfield('Note', () => d.note, v => { d.note = v; }, { textarea: true, rows: '3', ph: 'method, scope, the conditions of the survey' })));

    desk.append(eventsSect());
    sheet.append(desk);
    sect_.append(sheet);
  }

  /* =====================================================================
     S-02 · the schedule of assessments.
     ===================================================================== */
  function renderSchedule() {
    AM.Figure.teardown();
    curSheet = { no: 'S-02', name: 'Schedule' };
    const sect_ = document.getElementById('view-schedule');
    sect_.innerHTML = '';
    const sheet = U.h('div', { class: 'sheet' });
    const tb = U.h('div'); tb.innerHTML = titleBlockHTML('S-02', 'Schedule');
    sheet.append(tb.firstElementChild);

    const list = S.project.assessments;
    sheet.append(U.h('h2', { class: 'head' }, 'Schedule of assessments'));
    sheet.append(U.h('p', { class: 'subhead' }, 'every dated condition report on a part of the site'));
    sheet.append(U.h('div', { class: 'countline' },
      list.length + (list.length === 1 ? ' assessment' : ' assessments')));

    if (!list.length) {
      sheet.append(U.h('div', { class: 'register-empty' },
        U.h('div', null, 'No assessments yet.'),
        U.h('div', { class: 'actions' },
          U.h('button', { class: 'btn', onclick: () => AM.App.newAssessment() }, 'New assessment'))));
    } else {
      const host = U.h('div');
      host.innerHTML = scheduleTableHTML(list, {});
      host.querySelectorAll('tr.entry').forEach(tr => {
        tr.addEventListener('click', () => { location.hash = '#/assessment/' + tr.dataset.id; });
      });
      sheet.append(host);
      sheet.append(U.h('div', { class: 'add-line', style: { marginTop: '18px' } },
        U.h('button', { class: 'btn', onclick: () => AM.App.newAssessment() }, 'New assessment')));
    }
    sect_.append(sheet);
  }

  /* =====================================================================
     S-03 · the assessment sheet: the report over the desk.
     ===================================================================== */
  function photoSlot(a, role) {
    const ph = a[role];
    const box = U.h('div', { class: 'item', style: { padding: '16px 0', borderBottom: '1px solid var(--line)' } });
    const redraw = () => {
      box.innerHTML = '';
      box.append(U.h('div', { class: 'item-head', style: { display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '10px' } },
        U.h('span', { class: 'n', style: { fontFamily: 'var(--mono)', fontSize: '12.5px', color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.1em' } },
          role === 'before' ? 'Before' : 'After')));
      const row = U.h('div', { style: { display: 'flex', gap: '14px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '12px' } });
      row.append(U.h('button', { class: 'btn', onclick: () => attachPhoto(a, role) }, ph.dataUrl ? 'Replace image' : 'Attach image'));
      if (ph.dataUrl || ph.name) {
        row.append(U.h('span', { style: { fontFamily: 'var(--mono)', fontSize: '12.5px', color: 'var(--ink-2)', wordBreak: 'break-all' } },
          (ph.name || '(unnamed)') + (ph.sha256 ? '  ·  sha-256 ' + ph.sha256.slice(0, 12) + '…' : '')));
        row.append(U.h('button', {
          class: 'act', onclick: () => {
            a[role] = AM.blankPhoto();
            a.align = { beforePts: [], afterPts: [], H: null, rms: null }; a.align._overlayUrl = null;
            AM.Model.touch(a); AM.Store.save(); rerenderAssessment();
          },
        }, 'Detach'));
      }
      box.append(row);
      box.append(U.h('div', { class: 'row2' },
        field(a, 'Date taken', () => ph.date, v => { ph.date = v; }, { ph: 'when the photograph was made' }),
        U.h('div', { class: 'field' }, U.h('label', null, 'Consent'),
          (() => {
            const sel = U.h('select', null, ...V.CONSENT.map(c =>
              U.h('option', { value: c.key, selected: ph.consent === c.key ? '' : null }, c.label + ': ' + c.gloss)));
            sel.addEventListener('change', () => { ph.consent = sel.value; AM.App.changed(a, true); });
            return sel;
          })())));
      box.append(field(a, 'Provenance', () => ph.provenance, v => { ph.provenance = v; },
        { ph: 'who made it, when, and how it came to you', note: 'The rescue-archiving record: who, when, whence. Kept with the image and printed in the sources appendix.' }));
    };
    redraw();
    return box;
  }

  function buildDesk(a) {
    const desk = U.h('div', { class: 'desk' });
    desk.append(U.h('div', { class: 'desk-head' },
      U.h('h3', null, 'The assessor’s desk'),
      U.h('span', { class: 'hint' }, 'everything here appears in the report above, as you type')));

    /* the figure */
    desk.append(sect('The figure', 'attach a before and an after photograph, then register them',
      AM.Figure.editor(a),
      U.h('div', { class: 'note', style: { marginTop: '14px' } },
        'The pair tells the story on its own. Registering the two (four or more matched points) lets the compare modes lay the change bare, and prints a registered overlay into the dossier.')));

    /* identification */
    desk.append(sect('The element assessed', null,
      field(a, 'Area or element', () => a.area, v => { a.area = v; }, { ph: 'e.g. North aisle, apse mosaic, manuscript MS-14' }),
      U.h('div', { class: 'row2' },
        field(a, 'Date of assessment', () => a.date, v => { a.date = v; }, { ph: 'e.g. 2024-03-18' }),
        field(a, 'Assessor', () => a.assessor, v => { a.assessor = v; }, { ph: 'who assessed it' }))));

    /* classification */
    const catSel = U.h('select', null, ...V.DAMAGE.map(d =>
      U.h('option', { value: d.key, selected: a.category === d.key ? '' : null }, d.label)));
    catSel.addEventListener('change', () => { a.category = catSel.value; AM.App.changed(a, true); });

    const sevPick = U.h('div', { class: 'marks-pick' });
    V.SEVERITY.forEach(sv => {
      const b = U.h('button', { class: 'mark ' + sv.cls + (a.severity === sv.key ? ' on' : ''), title: sv.label }, cap(sv.key));
      b.addEventListener('click', () => {
        a.severity = sv.key;
        sevPick.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        AM.App.changed(a, true);
      });
      sevPick.append(b);
    });

    const evSel = U.h('select', null,
      U.h('option', { value: '' }, 'no event'),
      ...(S.project.events || []).map(ev =>
        U.h('option', { value: ev.id, selected: a.eventId === ev.id ? '' : null },
          (ev.type || 'event') + (ev.date ? ' (' + ev.date + ')' : '') + (ev.id ? ' · ' + ev.id : ''))));
    evSel.addEventListener('change', () => { a.eventId = evSel.value || null; AM.App.changed(a); });

    desk.append(sect('Classification', 'the damage typology and its grade',
      U.h('div', { class: 'field' }, U.h('label', null, 'Damage type'), catSel),
      U.h('div', { class: 'field' }, U.h('label', null, 'Severity'), sevPick),
      U.h('div', { class: 'field' }, U.h('label', null, 'Caused by'), evSel,
        U.h('div', { class: 'note' }, (S.project.events || []).length
          ? 'Which event harmed this element. Events are kept on the Site sheet (S-01).'
          : 'No events yet. Record the cause on the Site sheet (S-01), then assign it here.'))));

    /* findings */
    desk.append(sect('Findings', 'in your own words',
      field(a, 'Condition and damage', () => a.summary, v => { a.summary = v; },
        { textarea: true, rows: '6', ph: 'What stood before, what the harm did, what survives. Describe the condition plainly enough for a reader who was not there.' }),
      field(a, 'Recommendation', () => a.recommendation, v => { a.recommendation = v; },
        { textarea: true, rows: '4', ph: 'What should be done: emergency stabilization, salvage, documentation, monitoring.' })));

    /* photographs and their provenance */
    desk.append(sect('Photographs', 'the source of the figure; each carries its provenance and consent',
      photoSlot(a, 'before'), photoSlot(a, 'after')));

    /* removal */
    desk.append(sect('Remove', null,
      U.h('button', {
        class: 'btn danger', onclick: () => {
          if (!confirm('Remove assessment ' + a.id + ' from the dossier? This cannot be undone.')) return;
          AM.Model.remove(a.id); AM.Store.save();
          U.toast('Assessment ' + a.id + ' removed');
          location.hash = '#/schedule';
        },
      }, 'Remove this assessment'),
      U.h('div', { class: 'note', style: { marginTop: '10px' } },
        'Removes the assessment and its photographs from the dossier file.')));

    return desk;
  }

  function renderAssessment(id) {
    curSheet = { no: 'S-03', name: 'Assessment' };
    AM.Figure.teardown();
    const sect_ = document.getElementById('view-assessment');
    sect_.innerHTML = '';
    const a = AM.Model.get(id);
    current = a;
    const sheet = U.h('div', { class: 'sheet' });
    const tb = U.h('div'); tb.innerHTML = titleBlockHTML('S-03', 'Assessment' + (a ? ' ' + a.id : ''));
    sheet.append(tb.firstElementChild);

    if (!a) {
      sheet.append(
        U.h('h2', { class: 'head' }, 'No assessment is open'),
        U.h('p', { class: 'subhead' }, 'Choose one from the schedule, or begin a new assessment.'),
        U.h('div', { style: { display: 'flex', gap: '12px' } },
          U.h('button', { class: 'btn', onclick: () => { location.hash = '#/schedule'; } }, 'To the schedule'),
          U.h('button', { class: 'btn', onclick: () => AM.App.newAssessment() }, 'New assessment')));
      sect_.append(sheet);
      return;
    }

    /* ledger navigation across the schedule order */
    const order = S.project.assessments;
    const idx = order.findIndex(x => x.id === a.id);
    sheet.append(U.h('div', { style: { display: 'flex', gap: '20px', alignItems: 'baseline', margin: '30px 0 0' } },
      U.h('button', { class: 'act', onclick: () => { location.hash = '#/schedule'; } }, '‹ Schedule'),
      U.h('span', { style: { flex: '1' } }),
      idx > 0 ? U.h('button', { class: 'act', onclick: () => { location.hash = '#/assessment/' + order[idx - 1].id; } }, '‹ Previous') : null,
      idx >= 0 && idx < order.length - 1 ? U.h('button', { class: 'act', onclick: () => { location.hash = '#/assessment/' + order[idx + 1].id; } }, 'Next ›') : null));

    const reportHost = U.h('div', { class: 'report-wrap', id: 'report-host' });
    reportHost.innerHTML = reportHTML(a, {});
    sheet.append(reportHost);
    sheet.append(buildDesk(a));
    sect_.append(sheet);
  }

  let reportTimer = null;
  function refreshReport(a, soon) {
    clearTimeout(reportTimer);
    reportTimer = setTimeout(() => {
      const host = document.getElementById('report-host');
      if (host && current === a) host.innerHTML = reportHTML(a, {});
    }, soon ? 0 : 220);
  }
  function refreshTitleBlock() {
    const active = document.querySelector('section.view:not(.hidden)');
    const host = active && active.querySelector('.titleblock');
    if (!host) return;
    const tmp = U.h('div'); tmp.innerHTML = titleBlockHTML(curSheet.no, curSheet.name);
    host.replaceWith(tmp.firstElementChild);
  }
  function rerenderAssessment() {
    if (current) renderAssessment(current.id);
  }

  return {
    titleBlockHTML, scheduleTableHTML, reportHTML,
    renderSite, renderSchedule, renderAssessment,
    attachPhoto, refreshReport, refreshTitleBlock, rerenderAssessment,
    current: () => current,
  };
})();
