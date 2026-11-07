// Leaving a game is never a loss.
//
// Every game keeps a snapshot of the run in progress (cl_run_<mode>) and writes it
// after each move and the moment the page is hidden. Coming back restores the
// exact board, with a short "welcome back" curtain so the player knows where they
// left off; a timed run stops its clock while the page is hidden and shows a
// "paused" curtain on return, so a phone call, a tab switch or the back button
// cost no seconds. When the run finishes the snapshot is cleared and the game's
// own result takes over; a snapshot from another day is discarded in silence.
//
// Loaded synchronously by each game page right before its own script:
//   var saved = Session.start({ mode, practice, v, get, summary, timer });
//   Session.save()       after every move
//   Session.end()        when the run is over
//   Session.gate(fn)     after restoring and rendering: the curtain, fn on Continue
//   Session.peek(mode)   the lobby: today's unfinished run of a daily, or null
//   Session.trap(close)  the back button closes an overlay before it leaves a page
(function (root) {
  'use strict';
  var STR = {
    en: { back: 'Welcome back', paused: 'Paused', cont: 'Continue', resume: 'Resume', saved: 'Your progress is saved. Leaving never costs you anything.', pausedSub: 'The clock stopped while you were away.', left: '{t} left', today: 'Back to Today', inProgress: 'In progress' },
    es: { back: 'Bienvenido de nuevo', paused: 'En pausa', cont: 'Continuar', resume: 'Reanudar', saved: 'Tu progreso está guardado. Salir nunca te cuesta nada.', pausedSub: 'El reloj se detuvo mientras no estabas.', left: 'Quedan {t}', today: 'Volver a Hoy', inProgress: 'En curso' },
    fr: { back: 'Bon retour', paused: 'En pause', cont: 'Continuer', resume: 'Reprendre', saved: 'Ta progression est sauvegardée. Partir ne coûte jamais rien.', pausedSub: 'Le chrono s’est arrêté pendant ton absence.', left: '{t} restantes', today: 'Retour à Aujourd’hui', inProgress: 'En cours' },
    de: { back: 'Willkommen zurück', paused: 'Pausiert', cont: 'Weiter', resume: 'Fortsetzen', saved: 'Dein Fortschritt ist gespeichert. Gehen kostet dich nie etwas.', pausedSub: 'Die Uhr stand still, während du weg warst.', left: 'Noch {t}', today: 'Zurück zu Heute', inProgress: 'Läuft' },
    pt: { back: 'Bem-vindo de volta', paused: 'Em pausa', cont: 'Continuar', resume: 'Retomar', saved: 'O teu progresso está guardado. Sair nunca custa nada.', pausedSub: 'O relógio parou enquanto estiveste fora.', left: 'Faltam {t}', today: 'Voltar a Hoje', inProgress: 'Em curso' }
  };
  var NAMES = { cl: 'CineLinks', line: 'CineLine', grp: 'CineGroup', chain: 'CineChain', code: 'CineCode', grid: 'CineGrid', reel: 'CineReel', clue: 'CineClue', frame: 'CineFrame', cast: 'CineCast' };
  var KEY = 'cl_run_';
  function lang() { try { return String(root.localStorage.getItem('clLang') || 'en').slice(0, 2); } catch (_) { return 'en'; } }
  function S() { return STR[lang()] || STR.en; }
  function udNow() { var n = new Date(); return Math.floor(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) / 86400000); }
  // one key per mode for the daily, another for practice, so trying a practice
  // round never throws away the daily run in progress
  function kname(mode, practice) { return KEY + mode + (practice ? '_p' : ''); }
  function read(k) { try { return JSON.parse(root.localStorage.getItem(k)); } catch (_) { return null; } }
  function write(k, o) { try { root.localStorage.setItem(k, JSON.stringify(o)); } catch (_) { /* full or blocked: the run just will not survive a reload */ } }
  function clear(k) { try { root.localStorage.removeItem(k); } catch (_) { /* noop */ } }
  function fmt(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function reduced() { try { return document.documentElement.classList.contains('cl-reduce') || root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }

  // ── the run ──
  var cur = null, ended = false, paused = false, fresh = true, meta = null;
  function valid(r, cfg) {
    if (!r || r.v !== (cfg.v || 1) || !r.state) return false;
    if (cfg.practice) return !!r.practice && r.key != null && r.key === cfg.key;
    return !r.practice && r.day === udNow();
  }
  function start(cfg) {
    cur = cfg; ended = false; paused = false;
    var r = read(kname(cfg.mode, cfg.practice)), ok = valid(r, cfg);
    if (r && !ok) clear(kname(cfg.mode, cfg.practice));
    bind();
    fresh = !ok;
    meta = ok ? { left: r.left == null ? null : r.left, t: r.t || 0 } : null;
    return ok ? r.state : null;
  }
  function flush() {
    if (!cur || ended) return;
    if (cur.practice && cur.key == null) return;   // a throwaway practice run: nothing to come back to
    var st = null;
    try { st = cur.get(); } catch (_) { st = null; }
    if (st == null) { clear(kname(cur.mode, cur.practice)); return; }
    var o = { v: cur.v || 1, mode: cur.mode, day: udNow(), practice: !!cur.practice, key: cur.key == null ? null : cur.key, t: Date.now(), state: st };
    try { o.sum = cur.summary ? String(cur.summary(st) || '') : ''; } catch (_) { o.sum = ''; }
    if (cur.timer) { try { o.left = cur.timer.left(); } catch (_) { /* noop */ } }
    write(kname(cur.mode, cur.practice), o);
  }
  // synchronous on purpose: a page that leaves right after a move, or a lobby that
  // renders right after "Today", must see the snapshot already written
  function save() { if (!cur || ended) return; flush(); }
  function end() { if (!cur) return; ended = true; clear(kname(cur.mode, cur.practice)); hide(); }
  function peek(mode) {
    var r = read(kname(mode, false));
    if (!r || r.practice || r.day !== udNow() || !r.state) return null;
    return { sum: r.sum || '', t: r.t || 0, left: r.left == null ? null : r.left };
  }

  // ── hidden: save and stop the clock; visible: the paused curtain ──
  var bound = false;
  function onHide() {
    if (!cur || ended) return;
    flush();
    if (cur.timer && !paused) { paused = true; try { cur.timer.pause(); } catch (_) { /* noop */ } }
  }
  function onShow() {
    if (!cur || ended || !cur.timer || !paused) return;
    if (open) return;
    curtain('paused');
  }
  // Only visibility, not window blur: a click on the address bar or the devtools
  // must not stop a clock. Back then Forward (bfcache) revives the page live, so
  // pageshow reopens the paused curtain too.
  function bind() {
    if (bound) return; bound = true;
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') onHide(); else onShow(); });
    root.addEventListener('pagehide', onHide);
    root.addEventListener('pageshow', function (e) { if (e.persisted) onShow(); });
  }

  // ── the curtain ──
  var open = null, onGo = null;
  function css() {
    if (document.getElementById('clRunCss')) return;
    var st = document.createElement('style'); st.id = 'clRunCss';
    st.textContent =
      '#clRun{position:fixed;inset:0;z-index:1100;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;background:radial-gradient(circle at 50% 44%,rgba(42,33,18,.72),rgba(8,7,9,.95) 68%);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-family:"Schibsted Grotesk",system-ui,sans-serif;color:#f2ede4;overflow:hidden}' +
      '#clRun.open{display:flex}' +
      '.clr-bar{position:absolute;left:0;right:0;height:max(6dvh,34px);background:#070608;transform:scaleY(0);transition:transform .5s cubic-bezier(.2,.8,.2,1)}' +
      '.clr-bar.t{top:0;transform-origin:top;box-shadow:0 1px 0 rgba(246,221,134,.22)}.clr-bar.b{bottom:0;transform-origin:bottom;box-shadow:0 -1px 0 rgba(246,221,134,.22)}' +
      '#clRun.in .clr-bar{transform:none}' +
      '.clr-card{position:relative;width:min(100%,360px);opacity:0;transform:translateY(14px);transition:opacity .4s ease .12s,transform .5s cubic-bezier(.2,.8,.2,1) .12s}' +
      '#clRun.in .clr-card{opacity:1;transform:none}' +
      '.clr-eye{font-size:.68rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#f6dd86}' +
      '.clr-title{margin:10px 0 0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:2rem;letter-spacing:-.015em;line-height:1.05}' +
      '.clr-clock{margin:18px 0 0;font-family:"Space Mono",ui-monospace,monospace;font-size:2.6rem;font-weight:700;letter-spacing:.02em;color:#f6dd86;line-height:1}' +
      '.clr-sub{margin:12px 0 0;font-size:.95rem;color:#a59f95;line-height:1.4}' +
      '.clr-sub b{color:#f2ede4;font-weight:700}' +
      '.clr-go{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;min-width:200px;margin:26px auto 0;padding:0 24px;border:0;border-radius:11px;cursor:pointer;font:inherit;font-size:.95rem;font-weight:800;letter-spacing:.01em;color:#1a1408;background:linear-gradient(135deg,#f6dd86 0%,#d9ab42 34%,#f4dc8a 58%,#b9852a 100%);box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 10px 30px rgba(217,171,66,.28)}' +
      '.clr-go svg{width:16px;height:16px;fill:currentColor}' +
      '.clr-go:active{transform:translateY(1px)}' +
      '.clr-note{margin:16px 0 0;font-size:.78rem;color:#a59f95;line-height:1.45}' +
      '.clr-home{display:inline-block;margin-top:14px;font-size:.8rem;font-weight:700;color:#a59f95;text-decoration:none;letter-spacing:.02em}' +
      '.clr-home:hover{color:#f2ede4}' +
      '@media (prefers-reduced-motion:reduce){.clr-bar,.clr-card{transition:none}}' +
      'html.cl-reduce .clr-bar,html.cl-reduce .clr-card{transition:none}';
    document.head.appendChild(st);
  }
  function el() {
    css();
    var d = document.getElementById('clRun');
    if (d) return d;
    d = document.createElement('div'); d.id = 'clRun'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    document.body.appendChild(d);
    return d;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
  function curtain(kind, fn) {
    var T = S(), d = el(), name = NAMES[cur && cur.mode] || '', sum = '';
    try { sum = cur && cur.summary ? String(cur.summary(cur.get()) || '') : ''; } catch (_) { sum = ''; }
    var timed = !!(cur && cur.timer), left = 0;
    if (timed) { try { left = cur.timer.left(); } catch (_) { left = 0; } }
    var isPause = kind === 'paused';
    d.innerHTML =
      '<div class="clr-bar t"></div><div class="clr-bar b"></div>' +
      '<div class="clr-card">' +
        '<div class="clr-eye">' + (isPause ? T.paused : T.back) + '</div>' +
        '<h2 class="clr-title">' + esc(name) + '</h2>' +
        (timed ? '<div class="clr-clock" aria-label="' + esc(T.left.replace('{t}', fmt(left))) + '">' + fmt(left) + '</div>' : '') +
        (sum ? '<p class="clr-sub">' + sum + '</p>' : '') +
        '<button type="button" class="clr-go" id="clRunGo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' + (isPause || timed ? T.resume : T.cont) + '</button>' +
        '<p class="clr-note">' + (isPause ? T.pausedSub : T.saved) + '</p>' +
        '<a class="clr-home" href="/">' + T.today + '</a>' +
      '</div>';
    open = kind; onGo = fn || null;
    d.classList.add('open');
    if (reduced()) d.classList.add('in');
    else requestAnimationFrame(function () { requestAnimationFrame(function () { d.classList.add('in'); }); });
    function go() {
      if (!open) return;
      try { if (root.Sfx && root.Sfx.select) root.Sfx.select(); if (root.Sfx && root.Sfx.haptic) root.Sfx.haptic(8); } catch (_) { /* noop */ }
      try { if (root.Track) root.Track('run_resume', { mode: cur.mode, kind: kind }); } catch (_) { /* noop */ }
      hide();
      if (timed && paused) { paused = false; try { cur.timer.resume(); } catch (_) { /* noop */ } }
      if (onGo) { var f = onGo; onGo = null; try { f(); } catch (_) { /* noop */ } }
    }
    var btn = d.querySelector('#clRunGo');
    btn.onclick = function (e) { e.stopPropagation(); go(); };
    d.onclick = function (e) { if (!timed && e.target === d) go(); };
    d.onkeydown = function (e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
    try { btn.focus({ preventScroll: true }); } catch (_) { /* noop */ }
  }
  function hide() {
    var d = document.getElementById('clRun');
    open = null;
    if (!d) return;
    d.classList.remove('in');
    var done = function () { d.classList.remove('open'); d.innerHTML = ''; };
    if (reduced()) done(); else setTimeout(done, 260);
  }
  // After a restore the game renders, then gates: the clock (if any) starts only on
  // Continue. On a fresh run it just runs fn.
  function gate(fn) {
    if (!cur || fresh) { if (fn) fn(); return; }
    fresh = true;   // once per page load: a Continue tapped in the lobby needs no second one
    if (cur.timer) paused = true;
    curtain('back', fn);
  }

  // ── the back button closes what is open before it leaves the page ──
  var traps = [], skip = 0;
  function trap(close) {
    var tok = { fn: close };
    traps.push(tok);
    try { history.pushState({ clTrap: traps.length }, ''); } catch (_) { /* noop */ }
    return function release() {
      var i = traps.indexOf(tok); if (i < 0) return;
      traps.splice(i, 1);
      if (i === traps.length && history.state && history.state.clTrap) { skip++; try { history.back(); } catch (_) { skip--; } }
    };
  }
  root.addEventListener('popstate', function () {
    if (skip > 0) { skip--; return; }
    var t = traps.pop();
    if (t) { try { t.fn(); } catch (_) { /* noop */ } }
  });

  // restored(): the seconds left and the time of the snapshot start() gave back
  root.Session = { start: start, save: save, end: end, gate: gate, peek: peek, trap: trap, fmt: fmt, str: S, names: NAMES, restored: function () { return meta; }, active: function () { return !!cur && !ended; } };
})(window);
