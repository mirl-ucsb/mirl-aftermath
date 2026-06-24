/* exporters.js: the ways a dossier leaves the room. Every export but the
   working save is built from the public clone, so restricted photographs are
   withheld (their data and even their hash), and the site's coordinates are
   withheld unless marked safe to publish. The print dossier and the
   self-contained HTML dossier are the court- and UNESCO-ready artifacts; the
   working save keeps everything for the assessor's own file. */

window.AM = window.AM || {};

AM.Exporters = (function () {
  const S = AM.state;
  const U = AM.util;
  const V = AM.vocab;
  const e = U.esc;

  function baseName() {
    return U.slug(S.project.site.name || S.project.dossier.reference || 'dossier');
  }
  function captionFor(a, events) {
    const sev = V.severityOf(a.severity), cat = V.damageOf(a.category);
    const ev = a.eventId && (events || []).find(x => x.id === a.eventId);
    return [a.area || 'Untitled area', cat.label + ', ' + sev.label.toLowerCase(),
      a.date || '', a.assessor ? 'assessed by ' + a.assessor : '', ev ? ev.type : '']
      .filter(s => s && s.trim()).join('. ') + '.';
  }
  function todayLong() {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ---------- the working file (everything) ---------- */
  function saveProject() {
    const name = baseName() + '.aftermath.json';
    U.downloadText(name, JSON.stringify(AM.Model.serialize(false), null, 2), 'application/json');
    U.toast('Dossier saved: ' + name);
  }

  /* ---------- public data (consent applied) ---------- */
  function publicJSON() {
    const name = baseName() + '-public.json';
    U.downloadText(name, JSON.stringify(AM.Model.serialize(true), null, 2), 'application/json');
    U.toast('Public data saved: ' + name);
  }

  /* ---------- shared pieces of the dossier (consent already applied) ---------- */
  function coverHTML(p, list) {
    const s = p.site, d = p.dossier;
    const hasCoords = typeof s.lat === 'number' && typeof s.lon === 'number';
    let h = '<div class="book-cover"><div class="inner">';
    h += '<div class="kind">Condition dossier</div>';
    h += '<h1' + (U.isRTL(s.name) ? ' dir="rtl"' : '') + '>' + (s.name ? e(s.name) : 'Untitled site') + '</h1>';
    if (s.designation) h += '<div class="sub">' + e(s.designation) + '</div>';
    h += '<hr>';
    h += '<dl>';
    const row = (k, v) => v ? '<dt>' + k + '</dt><dd>' + v + '</dd>' : '';
    h += row('Place', e(s.place));
    if (hasCoords) h += row('Coordinates', '<span style="font-family:var(--mono);font-size:14px">' + e(fmtCoord(s.lat, s.lon)) + '</span>');
    h += row('Identifier', e(s.identifier));
    h += row('Reference', e(d.reference));
    h += row('Assessor', e(d.assessor));
    h += row('Organization', e(d.organization));
    h += row('Contact', e(d.contact));
    h += '</dl>';
    if ((p.events || []).length) {
      h += '<dl style="margin-top:18px"><dt>Events</dt><dd>' +
        p.events.map(ev => e([ev.type, ev.date].filter(Boolean).join(', '))).join('<br>') + '</dd></dl>';
    }
    h += '<div class="foot"><div>' + list.length + (list.length === 1 ? ' assessment' : ' assessments') +
      ' · ' + e(todayLong()) + '</div>' +
      '<div>Made with MIRL Aftermath · Material / Image Research Lab, UC Santa Barbara</div></div>';
    h += '</div></div>';
    return h;
  }
  function fmtCoord(lat, lon) {
    return Math.abs(lat).toFixed(4) + (lat >= 0 ? ' N' : ' S') + ', ' +
      Math.abs(lon).toFixed(4) + (lon >= 0 ? ' E' : ' W');
  }

  function siteSummaryHTML(p, list) {
    const s = p.site;
    let h = '<h2 class="appendix">The site</h2>';
    if (s.description && s.description.trim()) {
      h += '<div class="rp-prose"' + (U.isRTL(s.description) ? ' dir="rtl"' : '') + ' style="font-size:16px;max-width:680px">' +
        s.description.trim().split(/\n\s*\n|\n/).map(x => '<p>' + e(x) + '</p>').join('') + '</div>';
    }
    /* the events that harmed the site, in full */
    if ((p.events || []).length) {
      h += '<h3 style="font-family:var(--mono);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;margin:26px 0 10px;color:var(--ink)">Events</h3>';
      h += '<table class="register"><tr><th>Event</th><th>Type</th><th>Date</th><th>Note</th></tr>';
      p.events.forEach(ev => {
        h += '<tr><td class="no">' + e(ev.id) + '</td><td>' + e(ev.type || '') + '</td>' +
          '<td class="mono">' + (ev.date ? e(ev.date) : '-') + '</td><td>' +
          (ev.note ? e(ev.note) : '') + (ev.source ? '<div style="font-style:italic;color:var(--ink-3);font-size:14px;margin-top:3px">' + e(ev.source) + '</div>' : '') +
          '</td></tr>';
      });
      h += '</table>';
    }
    /* the reckoning: a tally by severity */
    h += '<h3 style="font-family:var(--mono);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;margin:26px 0 10px;color:var(--ink)">By severity</h3>';
    h += '<table class="register"><tr><th>Grade</th><th>Assessments</th></tr>';
    V.SEVERITY.forEach(sv => {
      const n = list.filter(a => a.severity === sv.key).length;
      h += '<tr><td><span class="mark ' + sv.cls + '">' + (sv.key[0].toUpperCase() + sv.key.slice(1)) + '</span></td>' +
        '<td class="mono">' + n + '</td></tr>';
    });
    h += '</table>';
    return h;
  }

  function appendixHTML(p, list) {
    let h = '<h2 class="appendix">Sources appendix</h2>';
    h += '<p class="hint" style="margin:0 0 16px">Every source photograph in this dossier, with the date it was made, its provenance, and the sha-256 fingerprint of the original file.</p>';
    h += '<table class="src-table" style="width:100%">';
    let withheld = 0;
    list.forEach(a => {
      ['before', 'after'].forEach(role => {
        const ph = a[role];
        if (!ph || (!ph.name && !ph.sha256 && !ph.withheld)) return;
        if (ph.withheld) withheld++;
        let meta = [];
        if (ph.withheld) meta = ['withheld under restriction'];
        else {
          if (ph.date) meta.push(e(ph.date));
          if (ph.provenance) meta.push(e(ph.provenance));
          if (ph.sha256) meta.push('sha-256 ' + e(ph.sha256));
        }
        h += '<tr><td class="role">' + e(a.id) + ' · ' + role + '</td><td>' +
          '<div class="src-name"' + (U.isRTL(ph.name) ? ' dir="rtl"' : '') + '>' + (ph.name ? e(ph.name) : '(unnamed file)') + '</div>' +
          (meta.length ? '<div class="src-meta">' + meta.join(' · ') + '</div>' : '') +
          '</td><td class="cnt"><span class="consent ' + e(ph.consent || 'public') + '">' + e(ph.consent || 'public') + '</span></td></tr>';
      });
    });
    h += '</table>';
    if (withheld) {
      h += '<p class="hint" style="margin-top:16px">' + withheld +
        (withheld === 1 ? ' photograph is' : ' photographs are') +
        ' held under restriction and withheld from this dossier, by the consent recorded against them.</p>';
    }
    return h;
  }

  /* ---------- the printed dossier ---------- */
  async function printDossier() {
    const pub = AM.Model.publicClone();
    const p = pub.project;
    const list = p.assessments;
    if (!list.length) return U.toast('No assessments to compose into a dossier yet.');
    U.toast('Composing the dossier…');
    await AM.Figure.prepareAll(list);

    let html = '<div class="book-page">' + coverHTML(p, list) + '</div>';
    html += '<div class="book-page">' + siteSummaryHTML(p, list) + '</div>';
    list.forEach((a, i) => {
      html += '<div class="book-page"><div class="report-wrap">' +
        AM.Sheets.reportHTML(a, { n: i + 1, caption: captionFor(a, p.events), overlay: a.align && a.align._overlayUrl, publicMode: true, events: p.events }) +
        '</div></div>';
    });
    html += '<div class="book-page">' + appendixHTML(p, list) + '</div>';

    let book = document.getElementById('book');
    if (!book) { book = document.createElement('div'); book.id = 'book'; document.body.append(book); }
    book.innerHTML = html;
    document.body.classList.add('book-mode');
    const cleanup = () => {
      document.body.classList.remove('book-mode');
      book.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    U.toast('Composing the dossier… choose Save as PDF in the print dialog');
    setTimeout(() => window.print(), 200);
  }

  /* ---------- a self-contained HTML dossier (fonts inlined) ---------- */
  async function inlineCSS() {
    let css = '';
    try { css = await (await fetch('css/style.css')).text(); } catch (err) { return ''; }
    const names = [];
    css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (m, n) => { names.push(n); return m; });
    try {
      const datas = {};
      for (const n of names) {
        const buf = await (await fetch('fonts/' + n)).arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        datas[n] = 'data:font/woff2;base64,' + btoa(bin);
      }
      css = css.replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (m, n) => 'url("' + datas[n] + '")');
    } catch (err) {
      css = css.replace(/@font-face\s*\{[^}]*\}/g, '');
    }
    return css;
  }

  async function htmlDossier() {
    const pub = AM.Model.publicClone();
    const p = pub.project;
    const list = p.assessments;
    if (!list.length) return U.toast('No assessments to compose into a dossier yet.');
    U.toast('Composing the HTML dossier…');
    await AM.Figure.prepareAll(list);
    const css = await inlineCSS();

    let body = '<header class="app"><div class="plate"><h1>' + (p.site.name ? e(p.site.name) : 'Untitled site') + '</h1>' +
      '<span class="tag">condition dossier' + (p.site.designation ? ' · ' + e(p.site.designation) : '') + '</span></div></header>';
    body += '<main><div class="sheet">';
    body += '<div style="margin-top:30px">' + AM.Sheets.titleBlockHTML('-', 'Dossier') + '</div>';
    body += '<div class="frontmatter"><div class="fm-line">Compiled ' + e(todayLong()) +
      ' · restricted photographs and unsafe coordinates are withheld from this document</div></div>';
    body += '<h2 class="head">Schedule of assessments</h2>';
    body += AM.Sheets.scheduleTableHTML(list, { static: true });
    body += siteSummaryHTML(p, list).replace('<h2 class="appendix">The site</h2>', '<h2 class="head" style="margin-top:40px">The site</h2>');
    list.forEach((a, i) => {
      body += '<div class="report-wrap" style="margin-top:34px">' +
        AM.Sheets.reportHTML(a, { n: i + 1, caption: captionFor(a, p.events), overlay: a.align && a.align._overlayUrl, publicMode: true, events: p.events }) +
        '</div>';
    });
    body += '<div style="margin-top:40px">' + appendixHTML(p, list) + '</div>';
    body += '</div></main>';
    body += '<footer style="padding:50px 44px 60px;text-align:center"><div class="fm-line" style="margin:0">' +
      'Compiled ' + e(todayLong()) + ' with MIRL Aftermath · Material / Image Research Lab, UC Santa Barbara</div></footer>';

    const html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + (p.site.name ? e(p.site.name) : 'Condition dossier') + ' · condition dossier</title>\n' +
      '<style>\n' + css + '\n</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';

    U.downloadText(baseName() + '-dossier.html', html, 'text/html;charset=utf-8');
    U.toast('HTML dossier saved');
  }

  /* ---------- print just the sheet you are on, consent applied ---------- */
  async function printView() {
    const route = (AM.state && AM.state.route) || {};
    const pub = AM.Model.publicClone();
    const p = pub.project;
    let html = '';
    if (route.view === 'assessment' && route.id) {
      const a = p.assessments.find(x => x.id === route.id);
      if (a) {
        await AM.Figure.prepareAll([a]);
        html = '<div class="book-page"><div class="report-wrap">' +
          AM.Sheets.reportHTML(a, { caption: captionFor(a, p.events), overlay: a.align && a.align._overlayUrl, publicMode: true, events: p.events }) +
          '</div></div>';
      }
    }
    if (!html) {
      html = '<div class="book-page">' + siteSummaryHTML(p, p.assessments) + '</div>';
    }
    let book = document.getElementById('book');
    if (!book) { book = document.createElement('div'); book.id = 'book'; document.body.append(book); }
    book.innerHTML = html;
    document.body.classList.add('book-mode');
    const cleanup = () => {
      document.body.classList.remove('book-mode');
      book.innerHTML = '';
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 120);
  }

  return { saveProject, publicJSON, printDossier, htmlDossier, printView };
})();
