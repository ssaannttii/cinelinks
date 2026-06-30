// CineLinks "collection" — the suite-wide retention meta-game. Every film, show
// and person you encounter through play becomes a collectible card: rarity frames,
// duplicates, XP and levels. Local-first (one localStorage blob, no backend, no
// accounts), and portable: any game adds to it with one call —
//
//   Collection.add([{ id, type:'movie'|'tv'|'person', name, img, rating? }])
//       → returns the array of *newly* collected cards (for a "+N new" flourish)
//   Collection.stats()        → { count, films, people, byRarity, xp, level, ... }
//   Collection.openGallery()  → opens the self-contained gallery modal
//
// The gallery UI (styles + modal DOM) is injected on demand, so a page only needs
// <script src="/collection.js"> and nothing else.
(function () {
  'use strict';
  var KEY = 'cl_collection';
  var IMG = 'https://image.tmdb.org/t/p/w185';
  var XP = { common: 10, rare: 25, elite: 50, legendary: 100, dupe: 3 };
  var ORDER = { legendary: 0, elite: 1, rare: 2, common: 3 };
  var RARITY = {
    legendary: { label: 'Legendary', ring: '#e8c24a' },
    elite: { label: 'Elite', ring: '#b58ad6' },
    rare: { label: 'Rare', ring: '#7aa6e8' },
    common: { label: 'Common', ring: 'rgba(255,255,255,.22)' }
  };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (_) { return null; } }
  function blank() { return { cards: {}, xp: 0, seen: 0 }; }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* noop */ } }
  function today() { return new Date().toISOString().slice(0, 10); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function posterUrl(p) { if (!p) return ''; return /^https?:/.test(p) ? p : IMG + p; }

  function rarityOf(it) {
    if (it.rarity && RARITY[it.rarity]) return it.rarity;
    var r = it.rating;
    if (typeof r === 'number' && r > 0) return r >= 8.3 ? 'legendary' : r >= 7.8 ? 'elite' : r >= 7 ? 'rare' : 'common';
    return 'common';
  }
  function xpForLevel(l) { return 50 * (l - 1) * (l - 1); }
  function levelFromXp(xp) { return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1; }

  function add(items) {
    if (!Array.isArray(items) || !items.length) return [];
    var s = load() || blank();
    if (!s.cards) s = blank();
    var added = [], d = today();
    items.forEach(function (it) {
      if (!it || it.id == null || !it.type) return;
      var k = it.type + ':' + it.id;
      if (s.cards[k]) {
        s.cards[k].n = (s.cards[k].n || 1) + 1;
        s.xp += XP.dupe;
      } else {
        var rar = rarityOf(it);
        s.cards[k] = { id: it.id, type: it.type, name: it.name || '', img: it.img || '', rarity: rar, n: 1, first: d, isNew: 1 };
        s.xp += XP[rar] || 10;
        added.push(s.cards[k]);
      }
      s.seen = (s.seen || 0) + 1;
    });
    save(s);
    return added;
  }

  function allCards() {
    var s = load() || blank();
    return Object.keys(s.cards || {}).map(function (k) { return s.cards[k]; });
  }

  function stats() {
    var s = load() || blank();
    var cards = Object.keys(s.cards || {}).map(function (k) { return s.cards[k]; });
    var by = { common: 0, rare: 0, elite: 0, legendary: 0 };
    var films = 0, people = 0;
    cards.forEach(function (c) { by[c.rarity] = (by[c.rarity] || 0) + 1; if (c.type === 'person') people++; else films++; });
    var lvl = levelFromXp(s.xp || 0);
    return {
      count: cards.length, films: films, people: people, byRarity: by,
      xp: s.xp || 0, level: lvl,
      xpInto: (s.xp || 0) - xpForLevel(lvl), xpSpan: xpForLevel(lvl + 1) - xpForLevel(lvl),
      newCount: cards.filter(function (c) { return c.isNew; }).length
    };
  }

  function markSeen() {
    var s = load(); if (!s || !s.cards) return;
    Object.keys(s.cards).forEach(function (k) { if (s.cards[k].isNew) delete s.cards[k].isNew; });
    save(s);
  }

  // ── Gallery modal (injected on demand) ──
  function injectStyles() {
    if (document.getElementById('clCollStyles')) return;
    var css = document.createElement('style'); css.id = 'clCollStyles';
    css.textContent =
      '#clCollModal{position:fixed;inset:0;z-index:240;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px)}' +
      '#clCollModal.open{display:flex}' +
      '.cl-coll-box{background:#161616;border:1px solid rgba(232,160,0,.22);border-radius:16px;width:100%;max-width:560px;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 28px 80px rgba(0,0,0,.55);animation:clCollIn .28s cubic-bezier(.2,.9,.3,1.1) both}' +
      '@keyframes clCollIn{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}' +
      '.cl-coll-hd{padding:18px 18px 12px;border-bottom:1px solid rgba(255,255,255,.08)}' +
      '.cl-coll-hd-top{display:flex;align-items:center;justify-content:space-between;gap:10px}' +
      '.cl-coll-title{font-size:1.1rem;font-weight:800;color:#f5f5f5}' +
      '.cl-coll-title span{color:#e8a000}' +
      '.cl-coll-x{background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;line-height:1;padding:2px 6px}' +
      '.cl-coll-x:hover{color:#f5f5f5}' +
      '.cl-coll-lvl{display:flex;align-items:center;gap:10px;margin-top:12px}' +
      '.cl-coll-lvl-badge{flex-shrink:0;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,#e8a000,#a86f00);color:#1a1200;font-weight:900;font-size:1.05rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(232,160,0,.4)}' +
      '.cl-coll-xp{flex:1;min-width:0}' +
      '.cl-coll-xp-bar{height:7px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:5px}' +
      '.cl-coll-xp-bar>i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#e8a000,#f5c542);transition:width .6s cubic-bezier(.3,.9,.3,1)}' +
      '.cl-coll-xp-l{display:flex;justify-content:space-between;font-size:.66rem;color:#9a9a9a;font-weight:700}' +
      '.cl-coll-counts{display:flex;gap:7px;flex-wrap:wrap;margin-top:13px}' +
      '.cl-coll-chip{font-size:.66rem;font-weight:800;letter-spacing:.03em;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#cfcfcf;border-radius:99px;padding:5px 11px;cursor:pointer;text-transform:uppercase}' +
      '.cl-coll-chip.on{border-color:rgba(232,160,0,.6);background:rgba(232,160,0,.14);color:#e8a000}' +
      '.cl-coll-grid{padding:14px 16px 18px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px}' +
      '.cl-coll-card{position:relative;border-radius:9px;overflow:hidden;background:#222;border:2px solid var(--cr,rgba(255,255,255,.22));animation:clCardIn .35s cubic-bezier(.2,.9,.3,1.2) both}' +
      '@keyframes clCardIn{from{opacity:0;transform:translateY(10px) scale(.94)}to{opacity:1;transform:none}}' +
      '.cl-coll-card .cc-img{width:100%;aspect-ratio:2/3;object-fit:cover;display:block;background:#2a2a2a}' +
      '.cl-coll-card.person .cc-img{aspect-ratio:1/1}' +
      '.cl-coll-card .cc-name{font-size:.62rem;font-weight:700;color:#eee;padding:5px 6px;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
      '.cl-coll-card .cc-dupe{position:absolute;top:5px;right:5px;font-size:.55rem;font-weight:800;color:#1a1200;background:#e8a000;border-radius:99px;padding:1px 6px}' +
      '.cl-coll-card .cc-new{position:absolute;top:5px;left:5px;font-size:.5rem;font-weight:800;letter-spacing:.05em;color:#1a1200;background:#7fd49a;border-radius:4px;padding:2px 5px;text-transform:uppercase}' +
      '.cl-coll-empty{padding:40px 20px;text-align:center;color:#9a9a9a;font-size:.9rem}' +
      '@media(prefers-reduced-motion:reduce){.cl-coll-box,.cl-coll-card{animation:none}.cl-coll-xp-bar>i{transition:none}}';
    document.head.appendChild(css);
  }

  function buildModal() {
    var m = document.getElementById('clCollModal');
    if (m) return m;
    m = document.createElement('div'); m.id = 'clCollModal'; m.setAttribute('role', 'dialog');
    m.innerHTML =
      '<div class="cl-coll-box">' +
        '<div class="cl-coll-hd">' +
          '<div class="cl-coll-hd-top"><div class="cl-coll-title">Your <span>collection</span></div>' +
            '<button class="cl-coll-x" aria-label="Close">&#10005;</button></div>' +
          '<div class="cl-coll-lvl"><div class="cl-coll-lvl-badge" id="clCollLvl">1</div>' +
            '<div class="cl-coll-xp"><div class="cl-coll-xp-l"><span id="clCollXpName">Level 1</span><span id="clCollXpNum"></span></div>' +
            '<div class="cl-coll-xp-bar"><i id="clCollXpFill" style="width:0%"></i></div></div></div>' +
          '<div class="cl-coll-counts" id="clCollChips"></div>' +
        '</div>' +
        '<div class="cl-coll-grid" id="clCollGrid"></div>' +
      '</div>';
    document.body.appendChild(m);
    m.querySelector('.cl-coll-x').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    return m;
  }

  var _filter = 'all';
  function render() {
    var st = stats();
    document.getElementById('clCollLvl').textContent = st.level;
    document.getElementById('clCollXpName').textContent = 'Level ' + st.level;
    document.getElementById('clCollXpNum').textContent = st.xpInto + ' / ' + st.xpSpan + ' XP';
    document.getElementById('clCollXpFill').style.width = Math.max(3, Math.min(100, st.xpSpan ? (st.xpInto / st.xpSpan) * 100 : 0)) + '%';

    var chips = [
      { k: 'all', label: 'All ' + st.count },
      { k: 'film', label: 'Films ' + st.films },
      { k: 'person', label: 'People ' + st.people },
      { k: 'legendary', label: 'Legendary ' + st.byRarity.legendary },
      { k: 'elite', label: 'Elite ' + st.byRarity.elite }
    ];
    document.getElementById('clCollChips').innerHTML = chips.map(function (c) {
      return '<button class="cl-coll-chip' + (_filter === c.k ? ' on' : '') + '" data-k="' + c.k + '">' + esc(c.label) + '</button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#clCollChips .cl-coll-chip'), function (b) {
      b.addEventListener('click', function () { _filter = b.dataset.k; render(); });
    });

    var cards = allCards().filter(function (c) {
      if (_filter === 'all') return true;
      if (_filter === 'film') return c.type !== 'person';
      if (_filter === 'person') return c.type === 'person';
      return c.rarity === _filter;
    }).sort(function (a, b) {
      return (ORDER[a.rarity] - ORDER[b.rarity]) || (a.name || '').localeCompare(b.name || '');
    });

    var grid = document.getElementById('clCollGrid');
    if (!cards.length) {
      grid.style.display = 'block';
      grid.innerHTML = '<div class="cl-coll-empty">No cards yet — play a game to start collecting films, shows and people.</div>';
      return;
    }
    grid.style.display = 'grid';
    grid.innerHTML = cards.map(function (c, i) {
      var rar = RARITY[c.rarity] || RARITY.common;
      var p = posterUrl(c.img);
      var isPerson = c.type === 'person';
      return '<div class="cl-coll-card' + (isPerson ? ' person' : '') + '" style="--cr:' + rar.ring + ';animation-delay:' + Math.min(i, 14) * 22 + 'ms" title="' + esc(c.name) + ' · ' + rar.label + '">' +
        (c.isNew ? '<span class="cc-new">New</span>' : '') +
        (c.n > 1 ? '<span class="cc-dupe">×' + c.n + '</span>' : '') +
        (p ? '<img class="cc-img" src="' + esc(p) + '" alt="" loading="lazy">' : '<div class="cc-img"></div>') +
        '<div class="cc-name">' + esc(c.name) + '</div>' +
      '</div>';
    }).join('');
  }

  function openGallery() {
    injectStyles();
    buildModal();
    _filter = 'all';
    render();
    document.getElementById('clCollModal').classList.add('open');
    try { if (window.Track) window.Track('collection_open', stats()); } catch (_) { /* noop */ }
    setTimeout(markSeen, 600); // clear "new" flags shortly after they're seen
  }
  function close() {
    var m = document.getElementById('clCollModal');
    if (m) m.classList.remove('open');
  }

  window.Collection = { add: add, stats: stats, all: allCards, openGallery: openGallery, markSeen: markSeen };
})();
