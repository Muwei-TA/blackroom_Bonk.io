import { it, expect } from "vitest";
import Matter from "matter-js";
import { Match } from "../../src/server/match";
import { getMap } from "../../src/shared/maps";
import { neutralInput } from "../../src/shared/protocol";
const make = (
  mode: import("../../src/shared/game-mode").GameMode = "classic",
) => {
  const m = new Match(getMap("origin"), ["a", "b"], mode);
  m.tick(0);
  m.start();
  return m;
};
const drop = (m: Match, id: string) => {
  const b = Matter.Composite.allBodies(m.physics!.engine.world).find(
    (b) => b.label === id,
  )!;
  Matter.Body.setPosition(b, { x: 600, y: 1000 });
};
it("countdown, last survivor scores, fifth win ends match", () => {
  const m = make();
  expect(m.phase).toBe("countdown");
  m.tick(2999);
  expect(m.phase).toBe("countdown");
  let t = 3000;
  for (let i = 1; i <= 5; i++) {
    m.tick(t);
    expect(m.phase).toBe("playing");
    drop(m, "b");
    m.tick(t + 17);
    expect(m.scores.get("a")).toBe(i);
    expect(m.phase).toBe(i === 5 ? "matchOver" : "roundOver");
    if (i < 5) {
      m.tick(t + 3017);
      expect(m.phase).toBe("countdown");
      t += 6017;
    }
  }
  expect(m.winnerId).toBe("a");
  m.dispose();
});
it("simultaneous elimination and timeout are draws", () => {
  for (const kind of ["drop", "time"]) {
    const m = make();
    m.tick(3000);
    if (kind === "drop") {
      drop(m, "a");
      drop(m, "b");
      m.tick(3017);
    } else m.tick(93000);
    expect(m.phase).toBe("roundOver");
    expect([...m.scores.values()]).toEqual([0, 0]);
    expect(m.winnerId).toBeNull();
    m.dispose();
  }
});
it("leaving during countdown or play aborts and clears score", () => {
  for (const playing of [false, true]) {
    const m = make();
    if (playing) m.tick(3000);
    m.removePlayer("b");
    expect(m.phase).toBe("lobby");
    expect(m.scores.get("a")).toBe(0);
    m.dispose();
  }
});
it("old sequences ignored and stale input cleared", () => {
  const m = make();
  m.tick(3000);
  m.setInput("a", 3, { ...neutralInput(), right: true }, 3000);
  m.setInput("a", 2, { ...neutralInput(), left: true }, 3000);
  m.tick(3017);
  const b = Matter.Composite.allBodies(m.physics!.engine.world).find(
    (b) => b.label === "a",
  )!;
  expect(b.velocity.x).toBeGreaterThan(0);
  Matter.Body.setVelocity(b, { x: 0, y: 0 });
  m.tick(4018);
  expect(b.velocity.x).toBeCloseTo(0);
  m.dispose();
});
it("new rounds clear collected growth and old drops in authoritative snapshots", () => {
  const m = make("energy");
  m.tick(3000);
  for (let i = 1; i <= 65; i++) m.tick(3000 + i * 17);
  const w = m.physics!,
    all = Matter.Composite.allBodies(w.engine.world);
  const a = all.find((b) => b.label === "a")!;
  const energy = w.energySnapshot()[0];
  Matter.Body.setPosition(
    all.find((b) => b.label === energy.id)!,
    a.position,
  );
  m.tick(4122);
  expect(m.snapshot(1, 4122).bodies.find((b) => b.id === "a")!.energy).toBe(1);
  drop(m, "b");
  m.tick(4139);
  m.tick(7140);
  const fresh = m.snapshot(2, 7140);
  expect(fresh.phase).toBe("countdown");
  expect(fresh.energies).toEqual([]);
  expect(fresh.bodies.every((b) => b.energy === 0 && b.radius === 20)).toBe(
    true,
  );
  m.dispose();
});
