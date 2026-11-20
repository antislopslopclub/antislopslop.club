import type { Icons } from "./icons";

type Grid = {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
};

const tile = 24;
const fallMs = 3000;
const gravity = 1.7;
const bounceFraction = 0.38;
const turnSeconds = 0.5;
const messageMs = 1800;
const blankMs = 2000;
const fillMs = 2900;
const fillStart = fallMs + messageMs + blankMs;

function planRefill(columns: number, rows: number) {
  const centerX = Math.floor(columns / 2);
  const centerY = Math.floor(rows / 2);
  const count = columns * rows;
  const distance = new Float64Array(count);
  for (let index = 0; index < count; index++) {
    const radius = Math.hypot(
      (index % columns) - centerX,
      Math.floor(index / columns) - centerY,
    );
    distance[index] = radius ? radius + Math.random() * 1.6 : 0;
  }
  const order = Uint32Array.from({ length: count }, (_, index) => index);
  order.sort((a, b) => distance[a]! - distance[b]!);

  const appears = new Float64Array(count);
  const changes = new Float64Array(count);
  const furthest = distance[order[count - 1]!]!;
  for (let rank = 0; rank < count; rank++) {
    const cell = order[rank]!;
    appears[rank] =
      rank === 0 ? 0 : 420 + ((fillMs - 420) * distance[cell]!) / furthest;
    changes[rank] = appears[rank]! + 550 + Math.random() * 1750;
  }
  return {
    order,
    appears,
    changes,
    showRefillGlyph: new Int8Array(count).fill(-1),
  };
}

function createSpriteAtlas(icons: Icons, font: string) {
  const glyphs = [...new Set(icons.glyph)];
  const atlas = document.createElement("canvas");
  const pixels = Math.ceil(tile * window.devicePixelRatio);
  atlas.width = glyphs.length * pixels;
  atlas.height = pixels;
  const ink = atlas.getContext("2d")!;
  ink.scale(pixels / tile, pixels / tile);
  ink.font = font;
  ink.textAlign = "center";
  ink.textBaseline = "middle";
  glyphs.forEach((glyph, index) =>
    ink.fillText(glyph, (index + 0.5) * tile, tile / 2),
  );

  return { atlas, glyphs, pixels };
}

function planFall(
  icons: Icons,
  grid: Grid,
  anchorX: number,
  glyphs: string[],
  pixels: number,
) {
  const width = grid.columns * grid.cellWidth;
  const height = grid.rows * grid.cellHeight;
  // Neighboring columns share some height so clumps of icons settle together.
  const pileHeights: number[] = [];
  let heightFraction = 0.07 + Math.random() * 0.12;
  for (let column = 0; column < grid.columns; column++) {
    pileHeights.push(heightFraction);
    const step = (Math.random() - 0.5) * 0.08;
    heightFraction = Math.max(0.05, Math.min(0.23, heightFraction + step));
  }

  const count = icons.glyph.length;
  const pieces = {
    x: new Float64Array(count),
    y: new Float64Array(count),
    sprite: new Uint32Array(count),
    drop: new Float64Array(count),
    impact: new Float64Array(count),
    delay: new Float64Array(count),
    drift: new Float64Array(count),
    tilt: new Float64Array(count),
  };
  let settledAt = 0;
  for (let i = 0; i < count; i++) {
    const x = icons.x[i]! / width;
    const y = icons.y[i]! / height;
    const depth = Math.max(0, 1 - y);
    const column = Math.max(
      0,
      Math.min(grid.columns - 1, Math.floor(x * grid.columns)),
    );
    const floor = 1 - 9 / height - depth * pileHeights[column]!;
    const drop = Math.max(y, floor) - y;
    const impact = Math.sqrt(drop / gravity);
    const delay =
      Math.abs(x - anchorX) * 620 + depth * 260 + Math.random() * 75;
    settledAt = Math.max(
      settledAt,
      delay + 1000 * Math.max(turnSeconds, impact * (1 + bounceFraction)),
    );
    pieces.x[i] = x;
    pieces.y[i] = y;
    pieces.sprite[i] = pixels * glyphs.indexOf(icons.glyph[i]!);
    pieces.drop[i] = drop;
    pieces.impact[i] = impact;
    pieces.delay[i] = delay;
    pieces.drift[i] = (Math.random() - 0.5) * 28;
    pieces.tilt[i] = (Math.random() - 0.5) * 3.6;
  }
  return { pieces, settledAt };
}

export function createFinale(
  context: CanvasRenderingContext2D,
  icons: Icons,
  grid: Grid,
  anchorX: number,
  start: number,
) {
  const { atlas, glyphs, pixels } = createSpriteAtlas(icons, context.font);
  const { pieces, settledAt } = planFall(icons, grid, anchorX, glyphs, pixels);
  let refill: ReturnType<typeof planRefill>;
  let layout: Grid | undefined;
  let cleared = false;
  let settledGrid: Grid | undefined;
  let settledWithReducedMotion = false;

  return (
    grid: Grid,
    now: number,
    reducedMotion: boolean,
    paint: (
      index: number,
      showRefillGlyph: boolean,
      nextChange: number,
    ) => void,
  ) => {
    const width = grid.columns * grid.cellWidth;
    const height = grid.rows * grid.cellHeight;
    const elapsed = now - start;
    if (elapsed < fallMs) {
      if (grid === settledGrid && reducedMotion === settledWithReducedMotion)
        return "fall";
      context.clearRect(0, 0, width, height);
      const { a: scaleX, d: scaleY } = context.getTransform();
      for (let i = 0; i < pieces.x.length; i++) {
        const t = Math.max(0, elapsed - pieces.delay[i]!) / 1000;
        const impact = pieces.impact[i]!;
        const drop = pieces.drop[i]!;
        const afterImpact = Math.max(0, t - impact);
        const bounce = Math.max(
          0,
          afterImpact * (bounceFraction * impact - afterImpact) * gravity,
        );
        const travel = reducedMotion
          ? drop
          : Math.min(drop, gravity * t * t) - bounce;
        const turn = reducedMotion ? 0 : Math.min(t / turnSeconds, 1);
        context.translate(
          pieces.x[i]! * width + pieces.drift[i]! * turn,
          (pieces.y[i]! + travel) * height,
        );
        if (turn) context.rotate(pieces.tilt[i]! * turn);
        context.drawImage(
          atlas,
          pieces.sprite[i]!,
          0,
          pixels,
          pixels,
          -tile / 2,
          -tile / 2,
          tile,
          tile,
        );
        context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      }
      settledGrid = reducedMotion || elapsed >= settledAt ? grid : undefined;
      settledWithReducedMotion = reducedMotion;
      return "fall";
    }

    if (!cleared) {
      context.clearRect(0, 0, width, height);
      cleared = true;
    }
    if (elapsed < fallMs + messageMs) return "message";
    if (elapsed < fillStart) return "blank";

    if (grid !== layout) {
      refill = planRefill(grid.columns, grid.rows);
      layout = grid;
    }
    const age = elapsed - fillStart;
    for (let rank = 0; rank < refill.order.length; rank++) {
      if (refill.appears[rank]! > age) break;
      const showRefillGlyph = age < refill.changes[rank]!;
      if (refill.showRefillGlyph[rank] === Number(showRefillGlyph)) continue;
      paint(
        refill.order[rank]!,
        showRefillGlyph,
        start + fillStart + refill.changes[rank]!,
      );
      refill.showRefillGlyph[rank] = Number(showRefillGlyph);
    }
    return age >= refill.appears[refill.order.length - 1]! ? "done" : "fill";
  };
}
