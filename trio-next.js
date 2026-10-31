// "Next in today's trio" for the game pages. Finishing a trio game used to end on
// that game's own screen, and the only way on was back to the home to find the
// next one, which is where most sessions ended. Once this page's daily is done
// (and any card reveal has closed), a bar offers the next trio game, or the home
// when the day is complete (the home pays the bonus pack). Needs lib/trio.js.
(function () {
  'use strict';
  if (!window.Trio || /[?&]practice=1/.test(location.search)) return;
  var PAGE = { cineline: 'line', cinegroup: 'grp', cinechain: 'chain', cinecode: 'code', cinegrid: 'grid', cinereel: 'reel', cineclue: 'clue', cineframe: 'frame', cinecast: 'cast' };
  var mode = PAGE[String(location.pathname).replace(/^\//, '').replace(/\.html$/, '')];
  if (!mode || Trio.slotOf(mode) < 0) return;

  var STR = {
    en: { next: 'Next', of: '{n} of 3 done', day: 'Day complete', home: 'Open your bonus pack', trio: 'Today’s trio', close: 'Close' },
    es: { next: 'Siguiente', of: '{n} de 3 hechos', day: 'Día completo', home: 'Abre tu sobre extra', trio: 'Trío de hoy', close: 'Cerrar' },
    fr: { next: 'Suivant', of: '{n} sur 3 faits', day: 'Journée terminée', home: 'Ouvre ton paquet bonus', trio: 'Trio du jour', close: 'Fermer' },
    de: { next: 'Weiter', of: '{n} von 3 erledigt', day: 'Tag geschafft', home: 'Bonuspack öffnen', trio: 'Heutiges Trio', close: 'Schließen' },
    pt: { next: 'Próximo', of: '{n} de 3 feitos', day: 'Dia completo', home: 'Abra seu pacote bônus', trio: 'Trio de hoje', close: 'Fechar' }
  };
  var lang = 'en'; try { lang = String(localStorage.getItem('clLang') || 'en').slice(0, 2); } catch (_) {}
  var S = STR[lang] || STR.en;
  var ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function css() {
    if (document.getElementById('trioNextCss')) return;
    var st = document.createElement('style'); st.id = 'trioNextCss';
    st.textContent =
      '#trioNext{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));z-index:250;width:min(calc(100% - 24px),460px);transform:translate(-50%,140%);' +
      'display:flex;align-items:center;gap:12px;padding:10px 10px 10px 16px;border-radius:16px;font-family:"Schibsted Grotesk",system-ui,sans-serif;color:#f2ede4;' +
      'background:rgba(16,15,18,.9);backdrop-filter:blur(16px) saturate(1.2);-webkit-backdrop-filter:blur(16px) saturate(1.2);' +
      'box-shadow:0 0 0 1px rgba(246,221,134,.22) inset,0 24px 50px -18px rgba(0,0,0,.9);transition:transform .55s cubic-bezier(.2,.8,.2,1)}' +
      '#trioNext.on{transform:translate(-50%,0)}' +
      '#trioNext .tn-t{flex:1;min-width:0}' +
      '#trioNext .tn-k{font-size:.66rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#e8b64a}' +
      '#trioNext .tn-s{font-size:.84rem;color:#a59f95;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#trioNext .tn-dots{display:inline-flex;gap:4px;margin-right:7px;vertical-align:1px}' +
      '#trioNext .tn-dots i{width:7px;height:7px;border-radius:50%;box-shadow:0 0 0 1px rgba(246,221,134,.4) inset}' +
      '#trioNext .tn-dots i.on{background:linear-gradient(135deg,#f6dd86,#d9ab42 50%,#b9852a);box-shadow:none}' +
      '#trioNext .tn-go{flex:none;display:inline-flex;align-items:center;gap:7px;height:44px;padding:0 16px;border-radius:11px;font-weight:700;font-size:.92rem;color:#1a1408;text-decoration:none;white-space:nowrap;' +
      'background:linear-gradient(135deg,#f6dd86 0%,#d9ab42 34%,#f4dc8a 58%,#b9852a 100%);box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 10px 24px -10px rgba(232,182,74,.55)}' +
      '#trioNext .tn-x{flex:none;width:32px;height:32px;border:0;border-radius:50%;background:none;color:#6f6a63;font-size:1.1rem;cursor:pointer}' +
      '@media (prefers-reduced-motion:reduce){#trioNext{transition:none}}';
    document.head.appendChild(st);
  }

  var shown = false;
  function show() {
    if (shown) return; shown = true;
    var p = Trio.progress(), allDone = p.next < 0;
    var dots = '<span class="tn-dots">' + p.done.map(function (d) { return '<i class="' + (d ? 'on' : '') + '"></i>'; }).join('') + '</span>';
    var nextMode = allDone ? null : Trio.slotMode(p.slots[p.next]);
    var href = allDone ? '/' : Trio.MODES[nextMode].h;
    var label = allDone ? S.home : S.next + ': ' + Trio.MODES[nextMode].n;
    css();
    var bar = document.createElement('div'); bar.id = 'trioNext'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<div class="tn-t"><div class="tn-k">' + (allDone ? S.day : S.trio) + '</div><div class="tn-s">' + dots + S.of.replace('{n}', p.count) + '</div></div>' +
      '<a class="tn-go" href="' + href + '">' + label + ARROW + '</a><button class="tn-x" type="button" aria-label="' + S.close + '">×</button>';
    document.body.appendChild(bar);
    bar.querySelector('.tn-x').onclick = function () { bar.classList.remove('on'); setTimeout(function () { bar.remove(); }, 600); };
    bar.querySelector('.tn-go').addEventListener('click', function () { try { if (window.Track) window.Track('trio_next', { from: mode, to: nextMode || 'home', n: p.count }); } catch (_) {} });
    void bar.offsetWidth; setTimeout(function () { bar.classList.add('on'); }, 20);   // not rAF: it stalls in background tabs
  }

  // Wait for this daily to finish, then for its end screen and card reveal to settle.
  var calm = 0;
  var t = setInterval(function () {
    if (!Trio.result(mode).done) { calm = 0; return; }
    if (document.querySelector('#clCollReveal.open')) { calm = 0; return; }
    if (++calm >= 3) { clearInterval(t); show(); }        // ~2.4s of quiet after the win
  }, 800);
})();
