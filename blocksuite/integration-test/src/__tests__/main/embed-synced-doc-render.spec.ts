import { DatabaseBlockDataSource } from '@blocksuite/affine/blocks/database';
import type {
  DatabaseBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine/model';
import { createDefaultDoc } from '@blocksuite/affine-shared/utils';
import type { Store } from '@blocksuite/store';
import { Text } from '@blocksuite/store';
import { beforeEach, expect, test } from 'vitest';

import { click, wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

type EditorHostElement = HTMLElement & {
  store?: {
    readonly?: boolean;
  };
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

const getEditorContainer = () => editor.parentElement ?? document.body;

const queryAllInEditor = (selector: string) => {
  return getEditorContainer().querySelectorAll(selector);
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

const getFirstNoteId = (store: Store) => {
  const note = store.getBlocksByFlavour('affine:note')[0];
  if (!note) {
    throw new Error('Cannot find note model');
  }
  return note.id;
};

const waitForCondition = async (condition: () => boolean) => {
  for (let i = 0; i < 30; i++) {
    if (condition()) {
      return;
    }
    await wait(50);
  }
  expect(condition()).toBe(true);
};

test('nested embed synced doc should be rendered as card when depth >=1', async () => {
  const rootNoteId = getRootNoteId();
  doc.addBlock(
    'affine:paragraph',
    {
      text: new Text('Hello from Root'),
    },
    rootNoteId
  );

  const doc2 = createDefaultDoc(collection, {
    id: 'embed-doc-1',
    title: 'Doc 2',
  });
  const doc3 = createDefaultDoc(collection, {
    id: 'embed-doc-2',
    title: 'Doc 3',
  });
  setFirstParagraphText(doc2, 'Hello from Doc 2');
  setFirstParagraphText(doc3, 'Hello from Doc 3');

  const doc2NoteId = getFirstNoteId(doc2);
  doc2.addBlock(
    'affine:embed-synced-doc',
    {
      pageId: doc3.id,
      xywh: '[0, 100, 370, 100]',
    },
    doc2NoteId
  );
  doc.addBlock(
    'affine:embed-synced-doc',
    {
      pageId: doc2.id,
      xywh: '[0, 100, 370, 100]',
    },
    rootNoteId
  );

  await waitForCondition(
    () =>
      queryAllInEditor('affine-embed-synced-doc-block').length === 2 &&
      queryAllInEditor('affine-embed-synced-doc-card').length === 1
  );

  expect(queryAllInEditor('affine-embed-synced-doc-block')).toHaveLength(2);
  expect(queryAllInEditor('affine-paragraph')).toHaveLength(2);
  expect(queryAllInEditor('affine-embed-synced-doc-card')).toHaveLength(1);
  expect(queryAllInEditor('editor-host')).toHaveLength(2);
});

test('synced doc should be readonly', async () => {
  const rootNoteId = getRootNoteId();
  doc.addBlock(
    'affine:paragraph',
    {
      text: new Text('Root'),
    },
    rootNoteId
  );

  const doc2 = createDefaultDoc(collection, {
    id: 'embed-doc-readonly',
    title: 'Doc 2',
  });
  setFirstParagraphText(doc2, 'Hello from Doc 2');
  const doc2NoteId = getFirstNoteId(doc2);
  const databaseId = doc2.addBlock(
    'affine:database',
    {
      title: new Text('Database 1'),
    },
    doc2NoteId
  );
  const database = doc2.getBlock(databaseId)?.model as
    | DatabaseBlockModel
    | undefined;
  if (!database) {
    throw new Error('Cannot find database model');
  }
  const dataSource = new DatabaseBlockDataSource(database);
  dataSource.viewManager.viewAdd('table');

  doc.addBlock(
    'affine:embed-synced-doc',
    {
      pageId: doc2.id,
      xywh: '[0, 100, 370, 120]',
    },
    rootNoteId
  );

  await waitForCondition(
    () =>
      !!getEditorContainer().querySelector(
        'affine-embed-synced-doc-block editor-host'
      )
  );
  const nestedEditorHost =
    getEditorContainer().querySelector<EditorHostElement>(
      'affine-embed-synced-doc-block editor-host'
    );
  expect(nestedEditorHost?.store?.readonly).toBe(true);

  const databaseFirstCell =
    document.querySelector<HTMLElement>(
      '.affine-embed-synced-doc-block .affine-database-column-header'
    ) ??
    nestedEditorHost?.querySelector<HTMLElement>(
      '.affine-database-column-header'
    ) ??
    nestedEditorHost?.shadowRoot?.querySelector<HTMLElement>(
      '.affine-database-column-header'
    );
  if (!databaseFirstCell) {
    throw new Error('Cannot find nested database first cell');
  }
  const rect = databaseFirstCell.getBoundingClientRect();
  click(databaseFirstCell, { x: rect.width / 2, y: rect.height / 2 });

  await waitForCondition(
    () =>
      queryAllInEditor('.affine-embed-synced-doc-container.selected').length ===
      1
  );
  expect(
    queryAllInEditor('.affine-embed-synced-doc-container.selected')
  ).toHaveLength(1);
});
