import { it, expect } from "vitest";
import { SnapshotBuffer } from "../../src/client/interpolation";
import type { WorldSnapshot } from "../../src/shared/protocol";
const frame = (seq: number, round: number, x: number): WorldSnapshot => ({
  seq,
  round,
  serverTime: seq * 100,
  phase: "playing",
  remainingMs: 1000,
  bodies: [{ id: "a", x, y: 0, angle: 0, heavy: false, alive: true }],
});
it("interpolates midpoints, rejects stale seq and does not extrapolate", () => {
  const b = new SnapshotBuffer();
  b.push(frame(1, 1, 0));
  b.push(frame(2, 1, 100));
  expect(b.sample(150)[0].x).toBe(50);
  b.push(frame(1, 1, 999));
  expect(b.sample(250)[0].x).toBe(100);
});
it("clears interpolation across rounds and rematches", () => {
  const b = new SnapshotBuffer();
  b.push(frame(2, 3, 100));
  b.push(frame(3, 4, 0));
  expect(b.sample(250)[0].x).toBe(0);
  b.push(frame(4, 1, 40));
  expect(b.sample(350)[0].x).toBe(40);
  b.push(frame(3, 4, 200));
  expect(b.sample(450)[0].x).toBe(40);
});
