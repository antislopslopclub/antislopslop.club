import { expect, test } from "bun:test";
import { christmasTheme, spookyTheme, standardTheme } from "./emojis";
import { createRound, findSpace, roundFrame } from "./minesweeper";

const firstBoard = { columns: 9, rows: 7, left: 0, top: 0 };

test("Minesweeper reveals the opening square on the first frame", () => {
  // Arrange
  const round = createRound(9, 7, 4, 3)!;

  // Act
  const frame = roundFrame(round, 0, false)!;

  // Assert
  expect(frame.glyphAt(4, 3)).toBe(standardTheme.activity.clues[0]);
});

test("clicking an occupied cell spawns another round in the nearest free space", () => {
  // Arrange
  const grid = { columns: 26, rows: 7 };

  // Act
  const round = createRound(grid.columns, grid.rows, 4, 3, [firstBoard]);

  // Assert
  expect(round).toMatchObject({ left: 10, top: 0, columns: 9, rows: 7 });
});

test("a full grid refuses another round", () => {
  // Arrange
  const occupied = [firstBoard, { ...firstBoard, left: 10 }];

  // Act
  const round = createRound(19, 7, 9, 3, occupied);

  // Assert
  expect(round).toBeNull();
});

test("a board clipped by a resize can relocate beside a surviving round", () => {
  // Arrange
  const clipped = { ...firstBoard, left: 20 };

  // Act
  const position = findSpace(9, 15, clipped, [firstBoard]);

  // Assert
  expect(position).toEqual({ left: 0, top: 8 });
});

const firstHome = { column: 0, row: 0 };
const secondHome = { column: 2, row: 0 };

function twoHomeRoute() {
  return createRound(3, 1, firstHome.column, firstHome.row, [], "delivery")!;
}

for (const theme of [christmasTheme, spookyTheme]) {
  test(`the ${theme.slug} pointer moves diagonally across an open clearing`, () => {
    // Arrange
    const round = createRound(2, 2, 0, 0, [], theme.activity)!;
    const halfwayToOppositeCorner = 460 + (460 * 0.74) / 2;

    // Act
    const hand = roundFrame(round, halfwayToOppositeCorner, false)!.hand!;

    // Assert
    expect(hand.column).toBeCloseTo(0.5);
    expect(hand.row).toBeCloseTo(0.5);
  });
}

test("snow marks the play area between houses as soon as a delivery starts", () => {
  // Arrange
  const round = twoHomeRoute();
  const betweenHomes = { column: 1, row: 0 };

  // Act
  const frame = roundFrame(round, 0, false)!;

  // Assert
  expect(frame.glyphAt(betweenHomes.column, betweenHomes.row)).toBe("❄️");
});

test("Santa leaves a gift only at the house he has reached", () => {
  // Arrange
  const round = twoHomeRoute();
  const afterFirstDelivery = 400;

  // Act
  const frame = roundFrame(round, afterFirstDelivery, false)!;

  // Assert
  expect(frame.glyphAt(firstHome.column, firstHome.row)).toBe("🎁");
  expect(frame.glyphAt(secondHome.column, secondHome.row)).toBe("🏠");
});

test("Santa travels between the two houses", () => {
  // Arrange
  const round = twoHomeRoute();
  const betweenHouses = 600;

  // Act
  const frame = roundFrame(round, betweenHouses, false)!;

  // Assert
  expect(frame.hand!.column).toBeGreaterThan(firstHome.column);
  expect(frame.hand!.column).toBeLessThan(secondHome.column);
});

test("the last house receives its gift at the end of the route", () => {
  // Arrange
  const round = twoHomeRoute();
  const afterFinalDelivery = 850;

  // Act
  const frame = roundFrame(round, afterFinalDelivery, false)!;

  // Assert
  expect(frame.glyphAt(secondHome.column, secondHome.row)).toBe("🎁");
});

test("unrevealed cells keep their background throughout a delivery round", () => {
  // Arrange
  const round = createRound(9, 7, 4, 3, [], "delivery")!;
  const afterLastDelivery = round.moves.length * 460;

  // Act
  const frame = roundFrame(round, afterLastDelivery, false)!;

  // Assert
  const hidden = round.squares.openedOn.reduce<number[]>(
    (indices, turn, index) => {
      if (turn === Infinity) indices.push(index);
      return indices;
    },
    [],
  );
  expect(hidden.length).toBeGreaterThan(0);
  for (const index of hidden) {
    expect(
      frame.glyphAt(index % round.columns, Math.floor(index / round.columns)),
    ).toBeUndefined();
  }
});

test("every delivery stop is in the clearing before Santa starts", () => {
  // Arrange
  const grid = { columns: 9, rows: 7 };

  // Act
  const round = createRound(grid.columns, grid.rows, 4, 3, [], "delivery")!;

  // Assert
  expect(round.moves.every((home) => round.squares.openedOn[home] === 0)).toBe(
    true,
  );
});

for (const theme of [christmasTheme, spookyTheme]) {
  test(`the ${theme.slug} pointer matches the homepage throughout an oblique glide`, () => {
    // Arrange
    const moves = [0, 5]; // Across two columns and down one row.
    const main = { ...createRound(3, 2, 0, 0)!, moves };
    const seasonal = { ...createRound(3, 2, 0, 0, [], theme.activity)!, moves };
    const times = [480, 550, 630, 720, 790];

    // Act
    const positions = times.map(
      (time) => roundFrame(seasonal, time, false)!.hand,
    );

    // Assert
    expect(positions).toEqual(
      times.map((time) => roundFrame(main, time, false)!.hand),
    );
  });
}

test("simultaneous delivery rounds each draw their own theme", () => {
  // Arrange
  const santa = createRound(3, 1, 0, 0, [], christmasTheme.activity)!;
  const ghost = createRound(3, 1, 0, 0, [], spookyTheme.activity)!;
  const afterFirstStop = 400;

  // Act
  const frames = [ghost, santa].map((round) =>
    roundFrame(round, afterFirstStop, false)!,
  );

  // Assert
  const street = frames.map((frame) =>
    [0, 1, 2].map((column) => frame.glyphAt(column, 0)),
  );
  expect(street).toEqual([
    ["🍬", "🕸️", "🎃"],
    ["🎁", "❄️", "🏠"],
  ]);
});
