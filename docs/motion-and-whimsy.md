# Motion & Whimsy — GnorpBuzz Animation Guidelines

The bees should feel alive, exaggerated, and silly. The narrative is absurdist — wizard bees lobbing cantrips at ancient rocks to recover plastic bottle caps and Lego bricks — and the motion should match. Robotic, smooth, "professional" animation kills the tone. Cartoony overshoot, comedic delays, and visible personality are the brief.

This doc is the design north star. Implementation lives in `app/src/world/Bee.ts`, `app/src/view/BeeView.ts`, and a future `app/src/view/Particles.ts` / `app/src/view/Tween.ts`.

## The five rules

1. **Anticipation > smoothness.** Every action begins with a pull-back in the opposite direction (3–6 frames, ~80–150ms). Launches lurch, dive-bombs wind up, even direction changes overshoot before settling.
2. **Overshoot, never stop cleanly.** Default easing is `Back.out` (`cubic-bezier(.34, 1.56, .64, 1)`). Bees overshoot their target by 10–15%, then pull back. Linear and `ease-in-out` are banned for character motion.
3. **No silent transitions.** Every state change emits a particle and a 1-frame body-shake. Pickup, drop, arrive, depart, idle → working — all juiced. The reaction frame is what makes the world reactive.
4. **Per-bee desynchronization.** Each bee gets a random seed (`±15%` jitter on speed, wing-flap phase, bobble amplitude). Identical sprites become a swarm with personality at zero cost.
5. **Role personality through motion alone.** Foragers, wax-makers, and builders should be identifiable by their movement, not just color.

## Animation primitives we need

Three small utilities cover ~90% of the charm. Build these first; everything else composes from them.

### `Tween`

A minimal tween that takes `(from, to, durationMs, easing, onUpdate, onComplete)`. Easing presets:

| Preset | Curve | Use for |
|--------|-------|---------|
| `back` (default) | `cubic-bezier(.34, 1.56, .64, 1)` | Arrivals, snaps, picks-ups, drops |
| `quad-out` | `t * (2 - t)` | Soft stops |
| `expo-in` | `t * t * t` | Dive-bombs, falls |
| `anticip` | `cubic-bezier(.8, -.4, .2, 1)` | Built-in pull-back-then-launch |
| `elastic-out` | (use sparingly) | Major delight beats only — tier unlocks, journal pop |

Avoid linear and `ease-in-out`. They read as "machine."

### `ParticlePool`

One shared pool, called like `particles.emit(type, x, y, options)`. Types we need:

- `pollenPuff` — 5–8 yellow circles in a fan, gravity 0.05, alpha 0.6→0, scale 0.5→1.5 over 500ms.
- `sparkle` — 4-point Graphics star, scale 0→1→0 over 400ms, slow rotation. Stack 3 with phase offsets for delight.
- `waxSteam` — white circles drifting up with sin-wobble, spawn 1/100ms while producing.
- `crashDust` — ring of 6 brown circles flung outward, ease-out scale-up + fade. One-shot on impact.
- `oof` — single floating "!" or "?" Graphic above a bee, bouncy scale-in, float up 8px, fade.

Pool 20 Graphics objects, recycle them. Total budget: ~30 lines of TS.

### `Wobble`

Per-frame helpers attached to Bee/sprite for ambient life:

- `breathe(scale, phase, t)` — `scale.y = 1 + sin(t*2 + phase) * 0.04`. Default for any idle bee.
- `bobble(yOffset, phase, t)` — `y += sin(t * 2 + phase) * 2`. Default carrying motion.
- `wingFlap(phase, freq, t)` — `scale.y = 0.85 + sin(t * freq + phase) * 0.25`. Existing; tune `freq` per role.

## Squash & stretch on velocity

Two lines of code, instantly alive. In BeeView render:

```ts
sprite.scale.x = 1 + speed * 0.0008;
sprite.scale.y = 1 - speed * 0.0008;
```

Counter-stretch on the perpendicular axis. Tune coefficients per role (heavier bees stretch less, foragers stretch more).

## Arcs, never lines

Bees never travel in a straight line. Add a perpendicular sin offset to every flight:

```ts
const dx = target.x - origin.x;
const dy = target.y - origin.y;
const perp = { x: -dy, y: dx }; // 90° rotated, normalized
const wobble = Math.sin(progress * Math.PI * 2 + bee.seed) * AMPLITUDE * (1 - progress); // damp toward arrival
```

Foragers wobble loud (amplitude ~12px), wax-makers wobble lazy (amplitude ~6px, lower frequency), builders wobble minimal (amplitude ~3px — they're focused).

## State transitions: never silent

Every transition emits something. Examples:

| Transition | Reaction |
|------------|----------|
| Forager arrives at flower | 1-frame body-shake (squish 1.3x horizontal for 80ms), tiny `pollenPuff` |
| Forager finishes harvest | `sparkle` on flower, body lifts with anticipation pull-back |
| Forager deposits at hive | `pollenPuff` at hive entrance, hive bounces (scale.y to 1.05 then back) |
| Wax-maker picks up pollen | "Hup" body-shake, dust puff at pickup point |
| Wax-maker producing | continuous `waxSteam` from hive chimney; bee jiggles in place (already exists) |
| Wax-maker deposits block | hex block "pops" into stockpile (back.out scale-in from 0) |
| Builder picks up block | block scales-in onto bee, bee tilts forward 10° (carrying weight) |
| Builder drops on vessel | block "snaps" into pile with overshoot, dust puff, vessel pile bounces |
| Vessel ready | celebration `sparkle` x3 in a triangle pattern around airplane |
| Vessel launches | `crashDust` ring at launch site, exhaust trail (`waxSteam` re-tinted) |

## Per-role personality

The bees should be recognizable by motion alone.

### Forager — fast, jittery, impatient

- High wing-flap frequency (default × 1.3).
- Sharp direction changes: instant turn with horizontal squash to 1.3x.
- Tiny constant bobble (amplitude 1.5px).
- **Sloppy carrying:** drops a `pollenPuff` particle every ~1 sec of travel home (visible trail of pollen).
- Idle behavior: rapid wing flutter (preening). 1.5s on a random timer when idle >2s.

### Wax-maker — slow, deliberate, heavy

- Low wing-flap frequency (default × 0.8).
- Exaggerated landings: big squash on arrival (scale.x to 1.4 for 120ms), big dust puff.
- 200–300ms pause between every state transition (the "thinking" beat).
- **Working hum:** slow `breathe` (scale.y up to 1.08) while in `producing-wax` state.
- Idle behavior: yawn — slow stretch.y to 1.3 over 600ms, hold 200ms, snap back. Random 5–8s timer.

### Cantor — floaty, ceremonial, cantrip-fizzy

- Persistent hover-caster; never travels to the rock. Always bobbing in place above its home cell with a slow sine sway.
- **Wizard hat.** Tiny pointed indigo cone with a starlit tip — the silhouette readable at a glance.
- **Cast recoil.** On every spark fired, a brief mid-air kickback (~120ms) — body squashes vertically, hat tilts ~10° back, then settles. Sells "the spell pushed me."
- **Spark trail.** The cantrip is a small magic-purple star with a soft white halo, traveling on a light-gravity arc to the rock. Three sparks per cast with a tiny angular spread reads as "splat" not "single bullet."
- **Idle swarm shame.** When the cantor enters idle-swarm (no mana), the hat tilts forward slightly and a "?" pops above its head every few seconds. The crowd of muted cantors waiting for foragers IS the "you're out of mana" beat.

### Geomancer — heavy, deliberate, dive-bombing

- One-shot caster: climb → hover → dive → impact → bounce → expire. Each strike should feel like a *commitment*.
- Squat red-brown body with a downward "stinger" (the pickaxe metaphor still reads).
- **Mana check beat.** When the geomancer commits to fly out, the body shudders once (1-frame squash) and the reservoir number visibly ticks down. Tie the two visually with a quick honey-colored puff between the hive and the bee.

### Builder — rhythmic, focused

- Moderate wing-flap frequency (× 1.0).
- Travels in nearly-straight lines (small arc amplitude).
- Carries with both "arms" — body level, no tilt. The block sits centered above the body.
- **Satisfied placement:** every block delivered triggers a 1-frame full-body shake (scale.x 1.2 then 0.9 then 1.0 over 200ms).
- Idle behavior: foot-tap — three quick vertical bobbles (4px down, 80ms each). Random 4s timer.

## Absurdist gags worth the effort

These are deliberate cartoon beats. Include them; they're the soul of the game.

1. **Wind-up before flight.** Body jerks *backward* 4px over 100ms (anticipation), wings blur (3 quick scale.x flips), *then* launches. Pure Looney Tunes. Apply to every flight start.
2. **Question mark when confused.** When a bee can't find work (idle wait expires with no target), pop a "?" Graphic above its head. Floats up 8px, fades.
3. **Awkward bumps.** When two bees collide (proximity check), both squash horizontally and rebound with 30% extra velocity for 200ms. Spawn an "!" above one of them.
4. **Pollen toss overhead.** When a forager arrives home with pollen, the deposit isn't quiet — they fling 5–8 pollen particles in a fan with gravity. The hive's pollen pots fill up *via* this toss visually.
5. **Wax-maker dive-bomb on pollen pickup.** Approach the forager hive by overshooting upward 30px first (anticipation arc), then steep ease-in dive with `scale.y = 1.4` (stretched into a missile). Comedic, not realistic.
6. **Wax block snap on stockpile.** Don't fade-in the new block. Drop it from above with a `back.out` ease and a tiny dust puff on landing. Same for vessel pile.
7. **Tip-over idle.** If a bee has been idle >4s, it slowly leans 15° forward, then snaps upright with overshoot. Subtle, but lands.
8. **Vessel launch is a rocket cartoon.** Wind-up: airplane shudders in place for 300ms before takeoff, dust building underneath. Then it leaves.

## Timing reference

| Beat | Duration |
|------|----------|
| Anticipation (pull-back) | 80–150ms |
| Action (the move itself) | 150–300ms |
| Follow-through (overshoot recovery) | 200–400ms |
| Total per beat | 400–700ms |
| State-change reaction frame | 80–120ms (single squash + particle) |
| Idle behavior trigger | 2–8s of true idle, then random pick |

Total motion duration matters: small creatures feel right around 400–700ms per discrete action. Slower than that = sluggish. Faster = imperceptible.

## Implementation order

When we add motion polish, prioritize in this order:

1. **`Tween` + `ParticlePool` + `Wobble`** primitives. Foundation.
2. **Squash & stretch on velocity.** 4 lines of code, biggest single-step charm boost.
3. **Per-bee seed for desync.** 1 line, instantly fixes "robot army" feel.
4. **State-transition reaction frames.** Body-shake + particle on every arrival/pickup/drop.
5. **Per-role personality differences.** Wing-flap freq, idle behaviors, arc amplitudes.
6. **Absurdist gags** (in roughly the order listed in section above). Each is independent; ship one at a time.

Don't try to do all of this at once. Each item compounds. The first three alone will dramatically change the feel.

## What to avoid

- **Linear tweens** anywhere except progress bars.
- **Smooth `ease-in-out`** — reads as corporate / machine.
- **Identical timing across bees.** Always per-bee jitter.
- **Silent state changes.** No teleporting, no instant-snap, no fade-only transitions.
- **Realistic physics.** This is cartoon. Bees that "fall realistically" feel less alive than ones that pause mid-air, look at the camera, then plummet.
- **Pixel-perfect smoothness.** Sub-pixel positions while moving (smooth), integer snapping at rest (crisp). The contrast matters.

## Sources

- [12 Principles for Game Animation — Chris Totten](https://totter87.medium.com/12-principles-for-game-animation-a9137ef44345)
- [Juice it or lose it — Martin Jonasson & Petri Purho (GDC)](https://www.youtube.com/watch?v=Fy0aCDmgnxg)
- [The Art of Screenshake — Jan Willem Nijman](https://www.youtube.com/watch?v=AJdEqssNZ-U)
- [An Indie Approach to Procedural Animation — David Rosen (GDC Vault)](https://www.gdcvault.com/play/1020583/Animation-Bootcamp-An-Indie-Approach)
- [Behind the HONK: Untitled Goose Game Q&A](https://www.gamedeveloper.com/design/behind-the-honk-an-i-untitled-goose-game-i-q-a)
- [Easing Functions Cheat Sheet](https://easings.net/)
- [Squeezing more juice out of your game design](https://www.gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design-)
