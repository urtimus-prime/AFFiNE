import { DatabaseBlockDataSource } from '@blocksuite/affine/blocks/database';
import type { DatabaseBlockModel } from '@blocksuite/affine/model';
import type { AffineLinkedDocWidget } from '@blocksuite/affine/widgets/linked-doc';
import { Text } from '@blocksuite/store';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

type RichTextElement = HTMLElement & {
  inlineEditor?: {
    yTextLength: number;
    setInlineRange: (range: { index: number; length: number }) => void;
  };
  updateComplete?: Promise<void>;
};

type TitleCellElement = HTMLElement & {
  selectCurrentCell?: (editing: boolean) => void;
};

const getLinkedDocPopover = () =>
  document.querySelector('.linked-doc-popover') ??
  document.querySelector('affine-linked-doc-popover');

const pressArrow = (key: 'ArrowLeft' | 'ArrowRight') => {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code: key,
      bubbles: true,
      cancelable: true,
    })
  );
  document.dispatchEvent(
    new KeyboardEvent('keyup', {
      key,
      code: key,
      bubbles: true,
      cancelable: true,
    })
  );
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

test('opens linked doc popover from database title cell trigger', async () => {
  const rootId = doc.root?.id;
  if (!rootId) {
    throw new Error('Cannot find root block');
  }

  const noteId = doc.addBlock('affine:note', {}, rootId);
  const databaseId = doc.addBlock(
    'affine:database',
    {
      title: new Text('Database 1'),
    },
    noteId
  );
  const database = doc.getBlock(databaseId)?.model as
    | DatabaseBlockModel
    | undefined;
  if (!database) {
    throw new Error('Cannot find database model');
  }

  const dataSource = new DatabaseBlockDataSource(database);
  dataSource.viewManager.viewAdd('table');
  doc.addBlock(
    'affine:paragraph',
    {
      text: new Text('123'),
    },
    databaseId
  );

  await wait(50);

  const titleCell = document.querySelector<TitleCellElement>(
    'data-view-header-area-text'
  );
  if (!titleCell) {
    throw new Error('Cannot find database title cell');
  }
  titleCell.selectCurrentCell?.(true);
  await wait(50);

  const richText = titleCell.querySelector<RichTextElement>('rich-text');
  if (!richText) {
    throw new Error('Cannot find title cell rich-text');
  }
  await customElements.whenDefined('rich-text');
  await richText.updateComplete;

  let inlineEditor = richText.inlineEditor;
  for (let i = 0; i < 10 && !inlineEditor; i++) {
    await wait(50);
    inlineEditor =
      titleCell.querySelector<RichTextElement>('rich-text')?.inlineEditor;
  }
  if (!inlineEditor) {
    throw new Error('Cannot find inline editor in title cell');
  }

  inlineEditor.setInlineRange({
    index: inlineEditor.yTextLength,
    length: 0,
  });

  const linkedDocWidget = document.querySelector<AffineLinkedDocWidget>(
    'affine-linked-doc-widget'
  );
  if (!linkedDocWidget) {
    throw new Error('Cannot find linked doc widget');
  }

  linkedDocWidget.show({
    inlineEditor: inlineEditor as any,
    primaryTriggerKey: '@',
    addTriggerKey: false,
  });

  await wait(200);

  expect(getLinkedDocPopover()).toBeTruthy();

  pressArrow('ArrowRight');
  await wait(80);
  expect(getLinkedDocPopover()).toBeTruthy();

  pressArrow('ArrowLeft');
  await wait(80);
  expect(getLinkedDocPopover()).toBeTruthy();
});
