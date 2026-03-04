import type {
  DocMode,
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine-model';
import { TextSelection } from '@blocksuite/std';
import { Text } from '@blocksuite/store';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type EditableContainer = HTMLElement & {
  doc: typeof doc;
  mode: DocMode;
  pageSpecs: typeof editor.pageSpecs;
  edgelessSpecs: typeof editor.edgelessSpecs;
  updateComplete: Promise<unknown>;
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

async function createParagraphs(texts: string[]) {
  if (texts.length < 2) {
    throw new Error('Need at least two paragraphs');
  }

  const noteId = addNote(doc);
  const note = doc.getBlock(noteId)?.model as NoteBlockModel | undefined;
  if (!note) {
    throw new Error('Cannot find note model');
  }

  const first = note.children[0] as ParagraphBlockModel | undefined;
  if (!first) {
    throw new Error('Cannot find first paragraph model');
  }
  doc.updateBlock(first, { text: new Text(texts[0]) });

  const paragraphIds = [first.id];
  for (const text of texts.slice(1)) {
    const id = doc.addBlock(
      'affine:paragraph',
      {
        text: new Text(text),
      },
      noteId
    );
    paragraphIds.push(id);
  }

  await wait();
  return paragraphIds;
}

function setCrossBlockSelection(
  from: { blockId: string; index: number },
  to: { blockId: string; index: number }
) {
  const selection = editor.host?.selection.create(TextSelection, {
    from: {
      blockId: from.blockId,
      index: from.index,
      length: 0,
    },
    to: {
      blockId: to.blockId,
      index: to.index,
      length: 0,
    },
  });
  if (!selection) {
    throw new Error('Cannot create cross-block text selection');
  }
  editor.host?.selection.setGroup('note', [selection]);
  editor.std.event.active = true;
}

async function waitForOpenToolbarCountAtMostOne(retries = 20) {
  for (let i = 0; i < retries; i++) {
    const count = document.querySelectorAll(
      'affine-toolbar-widget editor-toolbar[data-open]'
    ).length;
    if (count <= 1) {
      return;
    }
    await wait(50);
  }
  expect(
    document.querySelectorAll('affine-toolbar-widget editor-toolbar[data-open]')
      .length
  ).toBeLessThanOrEqual(1);
}

test('shows only one open format bar when multiple page editors exist', async () => {
  const paragraphIds = await createParagraphs(['123', '456', '789']);

  const anotherEditor = document.createElement(
    'affine-editor-container'
  ) as EditableContainer;
  anotherEditor.doc = doc;
  anotherEditor.mode = 'page';
  anotherEditor.pageSpecs = editor.pageSpecs;
  anotherEditor.edgelessSpecs = editor.edgelessSpecs;
  document.body.append(anotherEditor);
  await anotherEditor.updateComplete;
  await wait(100);

  setCrossBlockSelection(
    { blockId: paragraphIds[0], index: 1 },
    { blockId: paragraphIds[2], index: 2 }
  );
  const textSelection = editor.host?.selection.find(TextSelection);
  expect(textSelection?.isCollapsed()).toBe(false);
  expect(document.querySelectorAll('affine-page-root').length).toBe(2);
  await waitForOpenToolbarCountAtMostOne();

  anotherEditor.remove();
});
