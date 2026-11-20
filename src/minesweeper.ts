import { defaultActivitySkins, type BoardSkin } from "./emojis";

const turnMs = 460;
const tapPhase = 0.74;
const endingMs = 2100;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function neighborsOf(index: number, columns: number, rows: number) {
  const x = index % columns;
  const y = Math.floor(index / columns);
  const result: number[] = [];
  for (let row = Math.max(0, y - 1); row <= Math.min(rows - 1, y + 1); row++) {
    for (
      let col = Math.max(0, x - 1);
      col <= Math.min(columns - 1, x + 1);
      col++
    ) {
      const neighbor = row * columns + col;
      if (neighbor !== index) result.push(neighbor);
    }
  }
  return result;
}

type Bounds = { left: number; top: number; columns: number; rows: number };

export function findSpace(
  gridColumns: number,
  gridRows: number,
  board: Bounds,
  occupied: Bounds[],
) {
  const maxLeft = gridColumns - board.columns;
  const maxTop = gridRows - board.rows;
  if (maxLeft < 0 || maxTop < 0) return null;
  const preferredLeft = Math.max(0, Math.min(maxLeft, board.left));
  const preferredTop = Math.max(0, Math.min(maxTop, board.top));
  // Leave a cell between boards for the moving hands and displaced glyphs.
  const fits = (left: number, top: number) =>
    occupied.every(
      (other) =>
        left > other.left + other.columns ||
        left + board.columns < other.left ||
        top > other.top + other.rows ||
        top + board.rows < other.top,
    );
  if (fits(preferredLeft, preferredTop))
    return { left: preferredLeft, top: preferredTop };

  let best: { left: number; top: number } | null = null;
  let bestDistance = Infinity;
  for (let top = 0; top <= maxTop; top++) {
    for (let left = 0; left <= maxLeft; left++) {
      const distance = (left - preferredLeft) ** 2 + (top - preferredTop) ** 2;
      if (distance < bestDistance && fits(left, top)) {
        best = { left, top };
        bestDistance = distance;
      }
    }
  }
  return best;
}

function deliveryRoute(openedOn: Float64Array, columns: number, first: number) {
  const moves = [first];
  const clearing: number[] = [];
  openedOn.forEach((turn, index) => {
    if (turn === 0) clearing.push(index);
  });
  const col = (i: number) => i % columns;
  const row = (i: number) => Math.floor(i / columns);

  function canGlide(from: number, to: number) {
    // Keep the entire rectangle between stops open, including room for the pointer glyph.
    for (
      let y = Math.min(row(from), row(to));
      y <= Math.max(row(from), row(to));
      y++
    ) {
      for (
        let x = Math.min(col(from), col(to));
        x <= Math.max(col(from), col(to));
        x++
      ) {
        if (openedOn[y * columns + x] !== 0) return false;
      }
    }
    return true;
  }

  while (moves.length < 6) {
    const from = moves[moves.length - 1]!;
    const reachable = clearing.filter(
      (cell) => !moves.includes(cell) && canGlide(from, cell),
    );
    const spaced = reachable.filter((cell) =>
      moves.every(
        (stop) =>
          Math.abs(col(cell) - col(stop)) + Math.abs(row(cell) - row(stop)) >=
          2,
      ),
    );
    // For the first leg, accept a nearby stop if none are spaced apart.
    const candidates =
      moves.length === 1 && spaced.length === 0 ? reachable : spaced;
    if (!candidates.length) break;
    moves.push(pick(candidates));
  }
  return moves;
}

function createSquares(columns: number, rows: number) {
  const count = columns * rows;
  return {
    neighbors: Array.from({ length: count }, (_, index) =>
      neighborsOf(index, columns, rows),
    ),
    mine: new Uint8Array(count),
    clue: new Uint8Array(count),
    openedOn: new Float64Array(count).fill(Infinity),
    flaggedOn: new Float64Array(count).fill(Infinity),
  };
}

function reveal(
  squares: ReturnType<typeof createSquares>,
  target: number,
  turn: number,
) {
  const pending = [target];
  while (pending.length) {
    const index = pending.pop()!;
    if (squares.openedOn[index] !== Infinity) continue;
    squares.openedOn[index] = turn;
    if (squares.clue[index] === 0) pending.push(...squares.neighbors[index]!);
  }
}

function playMinesweeper(
  squares: ReturnType<typeof createSquares>,
  indices: number[],
  first: number,
) {
  const { neighbors, mine, clue, openedOn, flaggedOn } = squares;
  const moves: number[] = [];
  const mistakeOn =
    Math.random() < 0.7 ? 4 + Math.floor(Math.random() * 5) : Infinity;
  let target = first;
  while (true) {
    const turn = moves.length;
    moves.push(target);
    if (mine[target]) {
      if (turn >= mistakeOn) return { moves, won: false };
      flaggedOn[target] = turn;
    } else {
      reveal(squares, target, turn);
    }

    const hidden = indices.filter(
      (i) => openedOn[i] === Infinity && flaggedOn[i] === Infinity,
    );
    const safe = hidden.filter((i) => !mine[i]);
    if (safe.length === 0) return { moves, won: true };
    const frontier = hidden.filter((i) =>
      neighbors[i]!.some((n) => openedOn[n] !== Infinity),
    );
    const mines = frontier.filter((i) => mine[i]);
    if (moves.length >= mistakeOn) {
      const remainingMines = hidden.filter((i) => mine[i]);
      if (remainingMines.length) {
        target = pick(mines.length ? mines : remainingMines);
        continue;
      }
    }
    // Flag a mine when a revealed clue accounts for all its unopened neighbors.
    if (moves.length % 3 === 1) {
      const provable = mines.filter((index) =>
        neighbors[index]!.some((adjacent) => {
          if (openedOn[adjacent] === Infinity) return false;
          const unopened = neighbors[adjacent]!.filter(
            (cell) => openedOn[cell] === Infinity,
          );
          return clue[adjacent] === unopened.length;
        }),
      );
      if (provable.length) {
        target = pick(provable);
        continue;
      }
    }
    const safeFrontier = frontier.filter((index) => !mine[index]);
    target = pick(safeFrontier.length ? safeFrontier : safe);
  }
}

export function createRound(
  gridColumns: number,
  gridRows: number,
  clickedColumn: number,
  clickedRow: number,
  occupied: Bounds[] = [],
  activity: BoardSkin | BoardSkin["kind"] = "minesweeper",
) {
  const skin =
    typeof activity === "string" ? defaultActivitySkins[activity] : activity;
  const columns = Math.min(9, gridColumns);
  const rows = Math.min(7, gridRows);
  const origin = findSpace(
    gridColumns,
    gridRows,
    {
      left: clickedColumn - Math.floor(columns / 2),
      top: clickedRow - Math.floor(rows / 2),
      columns,
      rows,
    },
    occupied,
  );
  if (!origin) return null;
  const { left, top } = origin;
  const firstColumn = Math.max(0, Math.min(columns - 1, clickedColumn - left));
  const firstRow = Math.max(0, Math.min(rows - 1, clickedRow - top));
  const first = firstRow * columns + firstColumn;
  const squares = createSquares(columns, rows);
  const { neighbors, mine, clue, openedOn } = squares;
  const indices = neighbors.map((_, index) => index);
  // Keep the opening click and its neighbors clear so the first reveal spreads.
  const candidates = indices.filter(
    (i) => i !== first && !neighbors[i]!.includes(first),
  );
  const expectedMines = indices.length * 0.15;
  const desiredMines =
    skin.kind === "delivery"
      ? Math.floor(expectedMines)
      : Math.ceil(expectedMines);
  const mineCount = Math.min(desiredMines, candidates.length);
  for (let i = 0; i < mineCount; i++) {
    const index = candidates.splice(
      Math.floor(Math.random() * candidates.length),
      1,
    )[0]!;
    mine[index] = 1;
  }
  for (const i of indices)
    clue[i] = neighbors[i]!.filter((n) => mine[n]).length;

  if (skin.kind === "delivery") {
    reveal(squares, first, 0);
    const moves = deliveryRoute(openedOn, columns, first);
    moves.forEach((home, turn) => {
      for (const index of neighbors[home]!) {
        if (!mine[index]) reveal(squares, index, turn);
      }
    });
    return {
      activity: skin.kind,
      skin,
      columns,
      rows,
      left,
      top,
      squares,
      moves,
    };
  }

  const { moves, won } = playMinesweeper(squares, indices, first);
  return {
    activity: skin.kind,
    skin,
    squares,
    moves,
    won,
    columns,
    rows,
    left,
    top,
  };
}

export type Round = NonNullable<ReturnType<typeof createRound>>;

export function roundFrame(
  round: Round,
  elapsed: number,
  reducedMotion: boolean,
) {
  const time = Math.max(0, elapsed) / turnMs;
  const last = round.moves.length - 1;
  const ending = (time - last - tapPhase) * turnMs;
  if (ending >= endingMs) return null;

  const turn = Math.min(last, Math.floor(time));
  const played = Math.floor(time - tapPhase);
  const target = round.moves[turn]!;
  const previous = round.moves[Math.max(0, turn - 1)]!;
  const col = (i: number) => i % round.columns;
  const row = (i: number) => Math.floor(i / round.columns);
  const progress = reducedMotion ? 1 : Math.min(1, (time - turn) / tapPhase);
  const eased = progress * progress * (3 - 2 * progress);
  let hand = null;
  if (ending < 0) {
    const fromColumn = col(previous);
    const fromRow = row(previous);
    hand = {
      column: round.left + fromColumn + (col(target) - fromColumn) * eased,
      row: round.top + fromRow + (row(target) - fromRow) * eased,
    };
  }

  function glyphAt(column: number, gridRow: number) {
    const x = column - round.left;
    const y = gridRow - round.top;
    if (x < 0 || y < 0 || x >= round.columns || y >= round.rows) return;
    const index = y * round.columns + x;
    const { openedOn, flaggedOn, mine, clue } = round.squares;
    if (round.activity === "delivery") {
      const visit = round.moves.indexOf(index);
      if (visit >= 0)
        return visit <= played ? round.skin.delivered : round.skin.stop;
      if (openedOn[index]! <= Math.max(0, played)) return round.skin.ground;
      return;
    }
    if (ending >= 0) {
      const distance = Math.hypot(x - col(target), y - row(target));
      const wave = ending - (reducedMotion ? 0 : distance * 85);
      if (wave >= 0) {
        if (index === target)
          return round.won ? round.skin.win : round.skin.loss;
        if (!reducedMotion && wave < 300)
          return round.won ? round.skin.celebration : round.skin.loss;
        if (mine[index]) return round.won ? round.skin.flag : round.skin.mine;
      }
    }
    if (flaggedOn[index]! <= played) return round.skin.flag;
    if (openedOn[index]! <= Math.max(0, played))
      return round.skin.clues[clue[index]!];
    // An unopened square keeps its live grid emoji.
  }
  return { hand, glyphAt };
}
