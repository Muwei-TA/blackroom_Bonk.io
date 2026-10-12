export type Platform = {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
};
export type MapDefinition = {
  id: string;
  name: string;
  subtitle: string;
  platforms: Platform[];
  spawns: { x: number; y: number }[];
  bounds: { left: number; right: number; top: number; bottom: number };
};
const platform = (
  x: number,
  y: number,
  width: number,
  height = 26,
  angle = 0,
): Platform => ({ x, y, width, height, angle });
const bounds = { left: -100, right: 1300, top: -400, bottom: 900 };
export const MAPS: readonly MapDefinition[] = [
  {
    id: "origin",
    name: "起点站",
    subtitle: "开阔平台 · 正面交锋",
    platforms: [platform(600, 560, 920)],
    spawns: Array.from({ length: 8 }, (_, i) => ({ x: 285 + i * 90, y: 470 })),
    bounds,
  },
  {
    id: "steps",
    name: "浮空阶梯",
    subtitle: "高低交错 · 抢占制高点",
    platforms: [
      platform(280, 570, 320),
      platform(600, 460, 290),
      platform(920, 570, 320),
    ],
    spawns: [
      { x: 200, y: 500 },
      { x: 280, y: 500 },
      { x: 360, y: 500 },
      { x: 550, y: 390 },
      { x: 650, y: 390 },
      { x: 840, y: 500 },
      { x: 920, y: 500 },
      { x: 1000, y: 500 },
    ],
    bounds,
  },
  {
    id: "tilt",
    name: "折线山谷",
    subtitle: "倾斜地形 · 变换攻防",
    platforms: [
      platform(370, 520, 420, 26, 0.16),
      platform(830, 520, 420, 26, -0.16),
      platform(600, 600, 170),
    ],
    spawns: Array.from({ length: 8 }, (_, i) => ({ x: 255 + i * 98, y: 410 })),
    bounds,
  },
];
export function getMap(id: string): MapDefinition {
  const m = MAPS.find((m) => m.id === id);
  if (!m) throw new Error("地图不存在");
  return m;
}
