import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import type { NoteBlockModel } from '@blocksuite/affine-model';
import { Bound } from '@blocksuite/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('note scale', () => {
  let service!: EdgelessRootBlockComponent['service'];

  const createNoteInEdgeless = () => {
    const noteId = addNote(doc, {
      xywh: '[100,200,800,100]',
      edgeless: {
        style: {
          borderRadius: 8,
          borderSize: 1,
          borderStyle: 'solid',
          shadowType: '--affine-note-shadow-box',
        },
      },
    });
    return noteId;
  };

  const getNoteModel = (noteId: string) => {
    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find note model');
    }
    return note;
  };

  const getNoteContainer = (noteId: string) => {
    const note = document.querySelector(
      `affine-edgeless-note[data-block-id="${noteId}"]`
    );
    const container = note?.querySelector<HTMLElement>(
      '[data-testid="edgeless-note-container"]'
    );
    if (!container) {
      throw new Error('Cannot find edgeless note container');
    }
    return container;
  };

  const getRenderedScale = (noteId: string) => {
    const style = getNoteContainer(noteId).getAttribute('style');
    if (!style) {
      throw new Error('Style attribute not found');
    }
    const scaleMatch = style.match(/transform:\s*scale\(([\d.]+)\)/);
    if (!scaleMatch) {
      throw new Error('Scale transform not found');
    }
    return Number(scaleMatch[1]);
  };

  const applyScale = (noteId: string, nextScale: number) => {
    const note = getNoteModel(noteId);
    const bounds = Bound.deserialize(note.xywh);
    const currentScale = note.props.edgeless.scale ?? 1;
    const ratio = nextScale / currentScale;
    bounds.w *= ratio;
    bounds.h *= ratio;

    doc.updateBlock(note, () => {
      note.xywh = bounds.serialize();
      note.props.edgeless.scale = nextScale;
    });
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(doc, editor, 'edgeless').service;
    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    await wait();

    return cleanup;
  });

  test('note scale can be changed to 50%', async () => {
    const noteId = createNoteInEdgeless();
    await wait();

    applyScale(noteId, 0.5);
    await wait();

    const note = getNoteModel(noteId);
    expect(note.props.edgeless.scale).toBeCloseTo(0.5, 2);
    expect(getRenderedScale(noteId)).toBeCloseTo(0.5, 2);
  });

  test('note scale update does not drift when applying same value repeatedly', async () => {
    const noteId = createNoteInEdgeless();
    await wait();

    applyScale(noteId, 0.5);
    await wait();
    const firstBounds = Bound.deserialize(getNoteModel(noteId).xywh);

    applyScale(noteId, 0.5);
    await wait();
    const secondBounds = Bound.deserialize(getNoteModel(noteId).xywh);

    expect(secondBounds.w).toBeCloseTo(firstBounds.w, 2);
    expect(secondBounds.h).toBeCloseTo(firstBounds.h, 2);
    expect(getRenderedScale(noteId)).toBeCloseTo(0.5, 2);
  });

  test('note scale can be changed by updating scale value from copied input result', async () => {
    const noteId = createNoteInEdgeless();
    await wait();

    const copiedValue = '50';
    const pastedScale = Number(copiedValue) / 100;
    applyScale(noteId, pastedScale);
    await wait();

    expect(getNoteModel(noteId).props.edgeless.scale).toBeCloseTo(0.5, 2);
    expect(getRenderedScale(noteId)).toBeCloseTo(0.5, 2);
  });

  test('note scale can be increased and enlarge note bounds', async () => {
    const noteId = createNoteInEdgeless();
    await wait();

    const prevBounds = Bound.deserialize(getNoteModel(noteId).xywh);
    applyScale(noteId, 1.5);
    await wait();
    const nextBounds = Bound.deserialize(getNoteModel(noteId).xywh);

    expect(getNoteModel(noteId).props.edgeless.scale ?? 1).toBeGreaterThan(1);
    expect(nextBounds.w).toBeGreaterThan(prevBounds.w);
    expect(nextBounds.h).toBeGreaterThan(prevBounds.h);
    expect(getRenderedScale(noteId)).toBeGreaterThan(1);
  });
});
