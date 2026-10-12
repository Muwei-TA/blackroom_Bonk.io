import { it, expect } from "vitest";
import Matter from "matter-js";
import { PhysicsWorld } from "../../src/server/physics";
import { MAPS, getMap } from "../../src/shared/maps";
import { neutralInput } from "../../src/shared/protocol";
const body = (w: PhysicsWorld, id: string) =>
  Matter.Composite.allBodies(w.engine.world).find((b) => b.label === id)!;
const settle = (w: PhysicsWorld, n = 120) => {
  for (let i = 0; i < n; i++) w.step();
};
it("eight spawns land safely on each map", () => {
  for (const m of MAPS) {
    const w = new PhysicsWorld(
      m,
      Array.from({ length: 8 }, (_, i) => String(i)),
    );
    settle(w);
    expect(w.snapshot().every((b) => b.alive)).toBe(true);
    expect(w.snapshot().every((b, i) => b.y > m.spawns[i].y)).toBe(true);
    w.dispose();
  }
});
it("jumps only on a grounded press edge", () => {
  const w = new PhysicsWorld(getMap("origin"), ["a"]);
  settle(w);
  w.setInput("a", { ...neutralInput(), jump: true });
  w.step();
  expect(body(w, "a").velocity.y).toBeLessThan(-8);
  settle(w, 12);
  const vy = body(w, "a").velocity.y;
  w.setInput("a", { ...neutralInput(), jump: false });
  w.step();
  w.setInput("a", { ...neutralInput(), jump: true });
  w.step();
  expect(body(w, "a").velocity.y).toBeGreaterThan(vy);
  w.dispose();
});
it("heavy increases mass and reduces movement acceleration then restores mass", () => {
  const a = new PhysicsWorld(getMap("origin"), ["a"]);
  const b = new PhysicsWorld(getMap("origin"), ["a"]);
  const mass = body(a, "a").mass;
  a.setInput("a", { ...neutralInput(), right: true });
  b.setInput("a", { ...neutralInput(), right: true, heavy: true });
  a.step();
  b.step();
  expect(body(b, "a").mass).toBeGreaterThan(mass);
  expect(body(a, "a").velocity.x).toBeGreaterThan(body(b, "a").velocity.x);
  b.setInput("a", neutralInput());
  b.step();
  expect(body(b, "a").mass).toBeCloseTo(mass);
  a.dispose();
  b.dispose();
});
it("real collision transfers movement", () => {
  const w = new PhysicsWorld(getMap("origin"), ["a", "b"]);
  settle(w);
  const b = body(w, "b").position.x;
  w.setInput("a", { ...neutralInput(), right: true });
  settle(w, 30);
  expect(body(w, "b").position.x).toBeGreaterThan(b + 5);
  w.dispose();
});
it("out of bounds eliminates and cannot revive with input", () => {
  const w = new PhysicsWorld(getMap("origin"), ["a"]);
  Matter.Body.setPosition(body(w, "a"), { x: 600, y: 1000 });
  w.step();
  expect(w.snapshot()[0].alive).toBe(false);
  w.setInput("a", { ...neutralInput(), jump: true });
  settle(w);
  expect(w.snapshot()[0].alive).toBe(false);
  w.dispose();
});
