/* Justo v2 · app.js
 * Sin dependencias y sin servidor. Lo que escribes se guarda solo en este dispositivo (localStorage).
 * El contenido vive en data/es.json y la configuración en config.js. */
(function () {
  'use strict';

  var CFG = window.JUSTO_CONFIG || {};
  var STORE_KEY = 'justo.v2';
  var C = null;            // contenido (data/es.json)
  var S = null;            // estado del usuario
  var storageOK = true;
  var currentTab = 'plan';
  var resSub = 'enlaces';
  var resCat = 'todo';
  var resQuery = '';
  var glossQuery = '';
  var openPhases = new Set();
  var openTasks = new Set();
  var animatedRibbon = false;
  var tmplName = '';
  var editingWork = false;   // true mientras se edita el cuestionario de trabajo (el plan guardado sigue intacto)
  var mainEl = null;

  // Idiomas disponibles: cada uno tiene su archivo data/<id>.json con todo el contenido traducido.
  var LANGS = [{ id: 'es', name: 'Español' }, { id: 'en', name: 'English' }, { id: 'pt', name: 'Português' }];
  var LANG_KEY = 'justo.lang';
  var LANG = 'es';
  var loaded = {};           // contenido ya descargado en esta visita, por idioma

  /* ---------- utilidades de DOM ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }

  // h('div', {class:'x', onclick: fn}, hijo1, hijo2)
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = v;
        else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { el.style.setProperty(p, String(v[p])); });
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // Texto con **negritas** como nodos seguros (nunca innerHTML)
  function rich(text) {
    var frag = document.createDocumentFragment();
    String(text).split('**').forEach(function (part, i) {
      if (!part) return;
      frag.appendChild(i % 2 ? h('strong', null, part) : document.createTextNode(part));
    });
    return frag;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgIcon(cls, paths, view) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', view || '0 0 24 24');
    s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    paths.forEach(function (d) {
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '1.8');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      s.appendChild(p);
    });
    return s;
  }
  function extIcon() {
    return svgIcon('ext', ['M9.5 2.5h4v4', 'M13.5 2.5L7.5 8.5', 'M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3'], '0 0 16 16');
  }

  /* ---------- textos, números y fechas ---------- */

  function fill(s, vars) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; });
  }
  function T(key, vars) {
    var s = C && C.ui ? C.ui[key] : null;
    if (s == null) return key;
    return vars ? fill(s, vars) : s;
  }

  // "1.000", "1,5", "1000.50" → número. Cualquier cosa rara → 0.
  function num(v) {
    if (typeof v === 'number') return isFinite(v) && v > 0 ? v : 0;
    var s = String(v == null ? '' : v).replace(/[^\d.,]/g, '');
    if (!s) return 0;
    var d = s.lastIndexOf('.'), c = s.lastIndexOf(',');
    if (d > -1 && c > -1) {
      var dec = d > c ? '.' : ',';
      var th = dec === '.' ? ',' : '.';
      s = s.split(th).join('').replace(dec, '.');
    } else if (d > -1 || c > -1) {
      var sep = d > -1 ? '.' : ',';
      var parts = s.split(sep);
      if (parts.length > 2) s = parts.join('');
      else if (parts[1].length === 3 && parts[0].length >= 1) s = parts.join('');
      else s = parts.join('.');
    }
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 0;
  }

  // Separadores según el idioma (en español y portugués: 1.000,5; en inglés: 1,000.5),
  // iguales en todos los navegadores. Los toma de meta en el archivo de contenido.
  function fmt(n, dec) {
    dec = dec == null ? 1 : dec;
    var m = (C && C.meta) || {};
    var dsep = m.decimal || ',', tsep = m.thousands || '.';
    var neg = n < 0;
    var parts = Math.abs(n).toFixed(dec).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, tsep);
    if (parts[1] && /^0+$/.test(parts[1])) parts.pop();
    return (neg ? '-' : '') + parts.join(dsep);
  }
  function money(n) { return '$' + fmt(Math.round(n), 0); }

  // "5 de noviembre" / "5 November" / "5 de novembro", según el idioma
  function fmtDay(t) {
    var d = new Date(t);
    var months = (C && C.meta && C.meta.months) || [];
    return T('fmt.day', { d: d.getUTCDate(), m: months[d.getUTCMonth()] || '' });
  }

  function todayUTC() { var d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return isNaN(t) ? null : t;
  }
  function daysSince(s) {
    var t = parseDate(s);
    return t == null ? null : Math.round((todayUTC() - t) / 86400000);
  }
  function isoToday() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------- estado y almacenamiento ---------- */

  function defaults() {
    return {
      v: 2,
      profile: { onboarded: false, visa: '', city: '', arrival: '', money: '', rent: '', food: '', transport: '', other: '', upfront: '', income: '', hasJob: false },
      progress: {},
      work: { done: false, sectors: [], english: '', availability: '', licence: '', keyword: '' },
      phase: ''
    };
  }

  function probeStorage() {
    try {
      localStorage.setItem('justo.probe', '1');
      localStorage.removeItem('justo.probe');
      return true;
    } catch (e) { return false; }
  }

  function loadState() {
    var base = defaults();
    storageOK = probeStorage();
    if (!storageOK) return base;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return base;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return base;
      Object.assign(base.profile, s.profile || {});
      Object.assign(base.work, s.work || {});
      base.progress = (s.progress && typeof s.progress === 'object') ? s.progress : {};
      base.phase = typeof s.phase === 'string' ? s.phase : '';
    } catch (e) { /* datos dañados: empezamos de cero */ }
    return base;
  }

  // Deja el estado en una forma segura aunque alguien edite el almacenamiento a mano
  function sanitize(st) {
    var p = st.profile;
    var visas = C.visas.map(function (v) { return v.id; });
    var cities = C.cities.map(function (c) { return c.id; });
    if (visas.indexOf(p.visa) === -1) p.visa = '';
    if (cities.indexOf(p.city) === -1) p.city = '';
    if (parseDate(p.arrival) == null) p.arrival = '';
    ['money', 'rent', 'food', 'transport', 'other', 'upfront', 'income'].forEach(function (k) {
      p[k] = (p[k] === '' || p[k] == null) ? '' : String(p[k]).slice(0, 12);
    });
    p.onboarded = !!p.onboarded;
    p.hasJob = !!p.hasJob;
    var w = st.work;
    var secIds = C.work.sectors.map(function (x) { return x.id; });
    w.sectors = Array.isArray(w.sectors) ? w.sectors.filter(function (id) { return secIds.indexOf(id) !== -1; }) : [];
    ['english', 'availability', 'licence'].forEach(function (k) {
      var ids = C.work[k].map(function (x) { return x.id; });
      if (ids.indexOf(w[k]) === -1) w[k] = '';
    });
    w.keyword = typeof w.keyword === 'string' ? w.keyword.slice(0, 60) : '';
    w.done = !!w.done;
    if (C.phases.map(function (x) { return x.id; }).indexOf(st.phase) === -1) st.phase = '';
    return st;
  }

  function saveState() {
    if (!storageOK) { showStorageBanner(); return; }
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
    } catch (e) {
      storageOK = false;
      showStorageBanner();
    }
  }

  function showStorageBanner() {
    var b = $('#storage-banner');
    if (b) b.hidden = storageOK;
  }

  function wipeAll() {
    try {
      Object.keys(localStorage).filter(function (k) { return k.indexOf('justo') === 0; })
        .forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) { /* nada que borrar */ }
    S = defaults();
    saveLang(LANG);   // el idioma no es un dato personal: se mantiene el que la persona está usando
  }

  /* ---------- perfil, ciudad y enlaces útiles ---------- */

  function visaKey() { return S.profile.visa || 'other'; }
  function cityObj() {
    var id = S.profile.city;
    return C.cities.filter(function (c) { return c.id === id; })[0] || null;
  }
  function visaObj() { return C.visas.filter(function (v) { return v.id === S.profile.visa; })[0] || null; }

  // Sustituye {city}, {transport}, {state} por la ciudad elegida (o un texto neutro)
  function interp(s) {
    var c = cityObj();
    return String(s).replace(/\{(city|transport|state|stateName)\}/g, function (m, k) {
      if (k === 'city') return c ? c.name : T('tok.city');
      if (k === 'transport') return c ? c.transport : T('tok.transport');
      if (k === 'state') return c ? c.state : T('tok.state');
      return c ? c.stateName : T('tok.state');
    });
  }

  function safeUrl(u) { return /^(https?:\/\/|tel:|mailto:)/i.test(String(u || '')) ? String(u) : null; }

  function link(url, label, cls) {
    var safe = safeUrl(url);
    if (!safe) return null;
    var phone = safe.slice(0, 4).toLowerCase() === 'tel:';
    var mail = safe.slice(0, 7).toLowerCase() === 'mailto:';
    var a = h('a', { href: safe, class: cls || 'ext-link' });
    if (!phone && !mail) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    a.appendChild(document.createTextNode(label));
    if (!phone && !mail) {
      a.appendChild(extIcon());
      a.appendChild(h('span', { class: 'sr-only' }, ' ' + T('a11y.newtab')));
    }
    return a;
  }

  function linkList(items, cls) {
    var vis = visaKey();
    var ul = h('ul', { class: cls || 'links' });
    (items || []).forEach(function (l) {
      if (l.visas && l.visas.indexOf(vis) === -1) return;
      var a = link(l.url, interp(l.label));
      if (a) ul.appendChild(h('li', null, a));
    });
    return ul.children.length ? ul : null;
  }

  // Enlaces que dependen de la ciudad: transporte, planificador, alquiler y RSA
  function cityLinkItems(key) {
    var c = cityObj();
    if (!c) return [];
    var v = c.links && c.links[key];
    if (!v) return [];
    if (key === 'transport') return v;
    var name = key === 'planner' ? c.name : c.state;
    return [{ label: T('city.' + key, { place: name }), url: v }];
  }

  function feedbackLink() {
    var url = String(CFG.feedbackUrl || '').trim();
    if (/^https:\/\//i.test(url)) return { href: url, mail: false };
    var mail = String(CFG.feedbackEmail || '').trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      return { href: 'mailto:' + mail + '?subject=' + encodeURIComponent(T('feedback.subject')), mail: true };
    }
    return null;
  }

  function announce(msg) {
    var el = $('#live');
    if (!el) return;
    el.textContent = '';
    window.setTimeout(function () { el.textContent = msg; }, 60);
  }

  /* ---------- colchón de dinero ---------- */

  function weeklyTotal(p) { return num(p.rent) + num(p.food) + num(p.transport) + num(p.other); }

  // Semanas = (dinero − pagos únicos) ÷ gasto semanal
  function runway(p) {
    var m = num(p.money), up = num(p.upfront), w = weeklyTotal(p), net = m - up;
    return {
      money: m, upfront: up, weekly: w, net: net,
      weeks: (m > 0 && w > 0) ? Math.max(net, 0) / w : null,
      short: m > 0 && net < 0
    };
  }

  // Menos de 4 semanas: urgente. De 4 a 8: ajustado. Más de 8: holgado.
  // Se decide con el mismo número redondeado que ve la persona, para que "4" nunca aparezca como urgente.
  function tierOf(r) {
    if (r.weeks == null) return null;
    var w = Math.round(r.weeks * 10) / 10;
    if (r.short || w < 4) return 'urgent';
    return w <= 8 ? 'tight' : 'comfortable';
  }
  function currentTier() { return tierOf(runway(S.profile)); }

  // Fecha aproximada hasta la que alcanza el dinero
  function lastDay(r) {
    if (r.weeks == null) return null;
    var start = parseDate(S.profile.arrival);
    var today = todayUTC();
    var from = (start != null && start > today) ? start : today;
    return from + Math.round(r.weeks * 7) * 86400000;
  }

  /* ---------- fases y tareas ---------- */

  function phaseById(id) { return C.phases.filter(function (p) { return p.id === id; })[0] || null; }

  // Fase actual según los días desde la llegada. Sin fecha: la que elija la persona.
  function currentPhaseId() {
    var d = daysSince(S.profile.arrival);
    if (d == null) return S.phase || 'pre';
    if (d < 0) return 'pre';
    if (d <= 2) return 'days';
    if (d <= 6) return 'week1';
    if (d <= 27) return 'weeks24';
    return 'month2';
  }
  function hasDate() { return daysSince(S.profile.arrival) != null; }
  function knowsStage() { return hasDate() || !!S.phase; }

  function taskVisible(t) {
    var tier = currentTier();
    if (t.only === 'urgent' && tier !== 'urgent') return false;
    if (t.visas && t.visas.indexOf(visaKey()) === -1) return false;
    if (t.job === 'search' && S.profile.hasJob) return false;
    if (t.action && t.action.to === 'feedback' && !feedbackLink()) return false;
    return true;
  }

  function prio(t, k) {
    var v = t[k];
    if (v == null) v = t.p;
    return v == null ? 99 : v;
  }

  // Orden estable: en modo urgente manda la prioridad "pu"
  function sortTasks(list) {
    var k = currentTier() === 'urgent' ? 'pu' : 'p';
    return list.map(function (t, i) { return [t, i]; })
      .sort(function (a, b) { return (prio(a[0], k) - prio(b[0], k)) || (a[1] - b[1]); })
      .map(function (x) { return x[0]; });
  }

  // main: tareas que cuentan. later: tareas para cuando ya tengas trabajo
  function phaseTasks(ph) {
    var list = sortTasks(ph.tasks.filter(taskVisible));
    var main = [], later = [];
    list.forEach(function (t) {
      if (t.job === 'employed' && !S.profile.hasJob) later.push(t); else main.push(t);
    });
    return { main: main, later: later };
  }

  function isDone(t) { return S.progress[t.id] === true; }

  function progressTotals() {
    var done = 0, total = 0;
    C.phases.forEach(function (ph) {
      var m = phaseTasks(ph).main;
      total += m.length;
      done += m.filter(isDone).length;
    });
    return { done: done, total: total };
  }

  // La tarea clave más importante que falta en la fase actual
  function nextTask() {
    var ph = phaseById(currentPhaseId());
    if (!ph) return null;
    var pending = phaseTasks(ph).main.filter(function (t) { return !isDone(t); });
    var pick = pending.filter(function (t) { return t.key; })[0] || pending[0] || null;
    return pick ? { task: pick, phase: ph } : { task: null, phase: ph };
  }

  function nextPhaseAfter(ph) {
    var i = C.phases.indexOf(ph);
    return C.phases[i + 1] || null;
  }

  function setDone(id, val) {
    S.progress[id] = !!val;
    saveState();
  }

  // Si la persona ya puso su dinero y sus gastos, la tarea "calcula tu colchón" se marca sola (una vez)
  function autoCheckBudget() {
    var r = runway(S.profile);
    if (r.weeks != null && S.progress['pre-budget'] === undefined) S.progress['pre-budget'] = true;
  }

  /* ---------- plan de trabajo: búsquedas ---------- */

  function slugSeek(kw) { return kw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function slugJora(kw) {
    return kw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('-');
  }

  // Links de búsqueda para una palabra clave. Los portales cambian: son atajos, no promesas.
  function searchLinks(kw, withLinkedIn) {
    var c = cityObj();
    var q = encodeURIComponent(kw);
    var out = [];
    var seekSlug = slugSeek(kw), joraSlug = slugJora(kw);
    if (!seekSlug) return out;
    out.push({ site: 'Seek', url: 'https://www.seek.com.au/' + seekSlug + '-jobs' + (c ? '/in-All-' + c.name.replace(/ /g, '-') + '-' + c.state : '') });
    out.push({ site: 'Indeed', url: 'https://au.indeed.com/jobs?q=' + q + (c ? '&l=' + encodeURIComponent(c.name + ' ' + c.state) : '') });
    out.push({ site: 'Jora', url: 'https://au.jora.com/' + joraSlug + '-jobs' + (c ? '-in-' + c.name.replace(/ /g, '-') + '-' + c.state : '') });
    if (withLinkedIn) {
      out.push({ site: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search/?keywords=' + q + (c ? '&location=' + encodeURIComponent(c.name + ', Australia') : '') });
    }
    return out;
  }

  function sectorById(id) { return C.work.sectors.filter(function (s) { return s.id === id; })[0] || null; }
  function pick(list, id) { return list.filter(function (x) { return x.id === id; })[0] || null; }

  /* ---------- componentes compartidos ---------- */

  function pageHead(title, lead) {
    return h('header', { class: 'page-head' },
      h('h1', null, title),
      lead ? h('p', { class: 'lead' }, lead) : null);
  }

  function ribbonLabel(weeks) {
    if (weeks == null) return T('ribbon.empty');
    return T('ribbon.label', { weeks: fmt(weeks, 1) });
  }

  // La cinta: 12 billetes = 12 semanas, en tres zonas de 4 (urgente, ajustado, holgado)
  function buildRibbon(weeks) {
    var wrap = h('div', { class: 'ribbon', role: 'img' });
    ['urgent', 'tight', 'ok'].forEach(function (z, zi) {
      var zone = h('div', { class: 'zone zone-' + z });
      var notes = h('div', { class: 'notes' });
      for (var i = 0; i < 4; i++) {
        notes.appendChild(h('span', { class: 'note', style: { '--i': zi * 4 + i } }, h('i')));
      }
      zone.appendChild(notes);
      zone.appendChild(h('span', { class: 'zone-label' }, T('zone.' + z)));
      wrap.appendChild(zone);
    });
    if (!animatedRibbon) { wrap.classList.add('animate'); animatedRibbon = true; }
    setRibbon(wrap, weeks);
    return wrap;
  }

  function setRibbon(wrap, weeks) {
    $$('.note > i', wrap).forEach(function (el, idx) {
      var f = weeks == null ? 0 : Math.max(0, Math.min(1, weeks - idx));
      el.style.setProperty('--f', String(f));
    });
    wrap.setAttribute('aria-label', ribbonLabel(weeks));
    wrap.classList.toggle('is-empty', weeks == null);
  }

  function heroCard(where) {
    var p = S.profile, r = runway(p), tier = tierOf(r);
    var titleId = 'hero-title-' + where;
    var box = h('section', { class: 'hero ' + (tier ? 'tier-' + tier : 'tier-none'), 'aria-labelledby': titleId });
    box.appendChild(h('h2', { class: 'hero-title', id: titleId }, T('hero.title')));

    if (!r.money) {
      box.appendChild(h('p', { class: 'hero-lead' }, T('hero.empty.lead')));
      box.appendChild(h('p', { class: 'hero-msg' }, T('hero.empty.msg')));
      box.appendChild(buildRibbon(null));
      if (where === 'plan') {
        box.appendChild(h('div', { class: 'hero-actions' },
          h('button', { type: 'button', class: 'btn btn-wattle', onclick: function () { go('dinero', true); } }, T('hero.empty.cta'))));
      }
      return box;
    }

    if (r.weeks == null) {
      box.appendChild(h('p', { class: 'hero-lead' }, T('hero.nospend.lead')));
      box.appendChild(h('p', { class: 'hero-msg' }, T('hero.nospend.msg')));
      box.appendChild(buildRibbon(null));
      if (where === 'plan') {
        box.appendChild(h('div', { class: 'hero-actions' },
          h('button', { type: 'button', class: 'btn btn-wattle', onclick: function () { go('dinero', true); } }, T('hero.nospend.cta'))));
      }
      return box;
    }

    var unit = Math.abs(r.weeks - 1) < 0.05 ? T('unit.week') : T('unit.weeks');
    box.appendChild(h('p', { class: 'hero-figure' },
      h('span', { class: 'hero-num' }, fmt(r.weeks, 1)),
      h('span', { class: 'hero-unit' }, ' ' + unit)));
    box.appendChild(h('p', { class: 'hero-row' },
      h('span', { class: 'pill pill-' + tier }, T('tier.' + tier)),
      h('span', { class: 'hero-days' }, T('hero.days', { days: fmt(r.weeks * 7, 0) }))));
    box.appendChild(h('p', { class: 'hero-msg' }, r.short ? C.tiers.short.msg : C.tiers[tier].msg));
    box.appendChild(buildRibbon(r.weeks));
    var end = lastDay(r);
    if (end != null && !r.short) box.appendChild(h('p', { class: 'hero-foot' }, T('hero.until', { date: fmtDay(end) })));
    if (where === 'dinero') {
      box.appendChild(h('p', { class: 'hero-math' }, T('hero.math', { money: money(r.money), upfront: money(r.upfront), weekly: money(r.weekly) })));
    }
    return box;
  }

  /* ---------- Plan ---------- */

  function revealTask(phaseId, taskId) {
    openPhases.add(phaseId);
    openTasks.add(taskId);
    render();
    var el = document.getElementById('task-' + taskId);
    if (el) {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      var cb = $('input', el);
      if (cb) cb.focus({ preventScroll: true });
    }
  }

  function nextCard() {
    var nx = nextTask();
    var box = h('section', { class: 'next', 'aria-labelledby': 'next-title', tabindex: '-1' });
    box.appendChild(h('h2', { class: 'next-title', id: 'next-title' }, T('next.title')));
    if (!nx || !nx.task) {
      var after = nx && nx.phase ? nextPhaseAfter(nx.phase) : null;
      box.appendChild(h('p', { class: 'next-text' }, nx && nx.phase ? T('next.finished', { phase: nx.phase.title }) : T('next.none')));
      if (after) {
        box.appendChild(h('div', { class: 'next-actions' },
          h('button', {
            type: 'button', class: 'btn btn-primary', onclick: function () {
              openPhases.add(after.id);
              if (!hasDate()) S.phase = after.id;
              saveState();
              render();
              var el = document.getElementById('phase-' + after.id);
              if (el) el.scrollIntoView({ block: 'start' });
            }
          }, T('next.open', { phase: after.title }))));
      }
      return box;
    }
    var t = nx.task;
    box.appendChild(h('p', { class: 'next-text' }, rich(interp(t.text))));
    box.appendChild(h('div', { class: 'next-actions' },
      h('button', {
        type: 'button', class: 'btn btn-primary', onclick: function () {
          setDone(t.id, true);
          var y = window.scrollY;
          render();
          window.scrollTo(0, y);
          var n = $('.next');
          if (n) n.focus({ preventScroll: true });
          announce(T('a11y.marked'));
        }
      }, T('next.mark')),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { revealTask(nx.phase.id, t.id); } }, T('next.details'))));
    return box;
  }

  function stageChooser() {
    var box = h('section', { class: 'stage', 'aria-labelledby': 'stage-title' },
      h('h2', { class: 'h3', id: 'stage-title' }, T('stage.title')),
      h('p', { class: 'hint' }, T('stage.lead')));
    var chips = h('div', { class: 'chips', role: 'group', 'aria-labelledby': 'stage-title' });
    C.phases.forEach(function (ph) {
      chips.appendChild(h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(S.phase === ph.id), onclick: function () {
          S.phase = ph.id;
          openPhases.add(ph.id);
          saveState();
          var y = window.scrollY;
          render();
          window.scrollTo(0, y);
        }
      }, ph.short));
    });
    box.appendChild(chips);
    box.appendChild(h('button', { type: 'button', class: 'btn-link', onclick: openProfile }, T('stage.date')));
    return box;
  }

  function doAction(a) {
    if (a.to === 'help') openHelp();
    else if (a.to === 'feedback') openFeedback();
    else if (a.to === 'profile') openProfile();
    else { if (a.sub) resSub = a.sub; go(a.to, true); }
  }

  function callout(kind, label, text) {
    return h('p', { class: 'callout callout-' + kind }, h('strong', null, label + ' '), rich(interp(text)));
  }

  function taskMore(t) {
    var box = h('div', { class: 'task-more' });
    var c = cityObj();
    if (t.why) box.appendChild(h('p', null, rich(interp(t.why))));
    if (t.whyCity && c) box.appendChild(h('p', null, interp(t.whyCity)));
    if (t.cityNote && c && c.transportNote) box.appendChild(h('p', null, c.transportNote));
    if (t.warn) box.appendChild(callout('warn', T('callout.warn'), t.warn));
    if (t.urgent && currentTier() === 'urgent') box.appendChild(callout('urgent', T('callout.urgent'), t.urgent));
    if (t.action) {
      box.appendChild(h('p', { class: 'task-action' },
        h('button', { type: 'button', class: 'btn btn-small', onclick: function () { doAction(t.action); } }, t.action.label)));
    }
    var items = [];
    (t.cityLinks || []).forEach(function (k) { items = items.concat(cityLinkItems(k)); });
    items = items.concat(t.links || []);
    var ul = linkList(items);
    if (ul) box.appendChild(ul);
    if (t.cityLinks && t.cityLinks.length && !c) {
      box.appendChild(h('p', { class: 'hint' }, T('city.pick') + ' ', h('button', { type: 'button', class: 'btn-link', onclick: openProfile }, T('city.pick.btn'))));
    }
    if (t.cityLinks && t.cityLinks.indexOf('rsa') !== -1 && c && c.rsaNote) box.appendChild(h('p', { class: 'hint' }, c.rsaNote));
    return box;
  }

  function taskItem(t) {
    var done = isDone(t);
    var li = h('li', { class: 'task' + (done ? ' is-done' : ''), id: 'task-' + t.id });
    var label = interp(t.text).replace(/\*\*/g, '');
    var cb = h('input', { type: 'checkbox', class: 'check', checked: done, 'aria-label': label });
    cb.addEventListener('change', function () {
      setDone(t.id, cb.checked);
      li.classList.toggle('is-done', cb.checked);
      updatePlanMeta();
    });
    var det = h('details', { class: 'task-body' });
    if (openTasks.has(t.id)) det.open = true;
    det.addEventListener('toggle', function () {
      if (det.open) openTasks.add(t.id); else openTasks.delete(t.id);
    });
    det.appendChild(h('summary', null,
      h('span', { class: 'task-text' }, rich(interp(t.text))),
      t.key ? h('span', { class: 'tag-key' }, T('tag.key')) : null));
    det.appendChild(taskMore(t));
    // La etiqueta agranda la zona táctil a 44 px sin cambiar el tamaño de la casilla
    li.appendChild(h('label', { class: 'check-wrap' }, cb));
    li.appendChild(det);
    return li;
  }

  function phaseSection(ph, curId) {
    var t = phaseTasks(ph);
    var done = t.main.filter(isDone).length, total = t.main.length;
    var here = knowsStage() && ph.id === curId;
    var open = openPhases.has(ph.id);
    var state = (total > 0 && done === total) ? 'done' : (here ? 'here' : 'todo');
    var bodyId = 'phase-body-' + ph.id;
    var sec = h('section', { class: 'phase is-' + state, id: 'phase-' + ph.id });
    var btn = h('button', { type: 'button', class: 'phase-btn', 'aria-expanded': String(open), 'aria-controls': bodyId },
      h('span', { class: 'station', 'aria-hidden': 'true' }),
      h('span', { class: 'phase-main' },
        h('span', { class: 'phase-name' }, ph.title),
        here ? h('span', { class: 'phase-here' }, T('phase.here')) : null),
      total ? h('span', { class: 'phase-count', 'data-count': ph.id }, T('phase.count', { done: done, total: total })) : null,
      h('span', { class: 'chev', 'aria-hidden': 'true' }));
    var body = h('div', { class: 'phase-body', id: bodyId, hidden: !open });
    btn.addEventListener('click', function () {
      var now = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(now));
      body.hidden = !now;
      if (now) openPhases.add(ph.id); else openPhases.delete(ph.id);
    });
    sec.appendChild(h('h2', { class: 'phase-head' }, btn));
    body.appendChild(h('p', { class: 'phase-sub' }, ph.sub));
    var ul = h('ul', { class: 'tasks' });
    t.main.forEach(function (tk) { ul.appendChild(taskItem(tk)); });
    body.appendChild(ul);
    if (t.later.length) {
      var det = h('details', { class: 'later' },
        h('summary', null, T('later.title', { n: t.later.length })),
        h('p', { class: 'hint' }, T('later.note')));
      var ul2 = h('ul', { class: 'tasks' });
      t.later.forEach(function (tk) { ul2.appendChild(taskItem(tk)); });
      det.appendChild(ul2);
      body.appendChild(det);
    }
    sec.appendChild(body);
    return sec;
  }

  // Actualiza contadores, estaciones y "Lo siguiente" sin volver a dibujar toda la lista
  function updatePlanMeta() {
    updateMeter();
    var cur = currentPhaseId();
    C.phases.forEach(function (ph) {
      var t = phaseTasks(ph);
      var done = t.main.filter(isDone).length, total = t.main.length;
      var cnt = $('[data-count="' + ph.id + '"]');
      if (cnt) cnt.textContent = T('phase.count', { done: done, total: total });
      var sec = document.getElementById('phase-' + ph.id);
      if (sec) {
        var state = (total > 0 && done === total) ? 'done' : ((knowsStage() && ph.id === cur) ? 'here' : 'todo');
        sec.className = 'phase is-' + state;
      }
    });
    var old = $('.next');
    if (old) old.replaceWith(nextCard());
  }

  function updateMeter() {
    var m = $('#meter');
    if (!m) return;
    var tot = progressTotals();
    var pct = tot.total ? Math.round(tot.done / tot.total * 100) : 0;
    m.hidden = !S.profile.onboarded;
    m.setAttribute('aria-valuenow', String(pct));
    m.setAttribute('aria-valuetext', T('meter.text', { done: tot.done, total: tot.total }));
    $('#meter-fill').style.width = pct + '%';
  }

  function planView() {
    var root = h('div', { class: 'view view-plan' });
    root.appendChild(pageHead(T('plan.title'), T('plan.lead')));
    root.appendChild(heroCard('plan'));
    root.appendChild(nextCard());
    if (!hasDate()) root.appendChild(stageChooser());
    var rail = h('div', { class: 'rail' });
    var cur = currentPhaseId();
    C.phases.forEach(function (ph) { rail.appendChild(phaseSection(ph, cur)); });
    root.appendChild(rail);
    return root;
  }

  /* ---------- Trabajo ---------- */

  function choice(type, name, value, label, checked) {
    return h('label', { class: 'choice' },
      h('input', { type: type, name: name, value: value, checked: !!checked }),
      h('span', null, label));
  }

  function jobSwitch() {
    var cb = h('input', { type: 'checkbox', id: 'has-job', checked: S.profile.hasJob });
    cb.addEventListener('change', function () {
      S.profile.hasJob = cb.checked;
      saveState();
      render();
      var again = $('#has-job');
      if (again) again.focus();
    });
    return h('div', { class: 'switch-row' },
      h('label', { class: 'switch', for: 'has-job' }, cb, h('span', null, T('work.hasjob'))),
      h('p', { class: 'hint' }, T('work.hasjob.help')));
  }

  function radioSet(legend, name, list, current) {
    var fs = h('fieldset', { class: 'fieldset' }, h('legend', null, legend));
    var box = h('div', { class: 'choices' });
    list.forEach(function (o) { box.appendChild(choice('radio', name, o.id, o.label, current === o.id)); });
    fs.appendChild(box);
    return fs;
  }

  function workForm() {
    var w = S.work;
    var form = h('form', { class: 'wform', novalidate: true });
    var fs1 = h('fieldset', { class: 'fieldset' },
      h('legend', null, T('work.q1')),
      h('p', { class: 'hint' }, T('work.q1.help')));
    var grid = h('div', { class: 'choices choices-grid' });
    C.work.sectors.forEach(function (s) { grid.appendChild(choice('checkbox', 'sector', s.id, s.label, w.sectors.indexOf(s.id) !== -1)); });
    fs1.appendChild(grid);
    form.appendChild(fs1);
    form.appendChild(radioSet(T('work.q2'), 'english', C.work.english, w.english));
    form.appendChild(radioSet(T('work.q3'), 'availability', C.work.availability, w.availability));
    form.appendChild(radioSet(T('work.q4'), 'licence', C.work.licence, w.licence));
    var kw = h('input', { type: 'text', class: 'input', id: 'w-keyword', maxlength: '60', autocomplete: 'off', value: w.keyword, placeholder: T('work.q5.ph'), 'aria-describedby': 'w-keyword-help' });
    form.appendChild(h('div', { class: 'field' },
      h('label', { class: 'field-label', for: 'w-keyword' }, T('work.q5')),
      h('p', { class: 'field-help', id: 'w-keyword-help' }, T('work.q5.help')),
      kw));
    var err = h('p', { class: 'error', role: 'alert', hidden: true });
    form.appendChild(err);
    form.appendChild(h('div', { class: 'form-actions' },
      h('button', { type: 'submit', class: 'btn btn-primary' }, T('work.submit')),
      w.done ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { editingWork = false; render(); } }, T('work.cancel')) : null));
    function clearErr() { err.hidden = true; }
    form.addEventListener('change', clearErr);
    form.addEventListener('input', clearErr);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var sectors = $$('input[name=sector]:checked', form).map(function (i) { return i.value; });
      var word = kw.value.trim();
      if (!sectors.length && !word) {
        err.textContent = T('work.err.sector');
        err.hidden = false;
        var first = $('input[name=sector]', form);
        if (first) first.focus();
        return;
      }
      function val(n) { var c = $('input[name=' + n + ']:checked', form); return c ? c.value : ''; }
      S.work = { done: true, sectors: sectors, english: val('english'), availability: val('availability'), licence: val('licence'), keyword: word };
      editingWork = false;
      saveState();
      render();
      announce(T('work.ready'));
    });
    return form;
  }

  function kwRow(kw, withLinkedIn) {
    var sites = h('span', { class: 'sites' });
    searchLinks(kw, withLinkedIn).forEach(function (s) {
      var a = link(s.url, s.site, 'site-btn');
      if (!a) return;
      a.setAttribute('aria-label', T('work.searchon', { site: s.site, kw: kw }));
      sites.appendChild(a);
    });
    if (!sites.children.length) return null;
    return h('li', { class: 'kw-row' }, h('span', { class: 'kw', lang: 'en' }, kw), sites);
  }

  function certBlock(s) {
    var frag = document.createDocumentFragment();
    if (s.certs && s.certs.length) {
      var ul = h('ul', { class: 'bullets' });
      s.certs.forEach(function (c) { ul.appendChild(h('li', null, c)); });
      frag.appendChild(h('h3', null, T('work.certs')));
      frag.appendChild(ul);
    }
    var items = [];
    (s.certLinks || []).forEach(function (id) {
      if (id === 'rsa') items = items.concat(cityLinkItems('rsa'));
      else {
        var ex = C.work.extraLinks.filter(function (x) { return x.id === id; })[0];
        if (ex) items.push({ label: ex.label, url: ex.url });
      }
    });
    var list = linkList(items);
    if (list) frag.appendChild(list);
    if ((s.certLinks || []).indexOf('rsa') !== -1) {
      var c = cityObj();
      if (c && c.rsaNote) frag.appendChild(h('p', { class: 'hint' }, c.rsaNote));
    }
    return frag;
  }

  function section(title, id) {
    return h('section', { class: 'wp-sec', 'aria-labelledby': id }, h('h2', { id: id }, title));
  }

  function workPlanView() {
    var w = S.work, c = cityObj();
    var root = h('div', { class: 'wp' });
    var sectors = w.sectors.map(sectorById).filter(Boolean);

    // Resumen y editar
    var chips = h('ul', { class: 'summary-chips' });
    sectors.forEach(function (s) { chips.appendChild(h('li', null, s.label)); });
    if (w.keyword) chips.appendChild(h('li', { lang: 'en' }, w.keyword));
    root.appendChild(h('div', { class: 'wp-summary' },
      h('p', { class: 'hint' }, T('work.summary')),
      chips,
      h('button', { type: 'button', class: 'btn btn-ghost btn-small', onclick: function () { editingWork = true; render(); } }, T('work.edit'))));

    // Antes de postular
    var s0 = section(T('work.before'), 'wp-before');
    var ul0 = h('ul', { class: 'checks' });
    C.work.before.forEach(function (x) { ul0.appendChild(h('li', null, x)); });
    s0.appendChild(ul0);
    root.appendChild(s0);

    // Busca ahora
    var s1 = section(T('work.search'), 'wp-search');
    if (!c) {
      s1.appendChild(h('p', { class: 'hint' }, T('work.nocity') + ' ',
        h('button', { type: 'button', class: 'btn-link', onclick: openProfile }, T('city.pick.btn'))));
    }
    var shown = {};
    sectors.forEach(function (s) {
      var rows = h('ul', { class: 'kw-rows' });
      s.keywords.forEach(function (k) { shown[k.toLowerCase()] = true; var r = kwRow(k, s.id === 'office'); if (r) rows.appendChild(r); });
      s1.appendChild(h('div', { class: 'search-group' }, h('h3', null, s.label), rows));
    });
    if (w.keyword && !shown[w.keyword.toLowerCase()]) {
      var r2 = kwRow(w.keyword, true);
      if (r2) s1.appendChild(h('div', { class: 'search-group' }, h('h3', null, T('work.yourword')), h('ul', { class: 'kw-rows' }, r2)));
    }
    var more = [];
    C.work.boards.forEach(function (b) { more.push(b); });
    var agUrl = 'https://www.google.com/maps/search/' + encodeURIComponent('recruitment agency' + (c ? ' ' + c.name : ''));
    more.unshift({ label: T('work.agencies'), url: agUrl });
    var moreList = linkList(more);
    if (moreList) s1.appendChild(h('div', { class: 'search-group' }, h('h3', null, T('work.more')), moreList));
    s1.appendChild(h('p', { class: 'hint' }, T('work.alerts')));
    root.appendChild(s1);

    // Consejos por sector
    if (sectors.length) {
      var s2 = section(T('work.tips'), 'wp-tips');
      sectors.forEach(function (s, i) {
        var det = h('details', { class: 'wp-det' }, h('summary', null, s.label));
        if (i === 0) det.open = true;
        var ul = h('ul', { class: 'bullets' });
        s.tips.forEach(function (t) { ul.appendChild(h('li', null, t)); });
        det.appendChild(ul);
        det.appendChild(certBlock(s));
        s2.appendChild(det);
      });
      root.appendChild(s2);
    }

    // Tu perfil de búsqueda
    var advice = [];
    var en = pick(C.work.english, w.english), av = pick(C.work.availability, w.availability), li = pick(C.work.licence, w.licence);
    if (en) advice.push([T('work.advice.english'), en.advice]);
    if (av) advice.push([T('work.advice.avail'), av.advice]);
    if (li) advice.push([T('work.advice.licence'), li.advice]);
    if (advice.length) {
      var s3 = section(T('work.advice'), 'wp-advice');
      var dl = h('dl', { class: 'advice' });
      advice.forEach(function (a) { dl.appendChild(h('dt', null, a[0])); dl.appendChild(h('dd', null, a[1])); });
      s3.appendChild(dl);
      root.appendChild(s3);
    }

    // Plan de 7 días
    var s4 = section(T('work.week'), 'wp-week');
    var ol = h('ol', { class: 'steps' });
    C.work.plan.forEach(function (st) { ol.appendChild(h('li', null, h('strong', null, st.day), h('span', null, st.text))); });
    s4.appendChild(ol);
    s4.appendChild(h('p', { class: 'hint' }, C.work.planNote));
    root.appendChild(s4);

    // Visa y trabajo
    var vb = C.work.visaBlocks[visaKey()] || C.work.visaBlocks.other;
    var s5 = section(T('work.visa'), 'wp-visa');
    s5.appendChild(h('p', null, vb.text));
    var vl = linkList(vb.links);
    if (vl) s5.appendChild(vl);
    root.appendChild(s5);

    // Derechos y estafas
    var s6 = section(T('work.rights'), 'wp-rights');
    var ul6 = h('ul', { class: 'bullets' });
    C.work.rights.forEach(function (x) { ul6.appendChild(h('li', null, x)); });
    s6.appendChild(ul6);
    var rl = linkList(C.work.rightsLinks);
    if (rl) s6.appendChild(rl);
    root.appendChild(s6);

    return root;
  }

  function workView() {
    var root = h('div', { class: 'view view-work' });
    root.appendChild(pageHead(T('work.title'), T('work.lead')));
    root.appendChild(jobSwitch());
    if (S.work.done && !editingWork) root.appendChild(workPlanView());
    else {
      root.appendChild(h('p', { class: 'hint' }, C.work.intro));
      root.appendChild(workForm());
    }
    return root;
  }

  /* ---------- Dinero ---------- */

  function onMoneyInput(key, input) {
    S.profile[key] = input.value.slice(0, 12);
    autoCheckBudget();
    saveState();
    refreshMoney();
    updateMeter();
  }

  function moneyField(id, key, label, help) {
    var input = h('input', { type: 'text', inputmode: 'decimal', id: id, class: 'input', value: S.profile[key], autocomplete: 'off', placeholder: '0' });
    if (help) input.setAttribute('aria-describedby', id + '-help');
    input.addEventListener('input', function () { onMoneyInput(key, input); });
    return h('div', { class: 'field' },
      h('label', { class: 'field-label', for: id }, label),
      help ? h('p', { class: 'field-help', id: id + '-help' }, help) : null,
      h('div', { class: 'money' }, h('span', { class: 'cur', 'aria-hidden': 'true' }, '$'), input));
  }

  function moneyExtra() {
    var p = S.profile, r = runway(p), tier = tierOf(r);
    var box = h('div', { id: 'money-extra' });
    if (r.weeks != null && !r.short && r.weekly > 20) {
      var w2 = Math.max(r.net, 0) / (r.weekly - 20);
      box.appendChild(h('p', { class: 'whatif' }, T('money.whatif', { from: fmt(r.weeks, 1), to: fmt(w2, 1) })));
    }
    var inc = num(p.income);
    if (p.hasJob && inc > 0 && r.weekly > 0) {
      var diff = inc - r.weekly;
      box.appendChild(h('p', { class: 'whatif' }, diff >= 0 ? T('money.income.save', { amount: money(diff) }) : T('money.income.gap', { amount: money(-diff) })));
    }
    if (tier) {
      var t = C.tiers[tier];
      var ul = h('ul', { class: 'bullets' });
      t.tips.forEach(function (x) { ul.appendChild(h('li', null, rich(x))); });
      box.appendChild(h('section', { class: 'tips', 'aria-labelledby': 'tips-title' }, h('h2', { id: 'tips-title' }, t.title), ul));
    } else {
      box.appendChild(h('p', { class: 'hint' }, T('money.notips')));
    }
    return box;
  }

  function refreshMoney() {
    var hero = $('.hero');
    if (hero) hero.replaceWith(heroCard('dinero'));
    var ex = $('#money-extra');
    if (ex) ex.replaceWith(moneyExtra());
    var r = runway(S.profile);
    announceDebounced(r.weeks == null ? T('ribbon.empty') : ribbonLabel(r.weeks));
  }

  var announceTimer = null;
  function announceDebounced(msg) {
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(function () { announce(msg); }, 700);
  }

  function moneyView() {
    var root = h('div', { class: 'view view-money' });
    root.appendChild(pageHead(T('money.title'), T('money.lead')));
    root.appendChild(heroCard('dinero'));
    var f1 = h('fieldset', { class: 'fieldset' }, h('legend', null, T('money.have')));
    f1.appendChild(moneyField('m-money', 'money', T('money.f.money'), T('money.f.money.help')));
    f1.appendChild(moneyField('m-upfront', 'upfront', T('money.f.upfront'), T('money.f.upfront.help')));
    root.appendChild(f1);
    var f2 = h('fieldset', { class: 'fieldset' }, h('legend', null, T('money.spend')));
    f2.appendChild(moneyField('m-rent', 'rent', T('money.f.rent'), T('money.f.rent.help')));
    f2.appendChild(moneyField('m-food', 'food', T('money.f.food')));
    f2.appendChild(moneyField('m-transport', 'transport', T('money.f.transport')));
    f2.appendChild(moneyField('m-other', 'other', T('money.f.other'), T('money.f.other.help')));
    root.appendChild(f2);
    if (S.profile.hasJob) {
      var f3 = h('fieldset', { class: 'fieldset' }, h('legend', null, T('money.earn')));
      f3.appendChild(moneyField('m-income', 'income', T('money.f.income'), T('money.f.income.help')));
      root.appendChild(f3);
    }
    root.appendChild(moneyExtra());
    root.appendChild(h('section', { class: 'tools', 'aria-labelledby': 'tools-title' }, h('h2', { id: 'tools-title' }, T('money.tools')), linkList(C.moneyTools)));
    root.appendChild(h('p', { class: 'hint' }, T('money.disclaimer')));
    return root;
  }

  /* ---------- Recursos ---------- */

  function copyText(text, btn) {
    function done(ok) {
      var old = btn.dataset.label || btn.textContent;
      btn.dataset.label = old;
      btn.textContent = ok ? T('copy.done') : T('copy.fail');
      announce(ok ? T('copy.done') : T('copy.fail'));
      window.setTimeout(function () { btn.textContent = old; }, 1600);
    }
    function legacy() {
      var ta = h('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', top: '0', left: '0', opacity: '0' } });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
    else legacy();
  }

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function cityResources() {
    var c = cityObj();
    if (!c) return [];
    var out = [];
    cityLinkItems('transport').forEach(function (x) { out.push({ cat: 'diario', title: x.label, desc: T('res.city.transport', { city: c.name }), url: x.url, kind: 'gov' }); });
    cityLinkItems('planner').forEach(function (x) { out.push({ cat: 'diario', title: x.label, desc: T('res.city.planner', { city: c.name }), url: x.url, kind: 'gov' }); });
    cityLinkItems('tenancy').forEach(function (x) { out.push({ cat: 'vivienda', title: x.label, desc: T('res.city.tenancy', { state: c.state }), url: x.url, kind: 'gov' }); });
    cityLinkItems('rsa').forEach(function (x) { out.push({ cat: 'trabajo', title: x.label, desc: T('res.city.rsa', { state: c.state }), url: x.url, kind: 'gov' }); });
    return out;
  }

  function resList() {
    var vis = visaKey();
    var list = cityResources().concat(C.resources).filter(function (r) { return !r.visas || r.visas.indexOf(vis) !== -1; });
    if (resCat !== 'todo') list = list.filter(function (r) { return r.cat === resCat; });
    var q = norm(resQuery).trim();
    if (q) list = list.filter(function (r) { return norm(r.title + ' ' + r.desc).indexOf(q) !== -1; });
    var wrap = h('div', { id: 'res-results', 'aria-live': 'polite' });
    if (!list.length) {
      wrap.appendChild(h('p', { class: 'empty' }, T('res.empty'), ' ',
        h('button', { type: 'button', class: 'btn-link', onclick: function () { resQuery = ''; resCat = 'todo'; renderResSub(); } }, T('res.clear'))));
      return wrap;
    }
    var ul = h('ul', { class: 'res-list' });
    list.forEach(function (r) {
      var a = link(r.url, r.title, 'res-link');
      if (!a) return;
      ul.appendChild(h('li', { class: 'res' },
        h('p', { class: 'res-title' }, a),
        h('p', { class: 'res-desc' }, r.desc),
        r.kind ? h('p', { class: 'res-kind kind-' + r.kind }, T('kind.' + r.kind)) : null));
    });
    wrap.appendChild(ul);
    return wrap;
  }

  function resLinks() {
    var box = h('div', { class: 'res-pane' });
    box.appendChild(h('p', { class: 'hint' }, T('res.intro')));
    var q = h('input', { type: 'search', class: 'input', id: 'res-q', value: resQuery, placeholder: T('res.search.ph'), autocomplete: 'off', 'aria-label': T('res.search') });
    q.addEventListener('input', function () {
      resQuery = q.value;
      var old = $('#res-results');
      if (old) old.replaceWith(resList());
    });
    box.appendChild(q);
    var chips = h('div', { class: 'chips', role: 'group', 'aria-label': T('res.cats') });
    [{ id: 'todo', label: T('res.all') }].concat(C.resCats).forEach(function (c) {
      chips.appendChild(h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(resCat === c.id), onclick: function () {
          resCat = c.id;
          $$('.chip', chips).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cat') === resCat)); });
          var old = $('#res-results');
          if (old) old.replaceWith(resList());
        }, 'data-cat': c.id
      }, c.label));
    });
    box.appendChild(chips);
    box.appendChild(resList());
    return box;
  }

  function resGlossary() {
    var box = h('div', { class: 'res-pane' });
    box.appendChild(h('p', { class: 'hint' }, T('gloss.intro')));
    var q = h('input', { type: 'search', class: 'input', id: 'gloss-q', value: glossQuery, placeholder: T('gloss.search.ph'), autocomplete: 'off', 'aria-label': T('gloss.search') });
    var dl = h('dl', { class: 'gloss' });
    function draw() {
      clear(dl);
      var nq = norm(glossQuery).trim();
      var items = C.glossary.slice().sort(function (a, b) { return a.term.toLowerCase().localeCompare(b.term.toLowerCase(), 'en'); })
        .filter(function (g) { return !nq || norm(g.term + ' ' + g.def).indexOf(nq) !== -1; });
      if (!items.length) { dl.appendChild(h('p', { class: 'empty' }, T('gloss.empty'))); return; }
      items.forEach(function (g) {
        dl.appendChild(h('dt', { lang: 'en' }, g.term));
        dl.appendChild(h('dd', null, g.def));
      });
    }
    q.addEventListener('input', function () { glossQuery = q.value; draw(); });
    box.appendChild(q);
    box.appendChild(dl);
    draw();
    return box;
  }

  function resPhrases() {
    var box = h('div', { class: 'res-pane' });
    box.appendChild(h('p', { class: 'hint' }, T('phr.intro')));
    C.phrases.forEach(function (g) {
      var ul = h('ul', { class: 'phrases' });
      g.items.forEach(function (it) {
        var btn = h('button', { type: 'button', class: 'btn btn-small btn-ghost', 'aria-label': T('copy.aria', { text: it.en }) }, T('copy.btn'));
        btn.addEventListener('click', function () { copyText(it.en, btn); });
        ul.appendChild(h('li', { class: 'phrase' },
          h('div', { class: 'phrase-text' }, h('p', { class: 'phrase-en', lang: 'en' }, it.en), it.tr ? h('p', { class: 'phrase-tr' }, it.tr) : null),
          btn));
      });
      box.appendChild(h('section', { class: 'phrase-group' }, h('h2', null, g.title), ul));
    });
    return box;
  }

  // Los mensajes para copiar casi siempre van en inglés (para empleadores y propietarios); el de
  // grupos de compatriotas va en el idioma de la persona. Los huecos "[...]" siguen el idioma del texto.
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var PH_EN = { name: '[your name]', city: '[city]', date: '[date]', visa: '[your visa]' };
  function fillTemplate(text, lang) {
    var v = visaObj(), c = cityObj(), t = parseDate(S.profile.arrival);
    var d = t != null ? new Date(t) : null;
    var en = lang === 'en';
    var ph = en ? PH_EN : { name: T('ph.name'), city: T('ph.city'), date: T('ph.date'), visa: T('ph.visa') };
    var vals = {
      name: tmplName.trim() || ph.name,
      city: c ? c.name : ph.city,
      date: d ? (en ? d.getUTCDate() + ' ' + MONTHS_EN[d.getUTCMonth()] : fmtDay(t)) : ph.date,
      visa: v && v.id !== 'other' ? (en ? v.asEn : v.asLocal) : ph.visa
    };
    return fill(text, vals);
  }

  function resTemplates() {
    var box = h('div', { class: 'res-pane' });
    box.appendChild(h('p', { class: 'hint' }, T('tmpl.intro')));
    var nameIn = h('input', { type: 'text', class: 'input', id: 'tmpl-name', value: tmplName, maxlength: '40', autocomplete: 'off', placeholder: T('tmpl.name.ph') });
    box.appendChild(h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'tmpl-name' }, T('tmpl.name')), nameIn));
    var wrap = h('div', { class: 'tmpls' });
    function draw() {
      clear(wrap);
      C.templates.forEach(function (tp) {
        var id = 'tmpl-' + tp.id;
        var ta = h('textarea', { class: 'tmpl-box', id: id, rows: '8', lang: tp.lang, 'aria-labelledby': id + '-t' });
        ta.value = fillTemplate(tp.text, tp.lang);
        var btn = h('button', { type: 'button', class: 'btn btn-small', onclick: function () { copyText(ta.value, btn); } }, T('copy.btn'));
        var art = h('article', { class: 'tmpl' },
          h('h2', { id: id + '-t' }, tp.title),
          h('p', { class: 'hint' }, tp.intro),
          ta);
        if (tp.warn) art.appendChild(callout('warn', T('callout.warn'), tp.warn));
        art.appendChild(h('p', { class: 'tmpl-actions' }, btn));
        if (tp.tr) {
          art.appendChild(h('details', { class: 'wp-det' }, h('summary', null, T('tmpl.translation')),
            h('p', { class: 'tmpl-tr' }, fillTemplate(tp.tr, LANG))));
        }
        wrap.appendChild(art);
        // altura según contenido
        ta.rows = Math.min(14, Math.max(5, ta.value.split('\n').length + Math.ceil(ta.value.length / 48)));
      });
    }
    nameIn.addEventListener('input', function () { tmplName = nameIn.value; draw(); });
    box.appendChild(wrap);
    draw();
    return box;
  }

  function renderResSub() {
    var pane = $('#res-pane');
    if (!pane) return;
    clear(pane);
    var view = resSub === 'glosario' ? resGlossary() : resSub === 'frases' ? resPhrases() : resSub === 'mensajes' ? resTemplates() : resLinks();
    pane.appendChild(view);
    $$('.subtab').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.sub === resSub)); });
  }

  function resourcesView() {
    var root = h('div', { class: 'view view-res' });
    root.appendChild(pageHead(T('res.title'), T('res.lead')));
    var subs = [['enlaces', T('sub.links')], ['glosario', T('sub.gloss')], ['frases', T('sub.phrases')], ['mensajes', T('sub.tmpl')]];
    var bar = h('div', { class: 'subtabs', role: 'group', 'aria-label': T('res.title') });
    subs.forEach(function (s) {
      bar.appendChild(h('button', {
        type: 'button', class: 'subtab', 'data-sub': s[0], 'aria-pressed': String(resSub === s[0]), onclick: function () {
          resSub = s[0];
          renderResSub();
        }
      }, s[1]));
    });
    root.appendChild(bar);
    root.appendChild(h('div', { id: 'res-pane' }));
    var fb = feedbackLink();
    if (fb) {
      root.appendChild(h('section', { class: 'feedback-card', 'aria-labelledby': 'fb-title' },
        h('h2', { id: 'fb-title' }, T('feedback.title')),
        h('p', null, T('feedback.short')),
        h('button', { type: 'button', class: 'btn btn-small', onclick: openFeedback }, T('feedback.btn'))));
    }
    return root;
  }

  /* ---------- idioma ---------- */

  function isLang(id) { return LANGS.some(function (l) { return l.id === id; }); }

  function langName(id) {
    var l = LANGS.filter(function (x) { return x.id === id; })[0];
    return l ? l.name : id;
  }

  function savedLang() {
    try { var v = localStorage.getItem(LANG_KEY); return isLang(v) ? v : null; } catch (e) { return null; }
  }

  function saveLang(id) {
    try { localStorage.setItem(LANG_KEY, id); } catch (e) { /* sin almacenamiento: vale para esta visita */ }
  }

  // Primer idioma del navegador que Justo tenga. Si ninguno coincide (por ejemplo, tailandés), inglés.
  function detectLang() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').toLowerCase().slice(0, 2);
      if (isLang(code)) return code;
    }
    return list[0] ? 'en' : 'es';
  }

  function loadContent(id) {
    if (loaded[id]) return Promise.resolve(loaded[id]);
    return fetch('data/' + id + '.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) { loaded[id] = data; return data; });
  }

  // Cambia el idioma de toda la guía sin recargar. Si el archivo no baja, se queda en el idioma actual.
  function setLang(id, done, fail) {
    if (!isLang(id)) return;
    if (id === LANG) { if (done) done(); return; }
    loadContent(id).then(function (data) {
      C = data;
      LANG = id;
      saveLang(id);
      applyStaticText();
      render();
      announce(T('lang.set', { name: langName(id) }));
      if (done) done();
    }).catch(function () { if (fail) fail(); });
  }

  // Selector de idioma: tres botones. onChange se ejecuta cuando el cambio ya se hizo.
  function langSwitcher(onChange) {
    var err = h('p', { class: 'error', role: 'alert', hidden: true });
    var group = h('div', { class: 'chips lang-switch', role: 'group', 'aria-label': T('lang.label') });
    LANGS.forEach(function (l) {
      group.appendChild(h('button', {
        type: 'button', class: 'chip', lang: l.id, 'data-lang': l.id, 'aria-pressed': String(l.id === LANG),
        onclick: function () {
          err.hidden = true;
          setLang(l.id, onChange, function () { err.textContent = T('lang.error'); err.hidden = false; });
        }
      }, l.name));
    });
    return h('div', { class: 'lang-wrap' }, group, err);
  }

  // Marca el idioma activo y actualiza la etiqueta en todos los selectores que haya en pantalla
  function syncLangButtons() {
    $$('.lang-switch').forEach(function (g) { g.setAttribute('aria-label', T('lang.label')); });
    $$('.lang-switch .chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === LANG)); });
  }

  function focusActiveLang() {
    var b = $('.modal .lang-switch .chip[aria-pressed="true"]');
    if (b) b.focus();
  }

  /* ---------- ventanas (modales) ---------- */

  var modal = null;
  var INERT_SEL = 'header.top, main, footer.foot, nav.tabs';

  function focusables(root) {
    return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])', root)
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }

  function onModalKey(e) {
    if (!modal) return;
    if (e.key === 'Escape' && modal.dismissible) { e.preventDefault(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    var list = focusables(modal.dlg);
    if (!list.length) { e.preventDefault(); modal.dlg.focus(); return; }
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === modal.dlg)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function setInert(on) {
    $$(INERT_SEL).forEach(function (el) {
      if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
  }

  function closeIcon() { return svgIcon('x', ['M6 6l12 12', 'M18 6L6 18']); }

  // opts: { title, build(body, api), dismissible, onClose }
  function openModal(opts) {
    closeModal(true);
    var prev = document.activeElement;
    var overlay = h('div', { class: 'overlay' });
    var dlg = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title', tabindex: '-1' });
    var dismissible = opts.dismissible !== false;
    var head = h('div', { class: 'modal-head' }, h('h2', { id: 'modal-title' }, opts.title));
    if (dismissible) {
      head.appendChild(h('button', { type: 'button', class: 'close', 'aria-label': T('modal.close'), onclick: function () { closeModal(); } }, closeIcon()));
    }
    var body = h('div', { class: 'modal-body' });
    dlg.appendChild(head);
    dlg.appendChild(body);
    overlay.appendChild(dlg);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay && dismissible) closeModal(); });
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    setInert(true);
    modal = { overlay: overlay, dlg: dlg, body: body, prev: prev, dismissible: dismissible, onClose: opts.onClose, head: head };
    document.addEventListener('keydown', onModalKey, true);
    opts.build(body, {
      setTitle: function (t) { $('#modal-title').textContent = t; },
      close: function () { closeModal(); }
    });
    dlg.focus();
    return modal;
  }

  function closeModal(silent) {
    if (!modal) return;
    var m = modal;
    modal = null;
    document.removeEventListener('keydown', onModalKey, true);
    if (m.overlay.parentNode) m.overlay.parentNode.removeChild(m.overlay);
    document.body.classList.remove('modal-open');
    setInert(false);
    if (!silent) {
      if (m.onClose) m.onClose();
      if (m.prev && m.prev.focus && document.contains(m.prev)) m.prev.focus();
    }
  }

  /* ---------- formularios del perfil ---------- */

  function selectField(id, label, options, value, help) {
    var sel = h('select', { id: id, class: 'input' });
    options.forEach(function (o) {
      var opt = h('option', { value: o.value }, o.label);
      if (o.value === value) opt.selected = true;
      sel.appendChild(opt);
    });
    if (help) sel.setAttribute('aria-describedby', id + '-help');
    return h('div', { class: 'field' },
      h('label', { class: 'field-label', for: id }, label),
      help ? h('p', { class: 'field-help', id: id + '-help' }, help) : null,
      sel);
  }

  function cityOptions() {
    return [{ value: '', label: T('city.unknown') }].concat(C.cities.map(function (c) { return { value: c.id, label: c.name + ' (' + c.state + ')' }; }));
  }

  function dateField(id, value) {
    var inp = h('input', { type: 'date', id: id, class: 'input', value: value || '', 'aria-describedby': id + '-help' });
    return h('div', { class: 'field' },
      h('label', { class: 'field-label', for: id }, T('date.label')),
      h('p', { class: 'field-help', id: id + '-help' }, T('date.help')),
      inp);
  }

  /* ---------- bienvenida (3 pasos) ---------- */

  function openOnboarding() {
    var step = 1;
    var d = {
      visa: S.profile.visa, city: S.profile.city, arrival: S.profile.arrival,
      money: S.profile.money, rent: S.profile.rent, food: S.profile.food, transport: S.profile.transport, other: S.profile.other
    };
    openModal({
      title: T('onb.title'),
      dismissible: false,
      build: function (body, api) {
        function finish() {
          Object.keys(d).forEach(function (k) { S.profile[k] = d[k]; });
          S.profile.onboarded = true;
          autoCheckBudget();
          saveState();
          closeModal(true);
          openPhases = new Set([currentPhaseId()]);
          route();
          mainEl.focus({ preventScroll: true });
          window.scrollTo(0, 0);
        }

        function draw() {
          clear(body);
          body.appendChild(h('p', { class: 'step-count' }, T('onb.step', { n: step })));
          var err = h('p', { class: 'error', role: 'alert', hidden: true });
          var actions = h('div', { class: 'form-actions' });

          if (step === 1) {
            body.appendChild(h('div', { class: 'field' },
              h('p', { class: 'field-label' }, T('lang.label')),
              langSwitcher(function () { api.setTitle(T('onb.title')); draw(); focusActiveLang(); })));
            body.appendChild(h('p', { class: 'lead' }, T('onb.intro')));
            var fs = h('fieldset', { class: 'fieldset' }, h('legend', null, T('onb.visa')));
            var box = h('div', { class: 'choices' });
            C.visas.forEach(function (v) {
              var inp = h('input', { type: 'radio', name: 'visa', value: v.id, checked: d.visa === v.id });
              inp.addEventListener('change', function () { d.visa = v.id; err.hidden = true; });
              box.appendChild(h('label', { class: 'choice' }, inp, h('span', null, h('strong', null, v.label), h('small', null, v.hint))));
            });
            fs.appendChild(box);
            body.appendChild(fs);
            body.appendChild(err);
            actions.appendChild(h('button', {
              type: 'button', class: 'btn btn-primary', onclick: function () {
                if (!d.visa) { err.textContent = T('onb.err.visa'); err.hidden = false; return; }
                step = 2; draw(); body.parentNode.focus();
              }
            }, T('onb.next')));
          }

          if (step === 2) {
            body.appendChild(h('p', { class: 'lead' }, T('onb.where')));
            var citySel = selectField('o-city', T('city.label'), cityOptions(), d.city);
            $('select', citySel).addEventListener('change', function (e) { d.city = e.target.value; });
            body.appendChild(citySel);
            var df = dateField('o-date', d.arrival);
            $('input', df).addEventListener('change', function (e) { d.arrival = e.target.value; });
            body.appendChild(df);
            actions.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { step = 1; draw(); body.parentNode.focus(); } }, T('onb.back')));
            actions.appendChild(h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { step = 3; draw(); body.parentNode.focus(); } }, T('onb.next')));
          }

          if (step === 3) {
            body.appendChild(h('p', { class: 'lead' }, T('onb.money')));
            body.appendChild(h('p', { class: 'hint' }, T('onb.money.help')));
            [['o-money', 'money', T('money.f.money')], ['o-rent', 'rent', T('money.f.rent')], ['o-food', 'food', T('money.f.food')],
              ['o-transport', 'transport', T('money.f.transport')], ['o-other', 'other', T('money.f.other')]].forEach(function (f) {
              var inp = h('input', { type: 'text', inputmode: 'decimal', id: f[0], class: 'input', value: d[f[1]], autocomplete: 'off', placeholder: '0' });
              inp.addEventListener('input', function () { d[f[1]] = inp.value.slice(0, 12); });
              body.appendChild(h('div', { class: 'field' },
                h('label', { class: 'field-label', for: f[0] }, f[2]),
                h('div', { class: 'money' }, h('span', { class: 'cur', 'aria-hidden': 'true' }, '$'), inp)));
            });
            body.appendChild(h('p', { class: 'hint' }, T('onb.privacy')));
            actions.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { step = 2; draw(); body.parentNode.focus(); } }, T('onb.back')));
            actions.appendChild(h('button', { type: 'button', class: 'btn btn-primary', onclick: finish }, T('onb.start')));
          }
          body.appendChild(actions);
        }
        draw();
      }
    });
  }

  /* ---------- Mi perfil ---------- */

  function openProfile() {
    openModal({
      title: T('prof.title'),
      build: function (body, api) {
        var p = S.profile;
        var d = { visa: p.visa, city: p.city, arrival: p.arrival, hasJob: p.hasJob };
        function draw() {
          clear(body);
          body.appendChild(h('div', { class: 'field' },
            h('p', { class: 'field-label' }, T('lang.label')),
            langSwitcher(function () { api.setTitle(T('prof.title')); draw(); focusActiveLang(); })));
          var visaSel = selectField('p-visa', T('prof.visa'),
            [{ value: '', label: T('prof.visa.pick') }].concat(C.visas.map(function (v) { return { value: v.id, label: v.label }; })), d.visa);
          $('select', visaSel).addEventListener('change', function (e) { d.visa = e.target.value; });
          body.appendChild(visaSel);
          var citySel = selectField('p-city', T('city.label'), cityOptions(), d.city);
          $('select', citySel).addEventListener('change', function (e) { d.city = e.target.value; });
          body.appendChild(citySel);
          var df = dateField('p-date', d.arrival);
          $('input', df).addEventListener('change', function (e) { d.arrival = e.target.value; });
          body.appendChild(df);
          var job = h('input', { type: 'checkbox', id: 'p-job', checked: d.hasJob });
          job.addEventListener('change', function () { d.hasJob = job.checked; });
          body.appendChild(h('div', { class: 'switch-row' }, h('label', { class: 'switch', for: 'p-job' }, job, h('span', null, T('work.hasjob')))));
          body.appendChild(h('div', { class: 'form-actions' },
            h('button', {
              type: 'button', class: 'btn btn-primary', onclick: function () {
                p.visa = d.visa; p.city = d.city; p.arrival = d.arrival; p.hasJob = d.hasJob;
                p.onboarded = p.onboarded || !!d.visa;
                if (hasDate()) openPhases.add(currentPhaseId());
                saveState();
                api.close();
                render();
              }
            }, T('prof.save')),
            h('button', { type: 'button', class: 'btn btn-ghost', onclick: api.close }, T('prof.cancel'))));
          body.appendChild(h('section', { class: 'danger-zone', 'aria-labelledby': 'dz-title' },
            h('h3', { id: 'dz-title' }, T('prof.data')),
            h('p', { class: 'hint' }, T('prof.data.text')),
            h('button', { type: 'button', class: 'btn btn-danger', onclick: confirmWipe }, T('prof.wipe'))));
        }
        function confirmWipe() {
          clear(body);
          api.setTitle(T('prof.wipe.title'));
          body.appendChild(h('p', null, T('prof.wipe.text')));
          body.appendChild(h('div', { class: 'form-actions' },
            h('button', {
              type: 'button', class: 'btn btn-danger', onclick: function () {
                wipeAll();
                openPhases = new Set(['pre']);
                openTasks = new Set();
                animatedRibbon = false;
                editingWork = false;
                closeModal(true);
                render();
                openOnboarding();
              }
            }, T('prof.wipe.yes')),
            h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { api.setTitle(T('prof.title')); draw(); } }, T('prof.wipe.no'))));
        }
        draw();
      }
    });
  }

  /* ---------- Ayuda ---------- */

  function openHelp() {
    openModal({
      title: T('help.title'),
      build: function (body) {
        body.appendChild(h('p', { class: 'lead' }, T('help.lead')));
        var ul = h('ul', { class: 'help-list' });
        C.help.forEach(function (x) {
          var a = link('tel:' + x.tel, x.label, 'tel-link');
          a.setAttribute('aria-label', T('help.call', { name: x.name, number: x.label }));
          ul.appendChild(h('li', { class: 'help-item' },
            h('div', null, h('p', { class: 'help-name' }, x.name), h('p', { class: 'help-note' }, x.note)),
            a));
        });
        body.appendChild(ul);
        body.appendChild(h('p', { class: 'hint' }, C.helpNote));
      }
    });
  }

  /* ---------- Comentarios (privados) ---------- */

  function openFeedback() {
    var fb = feedbackLink();
    openModal({
      title: T('feedback.title'),
      build: function (body) {
        if (!fb) { body.appendChild(h('p', null, T('feedback.off'))); return; }
        body.appendChild(h('p', { class: 'lead' }, T('feedback.text')));
        body.appendChild(callout('warn', T('callout.warn'), T('feedback.warn')));
        var a = link(fb.href, fb.mail ? T('feedback.mail') : T('feedback.open'), 'btn btn-primary');
        body.appendChild(h('p', { class: 'form-actions' }, a));
      }
    });
  }

  /* ---------- enrutado y arranque ---------- */

  var TABS = ['plan', 'trabajo', 'dinero', 'recursos'];
  var lastTab = null;
  var pendingFocus = false;

  function go(name, focus) {
    pendingFocus = !!focus;
    if (location.hash === '#' + name) route(); else location.hash = '#' + name;
  }

  function updateNav() {
    $$('nav.tabs a').forEach(function (a) {
      var on = a.getAttribute('href') === '#' + currentTab;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function render() {
    var view;
    if (currentTab === 'trabajo') view = workView();
    else if (currentTab === 'dinero') view = moneyView();
    else if (currentTab === 'recursos') view = resourcesView();
    else view = planView();
    clear(mainEl).appendChild(view);
    if (currentTab === 'recursos') renderResSub();
    updateMeter();
    updateNav();
    document.title = T('doc.title.' + currentTab);
  }

  function route() {
    var name = (location.hash || '').replace('#', '');
    if (TABS.indexOf(name) === -1) name = 'plan';
    var changed = name !== lastTab;
    currentTab = name;
    render();
    if (changed && lastTab !== null || pendingFocus) {
      window.scrollTo(0, 0);
      mainEl.focus({ preventScroll: true });
    }
    pendingFocus = false;
    lastTab = name;
  }

  function applyStaticText() {
    $$('[data-t]').forEach(function (el) { el.textContent = T(el.getAttribute('data-t')); });
    $$('[data-t-label]').forEach(function (el) { el.setAttribute('aria-label', T(el.getAttribute('data-t-label'))); });
    document.documentElement.lang = (C.meta && C.meta.lang) || LANG;
    var md = $('meta[name="description"]');
    if (md && C.ui['app.description']) md.setAttribute('content', C.ui['app.description']);
    var fb = feedbackLink();
    var f = $('#footer-feedback');
    if (f) f.hidden = !fb;
    syncLangButtons();
  }

  function bindChrome() {
    var b1 = $('#btn-help'), b2 = $('#btn-profile'), b3 = $('#footer-feedback button');
    if (b1) b1.addEventListener('click', openHelp);
    if (b2) b2.addEventListener('click', openProfile);
    if (b3) b3.addEventListener('click', openFeedback);
    var fl = $('#foot-lang');
    if (fl) fl.appendChild(langSwitcher());
    window.addEventListener('hashchange', route);
  }

  // Si el contenido no baja no hay idioma al que recurrir: el aviso va en los tres.
  function showLoadError() {
    var msgs = [
      ['es', 'No se pudo cargar Justo', 'Revisa tu conexión y vuelve a intentarlo. Si abriste el archivo index.html directamente desde tu computador, abre Justo desde su dirección web: el navegador no deja leer el contenido desde un archivo local.'],
      ['en', 'Justo could not load', 'Check your connection and try again. If you opened index.html straight from your computer, open Justo from its web address instead: the browser does not let a page read its content from a local file.'],
      ['pt', 'Não foi possível carregar o Justo', 'Verifique sua conexão e tente de novo. Se você abriu o index.html direto do computador, abra o Justo pelo endereço web: o navegador não deixa ler o conteúdo a partir de um arquivo local.']
    ];
    var box = h('div', { class: 'view' });
    msgs.forEach(function (m, i) {
      box.appendChild(h('section', { lang: m[0] }, h(i === 0 ? 'h1' : 'h2', null, m[1]), h('p', null, m[2])));
    });
    box.appendChild(h('p', null, h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { window.location.reload(); } }, 'Reintentar · Try again · Tentar de novo')));
    clear(mainEl).appendChild(box);
  }

  function registerWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    function reg() {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo sin conexión: la app funciona igual */ });
    }
    // La carga del contenido es asíncrona: el evento 'load' puede haber pasado ya.
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
  }

  function start() {
    mainEl = $('#main');
    // Idioma: el que la persona eligió; si es la primera vez, el de su navegador.
    // Si su archivo no baja, se intenta con español para no dejarla sin la guía.
    var want = savedLang() || detectLang();
    loadContent(want)
      .catch(function (err) {
        if (want === 'es') throw err;
        want = 'es';
        return loadContent('es');
      })
      .then(function (data) {
        C = data;
        LANG = want;
        S = sanitize(loadState());
        applyStaticText();
        bindChrome();
        showStorageBanner();
        openPhases.add(currentPhaseId());
        route();
        if (!S.profile.onboarded) openOnboarding();
        registerWorker();
      })
      .catch(showLoadError);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
