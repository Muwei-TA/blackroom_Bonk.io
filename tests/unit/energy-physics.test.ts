import { it, expect } from "vitest";
import Matter from "matter-js";
import { PhysicsWorld } from "../../src/shared/physics";
import { MAPS, type MapDefinition } from "../../src/shared/maps";
import { neutralInput } from "../../src/shared/protocol";
const bodies = (w:PhysicsWorld) => Matter.Composite.allBodies(w.engine.world);
const ball = (w:PhysicsWorld,id="a") => bodies(w).find(b=>b.label===id)!;
const tick = (w:PhysicsWorld,n:number) => { for(let i=0;i<n;i++) w.step(); };
const collect = (w:PhysicsWorld,id="a") => {
  for(let i=0;i<200 && !w.energySnapshot().length;i++) w.step();
  const energy = w.energySnapshot()[0];
  expect(energy).toBeDefined();
  const drop = bodies(w).find(b=>b.label===energy.id)!;
  Matter.Body.setPosition(drop,ball(w,id).position);
  Matter.Body.setVelocity(drop,{x:0,y:0});
  w.step();
};
it("falling energy grows actual radius and mass, while heavy toggles preserve growth", () => {
  const w = new PhysicsWorld(MAPS[0],["a"],()=>0.25);
  const originalMass = ball(w).mass;
  tick(w,65);
  const start=w.energySnapshot()[0].y;
  tick(w,20);
  expect(w.energySnapshot()[0].y).toBeGreaterThan(start);
  collect(w);
  expect(w.energySnapshot()).toHaveLength(0);
  expect(w.snapshot()[0]).toMatchObject({energy:1,radius:22});
  expect(ball(w).circleRadius).toBe(22);
  const grownMass=ball(w).mass;
  expect(grownMass).toBeGreaterThan(originalMass);
  w.setInput("a",{...neutralInput(),heavy:true}); w.step();
  expect(ball(w).mass).toBeCloseTo(grownMass*4);
  w.setInput("a",neutralInput()); w.step();
  expect(ball(w).mass).toBeCloseTo(grownMass);
  w.dispose();
  const fresh = new PhysicsWorld(MAPS[0],["a"]);
  expect(fresh.snapshot()[0]).toMatchObject({energy:0,radius:20});
  fresh.dispose();
});
it("one drop rewards one alive player and growth is capped", () => {
  const w=new PhysicsWorld(MAPS[0],["a","b"],()=>0.25);
  collect(w,"a");
  expect(w.snapshot().map(b=>b.energy)).toEqual([1,0]);
  w.removePlayer("b");
  for(let i=0;i<11;i++) collect(w);
  expect(w.snapshot()[0]).toMatchObject({energy:10,radius:40});
  expect(w.snapshot()[0].mass).toBeCloseTo(ball(w).mass);
  w.dispose();
});
it("energy expires, falls onto platforms, stays bounded and is not collected by eliminated balls", () => {
  const w=new PhysicsWorld(MAPS[0],["a"],()=>0.5);
  Matter.Body.setPosition(ball(w),{x:600,y:1000}); w.step();
  tick(w,180);
  const first=w.energySnapshot()[0];
  expect(first.y).toBeGreaterThan(500);
  expect(first.y).toBeLessThan(550);
  tick(w,800);
  expect(w.energySnapshot().some(e=>e.id===first.id)).toBe(false);
  expect(w.energySnapshot().length).toBeLessThanOrEqual(16);
  expect(w.snapshot()[0].energy).toBe(0);
  w.dispose();
});
function map(seesaw:boolean):MapDefinition {
 return {...structuredClone(MAPS[0]), platforms:[{x:600,y:450,width:800,height:26,angle:0,motion:seesaw?"seesaw":"fixed"}],spawns:[{x:850,y:400},{x:350,y:400},...MAPS[0].spawns.slice(2)]};
}
it("unbalanced loading tilts a center-pivot seesaw while fixed ground stays fixed", () => {
  const w=new PhysicsWorld(map(true),["a"],()=>0.5);
  tick(w,45);
  const p=w.platformSnapshot()[0];
  expect(p.angle).toBeGreaterThan(0.01);
  expect(p.x).toBeCloseTo(600,2); expect(p.y).toBeCloseTo(450,2);
  tick(w,300);
  expect(Math.abs(w.platformSnapshot()[0].angle)).toBeLessThanOrEqual(Math.PI/4 + 1e-6);
  w.dispose();
  const fixed=new PhysicsWorld(map(false),["a"]);
  tick(fixed,120);
  const floor=bodies(fixed).find(b=>b.label==="platform")!;
  expect(floor.angle).toBe(0); expect(floor.position).toEqual({x:600,y:450});
  fixed.dispose();
});
it("symmetric equal weights balance, heavier right-side players produce more right tilt", () => {
  const equal=new PhysicsWorld(map(true),["a","b"]);
  const heavy=new PhysicsWorld(map(true),["a","b"]);
  heavy.setInput("a",{...neutralInput(),heavy:true});
  tick(equal,45); tick(heavy,45);
  expect(Math.abs(equal.platformSnapshot()[0].angle)).toBeLessThan(0.015);
  expect(heavy.platformSnapshot()[0].angle).toBeGreaterThan(equal.platformSnapshot()[0].angle+0.01);
  equal.dispose(); heavy.dispose();
});
it("simultaneous contact never rewards the same drop twice", () => {
  const w=new PhysicsWorld(MAPS[0],["a","b"],()=>0.5);
  tick(w,65);
  for (const id of ["a","b"]) {
    Matter.Body.setPosition(ball(w,id),{x:600,y:200});
    Matter.Body.setVelocity(ball(w,id),{x:0,y:0});
  }
  const energy=w.energySnapshot()[0];
  Matter.Body.setPosition(bodies(w).find(b=>b.label===energy.id)!,{x:600,y:200});
  w.step();
  expect(w.snapshot().reduce((sum,b)=>sum+b.energy,0)).toBe(1);
  expect(w.energySnapshot()).toHaveLength(0);
  w.dispose();
});
