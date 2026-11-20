import { copyFile, mkdir } from "node:fs/promises";
import { seasons } from "../src/emojis";

for (const { theme } of seasons) {
  const directory = `dist/${theme.slug}`;
  await mkdir(directory, { recursive: true });
  await copyFile("dist/index.html", `${directory}/index.html`);
}
