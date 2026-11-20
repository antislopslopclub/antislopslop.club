import { useEffect, useRef, useState } from "react";
import { createRound, findSpace, roundFrame, type Round } from "./minesweeper";
import { drawEffects, type ClickEffect } from "./click-effects";
import { createFinale } from "./finale";
import { Icons } from "./icons";
import { themeFor, type Theme } from "./emojis";
import "./index.css";

const cellSize = 24;
const attractionRadius = 140;

function gridCells(count: number) {
  return {
    emojiIndex: new Uint32Array(count), nextChange: new Float64Array(count),
    offsetX: new Float64Array(count), offsetY: new Float64Array(count),
  };
}

function randomDelay() {
  return 1000 + Math.random() * 4000;
}

export function App() {
  const [theme, setTheme] = useState(() => themeFor(window.location.pathname, new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setTheme(themeFor(window.location.pathname, now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    };
    refresh();
    return () => clearTimeout(timer);
  }, []);

  return <Scene key={theme.slug} theme={theme} />;
}

function Scene({ theme }: { theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef<HTMLCanvasElement>(null);

  const messageRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const emojis = theme.grid;
    const refillIndex = emojis.length;
    const canvas = canvasRef.current!;
    const message = messageRef.current!;
    const context = canvas.getContext("2d");
    if (!context) return;
    const effects = effectsRef.current?.getContext("2d");
    const layers = effects ? [context, effects] : [context];

    let cells = gridCells(0);
    let columns = 1;
    let rows = 1;
    let cellWidth = cellSize;
    let cellHeight = cellSize;
    let grid = { columns, rows, cellWidth, cellHeight };
    let frame: number;
    let clicks = 0;
    let finale: ReturnType<typeof createFinale> | null = null;
    const visibleActors = new Icons();
    let activeEffects: ClickEffect[] = [];

    let lastFrame = performance.now();
    let pointer: { x: number; y: number } | null = null;
    let rounds: Round[] = [];
    let starts: number[] = [];
    const handColumns: number[] = [];
    const handRows: number[] = [];
    const overlays = new Map<number, string>();
    const dirty = new Set<number>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const glyphAt = (index: number) => overlays.get(index) ?? emojis[cells.emojiIndex[index]!] ?? theme.refill;

    const paintCell = (index: number) => {
      const x = (index % columns + 0.5) * cellWidth + cells.offsetX[index]!;
      const y = (Math.floor(index / columns) + 0.5) * cellHeight + cells.offsetY[index]!;
      context.fillText(glyphAt(index), x, y);
    };

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const pixelRatio = window.devicePixelRatio;
      for (const layer of layers) {
        layer.canvas.width = Math.round(width * pixelRatio);
        layer.canvas.height = Math.round(height * pixelRatio);
        layer.setTransform(layer.canvas.width / width, 0, 0, layer.canvas.height / height, 0, 0);
        layer.font = '16px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        layer.textAlign = "center";
        layer.textBaseline = "middle";
      }

      columns = Math.max(1, Math.floor(width / cellSize));
      rows = Math.max(1, Math.floor(height / cellSize));
      cellWidth = width / columns;
      cellHeight = height / rows;
      grid = { columns, rows, cellWidth, cellHeight };
      const previousCount = cells.emojiIndex.length;
      const count = rows * columns;
      if (count !== previousCount) {
        const next = gridCells(count);
        next.emojiIndex.set(cells.emojiIndex.subarray(0, count));
        next.nextChange.set(cells.nextChange.subarray(0, count));
        next.offsetX.set(cells.offsetX.subarray(0, count));
        next.offsetY.set(cells.offsetY.subarray(0, count));
        cells = next;
      }
      visibleActors.clear();
      const now = performance.now();
      overlays.clear();
      const retained: number[] = [];
      const clipped: number[] = [];
      rounds.forEach((round, i) => {
        const fits = round.left + round.columns <= columns && round.top + round.rows <= rows;
        (fits ? retained : clipped).push(i);
      });
      const occupied = retained.map(i => rounds[i]!);
      for (const i of clipped) {
        const round = rounds[i]!;
        const position = findSpace(columns, rows, round, occupied);
        if (position) {
          Object.assign(round, position);
          occupied.push(round);
          retained.push(i);
        }
      }
      rounds = occupied;
      starts = retained.map(i => starts[i]!);
      for (let index = previousCount; index < count; index++) {
        cells.emojiIndex[index] = Math.floor(Math.random() * emojis.length);
        cells.nextChange[index] = now + Math.random() * randomDelay();
      }
      if (!finale) {
        for (let index = 0; index < count; index++) paintCell(index);
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
      if (finale) {
        const phase = finale(grid, now, reducedMotion.matches, (index, showRefillGlyph, changesAt) => {
          cells.emojiIndex[index] = showRefillGlyph ? refillIndex : Math.floor(Math.random() * emojis.length);
          cells.nextChange[index] = showRefillGlyph ? changesAt : now + randomDelay();
          const column = index % columns;
          const row = Math.floor(index / columns);
          context.clearRect(column * cellWidth, row * cellHeight, cellWidth, cellHeight);
          paintCell(index);
        });
        message.hidden = phase !== "message";
        if (phase === "done") {
          finale = null;
          clicks = 0;
        }
        frame = requestAnimationFrame(animate);
        return;
      }
      const target = reducedMotion.matches ? null : pointer;
      let left = columns, right = -1, top = rows, bottom = -1;
      handColumns.length = handRows.length = 0;
      overlays.clear();
      let active = 0;
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i]!;
        const start = starts[i]!;
        const lastColumn = round.left + round.columns - 1;
        const lastRow = round.top + round.rows - 1;
        // Clear the hand and ending glyphs even on the last frame of a round.
        invalidate(round.left - 1, round.top - 1, lastColumn + 1, lastRow + 1);
        const playback = roundFrame(round, now - start, reducedMotion.matches);
        if (!playback) continue;
        for (let row = round.top; row <= lastRow; row++) {
          for (let column = round.left; column <= lastColumn; column++) {
            const glyph = playback.glyphAt(column, row);
            if (glyph) overlays.set(row * columns + column, glyph);
          }
        }
        if (playback.hand) {
          handColumns.push(playback.hand.column);
          handRows.push(playback.hand.row);
        }
        rounds[active] = round;
        starts[active] = start;
        active++;
      }
      rounds.length = starts.length = active;

      for (let index = 0; index < cells.emojiIndex.length; index++) {
        const changed = now >= cells.nextChange[index]!;
        if (changed) {
          const offset = 1 + Math.floor(Math.random() * (emojis.length - 1));
          cells.emojiIndex[index] = (cells.emojiIndex[index]! + offset) % emojis.length;
          cells.nextChange[index] = now + randomDelay();
        }
        const displaced = cells.offsetX[index]! !== 0 || cells.offsetY[index]! !== 0;
        if (!target && !displaced && !changed) continue;

        const column = index % columns;
        const row = Math.floor(index / columns);
        const dx = target ? target.x - (column + 0.5) * cellWidth : 0;
        const dy = target ? target.y - (row + 0.5) * cellHeight : 0;
        const distanceSquared = dx * dx + dy * dy;
        if (displaced || (target && distanceSquared < attractionRadius ** 2)) {
          const pull = Math.max(0, 1 - Math.sqrt(distanceSquared) / attractionRadius) ** 2;
          cells.offsetX[index]! += (dx * pull - cells.offsetX[index]!) * blend;
          cells.offsetY[index]! += (dy * pull - cells.offsetY[index]!) * blend;
          if (Math.abs(cells.offsetX[index]!) < 0.02) cells.offsetX[index] = 0;
          if (Math.abs(cells.offsetY[index]!) < 0.02) cells.offsetY[index] = 0;
          left = Math.min(left, column);
          right = Math.max(right, column);
          top = Math.min(top, row);
          bottom = Math.max(bottom, row);
        } else if (changed) {
          invalidate(column, row, column, row);
        }
      }

      // Include one neighboring cell on each side to clear overhanging glyphs.
      if (right >= left) invalidate(left - 1, top - 1, right + 1, bottom + 1);
      for (const index of dirty) {
        paintCell(index);
      }
      dirty.clear();
      visibleActors.clear();
      for (let i = 0; i < handColumns.length; i++) {
        const column = handColumns[i]!;
        const row = handRows[i]!;
        const index = Math.round(row) * columns + Math.round(column);
        const x = (column + 0.76) * cellWidth + cells.offsetX[index]!;
        const y = (row + 0.89) * cellHeight + cells.offsetY[index]!;
        visibleActors.add(theme.pointer, x, y);
        context.fillText(theme.pointer, x, y);
      }
      if (effects && activeEffects.length) {
        activeEffects = drawEffects(effects, activeEffects, columns * cellWidth, rows * cellHeight,
          now, reducedMotion.matches, visibleActors);
      }
      frame = requestAnimationFrame(animate);
    };

    const follow = (event: PointerEvent) => {
      if (!event.isPrimary || finale) return;
      const bounds = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const release = () => { pointer = null; };
    const lift = (event: PointerEvent) => {
      if (event.isPrimary && event.pointerType !== "mouse") release();
    };
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    const activate = (anchorX: number, anchorY: number) => {
      if (finale || !cells.emojiIndex.length) return;
      if (++clicks === 7) {
        const icons = new Icons();
        for (let i = 0; i < cells.emojiIndex.length; i++) {
          icons.add(glyphAt(i), (i % columns + 0.5) * cellWidth + cells.offsetX[i]!,
            (Math.floor(i / columns) + 0.5) * cellHeight + cells.offsetY[i]!);
        }
        for (let i = 0; i < visibleActors.glyph.length; i++) {
          icons.add(visibleActors.glyph[i]!, visibleActors.x[i]!, visibleActors.y[i]!);
        }
        finale = createFinale(context, icons, grid, anchorX, performance.now());
        activeEffects = [];
        rounds.length = starts.length = 0;
        effects?.clearRect(0, 0, columns * cellWidth, rows * cellHeight);
        visibleActors.clear();
        overlays.clear();
        pointer = null;
        cells.offsetX.fill(0);
        cells.offsetY.fill(0);
        return;
      }
      if (theme.activity.kind === "effect") {
        activeEffects.push(theme.activity.create(anchorX, anchorY, performance.now(), theme.pointer));
        return;
      }
      const column = Math.max(0, Math.min(columns - 1, Math.floor(anchorX * columns)));
      const row = Math.max(0, Math.min(rows - 1, Math.floor(anchorY * rows)));
      const round = createRound(columns, rows, column, row, rounds, theme.activity);
      if (round) {
        rounds.push(round);
        starts.push(performance.now());
      }
    };
    canvas.addEventListener("click", event => {
      const bounds = canvas.getBoundingClientRect();
      activate((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
    }, options);
    canvas.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!event.repeat) activate(0.5, 0.5);
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
      message.hidden = true;
    };
  }, [theme]);

  return (
    <main>
      <canvas ref={canvasRef} role="button" tabIndex={0} aria-label={theme.label} />
      {theme.activity.kind === "effect" && <canvas ref={effectsRef} className="click-effects" aria-hidden="true" />}
      <span ref={messageRef} className="finale-message" role="status" hidden>{theme.finaleMessage}</span>
    </main>
  );
}
