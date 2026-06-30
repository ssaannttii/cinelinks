# CineLinks · Plan AAA del sistema de Cartas / Colección

> Objetivo: convertir la colección de "una galería que se llena sola" en un
> **meta-juego premium** con momento de recompensa adictivo, progresión con sentido,
> y valores de producción de producto AAA. Local-first, sin romper el motor actual.

---

## 0. Qué define "AAA" aquí (criterios de aceptación)

Una feature está "AAA-done" cuando cumple TODO esto:

1. **Tiene un momento.** Ganar una carta se *siente* — anticipación, revelado, clímax, reposo.
2. **Suena.** Cada beat tiene su cue de audio (y haptic en móvil). Silencio = no terminado.
3. **Se lee al instante.** Rareza, novedad y valor son legibles en <0.3 s sin leer texto.
4. **Tiene profundidad.** Hay una razón para volver mañana (sets, niveles, desbloqueos).
5. **Es nítido a cualquier tamaño** y respeta `prefers-reduced-motion` y mute.
6. **Es honesto.** Cada elemento de la carta informa algo real; nada es relleno.

---

## 1. Auditoría del estado actual (scorecard)

| Dimensión | Estado hoy | Veredicto |
|---|---|---|
| Engine / persistencia | Blob localStorage, dedupe, XP, nº de colección, migraciones, schema version | ✅ Sólido |
| Sistema de themes | Registry desacoplado (trading/classic/authentic) + debug panel | ✅ Sólido |
| Diseño de carta (authentic) | Full-bleed, foil, holo star, tilt, **cqw nítido a cualquier tamaño** | ✅ Bueno |
| Galería + vista detalle | Modal con nivel/XP, filtros básicos, detalle grande | 🟡 Funcional, plano |
| **Momento de ganar** | Texto "+N new · View" en la pantalla de victoria | 🔴 **Ausente** |
| **Reveal / pack-opening** | No existe | 🔴 **Ausente** |
| **Audio / haptics** | Cero. (Existe `sfx.js` en la suite, sin usar) | 🔴 **Ausente** |
| **Rareza con sentido** | Hash del id (se siente aleatoria, no ganada) | 🔴 Débil |
| **Niveles que desbloquean** | Suben, no dan nada | 🔴 **Ausente** |
| **Sets / completar colecciones** | No existen | 🔴 **Ausente** |
| **Economía de duplicados** | Dupe = +3 XP y poco más | 🔴 Débil |
| **Logros / badges / mastery** | No existen | 🔴 **Ausente** |
| **Slots vacíos / "cazar las que faltan"** | No existen | 🔴 **Ausente** |
| **Social / viralidad de carta** | No (pero hay infra OG `/api/og` + `/s`) | 🔴 Sin explotar |
| **Card-backs / foils / materiales** | Marco CSS por color de rareza | 🟡 Mejorable (PNG en camino) |
| **Sync multi-dispositivo** | localStorage; cuentas Google ya existen, sin integrar la colección | 🟡 Pendiente |
| **Onboarding** | La colección aparece sin explicar | 🔴 Ausente |

**Resumen:** la infraestructura está; falta **toda la capa de experiencia** (el porqué emocional).

---

## 2. Los pilares del plan

### Pilar 1 — El Momento de Ganar (el corazón dopamínico) 🌟

El cambio de mayor impacto. Hoy ganas cartas sin enterarte. AAA = una **secuencia de revelado**.

**Objetivo:** al terminar una partida, las cartas ganadas se revelan con anticipación → clímax → reposo, escalando con la rareza.

Features:

- **Card-reveal sequence** (ver §3 para la coreografía detallada): sobre/booster que se rasga, carta boca abajo que se voltea, destello por rareza, sello "NEW", count de XP ganado.
- **Escalado por rareza:** common = flip simple; rare = brillo azul + shimmer; elite = haz púrpura + partículas; **legendary = parón dramático, fogonazo dorado a pantalla, fanfarria, haptic largo, confetti foil**.
- **Cola de revelado:** si ganas varias (p. ej. el path de CineLinks), se revelan en secuencia con "tap para siguiente" y un resumen final ("+3 cartas · +85 XP").
- **Pity / suspense:** el reverso brilla del color de la rareza *antes* de voltearse (micro-anticipación de 250 ms) — el truco de Hearthstone.
- **Entrada en la pantalla de victoria** como recompensa, no como nota al pie.

### Pilar 2 — Rareza con Significado (ganada, no aleatoria)

Hoy la rareza es un hash del id → se siente arbitraria. AAA = la rareza se **gana**.

Modelo propuesto (determinista + meritocrático):

- **Base por dificultad/calidad del título:** popularidad/rating de TMDB (cuando esté disponible) marca un suelo de rareza.
- **Bonus por rendimiento:** resolver **bajo par** sube un escalón; el **nodo objetivo** (la meta del día) cae garantizado rare+; **racha** activa "carta brillante" (foil) ocasional.
- **"Primera del día" / daily premium:** la carta del daily oficial es de mayor rareza que las de práctica.
- **Foil variant:** cualquier carta puede caer en versión **foil** (~5%) — una capa de rareza ortogonal (coleccionas la normal Y la foil).
- Mantener el hash solo como *fallback* cuando no haya señal real.

> Esto convierte "me salió legendary" en "me la **gané**".

### Pilar 3 — Game Feel (sonido, haptics, partículas, motion)

Reusar `sfx.js` (motor WebAudio de la suite) y crear cues propios de colección:

- **Audio cues:** voltear carta, *whoosh* del sobre, stinger por rareza (4 tonos distintos, ascendentes), **fanfarria legendary**, level-up, "set completado", tap/hover de galería, cierre.
- **Haptics:** patrón corto en common, medio en rare/elite, **largo + doble en legendary**, patrón de celebración en level-up/set.
- **Partículas:** chispas foil en elite, lluvia dorada en legendary, shimmer al hover.
- **Motion:** el tilt + holo ya existen; añadir **idle float** sutil en la carta destacada y *parallax* del póster respecto al marco.
- Todo detrás de `prefers-reduced-motion` + toggle de mute (ya existe en la suite).

### Pilar 4 — Meta-progresión (la razón para volver)

Hoy XP/niveles existen pero **no hacen nada**, y no hay nada que *completar*. Esto es el motor de retención.

**4a. Niveles que desbloquean.**

- Cada nivel concede algo: **card-backs**, **temas de home**, **marcos alternativos**, **títulos/insignias de perfil**, slots de "destacada".
- Pantalla de **level-up** con celebración + "has desbloueado: X".

**4b. Sets / Colecciones (el "gotta catch 'em all").**

- Agrupar cartas en **sets**: por saga/franquicia (Marvel, Bond…), por director, por década, por género, por "reparto de la semana".
- **Vista de set** con **slots vacíos en silueta** (lo que te falta) → impulso de completar.
- **Recompensa por set completo:** XP grande + un card-back/marco exclusivo + un badge.
- **Set de la semana** (cadencia editorial, ver Pilar 8).

**4c. Economía de duplicados ("dust/shards").**

- Los duplicados generan **polvo/shards** según rareza.
- Gastar polvo en: **subir una carta a foil/gold**, **forjar** una carta concreta que te falta de un set, o **reroll** de una carta.
- Da sentido a los duplicados (hoy muertos).

**4d. Mastery de carta.**

- Cada carta sube de "nivel" con copias (×2, ×5, ×10…) → marco con estrellas, badge de mastery.

**4e. Logros / badges.**

- "Primera legendary", "100 films", "completa un set", "10 días seguidos coleccionando", "una carta foil"… con su toast + entrada en perfil.

### Pilar 5 — El Álbum / Galería (UX premium)

Hoy es un grid plano con filtros básicos. AAA = un **álbum** que da gusto hojear.

- **Sort:** recientes / rareza / nombre / nº / mastery.
- **Search** por título.
- **Filtros ampliados:** Nuevas, Duplicadas, Foil, Por set, Por completar.
- **Slots vacíos** (siluetas de lo no coleccionado) en la vista de set.
- **Vista de sets** (pestaña) con barra de progreso por set.
- **Card showcase / destacada:** elegir 1–3 cartas como "vitrina" del perfil (flair).
- **Skeleton/loading** de pósters (placeholder shimmer) para que nunca haya hueco vacío feo.
- **Métrica de cabecera:** "Colección 142/600 · Nivel 8 · 3 sets completos".
- Metáfora visual opcional: **binder/álbum** con páginas y lomos (un nivel más de producción).

### Pilar 6 — Card Craft (HQ / valores de producción)

- **Marco PNG con transparencia** (el que estás haciendo) como overlay raster → nítido a cualquier tamaño, materiales grabados por rareza. La estructura cqw ya está lista para enchufarlo.
- **Foils reales** (textura holográfica que se mueve con el tilt) por encima del póster, enmascarada.
- **Card-backs** animados (reverso de la carta para packs y para card-backs desbloqueables).
- **Materiales por rareza:** common mate, rare satinado, elite con grano metálico, legendary oro con relieve.
- **Tipografía de nombre** más rica (variable/condensada, kerning fino).
- **Sello de número de serie** estilo "###/ total" para ediciones limitadas (flavor de escasez real).
- Sombra/profundidad consistente (la carta debe sentirse un objeto físico).

### Pilar 7 — Audio design (spec corta)

Cues a sintetizar en `sfx.js` (sin assets):

`card_flip`, `pack_tear`, `rarity_common`, `rarity_rare`, `rarity_elite`, `rarity_legendary` (fanfarria), `xp_tick` (count-up), `level_up`, `set_complete`, `dust_gain`, `tap`, `hover`, `close`. Mezcla discreta, mute persistente, init en gesto.

### Pilar 8 — Social & Viralidad (explotar la infra OG)

Ya hay `/api/og` (imagen dinámica) + `/s` (unfurl). Reutilizar:

- **Compartir UNA carta:** "Acabo de conseguir [LEGENDARY] Forrest Gump #005" → OG card de esa carta. Viralidad orgánica.
- **Compartir el set completado / el level-up.**
- **Comparar colecciones** con un amigo (qué tiene cada uno; "te falta esta").
- **Leaderboard de completitud** entre amigos (cuando haya cuentas).
- **Challenge de carta:** "tengo la foil de X, ¿tú?".

### Pilar 9 — Contenido & Cadencia (frescura)

- **Set de la semana** (editorial) → razón recurrente para jugar y coleccionar.
- **Cartas de evento / temporada** (Halloween, premios, estrenos) con marco especial limitado.
- **Ediciones limitadas serial-numeradas** (#/total real entre jugadores → escasez de verdad, vía KV).
- **Pity timer**: garantizar una legendary cada N días sin una (evita la frustración).
- Job programado (ya hay `scripts/` + GH Actions) que rota el set de la semana sin curación manual.

### Pilar 10 — Sistemas & Fiabilidad

- **Sync con cuentas** (Google ya integrado en la suite): la colección viaja entre dispositivos. Añadir `cl_collection` al set de merge.
- **Integridad de guardado:** backup/restore (ya hay export/import en debug) + versión de schema + migraciones (ya hay base).
- **Performance / virtualización** del grid cuando la colección crezca a cientos (render por ventana, lazy posters).
- **Anti-bloat:** límites/compactación del blob; imágenes solo por path (ya).
- **Telemetría:** eventos `card_revealed{rarity}`, `set_completed`, `level_up`, `dust_spent`, `card_shared` para guiar con datos.

### Pilar 11 — Onboarding

- **Primera carta** con un mini-momento explicado ("¡Tu primera carta! Las consigues al ganar").
- Tooltip de la card de home la primera vez.
- Tutorial corto del álbum/sets al abrir por primera vez.

---

## 3. Spec estrella: la Secuencia de Revelado (coreografía)

El feature de mayor ROI. Timings de referencia (todo gated por reduced-motion → versión estática):

1. **Entrada (0 ms):** fondo se oscurece (scrim), aparece la(s) carta(s) **boca abajo** centradas, con un *whoosh* (`pack_tear`).
2. **Anticipación (200–450 ms):** el reverso **emite un halo del color de la rareza** que va a salir (micro-tell). Vibración corta. La intensidad del halo escala con la rareza (legendary = halo dorado intenso + leve *screen pulse*).
3. **Flip (450–800 ms):** la carta se voltea en 3D (eje Y, `cubic-bezier(.2,.8,.2,1)`), con `card_flip`. Al cruzar los 90° suena el **stinger de rareza** y, si es legendary, **parón de ~250 ms + fogonazo dorado a pantalla + fanfarria + confetti foil**.
4. **Asentamiento (800–1100 ms):** la carta cae a su sitio con un pequeño *overshoot*, el **sello "NEW"** estampa (scale-in con bounce), y el **+XP cuenta hacia arriba** (`xp_tick`).
5. **Reposo / siguiente:** "tap para siguiente" si hay cola; al final, **resumen**: "+3 cartas · +85 XP · Nivel 7 → 8" (con level-up si procede).
6. **Salida:** botones "Ver en la colección" / "Seguir".

Detalles AAA:

- El tilt/holo se activan en la carta revelada (puedes moverla con el cursor mientras la admiras).
- Legendary: además de lo anterior, **slow-zoom** y oscurecimiento del resto (foco total).
- Duplicado: en vez de "NEW", muestra "×N · +polvo" (la dupe también recompensa).
- Skippable: tap largo para saltar toda la secuencia (respeto al jugador veterano).

---

## 4. Modelo de rareza ganada (resumen accionable)

```
rarezaFinal(carta, contexto) =
  max(
    suelo_por_calidad(rating/popularidad TMDB),   // base del título
    bonus_objetivo(es la meta del día → rare+),
    bonus_bajo_par(resuelto bajo par → +1 escalón),
    bonus_racha(racha alta → posibilidad de foil)
  )
  ⊕ foil(~5% ortogonal)
  fallback: hash(id) determinista
```

Resultado: la rareza **cuenta una historia** (te la ganaste por jugar bien / por el reto del día), no es ruido.

---

## 5. Roadmap por fases (priorizado por impacto/esfuerzo)

**Fase 1 — El Momento (máximo impacto).**
Secuencia de revelado + audio/haptics + escalado por rareza + level-up celebrado. Conecta `sfx.js`.
→ *Esto solo ya transforma la sensación del producto.*

**Fase 2 — Profundidad de progresión.**
Sets + vista de sets con slots vacíos + recompensa por completar + niveles que desbloquean (card-backs/temas). Rareza ganada (Pilar 2).

**Fase 3 — Economía & mastery.**
Polvo/duplicados + forja + mastery de carta + logros/badges.

**Fase 4 — Social & contenido.**
Compartir carta (OG) + comparar/leaderboard + set de la semana + ediciones limitadas serial-numeradas (KV) + sync con cuentas.

**Fase 5 — Craft & pulido.**
Marco PNG + foils reales + card-backs animados + materiales por rareza + álbum/binder + virtualización + onboarding.

> Regla de oro: cada fase es enviable y verificable en vivo (deploy + captura) antes de la siguiente.

---

## 6. Checklist de valores de producción ("indie → premium")

- [ ] Ningún beat sin sonido (mute respetado).
- [ ] Ningún número sin count-up; ninguna barra sin transición.
- [ ] Rareza legible en <0.3 s (color + material + estrella).
- [ ] Reduced-motion = versión estática completa y digna.
- [ ] Nada de relleno: cada texto/elemento informa algo real.
- [ ] Nítido a cualquier tamaño (cqw / PNG raster).
- [ ] Estados de carga (skeleton) — nunca un hueco feo.
- [ ] Haptics en cada momento clave (móvil).
- [ ] "Una razón para volver mañana" siempre presente (set/nivel/pity).
- [ ] Compartir = se ve increíble en un chat (OG).
- [ ] Persistencia robusta + sync + backup.

---

*Documento vivo. Empezar por la Fase 1 (la Secuencia de Revelado) — es el cambio que convierte "se llena una galería" en "quiero ganar para abrir la siguiente carta".*
