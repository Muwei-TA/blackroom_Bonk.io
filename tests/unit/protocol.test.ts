import {describe,it,expect} from 'vitest';
import {parseClientMessage,normalizeRoomCode} from '../../src/shared/protocol';
describe('wire protocol',()=>{
 it('normalizes codes and nicknames',()=>{expect(normalizeRoomCode(' ab23cd ')).toBe('AB23CD');expect(parseClientMessage({type:'create',nickname:'  小球  '})).toEqual({type:'create',nickname:'小球'});});
 it.each([null,{}, {type:'hack'}, {type:'create',nickname:'x',id:'victim'}, {type:'create',nickname:' '.repeat(3)}, {type:'create',nickname:'x'.repeat(21)}, {type:'input',seq:-1,state:{}},{type:'input',seq:0.5,state:{}},{type:'input',seq:1,state:{left:1,right:false,jump:false,heavy:false}},{type:'join',nickname:'x',code:'!!!'}])('rejects malformed message %j',m=>expect(()=>parseClientMessage(m)).toThrow());
 it('accepts exact input shape',()=>{const m={type:'input',seq:1,state:{left:true,right:false,jump:false,heavy:true}};expect(parseClientMessage(m)).toEqual(m);});
});
