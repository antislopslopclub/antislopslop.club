import { useEffect, useRef } from "react";
import { createRound, findSpace, roundFrame, type Round } from "./minesweeper";
import { emojis } from "./emojis";
import "./index.css";

const cellSize = 24;
const attractionRadius = 140;

type Cell = { emojiIndex: number; nextChange: number; offsetX: number; offsetY: number };

function randomDelay() {
  return 1000 + Math.random() * 4000;
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d");
    if (!context) return;

    const cells: Cell[] = [];
    let columns = 1;
    let rows = 1;
    let cellWidth = cellSize;
    let cellHeight = cellSize;
    let frame: number;

    let lastFrame = performance.now();
    let pointer: { x: number; y: number } | null = null;
    let games: { round: Round; start: number }[] = [];
    const overlays = new Map<number, string>();
    const dirty = new Set<number>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const paintCell = (column: number, row: number, cell: Cell) => {
      const x = (column + 0.5) * cellWidth + cell.offsetX;
      const y = (row + 0.5) * cellHeight + cell.offsetY;
      context.fillText(overlays.get(row * columns + column) ?? emojis[cell.emojiIndex]!, x, y);
    };

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const pixelRatio = window.devicePixelRatio;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      context.font = '16px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "middle";

      columns = Math.max(1, Math.floor(width / cellSize));
      rows = Math.max(1, Math.floor(height / cellSize));
      cellWidth = width / columns;
      cellHeight = height / rows;
      cells.length = rows * columns;
      const now = performance.now();
      overlays.clear();
      // Keep boards that still fit in place before relocating any clipped boards.
      const retained = games.filter(({ round }) =>
        round.left + round.columns <= columns && round.top + round.rows <= rows);
      for (const game of games) {
        if (retained.includes(game)) continue;
        const position = findSpace(columns, rows, game.round, retained.map(g => g.round));
        if (position) {
          Object.assign(game.round, position);
          retained.push(game);
        }
      }
      games = retained;
      for (let index = 0; index < cells.length; index++) {
        const cell = cells[index] ??= {
          emojiIndex: Math.floor(Math.random() * emojis.length),
          nextChange: now + Math.random() * randomDelay(),
          offsetX: 0,
          offsetY: 0,
        };
        paintCell(index % columns, Math.floor(index / columns), cell);
      }
    };

    const invalidate = (left: number, top: number, right: number, bottom: number) => {
      left = Math.max(0, left);
      top = Math.max(0, top);
      right = Math.min(columns - 1, right);
      bottom = Math.min(rows - 1, bottom);
      context.clearRect(left * cellWidth, top * cellHeight,
        (right - left + 1) * cellWidth, (bottom - top + 1) * cellHeight);
      for (let row = top; row <= bottom; row++) {
        for (let column = left; column <= right; column++) dirty.add(row * columns + column);
      }
    };

    const animate = (now: number) => {
      const blend = 1 - Math.exp(-Math.max(0, now - lastFrame) / 95);
      lastFrame = now;
      const target = reducedMotion.matches ? null : pointer;
      let left = columns, right = -1, top = rows, bottom = -1;
      const hands: { column: number; row: number }[] = [];
      overlays.clear();
      games = games.filter(({ round, start }) => {
        const lastColumn = round.left + round.columns - 1;
        const lastRow = round.top + round.rows - 1;
        // Clear the hand and ending glyphs even on the last frame of a round.
        invalidate(round.left - 1, round.top - 1, lastColumn + 1, lastRow + 1);
        const playback = roundFrame(round, now - start, reducedMotion.matches);
        if (!playback) return false;
        for (let row = round.top; row <= lastRow; row++) {
          for (let column = round.left; column <= lastColumn; column++) {
            const glyph = playback.glyphAt(column, row);
            if (glyph) overlays.set(row * columns + column, glyph);
          }
        }
        if (playback.hand) hands.push(playback.hand);
        return true;
      });

      cells.forEach((cell, index) => {
        const changed = now >= cell.nextChange;
        if (changed) {
          const offset = 1 + Math.floor(Math.random() * (emojis.length - 1));
          cell.emojiIndex = (cell.emojiIndex + offset) % emojis.length;
          cell.nextChange = now + randomDelay();
        }
        const displaced = cell.offsetX !== 0 || cell.offsetY !== 0;
        if (!target && !displaced && !changed) return;

        const column = index % columns;
        const row = Math.floor(index / columns);
        const dx = target ? target.x - (column + 0.5) * cellWidth : 0;
        const dy = target ? target.y - (row + 0.5) * cellHeight : 0;
        const distanceSquared = dx * dx + dy * dy;
        if (displaced || (target && distanceSquared < attractionRadius ** 2)) {
          const pull = Math.max(0, 1 - Math.sqrt(distanceSquared) / attractionRadius) ** 2;
          cell.offsetX += (dx * pull - cell.offsetX) * blend;
          cell.offsetY += (dy * pull - cell.offsetY) * blend;
          if (Math.abs(cell.offsetX) < 0.02) cell.offsetX = 0;
          if (Math.abs(cell.offsetY) < 0.02) cell.offsetY = 0;
          left = Math.min(left, column);
          right = Math.max(right, column);
          top = Math.min(top, row);
          bottom = Math.max(bottom, row);
        } else if (changed) {
          invalidate(column, row, column, row);
        }
      });

      // Include one neighboring cell on each side to clear overhanging glyphs.
      if (right >= left) invalidate(left - 1, top - 1, right + 1, bottom + 1);
      for (const index of dirty) {
        paintCell(index % columns, Math.floor(index / columns), cells[index]!);
      }
      dirty.clear();
      for (const { column, row } of hands) {
        const cell = cells[Math.round(row) * columns + Math.round(column)]!;
        context.fillText("👆", (column + 0.76) * cellWidth + cell.offsetX,
          (row + 0.89) * cellHeight + cell.offsetY);
      }
      frame = requestAnimationFrame(animate);
    };

    const follow = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      const bounds = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const release = () => { pointer = null; };
    const lift = (event: PointerEvent) => {
      if (event.isPrimary && event.pointerType !== "mouse") release();
    };
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    const startRound = (anchorX: number, anchorY: number) => {
      const column = Math.max(0, Math.min(columns - 1, Math.floor(anchorX * columns)));
      const row = Math.max(0, Math.min(rows - 1, Math.floor(anchorY * rows)));
      const round = createRound(columns, rows, column, row, games.map(game => game.round));
      if (round) games.push({ round, start: performance.now() });
    };
    canvas.addEventListener("click", event => {
      const bounds = canvas.getBoundingClientRect();
      startRound((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
    }, options);
    canvas.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!event.repeat) startRound(0.5, 0.5);
      }
    }, options);
    canvas.addEventListener("pointermove", follow, options);
    canvas.addEventListener("pointerdown", follow, options);
    canvas.addEventListener("pointerleave", release, options);
    canvas.addEventListener("pointercancel", release, options);
    canvas.addEventListener("pointerup", lift, options);
    window.addEventListener("blur", release, options);

    frame = requestAnimationFrame(animate);
    const observer = new ResizeObserver(resize);
    const box = "devicePixelContentBoxSize" in ResizeObserverEntry.prototype
      ? "device-pixel-content-box"
      : "content-box";
    observer.observe(canvas, { box });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      listeners.abort();
    };
  }, []);

  return (
    <main>
      <canvas ref={canvasRef} role="button" tabIndex={0} aria-label="Play an emoji Minesweeper round" />
    </main>
  );
}
