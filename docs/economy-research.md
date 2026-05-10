# Idle/Incremental Economy Design — Research Brief

Research on how successful idle/incremental games structure their economies, and how those patterns apply to GnorpBuzz. Compiled from GDC talks, designer postmortems, and game-specific wikis.

## 1. Cost & Production Scaling Curves

Industry standard is **exponential cost** with `Cost(n) = BaseCost × r^n` where **r ∈ [1.07, 1.15]**.

- **Cookie Clicker:** r = 1.15 across all buildings. Price doubles every ~5 buys, 1000× every ~50.
- **Clicker Heroes:** r = 1.07 (long smooth ramps).
- **AdVenture Capitalist** (Lemonade Stands): r = 1.07, base cost = 4, base production = 1.67/sec.

**Production grows linearly per unit:** `production = base × owned × multipliers`, with periodic step multipliers at milestones (×2 at 25, 50, 100 owned — AdCap's pattern).

**The key relation:** exponential cost vs. polynomial/linear production guarantees players hit walls. This gap *is* the game — it's what makes upgrade choice tactical without designer intervention.

Eric Guan's recommended starting point: **production ×1.10 / cost ×1.15 per level.** Production grows but is always outrun.

**Pick by feel:**
- **r = 1.07** — long, smooth ramps. Good for building counts in the dozens-hundreds.
- **r = 1.15** — punchier walls. Good when you want fewer buys per tier.

## 2. Multi-Resource Economies

Most successful patterns:

- **Tie each resource to a different reengagement cadence.** Eric Guan's framing: short-cycle resource (~20-min cap, rewards active play), medium (~5h cap, rewards check-ins), long (~2-day cap, rewards walk-aways). This lets players "feel good optimizing some processes even if they fail at others."
- **Asymmetric production chains** (Kittens Game, A Dark Room): resources are *inputs* to other resources, not parallel currencies. Wood→tools→iron→steel. Avoids the "one currency dominates" failure mode because each resource is the bottleneck for something specific.
- **Storage caps per resource** force spending and prevent hoarding (Kittens Game's signature mechanic).

**Pitfalls:**
- Parallel currencies that buy the same things almost always collapse to one dominant resource.
- Conversion loops feel grindy when ratios are static — make them *unlock more efficient ratios* via upgrades.
- Don't gate the same upgrade on all resources simultaneously — gate different upgrades on different resources.

## 3. Time-to-Next-Purchase Pacing

The "1.5×" rule isn't hard canon, but the underlying math is real. With cost growth r=1.15 and production growth ~1.10, **each subsequent purchase takes roughly 1.05–1.15× longer** than the last early on, accelerating to multi-doubling deep in.

Pecorella/Kongregate's *Math of Idle Games* series and AdCap's tuning suggest:

- **Early game:** 5–30 seconds between buys (constant dopamine).
- **Mid game:** 1–10 minutes.
- **Late game:** 30 min – several hours, with **milestone multipliers** (×2 at 25/50/100) providing punctuated boosts that feel like "leaps."

Antimatter Dimensions uses a heuristic: "wait as long as it took to reach 1.01× from 1×" — translates to roughly geometric pacing.

## 4. Soft Caps, Hard Caps, Diminishing Returns

Common patterns:

- **Sqrt or log soft cap above a threshold:** `effective = threshold + sqrt(raw - threshold)` (RavenQuest pattern). 136 raw becomes 106 effective.
- **Storage caps** (Kittens Game) force player action without halting growth.
- **Stepped multipliers at milestones** (AdCap) act as "anti-soft-caps" — re-energize a stalled system.
- The **exponential cost itself is the primary diminishing-returns mechanism** — you don't need extra caps if r is right.

**Weber–Fechner's law** underlies this: humans perceive ~1.2× as the just-noticeable difference, so growth must be exponential to *feel* linear. Don't punish; just slow.

## 5. Linear-Arc / Finite Idle Games

Most idle games are infinite/prestige-based. The well-regarded finite-arc games:

### Universal Paperclips (~3–6h)

Three distinct **stages** (manufacturing → space exploration → end of universe), each with its own economy that **replaces** the prior one. New resources (Trust, Ops, Creativity, Yomi, Honor, Probes) introduced at stage transitions; old ones become irrelevant or convert.

**This is critical:** rather than scaling the same loop forever, **swap loops at narrative beats**.

**Paperclips' trick for replacing prestige:** the *stage transition itself* is the reset. Old buildings are abandoned, new currency takes over, but narrative continuity carries motivation. The "wall" at end of stage N becomes the unlock for stage N+1.

### A Dark Room / Kittens Game (early-game arc)

Pure resource-chain progression (wood→meat→fur→coal→iron→steel) where each new resource unlocks a new layer of decisions. Storage caps + assignment of workers, not pure scaling.

## 6. First-Launch / First-Milestone Pacing

Industry consensus on first session:

- **First meaningful action: <60 seconds.** No tutorial walls.
- **First "wow" milestone: 5–15 minutes.** This is the hook window.
- Apptrove/GameAnalytics: 15–60 min active first session, but the *retention-defining moment* is in the first 10–15 min.
- **Day-1 retention benchmarks:** 35–40% for top performers; the first-session milestone is what drives this.

For GnorpBuzz's **first vessel launch** specifically: target **10–20 minutes**. Long enough to feel earned and to teach the wax/pollen/nectar loop; short enough that mobile/casual players see a payoff in one sitting. Universal Paperclips' first stage transition (autoclippers → marketing) hits around 15–20 min — strong reference point.

---

## Recommendations for GnorpBuzz

### 1. Use Paperclips-style stage transitions instead of prestige

Each of the 7 vessel tiers should **replace** (not just scale) part of the economy. Tier 1 might be wax-dominant; by Tier 4, nectar-conversion is the binding constraint; Tier 7 introduces something new entirely. Old buildings/upgrades become obsolete or auto-convert. This gives the freshness of prestige without the reset crutch.

### 2. Three-resource cadence split, not three parallel currencies

- **Wax** = short-cycle resource (active play, ~minutes — used for moment-to-moment vessel building).
- **Pollen** = medium-cycle (~hours — bee population/worker capacity).
- **Nectar** = long-cycle (~half-day — narrative-gated upgrades / vessel tier unlocks).

Each gates *different* things. Cross-conversion exists but at unfavorable ratios that improve via upgrades.

### 3. Tune to r=1.10–1.12 cost growth, ~1.07 production growth, with ×2 step multipliers every 10 buildings

Gentler than Cookie Clicker (1.15) — appropriate for a finite arc where you don't need infinite walls, just steady pull.

- **First vessel launch:** ~12–15 minutes for a new player.
- **Subsequent vessel tiers:** ~2–3× the previous tier's time-to-launch.
- **Tier 7 cap:** 4–8 hours.
- **Full arc:** ~15–30 hours of total play.

---

## Sources

- [The Math of Idle Games, Part I — Game Developer / Pecorella](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i)
- [The Math of Idle Games, Part III — Kongregate Blog](https://blog.kongregate.com/the-math-of-idle-games-part-iii/)
- [Quest for Progress: The Math and Design of Idle Games — Anthony Pecorella, GDC Europe 2016 (PDF)](https://media.gdcvault.com/gdceurope2016/presentations/Pecorella_Anthony_Quest%20for%20Progress.pdf)
- [Idle Game Design Principles — Eric Guan](https://ericguan.substack.com/p/idle-game-design-principles)
- [Numbers Getting Bigger: The Design and Math of Incremental Games — Envato Tuts+](https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a)
- [Cookie Clicker (Demaine, Ito, Langerman, Lynch — academic paper)](https://erikdemaine.org/papers/CookieClicker_JCDCGGG2017/paper.pdf)
- [Cookie Clicker Building Wiki](https://cookieclicker.fandom.com/wiki/Building)
- [Universal Paperclips Stages Wiki](https://universalpaperclips.fandom.com/wiki/Stages)
- [How Idle Are Idle Games? An analysis of Universal Paperclips — CVGS](https://criticalvideogamestudies.com/how-idle-are-idle-games-an-analysis-of-univeral-paperclips/)
- [Math — the backbone of Idle Games (Medvešček Murovec)](https://medvescekmurovec.medium.com/math-the-backbone-of-idle-games-part-1-f46b54706cf1)
- [Attributes Softcap System — RavenQuest](https://medium.com/@ravenquest/attributes-softcap-system-a96cc1e2d7ac)
- [SoYouWantTo / Write an Idle Game — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/SoYouWantTo/WriteAnIdleGame)
- [How to Make an Idle Game — GameAnalytics](https://www.gameanalytics.com/blog/how-to-make-an-idle-game-adjust)
- [Kittens Game — Almost Idle](https://almostidle.com/game/kittens-game)
