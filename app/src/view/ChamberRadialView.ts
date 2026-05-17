import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import type { GameState, UpgradeId } from '../sim/state';
import {
  chamberSpec,
  isChamberBuilt,
  totalPollen,
  UPGRADE_DEFS,
  getUpgradeTier,
  isUpgradeUnlocked,
  nextUpgradeCost,
} from '../sim/state';
import { UNDERGROUND, chamberWorldPosition } from '../world/layout';

// Upgrade panel for a selected built chamber. Deliberately NOT a hex
// radial — the cell-buy interaction already owns that vocabulary. This is
// a wooden notice-board nailed to the chamber wall: a vertical column of
// upgrade rows, each with a glyph, name, tier pips, and a cost button.
//
// Lives in world space, anchored to the right of the selected chamber so
// the chamber's interior animation stays visible while the panel is open.

export interface ChamberUpgradePanelCallbacks {
  // Kept on the interface even though one-click dig handles the unbuilt
  // case directly in UndergroundView — leaving the hook lets future
  // "dig from inside the panel" paths slot in without an API change.
  onDigChamber: (id: string) => void;
  onBuyUpgrade: (id: UpgradeId) => void;
  // Click outside the panel (on the dim backdrop) closes the panel.
  // Standard modal-dismiss pattern.
  onDismissBackdrop: () => void;
}

const OVERLAY_ALPHA = 0.55;
const OVERLAY_EXTENT = 6000;

const PANEL_W = 120;
const ROW_H = 16;
const ROW_GAP = 2;
const PANEL_PAD = 5;
const HEADER_H = 12;
const TEXT_SUPERSAMPLE = 6;

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
  chamberId: string;
  container: Container;
  plaque: Graphics;
  header: Text;
  rows: RowSprites[];
}

export class ChamberRadialView {
  readonly container: Container;
  private panelLayer: Container;
  private overlay: Graphics;
  private overlayAlpha = 0;
  private targetOverlayAlpha = 0;
  private currentPanel: PanelSprites | null = null;
  private animMs = 0;
  // Tracked separately from animMs so we can animate close as the inverse
  // of open without restarting the timer.
  private animState: 'closed' | 'opening' | 'open' | 'closing' = 'closed';

  constructor(private callbacks: ChamberUpgradePanelCallbacks) {
    this.container = new Container();

    this.overlay = new Graphics();
    this.overlay
      .rect(-OVERLAY_EXTENT, -OVERLAY_EXTENT, OVERLAY_EXTENT * 2, OVERLAY_EXTENT * 2)
      .fill({ color: 0x000000, alpha: 1 });
    // Backdrop dismiss: clicks on the dim overlay close the panel. The
    // panelLayer sits ABOVE the overlay in z-order, so panel-internal
    // clicks (rows, buttons) are caught by the panel first and don't
    // bubble to the overlay.
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

  update(state: GameState, selectedChamber: string | null, dtMs: number): void {
    // Drive open/close target.
    if (!selectedChamber || !isChamberBuilt(state, selectedChamber)) {
      this.targetOverlayAlpha = 0;
      if (this.animState === 'open' || this.animState === 'opening') {
        this.animState = 'closing';
        this.animMs = 200 - Math.min(200, this.animMs);
      }
    } else {
      this.targetOverlayAlpha = OVERLAY_ALPHA;
      if (this.currentPanel?.chamberId !== selectedChamber) {
        this.rebuildPanel(state, selectedChamber);
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

    // Animate open/close: a 200ms scale + alpha pop.
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

    // Overlay alpha ease.
    const a = 1 - Math.pow(0.001, dtMs / 1000);
    this.overlayAlpha += (this.targetOverlayAlpha - this.overlayAlpha) * a;
    this.overlay.alpha = this.overlayAlpha;
    this.overlay.visible = this.overlayAlpha > 0.005;
  }

  private rebuildPanel(state: GameState, chamberId: string): void {
    this.destroyPanel();
    const spec = chamberSpec(chamberId);
    if (!spec) return;
    const chamberPos = chamberWorldPosition(spec.plot);
    // Anchor the panel directly below the chamber. This keeps the chamber's
    // interior animation visible above, and avoids horizontally overlapping
    // sibling chambers — the panel is wider than a chamber and would cover
    // its neighbors if placed to the side.
    const anchorX = chamberPos.x - PANEL_W / 2;
    const anchorY = chamberPos.y + UNDERGROUND.CHAMBER_H / 2 + 10;

    const container = new Container();
    container.x = anchorX + PANEL_W / 2;
    container.y = anchorY;
    // Scale-in pivot is the top center (where the panel "drops" from).
    container.pivot.set(PANEL_W / 2, 0);

    const rows: RowSprites[] = [];
    const totalH =
      PANEL_PAD * 2 + HEADER_H + spec.upgradeIds.length * (ROW_H + ROW_GAP) - ROW_GAP;

    const plaque = new Graphics();
    drawPlaque(plaque, PANEL_W, totalH);
    container.addChild(plaque);

    const header = makeCrispText(spec.name, {
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
    for (const upgradeId of spec.upgradeIds) {
      const row = this.createRow(upgradeId, PANEL_W - PANEL_PAD * 2);
      row.container.x = PANEL_PAD;
      row.container.y = y;
      container.addChild(row.container);
      rows.push(row);
      y += ROW_H + ROW_GAP;
    }

    this.panelLayer.addChild(container);
    this.currentPanel = { chamberId, container, plaque, header, rows };
    this.refreshPanel(state);
  }

  private refreshPanel(state: GameState): void {
    const panel = this.currentPanel;
    if (!panel) return;
    const have = totalPollen(state);
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
      const btnText = maxed ? 'MAX' : `${cost}🌼`;
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
    const glyph = makeCrispText(def.role === 'forager' ? '🌼' : '⛏', {
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
  }
}

function drawPlaque(g: Graphics, w: number, h: number): void {
  // Wooden plank background — dark frame, warm wood inner, two "nails".
  g.clear();
  g.roundRect(-2, -2, w + 4, h + 4, 5).fill({ color: 0x1a1408, alpha: 0.95 });
  g.roundRect(0, 0, w, h, 4).fill(0x6a4a22);
  // Nails — small bright circles in the top corners.
  g.circle(5, 5, 1.3).fill(0xa89878).stroke({ color: 0x3a2a18, width: 0.4 });
  g.circle(w - 5, 5, 1.3).fill(0xa89878).stroke({ color: 0x3a2a18, width: 0.4 });
  // Border highlight along the top to read as lit from above.
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
