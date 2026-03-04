import {
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  type EmbedSyncedDocModel,
  NoteDisplayMode,
  type NoteProps,
  type ParagraphBlockModel,
  type ParagraphProps,
} from '@blocksuite/affine/model';
import {
  draftSelectedModelsCommand,
  duplicateSelectedModelsCommand,
} from '@blocksuite/affine-shared/commands';
import { REFERENCE_NODE } from '@blocksuite/affine-shared/consts';
import { type AffineTextAttributes } from '@blocksuite/affine-shared/types';
import { createDefaultDoc } from '@blocksuite/affine-shared/utils';
import { Bound } from '@blocksuite/global/gfx';
import type { BlockModel, Store } from '@blocksuite/store';
import { Slice, Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

const waitForCondition = async (condition: () => boolean, retries = 40) => {
  for (let i = 0; i < retries; i++) {
    if (condition()) {
      return;
    }
    await wait(50);
  }
  expect(condition()).toBe(true);
};

const getRootNoteId = () => {
  const rootId = doc.root?.id;
  if (!rootId) {
    throw new Error('Cannot find root block');
  }
  return doc.addBlock('affine:note', {}, rootId);
};

const setFirstParagraphText = (store: Store, text: string) => {
  const paragraph = store.getBlocksByFlavour('affine:paragraph')[0]?.model as
    | ParagraphBlockModel
    | undefined;
  if (!paragraph) {
    throw new Error('Cannot find paragraph model');
  }
  store.updateBlock(paragraph, {
    text: new Text(text),
  });
};

const getSurfaceId = () => {
  const surface = doc.getModelsByFlavour('affine:surface')[0];
  if (!surface) {
    throw new Error('Cannot find surface block');
  }
  return surface.id;
};

const getVisiblePageNote = (store: Store) => {
  return store.getModelsByFlavour('affine:note').find(note => {
    const displayMode = (
      note as unknown as { props?: { displayMode?: NoteDisplayMode } }
    ).props?.displayMode;
    return displayMode !== NoteDisplayMode.EdgelessOnly;
  });
};

const createSurfaceEmbedSyncedDoc = (pageId: string, height: number) => {
  return doc.addBlock(
    'affine:embed-synced-doc',
    {
      pageId,
      xywh: `[0,100,370,${height}]`,
    },
    getSurfaceId()
  );
};

const getEmbedEdgelessElement = (blockId?: string) => {
  if (blockId) {
    const exact = document.querySelector<HTMLElement>(
      `affine-embed-edgeless-synced-doc-block[data-block-id="${blockId}"]`
    );
    if (exact) {
      return exact;
    }
  }
  return document.querySelector<HTMLElement>(
    'affine-embed-edgeless-synced-doc-block'
  );
};

const switchToEdgeless = async () => {
  editor.mode = 'edgeless';
  await wait();
  const edgeless = getDocRootBlock(doc, editor, 'edgeless');
  return edgeless.service;
};

const intersects = (a: Bound, b: Bound) => {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
};

const duplicateAsNote = async (
  syncedDocModel: EmbedSyncedDocModel,
  generateIndex: () => string,
  setSelection: (noteId: string) => void
) => {
  const targetDoc = doc.workspace.getDoc(syncedDocModel.props.pageId);
  const targetStore = targetDoc?.getStore({ readonly: true });
  if (!targetStore) {
    throw new Error('Cannot find target synced doc store');
  }

  const contentModels = targetStore
    .getModelsByFlavour('affine:note')
    .filter(note => {
      const displayMode = (
        note as unknown as { props?: { displayMode?: NoteDisplayMode } }
      ).props?.displayMode;
      return displayMode !== NoteDisplayMode.EdgelessOnly;
    })
    .flatMap(note => note.children) as BlockModel[];

  if (contentModels.length === 0) {
    throw new Error('Cannot find content models for duplication');
  }

  doc.captureSync();

  editor.std.command
    .chain()
    .pipe(draftSelectedModelsCommand, {
      selectedModels: contentModels,
    })
    .pipe(({ std, draftedModels }, next) => {
      (async () => {
        const padding = 20;
        const x =
          syncedDocModel.elementBound.x +
          syncedDocModel.elementBound.w +
          padding;
        const y = syncedDocModel.elementBound.y;

        const children = await draftedModels;
        const noteId = std.store.addBlock(
          'affine:note',
          {
            xywh: new Bound(
              x,
              y,
              DEFAULT_NOTE_WIDTH,
              DEFAULT_NOTE_HEIGHT
            ).serialize(),
            index: generateIndex(),
            displayMode: NoteDisplayMode.EdgelessOnly,
          } satisfies Partial<NoteProps>,
          std.store.root
        );

        std.store.addBlock(
          'affine:paragraph',
          {
            text: new Text<AffineTextAttributes>([
              {
                insert: REFERENCE_NODE,
                attributes: {
                  reference: {
                    type: 'LinkedPage',
                    pageId: syncedDocModel.props.pageId,
                  },
                },
              },
            ]),
          } satisfies Partial<ParagraphProps>,
          noteId
        );

        await std.clipboard.duplicateSlice(
          Slice.fromModels(std.store, children),
          std.store,
          noteId
        );
        setSelection(noteId);
      })().catch(console.error);

      return next();
    })
    .run();
};

describe('embed synced doc in edgeless mode', () => {
  test('new edgeless embed synced doc should respect configured height bounds', async () => {
    const embedSource = createDefaultDoc(collection, {
      id: 'embed-edgeless-height',
      title: 'Page 1',
    });
    setFirstParagraphText(embedSource, '1\n2\n3\n4\n5\n6\n7');

    const smallHeight = 20;
    const smallId = createSurfaceEmbedSyncedDoc(embedSource.id, smallHeight);

    await switchToEdgeless();
    await waitForCondition(() => !!getEmbedEdgelessElement(smallId));

    const smallRect = getEmbedEdgelessElement(smallId)?.getBoundingClientRect();
    if (!smallRect) {
      throw new Error('Cannot find edgeless embed synced doc element');
    }
    expect(smallRect.height).toBeGreaterThanOrEqual(smallHeight);

    const smallModel = doc.getModelById(smallId);
    if (!smallModel) {
      throw new Error('Cannot find small embed model');
    }
    doc.deleteBlock(smallModel);
    await wait();

    const largeHeight = 260;
    const largeId = createSurfaceEmbedSyncedDoc(embedSource.id, largeHeight);
    await waitForCondition(() => !!getEmbedEdgelessElement(largeId));

    const largeRect = getEmbedEdgelessElement(largeId)?.getBoundingClientRect();
    if (!largeRect) {
      throw new Error('Cannot find large edgeless embed synced doc element');
    }
    expect(largeRect.height).toBeLessThanOrEqual(largeHeight);
  });

  test('insert to page should keep edgeless embed and duplicate one to page note', async () => {
    const rootNoteId = getRootNoteId();
    doc.addBlock('affine:paragraph', { text: new Text('Root') }, rootNoteId);

    const embedSource = createDefaultDoc(collection, {
      id: 'embed-edgeless-insert',
      title: 'Page 1',
    });
    setFirstParagraphText(embedSource, 'hello page 1');

    const embedId = createSurfaceEmbedSyncedDoc(embedSource.id, 120);
    const service = await switchToEdgeless();

    const model = doc.getModelById(embedId) as EmbedSyncedDocModel | null;
    if (!model) {
      throw new Error('Cannot find embed synced doc model');
    }

    const lastVisibleNote = getVisiblePageNote(doc);
    if (!lastVisibleNote) {
      throw new Error('Cannot find visible page note');
    }

    service.selection.set({
      elements: [embedId],
      editing: false,
    });
    await wait();

    editor.std.command
      .chain()
      .pipe(duplicateSelectedModelsCommand, {
        selectedModels: [model],
        parentModel: lastVisibleNote,
      })
      .run();
    await wait();

    expect(doc.getModelById(embedId)).not.toBeNull();

    editor.mode = 'page';
    await wait();

    const rootNote = doc.getModelById(rootNoteId) as {
      children: { id: string; flavour: string }[];
    } | null;
    if (!rootNote) {
      throw new Error('Cannot find root note model');
    }

    await waitForCondition(() =>
      rootNote.children.some(
        child => child.flavour === 'affine:embed-synced-doc'
      )
    );

    const inserted = rootNote.children.find(
      child => child.flavour === 'affine:embed-synced-doc'
    );
    expect(inserted).toBeDefined();
  });

  test('duplicate as note should create selected note with linked-page reference and no overlap', async () => {
    const embedSource = createDefaultDoc(collection, {
      id: 'embed-edgeless-duplicate',
      title: 'Page 1',
    });
    setFirstParagraphText(embedSource, 'hello page 1');
    const sourceNoteId = embedSource.getBlocksByFlavour('affine:note')[0]?.id;
    if (!sourceNoteId) {
      throw new Error('Cannot find source note');
    }
    embedSource.addBlock(
      'affine:paragraph',
      { text: new Text('hello note') },
      sourceNoteId
    );

    const embedId = createSurfaceEmbedSyncedDoc(embedSource.id, 120);
    const service = await switchToEdgeless();

    const syncedDocModel = doc.getModelById(
      embedId
    ) as EmbedSyncedDocModel | null;
    if (!syncedDocModel) {
      throw new Error('Cannot find embed synced doc model');
    }

    await duplicateAsNote(
      syncedDocModel,
      () => service.layer.generateIndex(),
      noteId => {
        service.selection.set({
          elements: [noteId],
          editing: false,
        });
      }
    );

    await waitForCondition(
      () =>
        service.selection.selectedIds.length === 1 &&
        service.selection.selectedIds[0] !== embedId
    );
    const duplicatedNoteId = service.selection.selectedIds[0];
    expect(duplicatedNoteId).toBeDefined();
    if (!duplicatedNoteId) {
      throw new Error('Duplicated note id is not found');
    }

    const duplicatedNote = doc.getModelById(duplicatedNoteId) as {
      xywh: string;
      children: { flavour: string; text?: Text }[];
    } | null;
    if (!duplicatedNote) {
      throw new Error('Cannot find duplicated note model');
    }
    expect(duplicatedNote.children.length).toBeGreaterThan(1);

    const referenceParagraph = duplicatedNote.children[0] as
      | { flavour: string; text?: Text<AffineTextAttributes> }
      | undefined;
    if (
      !referenceParagraph ||
      referenceParagraph.flavour !== 'affine:paragraph'
    ) {
      throw new Error('Cannot find reference paragraph in duplicated note');
    }
    const delta = referenceParagraph.text?.toDelta() ?? [];
    expect(delta[0]?.insert).toBe(REFERENCE_NODE);
    expect(delta[0]?.attributes?.reference).toEqual({
      type: 'LinkedPage',
      pageId: embedSource.id,
    });

    const embedBound = Bound.deserialize(syncedDocModel.xywh);
    const noteBound = Bound.deserialize(duplicatedNote.xywh);
    expect(intersects(embedBound, noteBound)).toBe(false);
  });

  test('duplicated note should be above other elements', async () => {
    const embedSource = createDefaultDoc(collection, {
      id: 'embed-edgeless-z-index',
      title: 'Page 1',
    });
    setFirstParagraphText(embedSource, 'hello page 1');

    const service = await switchToEdgeless();
    service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    await wait();

    const embedId = createSurfaceEmbedSyncedDoc(embedSource.id, 120);
    await wait();

    const syncedDocModel = doc.getModelById(
      embedId
    ) as EmbedSyncedDocModel | null;
    if (!syncedDocModel) {
      throw new Error('Cannot find embed synced doc model');
    }

    await duplicateAsNote(
      syncedDocModel,
      () => service.layer.generateIndex(),
      noteId => {
        service.selection.set({
          elements: [noteId],
          editing: false,
        });
      }
    );

    await waitForCondition(
      () =>
        service.selection.selectedIds.length === 1 &&
        service.selection.selectedIds[0] !== embedId
    );
    const duplicatedNoteId = service.selection.selectedIds[0];
    if (!duplicatedNoteId) {
      throw new Error('Duplicated note id is not found');
    }

    const sortedIds = service.edgelessElements.map(element => element.id);
    expect(sortedIds[sortedIds.length - 1]).toBe(duplicatedNoteId);
  });
});
