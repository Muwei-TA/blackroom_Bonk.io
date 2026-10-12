import type {MapDefinition,Platform} from './maps';
import {RADIUS} from './constants';
import {circleIntersectsPlatform,platformCorners,type Point} from './geometry';
export const MAX_MAP_BYTES=32*1024;
export type MapDocument={format:'blackroom-map';version:1;map:{name:string;subtitle:string;platforms:Platform[];spawns:Point[]}};
const fail=(message:string):never=>{throw new Error(message);};
function obj(value:unknown,keys:string[],label:string):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))return fail(`${label}格式无效`);const v=value as Record<string,unknown>;if(Object.keys(v).length!==keys.length||keys.some(k=>!(k in v)))fail(`${label}包含缺失或未知字段`);return v;}
function num(value:unknown,min:number,max:number,label:string):number{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)return fail(`${label}须为 ${min} 至 ${max} 的有限数字`);return value;}
function text(value:unknown,min:number,max:number,label:string):string{if(typeof value!=='string')return fail(`${label}须为文字`);const s=value.trim();if([...s].length<min||[...s].length>max)return fail(`${label}长度须为 ${min}–${max} 个字符`);return s;}
export function validateDocument(value:unknown):MapDocument{
 const root=obj(value,['format','version','map'],'地图文件');if(root.format!=='blackroom-map'||root.version!==1)fail('不支持的地图格式或版本');
 const m=obj(root.map,['name','subtitle','platforms','spawns'],'地图');
 const name=text(m.name,1,40,'地图名称'),subtitle=text(m.subtitle,0,120,'地图描述');
 if(!Array.isArray(m.platforms)||m.platforms.length<1||m.platforms.length>64)fail('平台数量须为 1–64');
 if(!Array.isArray(m.spawns)||m.spawns.length!==8)fail('必须设置 8 个出生点');
 const platforms=(m.platforms as unknown[]).map((value,i)=>{const label=`平台 ${i+1}`,p=obj(value,['x','y','width','height','angle'],label);const result={x:num(p.x,0,1200,label+' X'),y:num(p.y,0,800,label+' Y'),width:num(p.width,20,1200,label+'宽度'),height:num(p.height,10,400,label+'高度'),angle:num(p.angle,-Math.PI,Math.PI,label+'角度')};if(platformCorners(result).some(p=>p.x< -1e-7||p.x>1200+1e-7||p.y< -1e-7||p.y>800+1e-7))fail(label+'超出编辑区域');return result;});
 const spawns=(m.spawns as unknown[]).map((value,i)=>{const label=`出生点 ${i+1}`,p=obj(value,['x','y'],label);const result={x:num(p.x,RADIUS,1200-RADIUS,label+' X'),y:num(p.y,RADIUS,800-RADIUS,label+' Y')};const index=platforms.findIndex(p=>circleIntersectsPlatform(result,RADIUS,p));if(index>=0)fail(`${label}与平台 ${index+1} 相交`);return result;});
 for(let i=0;i<spawns.length;i++)for(let j=i+1;j<spawns.length;j++)if(Math.hypot(spawns[i].x-spawns[j].x,spawns[i].y-spawns[j].y)<RADIUS*2)fail(`出生点 ${i+1} 与 ${j+1} 重叠`);
 const result:MapDocument={format:'blackroom-map',version:1,map:{name,subtitle,platforms,spawns}};if(new TextEncoder().encode(JSON.stringify(result)).length>MAX_MAP_BYTES)fail('地图超过 32 KiB');return result;
}
export function parseMapFile(source:string):MapDocument{if(new TextEncoder().encode(source).length>MAX_MAP_BYTES)fail('地图文件超过 32 KiB');let value:unknown;try{value=JSON.parse(source);}catch{fail('文件不是有效 JSON');}return validateDocument(value);}
export function toDocument(m:MapDefinition):MapDocument{return {format:'blackroom-map',version:1,map:{name:m.name,subtitle:m.subtitle,platforms:structuredClone(m.platforms),spawns:structuredClone(m.spawns)}};}
export function toDefinition(document:MapDocument,id='custom'):MapDefinition{return {id,...validateDocument(document).map,bounds:{left:-100,right:1300,top:-400,bottom:900}};}
