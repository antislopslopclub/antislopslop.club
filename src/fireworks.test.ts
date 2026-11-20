import { expect, mock, test } from "bun:test";
import type { DrawSprite } from "./click-effects";
import { newYearTheme } from "./emojis";

function fireworkAtCenter() {
  return newYearTheme.activity.create(0.5, 0.5, 0, newYearTheme.pointer);
}

test("a New Year firework bursts outward on all sides of the click", () => {
  // Arrange
  const firework = fireworkAtCenter();
  const size = 400;
  const center = size / 2;
  const draw = mock<DrawSprite>(() => {});

  // Act
  firework(size, size, 600, false, draw);

  // Assert
  const quadrants = new Set(
    draw.mock.calls.map(([, x, y]) => [x > center, y > center].join(",")),
  );
  expect(quadrants.size).toBe(4);
});

test("reduced motion shows the burst at the selected position", () => {
  // Arrange
  const firework = newYearTheme.activity.create(
    0.25,
    0.75,
    0,
    newYearTheme.pointer,
  );
  const draw = mock<DrawSprite>(() => {});

  // Act
  firework(400, 200, 100, true, draw);

  // Assert
  expect(draw).toHaveBeenCalledTimes(1);
  expect(draw).toHaveBeenCalledWith("🎆", 100, 150, 3.5, 1);
});

test("spent fireworks stop drawing", () => {
  // Arrange
  const firework = fireworkAtCenter();
  const draw = mock<DrawSprite>(() => {});

  // Act
  firework(400, 300, 2000, false, draw);

  // Assert
  expect(draw).not.toHaveBeenCalled();
});
