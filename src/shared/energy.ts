import Matter from "matter-js";
import { ENERGY, STEP_MS } from "./constants";
import type { MapDefinition } from "./maps";
import type { EnergyView } from "./protocol";
export type Collector = { id:string; x:number; y:number; radius:number };
export class EnergyRain {
  private drops = new Map<string, { body:Matter.Body; expires:number }>();
  private time=0;
  private nextDrop=ENERGY.firstDropMs;
  private sequence=0;
  constructor(private world:Matter.World, private map:MapDefinition, private random:()=>number) {}
  step(collectors:Collector[], reward:(id:string)=>void) {
    this.time += STEP_MS;
    if (this.time >= this.nextDrop) {
      this.nextDrop += ENERGY.intervalMs;
      if (this.drops.size < ENERGY.maxDrops) {
        const platforms=this.map.platforms;
        const total=platforms.reduce((sum,p)=>sum+p.width,0);
        let choice=this.random()*total;
        const p=platforms.find(p=>{ choice-=p.width; return choice<=0; }) ?? platforms[0];
        const id="energy-"+(++this.sequence);
        const body=Matter.Bodies.circle(p.x+(this.random()-0.5)*p.width*Math.cos(p.angle)*0.85,-70,ENERGY.radius,{
          label:id,density:0.0003,friction:0.15,restitution:0.05,frictionAir:0.004,
          collisionFilter:{category:4,mask:2},
        });
        this.drops.set(id,{body,expires:this.time+ENERGY.lifetimeMs});
        Matter.Composite.add(this.world,body);
      }
    }
    for (const [id,drop] of this.drops) {
      const { x,y }=drop.body.position;
      const winner=collectors.map(c=>({c,distance:Math.hypot(c.x-x,c.y-y)}))
        .filter(({c,distance})=>distance<=c.radius+ENERGY.radius)
        .sort((a,b)=>a.distance-b.distance || a.c.id.localeCompare(b.c.id))[0];
      if (winner) reward(winner.c.id);
      if (winner || this.time>=drop.expires || y>this.map.bounds.bottom || x<this.map.bounds.left || x>this.map.bounds.right) {
        Matter.Composite.remove(this.world,drop.body);
        this.drops.delete(id);
      }
    }
  }
  snapshot():EnergyView[] { return [...this.drops].map(([id,d])=>({id,...d.body.position})); }
  dispose() { for(const d of this.drops.values()) Matter.Composite.remove(this.world,d.body); this.drops.clear(); }
}
