import {it,expect} from 'vitest';
import {EditorModel} from '../../src/client/editor/model';
import {toDocument} from '../../src/shared/custom-map';
import {MAPS} from '../../src/shared/maps';
it('groups a drag, supports undo/redo and invalidates redo on new edit',()=>{const m=new EditorModel(toDocument(MAPS[0]));m.begin();for(let i=0;i<30;i++)m.draft.map.platforms[0].x=600+i;m.commit();expect(m.canUndo).toBe(true);m.undo();expect(m.draft.map.platforms[0].x).toBe(600);m.redo();expect(m.draft.map.platforms[0].x).toBe(629);m.undo();m.edit(d=>d.map.name='new');expect(m.canRedo).toBe(false);});
it('caps history at 50 and tracks saved document independently',()=>{const m=new EditorModel(toDocument(MAPS[0]));expect(m.dirty).toBe(false);for(let i=0;i<60;i++)m.edit(d=>d.map.name=String(i));for(let i=0;i<50;i++)m.undo();expect(m.draft.map.name).toBe('9');expect(m.canUndo).toBe(false);expect(m.dirty).toBe(true);m.markSaved();expect(m.dirty).toBe(false);});
