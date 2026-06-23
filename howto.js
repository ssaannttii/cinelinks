// "How to play" helper: a floating "?" button (always available) + a modal.
// Auto-opens once on a player's first visit to each game (remembered per key).
// Each page sets `window.HOWTO = { key, title, html, noAuto? }` before loading this.
(function () {
  'use strict';
  var cfg = window.HOWTO;
  if (!cfg || !cfg.key) return;
  var seenKey = 'htp_' + cfg.key;

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px)';
  var box = document.createElement('div');
  box.style.cssText = 'background:#181818;border:1px solid rgba(232,160,0,.2);border-radius:14px;max-width:460px;width:100%;max-height:85vh;overflow-y:auto;padding:22px;color:#f0f0f0;font-family:Inter,-apple-system,sans-serif;box-shadow:0 24px 70px rgba(0,0,0,.5)';
  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<h2 style="font-size:1.1rem;font-weight:800;color:#e8a000;margin:0">' + cfg.title + '</h2>' +
      '<button id="howto-x" aria-label="Close" style="background:none;border:none;color:#8d8d8d;font-size:1.3rem;cursor:pointer;line-height:1">✕</button>' +
    '</div>' + cfg.html +
    '<button id="howto-go" style="margin-top:16px;width:100%;padding:11px;border:none;border-radius:10px;background:#e8a000;color:#111;font-family:inherit;font-weight:800;cursor:pointer">Got it</button>';
  overlay.appendChild(box);

  var btn = document.createElement('button');
  btn.textContent = '?';
  btn.setAttribute('aria-label', 'How to play');
  btn.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:90;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:rgba(24,24,24,.92);color:#e8a000;font-family:Inter,-apple-system,sans-serif;font-weight:800;font-size:1.1rem;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35)';

  function open() { overlay.style.display = 'flex'; }
  function close() { overlay.style.display = 'none'; try { localStorage.setItem(seenKey, '1'); } catch (_) {} }
  btn.onclick = open;
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);
  document.body.appendChild(btn);
  box.querySelector('#howto-x').onclick = close;
  box.querySelector('#howto-go').onclick = close;

  var seen = false;
  try { seen = !!localStorage.getItem(seenKey); } catch (_) {}
  if (!seen && !cfg.noAuto) setTimeout(open, 600);
})();
