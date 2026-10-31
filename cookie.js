// One-time, informational storage/cookie notice. We set no tracking cookies and
// analytics is cookieless, so this is a notice (not a consent gate) — nothing
// non-essential runs without the user's own action (e.g. choosing to sign in).
(function () {
  'use strict';
  try { if (localStorage.getItem('cookieNoticeSeen')) return; } catch (_) { return; }
  // It's a notice, not a consent gate, so it can wait for a calm moment: never on a
  // game page (it covered the bottom of the board) and never on top of the welcome
  // dialog or a CineLinks game on the home — a new player used to get it stacked
  // under the welcome modal on their very first second.
  if (/\/cine[a-z]+\.html$/.test(location.pathname)) return;
  function busy() {
    var f = document.getElementById('ftue'); if (f && f.classList.contains('on')) return true;
    var ss = document.getElementById('startScreen'); if (ss && !ss.classList.contains('active')) return true;
    return !!document.querySelector('[role="dialog"].open, .coach');
  }
  function later() { if (busy()) { setTimeout(later, 1500); return; } show(); }
  setTimeout(later, 1800);   // let the welcome dialog decide whether it opens first
  function show() {
  var bar = document.createElement('div');
  bar.id = 'clCookieBar';   // so fullscreen surfaces (collection vault) can duck it
  bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:1000;max-width:560px;margin:0 auto;background:#2c343f;border:1px solid rgba(232,160,0,.25);border-radius:12px;padding:13px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 12px 34px rgba(0,0,0,.5);font-family:Inter,-apple-system,sans-serif';
  bar.innerHTML = '<span style="flex:1;font-size:.8rem;line-height:1.5;color:#cfcfcf">We keep your streaks on this device and use cookie-free analytics — no tracking cookies. <a href="/privacy.html" style="color:#e8a000;text-decoration:none;font-weight:700">Learn more</a></span>';
  var btn = document.createElement('button');
  btn.textContent = 'Got it';
  btn.style.cssText = 'flex-shrink:0;padding:8px 14px;border:none;border-radius:8px;background:#e8a000;color:#111;font-family:inherit;font-weight:800;font-size:.8rem;cursor:pointer';
  btn.onclick = function () { try { localStorage.setItem('cookieNoticeSeen', '1'); } catch (_) {} bar.remove(); };
  bar.appendChild(btn);
  document.body.appendChild(bar);
  }
})();
