import { expect, test } from "bun:test";
import { createRound, findSpace } from "./minesweeper";

const firstBoard = { columns: 9, rows: 7, left: 0, top: 0 };

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
