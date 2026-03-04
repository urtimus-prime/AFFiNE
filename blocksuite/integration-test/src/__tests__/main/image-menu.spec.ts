import { BlockSelection } from '@blocksuite/std';
import { beforeEach, expect, test } from 'vitest';

import { click, wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

type PageRootElement = HTMLElement & {
  store?: {
    blobSync?: {
      set: (blob: Blob) => Promise<string>;
    };
  };
};

beforeEach(async () => {
  const cleanup = await setupEditor('page');
  return cleanup;
});

const isVisible = (element: Element | null): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
};

const createImageBlob = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#4a90e2"/></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
};

const waitForImage = async (imageId: string) => {
  for (let i = 0; i < 80; i++) {
    const imageBlock = editor.host?.view.getBlock(
      imageId
    ) as HTMLElement | null;
    const resizableImage =
      imageBlock?.querySelector<HTMLElement>('.resizable-img');
    if (imageBlock && resizableImage) {
      const rect = resizableImage.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return imageBlock;
      }
    }
    await wait(50);
  }
  throw new Error(`Cannot find image block: ${imageId}`);
};

test('select image should not show format bar', async () => {
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

  const image = await waitForImage(imageId);
  const imageRect = image.getBoundingClientRect();
  click(image, { x: imageRect.width / 2, y: imageRect.height / 2 });

  const hasImageBlockSelection = () => {
    return (
      editor.host?.selection.value.some(
        selection =>
          selection.is(BlockSelection) &&
          (selection as BlockSelection).blockId === imageId
      ) ?? false
    );
  };
  for (let i = 0; i < 20; i++) {
    if (hasImageBlockSelection()) {
      break;
    }
    await wait(50);
  }
  expect(hasImageBlockSelection()).toBe(true);

  const formatQuickBar = document.querySelector('.format-quick-bar');
  expect(isVisible(formatQuickBar)).toBe(false);

  image.dispatchEvent(
    new WheelEvent('wheel', {
      deltaY: imageRect.height,
      bubbles: true,
      cancelable: true,
    })
  );
  await wait(100);

  expect(isVisible(document.querySelector('.format-quick-bar'))).toBe(false);
});
