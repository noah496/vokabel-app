'use strict';
/* Vokabeltrainer Arabisch – alles lokal im Browser gespeichert */

// ---------- Speicher ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem('vk.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('vk.' + k, JSON.stringify(v)); } catch (e) { toast('Speichern fehlgeschlagen'); } }
};
let S = LS.get('state', { c: {}, hist: {}, tests: 0 });   // Lernstand
let SET = Object.assign({ front: 'ar', round: 20, testN: 20, plN: 15, theme: 'dark', src: 'all', goal: 20, qwbw: true, qtr: false }, LS.get('set', {}));
let OWN = LS.get('own', []);       // eigene Karten
let EDIT = LS.get('edit', {});     // Änderungen an Karten
const save = () => LS.set('state', S);
const saveSet = () => LS.set('set', SET);

// ---------- Daten ----------
let DB, W = new Map(), ROOT = new Map(), SRC = [], QRANK = [];
const CAT = { v: 'Verb', n: 'Nomen', adj: 'Adjektiv', ap: 'Partizip aktiv', pp: 'Partizip passiv', vn: 'Verbalnomen (Masdar)', p: 'Partikel / Pronomen', pn: 'Eigenname', adv: 'Adverb / Zeit / Ort', own: 'Eigene Karte' };
const STEM = { 1: 'I (فَعَلَ)', 2: 'II (فَعَّلَ)', 3: 'III (فَاعَلَ)', 4: 'IV (أَفْعَلَ)', 5: 'V (تَفَعَّلَ)', 6: 'VI (تَفَاعَلَ)', 7: 'VII (اِنْفَعَلَ)', 8: 'VIII (اِفْتَعَلَ)', 9: 'IX (اِفْعَلَّ)', 10: 'X (اِسْتَفْعَلَ)' };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

function buildIndex() {
  W = new Map(); ROOT = new Map();
  for (const e0 of DB.entries) {
    const e = Object.assign({}, e0, EDIT[e0.id] || {});
    W.set(String(e.id), e);
  }
  for (const o of OWN) {
    const e = Object.assign({}, o, { own: true, src: ['own'] });
    W.set(String(e.id), e);
  }
  for (const e of W.values()) {
    if (e.r) { const k = e.r.replace(/\s/g, ''); if (!ROOT.has(k)) ROOT.set(k, []); ROOT.get(k).push(e); }
  }
  QRANK = DB.entries.filter(e => e.src.includes('q')).sort((a, b) => b.f - a.f).map(e => String(e.id));
  const qLessons = [];
  const qtot = DB.entries.reduce((a, e) => a + (e.src.includes('q') ? e.f || 0 : 0), 0) || 1; let cum = 0;
  for (let i = 0; i < QRANK.length; i += 100) { const sl = QRANK.slice(i, i + 100); cum += sl.reduce((a, x) => a + (W.get(x).f || 0), 0); qLessons.push({ k: 'q.' + (i / 100 + 1), t: `Häufigkeit ${i + 1}–${Math.min(i + 100, QRANK.length)} · bis hier ${Math.round(cum / qtot * 100)} % des Qurantextes`, ids: sl }); }
  SRC = [{ k: 'q', t: 'Quran (nach Häufigkeit)', l: qLessons }];
  const lessonIds = {};
  for (const e of W.values()) for (const s of e.src || []) { (lessonIds[s] = lessonIds[s] || []).push(String(e.id)); }
  for (const s of DB.sources) if (s.k !== 'q') SRC.push({ k: s.k, t: s.t, l: s.l.map(l => ({ k: l.k, t: l.t, ids: lessonIds[l.k] || [] })) });
  SRC.push({ k: 'own', t: 'Eigene Karten', l: [{ k: 'own', t: 'Eigene Karten', ids: OWN.map(o => String(o.id)) }] });
}
function idsOfSource(k) {
  if (k === 'all') return [...W.keys()];
  const s = SRC.find(s => s.k === k); if (!s) return [];
  const set = new Set(); s.l.forEach(l => l.ids.forEach(i => set.add(i))); return [...set];
}
function lessonById(k) { for (const s of SRC) for (const l of s.l) if (l.k === k) return l; return null; }

// ---------- Hilfen ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const now = () => Date.now();
const DAY = 864e5;
const today = () => new Date().toISOString().slice(0, 10);
function st(id) { id = String(id); return S.c[id] || (S.c[id] = { lv: 0 }); }
function lvOf(id) { const c = S.c[String(id)]; return c ? c.lv || 0 : 0; }
function hist(k, n = 1) { const d = today(); S.hist[d] = S.hist[d] || {}; S.hist[d][k] = (S.hist[d][k] || 0) + n; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
function catLabel(e) {
  let s = CAT[e.own ? (e.c || 'own') : e.c] || 'Wort';
  if (e.st && e.c !== 'n') s += ' · Stamm ' + ROMAN[e.st];
  return s;
}

// Arabisch vergleichen: ohne Harakat, tolerant bei أ/إ/آ/ا, ة/ه, ى/ي
function normAr(s) {
  return String(s || '').replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱأإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ی/g, 'ي').replace(/ک/g, 'ك')
    .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^ء-ي]/g, '').replace(/^ال(?=..)/, '');
}
// Deutsch vergleichen: Groß/klein egal, Umlaute tolerant, Artikel und Klammern ignoriert
function normDe(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[!?.…„“"'’:]/g, ' ').replace(/\b(der|die|das|ein|eine|einen|sich|zu|etw|jdn|jdm|jemanden|jemandem|etwas)\b/g, ' ')
    .replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
}
function meanings(de) { return String(de || '').split(/[;,/]/).map(normDe).filter(Boolean); }
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
  return d[b.length];
}
function deMatch(ans, de) {
  const a = normDe(ans); if (!a) return false;
  for (const m of meanings(de)) {
    if (a === m) return true;
    const tol = m.length >= 9 ? 2 : m.length >= 5 ? 1 : 0;
    if (tol && lev(a, m) <= tol) return true;
  }
  return false;
}
function arMatch(ans, e) {
  const a = normAr(ans); if (!a) return false;
  if (a === normAr(e.ar)) return true;
  // auch richtig: ein anderes Wort mit derselben Bedeutung
  const ms = new Set(meanings(e.de));
  for (const o of W.values()) if (normAr(o.ar) === a && meanings(o.de).some(m => ms.has(m))) return true;
  return false;
}

// ---------- Ansicht/Navigation ----------
const view = $('#view');
let stack = [];
let cleanup = null;
function setTitle(t, back) { $('#title').textContent = t; $('#back').hidden = !back; }
function tabs(name) { document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === name)); }
function go(name, arg, push = true) {
  if (cleanup) { cleanup(); cleanup = null; }
  if (push) stack.push([name, arg]);
  window.scrollTo(0, 0);
  (R[name] || R.home)(arg);
}
function back() { stack.pop(); const p = stack[stack.length - 1]; if (p) go(p[0], p[1], false); else go('home'); }
$('#back').onclick = back;
$('#settingsBtn').onclick = () => { stack = [['home']]; go('settings'); };
$('#searchBtn').onclick = () => { stack = [['home']]; go('search'); };
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { stack = []; go(b.dataset.go); });

function srcSelect(id, val) {
  return `<select id="${id}"><option value="all">Alle Quellen</option>${SRC.map(s => `<option value="${s.k}" ${val === s.k ? 'selected' : ''}>${esc(s.t)}</option>`).join('')}</select>`;
}

// ---------- Seiten ----------
const R = {};

function actOn(d) { const h = S.hist[new Date(Date.now() - d * DAY).toISOString().slice(0, 10)]; return h && ((h.cards || 0) + (h.tq || 0)) > 0; }
function streakDays() { let n = 0, d = actOn(0) ? 0 : 1; while (actOn(d) && d < 4000) { n++; d++; } return n; }
let QTOTAL = 0;
function coverage() {
  if (!QTOTAL) QTOTAL = DB.entries.reduce((a, e) => a + (e.src.includes('q') ? e.f || 0 : 0), 0) || 1;
  let k = 0; for (const e of DB.entries) if (e.f && e.src.includes('q') && lvOf(e.id) >= 3) k += e.f;
  return k / QTOTAL * 100;
}
function nextDue(id) { const c = S.c[String(id)]; if (!c || !c.lv) return ''; const d = Math.ceil(((c.ls || 0) + IV[c.lv] - now()) / DAY); return d <= 0 ? 'heute fällig' : d === 1 ? 'morgen' : `in ${d} Tagen`; }
R.home = () => {
  tabs('home'); setTitle('Vokabeltrainer', false);
  const all = [...W.keys()];
  const seen = all.filter(i => lvOf(i) > 0).length, learned = all.filter(i => lvOf(i) >= 5).length;
  const due = dueIds('all').length;
  const h = S.hist[today()] || {};
  const doneToday = (h.cards || 0) + (h.tq || 0), goal = SET.goal || 20;
  const cov = coverage();
  view.innerHTML = `
  <div class="goal panel"><div class="row"><b class="grow">Tagesziel ${Math.min(doneToday, goal)} / ${goal}</b><span class="streak" title="Tage in Folge">🔥 ${streakDays()} ${streakDays() === 1 ? 'Tag' : 'Tage'}</span></div>
    <div class="progress"><i style="width:${Math.min(100, doneToday / goal * 100)}%"></i></div>
    <div class="small muted">${doneToday >= goal ? 'Tagesziel erreicht. Stark!' : `Noch ${goal - doneToday} Karten oder Fragen bis zum Tagesziel.`}</div></div>
  <div class="tiles">
    <div class="tile"><b>${due}</b><span>heute fällig</span></div>
    <div class="tile"><b>${learned}</b><span>gelernt</span></div>
    <div class="tile"><b>${cov.toFixed(1).replace('.', ',')} %</b><span>vom Qurantext</span></div>
  </div>
  <p class="muted small">Du kennst Wörter (ab Stufe 3), die ${cov.toFixed(1).replace('.', ',')} % aller Wörter im Quran ausmachen. Gesehen: ${seen} von ${all.length} Wörtern.</p>
  <div class="menu">
    <button data-go="quran"><span class="ic">۝</span><div><b>Quran lesen</b><small>Wort für Wort, Lernen nach Sure und Seite</small></div></button>
    <button data-go="hadith"><span class="ic">❝</span><div><b>Hadithe</b><small>40 Hadithe an-Nawawi, ʿUmdat al-Aḥkām</small></div></button>
    <button data-go="learn"><span class="ic">🂠</span><div><b>Karteikarten lernen</b><small>Neue Wörter und Wiederholung, 5 Stufen</small></div></button>
    <button data-go="test"><span class="ic">✎</span><div><b>Prüfung</b><small>Eintippen, zufällig Deutsch ↔ Arabisch</small></div></button>
    <button data-go="plural"><span class="ic">ج</span><div><b>Plural-Training</b><small>Mehrzahl lernen und prüfen</small></div></button>
    <button data-go="browse"><span class="ic">☰</span><div><b>Wortschatz</b><small>Nach Quelle und Lektion, Suche</small></div></button>
    <button data-go="own"><span class="ic">＋</span><div><b>Eigene Karten</b><small>${OWN.length} eigene Karten</small></div></button>
    <button data-go="stats"><span class="ic">▤</span><div><b>Statistik</b><small>Fortschritt und Verlauf</small></div></button>
  </div>`;
  view.querySelectorAll('.menu button').forEach(b => b.onclick = () => { stack = [['home']]; go(b.dataset.go); });
};

// ----- Lernen (Karteikarten)
const IV = [0, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];   // Abstand bis zur nächsten Wiederholung je Stufe
function dueIds(src) {
  const t = now();
  return idsOfSource(src).filter(i => { const c = S.c[i]; return c && c.lv > 0 && (t - (c.ls || 0)) >= IV[c.lv]; })
    .sort((a, b) => lvOf(a) - lvOf(b) || (S.c[a].ls || 0) - (S.c[b].ls || 0));
}
function newIds(src) {
  const ids = idsOfSource(src).filter(i => lvOf(i) === 0);
  return ids.sort((a, b) => (W.get(b).f || 0) - (W.get(a).f || 0) || (+a || 0) - (+b || 0));
}
R.learn = () => {
  tabs('learn'); setTitle('Karteikarten', stack.length > 1);
  const src = SET.src;
  view.innerHTML = `
  <div class="panel">
    <label>Quelle</label>${srcSelect('lsrc', src)}
    <label>Vorderseite</label>
    <div class="seg" id="front"><button data-v="ar">Arabisch</button><button data-v="de">Deutsch</button><button data-v="mix">Gemischt</button></div>
    <label>Karten pro Runde</label><input type="number" id="lround" min="5" max="100" value="${SET.round}">
  </div>
  <div class="menu" id="lmenu"></div>
  <p class="muted small">Gewusst: eine Stufe höher. Nicht gewusst: zurück auf Stufe 1, und die Karte kommt in der Runde wieder, bis du sie weißt. Ab Stufe 5 gilt ein Wort als gelernt. Wiederholung nach 1, 3, 7, 14 und 30 Tagen (je nach Stufe).</p>`;
  const seg = $('#front');
  const upd = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === SET.front));
  seg.onclick = e => { if (e.target.dataset.v) { SET.front = e.target.dataset.v; saveSet(); upd(); } }; upd();
  $('#lround').onchange = e => { SET.round = Math.max(5, Math.min(100, +e.target.value || 20)); saveSet(); };
  const menu = () => {
    const d = dueIds(SET.src), n = newIds(SET.src);
    $('#lmenu').innerHTML = `
      <button data-m="mix"><span class="ic">↻</span><div><b>Gemischte Runde</b><small>${d.length} fällig + neue Wörter</small></div></button>
      <button data-m="new"><span class="ic">★</span><div><b>Nur neue Wörter</b><small>${n.length} noch nicht gesehen (häufigste zuerst)</small></div></button>
      <button data-m="due"><span class="ic">⟲</span><div><b>Nur Wiederholung</b><small>${d.length} fällige Karten</small></div></button>
      <button data-m="weak"><span class="ic">!</span><div><b>Schwache Wörter</b><small>Stufe 1–2</small></div></button>`;
    $('#lmenu').querySelectorAll('button').forEach(b => b.onclick = () => {
      const N = SET.round; let ids = [];
      if (b.dataset.m === 'new') ids = n.slice(0, N);
      else if (b.dataset.m === 'due') ids = d.slice(0, N);
      else if (b.dataset.m === 'weak') ids = shuffle(idsOfSource(SET.src).filter(i => { const l = lvOf(i); return l === 1 || l === 2; })).slice(0, N);
      else { ids = d.slice(0, Math.ceil(N * 0.6)); ids = ids.concat(n.slice(0, N - ids.length)); }
      if (!ids.length) return toast('Keine Karten in dieser Auswahl');
      go('cards', { ids: shuffle(ids), title: 'Karteikarten' });
    });
  };
  $('#lsrc').onchange = e => { SET.src = e.target.value; saveSet(); menu(); };
  menu();
};

R.cards = (arg) => {
  setTitle(arg.title || 'Karteikarten', true);
  const queue = arg.ids.slice(), total = queue.length; let done = 0, missed = new Set(), flipped = false, cur = null, front = 'ar';
  const next = () => {
    if (!queue.length) return finish();
    cur = queue[0]; flipped = false;
    front = SET.front === 'mix' ? (Math.random() < .5 ? 'ar' : 'de') : SET.front;
    render();
  };
  const render = () => {
    const e = W.get(cur);
    const lv = lvOf(cur);
    const fr = front === 'ar' ? `<div class="big ar">${esc(e.ar)}</div>` : `<div class="de">${esc(e.de)}</div><div class="muted small">${esc(catLabel(e))}</div>`;
    view.innerHTML = `
      <div class="row small muted"><span class="grow">${done} von ${total} gewusst</span><span>${queue.length} offen</span></div>
      <div class="progress"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
      ${!flipped ? `<div class="fc" id="fc"><span class="corner lv lv${lv}">${lv}</span>${fr}<span class="hint">Tippen zum Umdrehen</span></div>`
        : `<div class="panel detail">${detailHTML(e, { compact: true })}</div>`}
      ${flipped ? `<div class="answer-row"><button class="btn bad" id="no">✗ Nicht gewusst</button><button class="btn good" id="yes">✓ Gewusst</button></div>`
        : `<div class="answer-row"><button class="btn ghost" id="skip">Überspringen</button><button class="btn pri" id="flip">Umdrehen</button></div>`}`;
    if (!flipped) { $('#fc').onclick = $('#flip').onclick = () => { flipped = true; render(); }; $('#skip').onclick = () => { queue.push(queue.shift()); next(); }; }
    else { wireDetail(e); $('#yes').onclick = () => answer(true); $('#no').onclick = () => answer(false); }
  };
  const answer = ok => {
    const c = st(cur);
    c.n = (c.n || 0) + 1; c.ls = now(); if (!c.fs) c.fs = now();
    if (ok) { c.lv = Math.min(5, Math.max(1, c.lv || 0) + 1); queue.shift(); done++; }
    else { c.lv = 1; missed.add(cur); const x = queue.shift(); queue.splice(Math.min(3, queue.length), 0, x); }
    hist('cards'); save(); next();
  };
  const finish = () => {
    view.innerHTML = `<div class="panel" style="text-align:center"><h2>Runde geschafft</h2>
      <p>${total} Karten, davon ${total - missed.size} sofort gewusst.</p>
      ${missed.size ? `<p class="muted small">Wiederholt bis richtig: ${missed.size}</p>` : ''}
      <div class="row" style="justify-content:center"><button class="btn" id="again">Zurück</button><button class="btn pri" id="totest">Diese Wörter prüfen</button></div></div>`;
    $('#again').onclick = back;
    $('#totest').onclick = () => go('testrun', { ids: arg.ids.slice() });
  };
  next();
};

// ----- Detailansicht eines Wortes
function verseHTML(e) {
  const v = e.ex && DB.verses[e.ex]; if (!v) return '';
  const k = normAr(e.ar);
  const words = v.w.map((w, i) => {
    const hit = normAr(w).includes(k.slice(0, Math.max(2, k.length - 1)));
    return `<span><b class="${hit ? 'hit' : ''}">${esc(w)}</b><i>${esc(v.g[i])}</i></span>`;
  }).join('');
  return `<details ${'open'}><summary>Beispiel aus dem Quran (${e.ex.replace(':', ', Vers ').replace(/^/, 'Sure ')})</summary>
    <div class="verse"><div class="wbw">${words}</div>
    <div class="tr">${esc(v.de)}</div>
    <div class="ref">Wort für Wort: Grundbedeutung jedes Wortes, automatisch erzeugt. Übersetzung: Bubenheim/Elyas.</div></div></details>`;
}
function related(e) {
  if (!e.r) return [];
  return (ROOT.get(e.r.replace(/\s/g, '')) || []).filter(o => o.id !== e.id).sort((a, b) => (b.f || 0) - (a.f || 0));
}
function detailHTML(e, opt = {}) {
  const lv = lvOf(e.id);
  const chips = [`<span class="chip acc">${esc(catLabel(e))}</span>`];
  if (e.g) chips.push(`<span class="chip">${e.g === 'f' ? 'weiblich' : 'männlich'}</span>`);
  if (e.f) chips.push(`<span class="chip">${e.f}× im Quran</span>`);
  chips.push(`<span class="chip">Stufe <span class="lv lv${lv}">${lv}</span></span>`);
  if (lv) chips.push(`<span class="chip">Wiederholung: ${nextDue(e.id)}</span>`);
  let h = `<div class="head"><div class="big ar">${esc(e.ar)}</div><div class="de">${esc(e.de)}</div></div><div class="chips" style="justify-content:center">${chips.join('')}</div><dl class="kv">`;
  if (e.r) h += `<dt>Wurzel</dt><dd class="ar">${esc(e.r)}</dd>`;
  if (e.pl && e.pl.length) h += `<dt>Plural</dt><dd class="ar">${e.pl.map(esc).join(' ، ')}</dd>`;
  if (e.note) h += `<dt>Notiz</dt><dd>${esc(e.note)}</dd>`;
  h += `</dl>`;
  const rel = related(e);
  if (e.c === 'v') {
    h += `<button class="btn sm" id="showForms">Formen anzeigen: Mudāriʿ, Amr, Masdar, Stamm</button><div id="forms" hidden><div class="forms">
      <div><small>Mādī (Vergangenheit)</small><span class="ar">${esc(e.ar)}</span></div>
      <div><small>Mudāriʿ (Gegenwart)</small><span class="ar">${esc(e.m || '–')}</span></div>
      <div><small>Amr (Befehl)</small><span class="ar">${esc(e.a || '–')}</span></div>
      <div><small>Masdar (Verbalnomen)</small><span class="ar">${esc(e.ms || '–')}</span></div>
      </div><p class="small muted">Stamm: ${e.st ? esc(STEM[e.st]) : 'unbekannt'}</p>
      ${rel.length ? `<h2>Abgeleitete Wörter (gleiche Wurzel)</h2>${wlist(rel.filter(o => o.c !== 'v').slice(0, 30))}${rel.some(o => o.c === 'v') ? `<h2>Andere Verben der Wurzel</h2>${wlist(rel.filter(o => o.c === 'v').slice(0, 20))}` : ''}` : ''}</div>`;
  } else if (rel.length) {
    h += `<details ${opt.compact ? '' : 'open'}><summary>Verwandte Wörter (Wurzel ${esc(e.r)}) · ${rel.length}</summary>${wlist(rel.slice(0, 40))}</details>`;
  }
  h += verseHTML(e);
  const ls = (e.src || []).map(k => lessonById(k)).filter(Boolean);
  const q = QRANK.indexOf(String(e.id));
  if (q >= 0) ls.unshift({ t: 'Quran, Rang ' + (q + 1) });
  if (ls.length && !opt.compact) h += `<h2>Vorkommen</h2><div class="chips">${ls.map(l => `<span class="chip">${esc(l.t.replace(/:.*/, ''))}${l.k && l.k[0] === 'm' ? ' · Buch ' + l.k[1] : ''}</span>`).join('')}</div>`;
  h += `<div class="row" style="margin-top:12px"><button class="btn sm" id="editBtn">✎ Bearbeiten</button></div>`;
  return h;
}
function wlist(arr) {
  return `<ul class="wlist">${arr.map(o => `<li data-id="${o.id}"><span class="ar">${esc(o.ar)}</span><span class="de">${esc(o.de)}<br><span class="tp">${esc(catLabel(o))}</span></span><span class="lv lv${lvOf(o.id)}">${lvOf(o.id)}</span></li>`).join('')}</ul>`;
}
function wireDetail(e, root = view) {
  const sf = $('#showForms', root); if (sf) sf.onclick = () => { $('#forms', root).hidden = false; sf.hidden = true; };
  root.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
  const eb = $('#editBtn', root); if (eb) eb.onclick = () => openEdit(e);
}
function openWord(id) {
  const e = W.get(String(id)); if (!e) return;
  const m = $('#modal'), sh = $('#sheet');
  sh.innerHTML = `<div class="bar-top"><span class="muted small">Wort</span><button class="icon-btn" id="mclose">✕</button></div><div class="detail">${detailHTML(e)}</div>`;
  m.hidden = false; sh.scrollTop = 0;
  $('#mclose').onclick = () => m.hidden = true;
  wireDetail(e, sh);
}
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };

// ----- Bearbeiten / eigene Karten
function cardForm(e) {
  const v = k => esc(e[k] || '');
  return `
  <label>Arabisch (mit Harakat)</label><input type="text" class="ar-in" id="f_ar" value="${v('ar')}" dir="rtl">
  <label>Deutsche Bedeutung (mehrere mit ; trennen)</label><input type="text" id="f_de" value="${v('de')}">
  <label>Wortart</label><select id="f_c">${Object.entries(CAT).filter(([k]) => k !== 'own').map(([k, t]) => `<option value="${k}" ${e.c === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
  <label>Wurzel (z. B. ك ت ب)</label><input type="text" class="ar-in" id="f_r" value="${v('r')}" dir="rtl">
  <label>Geschlecht</label><select id="f_g"><option value="">–</option><option value="m" ${e.g === 'm' ? 'selected' : ''}>männlich</option><option value="f" ${e.g === 'f' ? 'selected' : ''}>weiblich</option></select>
  <label>Plural (mehrere mit ، oder , trennen)</label><input type="text" class="ar-in" id="f_pl" value="${esc((e.pl || []).join('، '))}" dir="rtl">
  <div id="vf"><label>Mudāriʿ</label><input type="text" class="ar-in" id="f_m" value="${v('m')}" dir="rtl">
  <label>Amr</label><input type="text" class="ar-in" id="f_a" value="${v('a')}" dir="rtl">
  <label>Masdar</label><input type="text" class="ar-in" id="f_ms" value="${v('ms')}" dir="rtl"></div>
  <label>Notiz</label><textarea id="f_note">${v('note')}</textarea>`;
}
function readForm() {
  const g = id => $('#' + id).value.trim();
  const o = { ar: g('f_ar'), de: g('f_de'), c: g('f_c'), r: g('f_r'), g: g('f_g'), m: g('f_m'), a: g('f_a'), ms: g('f_ms'), note: g('f_note') };
  o.pl = g('f_pl') ? g('f_pl').split(/[،,]/).map(s => s.trim()).filter(Boolean) : [];
  if (o.r && !/\s/.test(o.r)) o.r = [...o.r].join(' ');
  return o;
}
function openEdit(e) {
  const m = $('#modal'), sh = $('#sheet');
  sh.innerHTML = `<div class="bar-top"><b>Karte bearbeiten</b><button class="icon-btn" id="mclose">✕</button></div>${cardForm(e)}
   <div class="row" style="margin-top:14px"><button class="btn pri grow" id="fsave">Speichern</button>${e.own ? '<button class="btn bad" id="fdel">Löschen</button>' : (EDIT[e.id] ? '<button class="btn" id="freset">Original</button>' : '')}</div>`;
  m.hidden = false; sh.scrollTop = 0;
  $('#mclose').onclick = () => m.hidden = true;
  $('#fsave').onclick = () => {
    const o = readForm(); if (!o.ar || !o.de) return toast('Arabisch und Deutsch ausfüllen');
    if (e.own) { const i = OWN.findIndex(x => x.id === e.id); OWN[i] = Object.assign({ id: e.id }, o); LS.set('own', OWN); }
    else {
      const orig = DB.entries.find(x => x.id === e.id) || {}; const d = {};
      for (const k of Object.keys(o)) { const a = JSON.stringify(o[k] || (k === 'pl' ? [] : '')), b = JSON.stringify(orig[k] || (k === 'pl' ? [] : '')); if (a !== b) d[k] = o[k]; }
      if (Object.keys(d).length) EDIT[e.id] = d; else delete EDIT[e.id];
      LS.set('edit', EDIT);
    }
    buildIndex(); m.hidden = true; toast('Gespeichert'); const p = stack[stack.length - 1]; if (p) go(p[0], p[1], false);
  };
  const fd = $('#fdel'); if (fd) fd.onclick = () => { if (!confirm('Karte wirklich löschen?')) return; OWN = OWN.filter(x => x.id !== e.id); LS.set('own', OWN); delete S.c[e.id]; save(); buildIndex(); m.hidden = true; go('own', null, false); };
  const fr = $('#freset'); if (fr) fr.onclick = () => { delete EDIT[e.id]; LS.set('edit', EDIT); buildIndex(); m.hidden = true; toast('Original wiederhergestellt'); const p = stack[stack.length - 1]; if (p) go(p[0], p[1], false); };
}
R.own = () => {
  setTitle('Eigene Karten', true); tabs('');
  const list = OWN.map(o => W.get(String(o.id))).filter(Boolean);
  view.innerHTML = `<button class="btn pri block" id="add">＋ Neue Karte</button>
   ${list.length ? `<div class="panel" style="margin-top:12px">${wlist(list)}</div><button class="btn block" id="learnOwn">Eigene Karten lernen</button>` : '<p class="empty">Noch keine eigenen Karten. Eigene Karten werden in Lernen und Prüfung mit einbezogen.</p>'}`;
  view.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
  const lo = $('#learnOwn'); if (lo) lo.onclick = () => go('cards', { ids: shuffle(list.map(e => String(e.id))), title: 'Eigene Karten' });
  $('#add').onclick = () => {
    const m = $('#modal'), sh = $('#sheet');
    sh.innerHTML = `<div class="bar-top"><b>Neue Karte</b><button class="icon-btn" id="mclose">✕</button></div>${cardForm({ c: 'n' })}<button class="btn pri block" style="margin-top:14px" id="fsave">Hinzufügen</button>`;
    m.hidden = false; $('#mclose').onclick = () => m.hidden = true;
    $('#fsave').onclick = () => {
      const o = readForm(); if (!o.ar || !o.de) return toast('Arabisch und Deutsch ausfüllen');
      o.id = 'u' + Date.now().toString(36); OWN.push(o); LS.set('own', OWN); buildIndex(); m.hidden = true; toast('Karte hinzugefügt'); go('own', null, false);
    };
  };
};

// ----- Prüfung
function testPool() {
  // alle je gesehenen Wörter + eigene Karten
  const ids = [...W.keys()].filter(i => lvOf(i) > 0 || W.get(i).own);
  return ids;
}
function pickTest(ids, N) {
  const t = now();
  const sc = ids.map(i => {
    const c = S.c[i] || { lv: 0 };
    let g;
    if (!c.lt) g = 0;                      // noch nie geprüft
    else if (c.lr === 0) g = 1;            // zuletzt falsch
    else g = 2 + (c.lv || 0);              // nach Stufe
    return { i, g, t: c.lt || 0, lv: c.lv || 0, r: Math.random() };
  });
  // Stufe 5 seltener: nur ein Teil kommt in Frage
  let pool = sc.filter(x => x.lv < 5 || x.r < 0.3 || x.g <= 1);
  if (pool.length < N) pool = sc;
  pool.sort((a, b) => a.g - b.g || a.t - b.t || a.r - b.r);   // neu/falsch zuerst, kürzlich richtig zuletzt
  return pool.slice(0, N).map(x => x.i);
}
R.test = () => {
  tabs('test'); setTitle('Prüfung', stack.length > 1);
  const pool = testPool();
  view.innerHTML = `<div class="panel">
    <p>Geprüft werden alle Wörter, die du schon gesehen hast (${pool.length}), und deine eigenen Karten. Neue und zuletzt falsche Wörter kommen zuerst, Wörter auf Stufe 5 seltener.</p>
    <label>Anzahl Fragen</label><input type="number" id="tn" min="5" max="200" value="${SET.testN}">
    <label>Richtung</label><div class="seg" id="tdir"><button data-v="mix">Zufällig</button><button data-v="ar">Arabisch → Deutsch</button><button data-v="de">Deutsch → Arabisch</button></div>
  </div><button class="btn pri block" id="start" ${pool.length ? '' : 'disabled'}>Prüfung starten</button>
  ${pool.length ? '' : '<p class="empty">Lerne zuerst ein paar Karteikarten, dann kannst du sie hier prüfen.</p>'}
  <p class="muted small">Arabisch tippst du ohne Harakat. أ/إ/ا, ة/ه und ى/ي werden gleich gewertet. Bei Deutsch reicht eine Bedeutung, Groß- und Kleinschreibung ist egal.</p>`;
  SET.tdir = SET.tdir || 'mix';
  const seg = $('#tdir'); const upd = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === SET.tdir));
  seg.onclick = e => { if (e.target.dataset.v) { SET.tdir = e.target.dataset.v; saveSet(); upd(); } }; upd();
  $('#tn').onchange = e => { SET.testN = Math.max(5, Math.min(200, +e.target.value || 20)); saveSet(); };
  $('#start').onclick = () => go('testrun', { ids: pickTest(pool, SET.testN) });
};
R.testrun = (arg) => {
  setTitle('Prüfung', true);
  const qs = arg.ids.map(i => ({ id: i, dir: SET.tdir === 'mix' || !SET.tdir ? (Math.random() < .5 ? 'ar' : 'de') : SET.tdir }));
  let k = 0, right = 0, wrongs = [];
  const ask = () => {
    if (k >= qs.length) return end();
    const q = qs[k], e = W.get(q.id);
    const prompt = q.dir === 'ar' ? `<div class="dir">Was heißt das auf Deutsch?</div><div class="big ar">${esc(e.ar)}</div>`
      : `<div class="dir">Wie heißt das auf Arabisch?</div><div class="de">${esc(e.de)}</div><div class="muted small">${esc(catLabel(e))}${e.c === 'v' ? ' · Mādī-Form' : ''}</div>`;
    view.innerHTML = `<div class="row small muted"><span class="grow">Frage ${k + 1} von ${qs.length}</span><span>${right} richtig</span></div>
      <div class="progress"><i style="width:${k / qs.length * 100}%"></i></div>
      <div class="panel q">${prompt}</div>
      <form id="tf" autocomplete="off"><input type="text" id="ans" ${q.dir === 'de' ? 'class="ar-in" dir="rtl" lang="ar" placeholder="اكتب هنا"' : 'placeholder="Antwort eingeben" lang="de"'} autocapitalize="off" autocorrect="off" spellcheck="false">
      <div class="answer-row"><button type="button" class="btn ghost" id="dunno">Weiß ich nicht</button><button class="btn pri">Prüfen</button></div></form><div id="res"></div>`;
    const inp = $('#ans'); setTimeout(() => inp.focus(), 50);
    const check = (given) => {
      const ok = given !== null && (q.dir === 'ar' ? deMatch(given, e.de) : arMatch(given, e));
      const c = st(q.id); const prev = Object.assign({}, c);
      c.lt = now(); c.lr = ok ? 1 : 0; c.tn = (c.tn || 0) + 1;
      if (ok) { c.lv = Math.min(5, Math.max(1, c.lv || 0) + 1); c.tr = (c.tr || 0) + 1; right++; }
      else { c.lv = Math.max(1, (c.lv || 1) - 1); c.tw = (c.tw || 0) + 1; wrongs.push(q.id); }
      if (!c.ls) c.ls = now();
      hist('tq'); if (ok) hist('tr'); save();
      $('#tf').hidden = true;
      const sol = `<div class="sol"><span class="ar">${esc(e.ar)}</span> – ${esc(e.de)}</div>${e.pl && e.pl.length ? `<div class="small muted">Plural: <span class="ar" style="font-size:20px">${e.pl.map(esc).join(' ، ')}</span></div>` : ''}`;
      $('#res').innerHTML = `<div class="result ${ok ? 'ok' : 'no'}"><b>${ok ? '✓ Richtig' : '✗ Leider falsch'}</b>${!ok && given ? `<div class="small">Deine Antwort: ${esc(given)}</div>` : ''}${sol}</div>
        <div class="answer-row">${ok ? '<button class="btn" id="info">Details</button>' : '<button class="btn" id="right">Ich hatte doch recht</button>'}<button class="btn pri" id="nx">Weiter</button></div>`;
      $('#nx').onclick = () => { k++; ask(); };
      const ib = $('#info'); if (ib) ib.onclick = () => openWord(q.id);
      const rb = $('#right'); if (rb) rb.onclick = () => {
        const c2 = st(q.id); c2.lv = Math.min(5, Math.max(1, prev.lv || 0) + 1); c2.lr = 1; c2.tw = prev.tw || 0; c2.tr = (prev.tr || 0) + 1;
        right++; wrongs = wrongs.filter(x => x !== q.id); hist('tr'); save();
        $('#res').querySelector('.result').className = 'result ok'; $('#res').querySelector('.result b').textContent = '✓ Als richtig gewertet';
        rb.remove();
      };
      $('#nx').focus();
    };
    $('#tf').onsubmit = ev => { ev.preventDefault(); if (!inp.value.trim()) return; check(inp.value.trim()); };
    $('#dunno').onclick = () => check(null);
  };
  const end = () => {
    S.tests = (S.tests || 0) + 1; save();
    view.innerHTML = `<div class="panel" style="text-align:center"><h2>Prüfung beendet</h2><p style="font-size:28px;margin:6px 0"><b>${right}</b> / ${qs.length}</p>
      <p class="muted">${Math.round(right / qs.length * 100)} % richtig</p></div>
      ${wrongs.length ? `<h2>Falsch beantwortet</h2><div class="panel">${wlist(wrongs.map(i => W.get(i)))}</div><button class="btn block" id="lw">Falsche Wörter als Karteikarten lernen</button>` : ''}
      <button class="btn pri block" style="margin-top:10px" id="again">Neue Prüfung</button>`;
    view.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
    const lw = $('#lw'); if (lw) lw.onclick = () => go('cards', { ids: wrongs.slice(), title: 'Falsche Wörter' });
    $('#again').onclick = () => { stack = []; go('test'); };
  };
  ask();
};

// ----- Plural-Training
function plSt(id) { const c = st(id); c.p = c.p || { lv: 0 }; return c.p; }
R.plural = () => {
  tabs('plural'); setTitle('Plural-Training', stack.length > 1);
  const all = idsOfSource(SET.src).filter(i => { const e = W.get(i); return e.pl && e.pl.length && e.c !== 'v' && e.c !== 'p'; });
  const seen = all.filter(i => lvOf(i) > 0);
  view.innerHTML = `<div class="panel"><label>Quelle</label>${srcSelect('psrc', SET.src)}
    <p class="small muted">${all.length} Wörter mit Plural, davon ${seen.length} schon gesehen. Zuerst kommen gesehene Wörter, dann die häufigsten.</p>
    <label>Anzahl</label><input type="number" id="pn" min="5" max="100" value="${SET.plN}"></div>
    <div class="menu"><button id="plearn"><span class="ic">🂠</span><div><b>Plural lernen</b><small>Einzahl sehen, Mehrzahl aufdecken</small></div></button>
    <button id="ptest"><span class="ic">✎</span><div><b>Plural prüfen</b><small>Mehrzahl eintippen</small></div></button></div>`;
  $('#psrc').onchange = e => { SET.src = e.target.value; saveSet(); go('plural', null, false); };
  $('#pn').onchange = e => { SET.plN = Math.max(5, Math.min(100, +e.target.value || 15)); saveSet(); };
  const pick = () => {
    const rest = all.filter(i => lvOf(i) === 0).sort((a, b) => (W.get(b).f || 0) - (W.get(a).f || 0));
    const s = seen.slice().sort((a, b) => { const x = (S.c[a].p || {}), y = (S.c[b].p || {}); return (x.lv || 0) - (y.lv || 0) || (x.t || 0) - (y.t || 0); });
    return s.concat(rest).slice(0, SET.plN);
  };
  $('#plearn').onclick = () => { const ids = pick(); if (!ids.length) return toast('Keine Wörter mit Plural'); go('plcards', { ids: shuffle(ids) }); };
  $('#ptest').onclick = () => { const ids = pick(); if (!ids.length) return toast('Keine Wörter mit Plural'); go('pltest', { ids: shuffle(ids) }); };
};
R.plcards = (arg) => {
  setTitle('Plural lernen', true);
  const queue = arg.ids.slice(), total = queue.length; let done = 0, flipped = false;
  const render = () => {
    if (!queue.length) { view.innerHTML = `<div class="panel" style="text-align:center"><h2>Fertig</h2><p>${total} Plurale wiederholt.</p><button class="btn pri" id="pt">Jetzt prüfen</button></div>`; $('#pt').onclick = () => go('pltest', { ids: shuffle(arg.ids.slice()) }); return; }
    const e = W.get(queue[0]), p = (S.c[queue[0]] || {}).p || { lv: 0 };
    view.innerHTML = `<div class="row small muted"><span class="grow">${done} von ${total}</span></div><div class="progress"><i style="width:${done / total * 100}%"></i></div>
     <div class="fc" id="fc"><span class="corner lv lv${p.lv}">${p.lv}</span><div class="muted small">Einzahl</div><div class="big ar">${esc(e.ar)}</div><div class="muted">${esc(e.de)}</div>
     ${flipped ? `<div class="muted small" style="margin-top:8px">Mehrzahl</div><div class="big ar" style="color:var(--acc)">${e.pl.map(esc).join(' ، ')}</div>` : '<span class="hint">Tippen für die Mehrzahl</span>'}</div>
     ${flipped ? `<div class="answer-row"><button class="btn bad" id="no">✗ Nicht gewusst</button><button class="btn good" id="yes">✓ Gewusst</button></div>` : `<div class="answer-row"><span></span><button class="btn pri" id="flip">Aufdecken</button></div>`}`;
    if (!flipped) $('#fc').onclick = $('#flip').onclick = () => { flipped = true; render(); };
    else {
      $('#yes').onclick = () => { const p = plSt(queue[0]); p.lv = Math.min(5, Math.max(1, p.lv) + 1); p.t = now(); queue.shift(); done++; flipped = false; save(); render(); };
      $('#no').onclick = () => { const p = plSt(queue[0]); p.lv = 1; p.t = now(); const x = queue.shift(); queue.splice(Math.min(3, queue.length), 0, x); flipped = false; save(); render(); };
    }
  };
  render();
};
R.pltest = (arg) => {
  setTitle('Plural prüfen', true);
  let k = 0, right = 0;
  const ask = () => {
    if (k >= arg.ids.length) { view.innerHTML = `<div class="panel" style="text-align:center"><h2>Plural-Prüfung beendet</h2><p style="font-size:28px"><b>${right}</b> / ${arg.ids.length}</p></div><button class="btn pri block" id="ag">Zurück</button>`; $('#ag').onclick = () => { stack = []; go('plural'); }; return; }
    const id = arg.ids[k], e = W.get(id);
    view.innerHTML = `<div class="row small muted"><span class="grow">Frage ${k + 1} von ${arg.ids.length}</span><span>${right} richtig</span></div><div class="progress"><i style="width:${k / arg.ids.length * 100}%"></i></div>
     <div class="panel q"><div class="dir">Wie lautet die Mehrzahl?</div><div class="big ar">${esc(e.ar)}</div><div class="muted">${esc(e.de)}</div></div>
     <form id="tf" autocomplete="off"><input type="text" id="ans" class="ar-in" dir="rtl" lang="ar" placeholder="الجمع" autocapitalize="off" autocorrect="off" spellcheck="false">
     <div class="answer-row"><button type="button" class="btn ghost" id="dunno">Weiß ich nicht</button><button class="btn pri">Prüfen</button></div></form><div id="res"></div>`;
    const inp = $('#ans'); setTimeout(() => inp.focus(), 50);
    const check = g => {
      const ok = g !== null && e.pl.some(p => normAr(p) === normAr(g));
      const p = plSt(id); const prev = p.lv; p.t = now();
      if (ok) { p.lv = Math.min(5, Math.max(1, p.lv) + 1); right++; } else p.lv = Math.max(1, (p.lv || 1) - 1);
      save(); $('#tf').hidden = true;
      $('#res').innerHTML = `<div class="result ${ok ? 'ok' : 'no'}"><b>${ok ? '✓ Richtig' : '✗ Leider falsch'}</b>${!ok && g ? `<div class="small">Deine Antwort: <span class="ar">${esc(g)}</span></div>` : ''}<div class="sol"><span class="ar">${esc(e.ar)}</span> → <span class="ar">${e.pl.map(esc).join(' ، ')}</span></div></div>
        <div class="answer-row">${ok ? '<span></span>' : '<button class="btn" id="right">Ich hatte doch recht</button>'}<button class="btn pri" id="nx">Weiter</button></div>`;
      $('#nx').onclick = () => { k++; ask(); };
      const rb = $('#right'); if (rb) rb.onclick = () => { const p2 = plSt(id); p2.lv = Math.min(5, Math.max(1, prev) + 1); right++; save(); $('#res .result').className = 'result ok'; $('#res .result b').textContent = '✓ Als richtig gewertet'; rb.remove(); };
    };
    $('#tf').onsubmit = ev => { ev.preventDefault(); if (inp.value.trim()) check(inp.value.trim()); };
    $('#dunno').onclick = () => check(null);
  };
  ask();
};

// ----- Wortschatz (Quellen, Lektionen, Suche)
function progBar(ids) {
  const n = ids.length || 1; const c = [0, 0, 0, 0, 0, 0]; ids.forEach(i => c[lvOf(i)]++);
  return `<div class="mini">${[5, 4, 3, 2, 1].map(l => `<i style="width:${c[l] / n * 100}%;background:var(--l${l})"></i>`).join('')}</div>`;
}
R.browse = () => {
  tabs('browse'); setTitle('Wortschatz', stack.length > 1);
  view.innerHTML = `<input type="text" id="q" placeholder="Suchen (Arabisch oder Deutsch)" autocomplete="off"><div id="sr"></div>
   <div id="srcs">${SRC.map(s => { const ids = idsOfSource(s.k); return `<div class="lesson" data-k="${s.k}"><div class="t"><b>${esc(s.t)}</b><div class="small muted">${ids.length} Wörter · ${ids.filter(i => lvOf(i) > 0).length} gesehen · ${ids.filter(i => lvOf(i) >= 5).length} gelernt</div>${progBar(ids)}</div><span class="p">›</span></div>`; }).join('')}</div>
   <p class="small muted">Die Zuordnung der Wörter zu den Lektionen der Medina-Bücher ist ungefähr. Quran-Wörter sind nach Häufigkeit geordnet.</p>`;
  view.querySelectorAll('#srcs .lesson').forEach(d => d.onclick = () => go('source', d.dataset.k));
  let tm; $('#q').oninput = e => { clearTimeout(tm); tm = setTimeout(() => search(e.target.value), 200); };
};
function search(q) {
  const out = $('#sr'); q = q.trim(); if (q.length < 2) { out.innerHTML = ''; $('#srcs').hidden = false; return; }
  $('#srcs').hidden = true;
  const isAr = /[؀-ۿ]/.test(q); const nq = isAr ? normAr(q) : normDe(q);
  const res = [];
  for (const e of W.values()) {
    if (isAr ? normAr(e.ar).includes(nq) || (e.pl || []).some(p => normAr(p).includes(nq)) || (e.r && normAr(e.r) === nq) : normDe(e.de).includes(nq)) res.push(e);
  }
  res.sort((a, b) => {
    const ea = isAr ? normAr(a.ar) === nq : meanings(a.de).includes(nq), eb = isAr ? normAr(b.ar) === nq : meanings(b.de).includes(nq);
    return (eb - ea) || (b.f || 0) - (a.f || 0);
  });
  out.innerHTML = res.length ? `<p class="small muted">${res.length} Treffer</p><div class="panel">${wlist(res.slice(0, 80))}</div>` : '<p class="empty">Nichts gefunden</p>';
  out.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
}
R.source = (k) => {
  const s = SRC.find(x => x.k === k); setTitle(s.t, true); tabs('browse');
  view.innerHTML = s.l.map(l => `<div class="lesson" data-k="${l.k}"><div class="t">${esc(l.t)}<div class="small muted">${l.ids.length} Wörter · ${l.ids.filter(i => lvOf(i) >= 5).length} gelernt</div>${progBar(l.ids)}</div><span class="p">›</span></div>`).join('') || '<p class="empty">Leer</p>';
  view.querySelectorAll('.lesson').forEach(d => d.onclick = () => go('lesson', d.dataset.k));
  if (k === 'own') { view.innerHTML += '<button class="btn block" style="margin-top:12px" id="ow">Eigene Karten verwalten</button>'; $('#ow').onclick = () => go('own'); }
};
R.lesson = (k) => {
  const l = lessonById(k); setTitle(l.t.replace(/^Lektion (\d+):.*/, 'Lektion $1'), true); tabs('browse');
  const ids = l.ids.slice();
  view.innerHTML = `<p class="muted small">${esc(l.t)}</p><div class="row"><button class="btn pri grow" id="ll">Lernen</button><button class="btn grow" id="lt">Prüfen</button></div>
   <div class="panel" style="margin-top:12px">${wlist(ids.map(i => W.get(i)).filter(Boolean))}</div>`;
  view.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
  $('#ll').onclick = () => { const unk = ids.filter(i => lvOf(i) < 5); go('cards', { ids: shuffle(unk.length ? unk : ids.slice()).slice(0, Math.max(SET.round, 30)), title: 'Lektion lernen' }); };
  $('#lt').onclick = () => go('testrun', { ids: pickTest(ids, Math.min(ids.length, SET.testN)) });
};

// ----- Statistik
R.stats = () => {
  setTitle('Statistik', true); tabs('');
  const ids = [...W.keys()]; const c = [0, 0, 0, 0, 0, 0]; ids.forEach(i => c[lvOf(i)]++);
  const seen = ids.length - c[0];
  let tq = 0, tr = 0; Object.values(S.hist).forEach(h => { tq += h.tq || 0; tr += h.tr || 0; });
  const days = []; for (let d = 13; d >= 0; d--) { const k = new Date(Date.now() - d * DAY).toISOString().slice(0, 10); const h = S.hist[k] || {}; days.push({ k, n: (h.cards || 0) + (h.tq || 0) }); }
  const mx = Math.max(1, ...days.map(d => d.n));
  const streak = streakDays();
  const plSeen = ids.filter(i => S.c[i] && S.c[i].p && S.c[i].p.lv > 0).length, plLearn = ids.filter(i => S.c[i] && S.c[i].p && S.c[i].p.lv >= 5).length;
  view.innerHTML = `
   <div class="tiles"><div class="tile"><b>${seen}</b><span>gesehen</span></div><div class="tile"><b>${c[5]}</b><span>gelernt</span></div><div class="tile"><b>${streak}</b><span>Tage in Folge</span></div></div>
   <div class="panel"><h2>Quran-Abdeckung</h2><p>Die Wörter, die du kennst (ab Stufe 3), machen <b>${coverage().toFixed(1).replace('.', ',')} %</b> aller Wörter im Quran aus.</p><p class="small muted">Tipp: Lerne nach Häufigkeit. Die häufigsten 300 Wörter decken schon rund zwei Drittel des Textes ab.</p></div>
   <div class="panel"><h2>Stufen</h2><div class="bars">${[1, 2, 3, 4, 5].map(l => `<div class="bar"><span>Stufe ${l}</span><span class="tr"><i style="width:${seen ? c[l] / seen * 100 : 0}%;background:var(--l${l})"></i></span><span>${c[l]}</span></div>`).join('')}</div>
   <p class="small muted">Noch nicht gesehen: ${c[0]} von ${ids.length} Wörtern.</p></div>
   <div class="panel"><h2>Prüfungen</h2><p>${S.tests || 0} Prüfungen, ${tq} Fragen, davon ${tr} richtig${tq ? ` (${Math.round(tr / tq * 100)} %)` : ''}.</p>
   <p class="small muted">Plural: ${plSeen} geübt, ${plLearn} auf Stufe 5.</p></div>
   <div class="panel"><h2>Letzte 14 Tage</h2><div class="spark">${days.map(d => `<div title="${d.k}: ${d.n}" style="height:${d.n / mx * 100}%"></div>`).join('')}</div><div class="spark-l"><span>vor 13 Tagen</span><span>heute</span></div></div>
   <div class="panel"><h2>Nach Quelle</h2>${SRC.map(s => { const x = idsOfSource(s.k); if (!x.length) return ''; return `<div style="margin:8px 0"><div class="row small"><span class="grow">${esc(s.t)}</span><span class="muted">${x.filter(i => lvOf(i) >= 5).length} / ${x.length} gelernt</span></div>${progBar(x)}</div>`; }).join('')}</div>`;
};

// ----- Einstellungen
R.settings = () => {
  setTitle('Einstellungen', true); tabs('');
  view.innerHTML = `<div class="panel"><label>Darstellung</label><div class="seg" id="th"><button data-v="dark">Dunkel</button><button data-v="light">Hell</button></div>
   <label>Vorderseite der Karteikarten</label><div class="seg" id="fr"><button data-v="ar">Arabisch</button><button data-v="de">Deutsch</button><button data-v="mix">Gemischt</button></div>
   <label>Karten pro Runde</label><input type="number" id="sr1" min="5" max="100" value="${SET.round}">
   <label>Fragen pro Prüfung</label><input type="number" id="sr2" min="5" max="200" value="${SET.testN}">
   <label>Tagesziel (Karten + Prüfungsfragen pro Tag)</label><input type="number" id="sr3" min="5" max="500" value="${SET.goal}"></div>
   <div class="panel"><h2>Über die Daten</h2><p class="small">Quran-Wortschatz: alle Lemmata des Quranic Arabic Corpus (Morphologie), deutsche Bedeutungen von Hand erstellt, Beispielverse mit der Übersetzung von Bubenheim/Elyas. Medina-Bücher 1–3 und Fusha-Grundwortschatz: Auswahl nach Lektionsthemen, die Zuordnung ist ungefähr. Fehler kannst du über „Bearbeiten“ an jeder Karte selbst korrigieren.</p>
   <p class="small muted">Dein Lernstand wird nur auf diesem Gerät im Browser gespeichert. Wer die App über den Link öffnet, hat seinen eigenen Lernstand.</p></div>
   <div class="panel"><h2>Sicherung</h2><div class="row"><button class="btn sm" id="bk">Lernstand sichern (Datei)</button><button class="btn sm" id="rs">Sicherung laden</button><input type="file" id="rf" accept=".json" hidden></div></div>
   <button class="btn bad block" id="reset">Lernstand zurücksetzen</button>`;
  const segs = [['th', 'theme', applyTheme], ['fr', 'front']];
  for (const [id, key, cb] of segs) {
    const el = $('#' + id); const upd = () => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === SET[key]));
    el.onclick = e => { if (e.target.dataset.v) { SET[key] = e.target.dataset.v; saveSet(); upd(); cb && cb(); } }; upd();
  }
  $('#sr1').onchange = e => { SET.round = Math.max(5, Math.min(100, +e.target.value || 20)); saveSet(); };
  $('#sr2').onchange = e => { SET.testN = Math.max(5, Math.min(200, +e.target.value || 20)); saveSet(); };
  $('#sr3').onchange = e => { SET.goal = Math.max(5, Math.min(500, +e.target.value || 20)); saveSet(); };
  $('#reset').onclick = () => { if (confirm('Wirklich den ganzen Lernstand löschen? Eigene Karten bleiben erhalten.')) { S = { c: {}, hist: {}, tests: 0 }; save(); toast('Lernstand gelöscht'); go('home'); } };
  $('#bk').onclick = () => {
    const blob = new Blob([JSON.stringify({ state: S, own: OWN, edit: EDIT, set: SET })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vokabeln-sicherung-' + today() + '.json'; a.click();
  };
  $('#rs').onclick = () => $('#rf').click();
  $('#rf').onchange = async e => {
    try { const d = JSON.parse(await e.target.files[0].text()); if (!d.state) throw 0; S = d.state; OWN = d.own || []; EDIT = d.edit || {}; save(); LS.set('own', OWN); LS.set('edit', EDIT); buildIndex(); toast('Sicherung geladen'); go('home'); }
    catch (x) { toast('Datei konnte nicht gelesen werden'); }
  };
};
function applyTheme() { document.documentElement.dataset.theme = SET.theme === 'light' ? 'light' : 'dark'; document.querySelector('meta[name=theme-color]').content = SET.theme === 'light' ? '#f4f1ea' : '#11161c'; }

// ---------- Start ----------
applyTheme();
fetch('data.json').then(r => r.json()).then(d => { DB = d; buildIndex(); go('home'); })
  .catch(() => { view.innerHTML = '<p class="empty">Der Wortschatz konnte nicht geladen werden. Bitte einmal mit Internetverbindung öffnen.</p>'; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
