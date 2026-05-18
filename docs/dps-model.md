# GnorpBuzz — DPS / Work Model

> **Wizard reframing (current build).** Phase 1 production is *spell damage on the dig site*, not vessel construction. Foragers feed honey/mana into a capped reservoir; Geomancers and Cantors burn mana to cast. The formulas below describe the abstract production model used from Phase 2+; Phase 1 lives in the agent-driven model in `docs/agent-behavior.md`, where mana availability gates the damage rate rather than `base × count × multipliers`. The two views compose: late phases can plug bee counts and upgrade tiers into these formulas, while early phases stay legible as visible bee journeys.

How production actually computes, per phase. Pairs with `docs/phases.md` (which defines the cost curves) and `docs/economy-research.md` (which justifies the design choices).

## Definitions

- **Collection rate** — resources/sec coming into the colony.
- **Construction rate** — resources/sec actually flowing into vessel progress.
- **Insight/sec** — Scientist output; accelerates post-crash journal unlocks.
- **In-flight performance** — Engineer output (Phase 3+); affects launch event, not /sec rates.

In Phase 1 collection ≈ construction (everything collected goes straight into the vessel). They diverge from Phase 2 onward.

## General formula

```
output = base × count × (1 + Σ additive_upgrades_in_family) × Π multiplicative_categories × milestone_mult
```

**Stacking rule:** additive within an upgrade family (e.g., all "wax-collection" upgrades sum into one bucket), multiplicative across families (collection × tooling × refinery-ratios × milestones). Standard Cookie Clicker / AdCap pattern.

## Bees are grown in typed hives, not bought directly

Players don't buy individual bees. They buy **hives** — each role has its own hive type with its own exponential cost curve:

```
Cost_hive_role(n) = base_role × r^n
```

A purchased hive starts with empty slots and fills at the global Queen rate (~1 slot/min, upgradeable). See `docs/population.md` for the full population model.

So Collector Hives, Builder Hives, Scientist Hives, Engineer Hives each behave like their own "building" in classic-idle terms. Players make four parallel buying decisions by Phase 3. The hive-mix is the optimization puzzle, with a built-in delay (fill time) between purchase and effect.

## Active layer: nectar flower mini-event

Decoupled from bee DPS — clicks add nectar directly, they don't multiply bee output.

- Flowers spawn periodically in the meadow background once Nectar is unlocked (end of Phase 1).
- Click a flower → burst of nectar (one-shot, the flower disappears).
- Spawn rate scales gently with Phase progression.
- Pure bonus content. A player who never clicks loses ~5–10% of nectar income — noticeable but not punishing.

**Phase 1 has no active layer** — pure idle until nectar unlocks. Acceptable because Phase 1 is short (~45–75 min) and is teaching the core loop.

---

## Phase 1 — The Meadow (current build)

**Bee types:** Forager (gatherer), Geomancer (melee earth-spell), Cantor (hover cantrip caster). Scientist Bee exists as a unique character, no production role.

**Outputs:**
```
mana_in/sec  = foragers × pollenPerTrip / roundTripSec   (uncapped, but honey storage caps at honeyCap)
mana_out/sec = Σ(caster_cast_rate × manaCost) where each caster only fires when honey ≥ manaCost

dmg/sec      = Σ(caster_cast_rate × damagePerCast × synergy)
                  ≤ effective_mana_in/sec / manaCost   (binding constraint)
```

The mana reservoir is the binding constraint on damage. Surplus pollen accumulates as the upgrade currency.

**Active layer:** none yet.

**Player optimization:** *"How many Foragers do I need to keep my Geomancer + Cantor mix actually casting? Where do I add cells next — more mana-mules or more damage?"*

---

## Phase 2 — Mechanical Flight

**Hive types available:** Collector Hive, Builder Hive, Scientist Hive (each independently bought; bees grow into hives at the Queen rate).

**Outputs:**
```
collection_rate/sec = base × collectors × (1 + Σ collection_upgrades) × milestone × tooling
construction_rate    = base × builders   × (1 + Σ build_speed_upgrades) × tooling
insight/sec          = base × scientists × (1 + Σ research_upgrades)
```

**Vessel progress:**
```
progress/sec = min(construction_rate, available_resources_per_sec)
```

Builders cap how fast resources can be *spent*; with no Builders nothing builds; with too many Builders they idle waiting for resources. This tension is the assignment puzzle.

**Insight mechanic:** after a crash, the post-crash journal entry takes time to write. `unlock_time = base_unlock_time / (1 + insight_pool / unlock_threshold)`. Stockpiling Insight before launch dramatically shortens the wait between tiers.

**New stat-style levers (not in the DPS formula):** heat resistance and navigation. They determine launch altitude → which journal entry fires.

**Active layer:** nectar flowers begin spawning.

**Player optimization:** *"What ratio of Collectors / Builders / Scientists? Which family of upgrades to scale first?"*

---

## Phase 3 — Space

**Hive types available:** Collector, Builder, Scientist, Engineer (independently bought; auto-fill at Queen rate).

**Engineer output:** **in-flight performance** — multiplies launch efficiency (fuel burn rate, course-correction success). Doesn't show up in /sec rates; it shows up in the launch event itself, determining how high the vessel actually goes.

**Conversion ratios become explicit upgrades:**
```
pollen → wax    @ 1:5  (upgradable: 1:8, 1:12, 1:20)
nectar → pollen @ 1:3  (upgradable similarly)
```

Refineries auto-balance flows. The *ratios themselves* are a major upgrade category — multiplicative with all other families.

**Late-Phase-3 framing:** player starts thinking in *"Bloomshard-readiness/sec"* — an aggregate emerging from balancing all three resource flows + Engineer performance. Bridges into Phase 4.

**Stacking with milestones:** ×5 and ×10 milestone multipliers appear at major thresholds (every 25th and 50th of a bee type), giving the punctuated "leap" feel.

**Player optimization:** *"Where's my bottleneck — collection, construction, refinery throughput, or in-flight efficiency?"*

---

## Phase 4 — Colonization

**Roles flatten.** Phase 1–3 bee types still exist but auto-feed the Bloomshard chain; specialization fades from the foreground. The player still sees the population mix but mostly tunes refinery ratios and Bloomshard-tier upgrades.

**Single binding output:**
```
bloomshard/sec = f(min(refinery_inputs)) × bloomshard_efficiency × milestone
```

Where `refinery_inputs` is the rate at which wax/pollen/nectar arrive at the Bloomshard refinery, gated by the worst-tuned link.

**Vessel + habitat construction** is one large accumulating bar. No buy cadence to speak of — pacing is *milestone-driven* by approach % (visible flower brightening) rather than purchase-driven.

**Cost growth on remaining purchases:** r = 1.15 (punchy walls, but few of them).

**Player optimization:** *"Which conversion link is the bottleneck right now?"* The whole phase is a balancing puzzle, not a buying puzzle.

---

## Cross-phase summary

| Phase | Hive types | Levers | Player question |
|-------|------------|--------|-----------------|
| 1 | Worker Hive | Buy hives, collection upgrades, Queen rate | More hives or better upgrades? |
| 2 | + Collector / Builder / Scientist Hives | Hive mix, build vs. collection, Insight stockpile | What ratio of hives? |
| 3 | + Engineer Hive | + Conversion ratios, in-flight perf | Where's the bottleneck? |
| 4 | + Colonization Hive (migrates) | Refinery tuning, Bloomshard chain, second Queen prep | Which link is choking? |
