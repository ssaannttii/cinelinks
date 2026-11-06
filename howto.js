// "How to play" helper: a floating "?" button (always available) + a modal.
// Auto-opens once on a player's first visit to each game (remembered per key).
// Each page sets `window.HOWTO` before loading this:
//   { key, title, icon, steps:[..], example?:html, noAuto?:bool }
(function () {
  'use strict';
  // The coach beats per game: a selector on the real control and a line in five languages.
  var GUESS6 = { en: 'Type a title. Six guesses; fewer is better.', es: 'Escribe un título. Seis intentos; cuantos menos, mejor.', fr: 'Tapez un titre. Six essais ; moins, c’est mieux.', de: 'Tippe einen Titel ein. Sechs Versuche; weniger ist besser.', pt: 'Escreve um título. Seis tentativas; quanto menos, melhor.' };
  var COACH = {
    cineline: [
      { sel: '#current', t: { en: 'This film’s release year is hidden. Guess when it came out.', es: 'El año de estreno de esta película está oculto. Adivina cuándo se estrenó.', fr: 'L’année de sortie de ce film est cachée. Devinez quand il est sorti.', de: 'Das Erscheinungsjahr dieses Films ist verborgen. Rate, wann er herauskam.', pt: 'O ano de estreia deste filme está escondido. Adivinha quando saiu.' } },
      { sel: '#timeline', t: { en: 'Tap the gap on the line where it belongs: <b>older up, newer down</b>.', es: 'Toca el hueco de la línea donde encaja: <b>las antiguas arriba, las nuevas abajo</b>.', fr: 'Touchez l’espace de la ligne où il va : <b>les anciens en haut, les récents en bas</b>.', de: 'Tippe auf die Lücke in der Linie, wo er hingehört: <b>ältere oben, neuere unten</b>.', pt: 'Toca no espaço da linha onde encaixa: <b>os antigos em cima, os novos em baixo</b>.' } },
      { sel: '#timeline', t: { en: 'A right spot lights up; a wrong one drops into its true place. Nine films, then your score.', es: 'Un acierto se ilumina; un fallo cae en su sitio real. Nueve películas y tu puntuación.', fr: 'Juste, ça s’allume ; faux, il tombe à sa vraie place. Neuf films, puis votre score.', de: 'Richtig leuchtet auf, falsch rutscht an seinen echten Platz. Neun Filme, dann dein Ergebnis.', pt: 'Certo acende; errado cai no seu lugar real. Nove filmes e depois a tua pontuação.' } }
    ],
    cinegroup: [
      { sel: '#grid', t: { en: 'Sixteen films hide <b>four groups of four</b>: a saga, a director, an actor, a theme.', es: 'Dieciséis películas esconden <b>cuatro grupos de cuatro</b>: una saga, un director, un actor, un tema.', fr: 'Seize films cachent <b>quatre groupes de quatre</b> : une saga, un réalisateur, un acteur, un thème.', de: 'Sechzehn Filme verbergen <b>vier Vierergruppen</b>: eine Saga, ein Regisseur, ein Schauspieler, ein Thema.', pt: 'Dezasseis filmes escondem <b>quatro grupos de quatro</b>: uma saga, um realizador, um ator, um tema.' } },
      { sel: '#goBtn', t: { en: 'Pick four that belong together and submit.', es: 'Elige cuatro que vayan juntas y envía.', fr: 'Choisissez quatre films qui vont ensemble et validez.', de: 'Wähle vier, die zusammengehören, und bestätige.', pt: 'Escolhe quatro que combinem e envia.' } },
      { sel: '.mistakes', t: { en: 'Four mistakes end the game. “One away” means three of your four were right.', es: 'Cuatro fallos terminan la partida. «Casi» significa que tres de las cuatro eran correctas.', fr: 'Quatre erreurs et la partie s’arrête. « Presque » veut dire que trois sur quatre étaient bons.', de: 'Vier Fehler beenden das Spiel. „Knapp daneben“ heißt: drei von vier stimmten.', pt: 'Quatro erros acabam o jogo. “Quase” significa que três dos quatro estavam certos.' } }
    ],
    cinechain: [
      { sel: '.chain', t: { en: 'Start from today’s film. Add a film that <b>shares an actor</b> with it.', es: 'Empieza por la película de hoy. Añade otra que <b>comparta un actor</b> con ella.', fr: 'Partez du film du jour. Ajoutez un film qui <b>partage un acteur</b> avec lui.', de: 'Starte beim Film des Tages. Füge einen Film hinzu, der <b>einen Schauspieler</b> mit ihm teilt.', pt: 'Começa pelo filme de hoje. Junta um filme que <b>partilhe um ator</b> com ele.' } },
      { sel: '#ci', t: { en: 'Type a title here. Each actor can link only once, so spend them wisely.', es: 'Escribe un título aquí. Cada actor solo enlaza una vez, así que úsalos bien.', fr: 'Tapez un titre ici. Chaque acteur ne relie qu’une fois : dépensez-les bien.', de: 'Tippe hier einen Titel ein. Jeder Schauspieler verbindet nur einmal, also setze sie klug ein.', pt: 'Escreve um título aqui. Cada ator só liga uma vez, por isso usa-os bem.' } },
      { sel: '#timer', t: { en: 'Two minutes. The longer the chain, the better.', es: 'Dos minutos. Cuanto más larga la cadena, mejor.', fr: 'Deux minutes. Plus la chaîne est longue, mieux c’est.', de: 'Zwei Minuten. Je länger die Kette, desto besser.', pt: 'Dois minutos. Quanto mais longa a cadeia, melhor.' } }
    ],
    cinecode: [
      { sel: '#gi', t: { en: 'There is a secret film. Name any film to start decoding it.', es: 'Hay una película secreta. Nombra cualquier película para empezar a descifrarla.', fr: 'Il y a un film secret. Nommez n’importe quel film pour commencer à le décoder.', de: 'Es gibt einen geheimen Film. Nenne irgendeinen Film, um ihn zu entschlüsseln.', pt: 'Há um filme secreto. Diz qualquer filme para começares a decifrá-lo.' } },
      { sel: '.legend', t: { en: 'Each guess compares year, genre, director, cast and tags: <b>green is exact, amber is close</b>.', es: 'Cada intento compara año, género, director, reparto y etiquetas: <b>verde es exacto, ámbar es cercano</b>.', fr: 'Chaque essai compare année, genre, réalisateur, casting et tags : <b>vert = exact, ambre = proche</b>.', de: 'Jeder Versuch vergleicht Jahr, Genre, Regie, Besetzung und Tags: <b>Grün ist exakt, Bernstein nah dran</b>.', pt: 'Cada tentativa compara ano, género, realizador, elenco e etiquetas: <b>verde é exato, âmbar é perto</b>.' } },
      { sel: '.dots', t: { en: 'Six guesses. A match reveals the shared name under the row.', es: 'Seis intentos. Una coincidencia revela el nombre compartido bajo la fila.', fr: 'Six essais. Une correspondance révèle le nom commun sous la ligne.', de: 'Sechs Versuche. Ein Treffer zeigt den gemeinsamen Namen unter der Zeile.', pt: 'Seis tentativas. Uma coincidência revela o nome em comum por baixo da linha.' } }
    ],
    cinegrid: [
      { sel: '.grid', t: { en: 'Each square pairs two actors. <b>Name a film both are in.</b>', es: 'Cada casilla cruza dos actores. <b>Nombra una película en la que salgan los dos.</b>', fr: 'Chaque case croise deux acteurs. <b>Nommez un film où ils jouent tous les deux.</b>', de: 'Jedes Feld kreuzt zwei Schauspieler. <b>Nenne einen Film, in dem beide spielen.</b>', pt: 'Cada quadrado cruza dois atores. <b>Diz um filme em que ambos entrem.</b>' } },
      { sel: '#lives', t: { en: 'Five lives. A wrong film costs one; a rare pick is worth more.', es: 'Cinco vidas. Una película equivocada cuesta una; una elección rara vale más.', fr: 'Cinq vies. Un mauvais film en coûte une ; un choix rare vaut plus.', de: 'Fünf Leben. Ein falscher Film kostet eins; ein seltener Treffer zählt mehr.', pt: 'Cinco vidas. Um filme errado custa uma; uma escolha rara vale mais.' } }
    ],
    cinereel: [
      { sel: '#stage', t: { en: 'These posters belong to <b>one actor</b>. They are revealed one at a time.', es: 'Estos pósteres son de <b>un mismo actor</b>. Se revelan de uno en uno.', fr: 'Ces affiches sont celles d’<b>un même acteur</b>. Elles se dévoilent une par une.', de: 'Diese Poster gehören zu <b>einem Schauspieler</b>. Sie werden eins nach dem anderen aufgedeckt.', pt: 'Estes cartazes são de <b>um mesmo ator</b>. Revelam-se um de cada vez.' } },
      { sel: '#gi', t: { en: 'Name the actor. Fewer posters seen, better score; a reveal costs nothing but a poster.', es: 'Nombra al actor. Cuantos menos pósteres veas, mejor; revelar solo cuesta un póster.', fr: 'Nommez l’acteur. Moins d’affiches vues, meilleur score ; révéler ne coûte qu’une affiche.', de: 'Nenne den Schauspieler. Weniger gesehene Poster, bessere Wertung; ein Aufdecken kostet nur ein Poster.', pt: 'Diz o ator. Quantos menos cartazes vires, melhor; revelar só custa um cartaz.' } }
    ],
    cineclue: [
      { sel: '#clues', t: { en: 'Guess the film from its synopsis, title hidden. Wrong or skip reveals the next clue.', es: 'Adivina la película por su sinopsis, con el título oculto. Fallar o saltar revela la siguiente pista.', fr: 'Devinez le film d’après son synopsis, titre masqué. Faux ou passer révèle l’indice suivant.', de: 'Errate den Film anhand der Inhaltsangabe, Titel verborgen. Falsch oder Überspringen zeigt den nächsten Hinweis.', pt: 'Adivinha o filme pela sinopse, com o título escondido. Errar ou saltar revela a pista seguinte.' } },
      { sel: '#guessInput', t: GUESS6 }
    ],
    cineframe: [
      { sel: '#frame', t: { en: 'A frame from the film, zoomed in and blurred. It zooms out and sharpens with each guess.', es: 'Un fotograma de la película, ampliado y borroso. Se aleja y se enfoca con cada intento.', fr: 'Une image du film, zoomée et floue. Elle recule et se précise à chaque essai.', de: 'Ein Bild aus dem Film, vergrößert und unscharf. Mit jedem Versuch wird es weiter und schärfer.', pt: 'Um fotograma do filme, ampliado e desfocado. Afasta-se e fica nítido a cada tentativa.' } },
      { sel: '#guessInput', t: GUESS6 }
    ],
    cinecast: [
      { sel: '#clues', t: { en: 'Guess the film or series from its cast, one name at a time, least famous first.', es: 'Adivina la película o serie por su reparto, un nombre cada vez, del menos famoso al más.', fr: 'Devinez le film ou la série d’après le casting, un nom à la fois, du moins connu au plus connu.', de: 'Errate Film oder Serie anhand der Besetzung, ein Name nach dem anderen, die unbekanntesten zuerst.', pt: 'Adivinha o filme ou série pelo elenco, um nome de cada vez, do menos famoso ao mais.' } },
      { sel: '#guessInput', t: GUESS6 }
    ]
  };
  // Pages that set no HOWTO still get the first-run coach, keyed by their path.
  var pageKey = String(location.pathname || '').replace(/^\//, '').replace(/\.html$/, '');
  var cfg = window.HOWTO || (COACH[pageKey] ? { key: pageKey, title: 'How to play' } : null);
  if (!cfg || !cfg.key) return;
  var seenKey = 'htp_' + cfg.key;
  var lang = 'en'; try { lang = String(localStorage.getItem('clLang') || 'en').slice(0, 2); } catch (_) {}
  function L(m) { return m[lang] || m.en; }
  var hasSteps = !!(cfg.steps && cfg.steps.length);

  // ── First-run coach: a spotlight on the real controls, two or three beats, in
  //    place of a wall of rules. Each beat anchors a line of text to an element;
  //    the page dims around it. Runs once (htp_<key>); the ? button replays it on
  //    pages that have no rules modal. ──
  var CW = {
    next: { en: 'Next', es: 'Siguiente', fr: 'Suivant', de: 'Weiter', pt: 'Seguinte' },
    done: { en: 'Got it', es: 'Entendido', fr: 'Compris', de: 'Verstanden', pt: 'Entendi' },
    skip: { en: 'Skip', es: 'Saltar', fr: 'Passer', de: 'Überspringen', pt: 'Saltar' }
  };
  function coachSteps() {
    var c = cfg.coach || COACH[cfg.key];
    return c && c.length ? c : null;
  }
  var _coach = null;
  function runCoach(replay) {
    var all = coachSteps(); if (!all || _coach) return false;
    var tries = 0;
    function drawn(sel) { var e = document.querySelector(sel); var r = e && e.getBoundingClientRect(); return !!r && r.height > 4 && r.width > 4; }
    (function wait() {                                                   // the stage renders after the API answers
      var ready = all.every(function (st) { return drawn(st.sel); });
      if (!ready && ++tries < 80) return setTimeout(wait, 150);
      var steps = all.filter(function (st) { return drawn(st.sel); });  // after 12 s, whatever is on screen
      if (!steps.length) return;
      if (!replay && document.querySelector('.es, #clCollReveal.open')) return;   // the game is already over on this device
      start(steps);
    })();
    return true;
  }
  function start(steps) {
    var reduced = false; try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
    var root = document.createElement('div'); root.id = 'ht-coach';
    root.innerHTML = '<div class="htc-spot"></div><div class="htc-bub" role="dialog" aria-live="polite"><div class="htc-tx"></div><div class="htc-row"><span class="htc-dots"></span><button type="button" class="htc-skip"></button><button type="button" class="htc-go"></button></div></div>';
    document.body.appendChild(root);
    var spot = root.children[0], bub = root.children[1], tx = bub.querySelector('.htc-tx'), dots = bub.querySelector('.htc-dots'), go = bub.querySelector('.htc-go'), skip = bub.querySelector('.htc-skip');
    var i = 0, el = null;
    function place() {
      if (!el) return;
      var r = el.getBoundingClientRect(), pad = 8;
      var top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad), w = Math.min(window.innerWidth - 8, r.width + pad * 2), h = r.height + pad * 2;
      spot.style.top = top + 'px'; spot.style.left = left + 'px'; spot.style.width = w + 'px'; spot.style.height = h + 'px';
      var bh = bub.offsetHeight || 120, below = top + h + 14 + bh < window.innerHeight - 10;
      bub.classList.toggle('above', !below);
      bub.style.top = (below ? top + h + 14 : Math.max(10, top - 14 - bh)) + 'px';
      var bw = Math.min(340, window.innerWidth - 24), cx = left + w / 2;
      var bl = Math.max(12, Math.min(window.innerWidth - bw - 12, cx - bw / 2));
      bub.style.left = bl + 'px'; bub.style.width = bw + 'px';
      bub.style.setProperty('--ax', Math.max(18, Math.min(bw - 18, cx - bl)) + 'px');
    }
    function show(k) {
      i = k; var st = steps[i]; el = document.querySelector(st.sel); if (!el) { next(); return; }
      tx.innerHTML = L(st.t);
      dots.innerHTML = steps.map(function (_, j) { return '<i class="' + (j <= i ? 'on' : '') + '"></i>'; }).join('');
      go.textContent = L(i < steps.length - 1 ? CW.next : CW.done); skip.textContent = L(CW.skip); skip.style.visibility = i < steps.length - 1 ? '' : 'hidden';
      try { el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); } catch (_) {}
      setTimeout(function () { place(); root.classList.add('on'); }, reduced ? 30 : 320);
      try { if (window.Sfx) window.Sfx.tap(); } catch (_) {}
    }
    function next() { if (i < steps.length - 1) show(i + 1); else end(); }
    function end() {
      try { localStorage.setItem(seenKey, '1'); } catch (_) {}
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('keydown', onKey);
      root.classList.remove('on'); root.classList.add('off');
      setTimeout(function () { try { root.remove(); } catch (_) {} _coach = null; }, reduced ? 0 : 300);
      try { if (window.Track) window.Track('coach_done', { key: cfg.key, at: i + 1, of: steps.length }); } catch (_) {}
    }
    function onKey(e) { if (e.key === 'Escape') end(); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } }
    go.onclick = next; skip.onclick = end;
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true); document.addEventListener('keydown', onKey);
    _coach = root;
    show(0);
  }

  var css = '\
#ht-ov{position:fixed;inset:0;z-index:1200;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(6,6,6,.74);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;transition:opacity .22s ease}\
#ht-ov.show{opacity:1}\
.ht-card{background:#151417;border:0;box-shadow:0 1px 0 rgba(255,255,255,.035) inset,0 24px 60px -22px rgba(0,0,0,.95),0 0 0 1px rgba(246,221,134,.2) inset;border-radius:20px;max-width:440px;width:100%;max-height:86vh;overflow-y:auto;padding:22px 22px 20px;color:#f0f0f0;font-family:var(--fui,"Schibsted Grotesk",-apple-system,sans-serif);box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(14px) scale(.97);transition:transform .26s cubic-bezier(.2,.9,.3,1)}\
#ht-ov.show .ht-card{transform:none}\
.ht-head{display:flex;align-items:center;gap:11px;margin-bottom:16px}\
.ht-ic{width:40px;height:40px;flex-shrink:0;border-radius:12px;background:rgba(246,221,134,.08);box-shadow:0 0 0 1px rgba(246,221,134,.2) inset;display:flex;align-items:center;justify-content:center;color:var(--gold,#e8a000)}\
.ht-ic svg{width:22px;height:22px}\
.ht-title{font-family:Fraunces,Georgia,serif;font-size:1.3rem;font-weight:600;letter-spacing:-.01em;margin:0;flex:1}\
.ht-x{background:none;border:none;color:#9aa4b0;font-size:1.25rem;line-height:1;cursor:pointer;padding:2px 4px;border-radius:6px}\
.ht-x:hover{color:#f0f0f0}\
.ht-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}\
.ht-steps li{display:flex;gap:11px;align-items:flex-start;font-size:.9rem;line-height:1.5;color:#cfcfcf}\
.ht-steps b{color:#f0f0f0;font-weight:700}\
.ht-num{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:rgba(246,221,134,.1);box-shadow:0 0 0 1px rgba(246,221,134,.25) inset;color:#f6dd86;font-size:.78rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:1px}\
.ht-ex{margin-top:16px;padding:13px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}\
.ht-ex-l{display:block;font-size:.66rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#f6dd86;margin-bottom:9px}\
.ht-ex p{margin:9px 0 0;font-size:.8rem;color:#9aa4b0;line-height:1.5}\
.ht-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;background:#1b1a1e;border:1px solid rgba(255,255,255,.09);font-size:.8rem;font-weight:700;color:#f0f0f0;white-space:nowrap}\
.ht-arrow{color:#e8a000;font-weight:800;margin:0 5px}\
.ht-row{display:flex;align-items:center;flex-wrap:wrap;gap:3px}\
.ht-go{margin-top:18px;width:100%;height:46px;border:none;border-radius:11px;background:linear-gradient(135deg,#f6dd86 0%,#d9ab42 34%,#f4dc8a 58%,#b9852a 100%);box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 10px 24px -10px rgba(232,182,74,.55);color:#1a1408;font-family:inherit;font-weight:700;font-size:.95rem;cursor:pointer;transition:filter .15s}\
.ht-go:hover{filter:brightness(1.06)}\
#ht-btn{position:fixed;left:14px;bottom:14px;z-index:900;width:40px;height:40px;border-radius:12px;border:0;box-shadow:0 0 0 1px rgba(246,221,134,.22) inset,0 10px 24px -12px rgba(0,0,0,.8);background:rgba(12,11,13,.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#f6dd86;font-family:"Schibsted Grotesk",-apple-system,sans-serif;font-weight:800;font-size:1.15rem;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);transition:transform .15s,border-color .15s}\
#ht-btn:hover{transform:scale(1.06);background:rgba(20,18,22,.92)}\
@media(prefers-reduced-motion:reduce){#ht-ov,.ht-card{transition:none}}\
#ht-coach{position:fixed;inset:0;z-index:1150;opacity:0;transition:opacity .3s}\
#ht-coach.on{opacity:1}#ht-coach.off{opacity:0}\
.htc-spot{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(6,6,8,.74),0 0 0 2px rgba(246,221,134,.85),0 0 34px rgba(246,221,134,.35);transition:top .35s cubic-bezier(.2,.8,.2,1),left .35s cubic-bezier(.2,.8,.2,1),width .35s cubic-bezier(.2,.8,.2,1),height .35s cubic-bezier(.2,.8,.2,1);pointer-events:none}\
.htc-bub{position:fixed;background:#151417;border-radius:16px;padding:14px 15px 12px;box-shadow:0 0 0 1px rgba(246,221,134,.22) inset,0 24px 60px -22px rgba(0,0,0,.95);font-family:"Schibsted Grotesk",system-ui,sans-serif;color:#f2ede4;transition:top .35s cubic-bezier(.2,.8,.2,1),left .35s cubic-bezier(.2,.8,.2,1)}\
.htc-bub::before{content:"";position:absolute;top:-7px;left:var(--ax,50%);width:14px;height:14px;transform:translateX(-50%) rotate(45deg);background:#151417;box-shadow:-1px -1px 0 rgba(246,221,134,.22)}\
.htc-bub.above::before{top:auto;bottom:-7px;box-shadow:1px 1px 0 rgba(246,221,134,.22)}\
.htc-tx{font-size:.92rem;line-height:1.5}.htc-tx b{color:#f6dd86;font-weight:700}\
.htc-row{display:flex;align-items:center;gap:8px;margin-top:12px}\
.htc-dots{display:flex;gap:5px;flex:1}.htc-dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.18)}.htc-dots i.on{background:linear-gradient(135deg,#f6dd86,#d9ab42)}\
.htc-skip{background:none;border:0;color:#a59f95;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;padding:6px 8px}\
.htc-go{height:36px;padding:0 16px;border:0;border-radius:10px;font:inherit;font-size:.84rem;font-weight:700;color:#1a1408;cursor:pointer;background:linear-gradient(135deg,#f6dd86 0%,#d9ab42 34%,#f4dc8a 58%,#b9852a 100%);box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 10px 24px -10px rgba(232,182,74,.55)}\
@media(prefers-reduced-motion:reduce){#ht-coach,.htc-spot,.htc-bub{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var steps = (cfg.steps || []).map(function (s) {
    return '<li><span class="ht-num"></span><span>' + s + '</span></li>';
  }).join('');
  var nums = ''; // numbers filled after insert (counter via DOM to keep markup simple)
  var example = cfg.example ? '<div class="ht-ex"><span class="ht-ex-l">Example</span>' + cfg.example + '</div>' : '';

  var ov = document.createElement('div');
  ov.id = 'ht-ov';
  if (hasSteps) ov.innerHTML =
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

  if (hasSteps) document.body.appendChild(ov);
  document.body.appendChild(btn);
  // Shrink out of the way while the page scrolls (the pill was covering buttons
  // mid-page on phones); grows back near the top.
  (function () {
    var mini = false;
    function onScroll() {
      var m = (window.scrollY || 0) > 140;
      if (m === mini) return; mini = m;
      btn.style.transition = 'transform .2s ease, opacity .2s ease';
      btn.style.transform = m ? 'scale(.68)' : '';
      btn.style.opacity = m ? '.5' : '1';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  // number the steps
  var i = 1;
  ov.querySelectorAll('.ht-num').forEach(function (n) { n.textContent = i++; });
  void nums;

  var _htRelease = null;
  function open() { ov.style.display = 'flex'; requestAnimationFrame(function () { ov.classList.add('show'); }); try { if (window.fxTrapFocus) _htRelease = window.fxTrapFocus(ov); } catch (_) {} }
  function close() {
    ov.classList.remove('show');
    try { localStorage.setItem(seenKey, '1'); } catch (_) {}
    try { if (_htRelease) { _htRelease(); _htRelease = null; } } catch (_) {}
    setTimeout(function () { ov.style.display = 'none'; }, 240);
  }
  btn.onclick = function () { if (hasSteps) open(); else runCoach(true); };
  if (hasSteps) {
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.ht-x').onclick = close;
    ov.querySelector('.ht-go').onclick = close;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('show')) close(); });
  }

  var seen = false;
  try { seen = !!localStorage.getItem(seenKey); } catch (_) {}
  if (!seen && !cfg.noAuto) { if (!runCoach(false) && hasSteps) setTimeout(open, 650); }
})();
