import type { DocMode } from '@blocksuite/affine-model';
import { beforeEach, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type EdgelessRootElement = HTMLElement & {
  gfx: {
    keyboard: {
      shiftKey$: {
        peek: () => boolean;
      };
    };
  };
};

type EditableContainer = HTMLElement & {
  doc: typeof doc;
  mode: DocMode;
  pageSpecs: typeof editor.pageSpecs;
  edgelessSpecs: typeof editor.edgelessSpecs;
  updateComplete: Promise<unknown>;
};

beforeEach(async () => {
  const cleanup = await setupEditor('edgeless');
  return cleanup;
});

test('shift key status is synced across multiple editor containers', async () => {
  // Ensure there is note content in the shared doc before mounting another editor.
  addNote(doc);

  const anotherEditor = document.createElement(
    'affine-editor-container'
  ) as EditableContainer;
  anotherEditor.doc = doc;
  anotherEditor.mode = 'edgeless';
  anotherEditor.pageSpecs = editor.pageSpecs;
  anotherEditor.edgelessSpecs = editor.edgelessSpecs;
  document.body.append(anotherEditor);
  await anotherEditor.updateComplete;
  await wait(50);

  const getShiftStates = () =>
    Array.from(
      document.querySelectorAll<EdgelessRootElement>('affine-edgeless-root')
    ).map(root => root.gfx.keyboard.shiftKey$.peek());

  expect(getShiftStates()).toEqual([false, false]);

  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Shift',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  await wait();
  expect(getShiftStates()).toEqual([true, true]);

  document.dispatchEvent(
    new KeyboardEvent('keyup', {
      key: 'Shift',
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    })
  );
  await wait();
  expect(getShiftStates()).toEqual([false, false]);

  anotherEditor.remove();
});
