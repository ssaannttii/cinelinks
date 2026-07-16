# CineSlate — Definitive Product Spec

**A daily network-building puzzle where you cast and produce a film "slate" from your own card collection.**

> One-line pitch: *Build today's production from your Vault — a fixed daily board of films, actors and directors that you fill with your own cards so every connection is a real credit.*

This spec consolidates three independent design explorations (CineSlate / CineCircuit /
CineConstellation) into a single, decided, build-ready plan, grounded in the existing
CineLinks codebase. Every fork is resolved — no "option A or B."

---

## 0. Decisions locked (read this first)

1. **Name: CineSlate.** The production/casting fantasy differentiates hardest from the core
   CineLinks game (which is route-finding). "Slate" = a studio's lineup and the clapperboard.
   (Alt considered: CineCircuit. Rejected: CineConstellation — pretty but off the "links" DNA.)
2. **It is a constraint-satisfaction graph puzzle, not a route finder and not a stat battle.**
   You fill a fixed board so every required edge is a real TMDB credit.
3. **Relationships determine validity; collection determines prestige.** Two separate scores
   (Contract Grade, Vault Prestige). This is the fairness keystone — never merge them.
4. **Shared daily board + personal fill.** Everyone gets the same board, rules, and a **Studio
   Pool** of ~12 loaner cards guaranteeing a solution. You improve it with your own cards.
5. **Person cards are structural, not optional.** The standard board has more person slots
   than title slots, and the highest-value node (the hub) is always a person.
6. **Duplicates are never consumed in ranked play.** Copies feed mastery/shine/ascension/
   prestige — the mode rewards those permanent states, it doesn't burn cards.
7. **MVP is deliberately small** (§10). Everything else is a phased expansion (§11).

---

## 1. Player fantasy

You are a producer/casting director assembling a coherent production: pick who directs,
gather leads who have actually worked together or with that director, choose reference films,
and wire it all into a network of verifiable relationships. Your collection is a toolbox —
the broader and deeper it is, the more valid solutions and higher-scoring configurations open
up. You are not finding the shortest path; you are finding the **best configuration**.

---

## 2. Why it fits CineLinks (and is distinct)

| System need | CineSlate answer |
|---|---|
| Give person cards a job | Actors & directors occupy the central, highest-value slots |
| Exploit the TMDB relationship graph | Every rule is a real credit / franchise / genre / era |
| Reward broad collections | More cards = more valid substitutions & higher ceiling |
| Reward duplicates (copies/mastery/shine/ascension) | They modify *score*, never *solvability* |

Distinct from existing modes:
- **CineLinks** (core): discover a route between two entities across the global DB. Sequential, exploratory.
- **Vault Arena**: compare a single baked stat. Numeric combat.
- **CineSlate**: build a whole network simultaneously under constraints, from a limited card set + your Vault. Constraint satisfaction + optimization.

---

## 3. The board (topology)

**MVP board = "Star System" — 7 nodes, one hub, three branches.**

```text
        [Hub Person]
        /     |     \
  Title A  Title B  Title C
     |        |        |
  Person A Person B Person C
```

- **Hub Person** (center) — an actor or director. Highest node degree (3 edges) → highest value.
- **Title A/B/C** — movie or TV cards (2 edges each).
- **Person A/B/C** — actor or director on the outer ring (1 edge each).

**Required edges (all must be true TMDB credits):**
- Hub Person → Title A, Title B, Title C  (acted in OR directed)
- Person A → Title A, Person B → Title B, Person C → Title C  (acted in OR directed)

**Board rule (one, daily):** e.g., "the three titles must be from three different decades."

**Bonus objectives (up to two, optional):** e.g., "two outer people also worked together
elsewhere," "complete the board with 5+ of your own cards."

Beginners (collector level 1–4) play a reduced **5-node** variant (hub + two title/person
branches). Same anchor/theme, so it still feels shared.

---

## 4. Connection grammar

**Mandatory edges are ONLY Person ↔ Title:**
- Actor appeared in title.
- Director directed title.

This is instantly legible and guarantees person cards matter. Nothing more obscure is ever
*required*.

**Optional / bonus edges** (never required in MVP) may include:
- Person ↔ Person: shared a title, actor–director collaboration, repeated collaboration.
- Title ↔ Title: same franchise, same director, shared principal cast.

**Board-rule predicates** (metadata, applied to nodes, not edges): decade, genre, runtime
band, release-before/after, country (deferred — TMDB gaps), media type.

**Never in MVP:** keyword/plot-similarity or any subjective link.

---

## 5. Credit rules (LOCK THESE — TMDB is messy)

These are product rules, decided now, to keep validity unambiguous:

- **Directors always count** (crew job = "Director").
- **Cast counts only when in TMDB's credited cast**, limited to the **top 25 billed** for
  *candidate display*; lower-billed valid credits still *validate* if the player finds them,
  but aren't surfaced as suggestions (prevents bit-part actors becoming universal connectors).
- **Uncredited / archive footage / "self" appearances do NOT count.**
- **TV:** any principal series credit (main cast or series director) counts; guest one-episode
  credits do not.
- **Franchise = TMDB "belongs_to_collection".**
- A single real person/title may satisfy multiple edges, but **no entity may occupy two nodes**
  on the same board.

---

## 6. The hybrid Studio Pool + Vault system (the accessibility engine)

**Studio Pool.** Each day every player receives the same ~12 temporary loaner cards
(≈4 people + ≈8 titles) that contain **at least one guaranteed full solution**. Loaners:
- Create valid factual links and count toward completion.
- Contribute **zero Vault Prestige**.
- Block the "All Vault" bonus.
- Render with a neutral house frame (visually distinct from your cards).

**Vault substitutions.** Swap any Studio card for one of *your* cards that satisfies the same
constraints. A swap can preserve the solution but raise score, open a bonus, enable a totally
different solution, or complete the board with zero loaners.

**Automatic ownership.** If a Studio Pool card is *also* one you own, treat it as a Vault card
automatically — apply its real rarity/mastery/shine, count it toward "All Vault." Never force a
manual swap of an identical card.

Onboarding by collection size:

| Collection | Experience |
|---|---|
| 0–9 cards | Board mostly prefilled with house cards |
| 10–29 | Two free loaner branches |
| 30–99 | One free loaner branch |
| 100+ | Normal; loaners always available but optional |

---

## 7. Scoring — two parallel results (do not merge)

### 7A. Contract Grade — pure puzzle skill, comparable across all players
Inputs: required links completed, board rule satisfied, bonus objectives, hints used, loaners
used, mistakes. Max is ~the same for everyone.

| Grade | Condition |
|---|---|
| S | All links + board rule + both bonuses, no hints |
| A | All links + board rule + one bonus |
| B | Contract complete |
| C | Complete but with strong assistance (multiple hints) |

Grade is **independent of rarity and collection size.**

### 7B. Vault Prestige — how much your collection contributed
- Required link satisfied by an owned card: **100**
- Bonus objective: **150**
- Each owned (non-loaner) card used: **25**
- Fully-owned board ("All Vault"): **+250**
- Rarity add: rare **+5**, elite **+10**, legendary **+15**

**Mastery = node-degree multiplier** (the key duplicate hook). Mastery multiplies the prestige
generated by the edges that *touch* that card:
- Bronze (×3 copies) **+5%**, Silver (×5) **+10%**, Gold (×10) **+20%**
- Because the hub has 3 edges and outer people have 1, a gold-mastered person in the **hub** is
  worth far more than on a leaf → real placement decisions.

**Shine = Spotlight (one per board).** You may name **one** node as Spotlight; only a card with
`shine=1` can fill it. Edges touching the Spotlight card get **×1.25**. The card gets a foil
shimmer in the completion animation and a ✨ in the share grid. Shine is thus a *visible choice*,
not a passive tax that the biggest collector wins by default.

**Ascension** simply raises effective rarity → higher base prestige. No extra subsystem.

### 7C. Vault Efficiency (Phase 2 — the sleeper hook)
`submitted prestige ÷ best valid board possible from your Vault × 100`. Shows "94% — which card
am I overlooking?" The board has only 7 slots, so the server can search the best assignment from
your eligible pool with pruning + cached relationships. Enables fair cross-collection comparison.
**Deferred to Phase 2** (compute cost + needs the relationship cache mature).

---

## 8. Game flow

1. **Brief.** Project name, the 7-node diagram, mandatory relationships, board rule, up to two
   awards, and today's Studio Pool.
2. **Build.** Tap a node → bottom drawer opens showing usable cards, sorted:
   (1) satisfies all connected edges, (2) satisfies some, (3) may be valid once neighbors fill,
   (4) invalid. Each card shows explain-chips ("Appeared in *Arrival*", "Worked with Villeneuve").
   Drawer tabs: **Studio · My Vault · Suggested**; filters by type/decade/genre/rarity; search.
3. **Live validation.** On placement: valid edges light gold, pending stay neutral, invalid go
   red; tapping an edge explains the required + actual relationship (with character name when nice).
4. **Complete → optimize.** When all required links are valid: **Submit Production** or **Improve
   the Slate** (swap loaners, set Spotlight, chase awards, find higher-mastery cards, cut fewer
   times). First satisfaction is accessible; the optimization layer is for veterans.

Mobile-first interaction: **tap node → bottom sheet → tap card → validate → swipe between
candidates.** Drag-and-drop is a desktop-only enhancement, never required.

---

## 9. Rewards & sets

**Daily reward** (respects the existing "cards used correctly become yours" logic):
- Complete the contract → receive one card used on the board, **biased toward a person card you
  don't yet own** (the mode itself creates demand for actors/directors). If you own all eligible,
  grant a copy or dust.
- Perfect Production (both awards): extra XP + dust + higher person-card odds. **Do not** grant a
  full extra card per objective (economy pacing).

**Sets integration** (Phase 2): completed sets grant *resonance* bonuses — two cards from one set
+5% prestige, three cards unique board VFX, a completed actor set unlocks a special hub frame.
Visible and desirable, never required for Grade. Gives finished sets an active use beyond the shelf.

---

## 10. MVP scope (build this first)

**Include:**
- One fixed 7-node Star System board (5-node for levels 1–4).
- Mandatory edges: acted-in / directed only.
- Node role checks (actor/director), plus **one** board rule (decade OR genre diversity).
- Daily Studio Pool of 12 cards with a guaranteed solution.
- Vault substitutions + automatic ownership.
- **One** optional award.
- Mastery as node-degree multiplier; **one** Spotlight for a shined card.
- Contract Grade + Vault Prestige.
- Shareable result grid.
- Reward biased to person cards.
- Candidate assist (compatible/partial/incompatible), with a "browse full Vault" escape hatch.

**Defer (Phase 2+):**
- Vault Efficiency; person↔person & title↔title bonus edges; multiple board shapes; country/
  language rules; set resonance; leaderboards; in-run dust sinks; duplicate-consumption plays;
  weekly/awards-season events; fully-procedural generation without review.

**The MVP validates exactly one question:** *is it satisfying to swap public cards for your own
Vault cards to build a better, more personal network?*

---

## 11. Phased roadmap (after MVP validates)

1. Person↔person & title↔title **bonus** edges.
2. Additional board shapes: **Double Bill** (two titles bridged by a shared person),
   **Director's Cut** (one director → four titles), **Ensemble** (three people → one hub title),
   **Reunion** (two people via two titles).
3. Vault Efficiency + "which card am I missing" nudge.
4. Set resonance bonuses.
5. Leaderboards — **cohorted** (see §13).
6. Weekly Production (3 linked briefs; a card used once can't repeat → rewards collection breadth)
   and Awards Season (Best Ensemble, Best Director, International Feature, Franchise Revival…).
7. Community Slate end-of-day reveals (most-used owned card, rarest substitution, surprise actor).

---

## 12. Daily themes (rotate the strategy without changing the UI)

Ensemble Cast · Director's Cut · Across the Decades · Franchise Breakout · Hidden Collaborator ·
One Degree Apart · No Superstars (bans a few hyper-connected entities so the same actors/directors
can't be a universal answer) · World Cinema (Phase 2, use sparingly re: TMDB gaps).

---

## 13. Leaderboards (Phase 2)

- **Global Contract Board** — ranks by Grade → awards → fewer cuts → fewer hints. Comparable for all.
- **Vault Board** — bracketed by collector level (1–10 / 11–25 / 26–50 / 51+), plus a personal
  percentile ("Top 12% among collectors at your level").

A single global Prestige board would let veterans dominate — never ship that.

---

## 14. Share result (no card names revealed)

```text
CineSlate #142 · Repeat Collaborators
      🎭🟨
    🔗    🔗
🎬🟪 — ✨ — 🎬🟦
   │           │
🎭⬜        🎬🟦
6/6 links · 2/2 awards
All Vault · Grade S · 1,485 prestige
```

Symbols: ⬜ common · 🟦 rare · 🟪 elite · 🟨 legendary · ✨ Spotlight · 🎭 person · 🎬 title ·
🏠 loaner · 🔗 valid link · ┄ incomplete. Colors encode rarity; types encode 🎭/🎬; no names.

---

## 15. Visual identity

The board should feel like a production wall / relationship schematic, not a form: slightly
tilted cards, cinematic connection lines (acting = single line, directing = double/clapboard mark),
a "connection confirmed" animation, states legible without color, the Spotlight sending a foil
shimmer through its edges on completion. Full 3D tilt/foil is dialed down while arranging and
returns for the completion reveal (reuse the Vault card renderer).

---

## 16. Technical model

### 16.1 Blueprint schema
```ts
type SlateNode = {
  id: string;
  allowedTypes: Array<"movie" | "tv" | "person">;
  role?: "actor" | "director" | "any";
  constraints: MetadataConstraint[];   // decade / genre / runtime / media
  degree: number;                       // edges touching this node (drives mastery weight)
};
type SlateEdge = {
  from: string; to: string;
  relationship: "acted_in" | "directed";  // MVP: person↔title only
  required: boolean;
};
type SlateBlueprint = {
  date: string; seed: string;
  nodes: SlateNode[]; edges: SlateEdge[];
  boardRule: BoardConstraint;
  awards: BoardConstraint[];             // 0–1 in MVP
  studioPool: CardRef[];                 // ~12 loaners
  houseSolution: CardRef[];              // safety solution
  spotlightNode: string;
};
```

### 16.2 Relationship layer (cache, don't call TMDB live while arranging)
Per owned card, cache (lazily, first time it's eligible — reuse the exact fetch+localStorage
pattern already shipped in CineLine's "discover" feature, and the credit fetches in CineGrid/
CineGroup): `credits (top 25 billed), director, release year, genres, franchise, media type`.
Store a bipartite `person ↔ title` edge index. Candidate query for a node =
`owned cards ∩ node type ∩ node metadata predicates ∩ linked-to-every-filled-required-neighbor`.
At 7 nodes this is cheap once cached.

### 16.3 Daily generation pipeline (THE hard part — budget most effort here)
Reuse the machinery and mindset already in **`cinegroup.html`**: it generates a constrained
film/person board and runs a **solver** (`buildCats` + `countPartitions`) to *prove* properties
about solutions, using TMDB `credits`, a `FAMOUS_ACTORS` allow-set, and `movieFilter`. Adapt it:

1. Pick a board template + an anchor entity.
2. Expand compatible entities via cached credits/metadata.
3. Construct one full valid solution (the house solution).
4. Add plausible distractors to the Studio Pool.
5. **Validate with the solver** that: a house solution exists; no duplicated entity; the
   constraints aren't contradictory; there are *several thousand* globally plausible solutions;
   **at least one all-common/rare solution exists**; no required edge relies on uncredited/flaky
   data; each branch has multiple replacement candidates; awards are achievable but not essential.
6. Compute difficulty; store blueprint + Studio Pool + house solution.

Store the daily blueprint in Redis keyed per date (mirror **`api/daily.js`** + the admin override
flow in **`api/admin.js`**), produced by a build script (mirror **`scripts/generate-challenges.js`**).
All TMDB reads go through the existing allow-listed proxy **`api/tmdb.js`** — confirm the paths you
need (`movie/{id}`, `movie/{id}/credits`, `person/{id}/combined_credits`, `tv/{id}/credits`,
`movie/{id}?…belongs_to_collection`) are on the allow-list; add any missing ones there.

### 16.4 Candidate scoring (for sorting suggestions only — never auto-solve)
```text
candidateScore = mandatoryLinksSatisfied×100 + optionalLinksSatisfied×40
               + compatibleNeighbours×20 + ownedMasteryUtility
```

---

## 17. Difficulty

- **Easy** (levels 1–4): 5 nodes, direct actor/director↔film, no board rule, several obvious candidates.
- **Standard** (the main daily): 7 nodes, one board rule, one award, plausible distractors.
- **Hard** (weekly/extra): 7 nodes, one card must satisfy 3 relations, decade/franchise constraints,
  many solutions but few complete every award.

Keep the main daily at Standard.

---

## 18. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Feels like filling six dropdowns | Spatial board, animated connections, physical cards, audio/visual feedback |
| The UI hands you the answer | Show compatible/partial/incompatible — never solve board rules, diversity, bonuses or optimization for you |
| Same superstars are the universal answer | "No Superstars" bans, recency penalty on reused entities, "Fresh Face" bonus for a card unused in 7 days |
| Veteran collections dominate | Separate Grade from Prestige; Studio Pool guarantees a public solution; cohorted leaderboards |
| Metadata rules become unreadable | Cap the contract at 3 slot constraints + 1 board rule + ≤2 bonuses |
| Mastery becomes mandatory | Mastery affects **score only, never validity**; an unmastered common must always be able to fill any compatible slot |
| Too close to CineLinks | No shortest paths, no destination targets, no free DB browsing — fixed board, simultaneous relations, owned-card inventory |
| TMDB credit inconsistencies | The locked credit rules (§5) + cached evidence + daily solver validation |
| The generator is the whole ballgame | Reuse CineGroup's solver; treat generation + validation as the bulk of the engineering budget |

---

## 19. Home-screen positioning

- **Name:** CineSlate
- **Descriptor:** *Build today's production from your Vault.*
- **Copy:** "Cast a director, leads and reference films from the cards you own — every connection
  a real credit. Complete the daily slate, satisfy its rule, and build the most prestigious
  production you can."
- **Primary CTA:** **Build Slate**
- **Result vocabulary:** Slate complete · Link confirmed · Branch complete · Contract Grade ·
  Vault Prestige · All Vault · House card · Bonus connection · Perfect Production.

---

## 20. The one principle to protect above all

> **Relationships determine validity; collection progression determines prestige.**
> The new player completes the contract with the Studio Pool. The regular player finds smart
> substitutions. The veteran chases an all-Vault, fully-optimized production. Person cards become
> essential connectors. Duplicates, mastery, shine and ascension influence *score* without ever
> gating *content*. Keep Contract Grade and Vault Prestige separate and the mode stays
> understandable, fair, and worth investing in for years.
