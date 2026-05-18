# GnorpBuzz — Four Phases

> **Wizard reframing (current build).** The Phase 1 "vessel" framing has been replaced with a **rock-breaking** spell economy: foragers refine pollen into honey/mana, geomancers and cantors burn mana to crack each rock open, and the artifact inside drives the journal arc. The 7-tier progression still applies — each tier is a tougher rock instead of a bigger vessel — and the same Paperclips-style stage transitions are planned downstream. Phase 1 mechanics here are best read alongside `docs/game-design.md` and `docs/agent-behavior.md`.

The full arc of the game in four phases, mapping the 7 tiers onto distinct economic and narrative stages. Each phase has its own resource character; transitions are Paperclips-style — old systems auto-convert into background producers, new resources and mechanics replace the foreground.

**Total arc target:** 10–15 hours from first launch to colonization.

**See also:** `docs/economy-research.md` for the design principles these curves are built on, and `docs/game-design.md` for the concept this elaborates.

---

## Phase 1 — The Meadow (Tiers 1–2: Paper airplane → Hot air balloon)

**Story beat:** Bees discover the flower exists in the night sky. First naïve attempts to reach it.

**Economy:**
- **Wax** is the only resource at start. **Pollen** unlocks mid-phase as a second collection target.
- **Cost growth r = 1.08**, production growth ~1.05.
- ×2 milestone multipliers every 10 bees/upgrades.
- **Buy cadence:** 5–30 sec early, ~30s–1 min by end of phase.

**Mechanics introduced:**
- Auto-collecting bees, hive capacity, vessel construction bar.
- First Scientist Bee journal entry on Tier 1 crash.
- Storage caps on resources (Kittens-style — forces spending).
- No active layer in Phase 1 — pure idle. Nectar-flower clicks unlock at end of phase with Nectar itself.

**Pacing:** First launch at ~12 min. Phase total: ~45–75 min.

**Transition out:** Hot air balloon ascends higher than the airplane, but the wax envelope melts and it crashes. Journal entry on cold-then-melting wax → **nectar** unlocks as a third resource + heat-resistance tech tree opens.

---

## Phase 2 — Mechanical Flight (Tiers 3–4: Propeller plane → Jet)

**Story beat:** Practical engineering. Scientist Bee is panicked but methodical, taking measurements.

**Economy:**
- All three resources active. Cadence split per the research:
  - **Wax** = short-cycle (minutes) — moment-to-moment vessel construction.
  - **Pollen** = medium-cycle (hours) — bee population/role capacity.
  - **Nectar** = long-cycle (half-day) — narrative-gated upgrades.
- **Cost growth r = 1.11**, production ~1.07.
- ×2 step multipliers every 10 buildings — these become the punctuated "leap" moments.
- **Buy cadence:** 1–10 min.

**Mechanics introduced:**
- **Hive specialization:** Collector / Builder / Scientist hive types unlock, each with its own cost curve. Bees grow into typed hives at the Queen rate (see `docs/population.md`). Pollen gates new hive-type unlocks.
- Construction-speed upgrades become a real lever (separate from raw collection).
- Heat resistance and navigation as named upgrade trees in the journal.
- **Phase 1 buildings begin auto-converting:** starter wax huts now feed an automated upstream chain — visible in a collapsed sidebar, not the foreground.

**Pacing:** Phase total ~2–3 hours. Tier 3 launch ~1h in, Tier 4 ~2.5h.

**Transition out:** Jet reaches the stratosphere, runs out of air. Journal entry on thin atmosphere and silence → **pressurization** tech opens. Scientist Bee starts wondering what it would be like to *live* up there.

---

## Phase 3 — Space (Tiers 5–6: Rocket → Bigger rocket)

**Story beat:** Wonder-struck. Scientist Bee notices the silence and the cold beauty. Begins speculating in journal entries about whether bees could survive long-term.

**Economy:**
- **Nectar** becomes the binding constraint. **Wax** is essentially commoditized (auto-managed, runs in background like Phase 1's huts). **Pollen** sits in the middle.
- **Cost growth r = 1.13**, production ~1.08.
- Late-game pacing — buys every 30 min – 2h. Step multipliers get dramatic (×5, ×10 at major milestones).
- **Conversion ratios** between resources start mattering — and *unlocking better ratios* is a major upgrade category.

**Mechanics introduced:**
- **Engineer Hive** unlocks (4th hive type) — Engineers work on vessel during launch, not just before.
- Fuel and orbital mechanics as upgrade trees.
- Mid-launch decisions for the first time: assign launch payload, watch ascent live.
- Phase 2 collector/builder huts now also auto-converted.

**Pacing:** Phase total ~4–6 hours. This is the meatiest phase.

**Transition out:** Bigger rocket reaches near-flower altitude but can't close the final gap. Scientist Bee reports the flower is enormous up close — and that the colony could *live* here, if they could build something to harvest from it. The journal pivots from "how do we reach it" to "how do we stay." → **Bloomshard** unlocks as the fourth resource (crystallized flower-essence harvested from approach distance — you're mining the destination).

---

## Phase 4 — Colonization (Tier 7: Absurd mega-vessel + flower habitats)

**Story beat:** Philosophical, quiet. The whole colony is mobilizing — not for one final visit, but to *move there*. The vessel isn't a rocket, it's a colony ship carrying habitats.

**Economy:**
- **Bloomshard** is the central new resource. Wax/pollen/nectar all auto-convert into Bloomshard via late-game refineries — old resources become *inputs* to the new one.
- One massive accumulation curve, not many small buys. Pacing punctuated by **"approach %" milestones** that visibly brighten the flower and grow the partially-built habitat.
- Few buildings, each enormous and consequential.
- **Cost growth r = 1.15** on the few remaining purchases — punchy walls, but few of them.

**Mechanics introduced:**
- All bees converge on the mega-vessel and the habitat structures it carries.
- Ascent is a multi-hour event with player-visible progress and live habitat assembly.
- The flower in the background grows visibly brighter and more detailed as Bloomshard accumulates — direct visual feedback.
- Final journal entries shift from observation to settlement: *"We're staying."*

**Pacing:** Phase total ~2–4 hours. Final launch is a real-time event — possibly 15–30 min of watchable ascent and habitat deployment.

**End state:** Habitats deployed at the flower. Colony arrives. Final journal entry as emotional payoff of *settlement*, not just arrival. Credits.

---

## Curve summary table

| Phase | Vessels | Cost r | Prod r | Buy cadence | Phase length |
|-------|---------|--------|--------|-------------|--------------|
| 1 — Meadow | 1–2 | 1.08 | 1.05 | 5–60 sec | 45–75 min |
| 2 — Mechanical | 3–4 | 1.11 | 1.07 | 1–10 min | 2–3 h |
| 3 — Space | 5–6 | 1.13 | 1.08 | 30 min – 2 h | 4–6 h |
| 4 — Colonization | 7 + habitats | 1.15 | n/a (accumulation) | hours | 2–4 h |

All phases use ×2 milestone multipliers every 10 buildings of a given type until that type is auto-converted.
