import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { type NoteBlockModel, NoteDisplayMode } from '@blocksuite/affine/model';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('note mode', () => {
  let service!: EdgelessRootBlockComponent['service'];

  const getRootNotes = () => {
    return (
      doc.root?.children.filter(
        (child): child is NoteBlockModel => child.flavour === 'affine:note'
      ) ?? []
    );
  };

  const getVisibleNoteCount = (mode: 'page' | 'edgeless') => {
    return getRootNotes().filter(note => {
      if (mode === 'page') {
        return note.props.displayMode !== NoteDisplayMode.EdgelessOnly;
      }
      return note.props.displayMode !== NoteDisplayMode.DocOnly;
    }).length;
  };

  const addEdgelessNote = () => {
    if (!doc.root) {
      throw new Error('doc.root is missing');
    }
    const noteId = service.crud.addBlock('affine:note', {}, doc.root.id);
    if (!noteId) {
      throw new Error('Cannot create note in edgeless mode');
    }
    doc.addBlock('affine:paragraph', {}, noteId);
    return noteId;
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(doc, editor, 'edgeless').service;

    return cleanup;
  });

  test('note added in page mode is visible in both modes by default', async () => {
    editor.mode = 'page';
    await wait();

    const noteId = addNote(doc);
    const note = doc.getModelById(noteId) as NoteBlockModel;
    expect(note.props.displayMode).toBe(NoteDisplayMode.DocAndEdgeless);
    expect(getVisibleNoteCount('page')).toBe(1);

    editor.mode = 'edgeless';
    await wait();
    expect(getVisibleNoteCount('edgeless')).toBe(1);
  });

  test('note added in edgeless mode is visible only in edgeless by default', async () => {
    editor.mode = 'page';
    addNote(doc);
    await wait();

    expect(getVisibleNoteCount('page')).toBe(1);

    editor.mode = 'edgeless';
    await wait();

    const noteId = addEdgelessNote();
    const note = doc.getModelById(noteId) as NoteBlockModel;
    expect(note.props.displayMode).toBe(NoteDisplayMode.EdgelessOnly);
    expect(getVisibleNoteCount('edgeless')).toBe(2);

    editor.mode = 'page';
    await wait();
    expect(getVisibleNoteCount('page')).toBe(1);
  });

  test('note can be changed to be visible in both page and edgeless modes', async () => {
    editor.mode = 'page';
    addNote(doc);
    await wait();

    editor.mode = 'edgeless';
    await wait();

    const noteId = addEdgelessNote();
    expect(getVisibleNoteCount('edgeless')).toBe(2);

    service.crud.updateElement(noteId, {
      displayMode: NoteDisplayMode.DocAndEdgeless,
    });
    await wait();
    expect(getVisibleNoteCount('edgeless')).toBe(2);

    editor.mode = 'page';
    await wait();
    expect(getVisibleNoteCount('page')).toBe(2);
  });
});
