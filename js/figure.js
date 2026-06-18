/* figure.js: the before/after figure, the heart of an assessment. A pair of
   photographs, one before the harm and one after, optionally registered so the
   two sit at the same viewpoint and the change reads cleanly. Adapted from MIRL
   Rephoto's two-panel control-point interface and layered compare view, scoped
   here to one assessment's `align` record.

   Two faces:
   - AM.Figure.figureHTML(a, opts): a pure function returning the figure as it
     appears in the condition report and the printed dossier. The pair side by
     side, and (in the dossier) a registered overlay when an alignment was made.
   - AM.Figure.editor(a): the working figure on the desk, where control points
     are placed and the compare is scrubbed. Its edits update the report above. */

window.AM = window.AM || {};

AM.Figure = (function () {
  const U = AM.util;
  const H = AM.Homography;

  function fitRect(natW, natH, boxW, boxH) {
    const s = Math.min(boxW / natW, boxH / natH);
    return { s, w: natW * s, h: natH * s, ox: (boxW - natW * s) / 2, oy: (boxH - natH * s) / 2 };
  }
  function dirAttr(s) { return U.isRTL(s) ? ' dir="rtl"' : ''; }

  /* =====================================================================
     The static figure: a pure function over the assessment, reused by the
     report on screen and by the printed dossier.
     ===================================================================== */
  function cell(role, photo) {
    const labelText = role === 'before' ? 'Before' : 'After';
    let inner;
    if (photo && photo.withheld) {
      inner = '<div class="fig-empty withheld">' + labelText + ' image withheld under restriction</div>';
    } else if (photo && photo.dataUrl) {
      inner = '<img src="' + photo.dataUrl + '" alt="' + U.esc(labelText + ' photograph') + '">';
    } else {
      inner = '<div class="fig-empty">No ' + labelText.toLowerCase() + ' photograph</div>';
    }
    return '<div class="fig-cell ' + role + '"><span class="fig-side">' + labelText + '</span>' + inner + '</div>';
  }

  /* opts: { n, caption, overlay }: n and caption number the plate in the
     dossier; overlay (a precomputed data URL) shows the registered compare */
  function figureHTML(a, opts) {
    opts = opts || {};
    let h = '<div class="figure">';
    h += '<div class="fig-pair">' + cell('before', a.before) + cell('after', a.after) + '</div>';
    if (opts.overlay) {
      h += '<div class="fig-overlay"><img src="' + opts.overlay + '" alt="Registered before-and-after overlay"></div>';
    }
    if (opts.n != null || opts.caption) {
      h += '<div class="fig-cap">' +
        (opts.n != null ? '<span class="fig-n">Fig. ' + opts.n + '</span>' : '') +
        (opts.caption ? U.esc(opts.caption) : '') + '</div>';
    }
    h += '</div>';
    return h;
  }

  /* =====================================================================
     The registered overlay, drawn to a canvas so the dossier carries a single
     flat image: the after photograph with the before warped onto its frame,
     split down the middle (curtain) or faded over it (onion). Used only by the
     exporters; cached transiently on the assessment as align._overlayUrl.
     ===================================================================== */
  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      if (!dataUrl) return reject(new Error('no image'));
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = dataUrl;
    });
  }
  function texTri(ctx, img, s, d) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(d[0][0], d[0][1]); ctx.lineTo(d[1][0], d[1][1]); ctx.lineTo(d[2][0], d[2][1]); ctx.closePath(); ctx.clip();
    const M = [s[0][0], s[0][1], 1, s[1][0], s[1][1], 1, s[2][0], s[2][1], 1];
    const inv = H.mat3inv(M);
    const cx = k => inv[0] * d[0][k] + inv[1] * d[1][k] + inv[2] * d[2][k];
    const cy = k => inv[3] * d[0][k] + inv[4] * d[1][k] + inv[5] * d[2][k];
    const ce = k => inv[6] * d[0][k] + inv[7] * d[1][k] + inv[8] * d[2][k];
    ctx.setTransform(cx(0), cx(1), cy(0), cy(1), ce(0), ce(1));
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  function warp(ctx, img, Hm, sw, sh, grid) {
    grid = grid || 24;
    for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
      const x0 = sw * i / grid, x1 = sw * (i + 1) / grid, y0 = sh * j / grid, y1 = sh * (j + 1) / grid;
      const s00 = [x0, y0], s10 = [x1, y0], s01 = [x0, y1], s11 = [x1, y1];
      const d00 = H.apply(Hm, s00), d10 = H.apply(Hm, s10), d01 = H.apply(Hm, s01), d11 = H.apply(Hm, s11);
      texTri(ctx, img, [s00, s10, s01], [d00, d10, d01]);
      texTri(ctx, img, [s10, s11, s01], [d10, d11, d01]);
    }
  }

  async function prepareComposite(a) {
    const al = a.align || {};
    if (!al.H || !a.before || !a.after || !a.before.dataUrl || !a.after.dataUrl ||
        a.before.withheld || a.after.withheld) { if (al) al._overlayUrl = null; return null; }
    let before, after;
    try { [before, after] = await Promise.all([loadImage(a.before.dataUrl), loadImage(a.after.dataUrl)]); }
    catch (e) { al._overlayUrl = null; return null; }
    const Wd = after.naturalWidth || a.after.natW, Hd = after.naturalHeight || a.after.natH;
    const max = 1500, k = Math.min(1, max / Math.max(Wd, Hd));
    const cw = Math.max(1, Math.round(Wd * k)), ch = Math.max(1, Math.round(Hd * k));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d');
    /* the homography maps before-pixels onto the after's pixel frame; compose
       it with the canvas downscale so before-pixels land in canvas pixels */
    const Sk = [k, 0, 0, 0, k, 0, 0, 0, 1];
    const Hc = H.mat3mul(Sk, al.H);
    ctx.fillStyle = '#e8e6dd'; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(after, 0, 0, cw, ch);
    const mode = al.compare === 'onion' ? 'onion' : 'curtain';
    const split = typeof al.split === 'number' ? al.split : 0.5;
    if (mode === 'onion') {
      ctx.globalAlpha = typeof al.opacity === 'number' ? al.opacity : 0.5;
      warp(ctx, before, Hc, a.before.natW || before.naturalWidth, a.before.natH || before.naturalHeight);
      ctx.globalAlpha = 1;
    } else {
      ctx.save();
      ctx.beginPath(); ctx.rect(split * cw, 0, cw, ch); ctx.clip();
      warp(ctx, before, Hc, a.before.natW || before.naturalWidth, a.before.natH || before.naturalHeight);
      ctx.restore();
      ctx.strokeStyle = '#25231c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(split * cw) + 0.5, 0); ctx.lineTo(Math.round(split * cw) + 0.5, ch); ctx.stroke();
    }
    let url = null;
    try { url = cv.toDataURL('image/jpeg', 0.85); } catch (e) { url = null; }
    al._overlayUrl = url;
    return url;
  }

  async function prepareAll(list) {
    for (const a of list) { try { await prepareComposite(a); } catch (e) { /* leave null */ } }
  }

  /* =====================================================================
     The working figure on the desk: place control points, read the fit, scrub
     the compare. One editor exists at a time, for the open assessment.
     ===================================================================== */
  let ed = null;

  function computeH() {
    const al = ed.a.align;
    const n = Math.min(al.beforePts.length, al.afterPts.length);
    if (n >= 4) {
      const src = al.beforePts.slice(0, n), dst = al.afterPts.slice(0, n);
      al.H = H.compute(src, dst);
      al.rms = al.H ? H.residualRMS(al.H, src, dst) : null;
    } else { al.H = null; al.rms = null; }
  }

  function side(role) { return ed[role]; }
  function pts(role) { return ed.a.align[role + 'Pts']; }

  /* ----- align: the two panels ----- */
  function emptyBox(role) {
    return U.h('div', { class: 'empty' },
      U.h('div', { class: 'big' }, '⌖'),
      U.h('div', null, role === 'before' ? 'The photograph before the harm' : 'The photograph after the harm'),
      U.h('button', { class: 'btn', onclick: () => AM.Sheets.attachPhoto(ed.a, role) }, 'Load image'),
      U.h('div', { class: 'hint' }, 'or drop a file here'));
  }
  function panel(role) {
    const st = ed[role];
    const img = U.h('img', { id: 'fig-img-' + role, draggable: 'false' });
    const dots = U.h('div', { id: 'fig-dots-' + role, style: { position: 'absolute', inset: '0' } });
    const ph = ed.a[role];
    const head = U.h('div', { class: 'panel-head' },
      U.h('span', { class: 'swatch', style: { background: role === 'before' ? 'var(--blue)' : 'var(--red)' } }),
      U.h('span', { class: 'pname' }, (role === 'before' ? 'BEFORE' : 'AFTER') + (ph && ph.name ? '  ·  ' + ph.name : '')),
      U.h('span', { style: { flex: '1' } }),
      st.img ? U.h('button', { class: 'btn', onclick: () => AM.Sheets.attachPhoto(ed.a, role) }, 'Replace') : null);
    const p = U.h('div', { class: 'imgpanel', id: 'fig-panel-' + role }, head, img, dots);
    if (st.img) img.src = st.img.src; else p.append(emptyBox(role));
    p.addEventListener('click', e => onPanelClick(role, e, p));
    p.addEventListener('dragover', e => { e.preventDefault(); p.classList.add('drop'); });
    p.addEventListener('dragleave', () => p.classList.remove('drop'));
    p.addEventListener('drop', e => {
      e.preventDefault(); p.classList.remove('drop');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) AM.Sheets.attachPhoto(ed.a, role, f);
    });
    return p;
  }
  function buildAlign() {
    const stage = ed.stage;
    stageClear();
    stage.classList.remove('curtain-on');
    const pairs = U.h('div', { class: 'pairs', id: 'fig-pairs' }, panel('before'), panel('after'));
    stage.insertBefore(pairs, ed.curtain);
    refitAlign();
  }
  function refitAlign() {
    ['before', 'after'].forEach(role => {
      const st = ed[role]; const img = document.getElementById('fig-img-' + role); const p = document.getElementById('fig-panel-' + role);
      if (!st.img || !img || !p) return;
      const fit = fitRect(st.natW, st.natH, p.clientWidth, p.clientHeight);
      st._fit = fit;
      Object.assign(img.style, { left: fit.ox + 'px', top: fit.oy + 'px', width: fit.w + 'px', height: fit.h + 'px' });
    });
    renderAllDots(); updateCursor();
  }
  function dot(role, idx, x, y) {
    const fit = ed[role]._fit;
    const d = U.h('div', { class: 'dot ' + role, style: { left: (fit.ox + x * fit.s) + 'px', top: (fit.oy + y * fit.s) + 'px' } },
      U.h('span', null, String(idx + 1)));
    d.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); startDrag(role, idx, d); });
    return d;
  }
  function renderDots(role) {
    const box = document.getElementById('fig-dots-' + role); if (!box || !ed[role]._fit) return;
    box.innerHTML = '';
    pts(role).forEach((pt, i) => box.append(dot(role, i, pt[0], pt[1])));
  }
  function renderAllDots() { renderDots('before'); renderDots('after'); }

  function startDrag(role, idx, d) {
    const p = document.getElementById('fig-panel-' + role); let moved = false;
    function mv(e) {
      moved = true; const r = p.getBoundingClientRect(); const fit = ed[role]._fit;
      let x = (e.clientX - r.left - fit.ox) / fit.s, y = (e.clientY - r.top - fit.oy) / fit.s;
      x = Math.max(0, Math.min(ed[role].natW, x)); y = Math.max(0, Math.min(ed[role].natH, y));
      pts(role)[idx] = [x, y];
      d.style.left = (fit.ox + x * fit.s) + 'px'; d.style.top = (fit.oy + y * fit.s) + 'px';
      computeH(); updateQuality();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) commit(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  function onPanelClick(role, e, p) {
    if (ed.mode !== 'align' || !ed[role].img) return;
    if (e.target.closest('.dot')) return;
    if (role !== ed.nextSide) { U.toast('Place point ' + (Math.min(pts('before').length, pts('after').length) + 1) + ' on the ' + ed.nextSide.toUpperCase() + ' image next.'); return; }
    const fit = ed[role]._fit; const r = p.getBoundingClientRect();
    const x = (e.clientX - r.left - fit.ox) / fit.s, y = (e.clientY - r.top - fit.oy) / fit.s;
    if (x < 0 || y < 0 || x > ed[role].natW || y > ed[role].natH) return;
    pts(role).push([x, y]);
    ed.nextSide = role === 'before' ? 'after' : 'before';
    computeH(); renderDots(role); updateCursor(); renderControls(); commit();
  }
  function updateCursor() {
    ['before', 'after'].forEach(role => {
      const p = document.getElementById('fig-panel-' + role); if (!p) return;
      p.classList.toggle('click', ed.mode === 'align' && !!ed[role].img && ed.nextSide === role);
    });
  }
  function deletePair(i) {
    const bp = pts('before'), ap = pts('after');
    if (i < bp.length) bp.splice(i, 1);
    if (i < ap.length) ap.splice(i, 1);
    ed.nextSide = bp.length <= ap.length ? 'before' : 'after';
    computeH(); renderAllDots(); updateCursor(); renderControls(); updateModeButtons(); commit();
  }
  function clearPoints() {
    ed.a.align.beforePts = []; ed.a.align.afterPts = []; ed.nextSide = 'before';
    ed.a.align.H = null; ed.a.align.rms = null;
    if (ed.mode === 'compare') setMode('align');
    else { renderAllDots(); updateCursor(); renderControls(); updateModeButtons(); }
    commit();
  }

  /* ----- compare: warped before over after ----- */
  function buildCompare() {
    if (!ed.a.align.H) { setMode('align'); return; }
    const stage = ed.stage; stageClear();
    const mk = (role, extra) => {
      const layer = U.h('div', { class: 'layer', id: 'fig-layer-' + role });
      const sp = U.h('div', { class: 'afterspace', id: 'fig-as-' + role });
      const img = U.h('img', { src: ed[role].img.src, draggable: 'false', style: Object.assign({ width: ed[role].natW + 'px', height: ed[role].natH + 'px' }, extra || {}) });
      sp.append(img); layer.append(sp); return layer;
    };
    stage.insertBefore(mk('after'), ed.curtain);
    stage.insertBefore(mk('before', { transform: H.toMatrix3d(ed.a.align.H) }), ed.curtain);
    refitCompare(); applyPresent(); wireCurtain();
  }
  function refitCompare() {
    const stage = ed.stage; const after = ed.after;
    const fit = fitRect(after.natW, after.natH, stage.clientWidth, stage.clientHeight);
    ['fig-as-after', 'fig-as-before'].forEach(id => { const el = document.getElementById(id); if (el) el.style.transform = 'translate(' + fit.ox + 'px,' + fit.oy + 'px) scale(' + fit.s + ')'; });
  }
  function clearBlink() { if (ed.present._blink) { clearInterval(ed.present._blink); ed.present._blink = null; } }
  function applyPresent() {
    const layerBefore = document.getElementById('fig-layer-before'); if (!layerBefore) return;
    clearBlink();
    layerBefore.style.opacity = '1'; layerBefore.style.clipPath = 'none';
    ed.stage.classList.toggle('curtain-on', ed.mode === 'compare' && ed.present.mode === 'curtain');
    if (ed.present.mode === 'curtain') updateCurtainClip();
    else if (ed.present.mode === 'onion') layerBefore.style.opacity = String(ed.present.opacity);
    else if (ed.present.mode === 'blink') { let on = true; ed.present._blink = setInterval(() => { on = !on; layerBefore.style.opacity = on ? '1' : '0'; }, ed.present.blinkMs); }
  }
  function updateCurtainClip() {
    const layerBefore = document.getElementById('fig-layer-before'); if (!layerBefore) return;
    const split = ed.present.split;
    layerBefore.style.clipPath = 'inset(0 0 0 ' + (split * 100) + '%)';
    ed.curtain.style.left = (split * 100) + '%';
  }
  function wireCurtain() {
    const curtain = ed.curtain; const stage = ed.stage;
    if (ed._curtainWired) return; ed._curtainWired = true;
    let dragging = false;
    curtain.addEventListener('pointerdown', e => { dragging = true; e.preventDefault(); });
    window.addEventListener('pointermove', e => {
      if (!dragging) return; const r = stage.getBoundingClientRect();
      ed.present.split = Math.max(0.02, Math.min(0.98, (e.clientX - r.left) / r.width));
      ed.a.align.split = ed.present.split;
      if (ed.present.mode === 'curtain') updateCurtainClip(); e.preventDefault();
    });
    window.addEventListener('pointerup', () => { if (dragging) { dragging = false; commit(true); } });
  }
  function setPresent(mode) { ed.present.mode = mode; ed.a.align.compare = mode; applyPresent(); commit(true); }

  function stageClear() {
    Array.from(ed.stage.children).forEach(c => { if (c !== ed.curtain) c.remove(); });
  }

  /* ----- mode + controls ----- */
  function setMode(mode) {
    if (mode === 'compare' && !ed.a.align.H) { U.toast('Place at least four point pairs first.'); return; }
    ed.mode = mode;
    updateModeButtons();
    if (mode === 'align') buildAlign(); else buildCompare();
    renderControls();
  }
  function updateModeButtons() {
    if (!ed.root) return;
    ed.root.querySelectorAll('.fig-modes button').forEach(b => b.classList.toggle('on', b.dataset.figmode === ed.mode));
    const cmp = ed.root.querySelector('.fig-modes button[data-figmode="compare"]');
    if (cmp) cmp.disabled = !ed.a.align.H;
  }

  function qualityWord(rms) {
    if (rms == null) return ['', ''];
    if (rms < 2) return ['excellent fit', ''];
    if (rms < 6) return ['good fit', ''];
    if (rms < 14) return ['fair: check the points', 'warn'];
    return ['loose: check the points', 'warn'];
  }
  function controlsEl() { return ed.root.querySelector('.fig-controls'); }
  function renderControls() {
    const box = controlsEl(); if (!box) return;
    box.innerHTML = '';
    const al = ed.a.align;
    const n = Math.min(al.beforePts.length, al.afterPts.length);
    if (ed.mode === 'align') {
      const colA = U.h('div', { class: 'col' });
      if (al.rms != null) {
        const [word, cls] = qualityWord(al.rms);
        colA.append(U.h('div', { class: 'quality ' + cls },
          U.h('div', { class: 'big' }, al.rms.toFixed(1)),
          U.h('div', null, U.h('div', null, 'pixel fit error'), U.h('div', { class: 'hint' }, word))));
      } else {
        colA.append(U.h('div', { class: 'hint' },
          U.h('b', null, 'Place four or more point pairs.'),
          ' Click a feature on the BEFORE image, then the same feature on the AFTER. Corners of windows, doorframes, and string courses work well. ' + n + ' pair' + (n === 1 ? '' : 's') + ' so far.'));
      }
      colA.append(U.h('div', { class: 'add-line', style: { display: 'flex', gap: '14px' } },
        U.h('button', { class: 'btn', onclick: clearPoints }, 'Clear points')));
      const colB = U.h('div', { class: 'col' });
      if (al.beforePts.length || al.afterPts.length) {
        const rows = [];
        const max = Math.max(al.beforePts.length, al.afterPts.length);
        for (let i = 0; i < max; i++) {
          rows.push(U.h('tr', null,
            U.h('td', null, String(i + 1)),
            U.h('td', null, al.beforePts[i] ? fmt(al.beforePts[i]) : '-'),
            U.h('td', null, al.afterPts[i] ? fmt(al.afterPts[i]) : '-'),
            U.h('td', { class: 'del', title: 'Delete pair', onclick: () => deletePair(i) }, '×')));
        }
        colB.append(U.h('table', { class: 'pairtable' },
          U.h('tr', null, U.h('th', null, '#'), U.h('th', null, 'before'), U.h('th', null, 'after'), U.h('th', null, '')),
          ...rows));
      }
      box.append(colA, colB);
    } else {
      const colA = U.h('div', { class: 'col' });
      const seg = U.h('div', { class: 'seg' });
      [['curtain', 'Curtain'], ['onion', 'Onion skin'], ['blink', 'Blink']].forEach(([k, lab]) => {
        const b = U.h('button', { class: ed.present.mode === k ? 'on' : '', onclick: () => { setPresent(k); renderControls(); } }, lab);
        seg.append(b);
      });
      const row = U.h('div', { class: 'present-row' }, U.h('span', { class: 'label' }, 'Show'), seg);
      if (ed.present.mode === 'onion') {
        const sl = U.h('input', { type: 'range', min: '0', max: '100', value: String(Math.round(ed.present.opacity * 100)) });
        sl.addEventListener('input', () => { ed.present.opacity = sl.value / 100; ed.a.align.opacity = ed.present.opacity; applyPresent(); commit(); });
        row.append(U.h('label', { class: 'inline' }, 'Before', sl));
      } else if (ed.present.mode === 'blink') {
        const sl = U.h('input', { type: 'range', min: '300', max: '2000', step: '100', value: String(ed.present.blinkMs) });
        sl.addEventListener('input', () => { ed.present.blinkMs = +sl.value; ed.a.align.blinkMs = ed.present.blinkMs; applyPresent(); commit(); });
        row.append(U.h('label', { class: 'inline' }, 'Speed', sl));
      }
      colA.append(row, U.h('div', { class: 'hint', style: { marginTop: '10px' } },
        U.h('b', null, 'Curtain'), ' drags a divider across the registered pair. ',
        U.h('b', null, 'Onion skin'), ' fades the before over the after. ',
        U.h('b', null, 'Blink'), ' flips between them, which makes the change jump.'));
      const colB = U.h('div', { class: 'col' });
      if (al.rms != null) {
        const [word, cls] = qualityWord(al.rms);
        colB.append(U.h('div', { class: 'quality ' + cls },
          U.h('div', { class: 'big' }, al.rms.toFixed(1)),
          U.h('div', null, U.h('div', null, 'pixel fit error'), U.h('div', { class: 'hint' }, word + ' · ' + n + ' pairs'))));
      }
      colB.append(U.h('div', { class: 'add-line' }, U.h('button', { class: 'btn', onclick: () => setMode('align') }, 'Adjust points')));
      box.append(colA, colB);
    }
  }
  function updateQuality() {
    const box = controlsEl(); if (!box) return;
    const q = box.querySelector('.quality');
    const al = ed.a.align;
    if (q && al.rms != null) {
      const big = q.querySelector('.big'); if (big) big.textContent = al.rms.toFixed(1);
      const [word, cls] = qualityWord(al.rms);
      q.className = 'quality ' + cls;
      const hint = q.querySelector('.hint'); if (hint && ed.mode === 'align') hint.textContent = word;
    }
  }
  function fmt(p) { return Math.round(p[0]) + ', ' + Math.round(p[1]); }

  /* persist the change, refresh the report above, and keep the mode buttons
     in step (the Compare button enables the moment a fourth pair lands) */
  function commit() {
    AM.App.changed(ed.a);
    updateModeButtons();
  }

  function loadSide(role) {
    const ph = ed.a[role];
    ed[role] = { img: null, natW: 0, natH: 0, name: ph ? ph.name : '', _fit: null };
    if (ph && ph.dataUrl) {
      const img = new Image();
      img.onload = () => {
        ed[role].img = img; ed[role].natW = ph.natW || img.naturalWidth; ed[role].natH = ph.natH || img.naturalHeight;
        if (ed.mode === 'align') buildAlign(); updateModeButtons();
      };
      img.src = ph.dataUrl;
    }
  }

  function editor(a) {
    const al = a.align;
    ed = {
      a, mode: 'align', nextSide: (al.beforePts.length <= al.afterPts.length ? 'before' : 'after'),
      before: { img: null, natW: 0, natH: 0, name: '', _fit: null },
      after: { img: null, natW: 0, natH: 0, name: '', _fit: null },
      present: {
        mode: al.compare === 'onion' || al.compare === 'blink' ? al.compare : 'curtain',
        split: typeof al.split === 'number' ? al.split : 0.5,
        opacity: typeof al.opacity === 'number' ? al.opacity : 0.5,
        blinkMs: typeof al.blinkMs === 'number' ? al.blinkMs : 900,
        _blink: null,
      },
      _curtainWired: false,
    };
    /* recompute H from stored points, so an opened dossier is ready to compare */
    computeH();

    const modeSeg = U.h('div', { class: 'seg' },
      U.h('button', { 'data-figmode': 'align', class: 'on', onclick: () => setMode('align') }, U.h('span', null, 'Place points')),
      U.h('button', { 'data-figmode': 'compare', onclick: () => setMode('compare') }, U.h('span', null, 'Compare')));
    const modes = U.h('div', { class: 'fig-modes' }, U.h('span', { class: 'label' }, 'Figure'), modeSeg);
    const curtain = U.h('div', { class: 'rcurtain', style: { left: '50%' } });
    const stage = U.h('div', { class: 'fig-stage' }, curtain);
    const controls = U.h('div', { class: 'fig-controls' });
    const root = U.h('div', { class: 'figure-edit' }, modes, stage, controls);
    ed.root = root; ed.stage = stage; ed.curtain = curtain;

    loadSide('before'); loadSide('after');
    buildAlign(); renderControls(); updateModeButtons();
    return root;
  }

  function refit() {
    if (!ed) return;
    if (ed.mode === 'align') refitAlign(); else refitCompare();
  }
  function teardown() { if (ed) { clearBlink(); ed = null; } }

  return { figureHTML, prepareComposite, prepareAll, editor, refit, teardown };
})();
