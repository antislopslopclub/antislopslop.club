import { useEffect, useRef, useState } from "react";
import { createRound, findSpace, roundFrame, type Round } from "./minesweeper";
import { drawEffects, type ClickEffect } from "./click-effects";
import { createFinale } from "./finale";
import { Icons } from "./icons";
import { themeFor, type Theme } from "./emojis";
import "./index.css";

const cellSize = 24;
const attractionRadius = 140;

type ActiveRound = Round & { startedAt: number };

function fitRoundsToGrid(rounds: ActiveRound[], columns: number, rows: number) {
  const retained: ActiveRound[] = [];
  const clipped: ActiveRound[] = [];
  for (const round of rounds) {
    if (
      round.left + round.columns <= columns &&
      round.top + round.rows <= rows
    ) {
      retained.push(round);
    } else {
      clipped.push(round);
    }
  }

  for (const round of clipped) {
    const position = findSpace(columns, rows, round, retained);
    if (position) {
      Object.assign(round, position);
      retained.push(round);
    }
  }
  return retained;
}

function gridCells(count: number) {
  return {
    emojiIndex: new Uint32Array(count),
    nextChange: new Float64Array(count),
    offsetX: new Float64Array(count),
    offsetY: new Float64Array(count),
  };
}

function randomDelay() {
  return 1000 + Math.random() * 4000;
}

export function App() {
  const [theme, setTheme] = useState(() =>
    themeFor(window.location.pathname, new Date()),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setTheme(themeFor(window.location.pathname, now));
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
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
    let grid = {
      columns: 1,
      rows: 1,
      cellWidth: cellSize,
      cellHeight: cellSize,
    };
    let frame: number;
    let clicks = 0;
    let finale: ReturnType<typeof createFinale> | null = null;
    const visibleActors = new Icons();
    let activeEffects: ClickEffect[] = [];

    let lastFrame = performance.now();
    let pointer: { x: number; y: number } | null = null;
    let rounds: ActiveRound[] = [];
    const hands: { column: number; row: number }[] = [];
    const overlays = new Map<number, string>();
    const dirty = new Set<number>();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const glyphAt = (index: number) =>
      overlays.get(index) ?? emojis[cells.emojiIndex[index]!] ?? theme.refill;

    const cellX = (index: number) =>
      ((index % grid.columns) + 0.5) * grid.cellWidth + cells.offsetX[index]!;
    const cellY = (index: number) =>
      (Math.floor(index / grid.columns) + 0.5) * grid.cellHeight +
      cells.offsetY[index]!;

    const paintCell = (index: number) => {
      context.fillText(glyphAt(index), cellX(index), cellY(index));
    };

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const pixelRatio = window.devicePixelRatio;
      for (const layer of layers) {
        layer.canvas.width = Math.round(width * pixelRatio);
        layer.canvas.height = Math.round(height * pixelRatio);
        layer.setTransform(
          layer.canvas.width / width,
          0,
          0,
          layer.canvas.height / height,
          0,
          0,
        );
        layer.font =
          '16px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        layer.textAlign = "center";
        layer.textBaseline = "middle";
      }

      const columns = Math.max(1, Math.floor(width / cellSize));
      const rows = Math.max(1, Math.floor(height / cellSize));
      grid = {
        columns,
        rows,
        cellWidth: width / columns,
        cellHeight: height / rows,
      };
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
      rounds = fitRoundsToGrid(rounds, columns, rows);
      for (let index = previousCount; index < count; index++) {
        cells.emojiIndex[index] = Math.floor(Math.random() * emojis.length);
        cells.nextChange[index] = now + Math.random() * randomDelay();
      }
      if (!finale) {
        for (let index = 0; index < count; index++) paintCell(index);
      }
    };

    const invalidate = (
      left: number,
      top: number,
      right: number,
      bottom: number,
    ) => {
      const { columns, rows, cellWidth, cellHeight } = grid;
      left = Math.max(0, left);
      top = Math.max(0, top);
      right = Math.min(columns - 1, right);
      bottom = Math.min(rows - 1, bottom);
      context.clearRect(
        left * cellWidth,
        top * cellHeight,
        (right - left + 1) * cellWidth,
        (bottom - top + 1) * cellHeight,
      );
      for (let row = top; row <= bottom; row++) {
        for (let column = left; column <= right; column++)
          dirty.add(row * columns + column);
      }
    };

    const overlayRound = (
      round: Round,
      glyphAt: (column: number, row: number) => string | undefined,
    ) => {
      for (let row = round.top; row < round.top + round.rows; row++) {
        for (
          let column = round.left;
          column < round.left + round.columns;
          column++
        ) {
          const glyph = glyphAt(column, row);
          if (glyph) overlays.set(row * grid.columns + column, glyph);
        }
      }
    };

    const updateRounds = (now: number) => {
      hands.length = 0;
      overlays.clear();
      let activeCount = 0;
      for (const round of rounds) {
        const lastColumn = round.left + round.columns - 1;
        const lastRow = round.top + round.rows - 1;
        // Clear the hand and ending glyphs even on the last frame of a round.
        invalidate(round.left - 1, round.top - 1, lastColumn + 1, lastRow + 1);
        const playback = roundFrame(
          round,
          now - round.startedAt,
          reducedMotion.matches,
        );
        if (!playback) continue;
        overlayRound(round, playback.glyphAt);
        if (playback.hand) hands.push(playback.hand);
        rounds[activeCount++] = round;
      }
      rounds.length = activeCount;
    };

    const advanceEmoji = (index: number, now: number) => {
      if (now < cells.nextChange[index]!) return false;
      const offset = 1 + Math.floor(Math.random() * (emojis.length - 1));
      cells.emojiIndex[index] =
        (cells.emojiIndex[index]! + offset) % emojis.length;
      cells.nextChange[index] = now + randomDelay();
      return true;
    };

    const updateCells = (now: number, blend: number) => {
      const { columns, rows, cellWidth, cellHeight } = grid;
      const target = reducedMotion.matches ? null : pointer;
      let left = columns,
        right = -1,
        top = rows,
        bottom = -1;
      for (let index = 0; index < cells.emojiIndex.length; index++) {
        const changed = advanceEmoji(index, now);
        const displaced =
          cells.offsetX[index]! !== 0 || cells.offsetY[index]! !== 0;
        if (!target && !displaced && !changed) continue;

        const column = index % columns;
        const row = Math.floor(index / columns);
        const dx = target ? target.x - (column + 0.5) * cellWidth : 0;
        const dy = target ? target.y - (row + 0.5) * cellHeight : 0;
        const distanceSquared = dx * dx + dy * dy;
        if (
          !displaced &&
          (!target || distanceSquared >= attractionRadius ** 2)
        ) {
          if (changed) invalidate(column, row, column, row);
          continue;
        }
        const pull =
          Math.max(0, 1 - Math.sqrt(distanceSquared) / attractionRadius) ** 2;
        cells.offsetX[index]! += (dx * pull - cells.offsetX[index]!) * blend;
        cells.offsetY[index]! += (dy * pull - cells.offsetY[index]!) * blend;
        if (Math.abs(cells.offsetX[index]!) < 0.02) cells.offsetX[index] = 0;
        if (Math.abs(cells.offsetY[index]!) < 0.02) cells.offsetY[index] = 0;
        left = Math.min(left, column);
        right = Math.max(right, column);
        top = Math.min(top, row);
        bottom = Math.max(bottom, row);
      }

      // Include one neighboring cell on each side to clear overhanging glyphs.
      if (right >= left) invalidate(left - 1, top - 1, right + 1, bottom + 1);
      for (const index of dirty) {
        paintCell(index);
      }
      dirty.clear();
    };

    const drawActors = (now: number) => {
      const { columns, rows, cellWidth, cellHeight } = grid;
      visibleActors.clear();
      for (const { column, row } of hands) {
        const index = Math.round(row) * columns + Math.round(column);
        const x = (column + 0.76) * cellWidth + cells.offsetX[index]!;
        const y = (row + 0.89) * cellHeight + cells.offsetY[index]!;
        visibleActors.add(theme.pointer, x, y);
        context.fillText(theme.pointer, x, y);
      }
      if (effects && activeEffects.length) {
        activeEffects = drawEffects(
          effects,
          activeEffects,
          columns * cellWidth,
          rows * cellHeight,
          now,
          reducedMotion.matches,
          visibleActors,
        );
      }
    };

    const animate = (now: number) => {
      const blend = 1 - Math.exp(-Math.max(0, now - lastFrame) / 95);
      lastFrame = now;
      if (finale) {
        const phase = finale(
          grid,
          now,
          reducedMotion.matches,
          (index, showRefillGlyph, changesAt) => {
            const { columns, cellWidth, cellHeight } = grid;
            cells.emojiIndex[index] = showRefillGlyph
              ? refillIndex
              : Math.floor(Math.random() * emojis.length);
            cells.nextChange[index] = showRefillGlyph
              ? changesAt
              : now + randomDelay();
            const column = index % columns;
            const row = Math.floor(index / columns);
            context.clearRect(
              column * cellWidth,
              row * cellHeight,
              cellWidth,
              cellHeight,
            );
            paintCell(index);
          },
        );
        message.hidden = phase !== "message";
        if (phase === "done") {
          finale = null;
          clicks = 0;
        }
      } else {
        updateRounds(now);
        updateCells(now, blend);
        drawActors(now);
      }
      frame = requestAnimationFrame(animate);
    };

    const follow = (event: PointerEvent) => {
      if (!event.isPrimary || finale) return;
      const bounds = canvas.getBoundingClientRect();
      pointer = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
    };
    const release = () => {
      pointer = null;
    };
    const lift = (event: PointerEvent) => {
      if (event.isPrimary && event.pointerType !== "mouse") release();
    };

    const startFinale = (anchorX: number) => {
      const { columns, rows, cellWidth, cellHeight } = grid;
      const icons = new Icons();
      for (let i = 0; i < cells.emojiIndex.length; i++) {
        icons.add(glyphAt(i), cellX(i), cellY(i));
      }
      for (let i = 0; i < visibleActors.glyph.length; i++) {
        icons.add(
          visibleActors.glyph[i]!,
          visibleActors.x[i]!,
          visibleActors.y[i]!,
        );
      }
      finale = createFinale(context, icons, grid, anchorX, performance.now());
      activeEffects = [];
      rounds.length = 0;
      effects?.clearRect(0, 0, columns * cellWidth, rows * cellHeight);
      visibleActors.clear();
      overlays.clear();
      pointer = null;
      cells.offsetX.fill(0);
      cells.offsetY.fill(0);
    };

    const activate = (anchorX: number, anchorY: number) => {
      if (finale || !cells.emojiIndex.length) return;
      if (++clicks === 7) {
        startFinale(anchorX);
        return;
      }
      if (theme.activity.kind === "effect") {
        activeEffects.push(
          theme.activity.create(
            anchorX,
            anchorY,
            performance.now(),
            theme.pointer,
          ),
        );
        return;
      }
      const { columns, rows } = grid;
      const column = Math.max(
        0,
        Math.min(columns - 1, Math.floor(anchorX * columns)),
      );
      const row = Math.max(0, Math.min(rows - 1, Math.floor(anchorY * rows)));
      const round = createRound(
        columns,
        rows,
        column,
        row,
        rounds,
        theme.activity,
      );
      if (round) {
        rounds.push({ ...round, startedAt: performance.now() });
      }
    };

    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    canvas.addEventListener(
      "click",
      (event) => {
        const bounds = canvas.getBoundingClientRect();
        activate(
          (event.clientX - bounds.left) / bounds.width,
          (event.clientY - bounds.top) / bounds.height,
        );
      },
      options,
    );
    canvas.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!event.repeat) activate(0.5, 0.5);
        }
      },
      options,
    );
    canvas.addEventListener("pointermove", follow, options);
    canvas.addEventListener("pointerdown", follow, options);
    canvas.addEventListener("pointerleave", release, options);
    canvas.addEventListener("pointercancel", release, options);
    canvas.addEventListener("pointerup", lift, options);
    window.addEventListener("blur", release, options);

    frame = requestAnimationFrame(animate);
    const observer = new ResizeObserver(resize);
    const box =
      "devicePixelContentBoxSize" in ResizeObserverEntry.prototype
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
      <canvas
        ref={canvasRef}
        role="button"
        tabIndex={0}
        aria-label={theme.label}
      />
      {theme.activity.kind === "effect" && (
        <canvas ref={effectsRef} className="click-effects" aria-hidden="true" />
      )}
      <span ref={messageRef} className="finale-message" role="status" hidden>
        {theme.finaleMessage}
      </span>
    </main>
  );
}
