import { expect, test } from "bun:test";
import {
  christmasTheme,
  newYearTheme,
  spookyTheme,
  standardTheme,
  themeFor,
} from "./emojis";

const cases = [
  {
    name: "uses the standard theme on November 11",
    path: "/",
    date: new Date(2026, 10, 11),
    expected: standardTheme,
  },
  {
    name: "uses the standard theme on New Year's Eve",
    path: "/",
    date: new Date(2026, 11, 31, 23, 59),
    expected: standardTheme,
  },
  {
    name: "starts New Year at local midnight on January 1",
    path: "/",
    date: new Date(2027, 0, 1),
    expected: newYearTheme,
  },
  {
    name: "ends New Year on January 2",
    path: "/",
    date: new Date(2027, 0, 2),
    expected: standardTheme,
  },
  {
    name: "previews New Year off-season",
    path: "/new-year",
    date: new Date(2027, 10, 11),
    expected: newYearTheme,
  },
  {
    name: "uses the standard theme before Halloween",
    path: "/",
    date: new Date(2026, 9, 30, 23, 59),
    expected: standardTheme,
  },
  {
    name: "starts Halloween at local midnight on October 31",
    path: "/",
    date: new Date(2026, 9, 31),
    expected: spookyTheme,
  },
  {
    name: "keeps Halloween through the end of October 31 every year",
    path: "/",
    date: new Date(2027, 9, 31, 23, 59),
    expected: spookyTheme,
  },
  {
    name: "restores the standard theme on November 1",
    path: "/",
    date: new Date(2026, 10, 1),
    expected: standardTheme,
  },
  {
    name: "previews Halloween during Christmas",
    path: "/spooky",
    date: new Date(2026, 11, 24),
    expected: spookyTheme,
  },
  {
    name: "serves the Halloween static index off-season",
    path: "/spooky/index.html",
    date: new Date(2026, 6, 1),
    expected: spookyTheme,
  },
  {
    name: "previews Christmas on Halloween",
    path: "/xmas/",
    date: new Date(2026, 9, 31),
    expected: christmasTheme,
  },
  {
    name: "uses the standard grid just before Advent",
    path: "/",
    date: new Date(2026, 10, 30, 23, 59),
    expected: standardTheme,
  },
  {
    name: "starts Christmas at local midnight on December 1",
    path: "/",
    date: new Date(2026, 11, 1),
    expected: christmasTheme,
  },
  {
    name: "keeps Christmas through the end of December 24 every year",
    path: "/",
    date: new Date(2027, 11, 24, 23, 59),
    expected: christmasTheme,
  },
  {
    name: "restores the standard grid on December 25",
    path: "/",
    date: new Date(2026, 11, 25),
    expected: standardTheme,
  },
  {
    name: "previews Christmas off-season at /xmas",
    path: "/xmas",
    date: new Date(2026, 6, 1),
    expected: christmasTheme,
  },
  {
    name: "previews Christmas at the static directory URL",
    path: "/xmas/",
    date: new Date(2026, 6, 1),
    expected: christmasTheme,
  },
];

for (const example of cases) {
  test(example.name, () => {
    // Arrange
    const { path, date, expected } = example;

    // Act
    const theme = themeFor(path, date);

    // Assert
    expect(theme).toBe(expected);
  });
}
