// One end screen for the nine game pages. Each game used to finish on its own panel
// (five layouts, three button orders, emoji squares, "← CineLinks" as the gold
// button), so the moment that decides whether a session goes on looked different
// every time. A game now hands over what happened and this draws it: the verdict,
// the answer when there is one, the guess squares, the player's numbers, where to
// go next (the next trio game, the bonus pack, or practice) and Share, which sends
// a result image that never shows the answer. Needs lib/trio.js for the trio row;
// works without it. The pure parts (rows, plan, plain) also load under Node.
(function (root) {
  'use strict';

  var NAMES = { line: 'CineLine', grp: 'CineGroup', chain: 'CineChain', code: 'CineCode', grid: 'CineGrid', reel: 'CineReel', clue: 'CineClue', frame: 'CineFrame', cast: 'CineCast' };
  var STR = {
    en: { daily: 'Daily', practice: 'Practice', next: 'Next', trio: 'Today’s trio', of: '{n} of 3', bonus: 'Open your bonus pack', playPractice: 'Play practice', playDaily: 'Play today’s daily', share: 'Share', copied: 'Copied', saved: 'Image saved', dare: 'Can you beat it?' },
    es: { daily: 'Diario', practice: 'Práctica', next: 'Siguiente', trio: 'Trío de hoy', of: '{n} de 3', bonus: 'Abre tu sobre extra', playPractice: 'Jugar práctica', playDaily: 'Jugar el diario de hoy', share: 'Compartir', copied: 'Copiado', saved: 'Imagen guardada', dare: '¿Puedes superarlo?' },
    fr: { daily: 'Quotidien', practice: 'Entraînement', next: 'Suivant', trio: 'Trio du jour', of: '{n} sur 3', bonus: 'Ouvre ton paquet bonus', playPractice: 'S’entraîner', playDaily: 'Jouer le défi du jour', share: 'Partager', copied: 'Copié', saved: 'Image enregistrée', dare: 'Tu peux faire mieux ?' },
    de: { daily: 'Täglich', practice: 'Übung', next: 'Weiter', trio: 'Heutiges Trio', of: '{n} von 3', bonus: 'Bonuspack öffnen', playPractice: 'Übungsrunde spielen', playDaily: 'Heutiges Rätsel spielen', share: 'Teilen', copied: 'Kopiert', saved: 'Bild gespeichert', dare: 'Schaffst du es besser?' },
    pt: { daily: 'Diário', practice: 'Treino', next: 'Próximo', trio: 'Trio de hoje', of: '{n} de 3', bonus: 'Abra seu pacote bônus', playPractice: 'Jogar treino', playDaily: 'Jogar o diário de hoje', share: 'Compartilhar', copied: 'Copiado', saved: 'Imagem salva', dare: 'Consegue fazer melhor?' }
  };
  var lang = 'en'; try { if (root.document) lang = String(root.localStorage.getItem('clLang') || 'en').slice(0, 2); } catch (_) { /* noop */ }
  var S = STR[lang] || STR.en;

  // ── pure helpers ──────────────────────────────────────────────────────────
  // The games describe a run with emoji squares (their share text still uses
  // them); on screen and in the image they are drawn, so every platform matches.
  var SQ = { '\u{1F7E9}': 'g', '\u{1F7E8}': 'y', '\u{1F7E5}': 'r', '⬛': 'k', '\u{1F7E6}': 'b', '\u{1F7EA}': 'p', '\u{1F7E7}': 'o', '⬜': 'w', '\u{1F7EB}': 'n' };
  var SQC = { g: '#3fa66b', y: '#e8b64a', r: '#b9483a', k: '#2b292e', b: '#4a7fd0', p: '#8e5cc4', o: '#d98232', w: '#cfcac0', n: '#8a5a3a' };
  function rows(str) {
    return String(str == null ? '' : str).split('\n').map(function (line) {
      var out = []; Array.from(line).forEach(function (ch) { if (SQ[ch]) out.push(SQ[ch]); }); return out;
    }).filter(function (r) { return r.length; });
  }
  // headlines come from each game's own strings, some of which end in an emoji
  function strip(s) { return String(s == null ? '' : s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ''); }
  function plain(s) { return strip(s).replace(/\s+/g, ' ').trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // What the screen offers next. Daily: the first trio game still open (this one
  // counts as done even if its state is saved a tick later), else the bonus pack
  // while the home has not paid it, else practice. Practice: another round.
  function plan(d, T, env) {
    env = env || {};
    var path = env.path || '/', out = { trio: null, go: null, more: null };
    if (d.practice) {
      if (d.again) out.go = { label: d.again.label, href: d.again.href || (path + '?practice=1'), fn: d.again.fn || null, to: 'again' };
      out.more = { label: S.playDaily, href: path };
      return out;
    }
    if (T) {
      var p = T.progress(), mine = T.slotOf(d.mode, p.slots), done = p.done.slice();
      if (mine >= 0) done[mine] = true;
      var next = done.indexOf(false);
      out.trio = { done: done, count: done.filter(Boolean).length, mine: mine };
      if (next >= 0) { var m = T.slotMode(p.slots[next]); out.go = { label: S.next + ': ' + T.MODES[m].n, href: T.MODES[m].h, to: m }; }
      else if (!env.paid) out.go = { label: S.bonus, href: '/', to: 'home' };
    }
    if (out.go) out.more = { label: S.playPractice, href: path + '?practice=1' };
    else out.go = { label: S.playPractice, href: path + '?practice=1', to: 'practice' };
    return out;
  }
  // the home records the UTC day in trioDays when it pays the trio's bonus pack
  function bonusPaid() {
    try { var d = JSON.parse(root.localStorage.getItem('trioDays')); return Array.isArray(d) && !!root.Trio && d.indexOf(root.Trio.udNow()) >= 0; } catch (_) { return false; }
  }

  // ── the panel ─────────────────────────────────────────────────────────────
  var LEAF = 'linear-gradient(135deg,#f6dd86 0%,#d9ab42 34%,#f4dc8a 58%,#b9852a 100%)';
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>';
  function css() {
    if (document.getElementById('esCss')) return;
    var st = document.createElement('style'); st.id = 'esCss';
    st.textContent =
      '.es{position:relative;isolation:isolate;overflow:hidden;display:block;max-width:460px;margin:18px auto 0;padding:26px 20px 18px;border:0;border-radius:20px;text-align:center;' +
        'font-family:"Schibsted Grotesk",system-ui,sans-serif;color:#f2ede4;background:#151417;' +
        'box-shadow:0 1px 0 rgba(255,255,255,.035) inset,0 18px 40px -22px rgba(0,0,0,.9),0 2px 6px -2px rgba(0,0,0,.6),0 0 0 1px rgba(246,221,134,.2) inset}' +
      '.es::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(120% 60% at 50% 0%,rgba(232,182,74,.17),rgba(232,182,74,0) 62%)}' +
      '.es.lost::before{background:radial-gradient(120% 60% at 50% 0%,rgba(255,255,255,.05),rgba(255,255,255,0) 62%)}' +
      '.es.has-bd::after{content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;background:linear-gradient(180deg,rgba(21,20,23,.78),rgba(21,20,23,.97) 72%),var(--es-bd) center/cover no-repeat}' +
      '.es .es-eye{font-size:.68rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#f6dd86}' +
      '.es .es-score{margin-top:10px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:4rem;line-height:1;letter-spacing:-.02em}' +
      '.es .es-score b{font-weight:600;background:' + LEAF + ';-webkit-background-clip:text;background-clip:text;color:transparent}' +
      '.es.lost .es-score b{background:none;color:#f2ede4}' +
      '.es .es-score i{font-style:normal;font-size:.42em;letter-spacing:0;color:#8d877d;margin-left:2px}' +
      '.es .es-title{margin:10px 0 0;padding:0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.9rem;line-height:1.12;letter-spacing:-.01em;color:#f2ede4}' +
      '.es.has-score .es-title{margin-top:4px;font-size:1.35rem}' +
      '.es .es-sub{margin:6px auto 0;max-width:34ch;font-size:.9rem;line-height:1.45;color:#a59f95}' +
      '.es .es-answer{display:inline-flex;align-items:center;gap:14px;max-width:100%;margin-top:16px;padding:10px 16px 10px 10px;border-radius:14px;text-align:left;background:rgba(255,255,255,.035);box-shadow:0 0 0 1px rgba(246,221,134,.1) inset}' +
      '.es .es-answer img{flex:none;display:block;width:64px;height:96px;margin:0;border:0;border-radius:8px;object-fit:cover;background:#242228;box-shadow:0 8px 18px -8px rgba(0,0,0,.8)}' +
      '.es .es-answer.round img{width:68px;height:68px;border-radius:50%}' +
      '.es .es-at{min-width:0}' +
      '.es .es-an{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.12rem;line-height:1.2;color:#f2ede4}' +
      '.es .es-an span{font-family:"Schibsted Grotesk",system-ui,sans-serif;font-weight:500;font-size:.82rem;color:#a59f95;margin-left:4px}' +
      '.es .es-am{margin-top:3px;font-size:.8rem;line-height:1.35;color:#a59f95}' +
      '.es .es-grid{display:flex;flex-direction:column;align-items:center;gap:5px;margin-top:16px}' +
      '.es .es-grid div{display:flex;gap:5px}' +
      '.es .es-grid i{display:block;width:22px;height:22px;border-radius:6px;background:' + SQC.k + ';box-shadow:0 0 0 1px rgba(255,255,255,.06) inset}' +
      Object.keys(SQC).filter(function (k) { return k !== 'k'; }).map(function (k) { return '.es .es-grid i.' + k + '{background:' + SQC[k] + '}'; }).join('') +
      '.es .es-note{margin:14px auto 0;max-width:40ch;font-size:.82rem;line-height:1.45;color:#a59f95}' +
      '.es .es-note b,.es .es-note strong{color:#f6dd86;font-weight:600}' +
      '.es .es-stats{display:flex;justify-content:center;margin-top:18px;padding:12px 0;border-top:1px solid rgba(246,221,134,.085);border-bottom:1px solid rgba(246,221,134,.085)}' +
      '.es .es-stats div{flex:1;max-width:120px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:0 6px}' +
      '.es .es-stats div+div{border-left:1px solid rgba(246,221,134,.085)}' +
      '.es .es-stats b{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.5rem;line-height:1;color:#f2ede4;font-variant-numeric:tabular-nums}' +
      '.es .es-stats span{font-size:.62rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#a59f95}' +
      '.es .es-trio{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:16px;font-size:.8rem;color:#a59f95}' +
      '.es .es-dots{display:inline-flex;gap:5px}' +
      '.es .es-dots i{display:block;width:8px;height:8px;border-radius:50%;box-shadow:0 0 0 1px rgba(246,221,134,.42) inset}' +
      '.es .es-dots i.on{background:linear-gradient(135deg,#f6dd86,#d9ab42 50%,#b9852a);box-shadow:none}' +
      '.es .es-actions{display:flex;gap:10px;margin-top:14px}' +
      '.es .es-btn{flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;margin:0;padding:0 14px;border:0;border-radius:11px;' +
        'font:700 .95rem/1 "Schibsted Grotesk",system-ui,sans-serif;text-decoration:none;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
        'transition:transform .2s cubic-bezier(.2,.8,.2,1),background-position .6s cubic-bezier(.2,.8,.2,1),background-color .2s}' +
      '.es .es-btn:active{transform:scale(.97)}' +
      '.es .es-btn span{min-width:0;overflow:hidden;text-overflow:ellipsis}' +
      '.es .es-btn svg{flex:none;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}' +
      '.es .es-go{flex:1.7 1 0;color:#1a1408;background:' + LEAF + ';background-size:160% 160%;box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 10px 24px -10px rgba(232,182,74,.55)}' +
      '.es .es-go:hover{background-position:100% 0}' +
      '.es .es-ghost{color:#f2ede4;background:rgba(255,255,255,.045);box-shadow:0 0 0 1px rgba(246,221,134,.2) inset}' +
      '.es .es-ghost:hover{background:rgba(255,255,255,.075)}' +
      '.es .es-ghost.done{color:#f6dd86}' +
      '.es .es-more{display:inline-block;margin-top:12px;padding:6px 10px;font-size:.82rem;font-weight:600;color:#a59f95;text-decoration:none}' +
      '.es .es-more:hover{color:#f2ede4}' +
      '.es .es-btn:focus-visible,.es .es-more:focus-visible{outline:2px solid #f6dd86;outline-offset:2px}' +
      '.es>*{animation:esIn .5s cubic-bezier(.2,.8,.2,1) both}' +
      [2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '.es>*:nth-child(' + n + '){animation-delay:' + ((n - 1) * .05).toFixed(2) + 's}'; }).join('') +
      '@keyframes esIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
      '@media (max-width:350px){.es .es-actions{flex-direction:column}.es .es-btn{flex:none;width:100%}}' +
      '@media (min-width:760px){.es{max-width:500px;padding:30px 28px 20px}.es .es-title{font-size:2.1rem}.es.has-score .es-title{font-size:1.5rem}.es .es-score{font-size:4.6rem}}' +
      '@media (prefers-reduced-motion:reduce){.es>*{animation:none}.es .es-btn{transition:none}}';
    document.head.appendChild(st);
  }

  function track(name, props) { try { if (root.Track) root.Track(name, props); } catch (_) { /* noop */ } }

  function render(el, d) {
    if (!el || !d) return null;
    css();
    var pl = plan(d, root.Trio, { paid: bonusPaid(), path: location.pathname });
    var name = NAMES[d.mode] || 'CineLinks', title = plain(d.title);
    var h = '<div class="es-eye">' + esc(name + ' · ' + (d.practice ? S.practice : S.daily + (d.puzzle != null ? ' #' + d.puzzle : ''))) + '</div>';
    if (d.score != null && d.score !== '') {
      var sc = String(d.score).split('/');
      h += '<div class="es-score"><b>' + esc(sc[0]) + '</b>' + (sc[1] != null ? '<i>/' + esc(sc[1]) + '</i>' : '') + '</div>';
    }
    h += '<h2 class="es-title">' + esc(title) + '</h2>';
    if (d.sub) h += '<p class="es-sub">' + esc(plain(d.sub)) + '</p>';
    if (d.answer && d.answer.name) {
      var a = d.answer;
      h += '<div class="es-answer' + (a.round ? ' round' : '') + '">' + (a.img ? '<img src="' + esc(a.img) + '" alt="">' : '') +
        '<div class="es-at"><div class="es-an">' + esc(a.name) + (a.year ? ' <span>' + esc(a.year) + '</span>' : '') + '</div>' +
        (a.meta ? '<div class="es-am">' + esc(a.meta) + '</div>' : '') + (a.credit ? '<div class="es-am">' + esc(a.credit) + '</div>' : '') + '</div></div>';
    }
    var g = rows(d.grid);
    if (g.length) h += '<div class="es-grid" aria-hidden="true">' + g.map(function (r) { return '<div>' + r.map(function (k) { return '<i class="' + k + '"></i>'; }).join('') + '</div>'; }).join('') + '</div>';
    if (d.note) h += '<div class="es-note">' + strip(d.note).trim() + '</div>';   // the game's own markup, escaped by the game
    var st = (d.stats || []).filter(Boolean).slice(0, 4);
    if (st.length) h += '<div class="es-stats">' + st.map(function (s) {
      return '<div><b' + (typeof s.n === 'number' ? ' data-n="' + s.n + '" data-s="' + esc(s.suffix || '') + '"' : '') + '>' + esc(s.n + (s.suffix || '')) + '</b><span>' + esc(plain(s.l)) + '</span></div>';
    }).join('') + '</div>';
    if (pl.trio) h += '<div class="es-trio"><span class="es-dots">' + pl.trio.done.map(function (x) { return '<i class="' + (x ? 'on' : '') + '"></i>'; }).join('') + '</span>' + esc(S.trio + ' · ' + S.of.replace('{n}', pl.trio.count)) + '</div>';
    h += '<div class="es-actions">' +
      (pl.go ? '<a class="es-btn es-go" href="' + esc(pl.go.href) + '"><span>' + esc(pl.go.label) + '</span>' + ARROW + '</a>' : '') +
      '<button class="es-btn es-ghost es-share" type="button">' + SHARE + '<span>' + esc(S.share) + '</span></button></div>';
    if (pl.more) h += '<a class="es-more" href="' + esc(pl.more.href) + '">' + esc(pl.more.label) + '</a>';

    el.className = 'es ' + (d.won ? 'won' : 'lost') + (d.score != null && d.score !== '' ? ' has-score' : '') + (d.backdrop ? ' has-bd' : '');
    el.style.backgroundImage = '';
    if (d.backdrop) el.style.setProperty('--es-bd', 'url("' + String(d.backdrop).replace(/"/g, '%22') + '")'); else el.style.removeProperty('--es-bd');
    el.setAttribute('role', 'region'); el.setAttribute('aria-label', title);
    el.innerHTML = h;

    var go = el.querySelector('.es-go'), sb = el.querySelector('.es-share');
    if (go && pl.go) go.addEventListener('click', function (e) {
      if (pl.go.fn) { e.preventDefault(); pl.go.fn(); return; }
      if (pl.go.to === 'practice') track('end_practice', { mode: d.mode });
      else if (pl.go.to !== 'again') track('trio_next', { from: d.mode, to: pl.go.to, n: pl.trio ? pl.trio.count : 0 });
    });
    if (sb) sb.addEventListener('click', function () { share(d, sb); });

    // the numbers count up when the tab is on screen; they are already final if not
    try {
      if (root.Fx && root.Fx.countUp && document.visibilityState === 'visible') {
        Array.prototype.forEach.call(el.querySelectorAll('.es-stats b[data-n]'), function (b) {
          var n = +b.getAttribute('data-n'), suf = b.getAttribute('data-s') || '';
          if (!(n > 0)) return;
          root.Fx.countUp(b, n, { ms: 650, suffix: suf });
          setTimeout(function () { b.textContent = n + suf; }, 1100);
        });
      }
    } catch (_) { /* noop */ }
    // a run that just ended brings its result into view; a finished daily reopened later does not jump
    try {
      if (navigator.userActivation && navigator.userActivation.hasBeenActive) setTimeout(function () {
        var r = el.getBoundingClientRect();
        if (r.bottom > (root.innerHeight || 0) - 8 || r.top < 60) el.scrollIntoView({ block: r.height > (root.innerHeight || 0) - 80 ? 'start' : 'center', behavior: 'smooth' });
      }, 380);
    } catch (_) { /* noop */ }
    // draw the share image ahead of the tap: Safari wants navigator.share inside the gesture
    d._blob = null;
    setTimeout(function () { image(d).then(function (b) { d._blob = b; }).catch(function () { /* noop */ }); }, 700);
    return el;
  }

  // ── share: an image of the result (never the answer) plus the game's own text ──
  var FD = 'Fraunces, Georgia, serif', FU = '"Schibsted Grotesk", system-ui, sans-serif';
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function spaced(c, text, x, y, px) { try { c.letterSpacing = px + 'px'; } catch (_) { /* noop */ } c.fillText(text, x, y); try { c.letterSpacing = '0px'; } catch (_) { /* noop */ } }
  function fit(c, text, size, min, maxW) { c.font = '600 ' + size + 'px ' + FD; while (c.measureText(text).width > maxW && size > min) { size -= 2; c.font = '600 ' + size + 'px ' + FD; } return size; }
  function shareText(d) {
    if (d.share && d.share.text) return d.share.text;
    var name = NAMES[d.mode] || 'CineLinks';
    return name + (d.practice || d.puzzle == null ? '' : ' #' + d.puzzle) + (d.score != null ? ' ' + d.score : '') + '\nhttps://cinelinks.vercel.app' + location.pathname;
  }
  function image(d) {
    var W = 1080, H = 1350, sh = d.share || {};
    var score = sh.score != null ? String(sh.score) : (d.score != null ? String(d.score) : '');
    var title = plain(sh.title || d.title), g = rows(sh.grid != null ? sh.grid : d.grid);
    var stats = (d.practice ? [] : (d.stats || [])).filter(Boolean).slice(0, 3);
    var eye = ((NAMES[d.mode] || 'CineLinks') + ' · ' + (d.practice ? S.practice : S.daily + (d.puzzle != null ? ' #' + d.puzzle : ''))).toUpperCase();
    var fonts = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('600 80px Fraunces'), document.fonts.load('700 30px "Schibsted Grotesk"')]).catch(function () { /* noop */ }) : Promise.resolve();
    return fonts.then(function () {
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var c = cv.getContext('2d');
      var bg = c.createRadialGradient(W / 2, H * .42, 40, W / 2, H * .42, H * .78);
      if (d.won) { bg.addColorStop(0, '#2e2414'); bg.addColorStop(.55, '#120f0c'); } else { bg.addColorStop(0, '#211f24'); bg.addColorStop(.55, '#111013'); }
      bg.addColorStop(1, '#0c0b0d');
      c.fillStyle = bg; c.fillRect(0, 0, W, H);
      var leaf = c.createLinearGradient(W * .18, 0, W * .82, 0);
      leaf.addColorStop(0, '#f6dd86'); leaf.addColorStop(.35, '#d9ab42'); leaf.addColorStop(.6, '#f4dc8a'); leaf.addColorStop(1, '#b9852a');
      c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      // masthead
      c.fillStyle = leaf; c.font = '600 64px ' + FD; c.fillText('CineLinks', W / 2, 118);
      c.fillStyle = '#f6dd86'; c.font = '700 30px ' + FU; spaced(c, eye, W / 2, 182, 6);
      // the body: verdict, squares, numbers, stacked and centred in what is left
      var top = 236, avail = H - 200 - top, blocks = [];
      if (score) {
        blocks.push({ h: 250, draw: function (y) { c.font = '600 270px ' + FD; c.fillStyle = d.won ? leaf : '#f2ede4'; c.fillText(score, W / 2, y + 222); } });
        if (title) blocks.push({ h: 96, draw: function (y) { fit(c, title, 64, 40, 940); c.fillStyle = '#f2ede4'; c.fillText(title, W / 2, y + 68); } });
      } else if (title) {
        var size = fit(c, title, 150, 64, 940);
        blocks.push({ h: Math.round(size * 1.25), draw: function (y) { c.font = '600 ' + size + 'px ' + FD; c.fillStyle = d.won ? leaf : '#f2ede4'; c.fillText(title, W / 2, y + Math.round(size * .95)); } });
      }
      var used = blocks.reduce(function (a, b) { return a + b.h; }, 0) + (stats.length ? 190 : 0);
      if (g.length) {
        var cols = Math.max.apply(null, g.map(function (r) { return r.length; }));
        var maxH = Math.max(160, Math.min(430, avail - used - 60));
        var cell = Math.floor(Math.min(112, 820 / (cols * 1.16), maxH / (g.length * 1.16))), gap = Math.round(cell * .16);
        var gh = g.length * cell + (g.length - 1) * gap;
        blocks.push({ h: gh + 60, draw: function (y) {
          y += 36;
          g.forEach(function (row, ri) {
            var rw = row.length * cell + (row.length - 1) * gap, x0 = (W - rw) / 2;
            row.forEach(function (k, ci) { rr(c, x0 + ci * (cell + gap), y + ri * (cell + gap), cell, cell, Math.round(cell * .24)); c.fillStyle = SQC[k] || SQC.k; c.fill(); });
          });
        } });
      }
      if (stats.length) blocks.push({ h: 190, draw: function (y) {
        y += 46;
        var cw = 270, x0 = W / 2 - (stats.length * cw) / 2;
        c.fillStyle = 'rgba(246,221,134,.18)';
        c.fillRect(x0, y, stats.length * cw, 2); c.fillRect(x0, y + 140, stats.length * cw, 2);
        stats.forEach(function (s, i) { if (i) c.fillRect(x0 + i * cw, y + 26, 2, 90); });
        stats.forEach(function (s, i) {
          var cx = x0 + i * cw + cw / 2;
          c.fillStyle = '#f2ede4'; c.font = '600 72px ' + FD; c.fillText(String(s.n) + (s.suffix || ''), cx, y + 84);
          c.fillStyle = '#a59f95'; c.font = '700 22px ' + FU; spaced(c, plain(s.l).toUpperCase(), cx, y + 120, 4);
        });
      } });
      var total = blocks.reduce(function (a, b) { return a + b.h; }, 0), y = top + Math.max(0, (avail - total) / 2);
      blocks.forEach(function (b) { b.draw(y); y += b.h; });
      // the dare
      c.fillStyle = 'rgba(246,221,134,.3)'; c.fillRect(W / 2 - 60, H - 172, 120, 2);
      c.fillStyle = '#f2ede4'; c.font = '600 42px ' + FD; c.fillText(S.dare, W / 2, H - 98);
      c.fillStyle = '#a59f95'; c.font = '500 28px ' + FU; c.fillText((location.host || 'cinelinks.vercel.app') + location.pathname, W / 2, H - 50);
      return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, 'image/png'); });
    });
  }
  function share(d, btn) {
    var text = shareText(d);
    track('end_share', { mode: d.mode, won: d.won ? 1 : 0, practice: d.practice ? 1 : 0 });
    function say(t) {
      var s = btn && btn.querySelector('span'); if (!s) return;
      s.textContent = t; btn.classList.add('done');
      setTimeout(function () { s.textContent = S.share; btn.classList.remove('done'); }, 2200);
    }
    var ready = d._blob ? Promise.resolve(d._blob) : image(d).catch(function () { return null; });
    return ready.then(function (blob) {
      var file = null; try { file = blob ? new File([blob], 'cinelinks-' + (d.mode || 'result') + '.png', { type: 'image/png' }) : null; } catch (_) { file = null; }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], text: text }).catch(function () { /* dismissed */ });
      if (navigator.share) return navigator.share({ text: text }).catch(function () { /* dismissed */ });
      // desktop: save the image and copy the text
      if (blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'cinelinks-' + (d.mode || 'result') + '.png'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
      try { navigator.clipboard.writeText(text); } catch (_) { /* noop */ }
      say(blob ? S.saved : S.copied);
    });
  }

  var api = { render: render, share: share, image: image, rows: rows, plan: plan, plain: plain, NAMES: NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EndScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
