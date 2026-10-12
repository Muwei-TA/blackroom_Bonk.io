import { it, expect } from "vitest";
import { generateRandomMap } from "../../src/shared/random-map";
import { toDocument, validateDocument, parseMapFile } from "../../src/shared/custom-map";
import { MAPS } from "../../src/shared/maps";
import { localPoint } from "../../src/shared/geometry";
it("reproduces seeds, varies layouts, and generates supported safe spawn geometry", () => {
  expect(generateRandomMap(42)).toEqual(generateRandomMap(42));
  const layouts = new Set<string>();
  for (let seed = 0; seed < 200; seed++) {
    const m = generateRandomMap(seed);
    validateDocument(toDocument(m));
    expect(m.platforms.some(p => p.motion === "seesaw")).toBe(true);
    expect(m.platforms.some(p => p.motion !== "seesaw")).toBe(true);
    for (const s of m.spawns) expect(m.platforms.some(p => {
      const local = localPoint(s, p);
      return Math.abs(local.x) < p.width / 2 - 20 && local.y < -p.height / 2;
    })).toBe(true);
    layouts.add(JSON.stringify(m.platforms));
  }
  expect(layouts.size).toBeGreaterThan(190);
});
it("loads legacy files and round-trips new seesaw maps", () => {
  const legacy = { ...toDocument(MAPS[0]), version: 1 };
  expect(parseMapFile(JSON.stringify(legacy))).toEqual(legacy);
  const dynamic = toDocument(generateRandomMap(7));
  expect(dynamic.version).toBe(2);
  expect(parseMapFile(JSON.stringify(dynamic))).toEqual(dynamic);
});
it("rejects forged platform motion, old-format dynamic data, angles and swept bounds", () => {
  const d = toDocument(MAPS[0]);
  d.map.platforms[0].motion = "seesaw";
  d.version = 2;
  expect(() => validateDocument(d)).toThrow(/区域/);
  d.map.platforms[0] = { x:600,y:400,width:600,height:26,angle:0,motion:"seesaw" };
  expect(() => validateDocument(d)).not.toThrow();
  d.map.platforms[0].angle = Math.PI / 2;
  expect(() => validateDocument(d)).toThrow(/天平/);
  d.map.platforms[0].angle = 0;
  d.version = 1;
  expect(() => validateDocument(d)).toThrow();
  d.version = 2;
  (d.map.platforms[0] as any).motion = "free-fall";
  expect(() => validateDocument(d)).toThrow(/类型/);
});
