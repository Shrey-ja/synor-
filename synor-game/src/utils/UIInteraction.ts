/**
 * UIInteraction — Reusable Phaser UI Interaction Helper
 * ──────────────────────────────────────────────────────
 * Attaches enhanced hover / press / tooltip feedback to any interactive
 * Phaser game object WITHOUT removing or replacing existing event listeners.
 * All existing pointerdown / pointerover / game logic is preserved.
 *
 * Usage:
 *   import { attachUIInteraction } from './UIInteraction';
 *   attachUIInteraction(scene, hitRect, {
 *     colorTarget: hitRect,
 *     textTarget:  labelText,
 *     tooltip:     'Detailed description shown on hover',
 *   });
 */

import Phaser from 'phaser';
import { uiSfx } from './UISoundFX';

// ─── Types ────────────────────────────────────────────────────────────────────

type ColorTarget = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
type ScaleTarget = Phaser.GameObjects.GameObject & { scaleX: number; scaleY: number };

export interface UIInteractionOptions {
  /** Object to scale on hover / press (defaults to hitTarget) */
  scaleTarget?: ScaleTarget;

  /** Rectangle or Arc to change fill color on hover */
  colorTarget?: ColorTarget;

  /** Text object to change color on hover */
  textTarget?: Phaser.GameObjects.Text;

  // ── Fill color when hovered ──
  hoverFill?: number;
  hoverFillAlpha?: number;

  // ── Stroke when hovered ──
  hoverStroke?: number;
  hoverStrokeWidth?: number;
  hoverStrokeAlpha?: number;

  // ── Defaults (read from colorTarget if not provided) ──
  defaultFill?: number;
  defaultFillAlpha?: number;
  defaultStroke?: number;
  defaultStrokeWidth?: number;
  defaultStrokeAlpha?: number;

  // ── Text colors ──
  hoverTextColor?: string;
  defaultTextColor?: string;

  // ── Scale bounce ──
  enableScaleBounce?: boolean;   // default: true
  hoverScale?: number;           // default: 1.03
  pressScale?: number;           // default: 0.97

  // ── Sounds ──
  playHoverSound?: boolean;      // default: true
  playClickSound?: boolean;      // default: true
  /** Which click sound to fire (default: 'confirm') */
  soundType?: 'confirm' | 'cancel' | 'telemetry' | 'warning' | 'none';

  // ── Tooltip ──
  /** Text (or a value resolved when hovered) shown near the cursor */
  tooltip?: string | (() => string);
  tooltipDepth?: number;         // default: 9999
  tooltipOffsetX?: number;       // px from cursor X, default: 18
  tooltipOffsetY?: number;       // px from cursor Y, default: -32
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Attaches rich UI interaction to any interactive Phaser game object.
 * Purely additive — does not remove any existing event listeners.
 */
export function attachUIInteraction(
  scene: Phaser.Scene,
  hitTarget: Phaser.GameObjects.GameObject & { on: Function },
  opts: UIInteractionOptions = {}
): void {
  const {
    scaleTarget,
    colorTarget,
    textTarget,
    hoverFill,
    hoverFillAlpha,
    hoverStroke,
    hoverStrokeWidth,
    hoverStrokeAlpha,
    defaultFill,
    defaultFillAlpha,
    defaultStroke,
    defaultStrokeWidth,
    defaultStrokeAlpha,
    hoverTextColor = '#ffffff',
    defaultTextColor,
    enableScaleBounce = true,
    hoverScale = 1.03,
    pressScale = 0.97,
    playHoverSound = true,
    playClickSound = true,
    soundType = 'confirm',
    tooltip,
    tooltipDepth = 9999,
    tooltipOffsetX = 18,
    tooltipOffsetY = -32,
  } = opts;

  // Keep the cursor contract with the helper so callers do not need to
  // duplicate it when attaching the same interaction to a panel or button.
  if (hitTarget.input) {
    hitTarget.input.cursor = 'pointer';
  }

  // Determine the scale target (fallback to hitTarget)
  const scaleable = (scaleTarget ?? hitTarget) as ScaleTarget;
  const baseScaleX: number = (scaleable as any).scaleX ?? 1;
  const baseScaleY: number = (scaleable as any).scaleY ?? 1;

  // Tooltip state
  let tooltipObj: Phaser.GameObjects.Container | null = null;
  let moveFn: ((ptr: Phaser.Input.Pointer) => void) | null = null;

  // ── POINTER OVER ────────────────────────────────────────────────────────────
  hitTarget.on('pointerover', () => {
    // 1. Scale bounce up
    if (enableScaleBounce) {
      scene.tweens.add({
        targets: scaleable,
        scaleX: baseScaleX * hoverScale,
        scaleY: baseScaleY * hoverScale,
        duration: 90,
        ease: 'Back.Out',
      });
    }

    // 2. Color shift
    if (colorTarget) {
      if (hoverFill !== undefined) {
        colorTarget.setFillStyle(hoverFill, hoverFillAlpha ?? 1);
      }
      if (hoverStroke !== undefined) {
        (colorTarget as any).setStrokeStyle(
          hoverStrokeWidth ?? 1.5,
          hoverStroke,
          hoverStrokeAlpha ?? 1
        );
      }
    }

    // 3. Text color
    if (textTarget && hoverTextColor) {
      textTarget.setColor(hoverTextColor);
    }

    // 4. Sound
    if (playHoverSound) {
      uiSfx.hoverTick();
    }

    // 5. Tooltip
    if (tooltip) {
      if (tooltipObj) {
        _destroyTooltip(scene, tooltipObj, moveFn);
      }

      const tooltipText = typeof tooltip === 'function' ? tooltip() : tooltip;
      tooltipObj = _createTooltip(scene, tooltipText, tooltipDepth);
      _positionTooltip(tooltipObj, scene, tooltipOffsetX, tooltipOffsetY);

      moveFn = (ptr: Phaser.Input.Pointer) => {
        if (tooltipObj && tooltipObj.active) {
          _positionTooltipAt(tooltipObj, ptr.x, ptr.y, tooltipOffsetX, tooltipOffsetY);
        }
      };
      scene.input.on('pointermove', moveFn);
    }
  });

  // ── POINTER OUT ─────────────────────────────────────────────────────────────
  hitTarget.on('pointerout', () => {
    // 1. Scale restore
    if (enableScaleBounce) {
      scene.tweens.add({
        targets: scaleable,
        scaleX: baseScaleX,
        scaleY: baseScaleY,
        duration: 100,
        ease: 'Sine.Out',
      });

    }

    // 2. Color restore
    if (colorTarget) {
      if (defaultFill !== undefined) {
        colorTarget.setFillStyle(defaultFill, defaultFillAlpha ?? 1);
      }
      if (defaultStroke !== undefined) {
        (colorTarget as any).setStrokeStyle(
          defaultStrokeWidth ?? 1,
          defaultStroke,
          defaultStrokeAlpha ?? 1
        );
      }
    }

    // 3. Text color restore
    if (textTarget && defaultTextColor) {
      textTarget.setColor(defaultTextColor);
    }

    // 4. Destroy tooltip
    if (tooltipObj) {
      _destroyTooltip(scene, tooltipObj, moveFn);
      tooltipObj = null;
      moveFn = null;
    }
  });

  // ── POINTER DOWN ────────────────────────────────────────────────────────────
  hitTarget.on('pointerdown', () => {
    // 1. Press scale down
    if (enableScaleBounce) {
      scene.tweens.add({
        targets: scaleable,
        scaleX: baseScaleX * pressScale,
        scaleY: baseScaleY * pressScale,
        duration: 60,
        ease: 'Cubic.In',
      });
    }

    // 2. Click sound
    if (playClickSound) {
      _playClickSound(soundType);
    }
  });

  // ── POINTER UP ──────────────────────────────────────────────────────────────
  hitTarget.on('pointerup', () => {
    // Snap back to hover scale (pointer is still over button)
    if (enableScaleBounce) {
      scene.tweens.add({
        targets: scaleable,
        scaleX: baseScaleX * hoverScale,
        scaleY: baseScaleY * hoverScale,
        duration: 80,
        ease: 'Back.Out',
      });
    }
  });

  scene.events.once('shutdown', () => {
    if (tooltipObj) {
      _destroyTooltip(scene, tooltipObj, moveFn);
      tooltipObj = null;
      moveFn = null;
    }
  });
}

// ─── Tooltip Helpers ─────────────────────────────────────────────────────────

function _createTooltip(
  scene: Phaser.Scene,
  text: string,
  depth: number
): Phaser.GameObjects.Container {
  const padding = { x: 14, y: 8 };

  const label = scene.add.text(0, 0, text, {
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: '11px',
    color: '#e2e8f0',
    letterSpacing: 1,
  }).setOrigin(0, 0.5);

  const bg = scene.add
    .rectangle(
      -padding.x,
      0,
      label.width + padding.x * 2,
      22,
      0x040d1a,
      0.94
    )
    .setStrokeStyle(1, 0x38bdf8, 0.7)
    .setOrigin(0, 0.5);

  // Tiny left accent bar
  const accent = scene.add
    .rectangle(-padding.x, 0, 3, 22, 0x38bdf8)
    .setOrigin(0, 0.5);

  const cont = scene.add
    .container(0, 0, [bg, accent, label])
    .setDepth(depth)
    .setAlpha(0);

  // Fade in
  scene.tweens.add({
    targets: cont,
    alpha: 1,
    duration: 140,
    ease: 'Sine.Out',
  });

  return cont;
}

function _positionTooltip(
  tip: Phaser.GameObjects.Container,
  scene: Phaser.Scene,
  offX: number,
  offY: number
) {
  const ptr = scene.input.activePointer;
  _positionTooltipAt(tip, ptr.x, ptr.y, offX, offY);
}

function _positionTooltipAt(
  tip: Phaser.GameObjects.Container,
  x: number,
  y: number,
  offX: number,
  offY: number
) {
  if (!tip || !tip.active) return;
  tip.setPosition(x + offX, y + offY);
}

function _destroyTooltip(
  scene: Phaser.Scene,
  tip: Phaser.GameObjects.Container,
  moveFn: ((ptr: Phaser.Input.Pointer) => void) | null
) {
  if (moveFn) scene.input.off('pointermove', moveFn);

  scene.tweens.add({
    targets: tip,
    alpha: 0,
    duration: 90,
    ease: 'Sine.In',
    onComplete: () => {
      if (tip.active) tip.destroy();
    },
  });
}

// ─── Sound Dispatch ──────────────────────────────────────────────────────────

function _playClickSound(type: UIInteractionOptions['soundType']) {
  switch (type) {
    case 'cancel':    uiSfx.cancel();          break;
    case 'telemetry': uiSfx.telemetryUpdate(); break;
    case 'warning':   uiSfx.warningPulse();    break;
    case 'none':                               break;
    default:          uiSfx.clickConfirm();    break;
  }
}
