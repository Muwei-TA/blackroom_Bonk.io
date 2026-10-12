import type { MapDefinition } from "./maps";
import { validateDocument, type MapDocument } from "./custom-map";
export type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
  heavy: boolean;
};
export const neutralInput = (): InputState => ({
  left: false,
  right: false,
  jump: false,
  heavy: false,
});
export type RoomPhase =
  "lobby" | "countdown" | "playing" | "roundOver" | "matchOver";
export type PlayerView = {
  id: string;
  nickname: string;
  color: string;
  score: number;
};
export type BodyView = {
  id: string;
  x: number;
  y: number;
  angle: number;
  heavy: boolean;
  alive: boolean;
};
export type RoomView = {
  code: string;
  hostId: string;
  mapId: string;
  map: MapDefinition;
  phase: RoomPhase;
  round: number;
  players: PlayerView[];
  winnerId: string | null;
  notice: string;
};
export type WorldSnapshot = {
  seq: number;
  serverTime: number;
  round: number;
  phase: RoomPhase;
  remainingMs: number;
  bodies: BodyView[];
};
export type ClientMessage =
  | { type: "create"; nickname: string }
  | { type: "join"; nickname: string; code: string }
  | { type: "selectMap"; mapId: string }
  | { type: "applyCustomMap"; document: MapDocument }
  | { type: "start" | "rematch" | "leave" }
  | { type: "input"; seq: number; state: InputState };
export type ServerMessage =
  | { type: "welcome"; playerId: string }
  | { type: "room"; room: RoomView }
  | { type: "snapshot"; world: WorldSnapshot }
  | { type: "left" }
  | { type: "mapApplied" }
  | { type: "error"; code: string; message: string };
export class ProtocolError extends Error {}
const invalid = (): never => {
  throw new ProtocolError("消息格式无效");
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  return v as Record<string, unknown>;
}
function exact(v: Record<string, unknown>, keys: string[]) {
  if (Object.keys(v).length !== keys.length || keys.some((k) => !(k in v)))
    invalid();
}
function nickname(v: unknown): string {
  if (typeof v !== "string") return invalid();
  const n = v.trim();
  if ([...n].length < 1 || [...n].length > 20) return invalid();
  return n;
}
export function normalizeRoomCode(v: string): string {
  return v.trim().toUpperCase();
}
export function parseClientMessage(value: unknown): ClientMessage {
  const v = object(value);
  switch (v.type) {
    case "create":
      exact(v, ["type", "nickname"]);
      return { type: "create", nickname: nickname(v.nickname) };
    case "join": {
      exact(v, ["type", "nickname", "code"]);
      if (typeof v.code !== "string") return invalid();
      const code = normalizeRoomCode(v.code);
      if (!/^[A-Z2-9]{6}$/.test(code)) return invalid();
      return { type: "join", nickname: nickname(v.nickname), code };
    }
    case "applyCustomMap":
      exact(v, ["type", "document"]);
      return { type: "applyCustomMap", document: validateDocument(v.document) };
    case "selectMap":
      exact(v, ["type", "mapId"]);
      if (typeof v.mapId !== "string" || v.mapId.length > 32) return invalid();
      return { type: "selectMap", mapId: v.mapId };
    case "start":
    case "rematch":
    case "leave":
      exact(v, ["type"]);
      return { type: v.type };
    case "input": {
      exact(v, ["type", "seq", "state"]);
      if (!Number.isSafeInteger(v.seq) || (v.seq as number) < 0)
        return invalid();
      const s = object(v.state);
      exact(s, ["left", "right", "jump", "heavy"]);
      if (Object.values(s).some((x) => typeof x !== "boolean"))
        return invalid();
      return { type: "input", seq: v.seq as number, state: s as InputState };
    }
    default:
      return invalid();
  }
}
