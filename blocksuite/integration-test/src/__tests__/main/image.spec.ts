import type {
  ImageBlockModel,
  NoteBlockModel,
  ParagraphBlockModel,
} from '@blocksuite/affine/model';
import {
  duplicateSelectedModelsCommand,
  getSelectedModelsCommand,
} from '@blocksuite/affine-shared/commands';
import { ImageSelection } from '@blocksuite/affine-shared/selection';
import { TextSelection } from '@blocksuite/std';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

type PageRootElement = HTMLElement & {
  store?: {
    blobSync?: {
      set: (blob: Blob) => Promise<string>;
    };
  };
};

type ImageBlockElement = HTMLElement & {
  captionEditor?: {
    show: () => void;
  } | null;
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

const createImageBlob = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="960" height="720" fill="#4a90e2"/></svg>`;
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

function getImageModel(imageId: string) {
  const image = doc.getBlock(imageId)?.model as ImageBlockModel | undefined;
  if (!image) {
    throw new Error(`Cannot find image model: ${imageId}`);
  }
  return image;
}

function getImageBlockElement(imageId: string) {
  const block = editor.host?.view.getBlock(imageId) as ImageBlockElement | null;
  if (!block) {
    throw new Error(`Cannot find image block view: ${imageId}`);
  }
  return block;
}

function getImageSize(imageId: string) {
  const block = getImageBlockElement(imageId);
  const resizable = block.querySelector<HTMLElement>('.resizable-img');
  if (!resizable) {
    throw new Error('Cannot find resizable image container');
  }
  const rect = resizable.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

function getImageCount() {
  return doc.getBlocksByFlavour('affine:image').length;
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

async function waitForImageBlock(imageId: string) {
  for (let i = 0; i < 40; i++) {
    const block = editor.host?.view.getBlock(imageId) as HTMLElement | null;
    const image = block?.querySelector<HTMLImageElement>('.resizable-img img');
    if (block && image && image.naturalWidth > 0) {
      return;
    }
    await wait(50);
  }
  throw new Error(`Cannot find rendered image block: ${imageId}`);
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

function dispatchPointerEvent(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX,
      clientY,
    })
  );
}

async function dragResizeHandle(
  imageId: string,
  handleClass: 'top-left' | 'top-right',
  deltaX: number
) {
  const block = getImageBlockElement(imageId);
  const handle = block.querySelector<HTMLElement>(`.resize.${handleClass}`);
  if (!handle) {
    throw new Error(`Cannot find image resize handle: ${handleClass}`);
  }
  const rect = handle.getBoundingClientRect();
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const endX = startX + deltaX;

  dispatchPointerEvent(handle, 'pointerdown', startX, startY);
  for (let i = 1; i <= 10; i++) {
    const x = startX + ((endX - startX) * i) / 10;
    dispatchPointerEvent(document, 'pointermove', x, startY);
    await wait();
  }
  await wait();
  dispatchPointerEvent(document, 'pointerup', endX, startY);
  await wait();
}

function updateCaptionValue(caption: HTMLTextAreaElement, value: string) {
  caption.value = value;
  caption.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: value,
    })
  );
}

function insertCaptionTextAtCursor(caption: HTMLTextAreaElement, text: string) {
  const start = caption.selectionStart ?? caption.value.length;
  const end = caption.selectionEnd ?? start;
  caption.setRangeText(text, start, end, 'end');
  caption.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    })
  );
}

async function focusCaption(imageId: string) {
  const block = getImageBlockElement(imageId);
  block.captionEditor?.show();

  await waitForCondition(
    () =>
      !!block.querySelector<HTMLTextAreaElement>(
        'block-caption-editor textarea'
      )
  );

  const caption = block.querySelector<HTMLTextAreaElement>(
    'block-caption-editor textarea'
  );
  if (!caption) {
    throw new Error('Cannot find image caption editor');
  }

  caption.focus();
  return caption;
}

async function createImageNote() {
  const rootId = doc.root?.id;
  if (!rootId) {
    throw new Error('Cannot find root block');
  }

  const noteId = doc.addBlock('affine:note', {}, rootId);
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

  await waitForImageBlock(imageId);
  await wait();

  doc.resetHistory();
  return {
    noteId,
    imageId,
  };
}

test('can drag resize image by left menu', async () => {
  const { imageId } = await createImageNote();
  setImageSelection(imageId);

  await waitForCondition(
    () => !!getImageBlockElement(imageId).querySelector('.resize.top-left')
  );

  const initialWidth = getImageSize(imageId).width;
  await dragResizeHandle(imageId, 'top-left', 200);

  await waitForCondition(() => getImageSize(imageId).width < initialWidth - 20);
  const resizedWidth = getImageSize(imageId).width;

  doc.undo();
  await waitForCondition(
    () => Math.abs(getImageSize(imageId).width - initialWidth) < 3
  );

  doc.redo();
  await waitForCondition(
    () => Math.abs(getImageSize(imageId).width - resizedWidth) < 3
  );
});

test('can drag resize image by right menu', async () => {
  const { imageId } = await createImageNote();
  setImageSelection(imageId);

  await waitForCondition(
    () => !!getImageBlockElement(imageId).querySelector('.resize.top-right')
  );

  const initialWidth = getImageSize(imageId).width;
  await dragResizeHandle(imageId, 'top-right', -200);

  await waitForCondition(() => getImageSize(imageId).width < initialWidth - 20);
  const resizedWidth = getImageSize(imageId).width;

  doc.undo();
  await waitForCondition(
    () => Math.abs(getImageSize(imageId).width - initialWidth) < 3
  );

  doc.redo();
  await waitForCondition(
    () => Math.abs(getImageSize(imageId).width - resizedWidth) < 3
  );
});

test('can click and delete image', async () => {
  const { imageId } = await createImageNote();
  expect(getImageCount()).toBe(1);

  setImageSelection(imageId);
  pressKey('Backspace');
  await waitForCondition(() => getImageCount() === 0);

  doc.undo();
  await waitForCondition(() => getImageCount() === 1);

  doc.redo();
  await waitForCondition(() => getImageCount() === 0);
});

test('can click and copy image', async () => {
  const { imageId } = await createImageNote();
  expect(getImageCount()).toBe(1);

  setImageSelection(imageId);

  editor.std.command
    .chain()
    .pipe(getSelectedModelsCommand, { types: ['image'] })
    .pipe(duplicateSelectedModelsCommand)
    .run();

  await waitForCondition(() => getImageCount() === 2);
});

test('enter shortcut on focusing embed block and its caption', async () => {
  const { imageId } = await createImageNote();
  setImageSelection(imageId);

  const caption = await focusCaption(imageId);
  updateCaptionValue(caption, '123');
  await waitForCondition(() => getImageModel(imageId).props.caption === '123');

  caption.blur();
  await wait();

  caption.focus();
  caption.setSelectionRange(0, 0);
  insertCaptionTextAtCursor(caption, 'abc');

  await waitForCondition(
    () => getImageModel(imageId).props.caption === 'abc123'
  );
  expect(caption.value).toBe('abc123');
});

test('should support the enter key of image caption', async () => {
  const { noteId, imageId } = await createImageNote();
  setImageSelection(imageId);

  const caption = await focusCaption(imageId);
  updateCaptionValue(caption, 'abc123');
  await waitForCondition(
    () => getImageModel(imageId).props.caption === 'abc123'
  );

  caption.setSelectionRange(3, 3);
  caption.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );

  await waitForCondition(() => getImageModel(imageId).props.caption === 'abc');
  await waitForCondition(() => getParagraphModels(noteId).length === 1);

  const paragraph = getParagraphModels(noteId)[0];
  if (!paragraph) {
    throw new Error('Cannot find paragraph inserted from caption');
  }

  expect(paragraph.text?.toString()).toBe('123');

  const selection = editor.host?.selection.find(TextSelection);
  expect(selection?.from.blockId).toBe(paragraph.id);
  expect(selection?.from.index).toBe(0);
});
