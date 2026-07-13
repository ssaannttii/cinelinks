// Lightweight beta feedback. No backend dependency: quick reactions are sent as
// analytics events, and internal tester mode keeps the owner's tests out.
(function () {
  'use strict';

  var copy = {
    en: {
      open: 'Feedback',
      title: 'How did this feel?',
      sub: 'One tap is enough.',
      fun: 'Fun',
      confusing: 'Confusing',
      hard: 'Too hard',
      bug: 'Bug',
      done: 'Thanks - noted.'
    },
    es: {
      open: 'Feedback',
      title: 'Que tal se siente?',
      sub: 'Un toque basta.',
      fun: 'Divertido',
      confusing: 'Confuso',
      hard: 'Dificil',
      bug: 'Bug',
      done: 'Gracias, anotado.'
    },
    fr: {
      open: 'Avis',
      title: 'Ca vous a plu ?',
      sub: 'Un tap suffit.',
      fun: 'Fun',
      confusing: 'Confus',
      hard: 'Trop dur',
      bug: 'Bug',
      done: 'Merci, note.'
    },
    de: {
      open: 'Feedback',
      title: 'Wie war das?',
      sub: 'Ein Tipp genugt.',
      fun: 'Spassig',
      confusing: 'Verwirrend',
      hard: 'Zu schwer',
      bug: 'Bug',
      done: 'Danke, notiert.'
    },
    pt: {
      open: 'Feedback',
      title: 'Como foi?',
      sub: 'Um toque basta.',
      fun: 'Divertido',
      confusing: 'Confuso',
      hard: 'Dificil',
      bug: 'Bug',
      done: 'Obrigado, anotado.'
    }
  };

  function lang() {
    try {
      var l = (localStorage.getItem('clLang') || navigator.language || 'en').slice(0, 2).toLowerCase();
      return copy[l] || copy.en;
    } catch (_) {
      return copy.en;
    }
  }

  function isBeta() {
    try { return !!(window.CineInternal && window.CineInternal.isBeta && window.CineInternal.isBeta()); } catch (_) { return false; }
  }

  function isTester() {
    try { return !!(window.CineInternal && window.CineInternal.isTester && window.CineInternal.isTester()); } catch (_) { return false; }
  }

  function track(name, data) {
    try { if (window.Track) window.Track(name, data || {}); } catch (_) { /* noop */ }
  }

  function submit(value) {
    if (isTester()) return;
    try {
      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ value: value, page: pageKey(), beta: isBeta() ? 1 : 0 })
      }).catch(function () { /* noop */ });
    } catch (_) { /* noop */ }
  }

  function pageKey() {
    var path = location.pathname || '/';
    if (path === '/') return 'home';
    return path.replace(/^\/|\.html$/g, '') || 'home';
  }

  function injectStyles() {
    if (document.getElementById('clFeedbackStyles')) return;
    var s = document.createElement('style');
    s.id = 'clFeedbackStyles';
    s.textContent = [
      '#clFbBtn{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:230;border:1px solid rgba(232,160,0,.52);border-radius:999px;background:rgba(20,20,20,.82);color:#f5c542;font:700 12px/1 Inter,-apple-system,sans-serif;padding:9px 13px;box-shadow:0 12px 30px rgba(0,0,0,.34);backdrop-filter:blur(10px);cursor:pointer}',
      '#clFbPanel{position:fixed;right:14px;bottom:calc(58px + env(safe-area-inset-bottom));z-index:231;width:min(310px,calc(100vw - 28px));display:none;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#2c343f;color:#f2f2f2;font-family:Inter,-apple-system,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.55);padding:14px}',
      '#clFbPanel.open{display:block;animation:clFbIn .18s ease both}',
      '@keyframes clFbIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}',
      '.clfb-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px}.clfb-title{font-weight:850;font-size:.92rem}.clfb-sub{color:#9e9e9e;font-size:.72rem;margin-top:2px}.clfb-x{border:0;background:transparent;color:#aaa;font:inherit;font-size:1rem;cursor:pointer;line-height:1}',
      '.clfb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.clfb-choice{border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.04);color:#eee;font:750 12px/1 Inter,-apple-system,sans-serif;padding:10px;cursor:pointer}.clfb-choice:hover{border-color:rgba(232,160,0,.5);color:#f5c542;background:rgba(232,160,0,.08)}',
      '.clfb-done{display:none;color:#7fd49a;font-weight:800;font-size:.82rem;margin-top:10px}.clfb-done.on{display:block}',
      '.clfb-beta{position:fixed;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:300;display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(245,197,66,.7);border-radius:999px;background:rgba(12,12,12,.88);color:#f5c542;font:900 12px/1 Inter,-apple-system,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:8px 13px;box-shadow:0 10px 28px rgba(0,0,0,.46),0 0 0 1px rgba(245,197,66,.18);backdrop-filter:blur(12px);pointer-events:none}',
      '.clfb-beta span{color:#d6d6d6;font-size:10px;font-weight:800;letter-spacing:.08em}',
      '@media(max-width:560px){#clFbBtn{right:10px;bottom:calc(10px + env(safe-area-inset-bottom))}#clFbPanel{right:10px;bottom:calc(54px + env(safe-area-inset-bottom));width:calc(100vw - 20px)}.clfb-beta{top:calc(8px + env(safe-area-inset-top));font-size:11px;padding:7px 12px}.clfb-beta span{display:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  function mount() {
    if (document.getElementById('clFbBtn')) return;
    if (!isBeta() && !isTester()) return;
    var c = lang();
    injectStyles();

    if (isBeta() && !isTester()) {
      var chip = document.createElement('div');
      chip.className = 'clfb-beta';
      var betaSub = { es: 'Prueba privada', fr: 'Test prive', de: 'Privater Test', pt: 'Teste privado' };
      var bl = (function () { try { return (localStorage.getItem('clLang') || 'en').slice(0, 2).toLowerCase(); } catch (_) { return 'en'; } })();
      chip.innerHTML = 'BETA <span>' + (betaSub[bl] || 'Private test') + '</span>';
      document.body.appendChild(chip);
    }

    var btn = document.createElement('button');
    btn.id = 'clFbBtn';
    btn.type = 'button';
    btn.textContent = c.open;
    btn.setAttribute('aria-haspopup', 'dialog');

    var panel = document.createElement('div');
    panel.id = 'clFbPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', c.title);
    panel.innerHTML =
      '<div class="clfb-head"><div><div class="clfb-title">' + c.title + '</div><div class="clfb-sub">' + c.sub + '</div></div><button class="clfb-x" type="button" aria-label="Close">x</button></div>' +
      '<div class="clfb-grid">' +
      '<button class="clfb-choice" type="button" data-v="fun">' + c.fun + '</button>' +
      '<button class="clfb-choice" type="button" data-v="confusing">' + c.confusing + '</button>' +
      '<button class="clfb-choice" type="button" data-v="hard">' + c.hard + '</button>' +
      '<button class="clfb-choice" type="button" data-v="bug">' + c.bug + '</button>' +
      '</div><div class="clfb-done" id="clFbDone">' + c.done + '</div>';

    btn.addEventListener('click', function () {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) track('feedback_open', { page: pageKey(), beta: isBeta() ? 1 : 0 });
    });
    panel.querySelector('.clfb-x').addEventListener('click', function () { panel.classList.remove('open'); });
    panel.querySelectorAll('.clfb-choice').forEach(function (choice) {
      choice.addEventListener('click', function () {
        track('feedback_quick', { page: pageKey(), value: choice.dataset.v || '', beta: isBeta() ? 1 : 0 });
        submit(choice.dataset.v || '');
        var done = document.getElementById('clFbDone');
        if (done) done.classList.add('on');
        setTimeout(function () { panel.classList.remove('open'); if (done) done.classList.remove('on'); }, 900);
      });
    });

    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
