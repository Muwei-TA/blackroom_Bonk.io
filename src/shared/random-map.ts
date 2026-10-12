import type { MapDefinition, Platform } from "./maps";
import { toDefinition } from "./custom-map";
// Stable seeds allow a generated layout to be reproduced without sharing RNG state.
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function generateRandomMap(seed: number): MapDefinition {
  const random = seededRandom(seed);
  const between = (a: number, b: number) => a + random() * (b - a);
  const balancing = random() < 0.5;
  const main: Platform = {
    x: between(575, 625),
    y: balancing ? between(410, 450) : between(565, 620),
    width: between(820, 940),
    height: 26,
    angle: balancing ? between(-0.08, 0.08) : 0,
    motion: balancing ? "seesaw" : "fixed",
  };
  const platforms: Platform[] = [main];
  if (balancing) {
    for (const x of [150, 1050])
      platforms.push({
        x,
        y: between(195, 245),
        width: between(140, 190),
        height: 24,
        angle: between(-0.1, 0.1),
        motion: "fixed",
      });
  } else {
    platforms.push({
      x: between(530, 670),
      y: between(270, 330),
      width: between(300, 410),
      height: 24,
      angle: between(-0.15, 0.15),
      motion: "seesaw",
    });
    for (const x of [220, 980])
      platforms.push({
        x,
        y: between(345, 390),
        width: between(150, 220),
        height: 24,
        angle: between(-0.12, 0.12),
        motion: "fixed",
      });
  }
  const spawns = Array.from({ length: 8 }, (_, i) => {
    const x = main.x + (i - 3.5) * ((main.width - 160) / 7);
    return {
      x,
      y:
        main.y +
        Math.tan(main.angle) * (x - main.x) -
        main.height / (2 * Math.cos(main.angle)) -
        70,
    };
  });
  return toDefinition(
    {
      format: "blackroom-map",
      version: 2,
      map: {
        name: balancing ? "随机 · 摇摆竞技场" : "随机 · 能量浮岛",
        subtitle: "能量雨 · 固定与天平地面",
        platforms,
        spawns,
      },
    },
    "random-" + (seed >>> 0).toString(16),
  );
}
