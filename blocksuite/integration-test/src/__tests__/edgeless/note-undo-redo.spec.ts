import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import {
  DEFAULT_NOTE_HEIGHT,
  DefaultTheme,
  type NoteBlockModel,
} from '@blocksuite/affine/model';
import { Bound, serializeXYWH } from '@blocksuite/global/gfx';
import { Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('note undo/redo', () => {
  let service!: EdgelessRootBlockComponent['service'];

  const getRootNotes = () => {
    return (
      doc.root?.children.filter(
        (child): child is NoteBlockModel => child.flavour === 'affine:note'
      ) ?? []
    );
  };

  const createEdgelessNote = (
    x: number,
    y: number,
    paragraphTexts: string[] = ['']
  ) => {
    if (!doc.root) {
      throw new Error('doc.root is missing');
    }
    if (!paragraphTexts.length) {
      throw new Error('Need at least one paragraph');
    }

    const noteId = service.crud.addBlock(
      'affine:note',
      {
        xywh: serializeXYWH(x, y, 800, 120),
      },
      doc.root.id
    );
    if (!noteId) {
      throw new Error('Cannot create note block');
    }

    for (const [index, text] of paragraphTexts.entries()) {
      doc.addBlock(
        'affine:paragraph',
        text
          ? {
              text: new Text(text),
            }
          : {},
        noteId,
        index
      );
    }

    return noteId;
  };

  const splitNote = (noteId: string) => {
    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find note to split');
    }
    if (!doc.root) {
      throw new Error('doc.root is missing');
    }
    if (note.children.length < 2) {
      throw new Error('Need at least two child blocks to split');
    }

    const oldBound = Bound.deserialize(note.xywh);
    const parentIndex = note.parent?.children.findIndex(
      child => child === note
    );
    const {
      collapse: _,
      collapsedHeight: __,
      ...restEdgeless
    } = note.props.edgeless;

    const newNoteId = service.crud.addBlock(
      'affine:note',
      {
        background: note.props.background,
        displayMode: note.props.displayMode,
        xywh: serializeXYWH(
          oldBound.x,
          oldBound.y + oldBound.h + 40,
          oldBound.w,
          DEFAULT_NOTE_HEIGHT
        ),
        edgeless: restEdgeless,
      },
      doc.root.id,
      parentIndex !== undefined && parentIndex >= 0
        ? parentIndex + 1
        : undefined
    );
    if (!newNoteId) {
      throw new Error('Cannot create sliced note');
    }

    const newNote = doc.getModelById(newNoteId) as NoteBlockModel | null;
    if (!newNote) {
      throw new Error('Cannot find sliced note model');
    }

    const movedBlocks = note.children.slice(1);
    doc.moveBlocks(movedBlocks, newNote);
    return newNoteId;
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

  test('undo/redo works correctly after clipping-like split operation', async () => {
    const noteId = createEdgelessNote(0, 0, [
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
    ]);
    await wait();
    expect(getRootNotes().length).toBe(1);

    doc.captureSync();
    splitNote(noteId);
    await wait();
    expect(getRootNotes().length).toBe(2);

    doc.undo();
    await wait();
    expect(getRootNotes().length).toBe(1);

    doc.redo();
    await wait();
    expect(getRootNotes().length).toBe(2);
  });

  test('undo/redo works correctly after resizing note width', async () => {
    const noteId = createEdgelessNote(0, 0, ['hello']);
    await wait();

    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find note');
    }
    const initial = Bound.deserialize(note.xywh);

    doc.captureSync();
    service.crud.updateElement(noteId, {
      xywh: serializeXYWH(initial.x, initial.y, initial.w + 100, initial.h),
    });
    await wait();

    const resized = Bound.deserialize(note.xywh);
    expect(resized.w).toBe(initial.w + 100);
    expect(resized.h).toBe(initial.h);

    doc.undo();
    await wait();
    const afterUndo = Bound.deserialize(note.xywh);
    expect(afterUndo.w).toBe(initial.w);
    expect(afterUndo.h).toBe(initial.h);

    doc.redo();
    await wait();
    const afterRedo = Bound.deserialize(note.xywh);
    expect(afterRedo.w).toBe(resized.w);
    expect(afterRedo.h).toBe(resized.h);
  });

  test('continuous undo and redo works for note add operations', async () => {
    createEdgelessNote(0, 0, ['hello']);
    doc.captureSync();
    await wait();
    expect(getRootNotes().length).toBe(1);

    createEdgelessNote(100, 100, ['n2']);
    doc.captureSync();
    createEdgelessNote(200, 200, ['n3']);
    doc.captureSync();
    createEdgelessNote(300, 300, ['n4']);
    doc.captureSync();
    await wait();
    expect(getRootNotes().length).toBe(4);

    doc.undo();
    await wait();
    expect(getRootNotes().length).toBe(3);

    doc.undo();
    await wait();
    expect(getRootNotes().length).toBe(2);

    doc.redo();
    await wait();
    expect(getRootNotes().length).toBe(3);

    doc.redo();
    await wait();
    expect(getRootNotes().length).toBe(4);
  });

  test('undo/redo works when changing note background color', async () => {
    const noteId = createEdgelessNote(0, 0, ['hello']);
    await wait();

    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find note');
    }

    const initialBackground = note.props.background;

    doc.captureSync();
    service.crud.updateElement(noteId, {
      background: DefaultTheme.NoteBackgroundColorMap.Red,
    });
    await wait();
    expect(note.props.background).not.toEqual(initialBackground);

    doc.undo();
    await wait();
    expect(note.props.background).toEqual(initialBackground);

    doc.redo();
    await wait();
    expect(note.props.background).toEqual(
      DefaultTheme.NoteBackgroundColorMap.Red
    );

    doc.captureSync();
    service.crud.updateElement(noteId, {
      background: { normal: '#123456' },
    });
    await wait();
    expect(note.props.background).toEqual({ normal: '#123456' });

    doc.undo();
    await wait();
    expect(note.props.background).toEqual(
      DefaultTheme.NoteBackgroundColorMap.Red
    );

    doc.redo();
    await wait();
    expect(note.props.background).toEqual({ normal: '#123456' });
  });
});
