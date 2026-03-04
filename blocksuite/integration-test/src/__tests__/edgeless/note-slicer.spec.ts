import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { EdgelessLegacySlotIdentifier } from '@blocksuite/affine/blocks/surface';
import type {
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine-model';
import { Point } from '@blocksuite/global/gfx';
import { Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('note slicer', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const waitForCondition = async (condition: () => boolean, retries = 40) => {
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

  const createNoteWithParagraphs = (texts: string[]) => {
    if (texts.length < 2) {
      throw new Error('Need at least two paragraphs');
    }

    const noteId = addNote(doc);
    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find created note model');
    }

    const firstParagraph = note.children[0] as ParagraphBlockModel | undefined;
    if (!firstParagraph) {
      throw new Error('Cannot find first paragraph');
    }
    doc.updateBlock(firstParagraph, {
      text: new Text(texts[0]),
    });

    for (const text of texts.slice(1)) {
      doc.addBlock(
        'affine:paragraph',
        {
          text: new Text(text),
        },
        noteId
      );
    }

    return noteId;
  };

  const selectNote = (noteId: string) => {
    service.selection.set({
      elements: [noteId],
      editing: false,
    });
  };

  const getSlicerElement = () => {
    const slicer = document.querySelector<HTMLElement>('note-slicer');
    if (!slicer) {
      throw new Error('Cannot find note-slicer widget element');
    }
    return slicer as HTMLElement & {
      _activeSlicerIndex: number;
      _anchorNote: NoteBlockModel | null;
      _divingLinePositions: Point[];
      _enableNoteSlicer: boolean;
      _sliceNote: () => void;
      _updateActiveSlicerIndex: (pos: Point) => void;
      _updateDivingLineAndBlockIds: () => void;
      _updateSlicedNote: () => void;
    };
  };

  const toggleSlicer = () => {
    edgeless.std.get(EdgelessLegacySlotIdentifier).toggleNoteSlicer.next();
  };

  const getChildBlockRects = (noteId: string) => {
    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find note model');
    }
    if (note.children.length < 3) {
      throw new Error('Need at least three child blocks');
    }

    return note.children.map(child => {
      const blockElement = document.querySelector<HTMLElement>(
        `[data-block-id="${child.id}"]`
      );
      if (!blockElement) {
        throw new Error(`Cannot find rendered block: ${child.id}`);
      }
      return blockElement.getBoundingClientRect();
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
    await waitForCondition(() => !!document.querySelector('note-slicer'));

    return cleanup;
  });

  test('could enable and disable note slicer', async () => {
    const noteId = createNoteWithParagraphs([
      '123',
      '456',
      '789',
      'abc',
      'def',
      'ghi',
    ]);
    selectNote(noteId);
    await wait();
    const slicer = getSlicerElement();
    slicer._updateSlicedNote();
    slicer._updateDivingLineAndBlockIds();

    expect(slicer._enableNoteSlicer).toBe(false);
    expect(slicer._divingLinePositions.length).toBe(5);

    toggleSlicer();
    await wait();
    expect(slicer._enableNoteSlicer).toBe(true);

    const [, secondRect] = getChildBlockRects(noteId);
    slicer._updateActiveSlicerIndex(
      new Point(secondRect.left + 1, secondRect.top + secondRect.height / 2)
    );
    expect(slicer._activeSlicerIndex).toBeGreaterThanOrEqual(0);

    toggleSlicer();
    await wait();
    expect(slicer._enableNoteSlicer).toBe(false);
  });

  test('note slicer will add new note', async () => {
    const noteId = createNoteWithParagraphs([
      '123',
      '456',
      '789',
      'abc',
      'def',
      'ghi',
    ]);
    selectNote(noteId);
    await wait();
    const slicer = getSlicerElement();
    slicer._updateSlicedNote();
    slicer._updateDivingLineAndBlockIds();
    expect(getRootNotes().length).toBe(1);
    expect(slicer._divingLinePositions.length).toBe(5);

    toggleSlicer();
    await wait();
    expect(slicer._enableNoteSlicer).toBe(true);

    slicer._activeSlicerIndex = 0;
    slicer._sliceNote();
    await wait();

    expect(getRootNotes().length).toBe(2);
  });

  test('note slicer button should appears at right position', async () => {
    const noteId = createNoteWithParagraphs(['123', '456', '789']);
    selectNote(noteId);
    await wait();
    const slicer = getSlicerElement();
    slicer._updateSlicedNote();
    slicer._updateDivingLineAndBlockIds();

    toggleSlicer();
    await wait();
    expect(slicer._enableNoteSlicer).toBe(true);
    expect(slicer._divingLinePositions.length).toBe(2);

    const [firstRect, secondRect, thirdRect] = getChildBlockRects(noteId);
    const toClientY = (y: number) => y + (service.viewport.top ?? 0);
    slicer._updateActiveSlicerIndex(
      new Point(secondRect.x + 1, secondRect.y + secondRect.height / 2)
    );
    const lineY1 = toClientY(
      slicer._divingLinePositions[slicer._activeSlicerIndex]?.y ?? 0
    );

    expect(lineY1).toBeGreaterThan(firstRect.y + firstRect.height);
    expect(lineY1).toBeGreaterThan(secondRect.y);

    slicer._updateActiveSlicerIndex(
      new Point(thirdRect.x + 1, thirdRect.y + thirdRect.height / 2)
    );
    const lineY2 = toClientY(
      slicer._divingLinePositions[slicer._activeSlicerIndex]?.y ?? 0
    );
    expect(lineY2).toBeGreaterThan(secondRect.y + secondRect.height);
    expect(lineY2).toBeLessThan(thirdRect.y);
  });

  test('note slicer button should appears at right position when editor is not located at left top corner', async () => {
    const noteId = createNoteWithParagraphs(['123', '456', '789']);
    selectNote(noteId);
    await wait();

    const hostContainer =
      document.querySelector<HTMLElement>('#app') ?? editor.parentElement;
    if (!hostContainer) {
      throw new Error('Cannot find editor host container');
    }

    const spacer = document.createElement('div');
    spacer.style.height = '100px';
    spacer.style.background = 'red';
    document.body.insertBefore(spacer, hostContainer);
    hostContainer.style.paddingLeft = '80px';

    try {
      await wait();

      const slicer = getSlicerElement();
      slicer._updateSlicedNote();
      slicer._updateDivingLineAndBlockIds();

      toggleSlicer();
      await wait();
      expect(slicer._enableNoteSlicer).toBe(true);
      expect(slicer._divingLinePositions.length).toBe(2);

      const [firstRect, secondRect] = getChildBlockRects(noteId);
      const toClientY = (y: number) => y + (service.viewport.top ?? 0);
      slicer._updateActiveSlicerIndex(
        new Point(secondRect.x + 1, secondRect.y + secondRect.height / 2)
      );
      const lineY = toClientY(
        slicer._divingLinePositions[slicer._activeSlicerIndex]?.y ?? 0
      );
      expect(lineY).toBeGreaterThan(firstRect.y + firstRect.height);
      expect(lineY).toBeGreaterThan(secondRect.y);
    } finally {
      spacer.remove();
      hostContainer.style.paddingLeft = '';
    }
  });
});
