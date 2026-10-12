import Matter from 'matter-js';
import { PHYSICS, RADIUS, STEP_MS } from '../shared/constants';
import type { MapDefinition } from '../shared/maps';
import { neutralInput, type InputState, type BodyView } from '../shared/protocol';
const {Engine,Bodies,Body,Composite}=Matter;
type Ball={body:Matter.Body;input:InputState;previousJump:boolean;alive:boolean;heavy:boolean};
export class PhysicsWorld {
 readonly engine=Engine.create({gravity:{x:0,y:1,scale:0.001}});
 private balls=new Map<string,Ball>();
 constructor(private map:MapDefinition,ids:string[]){
  for(const p of map.platforms)Composite.add(this.engine.world,Bodies.rectangle(p.x,p.y,p.width,p.height,{isStatic:true,angle:p.angle,friction:0.15,label:'platform'}));
  ids.forEach((id,i)=>{const p=map.spawns[i];const body=Bodies.circle(p.x,p.y,RADIUS,{label:id,density:PHYSICS.density,friction:0.04,frictionStatic:0.1,frictionAir:0.012,restitution:0.22});this.balls.set(id,{body,input:neutralInput(),previousJump:false,alive:true,heavy:false});Composite.add(this.engine.world,body);});
 }
 setInput(id:string,state:InputState){const b=this.balls.get(id);if(b)b.input={...state};}
 removePlayer(id:string){const b=this.balls.get(id);if(b){Composite.remove(this.engine.world,b.body);this.balls.delete(id);}}
 private grounded(body:Matter.Body){return this.engine.pairs.list.some((p:Matter.Pair)=>p.isActive&&((p.bodyA===body&&p.collision.normal.y< -0.5)||(p.bodyB===body&&p.collision.normal.y>0.5)));}
 step(){
  for(const b of this.balls.values()){
   if(!b.alive)continue;
   if(b.heavy!==b.input.heavy){b.heavy=b.input.heavy;Body.setDensity(b.body,PHYSICS.density*(b.heavy?PHYSICS.heavyMultiplier:1));}
   const direction=Number(b.input.right)-Number(b.input.left);
   Body.applyForce(b.body,b.body.position,{x:direction*b.body.mass*(b.heavy?PHYSICS.heavyForce:PHYSICS.force),y:0});
   if(b.input.jump&&!b.previousJump&&this.grounded(b.body))Body.setVelocity(b.body,{x:b.body.velocity.x,y:-PHYSICS.jumpSpeed});
   b.previousJump=b.input.jump;
   if(Math.abs(b.body.velocity.x)>PHYSICS.maxSpeed)Body.setVelocity(b.body,{x:Math.sign(b.body.velocity.x)*PHYSICS.maxSpeed,y:b.body.velocity.y});
  }
  Engine.update(this.engine,STEP_MS);
  const r=this.map.bounds;
  for(const b of this.balls.values())if(b.alive){const p=b.body.position;if(p.x<r.left||p.x>r.right||p.y<r.top||p.y>r.bottom){b.alive=false;Composite.remove(this.engine.world,b.body);}}
 }
 snapshot():BodyView[]{return [...this.balls].map(([id,b])=>({id,x:b.body.position.x,y:b.body.position.y,angle:b.body.angle,heavy:b.heavy,alive:b.alive}));}
 dispose(){Composite.clear(this.engine.world,false);Engine.clear(this.engine);this.balls.clear();}
}
