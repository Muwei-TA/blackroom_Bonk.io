import { it, expect } from "vitest";
import { SnapshotBuffer } from "../../src/client/interpolation";
import type { WorldSnapshot } from "../../src/shared/protocol";
const frame = (seq: number, round: number, x: number): WorldSnapshot => ({
  seq,
  round,
  serverTime: seq * 100,
  phase: "playing",
  remainingMs: 1000,
  platforms: [], energies: [],
  bodies: [{ id: "a", x, y: 0, angle: 0, heavy: false, alive: true, radius:20, energy:0, mass:1 }],
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
it("interpolates platform tilt and energy motion without retaining collected drops", () => {
  const buffer=new SnapshotBuffer();
  const a=frame(1,1,0), b=frame(2,1,100);
  a.platforms=[{index:0,x:600,y:400,angle:0}]; b.platforms=[{index:0,x:600,y:400,angle:0.4}];
  a.energies=[{id:"energy-1",x:500,y:50}]; b.energies=[{id:"energy-1",x:500,y:150}];
  b.bodies[0].radius=24; b.bodies[0].energy=2;
  buffer.push(a); buffer.push(b);
  expect(buffer.sampleWorld(150).platforms[0].angle).toBeCloseTo(0.2);
  expect(buffer.sampleWorld(150).energies[0].y).toBe(100);
  const c=frame(3,1,200); c.energies=[];
  buffer.push(c);
  expect(buffer.sampleWorld(250).energies).toEqual([]);
  buffer.push(frame(4,2,0));
  expect(buffer.sampleWorld(350).platforms).toEqual([]);
});
