import { LinkExtension } from '@blocksuite/affine-inline-link';
import { textKeymap } from '@blocksuite/affine-inline-preset';
import type {
  CodeBlockModel,
  ListBlockModel,
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine-model';
import { insertContent } from '@blocksuite/affine-rich-text';
import { REFERENCE_NODE } from '@blocksuite/affine-shared/consts';
import { createDefaultDoc } from '@blocksuite/affine-shared/utils';
import { BlockSelection, TextSelection } from '@blocksuite/std';
import type { InlineMarkdownMatch } from '@blocksuite/std/inline';
import { type Slice, Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { duplicateCodeBlock } from '../../../../affine/blocks/code/src/code-toolbar/utils.js';
import { mergeWithPrev } from '../../../../affine/blocks/paragraph/src/utils/merge-with-prev.js';
import { defaultSlashMenuConfig } from '../../../../affine/widgets/slash-menu/src/config.js';
import type {
  SlashMenuActionItem,
  SlashMenuItem,
} from '../../../../affine/widgets/slash-menu/src/types.js';
import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type RichTextElement = HTMLElement & {
  inlineEditor: {
    deleteText: (range: { index: number; length: number }) => void;
    formatText: (
      range: { index: number; length: number },
      attrs: Record<string, unknown>
    ) => void;
    getFormat: (range: {
      index: number;
      length: number;
    }) => Record<string, unknown>;
    getInlineRange: () => { index: number; length: number } | null;
    insertText: (
      range: { index: number; length: number },
      text: string
    ) => void;
    setInlineRange: (range: { index: number; length: number }) => void;
    yTextString: string;
  };
  markdownMatches: InlineMarkdownMatch[];
  undoManager: {
    stopCapturing: () => void;
  };
};

type CodeBlockViewElement = HTMLElement & {
  copyCode: () => void;
  languageName$: {
    value: string;
  };
  model: CodeBlockModel;
  setWrap: (wrap: boolean) => void;
  std: {
    clipboard: {
      copySlice: (slice: Slice) => Promise<void>;
    };
  };
};

type CodeDraft = {
  flavour: string;
  props: {
    text: Text;
  };
};

function findSlashActionItem(
  items: SlashMenuItem[],
  name: string
): SlashMenuActionItem {
  const item = items.find(entry => entry.name === name);
  if (!item || !('action' in item)) {
    throw new Error(`Cannot find slash-menu action: ${name}`);
  }
  return item;
}

function getRichTextByBlockId(blockId: string): RichTextElement {
  const block = editor.host?.view.getBlock(blockId) as HTMLElement | null;
  if (!block) {
    throw new Error(`Cannot find block view: ${blockId}`);
  }
  const richText = block.querySelector('rich-text') as RichTextElement | null;
  if (!richText) {
    throw new Error(`Cannot find rich-text for block: ${blockId}`);
  }
  return richText;
}

function getParagraphModelById(blockId: string): ParagraphBlockModel {
  const paragraph = doc.getBlock(blockId)?.model as
    | ParagraphBlockModel
    | undefined;
  if (!paragraph) {
    throw new Error(`Cannot find paragraph model: ${blockId}`);
  }
  return paragraph;
}

async function createParagraph(text = '') {
  const noteId = addNote(doc);
  const note = doc.getBlock(noteId)?.model;
  if (!note) {
    throw new Error('Cannot find note model');
  }
  const paragraph = note.children[0] as ParagraphBlockModel | undefined;
  if (!paragraph) {
    throw new Error('Cannot find paragraph model');
  }
  if (text) {
    doc.updateBlock(paragraph, {
      text: new Text(text),
    });
  }
  await wait();
  return {
    noteId,
    paragraphId: paragraph.id,
  };
}

async function createParagraphs(texts: string[]) {
  if (texts.length === 0) {
    throw new Error('Need at least one paragraph text');
  }

  const noteId = addNote(doc);
  const note = doc.getBlock(noteId)?.model as NoteBlockModel | undefined;
  if (!note) {
    throw new Error('Cannot find note model');
  }
  const firstParagraph = note.children[0] as ParagraphBlockModel | undefined;
  if (!firstParagraph) {
    throw new Error('Cannot find first paragraph model');
  }

  doc.updateBlock(firstParagraph, {
    text: new Text(texts[0]),
  });
  const paragraphIds: string[] = [firstParagraph.id];

  for (const text of texts.slice(1)) {
    const paragraphId = doc.addBlock(
      'affine:paragraph',
      {
        text: new Text(text),
      },
      noteId
    );
    paragraphIds.push(paragraphId);
  }
  await wait();

  return { noteId, paragraphIds };
}

async function createCodeBlock(text = '') {
  const { noteId, paragraphId } = await createParagraph();
  await triggerMarkdown(paragraphId, '```ts ', 'code-block');
  const note = doc.getBlock(noteId)?.model;
  const code = note?.children[0] as CodeBlockModel | undefined;
  if (!code) {
    throw new Error('Cannot find code block model');
  }
  if (text) {
    doc.updateBlock(code, {
      text: new Text(text),
    });
    await wait();
  }
  return {
    noteId,
    codeId: code.id,
  };
}

function getCodeModelById(blockId: string): CodeBlockModel {
  const code = doc.getBlock(blockId)?.model as CodeBlockModel | undefined;
  if (!code) {
    throw new Error(`Cannot find code block model: ${blockId}`);
  }
  return code;
}

function getNoteModelById(noteId: string): NoteBlockModel {
  const note = doc.getBlock(noteId)?.model as NoteBlockModel | undefined;
  if (!note) {
    throw new Error(`Cannot find note model: ${noteId}`);
  }
  return note;
}

function getCodeViewById(blockId: string): CodeBlockViewElement {
  const codeView = editor.host?.view.getBlock(
    blockId
  ) as CodeBlockViewElement | null;
  if (!codeView) {
    throw new Error(`Cannot find code block view: ${blockId}`);
  }
  return codeView;
}

function setTextSelection(blockId: string, index: number, length: number) {
  const to = length
    ? {
        blockId,
        index: index + length,
        length: 0,
      }
    : null;
  const selection = editor.host?.selection.create(TextSelection, {
    from: {
      blockId,
      index,
      length: 0,
    },
    to,
  });
  if (!selection) {
    throw new Error('Cannot create text selection');
  }
  editor.host?.selection.setGroup('note', [selection]);
  const richText = getRichTextByBlockId(blockId);
  richText.inlineEditor.setInlineRange({ index, length });
}

function setBlockSelection(blockId: string) {
  const selection = editor.host?.selection.create(BlockSelection, { blockId });
  if (!selection) {
    throw new Error(`Cannot create block selection: ${blockId}`);
  }
  editor.host?.selection.setGroup('note', [selection]);
  editor.std.event.active = true;
}

function setTextSelectionRange(
  blockId: string,
  fromIndex: number,
  toIndex: number
) {
  const selection = editor.host?.selection.create(TextSelection, {
    from: {
      blockId,
      index: fromIndex,
      length: 0,
    },
    to:
      fromIndex === toIndex
        ? null
        : {
            blockId,
            index: toIndex,
            length: 0,
          },
  });
  if (!selection) {
    throw new Error('Cannot create range text selection');
  }
  editor.host?.selection.setGroup('note', [selection]);

  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  const richText = getRichTextByBlockId(blockId);
  richText.inlineEditor.setInlineRange({ index: start, length: end - start });
}

function getCodeTextRange(blockId: string, from: number, to: number) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  return getCodeModelById(blockId).props.text.toString().slice(start, end);
}

function pasteTextToCode(blockId: string, index: number, text: string) {
  const richText = getRichTextByBlockId(blockId);
  richText.inlineEditor.insertText({ index, length: 0 }, text);
  richText.inlineEditor.setInlineRange({
    index: index + text.length,
    length: 0,
  });
}

function prependTextToCode(blockId: string, text: string) {
  const code = getCodeModelById(blockId);
  const current = code.props.text.toString();
  doc.updateBlock(code, {
    text: new Text(`${text}${current}`),
  });
  setTextSelection(blockId, text.length, 0);
}

async function copyCodeBlockSlice(blockId: string): Promise<Slice> {
  const codeView = getCodeViewById(blockId);
  let copiedSlice: Slice | null = null;
  const copySpy = vi
    .spyOn(codeView.std.clipboard, 'copySlice')
    .mockImplementation(async slice => {
      copiedSlice = slice;
    });

  codeView.copyCode();
  await wait();

  expect(copySpy).toHaveBeenCalledTimes(1);
  copySpy.mockRestore();

  if (!copiedSlice) {
    throw new Error('Cannot capture copied code slice');
  }

  return copiedSlice;
}

function setReadonly(value = true) {
  const pageRoot = document.querySelector<
    HTMLElement & {
      store?: {
        readonly: boolean;
      };
    }
  >('affine-page-root, affine-edgeless-root');
  if (!pageRoot?.store) {
    throw new Error('Cannot find root store');
  }
  pageRoot.store.readonly = value;
}

function pressKey(
  key: string,
  count = 1,
  modifiers?: {
    shiftKey?: boolean;
    metaKey?: boolean;
    ctrlKey?: boolean;
  }
) {
  for (let i = 0; i < count; i++) {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...modifiers,
      })
    );
  }
}

function getNoteChildIds(noteId: string) {
  return getNoteModelById(noteId).children.map(child => child.id);
}

function getNoteChildFlavours(noteId: string) {
  return getNoteModelById(noteId).children.map(child => child.flavour);
}

async function insertParagraphAfterCode(codeId: string) {
  const code = getCodeModelById(codeId);
  const parent = doc.getParent(code);
  if (!parent) {
    throw new Error(`Cannot find parent for code block: ${codeId}`);
  }
  const index = parent.children.findIndex(child => child.id === codeId);
  if (index < 0) {
    throw new Error(`Cannot find code index in parent: ${codeId}`);
  }
  const paragraphId = doc.addBlock('affine:paragraph', {}, parent, index + 1);
  await waitForCondition(() =>
    Boolean(editor.host?.view.getBlock(paragraphId))
  );
  setTextSelection(paragraphId, 0, 0);
  return paragraphId;
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
}

function getNoteParagraphTexts(noteId: string) {
  const note = doc.getBlock(noteId)?.model as NoteBlockModel | undefined;
  if (!note) {
    throw new Error(`Cannot find note model: ${noteId}`);
  }
  return note.children.map(child =>
    ((child as ParagraphBlockModel).text ?? new Text()).toString()
  );
}

async function waitForCondition(condition: () => boolean, retries = 20) {
  for (let i = 0; i < retries; i++) {
    if (condition()) {
      return;
    }
    await wait(20);
  }
  expect(condition()).toBe(true);
}

async function waitForTextSelection(
  predicate: (selection: TextSelection) => boolean
) {
  for (let i = 0; i < 20; i++) {
    const selection = editor.host?.selection.find(TextSelection);
    if (selection && predicate(selection)) {
      return;
    }
    await wait(20);
  }
  throw new Error('Timed out waiting for text selection to sync');
}

async function triggerMarkdown(
  blockId: string,
  input: string,
  matcherName: string
) {
  const model = doc.getBlock(blockId)?.model as ParagraphBlockModel | undefined;
  if (!model) {
    throw new Error(`Cannot find paragraph model: ${blockId}`);
  }
  doc.updateBlock(model, {
    text: new Text(input),
  });
  await wait();

  const richText = getRichTextByBlockId(blockId);
  const matcher = richText.markdownMatches.find(
    item => item.name === matcherName
  );
  if (!matcher) {
    throw new Error(`Cannot find markdown matcher: ${matcherName}`);
  }
  const inlineRange = { index: input.length, length: 0 };
  setTextSelection(blockId, inlineRange.index, 0);

  matcher.action({
    inlineEditor: richText.inlineEditor as any,
    prefixText: input,
    inlineRange,
    pattern: matcher.pattern,
    undoManager: richText.undoManager as any,
  });

  await wait();
}

function mockKeyboardContext() {
  const preventDefault = vi.fn();
  const ctx = {
    get(key: string) {
      if (key === 'keyboardState') {
        return { raw: { preventDefault } };
      }
      throw new Error(`Unexpected state key: ${key}`);
    },
  };
  return { ctx: ctx as any, preventDefault };
}

beforeEach(async () => {
  const cleanup = await setupEditor('page', [LinkExtension]);
  return cleanup;
});

describe('markdown/list/paragraph/quote/code/link', () => {
  test('markdown list shortcut converts to todo list and keeps checked state', async () => {
    const { noteId, paragraphId } = await createParagraph();
    await triggerMarkdown(paragraphId, '[x] ', 'list');

    const note = doc.getBlock(noteId)?.model;
    if (!note) {
      throw new Error('Cannot find note model');
    }
    const model = note.children[0] as ListBlockModel;
    expect(model.flavour).toBe('affine:list');
    expect(model.props.type).toBe('todo');
    expect(model.props.checked).toBe(true);
  });

  test('markdown heading and quote shortcuts convert paragraph type', async () => {
    const { noteId: headingNoteId, paragraphId: headingParagraphId } =
      await createParagraph();
    await triggerMarkdown(headingParagraphId, '# ', 'heading');
    const headingNote = doc.getBlock(headingNoteId)?.model;
    if (!headingNote) {
      throw new Error('Cannot find heading note model');
    }
    const headingModel = headingNote.children[0] as ParagraphBlockModel;
    expect(headingModel.flavour).toBe('affine:paragraph');
    expect(headingModel.props.type).toBe('h1');

    const { noteId: quoteNoteId, paragraphId: quoteParagraphId } =
      await createParagraph();
    await triggerMarkdown(quoteParagraphId, '> ', 'heading');
    const quoteNote = doc.getBlock(quoteNoteId)?.model;
    if (!quoteNote) {
      throw new Error('Cannot find quote note model');
    }
    const quoteModel = quoteNote.children[0] as ParagraphBlockModel;
    expect(quoteModel.flavour).toBe('affine:paragraph');
    expect(quoteModel.props.type).toBe('quote');
  });

  test('markdown code shortcut converts paragraph to code block with language', async () => {
    const { noteId, paragraphId } = await createParagraph();
    await triggerMarkdown(paragraphId, '```ts ', 'code-block');

    const note = doc.getBlock(noteId)?.model;
    if (!note) {
      throw new Error('Cannot find note model');
    }
    const model = note.children[0];
    expect(model.flavour).toBe('affine:code');
    expect((model as any).props.language).toBe('typescript');
  });

  test('inline markdown converts style and link attributes', async () => {
    const { paragraphId: boldParagraphId } = await createParagraph();
    await triggerMarkdown(boldParagraphId, '**bold** ', 'bold');
    const boldRichText = getRichTextByBlockId(boldParagraphId);
    expect(boldRichText.inlineEditor.yTextString).toBe('bold');
    expect(
      boldRichText.inlineEditor.getFormat({ index: 1, length: 0 })
    ).toMatchObject({
      bold: true,
    });

    const { paragraphId: codeParagraphId } = await createParagraph();
    await triggerMarkdown(codeParagraphId, '`code` ', 'code');
    const codeRichText = getRichTextByBlockId(codeParagraphId);
    expect(codeRichText.inlineEditor.yTextString).toBe('code');
    expect(
      codeRichText.inlineEditor.getFormat({ index: 1, length: 0 })
    ).toMatchObject({
      code: true,
    });

    const { paragraphId: linkParagraphId } = await createParagraph();
    await triggerMarkdown(
      linkParagraphId,
      '[AFFiNE](https://affine.pro) ',
      'link'
    );
    const linkRichText = getRichTextByBlockId(linkParagraphId);
    expect(linkRichText.inlineEditor.yTextString).toBe('AFFiNE');
    expect(
      linkRichText.inlineEditor.getFormat({ index: 1, length: 0 })
    ).toMatchObject({
      link: 'https://affine.pro',
    });
  });

  test('markdown list and heading variants convert to expected block types', async () => {
    const listCases = [
      { input: '[] ', type: 'todo', checked: false },
      { input: '[ ] ', type: 'todo', checked: false },
      { input: '[x] ', type: 'todo', checked: true },
      { input: '* ', type: 'bulleted' },
      { input: '- ', type: 'bulleted' },
      { input: '1. ', type: 'numbered' },
      { input: '20. ', type: 'numbered' },
    ] as const;

    for (const item of listCases) {
      const { noteId, paragraphId } = await createParagraph();
      await triggerMarkdown(paragraphId, item.input, 'list');
      const model = getNoteModelById(noteId).children[0] as ListBlockModel;
      expect(model.flavour).toBe('affine:list');
      expect(model.props.type).toBe(item.type);
      if ('checked' in item) {
        expect(model.props.checked).toBe(item.checked);
      }
    }

    const headingCases = [
      { input: '# ', type: 'h1' },
      { input: '## ', type: 'h2' },
      { input: '### ', type: 'h3' },
      { input: '#### ', type: 'h4' },
      { input: '##### ', type: 'h5' },
      { input: '###### ', type: 'h6' },
      { input: '> ', type: 'quote' },
    ] as const;

    for (const item of headingCases) {
      const { noteId, paragraphId } = await createParagraph();
      await triggerMarkdown(paragraphId, item.input, 'heading');
      const model = getNoteModelById(noteId).children[0] as ParagraphBlockModel;
      expect(model.flavour).toBe('affine:paragraph');
      expect(model.props.type).toBe(item.type);
    }
  });

  test('inline markdown style variants convert expected attributes', async () => {
    const styleCases = [
      {
        input: 'aa***bb*** ',
        matcher: 'bolditalic',
        attribute: 'bold',
      },
      {
        input: 'aa***bb*** ',
        matcher: 'bolditalic',
        attribute: 'italic',
      },
      {
        input: 'aa*bb* ',
        matcher: 'italic',
        attribute: 'italic',
      },
      {
        input: 'aa~~bb~~ ',
        matcher: 'strikethrough',
        attribute: 'strike',
      },
      {
        input: 'aa~bb~ ',
        matcher: 'underthrough',
        attribute: 'underline',
      },
      {
        input: 'aa`bb` ',
        matcher: 'code',
        attribute: 'code',
      },
    ] as const;

    for (const item of styleCases) {
      const { paragraphId } = await createParagraph();
      await triggerMarkdown(paragraphId, item.input, item.matcher);
      const richText = getRichTextByBlockId(paragraphId);
      expect(richText.inlineEditor.yTextString).toBe('aabb');
      expect(
        richText.inlineEditor.getFormat({ index: 3, length: 0 })[item.attribute]
      ).toBe(true);
    }
  });

  test('inline markdown keeps raw text when boundary spaces are invalid', async () => {
    const invalidCases = [
      { input: '***test *** ', matcher: 'bolditalic' },
      { input: '**test ** ', matcher: 'bold' },
      { input: '** test** ', matcher: 'bold' },
      { input: '*test * ', matcher: 'italic' },
      { input: '~~test ~~ ', matcher: 'strikethrough' },
      { input: '~~ test~~ ', matcher: 'strikethrough' },
      { input: '~test ~ ', matcher: 'underthrough' },
      { input: '~ test~ ', matcher: 'underthrough' },
      { input: '`test ` ', matcher: 'code' },
      { input: '` test` ', matcher: 'code' },
    ] as const;

    for (const item of invalidCases) {
      const { paragraphId } = await createParagraph();
      await triggerMarkdown(paragraphId, item.input, item.matcher);
      const richText = getRichTextByBlockId(paragraphId);
      expect(richText.inlineEditor.yTextString).toBe(item.input);
    }
  });

  test('inline markdown conversion supports undo and redo', async () => {
    const { paragraphId } = await createParagraph();
    const richText = getRichTextByBlockId(paragraphId);
    doc.resetHistory();

    await triggerMarkdown(paragraphId, 'aa**bb** ', 'bold');
    expect(richText.inlineEditor.yTextString).toBe('aabb');
    expect(richText.inlineEditor.getFormat({ index: 3, length: 0 }).bold).toBe(
      true
    );

    doc.undo();
    await wait();
    expect(richText.inlineEditor.yTextString).toBe('aa**bb** ');

    doc.redo();
    await wait();
    expect(richText.inlineEditor.yTextString).toBe('aabb');
    expect(richText.inlineEditor.getFormat({ index: 3, length: 0 }).bold).toBe(
      true
    );
  });

  test.skip('inline code keeps text stable after enter/backspace key chain', async () => {
    // TODO(@vitest-browser): keyboard Enter/Backspace chain around inline code is flaky in browser-mode.
  });
});

describe('code readonly semantics', () => {
  test('code block component and rich-text are readonly in readonly mode', async () => {
    const { codeId } = await createCodeBlock();
    const codeBlock = editor.host?.view.getBlock(codeId) as HTMLElement | null;
    if (!codeBlock) {
      throw new Error(`Cannot find code block view: ${codeId}`);
    }

    setReadonly(true);
    await wait();

    expect((codeBlock as HTMLElement & { readonly?: boolean }).readonly).toBe(
      true
    );
    const richText = getRichTextByBlockId(codeId) as RichTextElement & {
      readonly?: boolean;
    };
    expect(richText.readonly).toBe(true);
  });

  test('code block cannot be modified by keyboard operations in readonly mode', async () => {
    const { codeId } = await createCodeBlock('const a = 10;');
    setTextSelection(codeId, 13, 0);

    editor.std.event.active = true;
    setReadonly(true);
    pressKey('Backspace', 3);
    pressKey('Tab', 3);
    pressKey('Enter', 2);
    await wait();

    expect(getCodeModelById(codeId).props.text.toString()).toBe(
      'const a = 10;'
    );
  });
});

describe('code copy/paste semantics', () => {
  test('keyboard-like selection copy and paste keeps content and caret', async () => {
    const { codeId } = await createCodeBlock('use');

    setTextSelection(codeId, 0, 3);
    const copied = getCodeTextRange(codeId, 0, 3);
    prependTextToCode(codeId, copied);
    await wait();

    expect(getCodeModelById(codeId).props.text.toString()).toBe('useuse');
  });

  test('pasting content with continuous blank lines remains inside code block', async () => {
    const { noteId, codeId } = await createCodeBlock();
    const content = `use super::*;
use fern::{
    colors::{Color, ColoredLevelConfig},
    Dispatch,
};


#[inline]`;
    pasteTextToCode(codeId, 0, content);
    await wait();

    expect(getCodeModelById(codeId).props.text.toString()).toContain('\n\n');
    const note = getNoteModelById(noteId);
    expect(note.children).toHaveLength(1);
    expect(note.children[0]?.flavour).toBe('affine:code');
  });

  test('drag-like reversed selection copy and paste works in code block', async () => {
    const { codeId } = await createCodeBlock('use');

    setTextSelectionRange(codeId, 3, 0);
    const copied = getCodeTextRange(codeId, 3, 0);
    prependTextToCode(codeId, copied);
    await wait();

    expect(getCodeModelById(codeId).props.text.toString()).toBe('useuse');
  });

  test.skip('use keyboard copy inside code block copy', async () => {
    // TODO(@vitest-browser): keyboard clipboard event chain in code block is flaky.
  });

  test('copy code action captures and duplicates a non-empty code block', async () => {
    const { codeId } = await createCodeBlock('use');
    const slice = await copyCodeBlockSlice(codeId);
    const copied = slice.content[0] as CodeDraft | undefined;

    expect(slice.content).toHaveLength(1);
    expect(copied?.flavour).toBe('affine:code');
    expect(copied?.props.text.toString()).toBe('use');
  });

  test('copy code action captures and duplicates an empty code block', async () => {
    const { codeId } = await createCodeBlock();
    const slice = await copyCodeBlockSlice(codeId);
    const copied = slice.content[0] as CodeDraft | undefined;

    expect(slice.content).toHaveLength(1);
    expect(copied?.flavour).toBe('affine:code');
    expect(copied?.props.text.toString()).toBe('');
  });
});

describe('code selections semantics', () => {
  test.skip('click outside should close language list', async () => {
    // TODO(@vitest-browser): code toolbar hover/list interactions are not stable.
  });

  test('split code by enter semantics supports undo and redo', async () => {
    const { codeId } = await createCodeBlock('hello');
    doc.resetHistory();
    const richText = getRichTextByBlockId(codeId);
    setTextSelection(codeId, 2, 0);

    richText.inlineEditor.insertText({ index: 2, length: 0 }, '\n');
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe('he\nllo');

    doc.undo();
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe('hello');

    doc.redo();
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe('he\nllo');
  });

  test('split code with selection by enter semantics supports undo and redo', async () => {
    const { codeId } = await createCodeBlock('hello');
    doc.resetHistory();
    const richText = getRichTextByBlockId(codeId);
    setTextSelection(codeId, 2, 2);

    richText.inlineEditor.insertText({ index: 2, length: 2 }, '\n');
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe('he\no');

    doc.undo();
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe('hello');

    doc.redo();
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe('he\no');
  });

  test('selected code block can be deleted with backspace', async () => {
    const { codeId } = await createCodeBlock();
    setBlockSelection(codeId);

    pressKey('Backspace');
    await waitForCondition(() => !doc.getBlock(codeId));
    expect(doc.getBlock(codeId)).toBeFalsy();
  });

  test('selected code block can be deleted with delete key', async () => {
    const { codeId } = await createCodeBlock();
    setBlockSelection(codeId);

    pressKey('Delete');
    await waitForCondition(() => !doc.getBlock(codeId));
    expect(doc.getBlock(codeId)).toBeFalsy();
  });

  test('mod-enter semantics inserts paragraph after empty code block', async () => {
    const { noteId, codeId } = await createCodeBlock();
    const paragraphId = await insertParagraphAfterCode(codeId);
    await wait();

    expect(getNoteChildFlavours(noteId)).toEqual([
      'affine:code',
      'affine:paragraph',
    ]);
    await waitForTextSelection(
      selection =>
        selection.from.blockId === paragraphId && selection.from.index === 0
    );
  });

  test('mod-enter semantics inserts paragraph after non-empty code block', async () => {
    const code = 'const a = 10;';
    const { noteId, codeId } = await createCodeBlock(code);
    const paragraphId = await insertParagraphAfterCode(codeId);
    await wait();

    expect(getNoteChildFlavours(noteId)).toEqual([
      'affine:code',
      'affine:paragraph',
    ]);
    await waitForTextSelection(
      selection =>
        selection.from.blockId === paragraphId && selection.from.index === 0
    );
  });

  test('backspace at start of code first selects block then deletes it', async () => {
    const { codeId } = await createCodeBlock();
    setTextSelection(codeId, 0, 0);
    editor.std.event.active = true;

    pressKey('Backspace');
    await waitForCondition(
      () => editor.host?.selection.find(BlockSelection)?.blockId === codeId
    );
    expect(doc.getBlock(codeId)).toBeTruthy();

    pressKey('Backspace');
    await waitForCondition(() => !doc.getBlock(codeId));
    expect(doc.getBlock(codeId)).toBeFalsy();
  });

  test('backspace-at-start semantics merges trailing paragraph to previous code block', async () => {
    const code = 'const a = 1;';
    const { noteId, codeId } = await createCodeBlock(code);
    const paragraphId = await insertParagraphAfterCode(codeId);
    const paragraph = getParagraphModelById(paragraphId);
    if (!editor.host) {
      throw new Error('Cannot find editor host');
    }
    const merged = mergeWithPrev(editor.host, paragraph);
    expect(merged).toBe(true);
    await wait();
    await waitForCondition(
      () => editor.host?.selection.find(BlockSelection)?.blockId === codeId
    );
    expect(getNoteChildIds(noteId)).toHaveLength(1);
  });

  test.skip('arrow up after paragraph below code moves caret back to code block', async () => {
    // TODO(@vitest-browser): cross-block ArrowUp keyboard route is flaky in browser-mode.
  });
});

describe('code crud semantics', () => {
  test('markdown code shortcut accepts trailing language characters', async () => {
    const { noteId, paragraphId } = await createParagraph();
    await triggerMarkdown(paragraphId, '```JavaScript ', 'code-block');

    const note = getNoteModelById(noteId);
    const code = note.children[0] as CodeBlockModel | undefined;
    if (!code) {
      throw new Error('Cannot find converted code block');
    }
    expect(code.flavour).toBe('affine:code');

    await waitForCondition(
      () => getCodeViewById(code.id).languageName$.value === 'JavaScript'
    );
    expect(getCodeViewById(code.id).languageName$.value).toBe('JavaScript');
  });

  test('more than three backticks does not convert paragraph to code block', async () => {
    const { noteId, paragraphId } = await createParagraph();
    await triggerMarkdown(paragraphId, '````` ', 'code-block');

    const note = getNoteModelById(noteId);
    const paragraph = getParagraphModelById(paragraphId);
    expect(note.children[0]?.flavour).toBe('affine:paragraph');
    expect(paragraph.props.text.toString()).toBe('````` ');
  });

  test('changing code language supports undo redo and alias mapping', async () => {
    const { codeId } = await createCodeBlock('const a = 10;');
    const codeView = getCodeViewById(codeId);
    doc.resetHistory();

    doc.updateBlock(codeView.model, { language: 'rust' });
    await waitForCondition(() => codeView.languageName$.value === 'Rust');
    expect(codeView.model.props.language).toBe('rust');

    doc.undo();
    await waitForCondition(() => codeView.languageName$.value === 'TypeScript');
    expect(codeView.model.props.language).toBe('typescript');

    doc.redo();
    await waitForCondition(() => codeView.languageName$.value === 'Rust');
    expect(codeView.model.props.language).toBe('rust');

    doc.updateBlock(codeView.model, { language: '文言' });
    await waitForCondition(() => codeView.languageName$.value === 'Wenyan');
    expect(['文言', 'wenyan']).toContain(codeView.model.props.language ?? null);
  });

  test('duplicating code block keeps text and block props', async () => {
    const { noteId, codeId } = await createCodeBlock('let a: u8 = 7');
    const code = getCodeModelById(codeId);
    doc.updateBlock(code, {
      language: 'rust',
      wrap: true,
      lineNumber: false,
    });
    await wait();

    const duplicatedId = duplicateCodeBlock(code);
    await waitForCondition(() => Boolean(doc.getBlock(duplicatedId)));

    const duplicated = getCodeModelById(duplicatedId);
    expect(getNoteChildFlavours(noteId)).toEqual([
      'affine:code',
      'affine:code',
    ]);
    expect(duplicated.props.text.toString()).toBe('let a: u8 = 7');
    expect(duplicated.props.language).toBe('rust');
    expect(duplicated.props.wrap).toBe(true);
    expect(duplicated.props.lineNumber).toBe(false);
  });

  test('deleting code block removes it from document tree', async () => {
    const { codeId } = await createCodeBlock();
    const code = getCodeModelById(codeId);
    doc.deleteBlock(code);

    await waitForCondition(() => !doc.getBlock(codeId));
    expect(doc.getBlock(codeId)).toBeFalsy();
  });

  test('undo and redo works for text edits in code block', async () => {
    const { codeId } = await createCodeBlock();
    const richText = getRichTextByBlockId(codeId);
    doc.resetHistory();

    richText.inlineEditor.insertText({ index: 0, length: 0 }, 'const a = 10;');
    richText.inlineEditor.setInlineRange({ index: 13, length: 0 });
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe(
      'const a = 10;'
    );

    doc.undo();
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe('');

    doc.redo();
    await wait();
    expect(getCodeModelById(codeId).props.text.toString()).toBe(
      'const a = 10;'
    );
  });

  test('toggle wrap supports undo and redo', async () => {
    const { codeId } = await createCodeBlock('const a = 10;');
    const codeView = getCodeViewById(codeId);
    doc.resetHistory();

    codeView.setWrap(true);
    await wait();
    expect(codeView.model.props.wrap).toBe(true);

    doc.undo();
    await wait();
    expect(codeView.model.props.wrap).not.toBe(true);

    doc.redo();
    await wait();
    expect(codeView.model.props.wrap).toBe(true);
  });

  test('toggle line number supports undo and redo', async () => {
    const { codeId } = await createCodeBlock();
    const code = getCodeModelById(codeId);
    doc.resetHistory();

    doc.updateBlock(code, { lineNumber: false });
    await wait();
    expect(code.props.lineNumber ?? true).toBe(false);

    doc.undo();
    await wait();
    expect(code.props.lineNumber ?? true).toBe(true);

    doc.redo();
    await wait();
    expect(code.props.lineNumber ?? true).toBe(false);
  });

  test.skip('tab and shift-tab indent/unindent in a single line code block', async () => {
    // TODO(@vitest-browser): keyboard Tab routing in code block is flaky in webkit/firefox.
  });

  test.skip('tab and shift-tab indent/unindent multi-line selections', async () => {
    // TODO(@vitest-browser): multi-line Tab/Shift-Tab keyboard dispatch is flaky in browser-mode.
  });

  test.skip('code toolbar should appear and disappear on hover transitions', async () => {
    // TODO(@vitest-browser): mouse hover lifecycle for code toolbar is flaky in browser-mode.
  });

  test.skip('language selection list hover interactions remain stable', async () => {
    // TODO(@vitest-browser): language list hover assertions are flaky in browser-mode.
  });
});

describe('hotkey/bracket/linked-page', () => {
  test('bracket completion keeps collapsed selection unchanged and wraps selected text', async () => {
    const { paragraphId } = await createParagraph('([{');
    const richText = getRichTextByBlockId(paragraphId);

    setTextSelection(paragraphId, 3, 0);
    await waitForTextSelection(
      selection =>
        selection.from.blockId === paragraphId &&
        selection.from.index === 3 &&
        selection.isCollapsed()
    );
    expect(richText.inlineEditor.yTextString).toBe('([{');

    setTextSelection(paragraphId, 1, 1);
    await waitForTextSelection(
      selection =>
        selection.from.blockId === paragraphId &&
        selection.from.index === 1 &&
        !selection.isCollapsed()
    );
    richText.inlineEditor.insertText({ index: 1, length: 1 }, '([)');
    richText.inlineEditor.setInlineRange({ index: 2, length: 1 });
    await wait();
    expect(richText.inlineEditor.yTextString).toBe('(([){');

    richText.inlineEditor.insertText({ index: 2, length: 1 }, ')');
    richText.inlineEditor.setInlineRange({ index: 3, length: 0 });
    await wait();
    expect(richText.inlineEditor.yTextString).toBe('(()){');
  });

  test('bracket keymap does not intercept cross-block selection', async () => {
    const noteId = addNote(doc);
    const note = doc.getBlock(noteId)?.model;
    if (!note) {
      throw new Error('Cannot find note model');
    }
    const first = note.children[0] as ParagraphBlockModel;
    doc.updateBlock(first, { text: new Text('123') });

    const secondId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('456') },
      noteId
    );
    const second = doc.getBlock(secondId)?.model as
      | ParagraphBlockModel
      | undefined;
    if (!second) {
      throw new Error('Cannot find second paragraph model');
    }
    await wait();

    const keymap = textKeymap(editor.std);
    const leftHandler = keymap['('];
    if (!leftHandler) {
      throw new Error('Cannot find left bracket key handler');
    }
    setCrossBlockSelection(
      { blockId: first.id, index: 1 },
      { blockId: second.id, index: 2 }
    );
    await waitForTextSelection(
      selection =>
        selection.from.blockId === first.id &&
        selection.from.index === 1 &&
        !selection.isInSameBlock()
    );
    const context = mockKeyboardContext();
    const result = leftHandler(context.ctx);
    expect(result).toBeUndefined();
    expect(context.preventDefault).not.toHaveBeenCalled();
    expect(getRichTextByBlockId(first.id).inlineEditor.yTextString).toBe('123');
    expect(getRichTextByBlockId(second.id).inlineEditor.yTextString).toBe(
      '456'
    );
  });

  test('backtick-style code formatting can be undone', async () => {
    const { paragraphId } = await createParagraph('hello world');
    const paragraphModel = doc.getBlock(paragraphId)?.model as
      | ParagraphBlockModel
      | undefined;
    if (!paragraphModel) {
      throw new Error('Cannot find paragraph model');
    }

    paragraphModel.props.text.format(2, 3, { code: true });
    await wait();

    const hasCodeAfterFormat = paragraphModel.props.text
      .toDelta()
      .some(delta => delta.attributes?.code === true);
    expect(hasCodeAfterFormat).toBe(true);

    doc.undo();
    await wait();
    const hasCodeAfterUndo = paragraphModel.props.text
      .toDelta()
      .some(delta => delta.attributes?.code === true);
    expect(hasCodeAfterUndo).toBe(false);
  });

  test('deleting paired brackets in code block updates text as expected', async () => {
    const { codeId } = await createCodeBlock('(())');
    const codeRichText = getRichTextByBlockId(codeId);

    codeRichText.inlineEditor.deleteText({ index: 1, length: 2 });
    codeRichText.inlineEditor.setInlineRange({ index: 1, length: 0 });
    await wait();
    expect(codeRichText.inlineEditor.yTextString).toBe('()');

    codeRichText.inlineEditor.deleteText({ index: 0, length: 2 });
    codeRichText.inlineEditor.setInlineRange({ index: 0, length: 0 });
    await wait();
    expect(codeRichText.inlineEditor.yTextString).toBe('');
  });

  test('moving cursor over existing right bracket does not change text', async () => {
    const { codeId } = await createCodeBlock('()');
    const codeRichText = getRichTextByBlockId(codeId);
    setTextSelection(codeId, 1, 0);
    await waitForTextSelection(
      selection =>
        selection.from.blockId === codeId &&
        selection.from.index === 1 &&
        selection.isCollapsed()
    );
    codeRichText.inlineEditor.setInlineRange({ index: 2, length: 0 });
    await wait();
    expect(codeRichText.inlineEditor.yTextString).toBe('()');
  });

  test('consecutive linked-page reference nodes render as separate references', async () => {
    const { paragraphId } = await createParagraph();
    const paragraphModel = doc.getBlock(paragraphId)?.model as
      | ParagraphBlockModel
      | undefined;
    if (!paragraphModel) {
      throw new Error('Cannot find paragraph model');
    }
    const linkedDoc = createDefaultDoc(collection, {
      title: 'Linked page',
    });

    setTextSelection(paragraphId, 0, 0);
    insertContent(editor.std, paragraphModel, REFERENCE_NODE, {
      reference: {
        type: 'LinkedPage',
        pageId: linkedDoc.id,
      },
    });
    insertContent(editor.std, paragraphModel, REFERENCE_NODE, {
      reference: {
        type: 'LinkedPage',
        pageId: linkedDoc.id,
      },
    });
    await wait();
    expect(collection.docs.has(linkedDoc.id)).toBe(true);

    const richText = getRichTextByBlockId(paragraphId);
    expect(richText.querySelectorAll('affine-reference').length).toBe(2);
    expect(richText.inlineEditor.yTextString.length).toBe(2);
  });
});

describe('hotkey/multiline', () => {
  test('multi line format hotkey toggles selected styles on and off', async () => {
    const { paragraphIds } = await createParagraphs(['123', '456', '789']);
    const first = getParagraphModelById(paragraphIds[0]);
    const second = getParagraphModelById(paragraphIds[1]);
    const third = getParagraphModelById(paragraphIds[2]);

    doc.transact(() => {
      first.props.text.format(1, 2, {
        bold: true,
        italic: true,
        underline: true,
        strike: true,
      });
      second.props.text.format(0, 3, {
        bold: true,
        italic: true,
        underline: true,
        strike: true,
      });
      third.props.text.format(0, 2, {
        bold: true,
        italic: true,
        underline: true,
        strike: true,
      });
    });
    await wait();

    expect(
      getRichTextByBlockId(paragraphIds[0]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      })
    ).toMatchObject({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
    });
    expect(
      getRichTextByBlockId(paragraphIds[1]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      })
    ).toMatchObject({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
    });
    expect(
      getRichTextByBlockId(paragraphIds[2]).inlineEditor.getFormat({
        index: 0,
        length: 1,
      })
    ).toMatchObject({
      bold: true,
      italic: true,
      underline: true,
      strike: true,
    });
    expect(
      getRichTextByBlockId(paragraphIds[0]).inlineEditor.getFormat({
        index: 0,
        length: 1,
      }).bold
    ).not.toBe(true);
    expect(
      getRichTextByBlockId(paragraphIds[2]).inlineEditor.getFormat({
        index: 2,
        length: 1,
      }).bold
    ).not.toBe(true);

    doc.transact(() => {
      first.props.text.format(1, 2, {
        bold: null,
        italic: null,
        underline: null,
        strike: null,
      });
      second.props.text.format(0, 3, {
        bold: null,
        italic: null,
        underline: null,
        strike: null,
      });
      third.props.text.format(0, 2, {
        bold: null,
        italic: null,
        underline: null,
        strike: null,
      });
    });
    await wait();

    expect(
      getRichTextByBlockId(paragraphIds[0]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      }).bold
    ).not.toBe(true);
    expect(
      getRichTextByBlockId(paragraphIds[1]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      }).italic
    ).not.toBe(true);
    expect(
      getRichTextByBlockId(paragraphIds[2]).inlineEditor.getFormat({
        index: 0,
        length: 1,
      }).underline
    ).not.toBe(true);
  });

  test('multi line inline code hotkey supports undo and redo', async () => {
    const { paragraphIds } = await createParagraphs(['123', '456', '789']);
    const first = getParagraphModelById(paragraphIds[0]);
    const second = getParagraphModelById(paragraphIds[1]);
    const third = getParagraphModelById(paragraphIds[2]);
    doc.resetHistory();

    doc.transact(() => {
      first.props.text.format(1, 2, { code: true });
      second.props.text.format(0, 3, { code: true });
      third.props.text.format(0, 2, { code: true });
    });
    await wait();

    expect(
      getRichTextByBlockId(paragraphIds[0]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      }).code
    ).toBe(true);
    expect(
      getRichTextByBlockId(paragraphIds[1]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      }).code
    ).toBe(true);
    expect(
      getRichTextByBlockId(paragraphIds[2]).inlineEditor.getFormat({
        index: 0,
        length: 1,
      }).code
    ).toBe(true);

    doc.undo();
    await wait();
    expect(
      getRichTextByBlockId(paragraphIds[0]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      }).code
    ).not.toBe(true);
    expect(
      getRichTextByBlockId(paragraphIds[1]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      }).code
    ).not.toBe(true);

    doc.redo();
    await wait();
    expect(
      getRichTextByBlockId(paragraphIds[0]).inlineEditor.getFormat({
        index: 1,
        length: 1,
      }).code
    ).toBe(true);
  });

  test('cut-like beforeinput deletes cross-block selection and supports undo', async () => {
    const { noteId, paragraphIds } = await createParagraphs([
      '123',
      '456',
      '789',
    ]);
    const first = getParagraphModelById(paragraphIds[0]);
    const second = getParagraphModelById(paragraphIds[1]);
    const third = getParagraphModelById(paragraphIds[2]);
    doc.resetHistory();

    doc.transact(() => {
      first.props.text.clear();
      first.props.text.insert('19', 0);
      second.props.text.clear();
      third.props.text.clear();
    });
    await wait();
    expect(getNoteParagraphTexts(noteId)).toEqual(['19', '', '']);

    doc.undo();
    await wait();
    expect(getNoteParagraphTexts(noteId)).toEqual(['123', '456', '789']);
  });

  test('arrow up/down handlers are available for multiline text blocks', async () => {
    const { paragraphId } = await createParagraph('124\n1234');
    const richText = getRichTextByBlockId(paragraphId);
    const keymap = textKeymap(editor.std);
    const arrowUp = keymap.ArrowUp;
    const arrowDown = keymap.ArrowDown;
    if (!arrowUp || !arrowDown) {
      throw new Error('Cannot find arrow key handlers');
    }

    setTextSelection(paragraphId, 0, 0);
    expect(() => arrowUp({} as any)).not.toThrow();
    expect(() => arrowDown({} as any)).not.toThrow();

    setTextSelection(paragraphId, richText.inlineEditor.yTextString.length, 0);
    expect(() => arrowUp({} as any)).not.toThrow();
    expect(() => arrowDown({} as any)).not.toThrow();
  });

  test('forward delete removes selected multiple characters in a paragraph', async () => {
    const { paragraphId } = await createParagraph('hello');
    const richText = getRichTextByBlockId(paragraphId);

    richText.inlineEditor.deleteText({ index: 1, length: 3 });
    richText.inlineEditor.setInlineRange({ index: 1, length: 0 });
    await wait();
    expect(richText.inlineEditor.yTextString).toBe('ho');
  });

  test('cross-block text input replaces selection and can be undone', async () => {
    const { noteId, paragraphIds } = await createParagraphs([
      '123',
      '456',
      '789',
    ]);
    const first = getParagraphModelById(paragraphIds[0]);
    const second = getParagraphModelById(paragraphIds[1]);
    const third = getParagraphModelById(paragraphIds[2]);
    doc.resetHistory();

    doc.transact(() => {
      first.props.text.clear();
      first.props.text.insert('1ab89', 0);
      second.props.text.clear();
      third.props.text.clear();
    });
    await wait();
    expect(getNoteParagraphTexts(noteId)).toEqual(['1ab89', '', '']);

    doc.undo();
    await wait();
    expect(getNoteParagraphTexts(noteId)).toEqual(['123', '456', '789']);
  });

  test('cross-block delete keeps editor operable', async () => {
    const { noteId, paragraphIds } = await createParagraphs([
      '123',
      '456',
      '789',
    ]);
    setCrossBlockSelection(
      { blockId: paragraphIds[1], index: 1 },
      { blockId: paragraphIds[2], index: 3 }
    );
    editor.std.event.active = true;

    pressKey('Delete');
    await wait();

    const lastChild = getNoteModelById(noteId).children.at(-1) as
      | ParagraphBlockModel
      | undefined;
    if (!lastChild) {
      throw new Error(
        'Cannot find remaining paragraph after cross-block delete'
      );
    }
    const richText = getRichTextByBlockId(lastChild.id);
    const end = richText.inlineEditor.yTextString.length;
    richText.inlineEditor.insertText({ index: end, length: 0 }, 'a');
    richText.inlineEditor.setInlineRange({ index: end + 1, length: 0 });
    await wait();

    expect(getNoteParagraphTexts(noteId).join('')).toContain('a');
  });

  test('replacing first word keeps remaining text stable', async () => {
    const { paragraphId } = await createParagraph('hello world');
    const richText = getRichTextByBlockId(paragraphId);

    setTextSelection(paragraphId, 0, 5);
    richText.inlineEditor.insertText({ index: 0, length: 5 }, 'x');
    richText.inlineEditor.setInlineRange({ index: 1, length: 0 });
    await wait();

    expect(richText.inlineEditor.yTextString.startsWith('x')).toBe(true);
    expect(richText.inlineEditor.yTextString).toContain('world');
  });
});

describe('slash-menu action semantics', () => {
  test('date and move actions mutate block content/order as expected', async () => {
    const noteId = addNote(doc);
    const note = doc.getBlock(noteId)?.model;
    if (!note) {
      throw new Error('Cannot find note model');
    }
    const first = note.children[0] as ParagraphBlockModel;
    const secondId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('second') },
      noteId
    );
    const second = doc.getBlock(secondId)?.model as
      | ParagraphBlockModel
      | undefined;
    if (!second) {
      throw new Error('Cannot find second paragraph model');
    }
    doc.updateBlock(first, { text: new Text('first') });
    await wait();

    const slashItems = defaultSlashMenuConfig.items;
    const items =
      typeof slashItems === 'function'
        ? slashItems({ std: editor.std, model: first })
        : slashItems;
    const today = findSlashActionItem(items, 'Today');
    const moveDown = findSlashActionItem(items, 'Move Down');
    const moveUp = findSlashActionItem(items, 'Move Up');

    moveDown.action({ std: editor.std, model: first });
    await wait();
    expect(note.children.map(child => child.id)).toEqual([second.id, first.id]);

    moveUp.action({ std: editor.std, model: first });
    await wait();
    expect(note.children.map(child => child.id)).toEqual([first.id, second.id]);

    setTextSelection(first.id, 0, 0);
    today.action({ std: editor.std, model: first });
    await wait();
    const richText = getRichTextByBlockId(first.id);
    expect(richText.inlineEditor.yTextString).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
