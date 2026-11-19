const clues = ["🔹", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];
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
    for (let col = Math.max(0, x - 1); col <= Math.min(columns - 1, x + 1); col++) {
      const neighbor = row * columns + col;
      if (neighbor !== index) result.push(neighbor);
    }
  }
  return result;
}

export function createRound(gridColumns: number, gridRows: number, clickedColumn: number, clickedRow: number) {
  const columns = Math.min(9, gridColumns);
  const rows = Math.min(7, gridRows);
  const left = Math.max(0, Math.min(gridColumns - columns, clickedColumn - Math.floor(columns / 2)));
  const top = Math.max(0, Math.min(gridRows - rows, clickedRow - Math.floor(rows / 2)));
  const first = (clickedRow - top) * columns + clickedColumn - left;
  const squares = Array.from({ length: columns * rows }, (_, index) => ({
    index, neighbors: neighborsOf(index, columns, rows), mine: false, clue: 0,
    openedOn: Infinity, flaggedOn: Infinity,
  }));
  // Keep the opening click and its neighbors clear so the first reveal spreads.
  const candidates = squares.filter(s => s.index !== first && !s.neighbors.includes(first));
  const mineCount = Math.min(Math.ceil(squares.length * 0.15), candidates.length);
  for (let i = 0; i < mineCount; i++) {
    const mine = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]!;
    mine.mine = true;
  }
  for (const s of squares) s.clue = s.neighbors.filter(n => squares[n]!.mine).length;

  const moves: number[] = [];
  const mistakeOn = Math.random() < 0.7 ? 4 + Math.floor(Math.random() * 5) : Infinity;
  let target = first;
  let won = false;
  while (true) {
    const turn = moves.length;
    moves.push(target);
    const square = squares[target]!;
    if (square.mine) {
      if (turn >= mistakeOn) break;
      square.flaggedOn = turn;
    } else {
      const pending = [target];
      while (pending.length) {
        const s = squares[pending.pop()!]!;
        if (s.openedOn !== Infinity) continue;
        s.openedOn = turn;
        if (s.clue === 0) pending.push(...s.neighbors);
      }
    }

    const hidden = squares.filter(s => s.openedOn === Infinity && s.flaggedOn === Infinity);
    const safe = hidden.filter(s => !s.mine);
    if (safe.length === 0) {
      won = true;
      break;
    }
    const frontier = hidden.filter(s => s.neighbors.some(n => squares[n]!.openedOn !== Infinity));
    const mines = frontier.filter(s => s.mine);
    if (moves.length >= mistakeOn) {
      const remainingMines = hidden.filter(s => s.mine);
      if (remainingMines.length) {
        target = pick(mines.length ? mines : remainingMines).index;
        continue;
      }
    }
    // Flag a mine when a revealed clue accounts for all its unopened neighbors.
    const provable = mines.filter(s => s.neighbors.some(n => {
      const adjacent = squares[n]!;
      return adjacent.openedOn !== Infinity &&
        adjacent.clue === adjacent.neighbors.filter(k => squares[k]!.openedOn === Infinity).length;
    }));
    const nextSafe = frontier.filter(s => !s.mine);
    target = pick(provable.length && moves.length % 3 === 1 ? provable : nextSafe.length ? nextSafe : safe).index;
  }
  return { squares, moves, won, columns, rows, left, top };
}

export type Round = ReturnType<typeof createRound>;

export function roundFrame(round: Round, elapsed: number, reducedMotion: boolean) {
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
  const hand = ending < 0 ? {
    column: round.left + col(previous) + (col(target) - col(previous)) * eased,
    row: round.top + row(previous) + (row(target) - row(previous)) * eased,
  } : null;

  function glyphAt(column: number, gridRow: number) {
    const x = column - round.left;
    const y = gridRow - round.top;
    if (x < 0 || y < 0 || x >= round.columns || y >= round.rows) return;
    const square = round.squares[y * round.columns + x]!;
    if (ending >= 0) {
      const distance = Math.hypot(x - col(target), y - row(target));
      const wave = ending - (reducedMotion ? 0 : distance * 85);
      if (wave >= 0) {
        if (square.index === target) return round.won ? "🏆" : "💥";
        if (!reducedMotion && wave < 300) return round.won ? "🎉" : "💥";
        if (square.mine) return round.won ? "🚩" : "💣";
      }
    }
    if (square.flaggedOn <= played) return "🚩";
    if (square.openedOn <= played) return clues[square.clue];
    // An unopened square keeps its live grid emoji.
  }
  return { hand, glyphAt };
}
