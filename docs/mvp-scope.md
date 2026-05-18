# MVP Scope (Wizard Reframing)

The minimum slice that exercises the wizard/mana economy end-to-end.

## Scope

1. Game loads with a small empty comb (3 cells), one dig site (rock) in the meadow, no bees, no honey, no pollen.
2. Player buys a Forager (free) → it harvests pollen from meadow flowers; deposits credit BOTH pollen (upgrade currency) AND honey (mana reservoir, cap 10).
3. Player buys a Geomancer or a Cantor (Cantor available once the Forager exists).
4. The spellcaster checks honey before each cast. If honey ≥ cost → cast (damage the rock). If not → idle-swarm for ~3 sec, retry.
5. Honey cap clamps the mana reservoir to 10. Surplus deposits still flow into the pollen pool (upgrades).
6. As the rock takes damage, eventually HP hits 0. An artifact is revealed (`first-relic` — a plastic bottle cap with sacred PEPSI runes).
7. Player reads the Scientist Bee journal entry, dismisses → next tier rock takes its place.
8. Player digs underground chambers (Forager Den, Geomancer Hall, Cantor Cloister) to unlock upgrade rows for each role.

## In scope

- **Three worker roles:** Forager (gatherer), Geomancer (melee earth-spell), Cantor (cantrip hover-caster).
- **Honey reservoir** on the hive (cap 10), refined automatically from deposited pollen up to the cap.
- **Mana-gated casts.** Geomancer 2 honey/strike; Cantor 1 honey/spark. Empty reservoir → idle swarm + retry.
- **Idle-swarm** state for spellcasters out of mana — bees drift near the comb, telegraphing the stall.
- **Cantor projectile.** A short purple spark that flies from the hover slot to the rock and dissipates. Damage applies at cast time; the spark is cosmetic.
- **Per-role upgrade chambers** under the meadow (`docs/underground.md`): Forager Den (3 upgrades), Geomancer Hall (3), Cantor Cloister (3).
- **Synergy on the comb.** Same-role neighbors grant +speed (Forager) or +damage (Geomancer/Cantor).
- **Seven artifacts**, each a different absurd "relic."

## Out of scope (parked)

- Replacing pollen with a thematic upgrade currency (research/insight) — kept on the roadmap, deliberately deferred so we ship the spell-economy first.
- Additional spellcaster roles beyond Forager / Geomancer / Cantor.
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
- Geomancer mana cost: 2 honey; base damage: 1; respawn: 1.8 sec.
- Cantor mana cost: 1 honey; base damage: 0.35; cast interval: 2.4 sec.
- Idle-swarm retry: 2.8 sec.
- Tier-1 rock: 40 HP.

## Why this scope

The wizard reframing introduces the central pacing lever — **mana as the binding constraint on spell output**. This MVP exercises:

- Resource accumulation with a cap (forces spending pressure).
- Two coexisting currencies (one capped, one uncapped) feeding off the same deposit event.
- Two distinct spellcaster rhythms (chunky one-shot Geomancer vs. continuous cantrip Cantor).
- Idle-swarm visual feedback when production stalls.
- Chamber-gated upgrade unlocking (now three chambers instead of two).

Everything outside this slice is content layered on top.
