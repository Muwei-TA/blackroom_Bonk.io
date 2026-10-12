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
    return this.sampleWorld(t).bodies;
  }
  sampleWorld(
    t: number,
  ): Pick<WorldSnapshot, "bodies" | "platforms" | "energies"> {
    if (!this.frames.length) return { bodies: [], platforms: [], energies: [] };
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
    const lerp = (a: number, b: number) => a + (b - a) * k;
    return {
      platforms: b.platforms.map((p) => {
        const old = a.platforms.find((q) => q.index === p.index);
        return old
          ? {
              ...p,
              x: lerp(old.x, p.x),
              y: lerp(old.y, p.y),
              angle: lerp(old.angle, p.angle),
            }
          : { ...p };
      }),
      energies: b.energies.map((e) => {
        const old = a.energies.find((q) => q.id === e.id);
        return old
          ? { ...e, x: lerp(old.x, e.x), y: lerp(old.y, e.y) }
          : { ...e };
      }),
      bodies: b.bodies.map((body) => {
        const old = a.bodies.find((x) => x.id === body.id);
        return !old || !body.alive
          ? { ...body }
          : {
              ...body,
              x: old.x + (body.x - old.x) * k,
              y: old.y + (body.y - old.y) * k,
              angle: old.angle + (body.angle - old.angle) * k,
            };
      }),
    };
  }
}
