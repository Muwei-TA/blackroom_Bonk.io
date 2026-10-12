import type { MapDefinition } from "./maps";
export type GameMode = "classic" | "energy";
export const GAME_MODES = {
  classic: {
    name: "经典弹球",
    description: "固定体型与静止地面，移动、跳跃、空格加重，把对手撞出场地。",
  },
  energy: {
    name: "能量天平",
    description:
      "随机能量雨，拾取后变大变重；天平随站位和重量倾斜，每轮成长重置。",
  },
} satisfies Record<GameMode, { name: string; description: string }>;
// Keep the original document intact so switching modes never erases map work.
export function mapForMode(map: MapDefinition, mode: GameMode): MapDefinition {
  return mode === "energy"
    ? map
    : {
        ...map,
        platforms: map.platforms.map((p) => ({ ...p, motion: "fixed" })),
      };
}
