# MVP Scope (Wizard Reframing)

The minimum slice that exercises the wizard/mana economy end-to-end.

## Scope

1. Game loads with a small empty comb (3 cells), one dig site (rock) in the meadow, no bees, no honey, no pollen.
2. Player buys a Forager (free) → it harvests pollen from meadow flowers; deposits credit BOTH pollen (upgrade currency) AND honey (mana reservoir, cap 10).
3. Player buys a Cantor (available once the Forager exists).
4. The cantor checks honey before each cast. If honey ≥ cost → cast (damage the rock). If not → idle-swarm for ~3 sec, retry.
5. Honey cap clamps the mana reservoir to 10. Surplus deposits still flow into the pollen pool (upgrades).
6. As the rock takes damage, eventually HP hits 0. An artifact is revealed (`first-relic` — a plastic bottle cap with sacred PEPSI runes).
7. Player reads the Scientist Bee journal entry, dismisses → next tier rock takes its place.
8. Player clicks a resource building to open that role's contextual upgrade panel and spends wax on upgrades.

## In scope

- **Worker roles:** Forager (gatherer), Honey Worker + Wax Worker (refiners), Cantor (cantrip hover-caster, the sole attacker).
- **Honey reservoir** on the hive (cap 10), refined by Honey Workers up to the cap.
- **Mana-gated casts.** Cantor 1 honey/spark. Empty reservoir → idle swarm + retry.
- **Idle-swarm** state for cantors out of mana — bees drift near the comb, telegraphing the stall.
- **Cantor projectile.** A short purple spark that flies from the hover slot to the rock and dissipates. Damage applies at cast time; the spark is cosmetic.
- **Per-role contextual upgrade panels** opened by clicking the role's world object: Pollen Silo → Forager, Honey Jar → Cantor, Wax Block → Wax Worker. Cost-gated by wax; no unlock/dig step.
- **Synergy on the comb.** Same-role neighbors grant +speed (Forager) or +damage (Cantor).
- **Seven artifacts**, each a different absurd "relic."

## Out of scope (parked)

- **Geomancer** — the heavy melee dive-bomb attacker. Removed from the build for now; will likely return as a second attacker once the core loop is solid.
- Additional spellcaster roles.
- Honey-cap upgrades (could land trivially if we want; we're holding so the cap stays a real constraint during initial tuning).
- Refinery-style conversions, multiple hives, second Queen.

## Technical decisions

| Decision | Choice |
|----------|--------|
| UI approach | **Hybrid** — Pixi for world (meadow, bees, dig site, sparks), HTML/CSS overlay for resource bar (pollen + honey/cap), journal modal, end banner |
| Save | **Local storage**, on-action. Save version v6 (older saves are dropped — wizard reframing is a breaking shape change). |
| Offline progress | None |
| Tuning approach | Guess; tune after first play. All values in `TUNING` (`app/src/sim/state.ts`). |

## First-pass numbers

- Honey cap: 10.
- Forager round-trip: ~10 sec/pollen.
- Cantor mana cost: 1 honey; base damage: 0.35; cast interval: 2.4 sec.
- Idle-swarm retry: 2.8 sec.
- Tier-1 rock: 40 HP.

## Why this scope

The wizard reframing introduces the central pacing lever — **mana as the binding constraint on spell output**. This MVP exercises:

- Resource accumulation with a cap (forces spending pressure).
- Two coexisting currencies (one capped, one uncapped) feeding off the same deposit event.
- The continuous cantrip rhythm of the Cantor as the sole attacker.
- Idle-swarm visual feedback when production stalls.
- Contextual, building-anchored upgrade panels (no underground tech tree).

Everything outside this slice is content layered on top.
