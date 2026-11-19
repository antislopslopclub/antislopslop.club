import { emojis } from "./emojis";

export function setUpFavicon() {
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')!;
  if (icon.dataset.static) return () => {};

  const initialUrl = icon.href;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controller = new AbortController();
  let timer: number;

  async function start() {
    const response = await fetch(initialUrl, { signal: controller.signal });
    if (!response.ok) return;
    const template = await response.text();
    if (controller.signal.aborted) return;
    const frames = emojis.map(emoji =>
      "data:image/svg+xml," + encodeURIComponent(template.replace("🚀", emoji))
    );

    function sync() {
      window.clearInterval(timer);
      icon.href = initialUrl;
      if (motion.matches) return;

      let index = 0;
      timer = window.setInterval(() => {
        index = (index + 1) % frames.length;
        icon.href = frames[index]!;
      }, 1000);
    }
    sync();
    motion.addEventListener("change", sync, { signal: controller.signal });
  }
  // Keep the linked SVG if the template request fails.
  void start().catch(() => {});
  return () => {
    controller.abort();
    window.clearInterval(timer);
    icon.href = initialUrl;
  };
}
