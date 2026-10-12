import type {Platform} from './maps';
export type Point={x:number;y:number};
export function localPoint(point:Point,p:Platform):Point{const dx=point.x-p.x,dy=point.y-p.y,c=Math.cos(p.angle),s=Math.sin(p.angle);return {x:dx*c+dy*s,y:-dx*s+dy*c};}
export function platformCorners(p:Platform):Point[]{return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>{const x=sx*p.width/2,y=sy*p.height/2;return {x:p.x+x*Math.cos(p.angle)-y*Math.sin(p.angle),y:p.y+x*Math.sin(p.angle)+y*Math.cos(p.angle)};});}
export function pointInPlatform(point:Point,p:Platform){const q=localPoint(point,p);return Math.abs(q.x)<=p.width/2&&Math.abs(q.y)<=p.height/2;}
export function circleIntersectsPlatform(point:Point,r:number,p:Platform){const q=localPoint(point,p);return Math.hypot(q.x-Math.max(-p.width/2,Math.min(p.width/2,q.x)),q.y-Math.max(-p.height/2,Math.min(p.height/2,q.y)))<r;}
export function screenToWorld(x:number,y:number,rect:{left:number;top:number;width:number;height:number}):Point{return {x:(x-rect.left)*1200/rect.width,y:(y-rect.top)*800/rect.height};}
