import {
  duplicate,
  EdgelessClipboardController,
  type EdgelessRootBlockComponent,
} from '@blocksuite/affine/blocks/root';
import type {
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine-model';
import { serializeXYWH } from '@blocksuite/global/gfx';
import type { GfxModel } from '@blocksuite/std/gfx';
import { Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type RootElementWithBlobSync = HTMLElement & {
  store?: {
    blobSync?: {
      set: (blob: Blob) => Promise<string>;
    };
  };
};

type ChildSummary = {
  flavour: string;
  text?: string;
};

describe('pasting blocks', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const createImageBlob = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="#4a90e2"/></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  };

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

  const getChildSummaries = (parentId: string): ChildSummary[] => {
    const parent = doc.getModelById(parentId) as {
      children: Array<{
        flavour: string;
        text?: {
          toString: () => string;
        };
        props?: {
          text?: {
            toString: () => string;
          };
        };
      }>;
    } | null;
    if (!parent) {
      throw new Error(`Cannot find model: ${parentId}`);
    }

    return parent.children.map(child => {
      if (child.flavour === 'affine:paragraph') {
        return {
          flavour: child.flavour,
          text: child.text?.toString() ?? '',
        };
      }
      if (child.flavour === 'affine:code') {
        return {
          flavour: child.flavour,
          text: child.props?.text?.toString() ?? '',
        };
      }
      return {
        flavour: child.flavour,
      };
    });
  };

  const createImageSourceId = async () => {
    const root = document.querySelector<RootElementWithBlobSync>(
      'affine-edgeless-root, affine-page-root'
    );
    if (!root?.store?.blobSync) {
      throw new Error('Cannot find blobSync from root block');
    }

    return root.store.blobSync.set(createImageBlob());
  };

  const fillNoteWithMixedContent = async (noteId: string, sourceId: string) => {
    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find note model');
    }
    const firstParagraph = note.children[0] as ParagraphBlockModel | undefined;
    if (!firstParagraph) {
      throw new Error('Cannot find first paragraph in note');
    }

    doc.updateBlock(firstParagraph, {
      text: new Text('hello'),
    });
    doc.addBlock(
      'affine:image',
      {
        sourceId,
      },
      noteId
    );
    doc.addBlock(
      'affine:paragraph',
      {
        text: new Text('world'),
      },
      noteId
    );
    doc.addBlock(
      'affine:code',
      {
        text: new Text('code'),
      },
      noteId
    );

    await wait();
  };

  const createEdgelessTextWithMixedContent = async (sourceId: string) => {
    const surface = doc.getModelsByFlavour('affine:surface')[0];
    if (!surface) {
      throw new Error('Cannot find surface model');
    }

    const edgelessTextId = service.crud.addBlock(
      'affine:edgeless-text',
      {
        xywh: serializeXYWH(130, 140, 400, 160),
      },
      surface.id
    );
    if (!edgelessTextId) {
      throw new Error('Cannot create edgeless-text block');
    }

    doc.addBlock(
      'affine:paragraph',
      {
        text: new Text('hello'),
      },
      edgelessTextId
    );
    doc.addBlock(
      'affine:image',
      {
        sourceId,
      },
      edgelessTextId
    );
    doc.addBlock(
      'affine:paragraph',
      {
        text: new Text('world'),
      },
      edgelessTextId
    );
    doc.addBlock(
      'affine:code',
      {
        text: new Text('code'),
      },
      edgelessTextId
    );

    await wait();
    return edgelessTextId;
  };

  const duplicateModel = async (modelId: string) => {
    const model = doc.getModelById(modelId);
    if (!model) {
      throw new Error(`Cannot find model for duplicate: ${modelId}`);
    }

    await duplicate(edgeless, [model as unknown as GfxModel]);
    await wait();
  };

  const pasteTextAsNote = async (text: string) => {
    const clipboard = edgeless.std.getOptional(EdgelessClipboardController);
    if (!clipboard) {
      throw new Error('Cannot find edgeless clipboard controller');
    }

    await (
      clipboard as unknown as {
        _pasteTextContentAsNote: (content: string) => Promise<void>;
      }
    )._pasteTextContentAsNote(text);
    await wait();
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

  test('pasting a note block', async () => {
    const sourceId = await createImageSourceId();
    const noteId = addNote(doc);
    await fillNoteWithMixedContent(noteId, sourceId);

    const originalSummary = getChildSummaries(noteId);
    expect(originalSummary).toEqual([
      { flavour: 'affine:paragraph', text: 'hello' },
      { flavour: 'affine:image' },
      { flavour: 'affine:paragraph', text: 'world' },
      { flavour: 'affine:code', text: 'code' },
    ]);

    await duplicateModel(noteId);
    await waitForCondition(() => getRootNotes().length === 2);

    const newNote = getRootNotes().find(note => note.id !== noteId);
    if (!newNote) {
      throw new Error('Cannot find duplicated note');
    }

    expect(getChildSummaries(newNote.id)).toEqual(originalSummary);
  });

  test('pasting a edgeless block', async () => {
    const sourceId = await createImageSourceId();
    const edgelessTextId = await createEdgelessTextWithMixedContent(sourceId);
    const originalSummary = getChildSummaries(edgelessTextId);
    expect(originalSummary).toEqual([
      { flavour: 'affine:paragraph', text: 'hello' },
      { flavour: 'affine:image' },
      { flavour: 'affine:paragraph', text: 'world' },
      { flavour: 'affine:code', text: 'code' },
    ]);

    await duplicateModel(edgelessTextId);

    await waitForCondition(
      () => doc.getBlocksByFlavour('affine:edgeless-text').length === 2
    );
    const newEdgelessTextId = doc
      .getBlocksByFlavour('affine:edgeless-text')
      .map(model => model.id)
      .find(id => id !== edgelessTextId);
    if (!newEdgelessTextId) {
      throw new Error('Cannot find duplicated edgeless text block');
    }

    expect(getChildSummaries(newEdgelessTextId)).toEqual(originalSummary);
  });

  test('pasting a note block from doc mode', async () => {
    const noteId = addNote(doc);
    const note = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!note) {
      throw new Error('Cannot find initial note model');
    }
    const firstParagraph = note.children[0] as ParagraphBlockModel | undefined;
    if (!firstParagraph) {
      throw new Error('Cannot find initial note paragraph');
    }
    doc.updateBlock(firstParagraph, {
      text: new Text('hello world'),
    });
    const copiedText = firstParagraph.text?.toString() ?? '';

    editor.mode = 'page';
    await wait();
    editor.mode = 'edgeless';
    await wait();

    await pasteTextAsNote(copiedText);
    await waitForCondition(() => getRootNotes().length === 2);

    const newNote = getRootNotes().find(noteModel => noteModel.id !== noteId);
    if (!newNote) {
      throw new Error('Cannot find pasted note');
    }

    expect(getChildSummaries(newNote.id)[0]).toEqual({
      flavour: 'affine:paragraph',
      text: 'hello world',
    });
  });
});
