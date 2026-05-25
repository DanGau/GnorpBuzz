import { WORLD } from '../world/layout';

// Plain-data game state for the wizard/excavation MVP.
//
// LORE: the bees are wizards. Foragers are the mundane caste — they harvest
// pollen from meadow flowers and deliver it to the colony's Pollen Silo.
// Workers walk between three above-ground buildings: the Pollen Silo (their
// source of work), the Honey Jar (where Honey Workers refine pollen into
// mana), and the Wax Block (where Wax Workers extrude wax for upgrades).
// Cantor spellcasters burn honey to cast spells that crack the rock. If the
// hive has no honey, casters drift into an idle swarm near the hive until
// workers refill the reservoir.
//
// Bees never physically use the comb as a destination — the comb defines
// HOW MANY of each role exist (cells are population slots, assignment is
// permanent), but the actual work happens at the three buildings sitting
// around the hive. The buildings are the visible economic dashboard:
// pollen silo full = need more workers, honey jar empty = need more honey
// workers, wax block flat = re-tilt the worker mix.
//
// All three pools are CAPPED. When a pool hits cap, its supplier bees idle
// visibly at their park spot until the player drains some — the cap is a
// "you need to spend" tell, not a soft loss.
//
// One Hive: a honeycomb of hex cells. Each filled cell holds one worker —
// a Forager, a Honey Worker, a Wax Worker, or a Cantor.
// Same-role neighbors grant an adjacency synergy bonus, so clustering by
// role matters. Worker assignments are permanent. A single Dig Site sits in
// the meadow; cantors chip its HP down; at 0 HP an ancient artifact
// (comically just human garbage) is revealed and a Scientist Bee journal
// entry pops. Each artifact unlocks the next tier.

export type Currency = 'wax' | 'fertilizer';

// Roles that own an upgrade group. Each group's panel opens by clicking the
// world object that role is contextual to:
//   forager     → Pollen Silo
//   cantor      → Honey Jar
//   wax-worker  → Wax Block
//   fertilizer  → Fertilizer Bin  (permanent meadow / flower upgrades)
export type UpgradeRole = 'forager' | 'cantor' | 'wax-worker' | 'fertilizer';

// Per-role upgrade paths. Purchasable any time once you can afford the wax.
export type UpgradeId =
  | 'forager-swift-wings'
  | 'forager-quick-forage'
  | 'cantor-quicker-cantrip'
  | 'cantor-twin-spark'
  | 'cantor-mana-sip'
  | 'waxworker-swift-haul'
  | 'waxworker-rich-combs'
  | 'waxworker-deep-coffers'
  | 'fertilizer-rich-soil'
  | 'fertilizer-long-bloom'
  | 'fertilizer-quick-sprout';

export interface UpgradeDef {
  id: UpgradeId;
  role: UpgradeRole;
  name: string;
  blurb: string;
  maxTier: number;
  baseCost: number;
  costGrowth: number;
  currency: Currency;
}

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  'forager-swift-wings': {
    id: 'forager-swift-wings',
    role: 'forager',
    name: 'Swift Wings',
    blurb: '+15% flight speed',
    maxTier: 5,
    baseCost: 4,
    costGrowth: 1.6,
    currency: 'wax',
  },
  'forager-quick-forage': {
    id: 'forager-quick-forage',
    role: 'forager',
    name: 'Quick Forage',
    blurb: '−20% harvest time',
    maxTier: 3,
    baseCost: 5,
    costGrowth: 1.7,
    currency: 'wax',
  },
  'cantor-quicker-cantrip': {
    id: 'cantor-quicker-cantrip',
    role: 'cantor',
    name: 'Quicker Cantrip',
    blurb: '−20% time between sparks',
    maxTier: 5,
    baseCost: 4,
    costGrowth: 1.6,
    currency: 'wax',
  },
  'cantor-twin-spark': {
    id: 'cantor-twin-spark',
    role: 'cantor',
    name: 'Twin Spark',
    blurb: '+25% spark damage',
    maxTier: 3,
    baseCost: 6,
    costGrowth: 1.7,
    currency: 'wax',
  },
  'cantor-mana-sip': {
    id: 'cantor-mana-sip',
    role: 'cantor',
    name: 'Mana Sip',
    blurb: 'Cantrips refund 1 mana every 4 casts',
    maxTier: 3,
    baseCost: 10,
    costGrowth: 1.9,
    currency: 'wax',
  },
  'waxworker-swift-haul': {
    id: 'waxworker-swift-haul',
    role: 'wax-worker',
    name: 'Swift Haul',
    blurb: '+12% wax-worker move speed',
    maxTier: 5,
    baseCost: 4,
    costGrowth: 1.6,
    currency: 'wax',
  },
  'waxworker-rich-combs': {
    id: 'waxworker-rich-combs',
    role: 'wax-worker',
    name: 'Rich Combs',
    blurb: '+1 wax per delivery',
    maxTier: 3,
    baseCost: 7,
    costGrowth: 1.8,
    currency: 'wax',
  },
  'waxworker-deep-coffers': {
    id: 'waxworker-deep-coffers',
    role: 'wax-worker',
    name: 'Deep Coffers',
    blurb: '+15 wax storage',
    maxTier: 3,
    baseCost: 6,
    costGrowth: 1.7,
    currency: 'wax',
  },
  // Fertilizer upgrades — spent at the Fertilizer Bin. Permanent buffs
  // that compound the meadow's value rather than the workers'.
  'fertilizer-rich-soil': {
    id: 'fertilizer-rich-soil',
    role: 'fertilizer',
    name: 'Rich Soil',
    blurb: '+25% pollen yield per flower',
    maxTier: 4,
    baseCost: 8,
    costGrowth: 1.7,
    currency: 'fertilizer',
  },
  'fertilizer-long-bloom': {
    id: 'fertilizer-long-bloom',
    role: 'fertilizer',
    name: 'Long Bloom',
    blurb: '+30% flower lifespan',
    maxTier: 4,
    baseCost: 6,
    costGrowth: 1.6,
    currency: 'fertilizer',
  },
  'fertilizer-quick-sprout': {
    id: 'fertilizer-quick-sprout',
    role: 'fertilizer',
    name: 'Quick Sprout',
    blurb: '−20% sapling growth time',
    maxTier: 3,
    baseCost: 10,
    costGrowth: 1.8,
    currency: 'fertilizer',
  },
};

// The role discriminator for cells and bees. Foragers gather pollen from the
// meadow. Workers stay near the buildings and convert pollen → honey or
// pollen → wax. Cantors are spellcasters that burn honey to attack the dig
// site.
export type CellRole =
  | 'forager'
  | 'honey-worker'
  | 'wax-worker'
  | 'cantor';

// ---- Hive: a honeycomb of hex cells ----
//
// Cells use axial hex coordinates (q, r). A cell present in `hive.cells` is
// unlocked. `role` is:
//   null      — unlocked but empty
//   any CellRole — holds one worker of that role (permanent)
//
// Cells are purely population slots; the bee that "lives" in a cell never
// physically visits it. Work happens at the three above-ground buildings.

export interface HiveCell {
  q: number;
  r: number;
  role: CellRole | null;
}

// One physical pollen grain inside the silo. Each forager delivery
// spawns N of these; each worker pickup removes N. The view renders
// every dot at its slot inside the basket, so the "pile" you see is the
// literal entity list — not an abstraction over a scalar.
export interface PollenDot {
  id: string;
  // Slot position inside the silo, in silo-local coords (the silo's own
  // sprite anchor is the origin). Bottom of the basket is +y, top is -y.
  x: number;
  y: number;
}

export interface HiveData {
  id: string;
  // Pollen — the raw material foragers harvest from the meadow. Stored in
  // the colony's above-ground Pollen Silo, capped. Workers pick from this
  // pool when delivering to the Honey Jar or Wax Block. Pollen is NOT
  // spendable by the player — it only feeds the worker refinery loop.
  //
  // `pollen` mirrors `pollenDots.length` and stays in sync via add/take
  // helpers. It exists so existing consumers (UI, save format, gates)
  // can keep reading a scalar; the physical entity list is the source of
  // truth for visuals and for the cap check.
  pollen: number;
  pollenCap: number;
  pollenDots: PollenDot[];
  // Wax — the upgrade currency. Refined at the Wax Block by Wax Workers.
  // All upgrades, cells, chambers, and worker hires cost wax.
  wax: number;
  waxCap: number;
  // Honey = mana. Refined at the Honey Jar by Honey Workers, capped at
  // `honeyCap`. Spellcasters burn honey to cast spells; with empty reserves
  // they swarm idle near the hive until workers refill.
  honey: number;
  honeyCap: number;
  // Fertilizer — a second upgrade currency, hauled from rock drops by
  // foragers and deposited at the Fertilizer Bin. Capped generously
  // (TUNING.FERTILIZER_CAP) so over-damaging the rock just produces a
  // satisfying pile instead of penalizing the player. Spent on permanent
  // meadow/flower upgrades from the Fertilizer Bin panel.
  fertilizer: number;
  fertilizerCap: number;
  cells: HiveCell[];
}

export type FlowerKind = 'pollen';

export interface FlowerData {
  id: string;
  kind: FlowerKind;
  // World-space position. Starter flowers seed at MEADOW_FLOWERS slots;
  // planted ones (from forager-hauled seeds) land at the nearest empty
  // meadow tile (see MEADOW_TILES / nearestEmptyMeadowTile).
  x: number;
  y: number;
  // Visual hue rotation, used by FlowerView so flowers vary in color.
  hue: number;
  // Quality tier 1..3. T1 = common (default yield), T2 = +yield, T3 = big
  // yield jackpot. Higher tiers also live longer (slice 5 wires lifespan).
  tier: 1 | 2 | 3;
  yieldRemaining: number;
  regrowTimerMs: number;
  // Sapling timer. > 0 while the planted seed is still sprouting (visually
  // a tiny green sprout, not harvestable). Ticks down each frame; at 0
  // the flower opens up and foragers can claim it. Starter flowers seed
  // with growthMs=0 (already grown).
  growthMs: number;
  // Lifespan timer. Ticks DOWN once growthMs reaches 0. At <=0 the flower
  // withers silently and is removed from the meadow. Higher tiers live
  // longer (see flowerLifespanForTier). The race against this timer is
  // the pressure the user wants — pollen rotting in unpicked flowers.
  lifespanMs: number;
  // How many bees are currently working this flower (en route or
  // harvesting). A flower is claimable while `claimants < yieldRemaining`,
  // so its remaining bloom is the cap — many bees can share one flower
  // instead of one bee locking the whole thing. Ephemeral: reset on load.
  claimants: number;
}

export interface JournalEntry {
  id: string; // matches the revealed artifact id
  tier: number;
  text: string;
}

// ---- Artifacts ----
// Each artifact has a reverent in-world name and a "real" subtitle (the joke
// is the disconnect). One artifact per dig-site tier; they map 1:1 to the
// seven planned phases of the game.

export interface ArtifactSpec {
  id: string;
  tier: number;
  reverentName: string; // what the bees call it
  realName: string; // what it actually is
  journalText: string; // Scientist Bee's field note
  // Next dig-site HP after this artifact is dismissed.
  nextSiteMaxHp: number;
}

export const ARTIFACTS: ArtifactSpec[] = [
  {
    id: 'first-relic',
    tier: 1,
    reverentName: 'The First Relic',
    realName: 'a plastic bottle cap',
    journalText:
      "Smooth and perfectly round, marked with sacred runes (P · E · P · S · I). It hummed when struck. We hummed back.",
    nextSiteMaxHp: 120,
  },
  {
    id: 'crystalline-cylinder',
    tier: 2,
    reverentName: 'The Crystalline Cylinder',
    realName: 'an empty soda can',
    journalText:
      "A vessel of immense pressure once. The brown elixir is long gone but the cylinder remembers. It still fizzes a little when shaken.",
    nextSiteMaxHp: 320,
  },
  {
    id: 'singing-pebble',
    tier: 3,
    reverentName: 'The Singing Pebble',
    realName: 'an AirPod',
    journalText:
      "It WHISPERED. To me. By name. I wept openly. The colony is concerned but I am at peace. We are not alone.",
    nextSiteMaxHp: 820,
  },
  {
    id: 'sacred-brick',
    tier: 4,
    reverentName: 'The Sacred Brick',
    realName: 'a Lego 2x4',
    journalText:
      "Geometric perfection. Eight studs, arrayed in two rows of four. Surely the gods themselves laid this brick. We have begun to worship it.",
    nextSiteMaxHp: 2200,
  },
  {
    id: 'eternal-duckling',
    tier: 5,
    reverentName: 'The Eternal Duckling',
    realName: 'a rubber duck',
    journalText:
      "It does not decay. It does not feed. It only smiles. The smile has not faded in the days we have studied it. We are beginning to find it unsettling.",
    nextSiteMaxHp: 5800,
  },
  {
    id: 'window-of-visions',
    tier: 6,
    reverentName: 'The Window of Visions',
    realName: 'a cracked iPhone screen',
    journalText:
      "Through the glass, I saw myself, reversed. The reversed-me waved. I did not wave first. I am quite certain I did not wave first.",
    nextSiteMaxHp: 14000,
  },
  {
    id: 'sky-tether',
    tier: 7,
    reverentName: 'The Sky Tether',
    realName: "a child's half-deflated mylar balloon",
    journalText:
      "It still tries to rise. Even half-empty, it strains upward. We will tie ourselves to it. It wants to fly. We want to fly. The flower waits.",
    nextSiteMaxHp: 0, // endgame — no next site
  },
];

export function artifactForTier(tier: number): ArtifactSpec | null {
  return ARTIFACTS.find((a) => a.tier === tier) ?? null;
}

// ---- Dig site ----

export type DigSiteState = 'active' | 'revealing' | 'sealed';

export interface DigSiteData {
  id: string;
  tier: number; // 1..7
  hp: number;
  maxHp: number;
  state: DigSiteState;
  // Accumulator that converts damage dealt to the rock into rock-drop
  // entities. Each cantor cast adds its damage value; whenever the budget
  // crosses 1.0, one drop is spawned and the budget decrements. This is
  // what wires "more damage → more loot" without spawning fractional
  // entities. Reset on every dig-site transition (artifact reveal).
  dropBudget: number;
  // Queue of cantor casts whose sparks are still in-flight. Each entry
  // resolves into a damage tick + drop spawns when its etaMs ticks to 0,
  // so the rock's cracks deepen and seeds pop out at the same moment the
  // visual spark hits the boulder — not when the cantor fires.
  pendingHits: PendingHit[];
  // Transient list of strike points whose hits resolved this frame.
  // Populated by `tickPendingHits` and drained every frame by
  // WorldRenderer to spawn spall particles at the contact site. Not
  // persisted — purely a sim→view event channel.
  recentStrikes: { x: number; y: number }[];
}

export interface PendingHit {
  damage: number;
  strikeX: number;
  strikeY: number;
  settleBaseY: number;
  etaMs: number;
}

// ---- Rock drops ----
//
// Loot that flakes off the rock as cantors hit it. Three flavors:
//  - 'seed'         — common; tiered (T1/T2/T3). Foragers haul one back to
//                     the meadow and plant it on the nearest empty patch;
//                     it grows into a flower of the seed's tier.
//  - 'fertilizer'   — uncommon; foragers haul to the Fertilizer Bin; spent
//                     on permanent meadow/flower upgrades.
//  - 'fossil-honey' — rare; auto-applies on spawn (instant honey jar
//                     refill) and never becomes a physical drop entity.
//
// Drops physics-fall from the rock surface to a settle position near the
// boulder base. Once `settled`, foragers can claim and haul them.
//
// The pile is hard-capped at TUNING.ROCK_DROP_CAP (250). Beyond the cap,
// the rock becomes invincible — cantors stop casting until foragers haul
// drops away. This makes "over-damaging while foragers fall behind" a
// self-correcting jam instead of a punishment spiral.

export type RockDropKind = 'seed' | 'fertilizer';

export interface RockDrop {
  id: string;
  kind: RockDropKind;
  // Tier of the drop's quality. For seeds this maps to the flower they
  // grow into (T1 short-lived/normal, T2 longer/+yield, T3 long/big).
  // Fertilizer is always tier 1 — the bin treats every unit equally.
  tier: 1 | 2 | 3;
  x: number;
  y: number;
  vx: number;
  vy: number;
  settleX: number;
  settleY: number;
  settled: boolean;
  // Forager bee id currently committed to hauling this drop, or null.
  // Ephemeral runtime state; not persisted (reset to null on load).
  claimedBy: string | null;
  spawnedAtMs: number;
  // Sprite rotation in radians plus angular velocity in rad/s. Spawned
  // with a random tumble; in-air drops keep spinning ballistically;
  // floor contact couples the spin to horizontal velocity so drops
  // visibly roll; settled drops freeze at whatever angle they landed.
  rotation: number;
  spin: number;
  // Per-drop multiplicative color jitter (~0.95–1.05). Applied as sprite
  // tint in RockDropView so no two drops are identical pixels — kills the
  // "asset" feel of the pile. Stored as a packed tint (0xRRGGBB).
  tintJitter?: number;
  // Pickup-lift progress 0→1 while a forager is plucking this drop out of
  // the pile. RockDropView reads it to interpolate the sprite from
  // (liftFromX/Y) to (liftToX/Y) — the entity's own x/y is left alone so
  // the physics system (which uses x/y for stacking and support checks)
  // is undisturbed during the 150ms visual lift. Cleared on removal.
  liftT?: number;
  liftFromX?: number;
  liftFromY?: number;
  liftToX?: number;
  liftToY?: number;
}

// ---- Ascent (endgame) ----

export type AscentPhase = 'none' | 'launching' | 'ascending' | 'arrived';

export interface AscentData {
  phase: AscentPhase;
  timer: number;
}

// ---- Game state ----

export interface GameState {
  tick: number;
  elapsedMs: number;
  hive: HiveData;
  flowers: FlowerData[];
  digSite: DigSiteData;
  artifacts: {
    revealed: string[];
    pending: string | null;
  };
  journal: { entries: JournalEntry[]; pending: boolean; dismissedCount: number };
  upgrades: Partial<Record<UpgradeId, number>>;
  ascent: AscentData;
  // Loot lying near the boulder, waiting for foragers to haul it back.
  rockDrops: RockDrop[];
}

export const TUNING = {
  BEE_BASE_COST: 2,
  BEE_COST_GROWTH: 1.3,

  // Hive comb — unlocking a new cell. Cost scales with the cell's hex
  // distance (ring) from the center of the comb. The comb cannot grow past
  // MAX_COMB_RADIUS rings, which keeps it bounded on-screen.
  CELL_BASE_COST: 6,
  CELL_COST_GROWTH: 1.5,
  MAX_COMB_RADIUS: 4,

  // Adjacency synergy: each same-role neighbor of a filled cell grants this
  // fractional bonus. Foragers gain flight speed; cantors gain damage.
  SYNERGY_FORAGER_SPEED: 0.08,
  SYNERGY_CANTOR_DAMAGE: 0.12,

  // Dig site
  DIG_SITE_TIER_1_HP: 40,

  // Resource caps. Pollen and wax both have visible above-ground containers
  // (Pollen Silo, Wax Block) that fill as their pool rises; the cap is the
  // visible "container full" pressure that forces the player to spend or
  // rebalance worker roles before more can be produced.
  HONEY_CAP: 10,
  POLLEN_CAP: 20,
  WAX_CAP: 40,
  // Fertilizer pile is roomy on purpose — overdamaging the rock just
  // produces a satisfying mound to draw from, not a "spend or stop" beat.
  FERTILIZER_CAP: 100,

  // Rock drops — uncollected loot near the boulder. Past the cap the rock
  // goes INVINCIBLE (cantors stop casting) so the player has to drain the
  // pile to resume progress. A self-correcting jam, not a punishment.
  ROCK_DROP_CAP: 250,
  // Drops per unit of damage. The accumulator on the dig site sums damage
  // and spawns one drop each time it crosses 1.0, so this rate translates
  // directly into "how many drops a rock yields per HP it had". 1.0
  // means a 40-HP tier-1 rock yields ~40 drops.
  DROP_RATE_PER_DAMAGE: 1.0,
  // Roll thresholds for what a drop becomes. Order matters: fossil-honey
  // rolls FIRST (so it can fire even when the pile is full — it never
  // becomes a physical entity, just instantly fills the honey jar). Then
  // fertilizer, then everything else is a seed (the common case).
  DROP_FOSSIL_HONEY_CHANCE: 0.03,
  DROP_FERTILIZER_CHANCE: 0.22,
  // Tier roll for seed drops. Heavily biased toward T1 — the rare T3
  // flowers should feel like a slot-machine win.
  SEED_TIER_2_THRESHOLD: 0.85,
  SEED_TIER_3_THRESHOLD: 0.98,
  // Pile corner: where drops physically mound up after rolling off the
  // rock. The pile is bounded by a right WALL (just inside the world's
  // right edge) and a left wall sitting well past the boulder's left
  // footprint so the heap can spread across the meadow floor toward the
  // hive once the rightward stack fills in. The corner is the rest
  // position drops gravitate toward; collision + walls turn the soft
  // arc trajectories into a stacked mound against the right wall.
  ROCK_PILE_CORNER_X: 1240,
  ROCK_PILE_FLOOR_Y: 710,
  ROCK_PILE_RIGHT_WALL: 1272,
  ROCK_PILE_LEFT_WALL: 820,
  // Drop entity radius, used by the circle-collider physics. Drops are
  // dynamic circles with gravity, floor collision, pairwise restitution,
  // and a sleep threshold that settles them once velocity dies down.
  ROCK_DROP_RADIUS: 6,
  ROCK_DROP_GRAVITY: 1100,
  // Bounciness on collision (0 = inelastic, 1 = perfectly elastic).
  // Tuned to give one lively first-bounce read without the pile turning
  // into a shimmering mess — much below 0.25 and drops thud-die.
  ROCK_DROP_RESTITUTION: 0.32,
  // Velocity damping applied per second when in contact with the floor
  // (sliding friction). High by design — pebbles don't slide far.
  ROCK_DROP_FRICTION: 0.92,
  // Air drag — small per-second decay applied to drop horizontal velocity
  // so even bouncing pebbles bleed sideways momentum and don't skid forever.
  ROCK_DROP_AIR_DRAG: 0.25,
  // Linear damping — small per-second bleed on BOTH axes. Kills the
  // residual sub-threshold jitter that gravity-of-this-step + position
  // correction inject every frame; piles visibly come to rest in a few
  // frames instead of shimmering forever. (Box2D ships ~0 for damping
  // and relies on island sleep; we want "alive without sleep" so we
  // burn a little energy budget for it.)
  ROCK_DROP_LINEAR_DAMPING: 0.6,
  // Bouncing below this |vy| just rests on the floor instead of
  // hopping up another microbounce.
  ROCK_DROP_BOUNCE_FLOOR_VY: 40,
  // Restitution threshold (Box2D's `b2_velocityThreshold` analogue).
  // Pairwise contacts whose closing speed is below this are treated as
  // fully inelastic regardless of `restitution`. Without this, even a
  // soft 5 px/s bump between resting drops reflects back at 0.32x and
  // the pile shivers forever.
  ROCK_DROP_VEL_THRESHOLD: 35,
  // Position-correction slop. Penetration up to this much is ignored
  // (no positional fix, no impulse). Beyond it we correct CORRECTION %
  // per substep — lazily, over multiple frames, instead of snapping.
  // Snapping is what re-injects bounce energy and keeps stacks alive.
  ROCK_DROP_POS_SLOP: 0.5,
  ROCK_DROP_POS_CORRECTION: 0.3,
  // Iterative position resolver. Each substep runs the pairwise non-
  // overlap fix this many times so corrections propagate through a
  // stack — pushing two drops apart can re-overlap one of them with a
  // third neighbor, so the solver needs enough passes to converge.
  // 6 is comfortably above what's needed for piles up to a few drops
  // tall; bump higher if very tall stacks visibly compress.
  ROCK_DROP_POS_ITERATIONS: 12,
  // Sub-stepping. Each render frame runs the solver this many times at
  // dt/SUBSTEPS. Halves the per-step `g·dt` impulse, which halves the
  // artificial energy contact resolution has to remove.
  ROCK_DROP_SUBSTEPS: 2,
  // Soft snap-to-rest threshold. After all substeps, any drop whose
  // speed is below this AND is supported (floor or settled neighbor)
  // has its velocity zeroed and is marked `settled` so foragers can
  // claim it. This is the cousin of full island sleep — we still run
  // integration on settled drops (so a new drop landing on them feels
  // alive) but the velocity gets clamped flat every frame.
  ROCK_DROP_SETTLE_VEL: 12,
  // Closing speed required to knock a settled drop loose on contact.
  // With soft settled mass (below) this is now the speed at which we also
  // flip the settled flag off — the drop will already have absorbed a
  // little of every contact via the mass ratio, but until this threshold
  // it stays "pickable" and gravity-skipped.
  ROCK_DROP_WAKE_VEL: 90,
  // Settled drops respond to collisions as if they were SETTLED_MASS_RATIO×
  // heavier than dynamic drops, rather than being literally immovable.
  // Soft contacts now bob the whole pile by a fraction of their impulse,
  // which is what makes the heap feel like loose pebbles instead of cement.
  // High enough (20+) that side-by-side settled drops act as anchors and
  // the pile mounds up vertically instead of spreading like water; low
  // enough that the shockwave + restitution still produce a visible jiggle.
  ROCK_DROP_SETTLED_MASS_RATIO: 22,
  // Hard impacts (floor smack or contact with a settled neighbor above
  // this closing speed) emit a radial shockwave that kicks every settled
  // drop within IMPACT_RADIUS. The drop you actually hit got the real
  // impulse; the shockwave is what makes the *rest* of the pile jump.
  ROCK_DROP_IMPACT_THRESHOLD: 160,
  ROCK_DROP_IMPACT_STRENGTH: 0.42,
  ROCK_DROP_IMPACT_RADIUS: 30,
  CANTOR_MANA_COST: 1,

  // Cantor cantrip — a hovering caster that fires a slow projectile at the
  // dig site. Small per-hit damage, fast cadence.
  CANTOR_BASE_DAMAGE: 0.35,
  CANTOR_CAST_INTERVAL_MS: 2400, // between two successful casts
  CANTOR_PROJECTILE_SPEED: 460,  // px/sec for the spark on its way to the rock
  CANTOR_HOVER_OFFSET_Y: -55,    // how far above the home cell the cantor floats

  // When a spellcaster can't afford the mana for its next cast it falls into
  // an idle "swarm" loop for this long before retrying. Keeps the bee visible
  // (drifting near the hive) instead of vanishing.
  SPELL_IDLE_RETRY_MS: 2800,

  // Worker bees (honey / wax). They never leave the comb: walk from home →
  // pick up a pollen dot off a Forager cell's pile → walk home → deposit.
  // A short bob at home represents the conversion (pouring honey into the
  // vat, or pressing pollen into wax).
  WORKER_DEPOSIT_MS: 400,
  // How long a Worker idles at home before re-searching for a pile when the
  // comb has no pollen available. Keeps them visibly bobbing rather than
  // statue-still while foragers catch up.
  WORKER_IDLE_RETRY_MS: 600,
  // Wax recipe: a wax-worker hauls a full batch of pollen back to the Wax
  // Block per cycle and kneads it into wax. Pollen is the crafting input,
  // and the kneading beat is intentionally long so the player reads the
  // "the wax-workers are crafting" silhouette rather than the courier trip.
  WAX_RECIPE_POLLEN: 3,
  WAX_KNEAD_MS: 1500,
  // Ascent (endgame)
  ASCENT_LAUNCH_MS: 1200,
  ASCENT_FLIGHT_MS: 5000,

  // Flowers
  FLOWER_YIELD: 5,
  FLOWER_REGROW_MS: 60_000,
  // Sapling growth — time a planted seed spends sprouting before it
  // opens into a harvestable flower. Long enough that the player feels
  // the investment but short enough that planting still pays back within
  // one rock's lifespan.
  SAPLING_GROWTH_MS: 14_000,
  // Per-tier yield: T1 = common, T2 = uncommon, T3 = jackpot.
  FLOWER_YIELD_TIER_2: 8,
  FLOWER_YIELD_TIER_3: 15,
  // Per-tier lifespan once fully grown. Higher tiers live (and refresh)
  // longer, so a rare T3 flower keeps producing well beyond a single
  // bloom cycle.
  FLOWER_LIFESPAN_TIER_1: 60_000,
  FLOWER_LIFESPAN_TIER_2: 120_000,
  FLOWER_LIFESPAN_TIER_3: 240_000,
  // Natural-spawn release valve: if total flowers drops below this
  // baseline, a slow trickle of T1 flowers seeds at random empty meadow
  // tiles so a stalled colony can recover. Above the baseline nothing
  // spawns — the rock-drop seed pipeline is the real flower source.
  NATURAL_FLOWER_BASELINE: 4,
  NATURAL_FLOWER_AVG_INTERVAL_MS: 22_000,

  // Shared
  BEE_SPEED: 90,
  HARVEST_DURATION_MS: 3000,
  IDLE_WANDER_DURATION_MS: 2000,
} as const;

const FLOWER_COUNT = 12;

let flowerIdSeq = 100; // starter flowers use 'flower-0..11'; planted ones get fresh ids
function nextFlowerId(): string {
  flowerIdSeq += 1;
  return `flower-${flowerIdSeq}`;
}

// Assign each starter flower to its slot in MEADOW_FLOWERS. Pulled out
// of createInitialState so save migrations can also call it on a v10
// shape that lacks per-flower positions.
export function seedFlowerPositions(flowers: FlowerData[]): void {
  for (let i = 0; i < flowers.length; i++) {
    const slot = WORLD.MEADOW_FLOWERS[i % WORLD.MEADOW_FLOWERS.length];
    flowers[i].x = slot.x;
    flowers[i].y = slot.y;
  }
}

// Nearest plantable meadow tile not already occupied by another flower.
// "Occupied" means another flower sits within `OCCUPIED_DISTANCE` of the
// tile — keeps planted flowers from stacking on the same spot. Returns
// null if every tile within range is taken — the forager treats this as
// "can't plant" and skips claiming the seed (the drop stays in the pile).
const OCCUPIED_DISTANCE = 28;
export function nearestEmptyMeadowTile(
  state: GameState,
  fromX: number,
  fromY: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const tile of WORLD.MEADOW_TILES) {
    let occupied = false;
    for (const f of state.flowers) {
      const dx = f.x - tile.x;
      const dy = f.y - tile.y;
      if (dx * dx + dy * dy < OCCUPIED_DISTANCE * OCCUPIED_DISTANCE) {
        occupied = true;
        break;
      }
    }
    if (occupied) continue;
    const d = Math.hypot(tile.x - fromX, tile.y - fromY);
    if (d < bestDist) {
      bestDist = d;
      best = tile;
    }
  }
  return best;
}

// Plant a flower at a specific world position. The new flower starts as
// a sapling (growthMs > 0) — invisible/inert to foragers until it opens.
// Tier comes from the seed and decides the eventual bloom yield: T1 =
// common, T2 = uncommon (+yield), T3 = jackpot (big yield).
export function plantFlowerAt(
  state: GameState,
  x: number,
  y: number,
  tier: 1 | 2 | 3,
): FlowerData {
  const flower: FlowerData = {
    id: nextFlowerId(),
    kind: 'pollen',
    x,
    y,
    hue: Math.floor(Math.random() * 360),
    tier,
    yieldRemaining: flowerYieldForTier(tier, state),
    regrowTimerMs: 0,
    growthMs: saplingGrowthMs(state),
    lifespanMs: flowerLifespanForTier(tier, state),
    claimants: 0,
  };
  state.flowers.push(flower);
  return flower;
}

// Per-tier bloom yield. T1 is the default; T2/T3 give meaningfully more
// pollen per flower so a rare seed feels like a real reward.
// `state` is optional so the helper still works for callers that don't
// have access (tests, save migration); when present the Rich Soil
// fertilizer upgrade scales the yield up.
export function flowerYieldForTier(tier: 1 | 2 | 3, state?: GameState): number {
  const base =
    tier === 3 ? TUNING.FLOWER_YIELD_TIER_3 :
    tier === 2 ? TUNING.FLOWER_YIELD_TIER_2 :
    TUNING.FLOWER_YIELD;
  if (!state) return base;
  const richSoil = getUpgradeTier(state, 'fertilizer-rich-soil');
  return Math.round(base * Math.pow(1.25, richSoil));
}

// Per-tier lifespan. Higher tiers persist longer once opened, so a rare
// T3 flower keeps producing through multiple bloom cycles before wither.
// Long Bloom (fertilizer upgrade) compounds this.
export function flowerLifespanForTier(tier: 1 | 2 | 3, state?: GameState): number {
  const base =
    tier === 3 ? TUNING.FLOWER_LIFESPAN_TIER_3 :
    tier === 2 ? TUNING.FLOWER_LIFESPAN_TIER_2 :
    TUNING.FLOWER_LIFESPAN_TIER_1;
  if (!state) return base;
  const longBloom = getUpgradeTier(state, 'fertilizer-long-bloom');
  return Math.round(base * Math.pow(1.3, longBloom));
}

// Effective sapling growth time, after the Quick Sprout fertilizer upgrade.
export function saplingGrowthMs(state: GameState): number {
  const quick = getUpgradeTier(state, 'fertilizer-quick-sprout');
  return TUNING.SAPLING_GROWTH_MS * Math.pow(0.8, quick);
}

// A flower is harvestable once it's no longer a sapling.
export function isFlowerGrown(f: FlowerData): boolean {
  return f.growthMs <= 0;
}

// Remove a rock drop from the pile (e.g., when a forager hauls it back).
export function removeRockDrop(state: GameState, id: string): void {
  const i = state.rockDrops.findIndex((d) => d.id === id);
  if (i < 0) return;
  const removed = state.rockDrops[i];
  state.rockDrops.splice(i, 1);
  // Wake any drop that was resting above the one we just yanked out so
  // the pile collapses instead of leaving a floating column. We check a
  // generous neighborhood (one drop-diameter horizontally, two vertically
  // upward) because a settled drop's support can be slightly off-center.
  // Side-neighbors woken here too — losing your neighbor in a tight stack
  // means you're no longer geometrically wedged in place.
  const r = TUNING.ROCK_DROP_RADIUS;
  const hRange = r * 2.2;
  const vRange = r * 2.4;
  for (const d of state.rockDrops) {
    if (!d.settled) continue;
    const dx = d.x - removed.x;
    if (dx > hRange || dx < -hRange) continue;
    const dy = d.y - removed.y;
    // Only drops AT or ABOVE the removed drop (smaller y). A drop
    // beneath the removed one isn't losing support; waking it would
    // just churn the pile.
    if (dy > 0 || dy < -vRange) continue;
    d.settled = false;
  }
}

// Nearest settled drop not yet claimed by another forager. Used by the
// idle forager's "fly LEFT for a flower or RIGHT for a drop" decision.
export function nearestUnclaimedDrop(
  state: GameState,
  fromX: number,
  fromY: number,
): { drop: RockDrop; dist: number } | null {
  let best: RockDrop | null = null;
  let bestDist = Infinity;
  for (const d of state.rockDrops) {
    if (!d.settled || d.claimedBy) continue;
    const dist = Math.hypot(d.x - fromX, d.y - fromY);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best ? { drop: best, dist: bestDist } : null;
}

// The cells the colony starts with — a small connected cluster at the
// center of the comb, all mutually adjacent. Four starting cells means the
// player can place Forager + Honey Worker + Wax Worker + Cantor all free,
// exercising the full economy on the first session without having to wait
// to bootstrap wax for cell expansion.
const STARTING_CELLS: ReadonlyArray<{ q: number; r: number }> = [
  { q: 0, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 0 },
];

export function createInitialState(): GameState {
  const flowers: FlowerData[] = [];
  for (let i = 0; i < FLOWER_COUNT; i++) {
    // Starter flower positions are imported lazily because state.ts can't
    // import layout.ts without a cycle. Resolve from WORLD lazily on the
    // first call via require-style indirection — see seedFlowerPositions.
    flowers.push({
      id: `flower-${i}`,
      kind: 'pollen',
      x: 0,
      y: 0,
      hue: i * 47,
      tier: 1,
      yieldRemaining: TUNING.FLOWER_YIELD,
      regrowTimerMs: 0,
      growthMs: 0,
      lifespanMs: TUNING.FLOWER_LIFESPAN_TIER_1,
      claimants: 0,
    });
  }
  seedFlowerPositions(flowers);
  const cells: HiveCell[] = STARTING_CELLS.map((c) => ({
    q: c.q,
    r: c.r,
    role: null,
  }));
  return {
    tick: 0,
    elapsedMs: 0,
    hive: {
      id: 'hive',
      pollen: 0,
      pollenCap: TUNING.POLLEN_CAP,
      pollenDots: [],
      wax: 0,
      waxCap: TUNING.WAX_CAP,
      honey: 0,
      honeyCap: TUNING.HONEY_CAP,
      fertilizer: 0,
      fertilizerCap: TUNING.FERTILIZER_CAP,
      cells,
    },
    flowers,
    digSite: {
      id: 'dig-site',
      tier: 1,
      hp: TUNING.DIG_SITE_TIER_1_HP,
      maxHp: TUNING.DIG_SITE_TIER_1_HP,
      state: 'active',
      dropBudget: 0,
      pendingHits: [],
      recentStrikes: [],
    },
    artifacts: { revealed: [], pending: null },
    journal: { entries: [], pending: false, dismissedCount: 0 },
    upgrades: {},
    ascent: { phase: 'none', timer: 0 },
    rockDrops: [],
  };
}

// ---- Upgrade helpers ----

export function getUpgradeTier(state: GameState, id: UpgradeId): number {
  return state.upgrades[id] ?? 0;
}

// An upgrade is purchasable as long as it isn't already maxed. There's no
// unlock gate any more — upgrades are cost-gated only (you need the wax).
export function isUpgradeUnlocked(state: GameState, id: UpgradeId): boolean {
  const def = UPGRADE_DEFS[id];
  return getUpgradeTier(state, id) < def.maxTier;
}

export function nextUpgradeCost(state: GameState, id: UpgradeId): number {
  const def = UPGRADE_DEFS[id];
  const tier = getUpgradeTier(state, id);
  if (tier >= def.maxTier) return 0;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, tier));
}

export function upgradesForRole(role: UpgradeRole): UpgradeDef[] {
  return Object.values(UPGRADE_DEFS).filter((u) => u.role === role);
}

// Human-readable description of an upgrade's effect at a given tier and at
// the *next* tier. Used by the hover tooltip so the player can see the
// concrete impact of their next purchase, not just a generic "+15% per
// tier" blurb. `nextLabel` is null when the upgrade is already maxed.
export interface UpgradeEffectSummary {
  currentLabel: string;
  nextLabel: string | null;
  perTierBlurb: string;
}

export function describeUpgradeEffect(
  state: GameState,
  id: UpgradeId,
): UpgradeEffectSummary {
  const def = UPGRADE_DEFS[id];
  const tier = getUpgradeTier(state, id);
  const maxed = tier >= def.maxTier;
  const nextTier = maxed ? tier : tier + 1;

  const fmtMul = (m: number): string =>
    `${m.toFixed(2)}× (+${Math.round((m - 1) * 100)}%)`;
  const fmtRed = (m: number): string =>
    `${Math.round(m * 100)}% of base (−${Math.round((1 - m) * 100)}%)`;

  let currentLabel: string;
  let nextLabel: string | null;

  switch (id) {
    case 'forager-swift-wings': {
      const cur = Math.pow(1.15, tier);
      const nxt = Math.pow(1.15, nextTier);
      currentLabel = `Flight speed ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'forager-quick-forage': {
      const cur = Math.pow(0.8, tier);
      const nxt = Math.pow(0.8, nextTier);
      currentLabel = `Harvest time ${fmtRed(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtRed(nxt)}`;
      break;
    }
    case 'cantor-quicker-cantrip': {
      const cur = Math.pow(0.8, tier);
      const nxt = Math.pow(0.8, nextTier);
      currentLabel = `Cast interval ${fmtRed(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtRed(nxt)}`;
      break;
    }
    case 'cantor-twin-spark': {
      const cur = Math.pow(1.25, tier);
      const nxt = Math.pow(1.25, nextTier);
      currentLabel = `Spark damage ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'cantor-mana-sip': {
      const everyAt = (t: number): string =>
        t <= 0 ? 'No refund' : `1 mana every ${Math.max(4, 7 - t)} casts`;
      currentLabel = everyAt(tier);
      nextLabel = maxed ? null : `→ ${everyAt(nextTier)}`;
      break;
    }
    case 'waxworker-swift-haul': {
      const cur = Math.pow(1.12, tier);
      const nxt = Math.pow(1.12, nextTier);
      currentLabel = `Move speed ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'waxworker-rich-combs': {
      const cur = 1 + tier;
      const nxt = 1 + nextTier;
      currentLabel = `${cur} wax per delivery`;
      nextLabel = maxed ? null : `→ ${nxt} wax per delivery`;
      break;
    }
    case 'waxworker-deep-coffers': {
      const cur = 15 * tier;
      const nxt = 15 * nextTier;
      currentLabel = `+${cur} wax storage`;
      nextLabel = maxed ? null : `→ +${nxt} wax storage`;
      break;
    }
    case 'fertilizer-rich-soil': {
      const cur = Math.pow(1.25, tier);
      const nxt = Math.pow(1.25, nextTier);
      currentLabel = `Pollen yield ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'fertilizer-long-bloom': {
      const cur = Math.pow(1.3, tier);
      const nxt = Math.pow(1.3, nextTier);
      currentLabel = `Flower lifespan ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'fertilizer-quick-sprout': {
      const cur = Math.pow(0.8, tier);
      const nxt = Math.pow(0.8, nextTier);
      currentLabel = `Sapling growth ${fmtRed(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtRed(nxt)}`;
      break;
    }
  }
  return { currentLabel, nextLabel, perTierBlurb: def.blurb };
}

// Currency-agnostic spend/balance dispatch — used by buyUpgrade and the
// upgrade panel so any currency-typed upgrade just works.
export function currencyBalance(state: GameState, c: Currency): number {
  return c === 'wax' ? totalWax(state) : totalFertilizer(state);
}

export function spendCurrency(state: GameState, c: Currency, amount: number): boolean {
  return c === 'wax' ? spendWax(state, amount) : spendFertilizer(state, amount);
}

// ---- Hex grid helpers ----

// The six axial-coordinate neighbor directions for a pointy-top hex grid.
export const HEX_DIRS: ReadonlyArray<{ q: number; r: number }> = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbors(q: number, r: number): { q: number; r: number }[] {
  return HEX_DIRS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

// Ring distance of a hex coordinate from the comb center (0, 0).
export function hexDistance(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

// ---- Hive / cell helpers ----

export function cellAt(hive: HiveData, q: number, r: number): HiveCell | undefined {
  return hive.cells.find((c) => c.q === q && c.r === r);
}

// True when the cell holds any worker bee — the comb's "filled" predicate.
export function isWorkerCell(cell: HiveCell): boolean {
  return cell.role !== null;
}

export function countRole(state: GameState, role: CellRole): number {
  return state.hive.cells.filter((c) => c.role === role).length;
}

export function totalBees(state: GameState): number {
  return state.hive.cells.filter(isWorkerCell).length;
}

// Pollen sitting in the silo. Capped.
export function totalPollen(state: GameState): number {
  return state.hive.pollen;
}

export function pollenCap(state: GameState): number {
  return state.hive.pollenCap;
}

export function totalWax(state: GameState): number {
  return state.hive.wax;
}

// Wax cap = the stored base plus the Deep Coffers upgrade bonus.
export function waxCap(state: GameState): number {
  return state.hive.waxCap + 15 * getUpgradeTier(state, 'waxworker-deep-coffers');
}

// How much wax a single wax-worker delivery produces (Rich Combs upgrade).
export function waxPerDelivery(state: GameState): number {
  return 1 + getUpgradeTier(state, 'waxworker-rich-combs');
}

export function totalHoney(state: GameState): number {
  return state.hive.honey;
}

export function honeyCap(state: GameState): number {
  return state.hive.honeyCap;
}

export function totalFertilizer(state: GameState): number {
  return state.hive.fertilizer;
}

export function fertilizerCap(state: GameState): number {
  return state.hive.fertilizerCap;
}

// Hex-packed slot positions inside the silo basket. Slot 0 is the
// bottom-leftmost grain; the pile fills row-by-row, bottom-up. Geometry
// must stay in sync with PollenSiloView's interior dimensions — keep
// these constants centralized so the sim and view agree on where dots
// actually sit. Returns silo-local coords; the view applies the silo's
// container transform.
const POLLEN_SLOT_COLS = 6;
const POLLEN_SLOT_COL_W = 3.6;
const POLLEN_SLOT_ROW_H = 2.9;
const POLLEN_SLOT_BOTTOM_Y = 13; // y at which the lowest row sits
export function pollenSlotPos(index: number): { x: number; y: number } {
  const row = Math.floor(index / POLLEN_SLOT_COLS);
  const col = index % POLLEN_SLOT_COLS;
  // Stagger every other row by half a column for a hex-pack look.
  const stagger = row % 2 === 0 ? 0 : POLLEN_SLOT_COL_W / 2;
  const x =
    -POLLEN_SLOT_COL_W * (POLLEN_SLOT_COLS - 1) * 0.5 +
    col * POLLEN_SLOT_COL_W +
    stagger;
  const y = POLLEN_SLOT_BOTTOM_Y - row * POLLEN_SLOT_ROW_H;
  return { x, y };
}

let pollenDotCounter = 0;
function nextPollenDotId(): string {
  pollenDotCounter += 1;
  return `pd-${pollenDotCounter}`;
}

// Add pollen to the silo, clamped to pollenCap. Spawns one physical dot
// entity per unit added; the dot takes the next free slot in the
// hex-packed interior. Returns the amount actually added. Foragers idle
// at the flower altar when the silo is full, so cap-overflow here only
// happens via debug grants.
export function addPollen(state: GameState, amount: number): number {
  const space = Math.max(0, state.hive.pollenCap - state.hive.pollen);
  const added = Math.min(space, Math.max(0, amount));
  for (let i = 0; i < added; i++) {
    const slot = pollenSlotPos(state.hive.pollenDots.length);
    state.hive.pollenDots.push({ id: nextPollenDotId(), x: slot.x, y: slot.y });
  }
  state.hive.pollen += added;
  return added;
}

// Remove pollen from the silo if available. Removes from the TOP of the
// pile (last-in, first-out) so the silhouette drains from the surface
// down — visually matching a worker scooping off the top. Returns true
// on success.
export function takePollen(state: GameState, amount: number): boolean {
  if (state.hive.pollen < amount) return false;
  state.hive.pollen -= amount;
  state.hive.pollenDots.length = Math.max(
    0,
    state.hive.pollenDots.length - amount,
  );
  return true;
}

// Restore the entity list after loading a save written before pollen
// became physical. Old saves only have the scalar; rebuild dots so the
// physical layout matches the count exactly. Idempotent — safe to call
// any time the two might have drifted.
export function syncPollenDotsToScalar(state: GameState): void {
  if (!state.hive.pollenDots) state.hive.pollenDots = [];
  const dots = state.hive.pollenDots;
  while (dots.length < state.hive.pollen) {
    const slot = pollenSlotPos(dots.length);
    dots.push({ id: nextPollenDotId(), x: slot.x, y: slot.y });
  }
  if (dots.length > state.hive.pollen) {
    dots.length = state.hive.pollen;
  }
}

// Add honey to the reservoir, clamped to honeyCap. Returns the amount
// actually added (used by Workers to telegraph "wasted" deposits and by
// Cantor Mana Sip refunds).
export function addHoney(state: GameState, amount: number): number {
  const space = Math.max(0, state.hive.honeyCap - state.hive.honey);
  const added = Math.min(space, Math.max(0, amount));
  state.hive.honey += added;
  return added;
}

// Add wax to the colony's store, clamped to the (upgrade-aware) wax cap.
// Wax workers idle at the Wax Block when full, so a full deposit only
// clamps when the worker over-delivers past the cap on the last trip.
export function addWax(state: GameState, amount: number): number {
  const space = Math.max(0, waxCap(state) - state.hive.wax);
  const added = Math.min(space, Math.max(0, amount));
  state.hive.wax += added;
  return added;
}

// Add fertilizer to the bin, clamped to the cap. Returns amount actually
// added. The cap is generous so over-damaging the rock just piles up
// extras instead of penalizing the player.
export function addFertilizer(state: GameState, amount: number): number {
  const space = Math.max(0, state.hive.fertilizerCap - state.hive.fertilizer);
  const added = Math.min(space, Math.max(0, amount));
  state.hive.fertilizer += added;
  return added;
}

// Spend fertilizer if there is enough. Returns true on success.
export function spendFertilizer(state: GameState, amount: number): boolean {
  if (state.hive.fertilizer < amount) return false;
  state.hive.fertilizer -= amount;
  return true;
}

// Spend honey if there is enough. Returns true if the spell could be cast.
export function spendHoney(state: GameState, amount: number): boolean {
  if (state.hive.honey < amount) return false;
  state.hive.honey -= amount;
  return true;
}

// Spend wax if there is enough. Returns true if the purchase went through.
export function spendWax(state: GameState, amount: number): boolean {
  if (state.hive.wax < amount) return false;
  state.hive.wax -= amount;
  return true;
}

// Mana cost for a single spell of the given caster role.
export function manaCostFor(role: CellRole): number {
  if (role === 'cantor') return TUNING.CANTOR_MANA_COST;
  return 0;
}

// Number of same-role neighbors for the cell at (q, r). Returns 0 for cells
// that are empty or locked. Synergy applies to all worker roles, but only
// foragers and spellcasters actually consume it (workers' downstream
// production is currently un-buffed by adjacency).
export function cellSynergy(hive: HiveData, q: number, r: number): number {
  const cell = cellAt(hive, q, r);
  if (!cell || !isWorkerCell(cell)) return 0;
  let count = 0;
  for (const n of hexNeighbors(q, r)) {
    const neighbor = cellAt(hive, n.q, n.r);
    if (neighbor && neighbor.role === cell.role) count += 1;
  }
  return count;
}

// Locked cells on the frontier — neighbors of existing cells that aren't
// themselves unlocked yet, and that fall within the comb radius cap.
export function buyableCells(hive: HiveData): { q: number; r: number }[] {
  const result: { q: number; r: number }[] = [];
  const seen = new Set<string>();
  for (const cell of hive.cells) {
    for (const n of hexNeighbors(cell.q, cell.r)) {
      const key = `${n.q},${n.r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (cellAt(hive, n.q, n.r)) continue;
      if (hexDistance(n.q, n.r) > TUNING.MAX_COMB_RADIUS) continue;
      result.push(n);
    }
  }
  return result;
}

export function isCellBuyable(hive: HiveData, q: number, r: number): boolean {
  if (cellAt(hive, q, r)) return false;
  return buyableCells(hive).some((c) => c.q === q && c.r === r);
}

// Cost to unlock a comb cell — scales with its ring distance from the
// center, so cells farther out cost more.
export function cellCost(q: number, r: number): number {
  const dist = Math.max(1, hexDistance(q, r));
  return Math.ceil(TUNING.CELL_BASE_COST * Math.pow(TUNING.CELL_COST_GROWTH, dist - 1));
}

// The very first worker placed must be a Forager — without a pollen income
// the player could otherwise soft-lock the colony.
export function mustPlaceForager(state: GameState): boolean {
  return totalBees(state) === 0;
}

// Cost to place the next worker of a role into a cell. The first Forager and
// first Wax Worker are free so the player can always bootstrap the wax/pollen
// loop from an empty hive; every other role's first worker costs wax like any
// subsequent one, which prevents soft-locking by filling early cells with
// roles that can't produce wax (e.g. four Cantors).
export function nextWorkerCost(state: GameState, role: CellRole): number {
  const n = countRole(state, role);
  if (n === 0) {
    if (role === 'forager' || role === 'wax-worker') return 0;
    return TUNING.BEE_BASE_COST;
  }
  return Math.ceil(TUNING.BEE_BASE_COST * Math.pow(TUNING.BEE_COST_GROWTH, n - 1));
}

// True when the silo has at least one pollen dot available for pickup.
// Workers use this to decide whether to fly out or bob at the park spot.
export function pollenAvailable(state: GameState): boolean {
  return state.hive.pollen > 0;
}

// True when the silo has room to accept another pollen dot. Foragers gate
// on this — when the silo is full, the meadow bouquet idles instead of
// flying out for more flowers.
export function pollenSiloHasRoom(state: GameState): boolean {
  return state.hive.pollen < state.hive.pollenCap;
}

// ---- Dig site helpers ----

export function digSiteHpPct(state: GameState): number {
  if (state.digSite.maxHp <= 0) return 0;
  return Math.max(0, state.digSite.hp / state.digSite.maxHp);
}

export function pendingArtifact(state: GameState): ArtifactSpec | null {
  if (!state.artifacts.pending) return null;
  return ARTIFACTS.find((a) => a.id === state.artifacts.pending) ?? null;
}

// ---- Rock-drop helpers ----

let rockDropCounter = 0;
function nextRockDropId(): string {
  rockDropCounter += 1;
  return `rd-${rockDropCounter}`;
}

// Per-channel ±5% value jitter packed back into a 0xRRGGBB tint, so each
// drop's sprite renders slightly off from the canonical color and the
// pile reads as natural rubble rather than stamped assets.
function jitterTint(): number {
  // Each channel is a 0.95–1.05 multiplier rounded to a byte; the upper
  // end can exceed 255, so clamp before packing — Pixi rejects tints
  // whose channels overflow into the alpha byte.
  const m = () => Math.max(0, Math.min(255, Math.round(255 * (0.95 + Math.random() * 0.1))));
  return (m() << 16) | (m() << 8) | m();
}

// True if the pile is at the hard cap. Cantors stop casting while this is
// true so they don't waste mana on an invincible rock. The flip happens
// automatically as soon as a forager hauls one drop away.
export function rockDropPileFull(state: GameState): boolean {
  return state.rockDrops.length >= TUNING.ROCK_DROP_CAP;
}

// Does the dig site accept damage right now? Active state required, plus
// the pile must not be at cap.
export function digSiteAcceptingDamage(state: GameState): boolean {
  return state.digSite.state === 'active' && !rockDropPileFull(state);
}

// Spawn whatever rolled off the rock from a single cantor strike at
// `(originX, originY)`. The drop arcs toward a fixed pile corner at the
// boulder's right base and stacks there under collision physics (see
// rockDropsSystem). Returns the drop (or null for fossil honey /
// pile-full). Fossil honey rolls FIRST and never becomes an entity —
// it just instantly fills the honey jar to cap. Foragers can't haul it;
// the dopamine is the instant fill, not a slow trickle.
export function spawnRockDrop(
  state: GameState,
  originX: number,
  originY: number,
  _settleBaseY: number,
): RockDrop | null {
  const roll = Math.random();
  if (roll < TUNING.DROP_FOSSIL_HONEY_CHANCE) {
    state.hive.honey = state.hive.honeyCap;
    return null;
  }
  if (rockDropPileFull(state)) return null;

  let kind: RockDropKind;
  let tier: 1 | 2 | 3 = 1;
  if (roll < TUNING.DROP_FOSSIL_HONEY_CHANCE + TUNING.DROP_FERTILIZER_CHANCE) {
    kind = 'fertilizer';
  } else {
    kind = 'seed';
    const t = Math.random();
    tier = t < TUNING.SEED_TIER_2_THRESHOLD ? 1 : t < TUNING.SEED_TIER_3_THRESHOLD ? 2 : 3;
  }

  // Drops launch out of the rock with real physics — mostly STRAIGHT UP
  // (small horizontal jitter only) so they land in a tight cluster
  // around the strike point and mound up via pairwise collisions rather
  // than tiling the floor. Mostly-vertical launch + iterative resolver
  // = pile builds tall instead of spreading like water across the floor.
  // A small fraction get a sideways shove for visual chaos but the
  // amount is well below escape velocity from the pile footprint.
  const cornerBias = Math.sign(TUNING.ROCK_PILE_CORNER_X - originX) || 1;
  const sideways = Math.random() < 0.18;
  const dir = sideways ? (Math.random() < 0.7 ? cornerBias : -cornerBias) : 0;
  // Mostly vertical. The horizontal component is small even when present;
  // sin(8°)≈0.14 vs sin(75°)≈0.97 in the old cone — a 7× reduction in
  // horizontal launch speed.
  const angle = (3 + Math.random() * 9) * (Math.PI / 180);
  const speed = 220 + Math.random() * 60;
  const vx = Math.sin(angle) * speed * dir + (Math.random() - 0.5) * 18;
  const vy = -Math.cos(angle) * speed;
  // Settle target fields are kept on the entity for save-shape compat;
  // the new physics simulation ignores them.
  const settleX = TUNING.ROCK_PILE_CORNER_X;
  const settleY = TUNING.ROCK_PILE_FLOOR_Y;

  const drop: RockDrop = {
    id: nextRockDropId(),
    kind,
    tier,
    x: originX,
    y: originY,
    vx,
    vy,
    settleX,
    settleY,
    settled: false,
    claimedBy: null,
    spawnedAtMs: state.elapsedMs,
    rotation: Math.random() * Math.PI * 2,
    // Tumble rate scales loosely with launch speed so fast pops spin
    // faster. Sign is random so half tumble each way.
    spin: (Math.random() - 0.5) * 18,
    tintJitter: jitterTint(),
  };
  state.rockDrops.push(drop);
  return drop;
}

// Convert accumulated damage into drop spawns. Called immediately after
// a hit lands. Each whole point of accumulated damage triggers a burst
// of 1–3 drops at the strike point so loot reads as a chunky spall
// rather than a metronome of singletons.
export function applyDropBudget(
  state: GameState,
  rockX: number,
  rockY: number,
  settleBaseY: number,
): number {
  let spawned = 0;
  while (state.digSite.dropBudget >= 1) {
    state.digSite.dropBudget -= 1;
    const burst = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
    for (let i = 0; i < burst; i++) {
      if (rockDropPileFull(state)) return spawned;
      spawnRockDrop(state, rockX, rockY, settleBaseY);
      spawned += 1;
    }
  }
  return spawned;
}

// Queue a cantor's cast so its damage + drop spawns land at the same
// moment the visual spark arrives at the rock. ETA is derived from the
// spark's projectile speed (matched in World.emitSpark) and the actual
// flight distance, so close-range cantors hit faster than far ones.
export function queuePendingHit(
  state: GameState,
  damage: number,
  originX: number,
  originY: number,
  strikeX: number,
  strikeY: number,
  settleBaseY: number,
): void {
  const dx = strikeX - originX;
  const dy = strikeY - originY;
  const dist = Math.hypot(dx, dy);
  const etaMs = (dist / TUNING.CANTOR_PROJECTILE_SPEED) * 1000;
  state.digSite.pendingHits.push({
    damage,
    strikeX,
    strikeY,
    settleBaseY,
    etaMs,
  });
}

// Tick pending hits forward and resolve any that have landed. Resolution
// applies damage to the rock and converts it into drop spawns. If the
// rock is no longer active (already revealing/sealed) we silently drop
// the hit — the spark visually fizzles into the open artifact glow.
export function tickPendingHits(state: GameState, dtMs: number): void {
  const pending = state.digSite.pendingHits;
  if (pending.length === 0) return;
  let write = 0;
  for (let read = 0; read < pending.length; read++) {
    const hit = pending[read];
    hit.etaMs -= dtMs;
    if (hit.etaMs > 0) {
      if (write !== read) pending[write] = hit;
      write += 1;
      continue;
    }
    if (state.digSite.state === 'active') {
      state.digSite.hp = Math.max(0, state.digSite.hp - hit.damage);
      state.digSite.dropBudget += hit.damage * TUNING.DROP_RATE_PER_DAMAGE;
      applyDropBudget(state, hit.strikeX, hit.strikeY, hit.settleBaseY);
      state.digSite.recentStrikes.push({ x: hit.strikeX, y: hit.strikeY });
    }
  }
  pending.length = write;
}

// ---- Cantor stat helpers ----

export function cantorDamagePerSpark(state: GameState): number {
  const twin = getUpgradeTier(state, 'cantor-twin-spark');
  return TUNING.CANTOR_BASE_DAMAGE * Math.pow(1.25, twin);
}

export function cantorCastIntervalMs(state: GameState): number {
  const quicker = getUpgradeTier(state, 'cantor-quicker-cantrip');
  return TUNING.CANTOR_CAST_INTERVAL_MS * Math.pow(0.8, quicker);
}

// How often a cantor's cast refunds 1 mana (Mana Sip). 0 means no refund.
// Each tier shaves one cast off the refund cycle: 0 → never, 1 → every 6,
// 2 → every 5, 3 → every 4.
export function cantorRefundEveryNCasts(state: GameState): number {
  const sip = getUpgradeTier(state, 'cantor-mana-sip');
  if (sip <= 0) return 0;
  return Math.max(4, 7 - sip);
}
