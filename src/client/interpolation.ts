import type { WorldSnapshot, BodyView } from "../shared/protocol";
export class SnapshotBuffer {
  private frames: WorldSnapshot[] = [];
  push(s: WorldSnapshot) {
    const last = this.frames.at(-1);
    if (last && s.seq <= last.seq) return;
    if (last && s.round !== last.round) this.frames = [];
    this.frames.push(s);
    if (this.frames.length > 12) this.frames.shift();
  }
  clear() {
    this.frames = [];
  }
  sample(t: number): BodyView[] {
    if (!this.frames.length) return [];
    let a = this.frames[0],
      b = a;
    for (const f of this.frames) {
      if (f.serverTime <= t) a = f;
      else {
        b = f;
        break;
      }
      b = a;
    }
    const k =
      a === b
        ? 0
        : Math.max(
            0,
            Math.min(1, (t - a.serverTime) / (b.serverTime - a.serverTime)),
          );
    return b.bodies.map((body) => {
      const old = a.bodies.find((x) => x.id === body.id);
      return !old || !body.alive
        ? { ...body }
        : {
            ...body,
            x: old.x + (body.x - old.x) * k,
            y: old.y + (body.y - old.y) * k,
            angle: old.angle + (body.angle - old.angle) * k,
          };
    });
  }
}
