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
  bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:1000;max-width:560px;margin:0 auto;background:#151417;border:0;box-shadow:0 1px 0 rgba(255,255,255,.035) inset,0 18px 40px -22px rgba(0,0,0,.9),0 0 0 1px rgba(246,221,134,.2) inset;border-radius:16px;padding:13px 14px;display:flex;gap:12px;align-items:center;font-family:"Schibsted Grotesk",-apple-system,sans-serif';
  bar.innerHTML = '<span style="flex:1;font-size:.8rem;line-height:1.5;color:#cfcac0">We keep your streaks on this device and use cookie-free analytics — no tracking cookies. <a href="/privacy.html" style="color:#f6dd86;text-decoration:none;font-weight:700">Learn more</a></span>';
  var btn = document.createElement('button');
  btn.textContent = 'Got it';
  btn.style.cssText = 'flex-shrink:0;height:36px;padding:0 14px;border:none;border-radius:9px;background:linear-gradient(135deg,#f6dd86 0%,#d9ab42 34%,#f4dc8a 58%,#b9852a 100%);color:#1a1408;font-family:inherit;font-weight:700;font-size:.82rem;cursor:pointer;box-shadow:0 1px 0 rgba(255,255,255,.45) inset';
  btn.onclick = function () { try { localStorage.setItem('cookieNoticeSeen', '1'); } catch (_) {} hide(); };
  bar.appendChild(btn);
  document.body.appendChild(bar);
  // lift the floating buttons (help, feedback, support) above the bar while it is up
  var st = document.createElement('style'); st.id = 'clCookieLift';
  st.textContent = 'html.cl-cookie #ht-btn,html.cl-cookie #clFbBtn,html.cl-cookie #clSupport{margin-bottom:var(--cl-cookie,0px)}';
  document.head.appendChild(st);
  function lift() { document.documentElement.style.setProperty('--cl-cookie', (bar.offsetHeight + 12) + 'px'); }
  function hide() { document.documentElement.classList.remove('cl-cookie'); window.removeEventListener('resize', lift); bar.remove(); }
  document.documentElement.classList.add('cl-cookie'); lift(); window.addEventListener('resize', lift);
  }
})();
