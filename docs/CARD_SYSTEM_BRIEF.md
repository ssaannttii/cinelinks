# CineLinks — Card System Brief (for designing a new game mode)

This document describes the collectible-card system in **CineLinks**, a daily film-puzzle
web game. The goal: give another designer everything needed to invent a **new game mode
that uses the cards**. It assumes no prior knowledge of the codebase.

---

## 1. What the cards are

Players collect **trading cards of real films and people** (actors & directors). You earn
cards by *playing and winning the daily film games* — the films/people you used correctly
get added to your personal **Collection** (a.k.a. the "Vault"). Cards are **earned by play,
never purchased.**

Two card kinds:
- **Title cards** — a movie or TV show.
- **Person cards** — an actor or a director.

> Note: person cards are currently **under-used** compared to title cards. A mode that
> leans on actors/directors would fill a real gap.

Every card corresponds to a real **TMDB** (The Movie Database) entity, so it carries a
stable `id` you can use to pull rich metadata (see §4).

---

## 2. Card data model

Each owned card is stored as a record keyed `type:id` (e.g. `movie:578`, `person:31`):

| Field   | Meaning |
|---------|---------|
| `id`    | TMDB id |
| `type`  | `movie` \| `tv` \| `person` |
| `name`  | Display name |
| `img`   | Poster path (titles) or profile path (people) |
| `rarity`| `common` \| `rare` \| `elite` \| `legendary` |
| `n`     | **Copies owned** (duplicates stack here) |
| `no`    | Sequential collection number (the card's "#") |
| `first` | Date first collected (YYYY-MM-DD) |
| `shine` | 0/1 — a cosmetic "shined" upgrade bought with dust |
| `asc`   | How many times this card was ascended (see §3) |
| `i18n`  | Localized names |

**Rarity accent colors:** legendary `#e8c24a` · elite `#b58ad6` · rare `#7aa6e8` · common `#9aa3ad`.

Rarity is assigned when a card is first earned (derived from the film's popularity/rating,
with "pity" timers that guarantee an occasional elite/legendary so dry streaks self-correct).

---

## 3. Progression & economy tied to cards

These are the existing "power/value" levers — a new mode can lean on any of them:

- **XP / Level.** Each new card grants XP (common 10 / rare 25 / elite 50 / legendary 100;
  a duplicate grants +5). XP drives a collector Level.
- **Copies & Mastery.** Duplicates stack in `n`. Copy thresholds unlock **mastery tiers**:
  ×3 = bronze, ×5 = silver, ×10 = gold. Mastery visibly upgrades the card's material
  (rim/foil) and gives combat perks in the existing battler.
- **Dust.** Duplicates also convert to **dust**, a soft currency (common 5 / rare 15 /
  elite 40 / legendary 100 per dupe).
- **Shine.** Spend dust to give an owned card a permanent cosmetic sparkle. Cost scales by
  rarity and is *discounted the more copies of that card you hold*.
- **Ascension.** Spend **spare copies** of a rarity to promote one owned card up a tier
  (common→rare, rare→elite). **Capped below legendary** — legendaries are pull-only, so
  they stay special.
- **Vault depth.** Total spare copies (a prestige stat).

**Design note:** rarity, copies/mastery, shine and ascension are the natural knobs for
"my collection makes me stronger/able-to-do-more" — without being pay-to-win, since all of
it is earned by playing.

---

## 4. Rich metadata available per card

Because each card is a TMDB entity, a mode can use far more than the stored fields. Already
in use elsewhere (the battler bakes these per title): **release year, genre(s), runtime,
average rating, vote count, revenue, budget.** Also fetchable on demand: **director, full
cast, franchise/collection membership, keywords, overview/tagline.**

Relationship data is the richest seam: **who acted in / directed what**, **shared cast/crew
between two titles**, **franchise membership**, **era/decade**. (The whole game brand is
about *connections* between films and people.)

---

## 5. Sets

Cards group into **Sets** — curated **franchise** sets (e.g., a saga's films) and **cast**
sets (an actor's key films). Completing a set awards an XP bonus and a celebration. There
are also passive **milestone** sets. Sets are a natural target/objective structure.

---

## 6. How cards are already used (so a new mode is distinct)

- **Collection gallery** — browse your cards as 3D holo cards (a "spine" layout: rarity
  stripes + vertical meta + number on a left rail, poster in the art zone, rarity-based
  foil/holo/frame, tilt & shader VFX). Card backs are a film "countdown-leader" motif with
  selectable materials.
- **Sets, Achievements/Trophies, Showcase** (pin up to 6 favorites), **Card backs** (cosmetic).
- **Vault Arena** — a Top-Trumps-style battler vs CPU/recorded rival decks. **Your collection
  IS your deck.** Cards duel on a chosen baked stat (rating/votes/revenue/budget/runtime).
  Rarity, mastery (copies) and shine give combat perks. "Loaner" house cards fill gaps when
  your collection is small.
- **Dust economy** — shine / forge missing set cards / ascension.

A new mode should give the cards a use **distinct from a stat-battler and from the trophy shelf.**

---

## 7. Constraints & guidance for a new mode

- **Collections vary wildly.** New players own few cards; veterans own hundreds. A mode must
  degrade gracefully for small collections — e.g., allow "loaner/house" cards to fill in
  (as the battler does), or be forgiving about what's required.
- **Two formats exist to pick from:**
  - *Daily puzzle* — same seeded challenge for everyone (fair, shareable, leaderboard-able).
  - *Personal-collection* — plays off exactly what you own (the battler's model).
  A great new mode often blends them: a **daily rule** applied to **your own cards**.
- **Reward the collection.** The best "new use" makes owning more/better cards *expand what
  you can do* (more valid plays, higher ceilings) rather than just cosmetic.
- **Tie back to duplicates.** Copies/mastery/shine are looking for more sinks — a mode where
  mastery or shine acts as a multiplier deepens the whole economy.
- **People cards want a job.** A mode that specifically needs actors/directors would use the
  currently under-leveraged half of the collection.
- **Brand DNA = connections.** Films↔people links, shared casts, franchises, eras. Modes that
  play with the *graph* of relationships feel most on-brand.
- **Data access.** Metadata comes from TMDB (posters via an image CDN; details via an
  allow-listed proxy). Assume you can look up any card's year/genre/cast/crew/franchise.
- **Shareable result.** Every existing mode ends in a compact emoji/score grid the player can
  share. A new mode should too.

---

## 8. One-paragraph summary (if you only read this)

Players own a personal deck of **collectible cards of real films and people**, earned by
winning daily film puzzles. Each card has a **rarity**, a **copy count** (duplicates →
mastery tiers, dust, shine, ascension), a collection **number**, and — via TMDB — rich
metadata (year, genre, runtime, ratings, revenue, **director, cast, franchise**). Cards
today are used for a **collection gallery**, **sets**, and a **Top-Trumps stat-battler**.
Design a **new game mode** that gives these cards a fresh use — ideally one that (a) rewards
a broad/deep collection, (b) degrades gracefully for small collections, (c) leans on the
relationship graph and/or under-used **person cards**, and (d) creates new demand for
**duplicates/mastery/shine**. It can be a daily-seeded challenge, a play-your-own-collection
mode, or a blend (a daily rule scored against your own cards).
