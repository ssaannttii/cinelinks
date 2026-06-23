// "How to play" helper: a floating "?" button (always available) + a modal.
// Auto-opens once on a player's first visit to each game (remembered per key).
// Each page sets `window.HOWTO` before loading this:
//   { key, title, icon, steps:[..], example?:html, noAuto?:bool }
(function () {
  'use strict';
  var cfg = window.HOWTO;
  if (!cfg || !cfg.key) return;
  var seenKey = 'htp_' + cfg.key;

  var css = '\
#ht-ov{position:fixed;inset:0;z-index:1200;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(6,6,6,.74);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;transition:opacity .22s ease}\
#ht-ov.show{opacity:1}\
.ht-card{background:linear-gradient(180deg,#1c1c1c,#161616);border:1px solid rgba(232,160,0,.22);border-radius:18px;max-width:440px;width:100%;max-height:86vh;overflow-y:auto;padding:22px 22px 20px;color:#f0f0f0;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(14px) scale(.97);transition:transform .26s cubic-bezier(.2,.9,.3,1)}\
#ht-ov.show .ht-card{transform:none}\
.ht-head{display:flex;align-items:center;gap:11px;margin-bottom:16px}\
.ht-ic{width:40px;height:40px;flex-shrink:0;border-radius:11px;background:rgba(232,160,0,.14);display:flex;align-items:center;justify-content:center;font-size:1.25rem}\
.ht-title{font-size:1.12rem;font-weight:800;letter-spacing:-.01em;margin:0;flex:1}\
.ht-x{background:none;border:none;color:#8d8d8d;font-size:1.25rem;line-height:1;cursor:pointer;padding:2px 4px;border-radius:6px}\
.ht-x:hover{color:#f0f0f0}\
.ht-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}\
.ht-steps li{display:flex;gap:11px;align-items:flex-start;font-size:.9rem;line-height:1.5;color:#cfcfcf}\
.ht-steps b{color:#f0f0f0;font-weight:700}\
.ht-num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:rgba(232,160,0,.16);color:#e8a000;font-size:.78rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px}\
.ht-ex{margin-top:16px;padding:13px;border-radius:12px;background:rgba(232,160,0,.06);border:1px solid rgba(232,160,0,.18)}\
.ht-ex-l{display:block;font-size:.6rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#e8a000;margin-bottom:9px}\
.ht-ex p{margin:9px 0 0;font-size:.8rem;color:#9a9a9a;line-height:1.5}\
.ht-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;background:#242424;border:1px solid rgba(255,255,255,.09);font-size:.8rem;font-weight:700;color:#f0f0f0;white-space:nowrap}\
.ht-arrow{color:#e8a000;font-weight:800;margin:0 5px}\
.ht-row{display:flex;align-items:center;flex-wrap:wrap;gap:3px}\
.ht-go{margin-top:18px;width:100%;padding:12px;border:none;border-radius:11px;background:#e8a000;color:#111;font-family:inherit;font-weight:800;font-size:.95rem;cursor:pointer;transition:filter .15s}\
.ht-go:hover{filter:brightness(1.06)}\
#ht-btn{position:fixed;left:14px;bottom:14px;z-index:900;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(22,22,22,.94);color:#e8a000;font-family:Inter,-apple-system,sans-serif;font-weight:800;font-size:1.15rem;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);transition:transform .15s,border-color .15s}\
#ht-btn:hover{transform:scale(1.08);border-color:rgba(232,160,0,.5)}\
@media(prefers-reduced-motion:reduce){#ht-ov,.ht-card{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var steps = (cfg.steps || []).map(function (s) {
    return '<li><span class="ht-num"></span><span>' + s + '</span></li>';
  }).join('');
  var nums = ''; // numbers filled after insert (counter via DOM to keep markup simple)
  var example = cfg.example ? '<div class="ht-ex"><span class="ht-ex-l">Example</span>' + cfg.example + '</div>' : '';

  var ov = document.createElement('div');
  ov.id = 'ht-ov';
  ov.innerHTML =
    '<div class="ht-card" role="dialog" aria-modal="true" aria-label="' + cfg.title + '">' +
      '<div class="ht-head">' +
        '<span class="ht-ic">' + (cfg.icon || '🎬') + '</span>' +
        '<h2 class="ht-title">' + cfg.title + '</h2>' +
        '<button class="ht-x" aria-label="Close">✕</button>' +
      '</div>' +
      '<ol class="ht-steps">' + steps + '</ol>' + example +
      '<button class="ht-go">Got it</button>' +
    '</div>';

  var btn = document.createElement('button');
  btn.id = 'ht-btn'; btn.textContent = '?'; btn.setAttribute('aria-label', 'How to play');

  document.body.appendChild(ov);
  document.body.appendChild(btn);
  // number the steps
  var i = 1;
  ov.querySelectorAll('.ht-num').forEach(function (n) { n.textContent = i++; });
  void nums;

  function open() { ov.style.display = 'flex'; requestAnimationFrame(function () { ov.classList.add('show'); }); }
  function close() {
    ov.classList.remove('show');
    try { localStorage.setItem(seenKey, '1'); } catch (_) {}
    setTimeout(function () { ov.style.display = 'none'; }, 240);
  }
  btn.onclick = open;
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
  ov.querySelector('.ht-x').onclick = close;
  ov.querySelector('.ht-go').onclick = close;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('show')) close(); });

  var seen = false;
  try { seen = !!localStorage.getItem(seenKey); } catch (_) {}
  if (!seen && !cfg.noAuto) setTimeout(open, 650);
})();
