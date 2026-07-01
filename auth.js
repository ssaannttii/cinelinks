// Optional Google sign-in → cross-device stats sync. LOCAL-FIRST: the games work
// fully without this; signing in only *syncs* the same localStorage stats across
// devices. Dormant until you paste your OAuth client ID below (and set the same
// value as the GOOGLE_CLIENT_ID env var on the server for /api/sync).
//
// A Google OAuth "Web application" client ID is public (not a secret), so it's
// fine to hard-code here. Get one at https://console.cloud.google.com/apis/credentials
//
// UX: a returning visitor stays visibly signed in across refreshes — we cache a
// tiny profile (name/picture) locally and render the "Synced" pill instantly
// (optimistic), then silently refresh the Google token in the background to
// re-sync. No flash of a "Sign in" button for people who are already in.
(function () {
  'use strict';
  var CLIENT_ID = '136867217006-lvud0hvsncgsitlbi0fqo8rfgge9l1hv.apps.googleusercontent.com';
  if (!CLIENT_ID) return;

  // Localised string with English fallback (i18n.js may load after us / be absent).
  function A(key, fallback) { try { return (typeof window.t === 'function' && window.t(key)) || fallback; } catch (_) { return fallback; } }
  // Let the home re-localise the account card when the language switches.
  window.refreshAuthCard = function () { try { setCardText(_lastCard.signedIn, _lastCard.name); } catch (_) {} };

  var SYNC_KEYS = (window.MergeStats && window.MergeStats.SYNC_KEYS) ||
    ['clStreak', 'cineclueStreak', 'cineframeStreak', 'cineclueState', 'cineframeState', 'clPlayed', 'cl_collection'];
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
  // The cached profile lives in the user's own browser only — never sent to us.
  function loadProfile() { try { return JSON.parse(localStorage.getItem('gauth_profile')) || null; } catch (_) { return null; } }
  function saveProfile(p) { try { localStorage.setItem('gauth_profile', JSON.stringify({ name: p.name || '', picture: p.picture || '', email: p.email || '' })); } catch (_) {} }
  function isSignedIn() { try { return !!localStorage.getItem('gauth_in'); } catch (_) { return false; } }

  // --- self-contained toast (some pages have no #toast of their own) ---
  function toast(msg) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(14px);background:#181818;border:1px solid rgba(91,189,122,.4);color:#f0f0f0;padding:11px 16px;border-radius:11px;font-family:Inter,-apple-system,sans-serif;font-size:.84rem;font-weight:600;box-shadow:0 14px 34px rgba(0,0,0,.5);opacity:0;transition:opacity .25s,transform .25s;z-index:1300';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 300); }, 3200);
  }

  // --- home account card text reflects the state (no-op on other pages) ---
  var _lastCard = { signedIn: false, name: '' };
  function setCardText(signedIn, name) {
    _lastCard = { signedIn: signedIn, name: name || '' };
    var tx = document.querySelector('.account-card .account-tx');
    if (!tx) return;
    var b = tx.querySelector('b'), span = tx.querySelector('span');
    if (!b || !span) return;
    if (signedIn) {
      b.textContent = A('authSyncedTitle', '✓ Progress synced');
      span.textContent = name ? (A('authBackedAccount', 'Backed up to your Google account · ') + name) : A('authBackedDevices', 'Backed up across your devices');
    } else {
      b.textContent = A('authSyncTitle', 'Cross-device sync');
      span.textContent = A('authSyncDesc', 'Sign in with Google to save your streaks on every device.');
    }
  }

  // --- UI host: inline slot on the home (#authInline) else a fixed pill, top-right ---
  var slot = document.createElement('div');
  var inlineHost = document.getElementById('authInline');
  if (inlineHost) {
    inlineHost.appendChild(slot);
  } else {
    var wrap = document.createElement('div');
    wrap.id = 'gauth';
    wrap.style.cssText = 'position:fixed;top:12px;right:12px;z-index:95;font-family:Inter,-apple-system,sans-serif';
    wrap.appendChild(slot);
    document.body.appendChild(wrap);
  }

  function renderSignedIn(p) {
    p = p || {};
    slot.innerHTML = '';
    var box = document.createElement('div');
    box.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:flex-end';
    var pill = document.createElement('button');
    pill.title = 'Synced as ' + (p.email || p.name || 'you');
    pill.style.cssText = 'display:flex;align-items:center;gap:7px;padding:4px 10px 4px 4px;border-radius:20px;border:1px solid rgba(232,160,0,.3);background:rgba(22,22,22,.92);color:#f0f0f0;font-family:inherit;font-size:.78rem;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.3)';
    var img = p.picture
      ? '<img src="' + p.picture + '" alt="" referrerpolicy="no-referrer" style="width:24px;height:24px;border-radius:50%;object-fit:cover">'
      : '<span style="width:24px;height:24px;border-radius:50%;background:#e8a000;color:#111;display:flex;align-items:center;justify-content:center;font-weight:800">' + ((p.name || '?')[0] || '?').toUpperCase() + '</span>';
    pill.innerHTML = img + '<span style="color:#5bbd7a">' + A('authSyncedPill', '✓ Synced') + '</span>';

    var menu = document.createElement('div');
    menu.style.cssText = 'display:none;margin-top:6px;width:236px;background:#181818;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:11px;box-shadow:0 12px 34px rgba(0,0,0,.5);color:#f0f0f0;font-size:.78rem';
    var who = p.name || p.email ? ('<p style="margin:0 0 8px;font-weight:700">' + (p.name || p.email) + '</p>') : '';
    menu.innerHTML = who +
      '<p style="margin:0 0 10px;color:#8d8d8d;font-size:.72rem;line-height:1.5">' + A('authMenuBlurb', 'Your streaks &amp; history are backed up and synced across devices. We only store game stats and your Google ID.') + ' <a href="/privacy.html" style="color:#e8a000;text-decoration:none;font-weight:700">' + A('authPrivacy', 'Privacy') + '</a></p>';
    var out = document.createElement('button');
    out.textContent = A('authSignOut', 'Sign out');
    out.style.cssText = 'width:100%;padding:8px;margin-bottom:6px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:transparent;color:#f0f0f0;font-family:inherit;font-weight:700;font-size:.78rem;cursor:pointer';
    out.onclick = signOut;
    var del = document.createElement('button');
    del.textContent = A('authDelete', 'Delete my synced data');
    del.style.cssText = 'width:100%;padding:8px;border:1px solid rgba(216,80,58,.4);border-radius:8px;background:transparent;color:#d8503a;font-family:inherit;font-weight:700;font-size:.78rem;cursor:pointer';
    del.onclick = deleteData;
    menu.appendChild(out); menu.appendChild(del);

    pill.onclick = function () { menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
    box.appendChild(pill); box.appendChild(menu);
    slot.appendChild(box);
    setCardText(true, p.name || '');
  }

  async function deleteData() {
    if (!window.confirm('Delete your synced stats from the server? Your stats on this device stay untouched.')) return;
    if (lastToken) {
      try { await fetch('/api/sync', { method: 'DELETE', headers: { Authorization: 'Bearer ' + lastToken } }); } catch (_) {}
    }
    signOut();
    toast('Synced data deleted from the server.');
  }

  function renderSignedOut() {
    slot.innerHTML = '';
    setCardText(false);
    if (window.google && window.google.accounts) {
      window.google.accounts.id.renderButton(slot, { type: 'standard', theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin' });
    }
  }

  function signOut() {
    try { if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); } catch (_) {}
    try { localStorage.removeItem('gauth_in'); localStorage.removeItem('gauth_profile'); } catch (_) {}
    lastToken = '';
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
    var p = decodeJwt(resp.credential);
    var firstTime = !isSignedIn();
    try { localStorage.setItem('gauth_in', '1'); } catch (_) {}
    saveProfile(p);
    renderSignedIn(p);
    // Only celebrate an explicit sign-in (button / one-tap), not a silent refresh.
    var explicit = !resp.select_by || /btn|user|fedcm/.test(resp.select_by);
    sync(resp.credential).then(function () {
      if (firstTime && explicit) toast('✓ Synced — your progress is backed up across your devices');
    });
  }

  // Optimistic: render the signed-in pill instantly from cache so refreshes feel
  // continuous; the token refresh + re-sync happen quietly once GIS loads.
  var cached = loadProfile();
  if (isSignedIn() && cached) renderSignedIn(cached);

  var s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true; s.defer = true;
  s.onload = function () {
    if (!window.google || !window.google.accounts) return;
    window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: true });
    if (isSignedIn()) {
      window.google.accounts.id.prompt(); // silent re-auth → fresh token → background re-sync
    } else {
      renderSignedOut(); // show the Google button
    }
  };
  document.head.appendChild(s);
})();
