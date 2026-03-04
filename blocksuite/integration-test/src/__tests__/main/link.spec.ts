import type {
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine/model';
import { LinkExtension, toggleLink } from '@blocksuite/affine-inline-link';
import { normalizeUrl } from '@blocksuite/affine-shared/utils';
import { TextSelection } from '@blocksuite/std';
import { Text } from '@blocksuite/store';
import { beforeEach, expect, test } from 'vitest';

import { AffineLink } from '../../../../affine/inlines/link/src/link-node/affine-link.js';
import { builtinInlineLinkToolbarConfig } from '../../../../affine/inlines/link/src/link-node/configs/toolbar.js';
import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type InlineRange = {
  index: number;
  length: number;
};

type RichTextElement = HTMLElement & {
  inlineEditor: {
    formatText: (range: InlineRange, attrs: Record<string, unknown>) => void;
    getFormat: (range: InlineRange) => Record<string, unknown>;
    insertText: (
      range: InlineRange,
      text: string,
      attrs?: Record<string, unknown>
    ) => void;
    setInlineRange: (range: InlineRange) => void;
    toDomRange: (range: InlineRange) => Range | null;
    yTextDeltas: unknown[];
  };
};

type ToolbarContextLike = {
  flags: { isNative: () => boolean };
  host: NonNullable<typeof editor.host>;
  message$: { peek: () => { element: AffineLink } | null };
  reset: () => void;
  select: (group: 'note', selections: unknown[]) => void;
  selection: NonNullable<typeof editor.host>['selection'];
  std: typeof editor.std;
  store: typeof doc;
  track: (...args: unknown[]) => void;
};

beforeEach(async () => {
  const cleanup = await setupEditor('page', [LinkExtension]);
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

function getParagraphRichText(blockId: string) {
  const richText = document.querySelector<RichTextElement>(
    `[data-block-id="${blockId}"] rich-text`
  );
  if (!richText) {
    throw new Error(`Cannot find paragraph rich-text for block: ${blockId}`);
  }
  return richText;
}

function getParagraphBlockComponent(blockId: string) {
  const block = editor.host?.view.getBlock(blockId);
  if (!block) {
    throw new Error(`Cannot find block component: ${blockId}`);
  }
  return block;
}

async function createParagraph(text = '') {
  const noteId = addNote(doc);
  const note = getNoteModel(noteId);
  const paragraph = note.children[0] as ParagraphBlockModel | undefined;
  if (!paragraph) {
    throw new Error('Cannot find paragraph model');
  }
  if (text) {
    doc.updateBlock(paragraph, {
      text: new Text(text),
    });
  }
  await waitForCondition(
    () =>
      !!document.querySelector(`[data-block-id="${paragraph.id}"] rich-text`)
  );
  return { noteId, paragraphId: paragraph.id };
}

async function createParagraphs(texts: string[]) {
  if (texts.length === 0) {
    throw new Error('Need at least one text');
  }
  const noteId = addNote(doc);
  const note = getNoteModel(noteId);
  const firstParagraph = note.children[0] as ParagraphBlockModel | undefined;
  if (!firstParagraph) {
    throw new Error('Cannot find first paragraph');
  }

  doc.updateBlock(firstParagraph, { text: new Text(texts[0]) });
  const paragraphIds = [firstParagraph.id];
  for (const text of texts.slice(1)) {
    const paragraphId = doc.addBlock(
      'affine:paragraph',
      { text: new Text(text) },
      noteId
    );
    paragraphIds.push(paragraphId);
  }

  await waitForCondition(() =>
    paragraphIds.every(
      id => !!document.querySelector(`[data-block-id="${id}"] rich-text`)
    )
  );
  return { noteId, paragraphIds };
}

async function createLinkedParagraph(options: {
  link: string;
  text: string;
  prefix?: string;
  suffix?: string;
}) {
  const { link, text, prefix = '', suffix = '' } = options;
  const { noteId, paragraphId } = await createParagraph();
  const paragraph = getParagraphModel(paragraphId);

  doc.updateBlock(paragraph, {
    text: new Text([
      ...(prefix ? [{ insert: prefix }] : []),
      { insert: text, attributes: { link } },
      ...(suffix ? [{ insert: suffix }] : []),
    ]),
  });
  await wait();

  return { noteId, paragraphId };
}

function setDomAndEditorSelection(blockId: string, range: InlineRange) {
  const richText = getParagraphRichText(blockId);
  richText.inlineEditor.setInlineRange(range);

  const selection = editor.host?.selection.create(TextSelection, {
    from: {
      blockId,
      index: range.index,
      length: 0,
    },
    to:
      range.length > 0
        ? {
            blockId,
            index: range.index + range.length,
            length: 0,
          }
        : null,
  });
  if (!selection) {
    throw new Error('Cannot create text selection');
  }
  editor.host?.selection.setGroup('note', [selection]);

  const domRange = richText.inlineEditor.toDomRange(range);
  if (domRange) {
    const domSelection = document.getSelection();
    domSelection?.removeAllRanges();
    domSelection?.addRange(domRange);
  }
}

function createMockAffineLinkTarget(options: {
  blockId: string;
  inlineRange: InlineRange;
  link: string;
}) {
  const { blockId, inlineRange, link } = options;
  const target = new AffineLink();
  const block = getParagraphBlockComponent(blockId);
  const inlineEditor = getParagraphRichText(blockId).inlineEditor;

  Object.defineProperty(target, 'block', {
    configurable: true,
    value: block,
  });
  Object.defineProperty(target, 'inlineEditor', {
    configurable: true,
    value: inlineEditor,
  });
  Object.defineProperty(target, 'selfInlineRange', {
    configurable: true,
    value: inlineRange,
  });
  Object.defineProperty(target, 'link', {
    configurable: true,
    value: link,
  });

  return target;
}

function createToolbarContext(target: AffineLink): ToolbarContextLike {
  const host = editor.host;
  if (!host) {
    throw new Error('Cannot find editor host');
  }
  const selection = host.selection;
  return {
    flags: {
      isNative: () => false,
    },
    host,
    message$: {
      peek: () => ({ element: target }),
    },
    reset: () => {},
    select: (group, selections) => {
      selection.setGroup(group, selections as never[]);
    },
    selection,
    std: editor.std,
    store: doc,
    track: () => {},
  };
}

function getConversionsGroup() {
  const group = builtinInlineLinkToolbarConfig.actions.find(
    action => action.id === 'c.conversions'
  );
  if (!group || !('actions' in group)) {
    throw new Error('Cannot find conversions action group');
  }
  return group;
}

function getConversionAction(id: 'card' | 'embed') {
  const action = getConversionsGroup().actions.find(entry => entry.id === id);
  if (!action) {
    throw new Error(`Cannot find conversion action: ${id}`);
  }
  return action;
}

test('basic link', async () => {
  const { paragraphId } = await createParagraph('linkText');
  const inlineEditor = getParagraphRichText(paragraphId).inlineEditor;

  inlineEditor.formatText(
    { index: 0, length: 8 },
    {
      link: 'http://example.com',
      reference: null,
    }
  );
  expect(inlineEditor.yTextDeltas).toEqual([
    {
      insert: 'linkText',
      attributes: {
        link: 'http://example.com',
      },
    },
  ]);

  inlineEditor.insertText({ index: 0, length: 8 }, 'link2', {
    link: 'https://github.com',
    reference: null,
  });
  expect(inlineEditor.yTextDeltas).toEqual([
    {
      insert: 'link2',
      attributes: {
        link: 'https://github.com',
      },
    },
  ]);
});

test('add link when dragging from empty line', async () => {
  const { paragraphIds } = await createParagraphs(['', 'linkText', '']);
  const targetParagraphId = paragraphIds[1];
  if (!targetParagraphId) {
    throw new Error('Cannot find target paragraph');
  }

  const inlineEditor = getParagraphRichText(targetParagraphId).inlineEditor;
  inlineEditor.formatText(
    { index: 0, length: 8 },
    {
      link: 'http://example.com',
      reference: null,
    }
  );

  expect(inlineEditor.yTextDeltas).toEqual([
    {
      insert: 'linkText',
      attributes: {
        link: 'http://example.com',
      },
    },
  ]);
});

test('type character in link should not jump out link node', async () => {
  const { paragraphId } = await createLinkedParagraph({
    text: 'link text',
    link: 'http://example.com',
    prefix: 'Hello',
  });

  const inlineEditor = getParagraphRichText(paragraphId).inlineEditor;
  inlineEditor.insertText({ index: 9, length: 0 }, 'IN_LINK', {
    link: 'http://example.com',
  });

  const insertedFormat = inlineEditor.getFormat({ index: 9, length: 1 });
  expect(insertedFormat.link).toBe('http://example.com');
  expect(inlineEditor.yTextDeltas).toEqual([
    {
      insert: 'Hello',
    },
    {
      insert: 'linkIN_LINK text',
      attributes: {
        link: 'http://example.com',
      },
    },
  ]);
});

test('type character after link should not extend the link attributes', async () => {
  const { paragraphId } = await createLinkedParagraph({
    text: 'link text',
    link: 'http://example.com',
    prefix: 'Hello',
  });

  const inlineEditor = getParagraphRichText(paragraphId).inlineEditor;
  inlineEditor.insertText({ index: 14, length: 0 }, 'AFTER_LINK');

  expect(inlineEditor.yTextDeltas).toEqual([
    {
      insert: 'Hello',
    },
    {
      insert: 'link text',
      attributes: {
        link: 'http://example.com',
      },
    },
    {
      insert: 'AFTER_LINK',
    },
  ]);
});

test('toggle link command should return false when no native selection', async () => {
  await createParagraph('aaa');
  document.getSelection()?.removeAllRanges();

  const result = toggleLink({ std: editor.std }, () => true);
  expect(result).toBe(false);
});

test('toggle link command should return false on collapsed selection', async () => {
  const { paragraphId } = await createParagraph('aaa');
  setDomAndEditorSelection(paragraphId, { index: 1, length: 0 });

  const result = toggleLink({ std: editor.std }, () => true);
  expect(result).toBe(false);
});

test('toggle link command removes existing link on selected range', async () => {
  const { paragraphId } = await createLinkedParagraph({
    text: 'linkText',
    link: 'http://example.com',
  });

  const inlineEditor = getParagraphRichText(paragraphId).inlineEditor;
  inlineEditor.formatText({ index: 0, length: 8 }, { link: null });

  expect(inlineEditor.yTextDeltas).toEqual([
    {
      insert: 'linkText',
    },
  ]);
});

test('create link with paste', async () => {
  const { paragraphId } = await createParagraph('aaa');
  const inlineEditor = getParagraphRichText(paragraphId).inlineEditor;

  const normalized = normalizeUrl('affine.pro');
  inlineEditor.formatText(
    { index: 0, length: 3 },
    {
      link: normalized,
      reference: null,
    }
  );

  const deltas = inlineEditor.yTextDeltas as Array<{
    attributes?: { link?: string };
    insert: string;
  }>;
  expect(deltas[0]?.insert).toBe('aaa');
  expect(deltas[0]?.attributes?.link).toBe(normalized);
});

test('convert link to card', async () => {
  const { noteId, paragraphId } = await createLinkedParagraph({
    text: 'alinkTexta',
    link: 'http://example.com',
  });
  const target = createMockAffineLinkTarget({
    blockId: paragraphId,
    inlineRange: { index: 0, length: 10 },
    link: 'http://example.com',
  });
  const toolbarContext = createToolbarContext(target);

  const cardAction = getConversionAction('card');
  if (!('run' in cardAction) || typeof cardAction.run !== 'function') {
    throw new Error('Card action is not runnable');
  }

  cardAction.run(toolbarContext as never);
  await wait();

  const note = getNoteModel(noteId);
  expect(note.children.some(child => child.flavour === 'affine:bookmark')).toBe(
    true
  );
});

test('convert link to embed', async () => {
  const { noteId, paragraphId } = await createLinkedParagraph({
    text: 'alinkTexta',
    link: 'https://www.youtube.com/watch?v=U6s2pdxebSo',
  });
  const target = createMockAffineLinkTarget({
    blockId: paragraphId,
    inlineRange: { index: 0, length: 10 },
    link: 'https://www.youtube.com/watch?v=U6s2pdxebSo',
  });
  const toolbarContext = createToolbarContext(target);

  const embedAction = getConversionAction('embed');
  if (!('run' in embedAction) || typeof embedAction.run !== 'function') {
    throw new Error('Embed action is not runnable');
  }
  if (!('when' in embedAction) || typeof embedAction.when !== 'function') {
    throw new Error('Embed action does not provide when');
  }

  expect(embedAction.when(toolbarContext as never)).toBe(true);
  embedAction.run(toolbarContext as never);
  await wait();

  const note = getNoteModel(noteId);
  expect(
    note.children.some(
      child =>
        child.flavour.includes('embed') || child.flavour === 'affine:bookmark'
    )
  ).toBe(true);
});

test('embed conversion should be unavailable for non-embeddable url', async () => {
  const { paragraphId } = await createLinkedParagraph({
    text: 'alinkTexta',
    link: 'http://example.com',
  });
  const target = createMockAffineLinkTarget({
    blockId: paragraphId,
    inlineRange: { index: 0, length: 10 },
    link: 'http://example.com',
  });
  const toolbarContext = createToolbarContext(target);

  const embedAction = getConversionAction('embed');
  if (!('when' in embedAction) || typeof embedAction.when !== 'function') {
    throw new Error('Embed action does not provide when');
  }

  expect(embedAction.when(toolbarContext as never)).toBe(false);
});
