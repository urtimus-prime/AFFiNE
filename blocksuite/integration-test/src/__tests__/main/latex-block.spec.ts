import { insertLatexBlockCommand } from '@blocksuite/affine/blocks/latex';
import type {
  LatexBlockModel,
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine/model';
import type { InlineEditor } from '@blocksuite/std/inline';
import type { BaseTextAttributes } from '@blocksuite/store';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

type RichTextElement = HTMLElement & {
  inlineEditor: InlineEditor<BaseTextAttributes>;
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

function getNoteModel(noteId: string) {
  const note = doc.getBlock(noteId)?.model as NoteBlockModel | undefined;
  if (!note) {
    throw new Error(`Cannot find note model: ${noteId}`);
  }
  return note;
}

function getParagraphModels(noteId: string) {
  return getNoteModel(noteId).children.filter(
    child => child.flavour === 'affine:paragraph'
  ) as ParagraphBlockModel[];
}

function getLatexModels(noteId: string) {
  return getNoteModel(noteId).children.filter(
    child => child.flavour === 'affine:latex'
  ) as LatexBlockModel[];
}

function getParagraphRichText(blockId: string) {
  const richText = document.querySelector<RichTextElement>(
    `[data-block-id="${blockId}"] rich-text`
  );
  if (!richText) {
    throw new Error(`Cannot find paragraph rich-text for block: ${blockId}`);
  }
  return richText;
}

async function waitForCondition(condition: () => boolean, retries = 40) {
  for (let i = 0; i < retries; i++) {
    if (condition()) {
      return;
    }
    await wait(30);
  }
  expect(condition()).toBe(true);
}

async function createEmptyParagraphState() {
  const rootId = doc.root?.id;
  if (!rootId) {
    throw new Error('Cannot find root block');
  }

  const noteId = doc.addBlock('affine:note', {}, rootId);
  const paragraphId = doc.addBlock('affine:paragraph', {}, noteId);

  await waitForCondition(
    () => !!document.querySelector(`[data-block-id="${paragraphId}"] rich-text`)
  );

  return {
    noteId,
    paragraphId,
  };
}

function applyLatexBlockMarkdownShortcut(options: {
  richText: RichTextElement;
  paragraphId: string;
  viaEnter: boolean;
}) {
  const { richText, paragraphId, viaEnter } = options;
  const inlineEditor = richText.inlineEditor;

  if (viaEnter) {
    inlineEditor.insertText({ index: 0, length: 0 }, '$$$$');
    inlineEditor.setInlineRange({ index: 4, length: 0 });

    inlineEditor.insertText({ index: 4, length: 0 }, ' ');
    inlineEditor.setInlineRange({ index: 5, length: 0 });
  } else {
    inlineEditor.insertText({ index: 0, length: 0 }, '$$$$ ');
    inlineEditor.setInlineRange({ index: 5, length: 0 });
  }

  const paragraph = doc.getBlock(paragraphId)?.model as
    | ParagraphBlockModel
    | undefined;
  if (!paragraph) {
    throw new Error(`Cannot find paragraph model: ${paragraphId}`);
  }
  const parent = doc.getParent(paragraph);
  if (!parent) {
    throw new Error(`Cannot find paragraph parent: ${paragraphId}`);
  }
  const index = parent.children.indexOf(paragraph);
  if (index === -1) {
    throw new Error('Cannot find paragraph index in parent');
  }

  inlineEditor.deleteText({
    index: 0,
    length: 5,
  });
  inlineEditor.setInlineRange({
    index: 0,
    length: 0,
  });

  doc.addBlock(
    'affine:latex',
    {
      latex: '',
    },
    parent,
    index + 1
  );
}

test('add latex block using slash menu', async () => {
  const { noteId } = await createEmptyParagraphState();
  const paragraph = getParagraphModels(noteId)[0];
  if (!paragraph) {
    throw new Error('Cannot find paragraph model');
  }

  const [ok, result] = editor.std.command.exec(insertLatexBlockCommand, {
    selectedModels: [paragraph],
    place: 'after',
    removeEmptyLine: true,
  });
  expect(ok).toBe(true);

  const insertedLatexBlockId = result.insertedLatexBlockId;
  if (!insertedLatexBlockId) {
    throw new Error('Cannot get inserted latex block id');
  }

  const latexId = await insertedLatexBlockId;
  const latexModel = doc.getBlock(latexId)?.model as
    | LatexBlockModel
    | undefined;
  if (!latexModel) {
    throw new Error('Cannot find inserted latex block model');
  }

  doc.updateBlock(latexModel, {
    latex: 'aaa',
  });

  await waitForCondition(() => getLatexModels(noteId).length === 1);
  await waitForCondition(() => getParagraphModels(noteId).length === 0);

  expect(getLatexModels(noteId)[0]?.props.latex).toBe('aaa');
  expect(getNoteModel(noteId).children.map(child => child.flavour)).toEqual([
    'affine:latex',
  ]);
});

test('add latex block using markdown shortcut with space', async () => {
  const { noteId, paragraphId } = await createEmptyParagraphState();
  const richText = getParagraphRichText(paragraphId);

  applyLatexBlockMarkdownShortcut({
    richText,
    paragraphId,
    viaEnter: false,
  });

  await waitForCondition(() => getLatexModels(noteId).length === 1);

  const latex = getLatexModels(noteId)[0];
  if (!latex) {
    throw new Error('Cannot find inserted latex block');
  }
  doc.updateBlock(latex, {
    latex: 'aaa',
  });

  await waitForCondition(
    () => getLatexModels(noteId)[0]?.props.latex === 'aaa'
  );

  expect(getParagraphModels(noteId).length).toBe(1);
  expect(getParagraphModels(noteId)[0]?.text?.toString() ?? '').toBe('');
  expect(getNoteModel(noteId).children.map(child => child.flavour)).toEqual([
    'affine:paragraph',
    'affine:latex',
  ]);
});

test('add latex block using markdown shortcut with enter', async () => {
  const { noteId, paragraphId } = await createEmptyParagraphState();
  const richText = getParagraphRichText(paragraphId);

  applyLatexBlockMarkdownShortcut({
    richText,
    paragraphId,
    viaEnter: true,
  });

  await waitForCondition(() => getLatexModels(noteId).length === 1);

  const latex = getLatexModels(noteId)[0];
  if (!latex) {
    throw new Error('Cannot find inserted latex block');
  }
  doc.updateBlock(latex, {
    latex: 'aaa',
  });

  await waitForCondition(
    () => getLatexModels(noteId)[0]?.props.latex === 'aaa'
  );

  expect(getParagraphModels(noteId).length).toBe(1);
  expect(getParagraphModels(noteId)[0]?.text?.toString() ?? '').toBe('');
  expect(getNoteModel(noteId).children.map(child => child.flavour)).toEqual([
    'affine:paragraph',
    'affine:latex',
  ]);
});
