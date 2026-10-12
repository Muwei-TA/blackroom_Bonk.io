import type {MapDocument} from '../../shared/custom-map';
export type Selection={kind:'platform'|'spawn';index:number}|null;
const copy=(d:MapDocument)=>structuredClone(d);
export class EditorModel{
 draft:MapDocument;selection:Selection=null;
 private past:MapDocument[]=[];private future:MapDocument[]=[];private before:MapDocument|null=null;private saved:string;
 constructor(document:MapDocument){this.draft=copy(document);this.saved=JSON.stringify(this.draft);}
 get dirty(){return JSON.stringify(this.draft)!==this.saved;}
 get canUndo(){return this.past.length>0;}
 get canRedo(){return this.future.length>0;}
 begin(){if(!this.before)this.before=copy(this.draft);}
 commit(){if(!this.before)return;if(JSON.stringify(this.before)!==JSON.stringify(this.draft)){this.past.push(this.before);if(this.past.length>50)this.past.shift();this.future=[];}this.before=null;}
 edit(fn:(d:MapDocument)=>void){this.begin();fn(this.draft);this.commit();}
 undo(){this.commit();const d=this.past.pop();if(d){this.future.push(copy(this.draft));this.draft=d;this.selection=null;}}
 redo(){const d=this.future.pop();if(d){this.past.push(copy(this.draft));this.draft=d;this.selection=null;}}
 markSaved(){this.saved=JSON.stringify(this.draft);}
 load(d:MapDocument){this.draft=copy(d);this.past=[];this.future=[];this.before=null;this.selection=null;this.markSaved();}
}
