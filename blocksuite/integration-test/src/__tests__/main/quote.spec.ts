import type {
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine/model';
import { TextSelection } from '@blocksuite/std';
import type {
  InlineEditor,
  InlineMarkdownMatch,
  InlineRange,
} from '@blocksuite/std/inline';
import { Text } from '@blocksuite/store';
import { beforeEach, expect, test } from 'vitest';
import type { UndoManager } from 'yjs';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type RichTextElement = HTMLElement & {
  inlineEditor: InlineEditor;
  markdownMatches: InlineMarkdownMatch[];
  undoManager: UndoManager;
};

type ParagraphSeed = {
  text: string;
  type?: string;
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

async function waitForCondition(condition: () => boolean, retries = 40) {
  for (let i = 0; i < retries; i++) {
    if (condition()) {
      return;
    }
    await wait(30);
  }
  expect(condition()).toBe(true);
}

function getNoteModel(noteId: string) {
  const note = doc.getBlock(noteId)?.model as NoteBlockModel | undefined;
  if (!note) {
    throw new Error(`Cannot find note model: ${noteId}`);
  }
  return note;
}

function getParagraphModel(blockId: string) {
  const paragraph = doc.getBlock(blockId)?.model as
    | ParagraphBlockModel
    | undefined;
  if (!paragraph) {
    throw new Error(`Cannot find paragraph model: ${blockId}`);
  }
  return paragraph;
}

function getRichTextByBlockId(blockId: string) {
  const richText = document.querySelector<RichTextElement>(
    `[data-block-id="${blockId}"] rich-text`
  );
  if (!richText) {
    throw new Error(`Cannot find rich-text for block: ${blockId}`);
  }
  return richText;
}

async function createParagraphs(seeds: ParagraphSeed[]) {
  if (seeds.length === 0) {
    throw new Error('Need at least one paragraph');
  }

  const noteId = addNote(doc);
  const note = getNoteModel(noteId);
  const first = note.children[0] as ParagraphBlockModel | undefined;
  if (!first) {
    throw new Error('Cannot find first paragraph');
  }

  const firstSeed = seeds[0];
  doc.updateBlock(first, {
    text: new Text(firstSeed.text),
    ...(firstSeed.type ? { type: firstSeed.type } : {}),
  });
  const paragraphIds = [first.id];

  for (const seed of seeds.slice(1)) {
    const paragraphId = doc.addBlock(
      'affine:paragraph',
      {
        text: new Text(seed.text),
        ...(seed.type ? { type: seed.type } : {}),
      },
      noteId
    );
    paragraphIds.push(paragraphId);
  }

  await waitForCondition(() =>
    paragraphIds.every(
      id => !!document.querySelector(`[data-block-id="${id}"] rich-text`)
    )
  );
  return {
    noteId,
    paragraphIds,
  };
}

async function setTextSelection(blockId: string, index: number, length = 0) {
  const selection = editor.host?.selection.create(TextSelection, {
    from: {
      blockId,
      index,
      length: 0,
    },
    to:
      length > 0
        ? {
            blockId,
            index: index + length,
            length: 0,
          }
        : null,
  });
  if (!selection) {
    throw new Error('Cannot create text selection');
  }
  editor.host?.selection.setGroup('note', [selection]);
  editor.std.event.active = true;

  const richText = getRichTextByBlockId(blockId);
  await richText.inlineEditor.waitForUpdate();
  richText.inlineEditor.focusIndex(index);
  richText.inlineEditor.setInlineRange({ index, length });
  richText.inlineEditor.syncInlineRange({ index, length });
  await richText.inlineEditor.waitForUpdate();
}

test('prohibit creating divider within quote', async () => {
  const { paragraphIds } = await createParagraphs([
    { text: '123\n--- ', type: 'quote' },
  ]);
  const quoteId = paragraphIds[0];
  if (!quoteId) {
    throw new Error('Cannot find quote paragraph');
  }

  const richText = getRichTextByBlockId(quoteId);
  const dividerMatcher = richText.markdownMatches.find(
    matcher => matcher.name === 'divider'
  );
  if (!dividerMatcher) {
    throw new Error('Cannot find divider markdown matcher');
  }

  const inlineRange: InlineRange = {
    index: richText.inlineEditor.yTextString.length,
    length: 0,
  };
  await setTextSelection(quoteId, inlineRange.index, 0);
  dividerMatcher.action({
    inlineEditor: richText.inlineEditor,
    prefixText: '--- ',
    inlineRange,
    pattern: dividerMatcher.pattern,
    undoManager: richText.undoManager,
  });
  await wait();

  expect(doc.getBlocksByFlavour('affine:divider')).toHaveLength(0);
  expect(getParagraphModel(quoteId).props.type).toBe('quote');
  expect(getParagraphModel(quoteId).props.text.toString()).toContain('--- ');
});

test('quote arrow up/down', async () => {
  const { paragraphIds } = await createParagraphs([
    { text: 'aaaaaaaaa\naaa\naaaaaaaaa', type: 'quote' },
  ]);
  const quoteId = paragraphIds[0];
  if (!quoteId) {
    throw new Error('Cannot find quote paragraph');
  }

  const richText = getRichTextByBlockId(quoteId);
  await richText.inlineEditor.waitForUpdate();
  const quoteTextLength = getParagraphModel(quoteId).props.text.length;

  expect(richText.inlineEditor.isFirstLine({ index: 0, length: 0 })).toBe(true);
  expect(richText.inlineEditor.isLastLine({ index: 0, length: 0 })).toBe(false);

  expect(
    richText.inlineEditor.isFirstLine({ index: quoteTextLength, length: 0 })
  ).toBe(false);
  expect(
    richText.inlineEditor.isLastLine({ index: quoteTextLength, length: 0 })
  ).toBe(true);
});
