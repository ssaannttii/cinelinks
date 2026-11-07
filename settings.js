// One settings sheet for every page: sound, haptics, motion, text size, language.
// The preferences live in localStorage and are read by the modules that act on
// them (sfx.js for sound and haptics; fx.js tags <html> with cl-reduce and
// cl-text-lg at load for motion and text; the language is the clLang the pages
// already use, so changing it reloads). Opened by the gear in the game frame:
// window.Settings.open(). Exposes window.Settings = { open, close, get, set }.
(function () {
  'use strict';
  var STR = {
    en: { title: 'Settings', sound: 'Sound', soundSub: 'Taps, chimes, the pack', haptics: 'Vibration', hapticsSub: 'On phones that have it', motion: 'Reduce motion', motionSub: 'Fewer animations, instant screens', text: 'Text size', normal: 'Normal', large: 'Large', lang: 'Language', langSub: 'The page reloads', close: 'Close', on: 'On', off: 'Off' },
    es: { title: 'Ajustes', sound: 'Sonido', soundSub: 'Toques, acordes, el sobre', haptics: 'Vibración', hapticsSub: 'En móviles que la tengan', motion: 'Reducir movimiento', motionSub: 'Menos animaciones, pantallas al instante', text: 'Tamaño del texto', normal: 'Normal', large: 'Grande', lang: 'Idioma', langSub: 'La página se recarga', close: 'Cerrar', on: 'Sí', off: 'No' },
    fr: { title: 'Réglages', sound: 'Son', soundSub: 'Touches, carillons, le paquet', haptics: 'Vibration', hapticsSub: 'Sur les téléphones qui l’ont', motion: 'Réduire les animations', motionSub: 'Moins de mouvement, écrans instantanés', text: 'Taille du texte', normal: 'Normale', large: 'Grande', lang: 'Langue', langSub: 'La page se recharge', close: 'Fermer', on: 'Oui', off: 'Non' },
    de: { title: 'Einstellungen', sound: 'Ton', soundSub: 'Tippen, Klänge, das Pack', haptics: 'Vibration', hapticsSub: 'Auf Handys, die es können', motion: 'Weniger Bewegung', motionSub: 'Weniger Animationen, sofortige Bildschirme', text: 'Textgröße', normal: 'Normal', large: 'Groß', lang: 'Sprache', langSub: 'Die Seite lädt neu', close: 'Schließen', on: 'An', off: 'Aus' },
    pt: { title: 'Definições', sound: 'Som', soundSub: 'Toques, acordes, o pacote', haptics: 'Vibração', hapticsSub: 'Em telemóveis que a tenham', motion: 'Reduzir movimento', motionSub: 'Menos animações, ecrãs instantâneos', text: 'Tamanho do texto', normal: 'Normal', large: 'Grande', lang: 'Idioma', langSub: 'A página recarrega', close: 'Fechar', on: 'Sim', off: 'Não' }
  };
  var LANGS = [['en-US', 'English'], ['es-ES', 'Español'], ['es-MX', 'Español (MX)'], ['fr-FR', 'Français'], ['de-DE', 'Deutsch'], ['pt-BR', 'Português']];
  function ls(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { /* noop */ } }
  function lang2() { return String(ls('clLang') || 'en').slice(0, 2); }
  function S() { return STR[lang2()] || STR.en; }
  function get() {
    return {
      sound: ls('cl_sound') !== '0',
      haptics: ls('cl_haptics') !== '0',
      motion: ls('cl_motion') === 'reduce',
      text: ls('cl_text') === 'lg' ? 'lg' : 'md',
      lang: ls('clLang') || 'en-US'
    };
  }
  function set(k, v) {
    if (k === 'sound') { try { if (window.Sfx && window.Sfx.enabled !== !!v) window.Sfx.toggle(); else lsSet('cl_sound', v ? '1' : '0'); } catch (_) { lsSet('cl_sound', v ? '1' : '0'); } }
    else if (k === 'haptics') { lsSet('cl_haptics', v ? '1' : '0'); if (v) { try { if (window.Sfx) window.Sfx.haptic(12); } catch (_) { /* noop */ } } }
    else if (k === 'motion') { lsSet('cl_motion', v ? 'reduce' : null); document.documentElement.classList.toggle('cl-reduce', !!v); }
    else if (k === 'text') { lsSet('cl_text', v === 'lg' ? 'lg' : null); document.documentElement.classList.toggle('cl-text-lg', v === 'lg'); }
    else if (k === 'lang') { lsSet('clLang', v); }
    try { window.dispatchEvent(new CustomEvent('cl:prefs', { detail: { key: k, value: v } })); } catch (_) { /* noop */ }
  }

  function injectCss() {
    if (document.getElementById('clSetCss')) return;
    var st = document.createElement('style'); st.id = 'clSetCss';
    st.textContent =
      '#clSet{position:fixed;inset:0;z-index:1300;display:none;align-items:flex-end;justify-content:center;background:rgba(6,6,8,.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-family:"Schibsted Grotesk",system-ui,sans-serif;color:#f2ede4}' +
      '#clSet.open{display:flex}' +
      '.cls-panel{width:100%;max-width:440px;max-height:min(88dvh,720px);overflow:auto;background:#151417;border-radius:20px 20px 0 0;box-shadow:0 1px 0 rgba(255,255,255,.035) inset,0 0 0 1px rgba(246,221,134,.2) inset,0 -24px 60px -22px rgba(0,0,0,.95);padding:18px 18px calc(18px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .38s cubic-bezier(.2,.8,.2,1)}' +
      '#clSet.in .cls-panel{transform:none}' +
      '@media(min-width:640px){#clSet{align-items:center;padding:20px}.cls-panel{border-radius:20px;transform:translateY(16px) scale(.97);opacity:0;transition:transform .32s cubic-bezier(.2,.8,.2,1),opacity .25s}#clSet.in .cls-panel{opacity:1}}' +
      '.cls-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
      '.cls-title{margin:0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.45rem;letter-spacing:-.01em}' +
      '.cls-x{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.045);box-shadow:0 0 0 1px rgba(246,221,134,.14) inset;color:#f2ede4;cursor:pointer;display:grid;place-items:center}' +
      '.cls-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}' +
      '.cls-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 0;border-top:1px solid rgba(246,221,134,.085)}' +
      '.cls-row:first-of-type{border-top:0}' +
      '.cls-l{min-width:0}.cls-l b{display:block;font-size:.95rem;font-weight:700}.cls-l span{display:block;margin-top:2px;font-size:.78rem;color:#a59f95}' +
      '.cls-sw{position:relative;flex-shrink:0;width:48px;height:28px;border:0;border-radius:999px;background:rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(246,221,134,.16) inset;cursor:pointer;transition:background .2s;padding:0}' +
      '.cls-sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#cfcac0;transition:transform .22s cubic-bezier(.2,.8,.2,1),background .2s}' +
      '.cls-sw[aria-checked="true"]{background:linear-gradient(135deg,#f6dd86 0%,#d9ab42 34%,#f4dc8a 58%,#b9852a 100%);box-shadow:0 1px 0 rgba(255,255,255,.4) inset}' +
      '.cls-sw[aria-checked="true"]::after{transform:translateX(20px);background:#1a1408}' +
      '.cls-seg{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}' +
      '.cls-seg button{height:34px;padding:0 12px;border:0;border-radius:9px;background:rgba(255,255,255,.045);box-shadow:0 0 0 1px rgba(246,221,134,.14) inset;color:#f2ede4;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer}' +
      '.cls-seg button[aria-pressed="true"]{background:linear-gradient(135deg,#f6dd86 0%,#d9ab42 34%,#f4dc8a 58%,#b9852a 100%);color:#1a1408;box-shadow:0 1px 0 rgba(255,255,255,.4) inset}' +
      '.cls-row.col{flex-direction:column;align-items:stretch}.cls-row.col .cls-seg{justify-content:flex-start;margin-top:10px}' +
      '@media(prefers-reduced-motion:reduce){.cls-panel,.cls-sw::after{transition:none}}' +
      'html.cl-reduce .cls-panel,html.cl-reduce .cls-sw::after{transition:none}';
    document.head.appendChild(st);
  }

  var _release = null, _ov = null;
  function row(cls, label, sub, control) { return '<div class="cls-row' + (cls ? ' ' + cls : '') + '"><div class="cls-l"><b>' + label + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>' + control + '</div>'; }
  function sw(k, on, lbl) { return '<button type="button" class="cls-sw" role="switch" data-k="' + k + '" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + lbl + '"></button>'; }
  function render() {
    var s = S(), p = get();
    _ov.innerHTML =
      '<div class="cls-panel" role="dialog" aria-modal="true" aria-label="' + s.title + '">' +
        '<div class="cls-hd"><h2 class="cls-title">' + s.title + '</h2><button type="button" class="cls-x" aria-label="' + s.close + '"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
        row('', s.sound, s.soundSub, sw('sound', p.sound, s.sound)) +
        row('', s.haptics, s.hapticsSub, sw('haptics', p.haptics, s.haptics)) +
        row('', s.motion, s.motionSub, sw('motion', p.motion, s.motion)) +
        row('', s.text, '', '<div class="cls-seg" data-k="text"><button type="button" data-v="md" aria-pressed="' + (p.text === 'md') + '">' + s.normal + '</button><button type="button" data-v="lg" aria-pressed="' + (p.text === 'lg') + '">' + s.large + '</button></div>') +
        row('col', s.lang, s.langSub, '<div class="cls-seg" data-k="lang">' + LANGS.map(function (l) { return '<button type="button" data-v="' + l[0] + '" aria-pressed="' + (p.lang === l[0]) + '">' + l[1] + '</button>'; }).join('') + '</div>') +
      '</div>';
    _ov.querySelector('.cls-x').onclick = close;
    Array.prototype.forEach.call(_ov.querySelectorAll('.cls-sw'), function (b) {
      b.onclick = function () { var on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', on ? 'true' : 'false'); set(b.dataset.k, on); try { if (window.Sfx && b.dataset.k !== 'sound') window.Sfx.tap(); } catch (_) { /* noop */ } };
    });
    Array.prototype.forEach.call(_ov.querySelectorAll('.cls-seg'), function (seg) {
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
        b.onclick = function () {
          Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          set(seg.dataset.k, b.dataset.v);
          try { if (window.Sfx) window.Sfx.tap(); } catch (_) { /* noop */ }
          if (seg.dataset.k === 'lang') setTimeout(function () { location.reload(); }, 180);
        };
      });
    });
  }
  var _back = null;
  function onKey(e) { if (e.key === 'Escape') close(); }
  function open() {
    injectCss();
    if (!_ov) { _ov = document.createElement('div'); _ov.id = 'clSet'; document.body.appendChild(_ov); _ov.addEventListener('click', function (e) { if (e.target === _ov) close(); }); }
    render();
    _ov.classList.add('open'); requestAnimationFrame(function () { _ov.classList.add('in'); });
    document.addEventListener('keydown', onKey);
    try { if (window.fxTrapFocus) _release = window.fxTrapFocus(_ov.querySelector('.cls-panel')); } catch (_) { /* noop */ }
    // the back button closes the sheet before it leaves the page (session.js)
    try { if (window.Session && Session.trap && !_back) _back = Session.trap(close); } catch (_) { _back = null; }
    try { if (window.Track) window.Track('settings_open', {}); } catch (_) { /* noop */ }
  }
  function close() {
    if (!_ov || !_ov.classList.contains('open')) return;
    try { if (_back) { var b = _back; _back = null; b(); } } catch (_) { /* noop */ }
    _ov.classList.remove('in');
    document.removeEventListener('keydown', onKey);
    try { if (_release) { _release(); _release = null; } } catch (_) { /* noop */ }
    var reduced = document.documentElement.classList.contains('cl-reduce'); try { reduced = reduced || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { /* noop */ }
    setTimeout(function () { _ov.classList.remove('open'); }, reduced ? 0 : 380);
  }
  window.Settings = { open: open, close: close, get: get, set: set };
})();
