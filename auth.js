// Optional Google sign-in → cross-device stats sync. LOCAL-FIRST: the games work
// fully without this; signing in only *syncs* the same localStorage stats across
// devices. Dormant until you paste your OAuth client ID below (and set the same
// value as the GOOGLE_CLIENT_ID env var on the server for /api/sync).
//
// A Google OAuth "Web application" client ID is public (not a secret), so it's
// fine to hard-code here. Get one at https://console.cloud.google.com/apis/credentials
(function () {
  'use strict';
  var CLIENT_ID = ''; // <-- paste your Google OAuth Web client ID to enable sync
  if (!CLIENT_ID) return;

  var SYNC_KEYS = (window.MergeStats && window.MergeStats.SYNC_KEYS) ||
    ['clStreak', 'cineclueStreak', 'cineframeStreak', 'cineclueState', 'cineframeState', 'clPlayed'];
  var lastToken = '';

  function readLocal() {
    var o = {};
    SYNC_KEYS.forEach(function (k) {
      try { var v = localStorage.getItem(k); if (v != null) o[k] = JSON.parse(v); } catch (_) {}
    });
    return o;
  }
  function writeLocal(blob) {
    if (!blob) return;
    SYNC_KEYS.forEach(function (k) {
      if (blob[k] != null) { try { localStorage.setItem(k, JSON.stringify(blob[k])); } catch (_) {} }
    });
  }
  function decodeJwt(t) {
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (_) { return {}; }
  }

  // --- UI: a small pill, top-right ---
  var wrap = document.createElement('div');
  wrap.id = 'gauth';
  wrap.style.cssText = 'position:fixed;top:12px;right:12px;z-index:95;font-family:Inter,-apple-system,sans-serif';
  var slot = document.createElement('div');
  wrap.appendChild(slot);
  document.body.appendChild(wrap);

  function renderSignedIn(p) {
    slot.innerHTML = '';
    var box = document.createElement('div');
    box.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:flex-end';
    var pill = document.createElement('button');
    pill.title = 'Synced as ' + (p.email || p.name || 'you');
    pill.style.cssText = 'display:flex;align-items:center;gap:7px;padding:4px 10px 4px 4px;border-radius:20px;border:1px solid rgba(232,160,0,.3);background:rgba(22,22,22,.92);color:#f0f0f0;font-family:inherit;font-size:.78rem;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.3)';
    var img = p.picture
      ? '<img src="' + p.picture + '" alt="" referrerpolicy="no-referrer" style="width:24px;height:24px;border-radius:50%;object-fit:cover">'
      : '<span style="width:24px;height:24px;border-radius:50%;background:#e8a000;color:#111;display:flex;align-items:center;justify-content:center;font-weight:800">' + ((p.name || '?')[0] || '?').toUpperCase() + '</span>';
    pill.innerHTML = img + '<span style="color:#5bbd7a">✓ Synced</span>';

    var menu = document.createElement('div');
    menu.style.cssText = 'display:none;margin-top:6px;width:230px;background:#181818;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px;box-shadow:0 12px 34px rgba(0,0,0,.5);color:#f0f0f0;font-size:.78rem';
    menu.innerHTML =
      '<p style="margin:0 0 9px;color:#8d8d8d;font-size:.72rem;line-height:1.5">Your streaks &amp; history sync across devices. We only store game stats and your Google ID — nothing else. <a href="/privacy.html" style="color:#e8a000;text-decoration:none;font-weight:700">Privacy</a></p>';
    var out = document.createElement('button');
    out.textContent = 'Sign out';
    out.style.cssText = 'width:100%;padding:8px;margin-bottom:6px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:transparent;color:#f0f0f0;font-family:inherit;font-weight:700;font-size:.78rem;cursor:pointer';
    out.onclick = signOut;
    var del = document.createElement('button');
    del.textContent = 'Delete my synced data';
    del.style.cssText = 'width:100%;padding:8px;border:1px solid rgba(216,80,58,.4);border-radius:8px;background:transparent;color:#d8503a;font-family:inherit;font-weight:700;font-size:.78rem;cursor:pointer';
    del.onclick = deleteData;
    menu.appendChild(out); menu.appendChild(del);

    pill.onclick = function () { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
    box.appendChild(pill); box.appendChild(menu);
    slot.appendChild(box);
  }

  async function deleteData() {
    if (!window.confirm('Delete your synced stats from the server? Your stats on this device stay untouched.')) return;
    if (lastToken) {
      try { await fetch('/api/sync', { method: 'DELETE', headers: { Authorization: 'Bearer ' + lastToken } }); } catch (_) {}
    }
    signOut();
  }

  function renderSignedOut() {
    slot.innerHTML = '';
    if (window.google && window.google.accounts) {
      window.google.accounts.id.renderButton(slot, { type: 'standard', theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin' });
    }
  }

  function signOut() {
    try { if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); } catch (_) {}
    try { localStorage.removeItem('gauth_in'); } catch (_) {}
    renderSignedOut();
  }

  async function sync(idToken) {
    var remote = {};
    try {
      var g = await fetch('/api/sync', { headers: { Authorization: 'Bearer ' + idToken } });
      if (g.ok) remote = (await g.json()).stats || {};
    } catch (_) {}
    var local = readLocal();
    var merged = window.MergeStats ? window.MergeStats.merge(local, remote) : Object.assign({}, remote, local);
    writeLocal(merged);
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
        body: JSON.stringify({ stats: merged })
      });
    } catch (_) {}
    if (typeof window.onStatsSync === 'function') { try { window.onStatsSync(); } catch (_) {} }
  }

  function onCredential(resp) {
    if (!resp || !resp.credential) return;
    lastToken = resp.credential;
    try { localStorage.setItem('gauth_in', '1'); } catch (_) {}
    renderSignedIn(decodeJwt(resp.credential));
    sync(resp.credential);
  }

  var s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true; s.defer = true;
  s.onload = function () {
    if (!window.google || !window.google.accounts) return;
    window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: true });
    var was = false; try { was = !!localStorage.getItem('gauth_in'); } catch (_) {}
    renderSignedOut();
    if (was) window.google.accounts.id.prompt(); // silent re-auth for returning users
  };
  document.head.appendChild(s);
})();
