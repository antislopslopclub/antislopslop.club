import type { Icons } from "./icons";

export type DrawSprite = (glyph: string, x: number, y: number, scale: number, opacity: number) => void;
export type ClickEffect = (width: number, height: number, now: number, reducedMotion: boolean, draw: DrawSprite) => void;

export type EffectActivity = {
  readonly kind: "effect";
  create(x: number, y: number, start: number, pointer: string): ClickEffect;
};

export function drawEffects(context: CanvasRenderingContext2D, active: ClickEffect[], width: number, height: number,
  now: number, reducedMotion: boolean, visible: Icons) {
  context.clearRect(0, 0, width, height);
  const draw: DrawSprite = (glyph, x, y, scale, opacity) => {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.globalAlpha = opacity;
    context.fillText(glyph, 0, 0);
    context.restore();
    visible.add(glyph, x, y);
  };
  return active.filter(effect => {
    const before = visible.glyph.length;
    effect(width, height, now, reducedMotion, draw);
    return visible.glyph.length > before;
  });
}
