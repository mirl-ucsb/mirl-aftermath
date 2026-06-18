/* app.js: interface wiring. The folio line, the menus, dossier open and save,
   the hash routes, and the small chores. Loaded last. */

window.AM = window.AM || {};

AM.App = (function () {
  const S = AM.state;
  const U = AM.util;
  let filePickCb = null;

  /* ---------- routing: #/site, #/schedule, #/assessment/<id> ---------- */
  function parseHash() {
    const h = location.hash || '';
    const m = /^#\/assessment\/(.+)$/.exec(h);
    if (m) return { view: 'assessment', id: decodeURIComponent(m[1]) };
    if (h === '#/assessment' || h === '#/assessment/') return { view: 'assessment', id: null };
    if (h === '#/schedule') return { view: 'schedule', id: null };
    return { view: 'site', id: null };
  }

  function route() {
    const r = parseHash();
    if (r.view === 'assessment' && !r.id && S.route.id) r.id = S.route.id;
    if (r.view === 'assessment' && r.id) S.route.id = r.id;
    S.route.view = r.view;

    ['site', 'schedule', 'assessment'].forEach(v => {
      const sect = document.getElementById('view-' + v);
      if (sect) sect.classList.toggle('hidden', v !== r.view);
      const btn = document.querySelector('nav.folio button[data-view="' + v + '"]');
      if (btn) btn.classList.toggle('on', v === r.view);
    });

    if (r.view === 'site') AM.Sheets.renderSite();
    else if (r.view === 'schedule') AM.Sheets.renderSchedule();
    else AM.Sheets.renderAssessment(r.id);
    window.scrollTo(0, 0);
  }

  /* ---------- change notifications ---------- */
  function changed(a, soon) {
    if (a) AM.Model.touch(a);
    AM.Store.save();
    if (S.route.view === 'assessment' && AM.Sheets.current() === a) AM.Sheets.refreshReport(a, !!soon);
  }

  function projectChanged() {
    S.project.modified = U.nowISO();
    AM.Store.save();
    AM.Sheets.refreshTitleBlock();
  }

  /* ---------- dossier I/O ---------- */
  function newAssessment() {
    const a = AM.Model.add();
    AM.Store.save();
    location.hash = '#/assessment/' + a.id;
    if (parseHash().id === a.id && S.route.view === 'assessment') route();
    setTimeout(() => { const f = document.querySelector('.desk input[type="text"]'); if (f) f.focus(); }, 80);
  }

  function newProject() {
    if (!confirm('Start a new, empty dossier? If the current one matters, save its file first.')) return;
    AM.Model.reset();
    AM.Store.save();
    S.route.id = null;
    location.hash = '#/site';
    route();
    U.toast('A new dossier is open');
  }

  function openProject(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { return U.toast('That file could not be read as a dossier.'); }
      try {
        AM.Model.loadData(data);
        AM.Store.save();
        S.route.id = null;
        location.hash = '#/site';
        route();
        U.toast('Dossier opened');
      } catch (e) {
        U.toast(e.message || 'That file is not an Aftermath dossier.');
      }
    };
    reader.readAsText(file);
  }

  function loadSample() {
    if (!window.AM.SAMPLE) return U.toast('No sample is bundled with this copy.');
    if (S.project.assessments.length &&
        !confirm('Replace the current dossier with the sample? Save yours first if it matters.')) return;
    AM.Model.loadData(JSON.parse(JSON.stringify(AM.SAMPLE)));
    AM.Store.save();
    S.route.id = null;
    location.hash = '#/site';
    route();
    U.toast('The sample dossier is open');
  }

  /* a shared file dialog: callers hand over what to do with the file */
  function pickFile(cb) {
    filePickCb = cb;
    const input = document.getElementById('file-input');
    input.value = '';
    input.click();
  }

  /* ---------- menus ---------- */
  function closeMenus() { document.querySelectorAll('.menu').forEach(m => m.classList.add('hidden')); }
  function wireMenu(btnId, menuId) {
    const btn = document.getElementById(btnId);
    const menu = document.getElementById(menuId);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasHidden = menu.classList.contains('hidden');
      closeMenus();
      if (wasHidden) menu.classList.remove('hidden');
    });
    menu.addEventListener('click', e => e.stopPropagation());
  }

  /* ---------- boot ---------- */
  function boot() {
    const loaded = AM.Store.load();
    if (loaded !== true) {
      if (window.AM.SAMPLE) {
        try { AM.Model.loadData(JSON.parse(JSON.stringify(AM.SAMPLE))); }
        catch (e) { AM.Model.reset(); }
      } else {
        AM.Model.reset();
      }
    }

    document.querySelectorAll('nav.folio button[data-view]').forEach(b => {
      b.addEventListener('click', () => {
        const v = b.dataset.view;
        location.hash = v === 'assessment' ? (S.route.id ? '#/assessment/' + S.route.id : '#/assessment/') : '#/' + v;
      });
    });

    document.getElementById('new-assessment-btn').addEventListener('click', newAssessment);
    wireMenu('project-btn', 'project-menu');
    wireMenu('export-btn', 'export-menu');
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });

    document.getElementById('project-menu').addEventListener('click', e => {
      const btn = e.target.closest('button');
      const act = btn && btn.dataset.act;
      if (!act) return;
      closeMenus();
      if (act === 'save') AM.Exporters.saveProject();
      else if (act === 'open') { const i = document.getElementById('project-input'); i.value = ''; i.click(); }
      else if (act === 'new') newProject();
      else if (act === 'sample') loadSample();
    });
    document.getElementById('export-menu').addEventListener('click', e => {
      const btn = e.target.closest('button');
      const act = btn && btn.dataset.act;
      if (!act) return;
      closeMenus();
      if (act === 'print') AM.Exporters.printDossier();
      else if (act === 'html') AM.Exporters.htmlDossier();
      else if (act === 'json') AM.Exporters.publicJSON();
      else if (act === 'printview') window.print();
    });

    document.getElementById('project-input').addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) openProject(e.target.files[0]);
    });
    document.getElementById('file-input').addEventListener('change', e => {
      if (e.target.files && e.target.files[0] && filePickCb) filePickCb(e.target.files[0]);
      filePickCb = null;
    });

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => AM.Figure.refit(), 120); });
    window.addEventListener('hashchange', route);
    route();
  }

  document.addEventListener('DOMContentLoaded', boot);

  return { route, changed, projectChanged, newAssessment, newProject, loadSample, pickFile };
})();
