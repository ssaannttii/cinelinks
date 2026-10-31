// Lobby v3: the home as today's session (see lobby.css). Renders into the
// containers in index.html #startScreen from the player's saved state: today's
// trio (lib/trio.js), the week and streak (index.html weekInfo/streakStats), and
// the cards (collection.js). It only reads; the streak, trio days and rewards are
// still written by index.html (syncDayState / claimHabitRewards).
(function () {
  'use strict';
  var IMG = 'https://image.tmdb.org/t/p/';
  var ICON = {
    cl: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    line: '<path d="M3 12h18"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/><path d="M7 7v3M17 14v3"/>',
    grp: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    chain: '<path d="M9 7H6a4 4 0 0 0 0 8h3"/><path d="M15 7h3a4 4 0 0 1 0 8h-3"/><path d="M8 11h8"/>',
    code: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h.01M12 8h4M8 12h8M8 16h5"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    reel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="6.3" r="1"/><circle cx="12" cy="17.7" r="1"/><circle cx="6.3" cy="12" r="1"/><circle cx="17.7" cy="12" r="1"/>',
    clue: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    frame: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 15 5-5 4 4 3-3 6 6"/>',
    cast: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    rating: '<path d="M12 3v18M5 7l-3 7a4 4 0 0 0 6 0L5 7zM19 7l-3 7a4 4 0 0 0 6 0l-3-7zM5 7h14"/>',
    trumps: '<rect x="3" y="4" width="11" height="16" rx="2"/><path d="M17 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/><path d="M7 9h3M7 13h5"/>'
  };
  // Art is decoration only: classics, never today's answers. Posters for the
  // portrait tiles, backdrops (no title lettering) for the wide ones.
  var MODES = {
    cl:     { n: 'CineLinks',    desc: 'descCl',     ln: 'Connect two stars through films and shows', d: '/?daily=1', p: '/?practice=1', img: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', bd: '/ejdD20cdHNFAYAN2DlqPToXKyzx.jpg', min: 4 },
    line:   { n: 'CineLine',     desc: 'descLine',   ln: 'Place films on a timeline', d: '/cineline.html', img: '/fNOH9f1aA7XRTzl1sAOx9iF553Q.jpg', bd: '/5bzPWQ2dFUl2aZKkp7ILJVVkRed.jpg', min: 3 },
    grp:    { n: 'CineGroup',    desc: 'descGroup',  ln: 'Group 16 titles into 4 connections', d: '/cinegroup.html', img: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', bd: '/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg', min: 4 },
    chain:  { n: 'CineChain',    desc: 'descChain',  ln: 'Build the longest film chain', d: '/cinechain.html', img: '/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg', bd: '/gILte6Zd7m1YneIr6MVhh30S9pr.jpg', min: 3 },
    code:   { n: 'CineCode',     desc: 'descCode',   ln: 'Decode the hidden movie', d: '/cinecode.html', img: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg', bd: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg', min: 3 },
    grid:   { n: 'CineGrid',     desc: 'descGrid',   ln: 'Name a film pairing each actor', d: '/cinegrid.html', img: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', bd: '/nlPCdZlHtRNcF6C9hzUH4ebmV1w.jpg', min: 4 },
    reel:   { n: 'CineReel',     desc: 'descReel',   ln: 'Guess the actor from their films', d: '/cinereel.html', img: '/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg', bd: '/sCzcYW9h55WcesOqA12cgEr9Exw.jpg', min: 2 },
    clue:   { n: 'CineClue',     desc: 'descClue',   ln: 'Name the film from six clues', d: '/cineclue.html', img: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', bd: '/tlm8UkiQsitc8rSuIAscQDCnP8d.jpg', min: 2 },
    frame:  { n: 'CineFrame',    desc: 'descFrame',  ln: 'Name the film from a single frame', d: '/cineframe.html', img: '/63N9uy8nd9j7Eog2axPQ8lbr3Wj.jpg', bd: '/2spEHYDcyE9r9mS7AFEscfKVDzO.jpg', min: 2 },
    cast:   { n: 'CineCast',     desc: 'descCast',   ln: 'Name the film from its cast', d: '/cinecast.html', img: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', bd: '/pNjh59JSxChQktamG3LMp9ZoQzp.jpg', min: 2 },
    rating: { n: 'Rating Games', desc: 'descRating', ln: 'Higher or Lower, Career and Guess the Score', d: '/rating/versus?mode=daily', p: '/rating', img: '/oU7Oq2kFAAlGqbU4VoAE36g4hoI.jpg', bd: '/4SyDTF02R5BepqSdQmOaNCHObzF.jpg', min: 3 },
    trumps: { n: 'Vault Arena',  desc: 'descTrumps', ln: 'Your Vault goes to battle', d: '/rating/toptrumps', p: '/rating/toptrumps?mode=arena', img: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', bd: '/9FE5eD92WfVCiivM9Pq9GVSrlWk.jpg', min: 4 }
  };
  var FAMILIES = [['lbFamConnect', ['cl', 'chain', 'line', 'grp']], ['lbFamGuess', ['code', 'clue', 'frame', 'cast', 'reel', 'grid']], ['lbFamTaste', ['trumps', 'rating']]];

  function $(id) { return document.getElementById(id); }
  function T(k, vars) {
    var s = (typeof window.t === 'function') ? window.t(k) : k;
    if (s === k && FALLBACK[k]) s = FALLBACK[k];
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  }
  // English copy of the lb* strings: on the first visit after a deploy the service
  // worker can still hand out the previous i18n.js, which doesn't have them yet.
  var FALLBACK = {"lbToday": "Today", "lbGames": "Games", "lbAlbum": "Album", "lbYou": "You", "lbNowShowing": "Now showing", "lbIntermission": "Intermission", "lbWrap": "That’s a wrap", "lbLedeStart": "Three puzzles, <b>about {m} minutes</b>. Each one holds a sealed pack.", "lbLedeMid": "{n} to go, <b>about {m} minutes</b>. Your next pack is waiting.", "lbLedeDone": "All three solved. <b>Your packs are open.</b> New programme at midnight.", "lbSession": "Today’s session", "lbOf": "{n} of 3", "lbUpNext": "Up next", "lbThen": "Then", "lbDone": "Done", "lbPlay": "Play", "lbPackOpened": "Pack opened", "lbMin": "~{n} min", "lbBonusTodo": "Finish all three for a bonus pack", "lbBonusEarned": "Bonus pack earned", "lbBonusOpened": "Bonus pack opened", "lbBonusSub": "A Rare or better, on top of the three.", "lbMore": "More games", "lbAll": "All games", "lbWeekCount": "<b>{n} of 7</b> this week · 5 earns an Elite", "lbWeekElite": "<b>{n} of 7.</b> Elite card earned.", "lbWeekPerfect": "<b>Perfect week.</b> Trophy earned.", "lbYourAlbum": "Your album", "lbCards": "cards", "lbLevel": "level", "lbNew": "new", "lbClosest": "Closest set:", "lbEvery": "Every mode", "lbGamesLede": "A daily puzzle in each, plus endless practice.", "lbFamConnect": "Connect and order", "lbFamGuess": "Name it", "lbFamTaste": "Taste and battle", "lbDaily": "Daily", "lbPractice": "Practice", "lbResult": "Result", "lbVault": "Your vault", "lbAlbLede": "{n} cards · {f} films and shows · {p} people", "lbXpTo": "{a} / {b} XP to level {l}", "lbRecent": "Recent", "lbSets": "Sets", "lbOpenFull": "Open the full album", "lbAlbEmpty": "Win any daily puzzle to open your first pack.", "lbSetsEmpty": "Own one card of a set to discover it.", "lbComplete": "Complete", "lbDayStreak": "day streak", "lbBest": "best streak", "lbThisWeek": "this week", "lbProfile": "Profile and settings", "lbTrophies": "Trophies", "lbArchive": "Past puzzles", "lbCreate": "Create your own", "lbLanguage": "Language", "lbNoStreak": "No streak yet", "lbShare": "Share today", "lbClicks": "{n} clicks", "lbClick1": "1 click", "lbSolvedIn": "Solved in {n}", "lbMissed": "Missed", "lbMistakes": "{n} mistakes", "lbChainOf": "Chain of {n}", "lbFilled": "{n}/9 filled", "lbDoneToday": "Done today", "lbToday2": "Today", "lbCredits": "Credits", "lbCopied": "Copied ✓"};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ic(k) { return '<svg class="lb-i" viewBox="0 0 24 24">' + (ICON[k] || ICON.cl) + '</svg>'; }
  var CHECK = '<svg class="lb-i" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';
  var ARROW = '<svg class="lb-i" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function poster(k, size) { return 'url(' + IMG + (size || 'w500') + MODES[k].img + ')'; }
  function backdrop(k, size) { return 'url(' + IMG + (size || 'w780') + MODES[k].bd + ')'; }
  function line(k) { var s = T(MODES[k].desc); return s === MODES[k].desc ? MODES[k].ln : s; }
  function C() { return window.Collection || null; }
  function uiLang() { try { return localStorage.getItem('clLang') || 'en-US'; } catch (_) { return 'en-US'; } }
  function pack(k, o) {
    o = o || {};
    return '<div class="lb-pack' + (o.opened ? ' opened' : '') + (o.bonus ? ' bonus' : '') + '" aria-hidden="true"><span class="cr t"></span><span class="seal">' + (o.opened ? CHECK : ic(k)) + '</span>' +
      (o.label ? '<span class="nm">' + esc(o.label) + '</span>' : '') + '<span class="cr b"></span></div>';
  }

  // ── today's results, read from each game's own saved state ──
  function result(k) {
    if (k === 'rating' || k === 'trumps') {
      var td = (window.Trio ? Trio.dailyKey() : '').replace(/-/g, ''), s0;
      try { s0 = JSON.parse(localStorage.getItem(k === 'rating' ? 'cinerating_daily' : 'toptrumps_daily')); } catch (_) { s0 = null; }
      if (k === 'rating') { var m = (s0 && s0.date === td && s0.modes) ? ['versus', 'career', 'game'].filter(function (x) { return s0.modes[x]; }).length : 0; return { done: m >= 3, txt: m ? m + '/3' : '' }; }
      var dn = !!(s0 && s0.date === td); return { done: dn, txt: dn ? (s0.mine | 0) + '–' + (s0.cpu | 0) : '' };
    }
    var r = Trio.result(k), s = r.s || {};
    if (!r.done) return { done: false };
    var txt;
    if (k === 'cl') txt = s.clicks === 1 ? T('lbClick1') : T('lbClicks', { n: s.clicks });
    else if (k === 'line') txt = s.score != null ? s.score + '/10' : T('lbDone');
    else if (k === 'grid') txt = T('lbFilled', { n: s.filled || 0 });
    else if (k === 'chain') txt = T('lbChainOf', { n: s.length || 0 });
    else if (k === 'grp') txt = s.won ? T('lbMistakes', { n: s.mistakes || 0 }) : T('lbMissed');
    else if (k === 'clue' || k === 'frame' || k === 'cast') txt = s.solved ? T('lbSolvedIn', { n: Array.isArray(s.results) ? Math.min(6, s.results.length) : '?' }) : T('lbMissed');
    else txt = s.won ? T('lbSolvedIn', { n: s.score || '?' }) : T('lbMissed');
    return { done: true, txt: txt };
  }
  function play(k, practice) {
    if (k === 'cl') { try { if (practice) game.startRandom(); else game.startDaily(); } catch (_) { location.href = practice ? '/?practice=1' : '/?daily=1'; } return; }
    var M = MODES[k]; location.href = practice ? (M.p || M.d + '?practice=1') : M.d;
  }

  // ── TODAY ──
  function renderToday() {
    var p = Trio.progress(), keys = p.slots, modes = p.modes;
    var res = modes.map(result), doneN = p.count, nextI = p.next;
    var lang = uiLang();
    try { $('lbDate').textContent = new Date().toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }); } catch (_) { $('lbDate').textContent = new Date().toDateString(); }
    var mins = modes.reduce(function (s, m, i) { return s + (res[i].done ? 0 : MODES[m].min); }, 0);
    if (doneN === 3) { $('lbMastH').textContent = T('lbWrap'); $('lbMastL').innerHTML = T('lbLedeDone'); }
    else if (doneN === 0) { $('lbMastH').textContent = T('lbNowShowing'); $('lbMastL').innerHTML = T('lbLedeStart', { m: mins }); }
    else { $('lbMastH').textContent = T('lbIntermission'); $('lbMastL').innerHTML = T('lbLedeMid', { n: 3 - doneN, m: mins }); }
    $('lbSessH').textContent = T('lbSession');
    $('lbSessCt').innerHTML = T('lbOf', { n: '<b>' + doneN + '</b>' });
    $('lbShare').hidden = doneN === 0; $('lbShare').textContent = T('lbShare');

    $('lbSteps').innerHTML = modes.map(function (m, i) {
      var M = MODES[m], r = res[i], isNext = i === nextI;
      var foot = r.done
        ? '<span class="res"><span class="ok">' + CHECK + '</span>' + esc(r.txt || T('lbDone')) + '</span><span class="pz">' + T('lbPackOpened') + '</span>'
        : isNext ? '<span class="lb-leaf">' + T('lbPlay') + ' ' + ARROW + '</span><span class="pz">' + T('lbMin', { n: M.min }) + '</span>'
          : '<span class="play-s">' + T('lbPlay') + ' ' + ARROW + '</span><span class="pz">' + T('lbMin', { n: M.min }) + '</span>';
      return '<a class="lb-step ' + (r.done ? 'done' : isNext ? 'next' : '') + '" href="' + (m === 'cl' ? '/?daily=1' : M.d) + '" data-play="' + m + '" style="--bd:' + backdrop(m, isNext ? 'w1280' : 'w780') + '">' +
        '<span class="art"></span>' + pack(m, { opened: r.done, label: isNext ? M.n : '' }) +
        '<div><div class="k">' + (r.done ? T('lbDone') : isNext ? T('lbUpNext') : T('lbThen')) + ' · ' + T('lbOf', { n: i + 1 }) + '</div>' +
        '<div class="nm2">' + esc(M.n) + '</div><div class="ln">' + esc(line(m)) + '</div><div class="ft">' + foot + '</div></div></a>';
    }).join('');

    var claimed = !!(C() && C().rewardClaimed && C().rewardClaimed('trio:' + Trio.udNow()));
    $('lbBonus').className = 'lb-bonus' + (doneN === 3 ? ' won' : '');
    $('lbBonus').innerHTML = pack('cl', { bonus: true, opened: doneN === 3 && claimed }) +
      '<div><div class="t">' + (doneN === 3 ? (claimed ? T('lbBonusOpened') : T('lbBonusEarned')) : T('lbBonusTodo')) + '</div><div class="s">' + T('lbBonusSub') + '</div></div>';

    $('lbMoreH').textContent = T('lbMore'); $('lbMoreAll').textContent = T('lbAll');
    var rest = ['line', 'grp', 'chain', 'code', 'grid', 'reel', 'clue', 'frame', 'cast', 'rating', 'trumps'].filter(function (k) { return modes.indexOf(k) < 0; });
    $('lbRail').innerHTML = rest.map(function (k) {
      var M = MODES[k], r = result(k);
      return '<a class="lb-tile" href="' + M.d + '" data-play="' + k + '"><div class="ps" style="--pp:' + poster(k, 'w342') + ';--bb:' + backdrop(k, 'w780') + '"><span class="ic">' + ic(k) + '</span>' + (r.done ? '<span class="dn">' + CHECK + '</span>' : '') + '</div>' +
        '<div class="tn">' + esc(M.n) + '</div><div class="tl">' + esc(r.done ? (r.txt || T('lbDoneToday')) : line(k)) + '</div></a>';
    }).join('');

    renderWeek();
    $('lbBadge').hidden = doneN === 3; $('lbBadge').textContent = 3 - doneN;
    renderTeaser();
  }
  function renderWeek() {
    var w = (typeof weekInfo === 'function') ? weekInfo() : { marks: [], count: 0 };
    var L = [1, 2, 3, 4, 5, 6, 7].map(function (i) { try { return new Date(Date.UTC(2024, 0, i)).toLocaleDateString(uiLang(), { weekday: 'narrow', timeZone: 'UTC' }); } catch (_) { return 'MTWTFSS'[i - 1]; } });
    $('lbWeek').innerHTML = '<div class="lb-week-row">' + w.marks.map(function (m, i) {
      return '<div class="lb-wd ' + (m.done ? 'done ' : '') + (m.today ? 'today ' : '') + (!m.done && m.past ? 'miss' : '') + '"><i>' + (m.done ? CHECK : '') + '</i>' + L[i] + '</div>';
    }).join('') + '</div><div class="lb-week-foot"><span>' + (w.count >= 7 ? T('lbWeekPerfect') : w.count >= 5 ? T('lbWeekElite', { n: w.count }) : T('lbWeekCount', { n: w.count })) + '</span>' +
      '<span class="lb-week-bar"><span style="width:' + Math.min(100, w.count / 5 * 100) + '%"></span></span></div>';
  }
  function newest(n) { var c = C(); return c && c.cardHtml ? c.all().slice().sort(function (a, b) { return (b.no || 0) - (a.no || 0); }).slice(0, n) : []; }
  function nearestSet() { var c = C(); if (!c || !c.sets) return null; return c.sets().filter(function (s) { return s.discovered && !s.complete; }).sort(function (a, b) { return b.pct - a.pct; })[0] || null; }
  function renderTeaser() {
    var c = C(), el = $('lbAlbTeaser'); if (!c) { el.innerHTML = ''; return; }
    var st = c.stats(), cards = newest(5), near = nearestSet();
    var fan = cards.length ? cards.map(function (cd, i, a) {
      var o = i - (a.length - 1) / 2, rot = o * 7, x = o * 30, y = Math.abs(o) * 6;
      return '<div class="fc" style="transform:translateX(' + x + 'px) translateY(' + y + 'px) rotate(' + rot + 'deg);--t2:translateX(' + (x * 1.35) + 'px) translateY(' + (y - 6) + 'px) rotate(' + (rot * 1.3) + 'deg);z-index:' + (10 - Math.abs(Math.round(o))) + '">' + c.cardHtml(cd, i) + '</div>';
    }).join('') : '<div class="lb-empty-fan">?</div>';
    el.innerHTML = '<div class="lb-fan">' + fan + '</div><div><div class="lb-eyebrow" style="margin-bottom:10px">' + T('lbYourAlbum') + '</div>' +
      '<div class="lb-nums"><div><b>' + st.count + '</b><span>' + T('lbCards') + '</span></div><div><b>' + st.level + '</b><span>' + T('lbLevel') + '</span></div>' + (st.newCount ? '<div><b>' + st.newCount + '</b><span>' + T('lbNew') + '</span></div>' : '') + '</div>' +
      (near ? '<div class="lb-near">' + T('lbClosest') + ' <b>' + esc(near.name) + '</b> · ' + near.owned + '/' + near.total + '</div><div class="lb-bar"><span style="width:' + Math.round(near.pct * 100) + '%"></span></div>' : '') + '</div>';
  }

  // ── GAMES ──
  function renderGames() {
    var tm = Trio.progress().modes;
    $('lbGamesK').textContent = T('lbEvery'); $('lbGamesH').textContent = T('lbGames'); $('lbGamesL').textContent = T('lbGamesLede');
    $('lbFams').innerHTML = FAMILIES.map(function (f) {
      return '<section class="lb-sec"><div class="lb-sec-h"><h2 class="lb-h2">' + T(f[0]) + '</h2></div><div class="lb-ggrid">' + f[1].map(function (k) {
        var M = MODES[k], r = result(k);
        return '<div class="lb-gcard' + (r.done ? ' is-done' : '') + '"><a class="ps" href="' + M.d + '" data-play="' + k + '" style="background-image:' + poster(k) + '">' + (tm.indexOf(k) >= 0 ? '<span class="tag">' + T('lbToday2') + '</span>' : '') +
          '<div class="cap"><div class="nm2">' + esc(M.n) + '</div><div class="ln">' + esc(r.done ? (r.txt || T('lbDoneToday')) : line(k)) + '</div></div></a>' +
          '<div class="row"><a class="d" href="' + M.d + '" data-play="' + k + '">' + (r.done ? T('lbResult') : T('lbDaily')) + '</a><a class="p" href="' + (M.p || M.d + '?practice=1') + '" data-play="' + k + '" data-practice="1">' + T('lbPractice') + '</a></div></div>';
      }).join('') + '</div></section>';
    }).join('');
  }

  // ── ALBUM ──
  var albumCards = [];
  function renderAlbum() {
    var c = C(); if (!c) return;
    var st = c.stats(), pct = st.xpSpan ? Math.round(st.xpInto / st.xpSpan * 100) : 0;
    $('lbAlbK').textContent = T('lbVault'); $('lbAlbH').textContent = T('lbAlbum');
    $('lbAlbL').textContent = T('lbAlbLede', { n: st.count, f: st.films, p: st.people });
    $('lbAlbLvl').innerHTML = '<div class="ring" style="--p:' + pct + '"><b>' + st.level + '</b></div><div><div class="t">' + T('lbLevel').replace(/^./, function (x) { return x.toUpperCase(); }) + ' ' + st.level + '</div><div class="s">' + T('lbXpTo', { a: st.xpInto, b: st.xpSpan, l: st.level + 1 }) + '</div></div>';
    $('lbSegRecent').textContent = T('lbRecent'); $('lbSegSets').textContent = T('lbSets'); $('lbOpenFull').textContent = T('lbOpenFull');
    albumCards = newest(36);
    $('lbCgrid').innerHTML = albumCards.length ? albumCards.map(function (cd, i) { return '<div class="cc" data-i="' + i + '">' + c.cardHtml(cd, i) + '</div>'; }).join('') : '<p class="lb-lede">' + T('lbAlbEmpty') + '</p>';
    if (c.mountCards) c.mountCards($('lbCgrid'));
    var sets = (c.sets ? c.sets() : []).filter(function (s) { return s.discovered; }).sort(function (a, b) { return (b.complete - a.complete) || (b.pct - a.pct); });
    $('lbSets').innerHTML = sets.length ? sets.map(function (s) {
      return '<div class="lb-setrow' + (s.complete ? ' full' : '') + '"><div class="top2"><span class="nm2">' + esc(s.name) + '</span><span class="ct">' + (s.complete ? T('lbComplete') : s.owned + '/' + s.total) + '</span></div><div class="lb-bar"><span style="width:' + Math.round(s.pct * 100) + '%"></span></div></div>';
    }).join('') : '<p class="lb-lede">' + T('lbSetsEmpty') + '</p>';
  }

  // ── YOU ──
  function renderYou() {
    var c = C(), st = c ? c.stats() : { level: 1, count: 0 }, s = (typeof streakStats === 'function') ? streakStats() : { cur: 0, best: 0 };
    var nick = (c && c.nickname && c.nickname()) || '';
    $('lbYouAv').textContent = (nick[0] || String(st.level)).toUpperCase();
    $('lbYouName').textContent = nick || (T('lbLevel').replace(/^./, function (x) { return x.toUpperCase(); }) + ' ' + st.level);
    $('lbYouSub').textContent = st.count + ' ' + T('lbCards');
    var w = (typeof weekInfo === 'function') ? weekInfo().count : 0;
    $('lbYouStats').innerHTML = [[s.cur, T('lbDayStreak')], [s.best, T('lbBest')], [st.count, T('lbCards')], [w + '/7', T('lbThisWeek')]].map(function (x) { return '<div class="lb-stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('');
    [['lbYouProfile', 'lbProfile'], ['lbYouTro', 'lbTrophies'], ['lbYouArch', 'lbArchive'], ['lbYouCreate', 'lbCreate']].forEach(function (x) { var el = $(x[0]); if (el) el.querySelector('span').textContent = T(x[1]); });
    $('lbLangH').textContent = T('lbLanguage');
    var cur = uiLang();
    Array.prototype.forEach.call(document.querySelectorAll('#lbLangs .lang-btn'), function (b) { b.classList.toggle('active', b.dataset.lang === cur); });
  }

  // ── header ──
  function renderTop() {
    var s = (typeof streakStats === 'function') ? streakStats() : { cur: 0, set: new Set() }, c = C(), st = c ? c.stats() : { level: 1, newCount: 0 };
    var today = s.set && s.set.has && s.set.has(Trio.udNow());
    $('lbStreak').className = 'lb-streak' + (s.cur && today ? '' : ' cold');
    $('lbStreak').innerHTML = s.cur ? '🔥 ' + s.cur : T('lbNoStreak');
    $('lbMe').innerHTML = esc(st.level) + (st.newCount ? '<i class="dot"></i>' : '');
    [['today', 'lbToday'], ['games', 'lbGames'], ['album', 'lbAlbum'], ['you', 'lbYou']].forEach(function (x) {
      Array.prototype.forEach.call(document.querySelectorAll('[data-lb-go="' + x[0] + '"] .lbl'), function (el) { el.textContent = T(x[1]); });
    });
  }

  // ── router: hash tabs, but #/ deep links of the game (?daily etc.) are untouched ──
  var VIEWS = ['today', 'games', 'album', 'you'], current = 'today';
  function go(v, push) {
    if (VIEWS.indexOf(v) < 0) v = 'today';
    current = v;
    VIEWS.forEach(function (x) { var el = $('lb-' + x); if (el) el.classList.toggle('on', x === v); });
    Array.prototype.forEach.call(document.querySelectorAll('.lb-tnav [data-lb-go],.lb-bnav [data-lb-go]'), function (a) { if (a.dataset.lbGo === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (v === 'album') renderAlbum();
    if (v === 'you') renderYou();
    if (v === 'games') renderGames();
    var h = v === 'today' ? '' : '#' + v;
    if (push !== false && location.hash !== h) history.pushState(null, '', location.pathname + location.search + h);
    if (push !== false) window.scrollTo(0, 0);
  }

  function render() {
    if (!$('lbSteps') || !window.Trio) return;
    try { renderTop(); } catch (e) { console.warn('lobby top', e); }
    try { renderToday(); } catch (e) { console.warn('lobby today', e); }
    if (current === 'games') try { renderGames(); } catch (_) {}
    if (current === 'album') try { renderAlbum(); } catch (_) {}
    if (current === 'you') try { renderYou(); } catch (_) {}
  }

  function bind() {
    var root = $('startScreen'); if (!root || root._lbBound) return; root._lbBound = true;
    root.addEventListener('click', function (e) {
      var g = e.target.closest('[data-lb-go]'); if (g) { e.preventDefault(); go(g.dataset.lbGo); return; }
      var p = e.target.closest('[data-play]');
      if (p) { var k = p.dataset.play; if (k === 'cl') { e.preventDefault(); play('cl', !!p.dataset.practice); } return; }
      var cc = e.target.closest('#lbCgrid .cc'); if (cc && C() && C().openCard) { var cd = albumCards[+cc.dataset.i]; if (cd) C().openCard(cd, cc.firstElementChild, albumCards); return; }
      if (e.target.closest('#lbAlbTeaser')) { go('album'); return; }
      if (e.target.closest('#lbWeek')) { try { openStreakModal(); } catch (_) {} return; }
      if (e.target.closest('#lbMe')) { try { openProfile(); } catch (_) {} return; }
      if (e.target.closest('#lbOpenFull')) { if (C()) C().openGallery(); return; }
      if (e.target.closest('#lbYouProfile')) { try { openProfile(); } catch (_) {} return; }
      if (e.target.closest('#lbYouTro')) { if (C() && C().openAchievements) C().openAchievements(); return; }
      if (e.target.closest('#lbYouArch')) { try { game.openArchive(); } catch (_) {} return; }
      if (e.target.closest('#lbYouCreate')) { try { creator.open(); } catch (_) {} return; }
      if (e.target.closest('#lbShare')) { share(); return; }
      var seg = e.target.closest('.lb-seg button');
      if (seg) {
        Array.prototype.forEach.call(document.querySelectorAll('.lb-seg button'), function (x) { x.setAttribute('aria-selected', String(x === seg)); });
        $('lbSegR').hidden = seg.dataset.seg !== 'recent'; $('lbSegS').hidden = seg.dataset.seg !== 'sets';
      }
    });
    window.addEventListener('popstate', function () { var v = location.hash.slice(1); if (VIEWS.indexOf(v) >= 0 || !v) go(v || 'today', false); });
  }
  function share() {
    try {
      var items = metaItems(), trio = dailyTrio(), done = trio.filter(function (k) { return trioSlotDone(items, k); }).length;
      var txt = shareTodayText(items, done, 3, streakStats().cur);
      if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
      try { navigator.clipboard.writeText(txt); } catch (_) {}
      var b = $('lbShare'); b.textContent = T('lbCopied'); setTimeout(function () { b.textContent = T('lbShare'); }, 1600);
    } catch (_) {}
  }

  function init() {
    bind();
    var v = location.hash.slice(1);
    go(VIEWS.indexOf(v) >= 0 ? v : 'today', false);
    render();
  }
  window.Lobby = { render: render, go: go };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  // collection.js may arrive after us; the album teaser fills in when it does
  window.addEventListener('load', function () { render(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) render(); });
})();
