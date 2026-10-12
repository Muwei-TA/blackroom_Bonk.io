import { randomInt, randomUUID } from "node:crypto";
import { COLORS, MAX_PLAYERS, MAX_ROOMS } from "../shared/constants";
import { getMap, type MapDefinition } from "../shared/maps";
import { toDefinition } from "../shared/custom-map";
import type {
  ClientMessage,
  ServerMessage,
  PlayerView,
  RoomView,
} from "../shared/protocol";
import { Match } from "./match";
type Room = {
  code: string;
  hostId: string;
  map: MapDefinition;
  players: Map<string, PlayerView>;
  match: Match | null;
  notice: string;
  seq: number;
  lastBroadcast: number;
};
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () =>
  Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(
    "",
  );
export class RoomManager {
  private rooms = new Map<string, Room>();
  private members = new Map<string, string>();
  private connected = new Set<string>();
  private lastMapSubmission = new Map<string, number>();
  constructor(
    private send: (id: string, m: ServerMessage) => void,
    private now: () => number = () => performance.now(),
    private generateCode: () => string = code,
  ) {}
  connect(id: string) {
    this.connected.add(id);
    this.send(id, { type: "welcome", playerId: id });
  }
  private error(id: string, code: string, message: string) {
    this.send(id, { type: "error", code, message });
  }
  private view(r: Room): RoomView {
    return {
      code: r.code,
      hostId: r.hostId,
      mapId: r.map.id,
      map: structuredClone(r.map),
      phase: r.match?.phase ?? "lobby",
      round: r.match?.round ?? 0,
      players: [...r.players.values()].map((p) => ({
        ...p,
        score: r.match?.scores.get(p.id) ?? 0,
      })),
      winnerId: r.match?.winnerId ?? null,
      notice: r.notice,
    };
  }
  private broadcast(r: Room) {
    const room = this.view(r);
    for (const id of r.players.keys()) this.send(id, { type: "room", room });
  }
  handle(id: string, m: ClientMessage) {
    if (!this.connected.has(id)) return;
    if (m.type === "leave") {
      this.leave(id);
      this.send(id, { type: "left" });
      return;
    }
    if (m.type === "create" || m.type === "join") {
      if (this.members.has(id))
        return this.error(id, "ALREADY_JOINED", "你已经在房间中，请先离开");
      let r: Room | undefined;
      if (m.type === "create") {
        if (this.rooms.size >= MAX_ROOMS)
          return this.error(id, "CAPACITY", "房间数量已达上限，请稍后重试");
        let c = this.generateCode();
        let tries = 0;
        while (this.rooms.has(c) && tries++ < 100) c = this.generateCode();
        if (this.rooms.has(c))
          return this.error(id, "CAPACITY", "暂时无法创建房间，请重试");
        r = {
          code: c,
          hostId: id,
          map: structuredClone(getMap("origin")),
          players: new Map(),
          match: null,
          notice: "邀请朋友加入，至少两人即可开始",
          seq: 0,
          lastBroadcast: 0,
        };
        this.rooms.set(c, r);
      } else {
        r = this.rooms.get(m.code);
        if (!r) return this.error(id, "NOT_FOUND", "房间不存在，请检查房间码");
        if (r.match && r.match.phase !== "lobby")
          return this.error(id, "IN_PROGRESS", "比赛已开始，请等待下一场");
        if (r.players.size >= MAX_PLAYERS)
          return this.error(id, "FULL", "房间已满，最多 8 人");
      }
      const used = new Set([...r.players.values()].map((p) => p.color));
      r.players.set(id, {
        id,
        nickname: m.nickname,
        color: COLORS.find((c) => !used.has(c))!,
        score: 0,
      });
      this.members.set(id, r.code);
      this.broadcast(r);
      return;
    }
    const r = this.rooms.get(this.members.get(id) ?? "");
    if (!r) return this.error(id, "NOT_IN_ROOM", "请先创建或加入房间");
    if (m.type === "input") {
      r.match?.setInput(id, m.seq, m.state, this.now());
      return;
    }
    if (r.hostId !== id) return this.error(id, "HOST_ONLY", "只有房主可以操作");
    const phase = r.match?.phase ?? "lobby";
    if (m.type === "applyCustomMap") {
      if (phase !== "lobby")
        return this.error(id, "IN_PROGRESS", "比赛中不能更换地图");
      const now = this.now();
      if (now - (this.lastMapSubmission.get(id) ?? -Infinity) < 1000)
        return this.error(id, "MAP_RATE_LIMIT", "地图提交过于频繁，请稍后重试");
      this.lastMapSubmission.set(id, now);
      try {
        r.map = toDefinition(m.document, "custom-" + randomUUID());
      } catch (e) {
        return this.error(id, "INVALID_MAP", (e as Error).message);
      }
      r.notice = "房主已加载自定义地图：" + r.map.name;
      this.broadcast(r);
      this.send(id, { type: "mapApplied" });
      return;
    }
    if (m.type === "selectMap") {
      if (phase !== "lobby")
        return this.error(id, "IN_PROGRESS", "比赛中不能更换地图");
      try {
        getMap(m.mapId);
      } catch {
        return this.error(id, "INVALID_MAP", "地图不存在");
      }
      r.map = structuredClone(getMap(m.mapId));
      this.broadcast(r);
      return;
    }
    if (m.type === "start") {
      if (phase !== "lobby") return this.error(id, "IN_PROGRESS", "比赛已开始");
      if (r.players.size < 2)
        return this.error(id, "NEED_PLAYERS", "至少需要两位玩家");
      r.match?.dispose();
      r.match = new Match(r.map, [...r.players.keys()]);
      r.match.tick(this.now());
      r.match.start();
      r.notice = "准备出发！";
      this.broadcast(r);
    }
    if (m.type === "rematch") {
      if (phase !== "matchOver")
        return this.error(id, "IN_PROGRESS", "请等待比赛结束");
      r.match?.dispose();
      r.match = null;
      r.notice = "新一场，准备好了吗？";
      this.broadcast(r);
    }
  }
  private leave(id: string) {
    const r = this.rooms.get(this.members.get(id) ?? "");
    this.members.delete(id);
    if (!r) return;
    r.players.delete(id);
    r.match?.removePlayer(id);
    if (!r.players.size) {
      r.match?.dispose();
      this.rooms.delete(r.code);
      return;
    }
    if (r.hostId === id) r.hostId = r.players.keys().next().value!;
    if (r.match?.phase === "lobby") {
      r.match.dispose();
      r.match = null;
      r.notice = "人数不足，比赛已结束，等待朋友加入";
    } else r.notice = "一位玩家离开了房间";
    this.broadcast(r);
  }
  disconnect(id: string) {
    this.leave(id);
    this.connected.delete(id);
    this.lastMapSubmission.delete(id);
  }
  tick(nowMs: number) {
    for (const r of this.rooms.values()) {
      if (!r.match) continue;
      const before = r.match.phase;
      r.match.tick(nowMs);
      if (before !== r.match.phase) {
        r.notice =
          r.match.phase === "roundOver"
            ? r.match.winnerId
              ? "本轮胜者已产生"
              : "本轮平局，无人得分"
            : r.match.phase === "matchOver"
              ? "比赛结束！"
              : r.match.phase === "playing"
                ? "把对手撞出场地"
                : "下一回合准备";
        this.broadcast(r);
      }
      if (nowMs - r.lastBroadcast >= 50) {
        r.lastBroadcast = nowMs;
        const world = r.match.snapshot(++r.seq, nowMs);
        for (const id of r.players.keys())
          this.send(id, { type: "snapshot", world });
      }
    }
  }
  dispose() {
    for (const r of this.rooms.values()) r.match?.dispose();
    this.rooms.clear();
    this.members.clear();
    this.connected.clear();
    this.lastMapSubmission.clear();
  }
}
