import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { updateXYWH } from '@blocksuite/affine/blocks/surface';
import {
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  NOTE_MIN_HEIGHT,
  NOTE_MIN_WIDTH,
  type NoteBlockModel,
} from '@blocksuite/affine/model';
import { NoteTool } from '@blocksuite/affine-gfx-note';
import { Bound } from '@blocksuite/global/gfx';
import { Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { drag, wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('note resize', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const waitForCondition = async (condition: () => boolean, retries = 30) => {
    for (let i = 0; i < retries; i++) {
      if (condition()) {
        return;
      }
      await wait(30);
    }
    expect(condition()).toBe(true);
  };

  const getRootNotes = () => {
    return (
      doc.root?.children.filter(
        (child): child is NoteBlockModel => child.flavour === 'affine:note'
      ) ?? []
    );
  };

  const getNote = (noteId: string) => {
    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find note model');
    }
    return note;
  };

  const getNoteBound = (noteId: string) =>
    Bound.deserialize(getNote(noteId).xywh);

  const getNoteElement = (noteId: string) => {
    const element = document.querySelector<HTMLElement>(
      `affine-edgeless-note[data-block-id="${noteId}"]`
    );
    if (!element) {
      throw new Error('Cannot find rendered edgeless note element');
    }
    return element;
  };

  const setNoteText = (noteId: string, text: string) => {
    const note = getNote(noteId);
    const firstParagraph = note.children[0];
    if (!firstParagraph || firstParagraph.flavour !== 'affine:paragraph') {
      throw new Error('Cannot find first paragraph in note');
    }
    doc.updateBlock(firstParagraph, {
      text: new Text(text),
    });
  };

  const resizeNote = (noteId: string, targetBound: Bound) => {
    const note = getNote(noteId);
    updateXYWH(
      note,
      targetBound,
      service.crud.updateElement,
      doc.updateBlock.bind(doc)
    );
  };

  const toggleCollapse = (noteId: string) => {
    const note = getNote(noteId);
    const { collapse, collapsedHeight, scale = 1 } = note.props.edgeless;

    if (collapse) {
      doc.updateBlock(note, () => {
        note.props.edgeless.collapse = false;
      });
      return;
    }

    if (collapsedHeight) {
      const bound = Bound.deserialize(note.xywh);
      bound.h = collapsedHeight * scale;
      doc.updateBlock(note, () => {
        note.props.edgeless.collapse = true;
        note.props.xywh = bound.serialize();
      });
    }
  };

  const toggleAutoSize = (noteId: string) => {
    const note = getNote(noteId);
    doc.captureSync();

    if (note.props.edgeless.collapse) {
      doc.updateBlock(note, () => {
        note.props.edgeless.collapse = false;
      });
      return;
    }

    const { collapsedHeight, scale = 1 } = note.props.edgeless;
    if (collapsedHeight) {
      const bound = Bound.deserialize(note.xywh);
      bound.h = collapsedHeight * scale;
      doc.updateBlock(note, () => {
        note.xywh = bound.serialize();
        note.props.edgeless.collapse = true;
      });
    }
  };

  const createNoteForResize = () => {
    const noteId = addNote(doc);
    setNoteText(noteId, 'hello');
    return noteId;
  };

  const setNoteTool = () => {
    edgeless.gfx.tool.setTool(NoteTool, {
      childFlavour: 'affine:paragraph',
      childType: null,
      tip: 'test note tool',
    });
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(doc, editor, 'edgeless');
    service = edgeless.service;
    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    await wait();

    return cleanup;
  });

  test('resize note in edgeless mode', async () => {
    const noteId = createNoteForResize();
    await wait();

    const initial = getNoteBound(noteId);
    resizeNote(
      noteId,
      new Bound(initial.x - 100, initial.y, initial.w + 100, initial.h)
    );
    await wait();

    const dragged = getNoteBound(noteId);
    expect(dragged.x).toBe(initial.x - 100);
    expect(dragged.y).toBe(initial.y);
    expect(dragged.w).toBe(initial.w + 100);
    expect(dragged.h).toBe(initial.h);

    editor.mode = 'page';
    await wait();
    editor.mode = 'edgeless';
    await wait();

    const persisted = getNoteBound(noteId);
    expect(persisted.serialize()).toBe(dragged.serialize());
  });

  test('resize note then collapse note', async () => {
    const noteId = createNoteForResize();
    await wait();

    const initial = getNoteBound(noteId);
    resizeNote(
      noteId,
      new Bound(initial.x, initial.y, initial.w, initial.h + 100)
    );
    await wait();

    const note = getNote(noteId);
    expect(getNoteBound(noteId).h).toBe(initial.h + 100);
    expect(note.props.edgeless.collapsedHeight).toBe(initial.h + 100);
    expect(note.props.edgeless.collapse).toBe(true);

    toggleCollapse(noteId);
    await wait();
    const collapsedOffHeight =
      getNoteElement(noteId).getBoundingClientRect().height;
    expect(getNote(noteId).props.edgeless.collapse).toBe(false);
    expect(collapsedOffHeight).toBeGreaterThanOrEqual(NOTE_MIN_HEIGHT - 2);
    expect(collapsedOffHeight).toBeLessThan(initial.h + 20);

    toggleCollapse(noteId);
    await wait();
    expect(getNote(noteId).props.edgeless.collapse).toBe(true);
    expect(getNoteBound(noteId).h).toBe(initial.h + 100);

    resizeNote(
      noteId,
      new Bound(initial.x, initial.y, initial.w, initial.h + 100 - 150)
    );
    await wait();
    expect(getNoteBound(noteId).h).toBe(NOTE_MIN_HEIGHT);

    editor.mode = 'page';
    await wait();
    editor.mode = 'edgeless';
    await wait();
    expect(getNoteBound(noteId).h).toBe(NOTE_MIN_HEIGHT);
  });

  test('resize note then auto size and custom size', async () => {
    const noteId = createNoteForResize();
    await wait();

    const initial = getNoteBound(noteId);
    resizeNote(
      noteId,
      new Bound(initial.x, initial.y, initial.w, initial.h + 100)
    );
    await wait();
    const dragged = getNoteBound(noteId);
    expect(dragged.h).toBe(initial.h + 100);

    toggleAutoSize(noteId);
    await wait();
    const autoSizeHeight =
      getNoteElement(noteId).getBoundingClientRect().height;
    expect(getNote(noteId).props.edgeless.collapse).toBe(false);
    expect(autoSizeHeight).toBeGreaterThanOrEqual(NOTE_MIN_HEIGHT - 2);
    expect(autoSizeHeight).toBeLessThan(initial.h + 20);

    toggleAutoSize(noteId);
    await wait();
    expect(getNote(noteId).props.edgeless.collapse).toBe(true);
    expect(getNoteBound(noteId).h).toBe(dragged.h);

    doc.undo();
    await wait();
    expect(getNote(noteId).props.edgeless.collapse).toBe(false);

    doc.redo();
    await wait();
    expect(getNote(noteId).props.edgeless.collapse).toBe(true);
    expect(getNoteBound(noteId).h).toBe(dragged.h);
  });

  test('drag to add customized size note', async () => {
    const firstNoteId = addNote(doc);
    await wait();

    setNoteTool();
    drag(edgeless.host, { x: 300, y: 300 }, { x: 900, y: 600 }, 10);
    await waitForCondition(() => getRootNotes().length === 2);

    const notes = getRootNotes();
    const newNote = notes.find(note => note.id !== firstNoteId);
    if (!newNote) {
      throw new Error('Cannot find new note created by note tool');
    }
    const newBound = Bound.deserialize(newNote.xywh);
    expect(newBound.x).toBe(270);
    expect(newBound.y).toBe(260);
    expect(newBound.w).toBe(600);
    expect(newBound.h).toBe(300);
  });

  test('drag to add customized size note should clamp to min width and min height', async () => {
    const firstNoteId = addNote(doc);
    await wait();

    setNoteTool();
    drag(edgeless.host, { x: 300, y: 300 }, { x: 400, y: 360 }, 10);
    await waitForCondition(() => getRootNotes().length === 2);

    const notes = getRootNotes();
    const newNote = notes.find(note => note.id !== firstNoteId);
    if (!newNote) {
      throw new Error('Cannot find new note created by note tool');
    }
    const newBound = Bound.deserialize(newNote.xywh);
    expect(newBound.x).toBe(270);
    expect(newBound.y).toBe(260);
    expect(newBound.w).toBe(DEFAULT_NOTE_WIDTH);
    expect(newBound.h).toBe(DEFAULT_NOTE_HEIGHT);
    expect(newBound.w).toBeGreaterThanOrEqual(NOTE_MIN_WIDTH);
    expect(newBound.h).toBeGreaterThanOrEqual(NOTE_MIN_HEIGHT);
  });
});
