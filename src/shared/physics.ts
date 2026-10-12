import Matter from "matter-js";
import {
  PHYSICS,
  RADIUS,
  STEP_MS,
  ENERGY,
  SEESAW_MAX_ANGLE,
} from "./constants";
import type { MapDefinition } from "./maps";
import {
  neutralInput,
  type InputState,
  type BodyView,
  type PlatformView,
} from "./protocol";
import { EnergyRain } from "./energy";
const { Engine, Bodies, Body, Composite, Constraint } = Matter;
type Ball = {
  body: Matter.Body;
  input: InputState;
  previousJump: boolean;
  alive: boolean;
  heavy: boolean;
  energy: number;
  radius: number;
};
export class PhysicsWorld {
  readonly engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  private balls = new Map<string, Ball>();
  private platforms: {
    index: number;
    body: Matter.Body;
    x: number;
    y: number;
  }[] = [];
  private rain: EnergyRain;
  constructor(
    private map: MapDefinition,
    ids: string[],
    random: () => number = Math.random,
  ) {
    this.rain = new EnergyRain(this.engine.world, map, random);
    for (const [index, p] of map.platforms.entries()) {
      const seesaw = p.motion === "seesaw";
      const body = Bodies.rectangle(p.x, p.y, p.width, p.height, {
        isStatic: !seesaw,
        angle: p.angle,
        friction: 0.18,
        frictionAir: 0.04,
        density: 0.0015,
        label: "platform",
        collisionFilter: { category: 2, mask: 7 },
      });
      Composite.add(this.engine.world, body);
      if (seesaw) {
        Composite.add(
          this.engine.world,
          Constraint.create({
            bodyA: body,
            pointA: { x: 0, y: 0 },
            pointB: { x: p.x, y: p.y },
            length: 0,
            stiffness: 1,
            damping: 0.2,
          }),
        );
        this.platforms.push({ index, body, x: p.x, y: p.y });
      }
    }
    ids.forEach((id, i) => {
      const p = map.spawns[i];
      const body = Bodies.circle(p.x, p.y, RADIUS, {
        label: id,
        collisionFilter: { category: 1, mask: 3 },
        density: PHYSICS.density,
        friction: 0.04,
        frictionStatic: 0.1,
        frictionAir: 0.012,
        restitution: 0.22,
      });
      this.balls.set(id, {
        body,
        input: neutralInput(),
        previousJump: false,
        alive: true,
        heavy: false,
        energy: 0,
        radius: RADIUS,
      });
      Composite.add(this.engine.world, body);
    });
  }
  setInput(id: string, state: InputState) {
    const b = this.balls.get(id);
    if (b) b.input = { ...state };
  }
  removePlayer(id: string) {
    const b = this.balls.get(id);
    if (b) {
      Composite.remove(this.engine.world, b.body);
      this.balls.delete(id);
    }
  }
  private grounded(body: Matter.Body) {
    return this.engine.pairs.list.some(
      (p: Matter.Pair) =>
        p.isActive &&
        ((p.bodyA === body && p.collision.normal.y < -0.5) ||
          (p.bodyB === body && p.collision.normal.y > 0.5)),
    );
  }
  step() {
    for (const b of this.balls.values()) {
      if (!b.alive) continue;
      if (b.heavy !== b.input.heavy) {
        b.heavy = b.input.heavy;
        Body.setDensity(
          b.body,
          PHYSICS.density * (b.heavy ? PHYSICS.heavyMultiplier : 1),
        );
      }
      const direction = Number(b.input.right) - Number(b.input.left);
      Body.applyForce(b.body, b.body.position, {
        x:
          direction *
          b.body.mass *
          (b.heavy ? PHYSICS.heavyForce : PHYSICS.force),
        y: 0,
      });
      if (b.input.jump && !b.previousJump && this.grounded(b.body))
        Body.setVelocity(b.body, {
          x: b.body.velocity.x,
          y: -PHYSICS.jumpSpeed,
        });
      b.previousJump = b.input.jump;
      if (Math.abs(b.body.velocity.x) > PHYSICS.maxSpeed)
        Body.setVelocity(b.body, {
          x: Math.sign(b.body.velocity.x) * PHYSICS.maxSpeed,
          y: b.body.velocity.y,
        });
    }
    Engine.update(this.engine, STEP_MS);
    for (const p of this.platforms) {
      Body.setPosition(p.body, { x: p.x, y: p.y });
      Body.setVelocity(p.body, { x: 0, y: 0 });
      if (Math.abs(p.body.angle) > SEESAW_MAX_ANGLE) {
        Body.setAngle(p.body, Math.sign(p.body.angle) * SEESAW_MAX_ANGLE);
        Body.setAngularVelocity(p.body, 0);
      }
    }
    const r = this.map.bounds;
    for (const b of this.balls.values())
      if (b.alive) {
        const p = b.body.position;
        if (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) {
          b.alive = false;
          Composite.remove(this.engine.world, b.body);
        }
      }
    this.rain.step(
      [...this.balls]
        .filter(([, b]) => b.alive)
        .map(([id, b]) => ({ id, ...b.body.position, radius: b.radius })),
      (id) => {
        const b = this.balls.get(id)!;
        if (b.energy >= ENERGY.maxStacks) return;
        b.energy++;
        const radius = RADIUS + b.energy * ENERGY.radiusPerStack;
        const grounded = this.grounded(b.body);
        Body.scale(b.body, radius / b.radius, radius / b.radius);
        if (grounded)
          Body.setPosition(b.body, {
            x: b.body.position.x,
            y: b.body.position.y - (radius - b.radius),
          });
        b.radius = radius;
      },
    );
  }
  platformSnapshot(): PlatformView[] {
    return this.platforms.map((p) => ({
      index: p.index,
      ...p.body.position,
      angle: p.body.angle,
    }));
  }
  energySnapshot() {
    return this.rain.snapshot();
  }
  snapshot(): BodyView[] {
    return [...this.balls].map(([id, b]) => ({
      id,
      x: b.body.position.x,
      y: b.body.position.y,
      angle: b.body.angle,
      heavy: b.heavy,
      alive: b.alive,
      radius: b.radius,
      energy: b.energy,
      mass: b.body.mass,
    }));
  }
  dispose() {
    this.rain.dispose();
    this.platforms = [];
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.balls.clear();
  }
}
