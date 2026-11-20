import type { EffectActivity } from "./click-effects";

const launchMs = 300;
const burstMs = 950;
const sparkCount = 48;
const burstScale = 3.5;

export function fireworks(
  burst: string,
  sparks: readonly [string, ...string[]],
): EffectActivity {
  const create: EffectActivity["create"] = (
    anchorX,
    anchorY,
    start,
    launcher,
  ) => {
    const rotation = Math.random() * Math.PI * 2;
    const dx = new Float64Array(sparkCount);
    const dy = new Float64Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) {
      const angle = rotation + (i * 2 * Math.PI) / sparkCount;
      const speed = (i % 2 === 0 ? 1 : 0.6) * (0.9 + Math.random() * 0.2);
      dx[i] = Math.cos(angle) * speed;
      dy[i] = Math.sin(angle) * speed;
    }

    return (width, height, now, reducedMotion, draw) => {
      const age = now - start;
      const x = anchorX * width;
      const y = anchorY * height;
      if (reducedMotion) {
        if (age < burstMs) draw(burst, x, y, burstScale, 1);
        return;
      }
      if (age < launchMs) {
        const remaining = 1 - age / launchMs;
        draw(
          launcher,
          x,
          y + Math.min(140, height / 3) * remaining ** 2,
          1.45,
          1,
        );
        return;
      }

      const t = (age - launchMs) / burstMs;
      if (t >= 1) return;
      const radius = Math.min(300, width * 0.47, height * 0.47);
      const spread = radius * (1 - (1 - t) ** 3);
      const scale = 1.8 - 0.8 * t;
      const opacity = Math.min(1, (1 - t) * 2.5);
      for (let i = 0; i < sparkCount; i++) {
        draw(
          sparks[i % sparks.length]!,
          x + dx[i]! * spread,
          y + dy[i]! * spread + radius * 0.32 * t * t,
          scale,
          opacity,
        );
      }
      if (t < 0.35) draw(burst, x, y, burstScale, 1 - t / 0.35);
    };
  };

  return { kind: "effect", create };
}
