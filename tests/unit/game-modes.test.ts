import { it, expect } from "vitest";
import Matter from "matter-js";
import { PhysicsWorld } from "../../src/shared/physics";
import { MAPS } from "../../src/shared/maps";
import { generateRandomMap } from "../../src/shared/random-map";
import { parseClientMessage } from "../../src/shared/protocol";
it("classic is the default: no drops or growth and original ground friction", () => {
  const w = new PhysicsWorld(MAPS[0], ["a"]);
  for (let i = 0; i < 400; i++) w.step();
  expect(w.energySnapshot()).toEqual([]);
  expect(w.snapshot()[0]).toMatchObject({ energy: 0, radius: 20 });
  expect(
    Matter.Composite.allBodies(w.engine.world).find(
      (b) => b.label === "platform",
    )!.friction,
  ).toBe(1);
  w.dispose();
});
it("classic freezes a custom seesaw without modifying the saved map", () => {
  const map = structuredClone(MAPS[0]);
  map.platforms = [
    { x: 600, y: 400, width: 600, height: 26, angle: 0, motion: "seesaw" },
  ];
  map.spawns[0] = { x: 750, y: 330 };
  const w = new PhysicsWorld(map, ["a"]);
  for (let i = 0; i < 100; i++) w.step();
  expect(w.platformSnapshot()).toEqual([]);
  const floor = Matter.Composite.allBodies(w.engine.world).find(
    (b) => b.label === "platform",
  )!;
  expect(floor.isStatic).toBe(true);
  expect(floor.angle).toBe(0);
  expect(map.platforms[0].motion).toBe("seesaw");
  w.dispose();
});
it("random arenas default to fixed classic terrain", () => {
  for (let seed = 0; seed < 30; seed++)
    expect(
      generateRandomMap(seed).platforms.every((p) => p.motion !== "seesaw"),
    ).toBe(true);
});
it("accepts only exact known mode-selection messages", () => {
  for (const mode of ["classic", "energy"] as const)
    expect(parseClientMessage({ type: "selectMode", mode })).toEqual({
      type: "selectMode",
      mode,
    });
  for (const m of [
    { type: "selectMode", mode: "hack" },
    { type: "selectMode", mode: "energy", radius: 100 },
  ])
    expect(() => parseClientMessage(m)).toThrow();
});
