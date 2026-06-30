// Shared "guess the film/series" engine for the Cine* guessing games. It powers
// CineCast and CinePlot (and could power CineClue too). Each page sets
//   window.CINE_GAME = { mode, salt, stateKey, streakKey, page, emoji, name, shareUrl }
// before loading this; `mode` selects which progressive clues are built. Requires
// window.CINECLUE_POOL (the daily pool) and lib/media.js (movie/TV normalisation).
(function () {
  'use strict';
  const CFG = window.CINE_GAME || {};
  const MODE = CFG.mode || 'clue';
  const SALT = CFG.salt | 0;
  const STATE_KEY = CFG.stateKey || 'cineguessState';
  const STREAK_KEY = CFG.streakKey || 'cineguessStreak';
  const PAGE = CFG.page || 'cineclue.html';
  const EMOJI = CFG.emoji || '🎬';
  const NAME = CFG.name || 'CineGuess';
  const SHARE_URL = CFG.shareUrl || 'https://cinelinks.vercel.app/' + PAGE;

  const IMGBASE = 'https://image.tmdb.org/t/p/';
  const EPOCH = Math.floor(Date.UTC(2026, 5, 23) / 86400000); // #1 = 2026-06-23
  const MAX_GUESSES = 6;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function api(path) { return fetch('/api/tmdb?path=' + path).then(r => r.json()); }
  function dayNumber() { const n = new Date(); return Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000); }
  function poster(p, size) { return p ? IMGBASE + (size || 'w342') + p : ''; }
  function maskTitle(text, title) {
    if (!text || !title) return text || '';
    const words = title.split(/\s+/).filter(w => w.length >= 4);
    let out = text;
    for (const w of words) { out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▒▒▒'); }
    return out;
  }
  // Heuristic spoiler masking (no AI): hide the title's words AND the main
  // characters' names (full phrase + distinctive ≥5-char tokens) so a synopsis
  // doesn't give the answer away via a recognisable character name.
  function maskSpoilers(text, title, characters) {
    if (!text) return '';
    let terms = [];
    String(title || '').split(/\s+/).forEach(w => { if (w.length >= 4) terms.push(w); });
    (characters || []).forEach(ch => {
      if (!ch || ch.length < 3) return;
      terms.push(ch);
      ch.split(/\s+/).forEach(w => { if (w.length >= 5) terms.push(w); });
    });
    terms = Array.from(new Set(terms)).sort((a, b) => b.length - a.length);
    let out = text;
    for (const t of terms) { out = out.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▒▒▒'); }
    return out;
  }
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800); }

  const DAY = dayNumber();
  const PUZZLE = DAY - EPOCH + 1;
  const PRACTICE = new URLSearchParams(location.search).get('practice') === '1';
  const RAND_START = Math.floor(Math.random() * 100003);
  let target = null, clues = [], stage = 0, results = [], finished = false, solved = false;

  function poolCandidates(base, n) {
    const pool = window.CINECLUE_POOL || [];
    const out = [];
    for (let i = 0; i < n && pool.length; i++) out.push(Media.parseEntry(pool[(((base + i) % pool.length) + pool.length) % pool.length]));
    return out;
  }
  // Practice = endless pool: a random page of recognisable titles from TMDB
  // Discover (same quality bar as the curated pool). Falls back to the fixed pool.
  async function practiceCandidates() {
    if (window.Pool) {
      try {
        const wantTv = Math.random() < 0.25;
        const data = await api(wantTv ? Pool.practiceTv() : Pool.practiceMovie());
        const results = (data && data.results) || [];
        if (results.length) {
          const type = wantTv ? 'tv' : 'movie';
          return results.slice().sort(() => Math.random() - 0.5).slice(0, 8).map(m => ({ type: type, id: m.id }));
        }
      } catch (_) {}
    }
    return poolCandidates(Math.floor(Math.random() * 100003), 8);
  }

  async function loadTarget() {
    const candidates = PRACTICE ? await practiceCandidates() : poolCandidates(DAY + SALT, 8);
    if (!candidates.length) throw new Error('empty pool');
    for (const { type, id } of candidates) {
      try {
        const [d, kw, cr] = await Promise.all([
          api(Media.detailPath(type, id)),
          api(Media.keywordsPath(type, id)),
          api(Media.creditsPath(type, id))
        ]);
        if (d && d.id && Media.title(d, type)) return { d, kw, cr, id, type };
      } catch (_) {}
    }
    throw new Error('could not load any target');
  }

  function clueBody(s) { return '<span class="clue-body">' + (s ? esc(s) : '—') + '</span>'; }
  function posterCanvas(pUrl, blur) { return pUrl ? '<canvas class="clue-poster" width="300" height="450" data-url="' + pUrl + '" data-blur="' + blur + '"></canvas>' : clueBody('No poster'); }
  function castChar(c) {
    const ch = c.character || (c.roles && c.roles[0] && c.roles[0].character) || '';
    return esc(c.name) + (ch ? ' <span style="color:#8d8d8d">as ' + esc(ch) + '</span>' : '');
  }
  // A cast clue: actor headshot (plain img — the name is shown anyway, so it's a
  // clue, not a leak) + name + character.
  function castClueHtml(c) {
    const ph = c.profile_path ? (IMGBASE + 'w185' + c.profile_path) : '';
    const avatar = ph
      ? '<img src="' + ph + '" alt="" referrerpolicy="no-referrer" style="width:58px;height:58px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#222">'
      : '<span style="width:58px;height:58px;border-radius:50%;background:#222;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:#666;font-weight:800">?</span>';
    return '<div style="display:flex;align-items:center;gap:12px">' + avatar + '<span class="clue-body">' + castChar(c) + '</span></div>';
  }

  // ── Clue strategies ──────────────────────────────────────────────────────
  function cluesClue(t) {
    const ttl = Media.title(t.d, t.type), yr = Media.year(t.d, t.type);
    const genres = (t.d.genres || []).map(g => g.name).join(', ');
    const lengthL = Media.lengthLabel(t.d, t.type);
    const kws = (t.kw.keywords || t.kw.results || []).slice(0, 5).map(k => k.name);
    const cast = (t.cr.cast || []).slice(0, 3).map(c => c.name);
    const makers = Media.makers(t.d, t.cr, t.type).join(', ');
    const tagline = t.d.tagline || '';
    const pUrl = poster(t.d.poster_path, 'w342');
    return [
      { label: 'Keywords', html: kws.length ? kws.map(k => '<span class="clue-chip">' + esc(k) + '</span>').join('') : clueBody('No keywords — free one 🙂') },
      { label: Media.mediumLabel(t.type) + ' · Genre · Year', html: clueBody([Media.mediumLabel(t.type), genres, yr, lengthL].filter(Boolean).join('  ·  ')) },
      { label: makers ? (Media.makerLabel(t.type) + (tagline ? ' · Tagline' : '')) : 'Tagline', html: '<span class="clue-body">' + esc(makers) + (tagline ? ' — <em>"' + esc(maskTitle(tagline, ttl)) + '"</em>' : '') + '</span>' },
      { label: 'Main cast', html: clueBody(cast.join(', ')) },
      { label: 'Poster (blurred)', html: posterCanvas(pUrl, 16) },
      { label: 'Poster', html: posterCanvas(pUrl, 5) }
    ];
  }

  // CineCast: reveal the cast obscure → famous, ending on the leads. Difficulty:
  // start deep in the billing (supporting players) with NAMES ONLY so a famous
  // headshot can't give it away instantly; headshots arrive on the 3rd reveal as
  // the puzzle eases, and the final poster stays heavily blurred (a hint, not a
  // giveaway — the clear poster shows only on the result screen).
  function cluesCast(t) {
    const yr = Media.year(t.d, t.type);
    const genres = (t.d.genres || []).map(g => g.name).join(', ');
    const pUrl = poster(t.d.poster_path, 'w342');
    const top = (t.cr.cast || []).filter(c => c.name).slice(0, 8); // billing order: 0 = lead
    const seq = top.slice().reverse();                              // obscure → famous
    const out = [];
    seq.slice(0, 4).forEach((c, i) => {
      const withPhoto = i >= 2; // first two reveals are text-only
      out.push({
        label: i === 0 ? 'A supporting cast member' : 'Another cast member',
        html: withPhoto ? castClueHtml(c) : ('<span class="clue-body">' + castChar(c) + '</span>')
      });
    });
    out.push({ label: Media.mediumLabel(t.type) + ' · Genre · Year', html: clueBody([Media.mediumLabel(t.type), genres, yr].filter(Boolean).join('  ·  ')) });
    out.push({ label: 'Top billing' + (pUrl ? ' · Poster (blurred)' : ''), html: clueBody(top.slice(0, 3).map(c => c.name).join(', ')) + posterCanvas(pUrl, 14) });
    return out.length ? out : [{ label: 'No cast on TMDB', html: posterCanvas(pUrl, 12) }];
  }

  // CinePlot: reveal the synopsis (title masked) growing each clue, then cast & poster.
  function cluesPlot(t) {
    const ttl = Media.title(t.d, t.type), yr = Media.year(t.d, t.type);
    const genres = (t.d.genres || []).map(g => g.name).join(', ');
    const cast = (t.cr.cast || []).slice(0, 3).map(c => c.name);
    const pUrl = poster(t.d.poster_path, 'w342');
    const chars = (t.cr.cast || []).slice(0, 8)
      .map(c => c.character || (c.roles && c.roles[0] && c.roles[0].character) || '')
      .filter(Boolean);
    const ov = maskSpoilers(t.d.overview || '', ttl, chars);
    const frac = p => { if (!ov) return ''; const n = Math.max(20, Math.round(ov.length * p)); return ov.slice(0, n) + (n < ov.length ? '…' : ''); };
    return [
      { label: 'Synopsis (opening)', html: clueBody(ov ? frac(0.25) : 'No synopsis on TMDB') },
      { label: 'Synopsis', html: clueBody(ov ? frac(0.5) : '—') },
      { label: Media.mediumLabel(t.type) + ' · Genre · Year', html: clueBody([Media.mediumLabel(t.type), genres, yr].filter(Boolean).join('  ·  ')) },
      { label: 'Full synopsis', html: clueBody(ov || '—') },
      { label: 'Main cast', html: clueBody(cast.join(', ')) },
      { label: 'Poster', html: posterCanvas(pUrl, 6) }
    ];
  }

  function buildClues(t) {
    if (MODE === 'cast') return cluesCast(t);
    if (MODE === 'plot') return cluesPlot(t);
    return cluesClue(t);
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function renderPips() {
    const el = document.getElementById('pips');
    let h = '';
    for (let i = 0; i < MAX_GUESSES; i++) {
      let cls = 'pip';
      if (i < results.length) cls += ' ' + results[i];
      else if (solved && i === results.length) cls += ' win';
      else if (i === results.length && !finished) cls += ' current';
      h += '<div class="' + cls + '"></div>';
    }
    el.innerHTML = h;
  }
  function coverFit(iw, ih, w, h, over) {
    const ir = iw / ih, cr = w / h; let dw, dh;
    if (ir > cr) { dh = h * over; dw = dh * ir; } else { dw = w * over; dh = dw / ir; }
    return { dw, dh, dx: (w - dw) / 2, dy: (h - dh) / 2 };
  }
  function drawBlurred(canvas, url, blurPx) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (blurPx > 0 && typeof ctx.filter !== 'undefined') {
        ctx.filter = 'blur(' + blurPx + 'px)';
        const f = coverFit(img.width, img.height, w, h, 1 + blurPx / 22);
        ctx.drawImage(img, f.dx, f.dy, f.dw, f.dh);
        ctx.filter = 'none';
      } else if (blurPx > 0) {
        const scale = Math.max(0.015, 1 / (blurPx * 1.3));
        const tw = Math.max(2, Math.round(w * scale)), th = Math.max(2, Math.round(h * scale));
        const off = document.createElement('canvas'); off.width = tw; off.height = th;
        const octx = off.getContext('2d');
        const fo = coverFit(img.width, img.height, tw, th, 1);
        octx.drawImage(img, fo.dx, fo.dy, fo.dw, fo.dh);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(off, 0, 0, tw, th, 0, 0, w, h);
      } else {
        const f = coverFit(img.width, img.height, w, h, 1);
        ctx.drawImage(img, f.dx, f.dy, f.dw, f.dh);
      }
    };
    img.onerror = () => {};
    img.src = url;
  }
  function renderClues() {
    const el = document.getElementById('clues');
    el.innerHTML = clues.slice(0, stage + 1).map((c, i) =>
      '<div class="clue' + (i === stage ? ' fx-in' : '') + '"><div class="clue-label">' + esc(c.label) + '</div>' + c.html + '</div>'
    ).join('');
    el.querySelectorAll('canvas[data-url]').forEach(c => drawBlurred(c, c.dataset.url, +c.dataset.blur));
  }
  function renderGuesses() {
    const el = document.getElementById('guesses');
    el.innerHTML = results.filter(r => r !== 'win').map(r =>
      '<div class="grow wrong"><span class="gico">' + (r === 'skip' ? '⏭️' : '❌') + '</span>' +
      (r === 'skip' ? 'Skipped a clue' : 'Wrong guess') + '</div>'
    ).join('');
  }

  function advance(kind) {
    results.push(kind);
    if (results.length >= MAX_GUESSES) { finish(false); return; }
    stage = Math.min(stage + 1, clues.length - 1);
    renderPips(); renderClues(); renderGuesses(); save();
  }
  function makeGuess(movie) {
    if (finished) return;
    if (Media.sameTarget(movie, target)) { finish(true); return; }
    toast('Not it — next clue revealed');
    if (window.Fx) Fx.play(document.getElementById('guessInput'), 'fx-shake', 450);
    advance('wrong');
  }
  function skip() { if (!finished) advance('skip'); }
  function finish(win) {
    finished = true; solved = win;
    document.getElementById('play').style.display = 'none';
    if (win) results = results.concat(['win']);
    const streak = updateStreak(win);
    renderPips();
    renderResult(streak);
    save();
    try { if (win && window.Collection && target) { var _nc = window.Collection.add([{ id: target.id, type: target.type || 'movie', name: target.title, img: target.posterPath }]); if (_nc && _nc.length && window.Collection.reveal) setTimeout(function () { window.Collection.reveal(_nc); }, 500); } } catch (_) { /* noop */ }
    try { var _g = (CFG.stateKey || 'cineguess').replace(/State$/, ''); if (window.Track) window.Track(_g + '_complete', { win: win ? 1 : 0 }); } catch (_) { /* noop */ }
  }

  function emojiGrid() {
    let g = '', used = 0;
    for (const r of results) { g += (r === 'win' ? '🟩' : r === 'skip' ? '🟨' : '🟥'); used++; }
    for (let i = used; i < MAX_GUESSES; i++) g += '⬛';
    return g;
  }
  function renderResult(streak) {
    const el = document.getElementById('result');
    el.classList.remove('hidden');
    // Cinematic touch: the film's backdrop behind the card, heavily darkened so
    // text stays readable. No layout change — it's just the card background.
    if (target.backdropPath) {
      el.style.backgroundImage = 'linear-gradient(180deg,rgba(22,22,22,.86),rgba(22,22,22,.97)),url(' + IMGBASE + 'w780' + target.backdropPath + ')';
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
    const verdict = solved
      ? '<div class="result-verdict win">Solved in ' + (results.indexOf('win') + 1) + '!</div>'
      : '<div class="result-verdict lose">Out of guesses</div>';
    const bestPart = streak.best > streak.current ? ' · best <strong>' + streak.best + '</strong>' : '';
    const streakLine = PRACTICE ? '' : '<div class="result-streak">🔥 Streak <strong>' + streak.current + '</strong>' + bestPart + '</div>';
    const actions = PRACTICE
      ? '<button class="btn btn-gold" id="againBtn">New title</button><button class="btn" id="shareBtn">Share</button>'
      : '<button class="btn btn-gold" id="shareBtn">Share</button><a class="btn" href="/" style="display:flex;align-items:center;justify-content:center;text-decoration:none">CineLinks</a>';
    el.innerHTML =
      (target.posterPath ? '<img class="result-poster" src="' + poster(target.posterPath, 'w342') + '" alt="">' : '') +
      verdict +
      '<div class="result-film">' + esc(target.title) + '</div>' +
      '<div class="result-year">' + esc([target.year, target.genres].filter(Boolean).join('  ·  ')) + '</div>' +
      '<div class="result-grid">' + emojiGrid() + '</div>' +
      streakLine +
      '<div class="result-actions">' + actions + '</div>';
    // Polish: card entrance, poster pop, and a confetti burst on a win.
    el.classList.add('fx-in');
    const pst = el.querySelector('.result-poster'); if (pst) pst.classList.add('fx-poster');
    if (solved) {
      const v = el.querySelector('.result-verdict'); if (v) v.classList.add('fx-win');
      if (window.Fx) setTimeout(() => Fx.confetti({ count: 90 }), 120);
    }
    document.getElementById('shareBtn').onclick = share;
    const again = document.getElementById('againBtn');
    if (again) again.onclick = () => { location.href = PAGE + '?practice=1&n=' + Date.now(); };
  }

  function shareText() {
    const n = solved ? (results.indexOf('win') + 1) : 'X';
    const head = PRACTICE ? (EMOJI + ' ' + NAME + ' (Practice)') : (EMOJI + ' ' + NAME + ' #' + PUZZLE);
    const st = (!PRACTICE && solved) ? loadStreak() : null;
    const streak = (st && st.current > 1) ? '  🔥' + st.current : '';
    return head + '  ' + n + '/' + MAX_GUESSES + streak + '\n' + emojiGrid() + '\n' + SHARE_URL;
  }
  function share() {
    const text = shareText();
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard')).catch(() => toast(text)); }
    else toast('Copy: ' + text);
  }

  function loadStreak() { try { const s = JSON.parse(localStorage.getItem(STREAK_KEY)); if (s) return { current: s.current | 0, best: s.best | 0, last: s.last | 0 }; } catch (_) {} return { current: 0, best: 0, last: 0 }; }
  function updateStreak(win) {
    if (PRACTICE) return loadStreak();
    const s = loadStreak();
    if (s.last === DAY) return s;
    if (win) { s.current = (s.last === DAY - 1) ? s.current + 1 : 1; s.best = Math.max(s.best, s.current); }
    else { s.current = 0; }
    s.last = DAY;
    try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch (_) {}
    return s;
  }
  function save() {
    if (PRACTICE) return;
    var s = { day: DAY, results: results, stage: stage, finished: finished, solved: solved };
    if (finished && target) s.answer = { title: target.title, poster: target.posterPath };
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (_) {}
  }
  function restore() {
    if (PRACTICE) return false;
    try {
      const s = JSON.parse(localStorage.getItem(STATE_KEY));
      if (s && s.day === DAY) { results = s.results || []; stage = s.stage || 0; finished = !!s.finished; solved = !!s.solved; return true; }
    } catch (_) {}
    return false;
  }

  let suggestItems = [], activeIdx = -1, searchTimer = null;
  function onInput() {
    const q = document.getElementById('guessInput').value.trim();
    document.getElementById('guessBtn').disabled = !q;
    clearTimeout(searchTimer);
    if (q.length < 2) { closeSuggest(); return; }
    searchTimer = setTimeout(() => doSearch(q), 240);
  }
  async function doSearch(q) {
    try {
      const data = await api('search/multi&query=' + encodeURIComponent(q));
      suggestItems = (data.results || []).map(Media.searchMap).filter(Boolean).slice(0, 6);
      renderSuggest();
    } catch (_) { closeSuggest(); }
  }
  function renderSuggest() {
    const el = document.getElementById('suggest');
    if (!suggestItems.length) { closeSuggest(); return; }
    activeIdx = -1;
    el.innerHTML = suggestItems.map((m, i) =>
      '<div class="suggest-item" data-i="' + i + '">' +
        (m.poster ? '<img class="suggest-thumb" src="' + poster(m.poster, 'w92') + '" alt="">' : '<div class="suggest-thumb"></div>') +
        '<div><div class="suggest-name">' + esc(m.title) + '</div><div class="suggest-year">' + esc([m.year, m.type === 'tv' ? 'TV' : ''].filter(Boolean).join(' · ')) + '</div></div>' +
      '</div>'
    ).join('');
    el.classList.add('open');
    el.querySelectorAll('.suggest-item').forEach(node => { node.onclick = () => pick(suggestItems[+node.dataset.i]); });
  }
  function closeSuggest() { suggestItems = []; activeIdx = -1; document.getElementById('suggest').classList.remove('open'); }
  function pick(m) { closeSuggest(); const inp = document.getElementById('guessInput'); inp.value = ''; document.getElementById('guessBtn').disabled = true; makeGuess(m); }
  function submitTyped() {
    if (activeIdx >= 0 && suggestItems[activeIdx]) { pick(suggestItems[activeIdx]); return; }
    if (suggestItems.length) { pick(suggestItems[0]); return; }
    toast('Pick a title from the list');
  }
  function highlight() { document.querySelectorAll('.suggest-item').forEach((n, i) => n.classList.toggle('active', i === activeIdx)); }

  function showError() { document.getElementById('loading').style.display = 'none'; document.getElementById('error').style.display = 'block'; }

  async function init() {
    document.getElementById('dateBadge').textContent = PRACTICE ? 'Practice' : ('Daily #' + PUZZLE);
    const sw = document.getElementById('modeSwitch');
    if (sw) { sw.textContent = PRACTICE ? 'Daily →' : 'Practice →'; sw.href = PRACTICE ? PAGE : (PAGE + '?practice=1'); }
    let t;
    try { t = await loadTarget(); } catch (e) { showError(); return; }
    target = { id: t.d.id, type: t.type, title: Media.title(t.d, t.type), year: Media.year(t.d, t.type), posterPath: t.d.poster_path, backdropPath: t.d.backdrop_path, genres: (t.d.genres || []).slice(0, 3).map(g => g.name).join(' · ') };
    clues = buildClues(t);

    const had = restore();
    if (!had) { stage = 0; results = []; finished = false; solved = false; }
    if (finished && solved && results.indexOf('win') === -1) results.push('win');

    document.getElementById('loading').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    renderPips(); renderClues(); renderGuesses();
    if (finished) { document.getElementById('play').style.display = 'none'; renderResult(loadStreak()); }

    const inp = document.getElementById('guessInput');
    inp.addEventListener('input', onInput);
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (suggestItems.length) { activeIdx = (activeIdx + 1) % suggestItems.length; highlight(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (suggestItems.length) { activeIdx = (activeIdx - 1 + suggestItems.length) % suggestItems.length; highlight(); } }
      else if (e.key === 'Enter') { e.preventDefault(); submitTyped(); }
      else if (e.key === 'Escape') { closeSuggest(); }
    });
    document.getElementById('guessBtn').onclick = submitTyped;
    document.getElementById('skipBtn').onclick = skip;
    document.addEventListener('click', e => { if (!e.target.closest('.guessbox')) closeSuggest(); });
  }

  // expose a tiny hook for tests (no-op in the browser otherwise)
  window.__CINEGUESS_INIT__ = init;
  init();
})();
