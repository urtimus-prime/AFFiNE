import type {
  ListBlockModel,
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine/model';
import { TextSelection } from '@blocksuite/std';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type RichTextElement = HTMLElement & {
  inlineEditor: {
    focusIndex: (index: number) => void;
    getFormat: (range: {
      index: number;
      length: number;
    }) => Record<string, unknown>;
    setInlineRange: (range: { index: number; length: number }) => void;
    syncInlineRange: (range?: { index: number; length: number } | null) => void;
    waitForUpdate: () => Promise<void>;
    yTextString: string;
  };
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

function getRichTextByBlockId(blockId: string) {
  const richText = document.querySelector<RichTextElement>(
    `[data-block-id="${blockId}"] rich-text`
  );
  if (!richText) {
    throw new Error(`Cannot find rich-text for block: ${blockId}`);
  }
  return richText;
}

function getImageIds() {
  return doc.getBlocksByFlavour('affine:image').map(model => model.id);
}

function getBlockTypes(noteId: string) {
  return getNoteModel(noteId).children.map(child => {
    const model = child as ParagraphBlockModel | ListBlockModel;
    return model.props.type;
  });
}

function getBlockTexts(noteId: string) {
  return getNoteModel(noteId).children.map(child => {
    const model = child as ParagraphBlockModel | ListBlockModel;
    return model.text?.toString() ?? '';
  });
}

async function setTextSelection(blockId: string, index = 0, length = 0) {
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

async function pasteContent(clipData: Record<string, string>) {
  const event = new ClipboardEvent('paste', {
    clipboardData: new DataTransfer(),
  });
  Object.defineProperty(event, 'target', {
    writable: false,
    value: document,
  });
  Object.entries(clipData).forEach(([type, value]) => {
    event.clipboardData?.setData(type, value);
  });
  document.dispatchEvent(event);
  await wait(50);
}

async function createEmptyParagraphNote() {
  const noteId = addNote(doc);
  const paragraph = getNoteModel(noteId).children[0] as
    | ParagraphBlockModel
    | undefined;
  if (!paragraph) {
    throw new Error('Cannot find first paragraph');
  }
  await wait();
  return {
    noteId,
    paragraphId: paragraph.id,
  };
}

test('markdown format parse from text/plain clipboard', async () => {
  const { noteId, paragraphId } = await createEmptyParagraphNote();
  doc.resetHistory();
  await setTextSelection(paragraphId, 0, 0);

  await pasteContent({
    'text/plain': `# h1

## h2

### h3

#### h4

##### h5

###### h6

- [ ] todo

- [ ] todo

- [x] todo

* bulleted

- bulleted

1. numbered

> quote
`,
  });

  await waitForCondition(() => getNoteModel(noteId).children.length === 13);
  expect(getBlockTypes(noteId)).toEqual([
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'todo',
    'todo',
    'todo',
    'bulleted',
    'bulleted',
    'numbered',
    'quote',
  ]);
  expect(getBlockTexts(noteId)).toEqual([
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'todo',
    'todo',
    'todo',
    'bulleted',
    'bulleted',
    'numbered',
    'quote',
  ]);

  doc.undo();
  await waitForCondition(() => getBlockTexts(noteId).length === 1);
  expect(getBlockTexts(noteId)).toEqual(['']);
});

test('import markdown from text/plain clipboard', async () => {
  const { noteId, paragraphId } = await createEmptyParagraphNote();
  doc.resetHistory();
  await setTextSelection(paragraphId, 0, 0);

  await pasteContent({
    'text/plain': `# text
# h1
`,
  });

  await waitForCondition(() => getNoteModel(noteId).children.length === 2);
  expect(getBlockTexts(noteId)).toEqual(['text', 'h1']);

  doc.undo();
  await waitForCondition(() => getBlockTexts(noteId).length === 1);
  expect(getBlockTexts(noteId)).toEqual(['']);
});

test('clipboard HTML containing markdown-like code and image keeps image', async () => {
  const { paragraphId } = await createEmptyParagraphNote();
  await setTextSelection(paragraphId, 0, 0);

  await pasteContent({
    'text/html': `<p>符合 Markdown 格式的 URL 放到笔记中，此时需要的格式如下：</p>
<pre><code>md [任务管理这件事 - 少数派](https://sspai.com/post/61092)</code></pre>
<p>（将一段文字包裹在<code>[[]]</code>中）此时需要的格式如下：</p>
<figure><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Crect width='600' height='400' fill='%234a90e2'/%3E%3C/svg%3E" /></figure>
<p>上图中，当我们处在 Obsidian 的「预览模式」时，点击这个「双向链接」</p>`,
  });

  await waitForCondition(() => getImageIds().length === 1);
  expect(getImageIds()).toHaveLength(1);
});
