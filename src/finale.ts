export type Icon = { glyph: string; x: number; y: number };

type Grid = { columns: number; rows: number; cellWidth: number; cellHeight: number };

const fallMs = 3000;
const messageMs = 1800;
const blankMs = 2000;
const fillMs = 2900;
const fillStart = fallMs + messageMs + blankMs;

function planRefill(columns: number, rows: number) {
  const centerX = Math.floor(columns / 2);
  const centerY = Math.floor(rows / 2);
  const order = Array.from({ length: columns * rows }, (_, index) => {
    const distance = Math.hypot(index % columns - centerX, Math.floor(index / columns) - centerY);
    return { index, distance: distance ? distance + Math.random() * 1.6 : 0 };
  }).sort((a, b) => a.distance - b.distance);

  return order.map(({ index, distance }, rank) => {
    const appears = rank === 0 ? 0 : 420 + (fillMs - 420) * distance / order[order.length - 1]!.distance;
    return { index, appears, changes: appears + 550 + Math.random() * 1750, wink: null as boolean | null };
  });
}

export function createFinale(context: CanvasRenderingContext2D, icons: Icon[], grid: Grid,
  anchorX: number, start: number) {
  const width = grid.columns * grid.cellWidth;
  const height = grid.rows * grid.cellHeight;
  // Rasterize each distinct glyph once, including flags and hands from active rounds.
  const glyphs = [...new Set(icons.map(icon => icon.glyph))];
  const atlas = document.createElement("canvas");
  const tile = 24;
  const pixels = Math.ceil(tile * window.devicePixelRatio);
  atlas.width = glyphs.length * pixels;
  atlas.height = pixels;
  const ink = atlas.getContext("2d")!;
  ink.scale(pixels / tile, pixels / tile);
  ink.font = context.font;
  ink.textAlign = "center";
  ink.textBaseline = "middle";
  glyphs.forEach((glyph, index) => ink.fillText(glyph, (index + 0.5) * tile, tile / 2));

  // Neighboring columns share some height so clumps of icons settle together.
  const pileHeights: number[] = [];
  let heightFraction = 0.07 + Math.random() * 0.12;
  for (let column = 0; column < grid.columns; column++) {
    pileHeights.push(heightFraction);
    const step = (Math.random() - 0.5) * 0.08;
    heightFraction = Math.max(0.05, Math.min(0.23, heightFraction + step));
  }

  const pieces = icons.map(icon => {
    const x = icon.x / width;
    const y = icon.y / height;
    const depth = Math.max(0, 1 - y);
    const column = Math.max(0, Math.min(grid.columns - 1, Math.floor(x * grid.columns)));
    const floor = 1 - 9 / height - depth * pileHeights[column]!;
    return {
      sprite: pixels * glyphs.indexOf(icon.glyph), x, y, floor: Math.max(y, floor),
      delay: Math.abs(x - anchorX) * 620 + depth * 260 + Math.random() * 75,
      drift: (Math.random() - 0.5) * 28,
      tilt: (Math.random() - 0.5) * 3.6,
    };
  });
  let refill: ReturnType<typeof planRefill> = [];
  let layout: Grid | undefined;
  let cleared = false;

  return (grid: Grid, now: number, reducedMotion: boolean,
    paint: (index: number, wink: boolean, nextChange: number) => void) => {
    const width = grid.columns * grid.cellWidth;
    const height = grid.rows * grid.cellHeight;
    const elapsed = now - start;
    if (elapsed < fallMs) {
      context.clearRect(0, 0, width, height);
      for (const piece of pieces) {
        const t = Math.max(0, elapsed - piece.delay) / 1000;
        const drop = piece.floor - piece.y;
        const impact = Math.sqrt(drop / 1.7);
        const after = Math.max(0, t - impact);
        const bounce = Math.max(0, after * (0.38 * impact - after) * 1.7);
        const travel = reducedMotion ? drop : Math.min(drop, 1.7 * t * t) - bounce;
        const turn = reducedMotion ? 0 : Math.min(t * 2, 1);
        context.save();
        context.translate(piece.x * width + piece.drift * turn, (piece.y + travel) * height);
        context.rotate(piece.tilt * turn);
        context.drawImage(atlas, piece.sprite, 0, pixels, pixels, -tile / 2, -tile / 2, tile, tile);
        context.restore();
      }
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
    for (const cell of refill) {
      if (cell.appears > age) break;
      const wink = age < cell.changes;
      if (cell.wink === wink) continue;
      paint(cell.index, wink, start + fillStart + cell.changes);
      cell.wink = wink;
    }
    return age >= refill[refill.length - 1]!.appears ? "done" : "fill";
  };
}
