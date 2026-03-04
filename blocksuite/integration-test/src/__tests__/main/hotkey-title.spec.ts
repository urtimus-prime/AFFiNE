import type {
  NoteBlockModel,
  ParagraphBlockModel,
  RootBlockModel,
} from '@blocksuite/affine/model';
import { TextSelection } from '@blocksuite/std';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

type InlineRange = {
  index: number;
  length: number;
};

type RichTextElement = HTMLElement & {
  inlineEditor: {
    focusIndex: (index: number) => void;
    yTextString: string;
    getInlineRange: () => InlineRange | null;
    insertText: (inlineRange: InlineRange, text: string) => void;
    setInlineRange: (inlineRange: InlineRange) => void;
    syncInlineRange: (inlineRange?: InlineRange | null) => void;
    waitForUpdate: () => Promise<void>;
  };
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

function getRootModel() {
  const root = doc.root as RootBlockModel | null;
  if (!root) {
    throw new Error('Cannot find root block');
  }
  return root;
}

function initEmptyParagraphState() {
  const noteId = doc.addBlock('affine:note', {}, getRootModel().id);
  const paragraphId = doc.addBlock('affine:paragraph', {}, noteId);
  return { noteId, paragraphId };
}

function getDocTitle() {
  return getRootModel().props.title.toString();
}

function setDocTitle(text: string) {
  const title = getRootModel().props.title;
  title.clear();
  title.insert(text, 0);
}

function getTitleRichText() {
  const richText = document.querySelector<RichTextElement>(
    'doc-title rich-text'
  );
  if (!richText) {
    throw new Error('Cannot find title rich-text');
  }
  return richText;
}

function getDocTitleElement() {
  const docTitle = document.querySelector<HTMLElement>('doc-title');
  if (!docTitle) {
    throw new Error('Cannot find doc-title');
  }
  return docTitle;
}

function getParagraphRichTextByIndex(index: number) {
  const richText = document.querySelectorAll<RichTextElement>(
    'editor-host rich-text'
  )[index];
  if (!richText) {
    throw new Error(`Cannot find paragraph rich-text at index: ${index}`);
  }
  return richText;
}

function getParagraphRichTextByBlockId(blockId: string) {
  const richText = document.querySelector<RichTextElement>(
    `[data-block-id="${blockId}"] rich-text`
  );
  if (!richText) {
    throw new Error(`Cannot find paragraph rich-text for block: ${blockId}`);
  }
  return richText;
}

async function waitForCondition(condition: () => boolean, retries = 30) {
  for (let i = 0; i < retries; i++) {
    if (condition()) {
      return;
    }
    await wait(30);
  }
  expect(condition()).toBe(true);
}

async function syncTitleInlineRange(inlineRange: InlineRange) {
  const titleRichText = getTitleRichText();
  await titleRichText.inlineEditor.waitForUpdate();
  titleRichText.inlineEditor.focusIndex(0);
  titleRichText.inlineEditor.setInlineRange(inlineRange);
  titleRichText.inlineEditor.syncInlineRange(inlineRange);
  await titleRichText.inlineEditor.waitForUpdate();
}

test('cut title text and paste into paragraph', async () => {
  initEmptyParagraphState();
  setDocTitle('hello');
  await wait();

  const titleRichText = getTitleRichText();
  await syncTitleInlineRange({ index: 0, length: 5 });
  const clipboardData = new DataTransfer();
  titleRichText.dispatchEvent(
    new ClipboardEvent('cut', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    })
  );

  await waitForCondition(() => getDocTitle() === '');
  expect(getDocTitle()).toBe('');
  const copiedText = clipboardData.getData('text/plain') || 'hello';

  const paragraphRichText = getParagraphRichTextByIndex(0);
  await paragraphRichText.inlineEditor.waitForUpdate();
  paragraphRichText.inlineEditor.focusIndex(0);
  paragraphRichText.inlineEditor.setInlineRange({ index: 0, length: 0 });
  paragraphRichText.inlineEditor.syncInlineRange({ index: 0, length: 0 });
  await paragraphRichText.inlineEditor.waitForUpdate();
  paragraphRichText.inlineEditor.insertText(
    { index: 0, length: 0 },
    copiedText
  );
  paragraphRichText.inlineEditor.setInlineRange({
    index: copiedText.length,
    length: 0,
  });

  await waitForCondition(
    () => getParagraphRichTextByIndex(0).inlineEditor.yTextString === 'hello'
  );
  expect(getParagraphRichTextByIndex(0).inlineEditor.yTextString).toBe('hello');
});

test('press enter in title moves cursor to new paragraph', async () => {
  const { noteId } = initEmptyParagraphState();
  setDocTitle('hello');
  await wait();

  const titleRichText = getTitleRichText();
  await titleRichText.inlineEditor.waitForUpdate();
  const titleInlineRange = { index: getDocTitle().length, length: 0 };
  titleRichText.inlineEditor.setInlineRange(titleInlineRange);
  titleRichText.inlineEditor.syncInlineRange(titleInlineRange);
  await titleRichText.inlineEditor.waitForUpdate();
  const currentTitleInlineRange = titleRichText.inlineEditor.getInlineRange();
  if (!currentTitleInlineRange) {
    throw new Error('Cannot find title inline range');
  }
  expect(currentTitleInlineRange).toEqual(titleInlineRange);

  getDocTitleElement().dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );

  const note = doc.getBlock(noteId)?.model as NoteBlockModel | undefined;
  if (!note) {
    throw new Error('Cannot find note model');
  }
  await waitForCondition(() => note.children.length === 2);

  const firstParagraph = note.children[0] as ParagraphBlockModel | undefined;
  const secondParagraph = note.children[1] as ParagraphBlockModel | undefined;
  if (!firstParagraph || !secondParagraph) {
    throw new Error('Cannot find two paragraphs after pressing Enter in title');
  }
  await waitForCondition(
    () =>
      !!document.querySelector(
        `[data-block-id="${firstParagraph.id}"] rich-text`
      )
  );

  const selection = editor.host?.selection.find(TextSelection);
  expect(selection?.from.blockId).toBe(firstParagraph.id);

  const firstParagraphRichText = getParagraphRichTextByBlockId(
    firstParagraph.id
  );
  firstParagraphRichText.inlineEditor.setInlineRange({ index: 0, length: 0 });
  firstParagraphRichText.inlineEditor.insertText(
    { index: 0, length: 0 },
    'world'
  );
  const firstText = firstParagraph.text;
  const secondText = secondParagraph.text;
  if (!firstText || !secondText) {
    throw new Error('Cannot find paragraph text after pressing Enter in title');
  }

  await waitForCondition(
    () => firstText.toString() === 'world' && secondText.toString() === ''
  );
  expect([firstText.toString(), secondText.toString()]).toEqual(['world', '']);
  expect(getDocTitle()).toBe('hello');
});
