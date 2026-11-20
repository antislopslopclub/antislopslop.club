import { fireworks } from "./fireworks";
import type { EffectActivity } from "./click-effects";

type DeliverySkin = {
  readonly kind: "delivery";
  readonly ground: string;
  readonly stop: string;
  readonly delivered: string;
};

type MinesweeperSkin = {
  readonly kind: "minesweeper";
  readonly clues: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  readonly flag: string;
  readonly mine: string;
  readonly win: string;
  readonly loss: string;
  readonly celebration: string;
};

export type BoardSkin = DeliverySkin | MinesweeperSkin;

export type ActivitySkin = BoardSkin | EffectActivity;

export type Theme = {
  readonly slug: string;
  readonly activity: ActivitySkin;
  readonly label: string;
  readonly pointer: string;
  readonly grid: readonly [string, string, ...string[]];
  readonly refill: string;
  readonly finaleMessage: string;
};

export const standardTheme = {
  slug: "",
  activity: {
    kind: "minesweeper",
    clues: ["🔹", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"],
    flag: "🚩",
    mine: "💣",
    win: "🏆",
    loss: "💥",
    celebration: "🎉",
  },
  label: "click",
  pointer: "👆",
  grid: [
    "🚀",
    "✨",
    "🔥",
    "🎯",
    "🤖",
    "⚡",
    "📦",
    "🧠",
    "🎉",
    "🛠️",
    "💡",
    "🐛",
    "🔍",
    "⚙️",
    "📚",
    "✅",
    "🌟",
    "🧪",
    "🎨",
    "🚧",
    "🔮",
    "📈",
    "💎",
    "💻",
  ],
  refill: "😉",
  finaleMessage: "See you soon!",
} as const satisfies Theme;

export const christmasTheme = {
  slug: "xmas",
  activity: { kind: "delivery", ground: "❄️", stop: "🏠", delivered: "🎁" },
  label: "click",
  pointer: "🎅",
  grid: [
    "🎄",
    "🎅",
    "🤶",
    "🧑‍🎄",
    "🧝",
    "🦌",
    "🛷",
    "🎁",
    "🔔",
    "🌟",
    "❄️",
    "☃️",
    "⛄",
    "🕯️",
    "🍪",
    "🥛",
  ],
  refill: "🎄",
  finaleMessage: "Merry Xmas of 2026",
} as const satisfies Theme;

export const spookyTheme = {
  slug: "spooky",
  activity: { kind: "delivery", ground: "🕸️", stop: "🎃", delivered: "🍬" },
  label: "click",
  pointer: "👻",
  grid: [
    "🎃",
    "👻",
    "🦇",
    "🕸️",
    "🕷️",
    "💀",
    "🧙",
    "🧛",
    "🧟",
    "🐈‍⬛",
    "🪦",
    "🕯️",
    "🌕",
    "🍬",
  ],
  refill: "🎃",
  finaleMessage: "Happy Halloween!",
} as const satisfies Theme;

export const newYearTheme = {
  slug: "new-year",
  activity: fireworks("🎆", ["✨", "🌟", "🎊", "💫"]),
  label: "click",
  pointer: "🎇",
  grid: ["🎆", "🎇", "🕛", "🥳", "🎉", "🎊", "🪩", "🥂", "🍾", "✨", "🎈"],
  refill: "🎆",
  finaleMessage: "Happy New Year!",
} as const satisfies Theme;

export const defaultActivitySkins = {
  minesweeper: standardTheme.activity,
  delivery: christmasTheme.activity,
} as const;

export const seasons = [
  { theme: newYearTheme, month: 1, firstDay: 1, lastDay: 1 },
  { theme: spookyTheme, month: 10, firstDay: 31, lastDay: 31 },
  { theme: christmasTheme, month: 12, firstDay: 1, lastDay: 24 },
] as const;

export function themeFor(path: string, date: Date): Theme {
  const preview = path.replace(/\/(?:index\.html)?$/, "");
  const override = seasons.find(({ theme }) => preview === `/${theme.slug}`);
  if (override) return override.theme;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const season = seasons.find(
    (season) =>
      season.month === month && season.firstDay <= day && day <= season.lastDay,
  );
  return season?.theme ?? standardTheme;
}
