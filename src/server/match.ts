import type { GameMode } from "../shared/game-mode";
import {
  COUNTDOWN_MS,
  ROUND_MS,
  ROUND_PAUSE_MS,
  WIN_SCORE,
} from "../shared/constants";
import type { MapDefinition } from "../shared/maps";
import {
  neutralInput,
  type InputState,
  type RoomPhase,
  type WorldSnapshot,
} from "../shared/protocol";
import { PhysicsWorld } from "../shared/physics";
export class Match {
  phase: RoomPhase = "lobby";
  round = 0;
  scores = new Map<string, number>();
  winnerId: string | null = null;
  physics: PhysicsWorld | null = null;
  private now = 0;
  private deadline = 0;
  private inputs = new Map<
    string,
    { seq: number; at: number; state: InputState }
  >();
  constructor(
    private map: MapDefinition,
    private ids: string[],
    readonly mode: GameMode = "classic",
  ) {
    this.ids = [...ids];
    for (const id of ids) this.scores.set(id, 0);
  }
  start() {
    if (this.ids.length < 2 || this.phase !== "lobby") return;
    this.nextRound();
  }
  private nextRound() {
    this.physics?.dispose();
    this.physics = new PhysicsWorld(this.map, this.ids, this.mode);
    this.round++;
    this.phase = "countdown";
    this.winnerId = null;
    this.deadline = this.now + COUNTDOWN_MS;
    for (const v of this.inputs.values()) v.state = neutralInput();
  }
  setInput(id: string, seq: number, state: InputState, nowMs: number) {
    if (!this.ids.includes(id)) return;
    const old = this.inputs.get(id);
    if (old && seq <= old.seq) return;
    this.inputs.set(id, {
      seq,
      at: nowMs,
      state: this.phase === "playing" ? { ...state } : neutralInput(),
    });
  }
  removePlayer(id: string) {
    this.ids = this.ids.filter((x) => x !== id);
    this.inputs.delete(id);
    this.scores.delete(id);
    this.physics?.removePlayer(id);
    if (this.ids.length < 2) {
      this.phase = "lobby";
      this.winnerId = null;
      this.physics?.dispose();
      this.physics = null;
      this.round = 0;
      for (const id of this.ids) this.scores.set(id, 0);
    }
  }
  tick(nowMs: number) {
    this.now = nowMs;
    if (this.phase === "countdown" && nowMs >= this.deadline) {
      this.phase = "playing";
      this.deadline = nowMs + ROUND_MS;
    }
    if (this.phase === "roundOver" && nowMs >= this.deadline) {
      this.nextRound();
      return;
    }
    if (this.phase !== "playing" || !this.physics) return;
    for (const id of this.ids) {
      const i = this.inputs.get(id);
      this.physics.setInput(
        id,
        i && nowMs - i.at <= 1000 ? i.state : neutralInput(),
      );
    }
    this.physics.step();
    const alive = this.physics.snapshot().filter((b) => b.alive);
    if (alive.length <= 1 || nowMs >= this.deadline) {
      this.winnerId = alive.length === 1 ? alive[0].id : null;
      if (this.winnerId)
        this.scores.set(
          this.winnerId,
          (this.scores.get(this.winnerId) ?? 0) + 1,
        );
      this.phase =
        this.winnerId && (this.scores.get(this.winnerId) ?? 0) >= WIN_SCORE
          ? "matchOver"
          : "roundOver";
      this.deadline = nowMs + ROUND_PAUSE_MS;
    }
  }
  snapshot(seq: number, nowMs: number): WorldSnapshot {
    return {
      seq,
      serverTime: nowMs,
      round: this.round,
      phase: this.phase,
      remainingMs: Math.max(0, this.deadline - nowMs),
      bodies: this.physics?.snapshot() ?? [],
      platforms: this.physics?.platformSnapshot() ?? [],
      energies: this.physics?.energySnapshot() ?? [],
    };
  }
  dispose() {
    this.physics?.dispose();
    this.physics = null;
    this.inputs.clear();
  }
}
