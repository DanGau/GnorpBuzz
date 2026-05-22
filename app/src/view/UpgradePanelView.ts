import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import type { GameState, UpgradeId, UpgradeRole } from '../sim/state';
import {
  describeUpgradeEffect,
  upgradesForRole,
  totalWax,
  UPGRADE_DEFS,
  getUpgradeTier,
  isUpgradeUnlocked,
  nextUpgradeCost,
} from '../sim/state';

// Contextual upgrade panel anchored to a world object. Clicking a resource
// building opens this panel showing that role's upgrades:
//   Pollen Silo  → forager
//   Honey Jar    → cantor
//   Wax Block    → wax-worker
//
// A wooden notice-board: a vertical column of upgrade rows, each with a
// glyph, name, tier pips, and a wax cost button. Lives in world space,
// anchored just below the clicked object. (This replaces the old
// underground ChamberRadialView — same visual vocabulary, no dig gate.)

export interface UpgradePanelCallbacks {
  onBuyUpgrade: (id: UpgradeId) => void;
  // Click outside the panel (on the dim backdrop) closes it.
  onDismissBackdrop: () => void;
}

const OVERLAY_ALPHA = 0.5;
const OVERLAY_EXTENT = 6000;

const PANEL_W = 120;
const ROW_H = 16;
const ROW_GAP = 2;
const PANEL_PAD = 5;
const HEADER_H = 12;
const TEXT_SUPERSAMPLE = 6;

const ROLE_LABEL: Record<UpgradeRole, string> = {
  forager: 'Forager',
  cantor: 'Cantor',
  'wax-worker': 'Wax Worker',
};

const ROLE_GLYPH: Record<UpgradeRole, string> = {
  forager: '🌼',
  cantor: '✦',
  'wax-worker': '🕯',
};

interface RowSprites {
  upgradeId: UpgradeId;
  container: Container;
  body: Graphics;
  glyph: Text;
  name: Text;
  pips: Graphics;
  button: Graphics;
  buttonText: Text;
  shownState: string;
  enabled: boolean;
  onSelect: () => void;
}

interface PanelSprites {
  role: UpgradeRole;
  container: Container;
  plaque: Graphics;
  header: Text;
  rows: RowSprites[];
}

const TT_W = 150;
const TT_PAD = 6;
const TT_GAP = 6;

interface TooltipSprites {
  container: Container;
  plaque: Graphics;
  title: Text;
  subtitle: Text;
  blurb: Text;
  current: Text;
  next: Text;
  cost: Text;
  caret: Graphics;
}

export class UpgradePanelView {
  readonly container: Container;
  private panelLayer: Container;
  private overlay: Graphics;
  private overlayAlpha = 0;
  private targetOverlayAlpha = 0;
  private currentPanel: PanelSprites | null = null;
  private animMs = 0;
  private animState: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  private tooltip: TooltipSprites | null = null;
  private hoveredUpgrade: UpgradeId | null = null;
  private tooltipAlpha = 0;
  private targetTooltipAlpha = 0;
  // Anchor world position of the currently-open panel's object.
  private anchor: { x: number; y: number } = { x: 0, y: 0 };

  constructor(private callbacks: UpgradePanelCallbacks) {
    this.container = new Container();

    this.overlay = new Graphics();
    this.overlay
      .rect(-OVERLAY_EXTENT, -OVERLAY_EXTENT, OVERLAY_EXTENT * 2, OVERLAY_EXTENT * 2)
      .fill({ color: 0x000000, alpha: 1 });
    this.overlay.eventMode = 'static';
    this.overlay.cursor = 'default';
    this.overlay.on('pointertap', (e) => {
      e.stopPropagation();
      this.callbacks.onDismissBackdrop();
    });
    this.overlay.alpha = 0;
    this.overlay.visible = false;

    this.panelLayer = new Container();
    this.panelLayer.eventMode = 'static';

    this.container.addChild(this.overlay, this.panelLayer);
  }

  private viewportWorld = { left: 0, right: 1280, top: 0, bottom: 1000 };

  update(
    state: GameState,
    selectedRole: UpgradeRole | null,
    anchor: { x: number; y: number } | null,
    dtMs: number,
    viewportWorld?: { left: number; right: number; top: number; bottom: number },
  ): void {
    if (viewportWorld) this.viewportWorld = viewportWorld;
    if (anchor) this.anchor = anchor;

    if (!selectedRole) {
      this.targetOverlayAlpha = 0;
      if (this.animState === 'open' || this.animState === 'opening') {
        this.animState = 'closing';
        this.animMs = 200 - Math.min(200, this.animMs);
      }
    } else {
      this.targetOverlayAlpha = OVERLAY_ALPHA;
      if (this.currentPanel?.role !== selectedRole) {
        this.rebuildPanel(state, selectedRole);
        this.animState = 'opening';
        this.animMs = 0;
      } else {
        this.refreshPanel(state);
        if (this.animState === 'closed' || this.animState === 'closing') {
          this.animState = 'opening';
          this.animMs = 0;
        }
      }
    }

    if (this.animState !== 'closed') {
      this.animMs = Math.min(200, this.animMs + dtMs);
      const t = this.animMs / 200;
      const opening = this.animState === 'opening' || this.animState === 'open';
      const ease = opening ? easeOutBack(t) : 1 - easeInCubic(t);
      const scale = 0.6 + 0.4 * ease;
      const alpha = opening ? Math.min(1, t * 2) : 1 - t;
      if (this.currentPanel) {
        this.currentPanel.container.scale.set(scale);
        this.currentPanel.container.alpha = alpha;
      }
      if (this.animMs >= 200) {
        if (this.animState === 'opening') this.animState = 'open';
        else if (this.animState === 'closing') {
          this.animState = 'closed';
          this.destroyPanel();
        }
      }
    }

    const a = 1 - Math.pow(0.001, dtMs / 1000);
    this.overlayAlpha += (this.targetOverlayAlpha - this.overlayAlpha) * a;
    this.overlay.alpha = this.overlayAlpha;
    this.overlay.visible = this.overlayAlpha > 0.005;

    if (this.hoveredUpgrade !== null && this.currentPanel) {
      this.refreshTooltip(state);
      this.targetTooltipAlpha = 1;
    } else {
      this.targetTooltipAlpha = 0;
    }
    const tt = 1 - Math.pow(0.0008, dtMs / 1000);
    this.tooltipAlpha += (this.targetTooltipAlpha - this.tooltipAlpha) * tt;
    if (this.tooltip) {
      this.tooltip.container.alpha = this.tooltipAlpha;
      this.tooltip.container.visible = this.tooltipAlpha > 0.01;
    }
  }

  private rebuildPanel(state: GameState, role: UpgradeRole): void {
    this.destroyPanel();
    const upgrades = upgradesForRole(role);
    // Anchor the panel just below the clicked object, centered on it.
    const anchorX = this.anchor.x - PANEL_W / 2;
    const anchorY = this.anchor.y + 26;

    const container = new Container();
    container.x = anchorX + PANEL_W / 2;
    container.y = anchorY;
    container.pivot.set(PANEL_W / 2, 0);

    const rows: RowSprites[] = [];
    const totalH =
      PANEL_PAD * 2 + HEADER_H + upgrades.length * (ROW_H + ROW_GAP) - ROW_GAP;

    const plaque = new Graphics();
    drawPlaque(plaque, PANEL_W, totalH);
    container.addChild(plaque);

    const header = makeCrispText(`${ROLE_GLYPH[role]} ${ROLE_LABEL[role]}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 7 * TEXT_SUPERSAMPLE,
      fontWeight: '800',
      fill: 0xfff2cf,
      align: 'left',
    });
    header.anchor.set(0, 0.5);
    header.x = PANEL_PAD;
    header.y = PANEL_PAD + HEADER_H * 0.5;
    container.addChild(header);

    let y = PANEL_PAD + HEADER_H;
    for (const def of upgrades) {
      const row = this.createRow(def.id, PANEL_W - PANEL_PAD * 2);
      row.container.x = PANEL_PAD;
      row.container.y = y;
      container.addChild(row.container);
      rows.push(row);
      y += ROW_H + ROW_GAP;
    }

    this.panelLayer.addChild(container);
    this.currentPanel = { role, container, plaque, header, rows };
    this.refreshPanel(state);
    this.ensureTooltip();
  }

  private refreshPanel(state: GameState): void {
    const panel = this.currentPanel;
    if (!panel) return;
    const have = totalWax(state);
    for (const row of panel.rows) {
      const def = UPGRADE_DEFS[row.upgradeId];
      const tier = getUpgradeTier(state, row.upgradeId);
      const maxed = tier >= def.maxTier;
      const unlocked = isUpgradeUnlocked(state, row.upgradeId);
      const cost = maxed ? 0 : nextUpgradeCost(state, row.upgradeId);
      const enabled = !maxed && unlocked && have >= cost;
      const stateKey = `${tier}/${def.maxTier}|${enabled ? '1' : '0'}|${cost}`;
      if (stateKey === row.shownState) continue;
      row.shownState = stateKey;
      row.enabled = enabled;
      row.onSelect = () => this.callbacks.onBuyUpgrade(row.upgradeId);
      row.name.text = def.name;
      this.drawRowPips(row.pips, tier, def.maxTier, PANEL_W - PANEL_PAD * 2);
      const btnText = maxed ? 'MAX' : `${cost}🕯`;
      row.buttonText.text = btnText;
      drawRowButton(row.button, enabled);
      const dimColor = enabled ? 0xfff2cf : 0x8a7a4a;
      row.name.style.fill = dimColor;
      row.glyph.style.fill = dimColor;
      row.container.alpha = enabled || maxed ? 1 : 0.75;
      row.container.cursor = enabled ? 'pointer' : 'not-allowed';
    }
  }

  private createRow(upgradeId: UpgradeId, rowW: number): RowSprites {
    const def = UPGRADE_DEFS[upgradeId];
    const c = new Container();
    c.eventMode = 'static';
    const body = new Graphics();
    drawRowBg(body, rowW, ROW_H);
    const glyph = makeCrispText(ROLE_GLYPH[def.role], {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 8 * TEXT_SUPERSAMPLE,
      fontWeight: '700',
      fill: 0xfff2cf,
      align: 'center',
    });
    glyph.anchor.set(0.5);
    glyph.x = 7;
    glyph.y = ROW_H / 2;
    const name = makeCrispText(def.name, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 5.5 * TEXT_SUPERSAMPLE,
      fontWeight: '700',
      fill: 0xfff2cf,
      align: 'left',
    });
    name.anchor.set(0, 0.5);
    name.x = 14;
    name.y = ROW_H / 2 - 2;
    const pips = new Graphics();
    const button = new Graphics();
    const buttonText = makeCrispText('', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 5.5 * TEXT_SUPERSAMPLE,
      fontWeight: '800',
      fill: 0x1a1408,
      align: 'center',
    });
    buttonText.anchor.set(0.5);
    const btnX = rowW - 14;
    button.x = btnX;
    button.y = ROW_H / 2;
    buttonText.x = btnX;
    buttonText.y = ROW_H / 2;
    c.addChild(body, glyph, name, pips, button, buttonText);

    const row: RowSprites = {
      upgradeId,
      container: c,
      body,
      glyph,
      name,
      pips,
      button,
      buttonText,
      shownState: '',
      enabled: false,
      onSelect: () => {},
    };
    c.on('pointertap', (e) => {
      e.stopPropagation();
      if (!row.enabled) return;
      row.onSelect();
    });
    c.on('pointerover', () => {
      this.hoveredUpgrade = row.upgradeId;
    });
    c.on('pointerout', () => {
      if (this.hoveredUpgrade === row.upgradeId) this.hoveredUpgrade = null;
    });
    return row;
  }

  private drawRowPips(g: Graphics, tier: number, max: number, rowW: number): void {
    g.clear();
    const pipR = 1.4;
    const gap = 3;
    const totalW = max * (pipR * 2) + (max - 1) * gap;
    const startX = rowW - 30 - totalW;
    const y = ROW_H / 2 + 3;
    for (let i = 0; i < max; i++) {
      const x = startX + i * (pipR * 2 + gap);
      const filled = i < tier;
      g.circle(x, y, pipR).fill({
        color: filled ? 0xf5d166 : 0x3a2510,
        alpha: filled ? 1 : 0.9,
      }).stroke({ color: 0x1a1408, width: 0.4, alpha: 0.8 });
    }
  }

  private destroyPanel(): void {
    if (!this.currentPanel) return;
    this.panelLayer.removeChild(this.currentPanel.container);
    this.currentPanel.container.destroy({ children: true });
    this.currentPanel = null;
    this.destroyTooltip();
    this.hoveredUpgrade = null;
  }

  private ensureTooltip(): void {
    if (this.tooltip) return;
    if (!this.currentPanel) return;
    const container = new Container();
    container.eventMode = 'none';
    container.visible = false;
    container.alpha = 0;
    const plaque = new Graphics();
    container.addChild(plaque);

    const mk = (
      size: number,
      weight: TextStyleOptions['fontWeight'],
      fill: number,
      wrap = false,
    ): Text =>
      makeCrispText('', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: size * TEXT_SUPERSAMPLE,
        fontWeight: weight,
        fill,
        align: 'left',
        wordWrap: wrap,
        wordWrapWidth: (TT_W - TT_PAD * 2) * TEXT_SUPERSAMPLE,
      });

    const title = mk(7, '800', 0xfff2cf);
    const subtitle = mk(5, '700', 0xf5d166);
    const blurb = mk(5, '500', 0xcfc6a8, true);
    const current = mk(5, '600', 0xfff2cf, true);
    const next = mk(5, '700', 0xa0e0a0, true);
    const cost = mk(5, '800', 0xfff2cf);
    for (const t of [title, subtitle, blurb, current, next, cost]) {
      t.anchor.set(0, 0);
      container.addChild(t);
    }
    const caret = new Graphics();
    container.addChild(caret);

    this.panelLayer.addChild(container);
    this.tooltip = { container, plaque, title, subtitle, blurb, current, next, cost, caret };
  }

  private destroyTooltip(): void {
    if (!this.tooltip) return;
    this.panelLayer.removeChild(this.tooltip.container);
    this.tooltip.container.destroy({ children: true });
    this.tooltip = null;
  }

  private refreshTooltip(state: GameState): void {
    if (!this.tooltip || !this.currentPanel) return;
    const upgradeId = this.hoveredUpgrade;
    if (!upgradeId) return;
    const def = UPGRADE_DEFS[upgradeId];
    const tier = getUpgradeTier(state, upgradeId);
    const maxed = tier >= def.maxTier;
    const have = totalWax(state);
    const upcost = maxed ? 0 : nextUpgradeCost(state, upgradeId);
    const summary = describeUpgradeEffect(state, upgradeId);

    this.tooltip.title.text = def.name;
    this.tooltip.subtitle.text = maxed
      ? `Tier ${tier}/${def.maxTier} · MAX`
      : `Tier ${tier}/${def.maxTier}`;
    this.tooltip.blurb.text = summary.perTierBlurb;
    this.tooltip.current.text = `Now: ${summary.currentLabel}`;
    if (maxed) {
      this.tooltip.next.text = 'Fully upgraded — no further tiers.';
      this.tooltip.next.style.fill = 0x8a7a4a;
    } else {
      this.tooltip.next.text = `Next: ${summary.nextLabel ?? ''}`;
      this.tooltip.next.style.fill = have >= upcost ? 0xa0e0a0 : 0xe0a070;
    }
    this.tooltip.cost.text = maxed
      ? ''
      : have >= upcost
        ? `Cost: ${upcost}🕯  ✓ affordable`
        : `Cost: ${upcost}🕯  (need ${upcost - have} more)`;
    if (!maxed) {
      this.tooltip.cost.style.fill = have >= upcost ? 0xa0e0a0 : 0xe0a070;
    }

    const row = this.currentPanel.rows.find((r) => r.upgradeId === upgradeId);
    if (!row) return;
    const panelC = this.currentPanel.container;
    const rowMidWorld = {
      x: panelC.x - panelC.pivot.x + row.container.x + (PANEL_W - PANEL_PAD * 2) / 2,
      y: panelC.y - panelC.pivot.y + row.container.y + ROW_H / 2,
    };

    let y = TT_PAD;
    this.tooltip.title.x = TT_PAD;
    this.tooltip.title.y = y;
    y += this.tooltip.title.height + 1;
    this.tooltip.subtitle.x = TT_PAD;
    this.tooltip.subtitle.y = y;
    y += this.tooltip.subtitle.height + 4;
    this.tooltip.blurb.x = TT_PAD;
    this.tooltip.blurb.y = y;
    y += this.tooltip.blurb.height + 4;
    this.tooltip.current.x = TT_PAD;
    this.tooltip.current.y = y;
    y += this.tooltip.current.height + 2;
    this.tooltip.next.x = TT_PAD;
    this.tooltip.next.y = y;
    y += this.tooltip.next.height + 4;
    if (this.tooltip.cost.text.length > 0) {
      this.tooltip.cost.x = TT_PAD;
      this.tooltip.cost.y = y;
      y += this.tooltip.cost.height + 2;
    }
    const totalH = y + TT_PAD;

    const g = this.tooltip.plaque;
    g.clear();
    g.roundRect(-2, -2, TT_W + 4, totalH + 4, 7).fill({ color: 0x1a1408, alpha: 0.95 });
    g.roundRect(0, 0, TT_W, totalH, 5).fill(0x3a2510);
    g.roundRect(0, 0, TT_W, totalH, 5).stroke({ color: 0xf5d166, width: 1, alpha: 0.45 });
    g.rect(2, 2, TT_W - 4, 1).fill({ color: 0xc8a878, alpha: 0.55 });

    const halfPanelInner = (PANEL_W - PANEL_PAD * 2) / 2;
    const rightX = rowMidWorld.x + halfPanelInner + TT_GAP;
    const leftX = rowMidWorld.x - halfPanelInner - TT_GAP - TT_W;
    const fitsRight = rightX + TT_W <= this.viewportWorld.right;
    const fitsLeft = leftX >= this.viewportWorld.left;
    const rightOverflow = Math.max(0, rightX + TT_W - this.viewportWorld.right);
    const leftOverflow = Math.max(0, this.viewportWorld.left - leftX);
    const useRight = fitsRight || (!fitsLeft && rightOverflow <= leftOverflow);
    let tx = useRight ? rightX : leftX;
    let caretSuppressed = false;
    if (tx + TT_W > this.viewportWorld.right) {
      tx = this.viewportWorld.right - TT_W - 4;
      caretSuppressed = true;
    }
    if (tx < this.viewportWorld.left) {
      tx = this.viewportWorld.left + 4;
      caretSuppressed = true;
    }
    let ty = rowMidWorld.y - totalH / 2;
    if (ty + totalH > this.viewportWorld.bottom) ty = this.viewportWorld.bottom - totalH - 4;
    if (ty < this.viewportWorld.top) ty = this.viewportWorld.top + 4;
    this.tooltip.container.x = tx;
    this.tooltip.container.y = ty;

    const caret = this.tooltip.caret;
    caret.clear();
    if (caretSuppressed) {
      // no caret
    } else if (useRight) {
      caret.poly([0, totalH / 2 - 6, -6, totalH / 2, 0, totalH / 2 + 6])
        .fill({ color: 0x1a1408, alpha: 0.95 });
      caret.poly([0, totalH / 2 - 4, -4, totalH / 2, 0, totalH / 2 + 4]).fill(0x3a2510);
    } else {
      caret.poly([TT_W, totalH / 2 - 6, TT_W + 6, totalH / 2, TT_W, totalH / 2 + 6])
        .fill({ color: 0x1a1408, alpha: 0.95 });
      caret.poly([TT_W, totalH / 2 - 4, TT_W + 4, totalH / 2, TT_W, totalH / 2 + 4])
        .fill(0x3a2510);
    }
  }
}

function drawPlaque(g: Graphics, w: number, h: number): void {
  g.clear();
  g.roundRect(-2, -2, w + 4, h + 4, 5).fill({ color: 0x1a1408, alpha: 0.95 });
  g.roundRect(0, 0, w, h, 4).fill(0x6a4a22);
  g.circle(5, 5, 1.3).fill(0xa89878).stroke({ color: 0x3a2a18, width: 0.4 });
  g.circle(w - 5, 5, 1.3).fill(0xa89878).stroke({ color: 0x3a2a18, width: 0.4 });
  g.rect(1.5, 1.5, w - 3, 1).fill({ color: 0xc8a878, alpha: 0.6 });
}

function drawRowBg(g: Graphics, w: number, h: number): void {
  g.clear();
  g.roundRect(0, 0, w, h, 2.5).fill({ color: 0x3a2510, alpha: 0.75 });
  g.roundRect(0, 0, w, h, 2.5).stroke({ color: 0x8a6a3a, width: 0.5, alpha: 0.7 });
}

function drawRowButton(g: Graphics, enabled: boolean): void {
  g.clear();
  const w = 22;
  const h = 11;
  const fill = enabled ? 0xf5d166 : 0x6a5634;
  const stroke = enabled ? 0xfff2cf : 0x3a2a18;
  g.roundRect(-w / 2, -h / 2, w, h, 2.5)
    .fill({ color: fill, alpha: 1 })
    .stroke({ color: stroke, width: 0.8, alpha: 0.9 });
}

function makeCrispText(text: string, style: TextStyleOptions): Text {
  const t = new Text({ text, style });
  t.scale.set(1 / TEXT_SUPERSAMPLE);
  return t;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

function easeInCubic(t: number): number {
  return t * t * t;
}
