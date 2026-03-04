import type {
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine/model';
import { ImageSelection } from '@blocksuite/affine-shared/selection';
import { BlockSelection, TextSelection } from '@blocksuite/std';
import { Text } from '@blocksuite/store';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type PageRootElement = HTMLElement & {
  store?: {
    blobSync?: {
      set: (blob: Blob) => Promise<string>;
    };
  };
};

type RichTextElement = HTMLElement & {
  inlineEditor: {
    insertText: (
      range: { index: number; length: number },
      text: string
    ) => void;
    yTextString: string;
  };
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

const createImageBlob = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#4a90e2"/></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
};

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

function getRichTextByBlockId(blockId: string) {
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

function setTextSelection(blockId: string, index = 0, length = 0) {
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
}

async function waitForImageBlock(imageId: string) {
  for (let i = 0; i < 20; i++) {
    const block = editor.host?.view.getBlock(imageId) as HTMLElement | null;
    if (block?.querySelector('affine-page-image')) {
      return;
    }
    await wait(50);
  }
  throw new Error(`Cannot find rendered image block: ${imageId}`);
}

async function waitForCondition(condition: () => boolean) {
  for (let i = 0; i < 30; i++) {
    if (condition()) {
      return;
    }
    await wait(30);
  }
  expect(condition()).toBe(true);
}

function setImageSelection(imageId: string) {
  const selection = editor.host?.selection.create(ImageSelection, {
    blockId: imageId,
  });
  if (!selection) {
    throw new Error('Cannot create image selection');
  }
  editor.host?.selection.setGroup('note', [selection]);
  editor.std.event.active = true;
}

function pressKey(key: string) {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    })
  );
}

async function pasteHtml(html: string) {
  const event = new ClipboardEvent('paste', {
    clipboardData: new DataTransfer(),
  });
  Object.defineProperty(event, 'target', {
    writable: false,
    value: document,
  });
  event.clipboardData?.setData('text/html', html);
  document.dispatchEvent(event);
  await wait(50);
}

function getImageIds() {
  return doc.getBlocksByFlavour('affine:image').map(model => model.id);
}

async function createImageNote(options?: { tailParagraphText?: string }) {
  const noteId = addNote(doc);
  const pageRoot = document.querySelector<PageRootElement>('affine-page-root');
  if (!pageRoot?.store?.blobSync) {
    throw new Error('Cannot find blob storage');
  }
  const sourceId = await pageRoot.store.blobSync.set(createImageBlob());
  const imageId = doc.addBlock(
    'affine:image',
    {
      sourceId,
    },
    noteId
  );
  if (options?.tailParagraphText != null) {
    doc.addBlock(
      'affine:paragraph',
      {
        text: new Text(options.tailParagraphText),
      },
      noteId
    );
  }

  await waitForImageBlock(imageId);
  await wait();

  const firstParagraph = getParagraphModels(noteId)[0];
  if (!firstParagraph) {
    throw new Error('Cannot find first paragraph');
  }
  return {
    noteId,
    imageId,
    firstParagraphId: firstParagraph.id,
  };
}

async function createEmptyParagraphNote() {
  const noteId = addNote(doc);
  const firstParagraph = getParagraphModels(noteId)[0];
  if (!firstParagraph) {
    throw new Error('Cannot find first paragraph');
  }
  await wait();
  return {
    noteId,
    firstParagraphId: firstParagraph.id,
  };
}

test('press enter creates and focuses a new paragraph after selected image', async () => {
  const { noteId, imageId } = await createImageNote();
  setImageSelection(imageId);

  pressKey('Enter');

  await waitForCondition(() => getParagraphModels(noteId).length === 2);
  const paragraphs = getParagraphModels(noteId);
  const secondParagraph = paragraphs[1];
  if (!secondParagraph) {
    throw new Error('Cannot find second paragraph');
  }
  const selection = editor.host?.selection.find(TextSelection);
  expect(selection?.from.blockId).toBe(secondParagraph.id);
  doc.updateBlock(secondParagraph, {
    text: new Text('aa'),
  });
  await wait();
  expect(getParagraphModels(noteId).map(p => p.text?.toString() ?? '')).toEqual(
    ['', 'aa']
  );
});

test('press backspace at paragraph start after image selects image block', async () => {
  const { noteId, imageId } = await createImageNote();
  setImageSelection(imageId);
  pressKey('Enter');
  await waitForCondition(() => getParagraphModels(noteId).length === 2);

  pressKey('Backspace');
  await waitForCondition(() => getParagraphModels(noteId).length === 1);

  const selection = editor.host?.selection.find(BlockSelection);
  expect(selection?.blockId).toBe(imageId);
});

test('press enter with selected image shows placeholder in inserted paragraph', async () => {
  const { imageId } = await createImageNote();
  setImageSelection(imageId);

  pressKey('Enter');
  await wait(100);

  expect(
    document.querySelector('.affine-paragraph-placeholder.visible')
  ).toBeTruthy();
});

test('press arrow up on selected image moves caret to previous paragraph', async () => {
  const { noteId, imageId, firstParagraphId } = await createImageNote();
  setImageSelection(imageId);

  pressKey('ArrowUp');
  await waitForCondition(
    () =>
      editor.host?.selection.find(TextSelection)?.from.blockId ===
      firstParagraphId
  );

  getRichTextByBlockId(firstParagraphId).inlineEditor.insertText(
    { index: 0, length: 0 },
    'aa'
  );
  await wait();
  expect(getParagraphModels(noteId).map(p => p.text?.toString() ?? '')).toEqual(
    ['aa']
  );
});

test('press arrow down on selected image moves caret to next paragraph', async () => {
  const { noteId, imageId } = await createImageNote({
    tailParagraphText: 'aa',
  });
  const paragraphs = getParagraphModels(noteId);
  const tailParagraph = paragraphs[1];
  if (!tailParagraph) {
    throw new Error('Cannot find tail paragraph');
  }
  setImageSelection(imageId);

  pressKey('ArrowDown');
  await waitForCondition(
    () =>
      editor.host?.selection.find(TextSelection)?.from.blockId ===
      tailParagraph.id
  );

  getRichTextByBlockId(tailParagraph.id).inlineEditor.insertText(
    { index: 0, length: 0 },
    'bb'
  );
  await wait();
  expect(getParagraphModels(noteId).map(p => p.text?.toString() ?? '')).toEqual(
    ['', 'bbaa']
  );
});

test('clipboard paste ending with image keeps arrow up/down controllable', async () => {
  const { noteId, firstParagraphId } = await createEmptyParagraphNote();
  const clipText = 'Lorem Ipsum placeholder text.';
  const clipHtml = `<p>${clipText}</p><figure><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Crect width='600' height='400' fill='%234a90e2'/%3E%3C/svg%3E" /></figure>`;

  setTextSelection(firstParagraphId, 0, 0);
  await pasteHtml(clipHtml);
  await waitForCondition(() => getImageIds().length === 1);

  const firstImageId = getImageIds()[0];
  if (!firstImageId) {
    throw new Error('Cannot find first pasted image');
  }
  setImageSelection(firstImageId);
  pressKey('ArrowUp');
  await waitForCondition(
    () =>
      editor.host?.selection.find(TextSelection)?.from.blockId ===
      getParagraphModels(noteId)[0]?.id
  );

  await pasteHtml(clipHtml);
  await waitForCondition(() => getImageIds().length === 2);
  await waitForCondition(
    () =>
      getParagraphModels(noteId)[0]?.text?.toString() ===
      `${clipText}${clipText}`
  );

  const note = getNoteModel(noteId);
  const imageForArrowDown = [...note.children]
    .reverse()
    .find(child => child.flavour === 'affine:image');
  if (!imageForArrowDown) {
    throw new Error('Cannot find image for arrow-down check');
  }
  const imageForArrowDownIndex = note.children.findIndex(
    child => child.id === imageForArrowDown.id
  );
  if (imageForArrowDownIndex === -1) {
    throw new Error('Cannot find image index for arrow-down check');
  }
  const tailParagraphId = doc.addBlock(
    'affine:paragraph',
    {
      text: new Text(),
    },
    noteId,
    imageForArrowDownIndex + 1
  );
  await wait();

  setImageSelection(imageForArrowDown.id);
  pressKey('ArrowDown');
  await waitForCondition(
    () =>
      editor.host?.selection.find(TextSelection)?.from.blockId ===
      tailParagraphId
  );

  await pasteHtml(clipHtml);
  await waitForCondition(() => getImageIds().length === 3);
  await waitForCondition(() =>
    getParagraphModels(noteId).some(
      paragraph => paragraph.text?.toString() === clipText
    )
  );
});
