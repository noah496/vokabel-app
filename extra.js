'use strict';
/* Quran-Leser, Hadith-Bereich, Suche – nutzt die Hilfen aus app.js */

let Q = null, QH = null, QP = null;
const AIDX = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
function loadJSON(url) { return fetch(url).then(r => { if (!r.ok) throw 0; return r.json(); }); }
function needQ(cb) {
  if (Q) return cb();
  view.innerHTML = '<p class="loading">Quran wird geladen …</p>';
  loadJSON('quran.json').then(d => {
    Q = d; Q.first = []; let a = 0; Q.su.forEach(s => { Q.first.push(a); a += s[2]; }); Q.n = a;
    Q.ref = new Array(a); Q.su.forEach((s, i) => { for (let k = 0; k < s[2]; k++) Q.ref[Q.first[i] + k] = [i + 1, k + 1]; });
    Q.pageOf = new Array(a); let p = 0; for (let i = 0; i < a; i++) { while (p + 1 < Q.pg.length && Q.pg[p + 1] <= i) p++; Q.pageOf[i] = p + 1; }
    cb();
  }).catch(() => { view.innerHTML = '<p class="empty">Der Quran konnte nicht geladen werden. Bitte einmal mit Internetverbindung öffnen.</p>'; });
}
function needH(cb) {
  if (QH) return cb();
  view.innerHTML = '<p class="loading">Hadithe werden geladen …</p>';
  loadJSON('hadith.json').then(d => { QH = d; cb(); })
    .catch(() => { view.innerHTML = '<p class="empty">Die Hadithe konnten nicht geladen werden. Bitte einmal mit Internetverbindung öffnen.</p>'; });
}
const uniq = a => [...new Set(a.filter(Boolean).map(String))].filter(i => W.has(i));
const byFreq = ids => ids.sort((a, b) => (W.get(b).f || 0) - (W.get(a).f || 0));

// ----- Wortgruppe (Sure, Seite, Hadith) lernen
R.wordset = (arg) => {
  setTitle(arg.t, true);
  const ids = arg.ids.slice(); const lv5 = ids.filter(i => lvOf(i) >= 5).length;
  view.innerHTML = `<p class="muted small">${ids.length} Wörter · ${ids.filter(i => lvOf(i) > 0).length} gesehen · ${lv5} gelernt</p>${progBar(ids)}
   <div class="row" style="margin-top:10px"><button class="btn pri grow" id="ll">Lernen</button><button class="btn grow" id="lt">Prüfen</button></div>
   <div class="panel" style="margin-top:12px">${wlist(ids.map(i => W.get(i)))}</div>`;
  view.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
  $('#ll').onclick = () => { const unk = ids.filter(i => lvOf(i) < 5); go('cards', { ids: shuffle((unk.length ? unk : ids).slice(0, Math.max(SET.round, 30))), title: arg.t }); };
  $('#lt').onclick = () => go('testrun', { ids: pickTest(ids, Math.min(ids.length, SET.testN)) });
};

// ----- Quran: Übersicht
R.quran = () => {
  tabs('quran'); setTitle('Quran', stack.length > 1);
  needQ(() => {
    const last = SET.qlast;
    view.innerHTML = `<div class="row"><input type="text" id="qf" placeholder="Sure suchen (Name oder Nummer)" autocomplete="off" class="grow"><input type="number" id="qpg" min="1" max="604" placeholder="Seite" style="width:96px"></div>
     ${last ? `<button class="btn block" id="qcont" style="margin-top:10px">Weiterlesen: ${esc(Q.su[last[0] - 1][1])}, Seite ${last[1]}</button>` : ''}
     <div id="ql" class="panel" style="margin-top:10px"></div>
     <p class="small muted">Text: Ḥafṣ ʿan ʿĀṣim, Madina-Mushaf (King Fahd Complex, Uthmanic Hafs v3), abgeglichen mit zwei weiteren Textquellen. Übersetzung: Bubenheim/Elyas. Wort für Wort: eigene Übersetzung, passend zur jeweiligen Stelle.</p>`;
    const list = f => {
      f = (f || '').trim().toLowerCase();
      $('#ql').innerHTML = `<ul class="wlist">${Q.su.map((s, i) => [s, i]).filter(([s, i]) => !f || String(i + 1) === f || s[1].toLowerCase().includes(f) || normAr(s[0]).includes(normAr(f))).map(([s, i]) => {
        const ids = surahIds(i + 1); const l = ids.filter(x => lvOf(x) >= 5).length;
        return `<li data-s="${i + 1}"><span class="num">${i + 1}</span><span class="de">${esc(s[1])}<br><span class="tp">${s[2]} Verse · ${s[3] === 'd' ? 'medinensisch' : 'mekkanisch'} · ${l}/${ids.length} Wörter gelernt</span></span><span class="ar" style="min-width:auto">${esc(s[0])}</span></li>`;
      }).join('')}</ul>`;
      $('#ql').querySelectorAll('li').forEach(li => li.onclick = () => go('surah', { s: +li.dataset.s }));
    };
    list(); $('#qf').oninput = e => list(e.target.value);
    $('#qpg').onchange = e => { const p = Math.max(1, Math.min(604, +e.target.value || 1)); const a = Q.pg[p - 1]; go('surah', { s: Q.ref[a][0], page: p }); };
    const qc = $('#qcont'); if (qc) qc.onclick = () => go('surah', { s: last[0], page: last[1] });
  });
};
function surahRange(s) { const a = Q.first[s - 1]; return [a, a + Q.su[s - 1][2]]; }
function ayahIds(ai) { return Q.c[ai]; }
function surahIds(s) { const [a, b] = surahRange(s); const r = []; for (let i = a; i < b; i++) r.push(...Q.c[i]); return byFreq(uniq(r)); }
function pageRange(p) { return [Q.pg[p - 1], p < Q.pg.length ? Q.pg[p] : Q.n]; }
function pageIds(p, s) { const [a, b] = pageRange(p); const r = []; for (let i = a; i < b; i++) if (!s || Q.ref[i][0] === s) r.push(...Q.c[i]); return byFreq(uniq(r)); }

// ----- Quran: Sure lesen
R.surah = (arg) => {
  tabs('quran');
  needQ(() => {
    const s = arg.s, su = Q.su[s - 1]; setTitle(`${s}. ${su[1]}`, true);
    const [a, b] = surahRange(s);
    const pages = []; for (let i = a; i < b; i++) { const p = Q.pageOf[i]; if (!pages.length || pages[pages.length - 1].p !== p) pages.push({ p, from: i, to: i + 1 }); else pages[pages.length - 1].to = i + 1; }
    const multi = pages.length > 1;
    const sIds = surahIds(s);
    const basm = s !== 1 && s !== 9 ? `<div class="basm qtext">${esc(Q.w[0])}</div>` : '';
    const ay = i => {
      const ws = Q.w[i].split(' '), gs = Q.g[i].split('|'), cs = Q.c[i]; const [, n] = Q.ref[i];
      let wi = 0;
      const words = ws.map(w => {
        if (w === '۞') return `<span class="qw mark">۞</span>`;
        const k = wi++;
        return `<span class="qw" data-a="${i}" data-w="${k}"><b>${esc(w)}</b>${SET.qwbw ? `<i>${esc(gs[k] || '')}</i>` : ''}</span>`;
      }).join('');
      return `<div class="ayah ${SET.qwbw ? 'wbwmode' : ''}" id="a${i}"><div class="qtext">${words}<span class="aend">${'۝' + AIDX(n)}</span></div>${SET.qtr ? `<div class="tr"><b>${n}</b> ${esc(Q.t[i])}</div>` : ''}</div>`;
    };
    view.innerHTML = `<div class="surah-head"><div class="ar qname">${esc(su[0])}</div><div class="small muted">${su[2]} Verse · ${su[3] === 'd' ? 'medinensisch' : 'mekkanisch'} · Seite ${pages[0].p}${multi ? '–' + pages[pages.length - 1].p : ''}</div></div>
      <div class="row"><button class="btn sm grow" id="sl">Wörter dieser Sure lernen (${sIds.length})</button></div>
      <div class="seg" id="qopt" style="margin-top:10px"><button data-v="wbw" class="${SET.qwbw ? 'on' : ''}">Wort für Wort</button><button data-v="tr" class="${SET.qtr ? 'on' : ''}">Übersetzung</button></div>
      ${basm}
      ${pages.map(pg => `${multi ? `<div class="pagehead" id="p${pg.p}"><span>Seite ${pg.p}</span><button class="btn sm" data-pl="${pg.p}">Seite lernen</button></div>` : ''}${Array.from({ length: pg.to - pg.from }, (_, k) => ay(pg.from + k)).join('')}`).join('')}
      <div class="row" style="margin:14px 0">${s > 1 ? `<button class="btn grow" id="prev">‹ ${esc(Q.su[s - 2][1])}</button>` : ''}${s < 114 ? `<button class="btn grow" id="next">${esc(Q.su[s][1])} ›</button>` : ''}</div>`;
    $('#sl').onclick = () => go('wordset', { t: `Sure ${su[1]}`, ids: sIds });
    view.querySelectorAll('[data-pl]').forEach(bn => bn.onclick = () => { const p = +bn.dataset.pl; go('wordset', { t: `${su[1]}, Seite ${p}`, ids: pageIds(p, s) }); });
    $('#qopt').onclick = e => { const v = e.target.dataset.v; if (!v) return; if (v === 'wbw') SET.qwbw = !SET.qwbw; else SET.qtr = !SET.qtr; saveSet(); go('surah', { s, page: currentPage() }, false); };
    view.querySelectorAll('.qw[data-a]').forEach(el => el.onclick = () => openQWord(+el.dataset.a, +el.dataset.w));
    const pv = $('#prev'); if (pv) pv.onclick = () => go('surah', { s: s - 1 }, false);
    const nx = $('#next'); if (nx) nx.onclick = () => go('surah', { s: s + 1 }, false);
    const currentPage = () => { let p = pages[0].p; for (const pg of pages) { const el = $('#p' + pg.p); if (el && el.getBoundingClientRect().top < 120) p = pg.p; } return p; };
    if (arg.page && multi) { const el = $('#p' + arg.page); if (el) setTimeout(() => el.scrollIntoView(), 30); }
    let tm; const onScroll = () => { clearTimeout(tm); tm = setTimeout(() => { SET.qlast = [s, currentPage()]; saveSet(); }, 400); };
    window.addEventListener('scroll', onScroll, { passive: true }); SET.qlast = [s, arg.page || pages[0].p]; saveSet();
    cleanup = () => window.removeEventListener('scroll', onScroll);
  });
};
function openQWord(ai, wi) {
  const w = Q.w[ai].split(' ').filter(x => x !== '۞')[wi], g = Q.g[ai].split('|')[wi], id = Q.c[ai][wi], [s, n] = Q.ref[ai];
  const e = id ? W.get(String(id)) : null;
  const m = $('#modal'), sh = $('#sheet');
  sh.innerHTML = `<div class="bar-top"><span class="muted small">Sure ${s}, Vers ${n}, Wort ${wi + 1}</span><button class="icon-btn" id="mclose">✕</button></div>
    <div class="head" style="text-align:center"><div class="qtext big1">${esc(w)}</div><div class="de" style="font-size:20px;font-weight:600">${esc(g || '–')}</div><div class="small muted">Bedeutung an dieser Stelle</div></div>
    ${e ? `<div class="panel" style="margin-top:12px"><div class="small muted">Vokabelkarte (Grundform)</div>${wlist([e])}<div class="row" style="margin-top:8px"><button class="btn sm grow" id="wl">Diese Karte lernen</button></div></div>` : '<p class="small muted">Zu diesem Wort gibt es keine eigene Karte (z. B. Partikel als Teil des Wortes).</p>'}
    <div class="verse"><div class="tr">${esc(Q.t[ai])}</div><div class="ref">Übersetzung: Bubenheim/Elyas</div></div>`;
  m.hidden = false; sh.scrollTop = 0;
  $('#mclose').onclick = () => m.hidden = true;
  sh.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
  const wl = $('#wl'); if (wl) wl.onclick = () => { m.hidden = true; go('cards', { ids: [String(id)], title: 'Karteikarte' }); };
}

// ----- Hadith
R.hadith = () => {
  tabs(''); setTitle('Hadithe', stack.length > 1);
  needH(() => {
    view.innerHTML = QH.works.map(wk => {
      const ids = uniq(wk.books.flatMap(b => b.h.flatMap(k => QH.h[k].c)));
      return `<div class="lesson" data-k="${wk.k}"><div class="t"><b>${esc(wk.t)}</b> <span class="ar">${esc(wk.ta)}</span><div class="small muted">${wk.books.reduce((a, b) => a + b.h.length, 0)} Hadithe · ${ids.length} Wörter · ${ids.filter(i => lvOf(i) >= 5).length} gelernt</div>${progBar(ids)}</div><span class="p">›</span></div>`;
    }).join('') + `<p class="small muted">Arabischer Text vollständig vokalisiert, nur der Matn mit dem überliefernden Prophetengefährten. Deutsche Übersetzung und Wort für Wort: eigene Übersetzung, unabhängig geprüft.</p>`;
    view.querySelectorAll('.lesson').forEach(d => d.onclick = () => go('hwork', d.dataset.k));
  });
};
R.hwork = (k) => {
  tabs('');
  needH(() => {
    const wk = QH.works.find(w => w.k === k); setTitle(wk.t, true);
    const one = wk.books.length === 1;
    view.innerHTML = wk.books.map((b, bi) => `${one ? '' : `<h2><span class="ar" style="font-size:22px">${esc(b.ta)}</span> · ${esc(b.t)}</h2>`}
      ${one ? '' : `<button class="btn sm" data-bl="${bi}">Wörter dieses Kapitels lernen</button>`}
      <ul class="wlist panel">${b.h.map(key => { const h = QH.h[key]; return `<li data-h="${key}"><span class="num">${h.n}</span><span class="de">${esc(h.de.slice(0, 90))}${h.de.length > 90 ? '…' : ''}</span></li>`; }).join('')}</ul>`).join('');
    view.querySelectorAll('[data-h]').forEach(li => li.onclick = () => go('hview', li.dataset.h));
    view.querySelectorAll('[data-bl]').forEach(bn => bn.onclick = () => { const b = wk.books[+bn.dataset.bl]; go('wordset', { t: b.t, ids: byFreq(uniq(b.h.flatMap(x => QH.h[x].c))) }); });
  });
};
R.hview = (key) => {
  tabs('');
  needH(() => {
    const h = QH.h[key], wk = QH.works.find(w => w.books.some(b => b.h.includes(key))); setTitle(`${wk.short} ${h.n}`, true);
    const ids = byFreq(uniq(h.c));
    const words = h.w.map((w, i) => h.g[i] === null ? `<span class="hp">${esc(w)}</span>` : `<span class="qw" data-i="${i}"><b>${esc(w)}</b>${SET.qwbw ? `<i>${esc(h.g[i])}</i>` : ''}</span>`).join('');
    view.innerHTML = `${h.sec ? `<div class="small muted ar" style="text-align:right;font-size:18px">${esc(h.sec)}</div>` : ''}
      <div class="seg" id="qopt"><button data-v="wbw" class="${SET.qwbw ? 'on' : ''}">Wort für Wort</button></div>
      <div class="ayah ${SET.qwbw ? 'wbwmode' : ''}"><div class="htext">${words}</div></div>
      <div class="panel"><h2>Übersetzung</h2><p>${esc(h.de)}</p></div>
      <button class="btn pri block" id="hl">Wörter dieses Hadith lernen (${ids.length})</button>
      <div class="row" style="margin:12px 0">${h.prev ? '<button class="btn grow" id="prev">‹ Vorheriger</button>' : ''}${h.next ? '<button class="btn grow" id="next">Nächster ›</button>' : ''}</div>`;
    $('#qopt').onclick = () => { SET.qwbw = !SET.qwbw; saveSet(); go('hview', key, false); };
    $('#hl').onclick = () => go('wordset', { t: `${wk.short} ${h.n}`, ids });
    view.querySelectorAll('.qw').forEach(el => el.onclick = () => {
      const i = +el.dataset.i, id = h.c[i], e = id ? W.get(String(id)) : null; const m = $('#modal'), sh = $('#sheet');
      sh.innerHTML = `<div class="bar-top"><span class="muted small">${esc(wk.short)} ${h.n}</span><button class="icon-btn" id="mclose">✕</button></div>
        <div class="head" style="text-align:center"><div class="ar big1">${esc(h.w[i])}</div><div style="font-size:20px;font-weight:600">${esc(h.g[i])}</div><div class="small muted">Bedeutung an dieser Stelle</div></div>
        ${e ? `<div class="panel" style="margin-top:12px">${wlist([e])}</div>` : ''}`;
      m.hidden = false; $('#mclose').onclick = () => m.hidden = true;
      sh.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
    });
    const pv = $('#prev'); if (pv) pv.onclick = () => go('hview', h.prev, false);
    const nx = $('#next'); if (nx) nx.onclick = () => go('hview', h.next, false);
  });
};

// ----- Suche: Wörter, Quranverse, Hadithe
R.search = () => {
  tabs(''); setTitle('Suche', true);
  view.innerHTML = `<input type="text" id="sq" placeholder="Arabisch oder Deutsch" autocomplete="off">
    <div class="seg" id="sk" style="margin-top:8px"><button data-v="w" class="on">Wörter</button><button data-v="q">Quran</button><button data-v="h">Hadith</button></div><div id="sres"></div>`;
  let kind = 'w', tm;
  const run = () => {
    const q = $('#sq').value.trim(), out = $('#sres');
    if (q.length < 2) { out.innerHTML = ''; return; }
    const isAr = /[؀-ۿ]/.test(q), nq = isAr ? normAr(q).replace(/^ال/, '') : normDe(q);
    if (kind === 'w') {
      const res = [];
      for (const e of W.values()) if (isAr ? normAr(e.ar).includes(nq) || (e.pl || []).some(p => normAr(p).includes(nq)) || (e.r && normAr(e.r) === nq) : normDe(e.de).includes(nq)) res.push(e);
      res.sort((a, b) => ((isAr ? normAr(b.ar) === nq : meanings(b.de).includes(nq)) - (isAr ? normAr(a.ar) === nq : meanings(a.de).includes(nq))) || (b.f || 0) - (a.f || 0));
      out.innerHTML = res.length ? `<p class="small muted">${res.length} Treffer</p><div class="panel">${wlist(res.slice(0, 100))}</div>` : '<p class="empty">Nichts gefunden</p>';
      out.querySelectorAll('.wlist li').forEach(li => li.onclick = () => openWord(li.dataset.id));
    } else if (kind === 'q') {
      needQ(() => {
        R.search.restore && R.search.restore();
        const hits = [];
        for (let i = 0; i < Q.n && hits.length < 200; i++) if (isAr ? normAr(Q.im[i]).includes(normAr(q)) || Q.im[i].split(' ').some(x => normAr(x) === nq) : normDe(Q.t[i]).includes(nq)) hits.push(i);
        $('#sres').innerHTML = hits.length ? `<p class="small muted">${hits.length >= 200 ? 'mehr als 200' : hits.length} Verse</p>${hits.map(i => `<div class="lesson" data-a="${i}"><div class="t"><div class="small muted">${esc(Q.su[Q.ref[i][0] - 1][1])} ${Q.ref[i][0]}:${Q.ref[i][1]}</div><div class="qtext" style="font-size:22px">${esc(Q.w[i])}</div><div class="small">${esc(Q.t[i])}</div></div></div>`).join('')}` : '<p class="empty">Kein Vers gefunden</p>';
        $('#sres').querySelectorAll('[data-a]').forEach(d => d.onclick = () => { const i = +d.dataset.a; go('surah', { s: Q.ref[i][0], page: Q.pageOf[i] }); });
      });
    } else {
      needH(() => {
        R.search.restore && R.search.restore();
        const hits = Object.entries(QH.h).filter(([k, h]) => isAr ? normAr(h.w.join(' ')).includes(normAr(q)) : normDe(h.de).includes(nq)).slice(0, 100);
        $('#sres').innerHTML = hits.length ? hits.map(([k, h]) => `<div class="lesson" data-h="${k}"><div class="t"><b>${esc(QH.works.find(w => w.k === k[0].toLowerCase()).short)} ${h.n}</b><div class="small">${esc(h.de.slice(0, 140))}…</div></div></div>`).join('') : '<p class="empty">Kein Hadith gefunden</p>';
        $('#sres').querySelectorAll('[data-h]').forEach(d => d.onclick = () => go('hview', d.dataset.h));
      });
    }
  };
  // needQ/needH ersetzen beim ersten Laden kurz die Ansicht; danach Suchmaske wiederherstellen
  const html = view.innerHTML;
  R.search.restore = () => { if (!$('#sq')) { const q = R.search.q; view.innerHTML = html; wire(); $('#sq').value = q || ''; $('#sk').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === kind)); } };
  const wire = () => {
    $('#sq').oninput = () => { R.search.q = $('#sq').value; clearTimeout(tm); tm = setTimeout(run, 250); };
    $('#sk').onclick = e => { const v = e.target.dataset.v; if (!v) return; kind = v; $('#sk').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); run(); };
  };
  wire(); setTimeout(() => $('#sq').focus(), 50);
};
