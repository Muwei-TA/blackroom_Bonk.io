import { it, expect } from "vitest";
import { MAPS, getMap } from "../../src/shared/maps";
it("has three maps with eight safe distinct spawn points each", () => {
  expect(MAPS).toHaveLength(3);
  expect(new Set(MAPS.map((m) => m.id)).size).toBe(3);
  for (const m of MAPS) {
    expect(getMap(m.id)).toBe(m);
    expect(m.spawns).toHaveLength(8);
    for (const [i, p] of m.spawns.entries()) {
      expect(p.x).toBeGreaterThan(m.bounds.left);
      expect(p.x).toBeLessThan(m.bounds.right);
      expect(p.y).toBeLessThan(m.bounds.bottom);
      for (const q of m.spawns.slice(i + 1))
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(40);
    }
  }
  expect(() => getMap("unknown")).toThrow();
});
