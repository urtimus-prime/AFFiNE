import { insertInlineLatex } from '@blocksuite/affine-inline-latex';
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
    deleteText: (range: InlineRange) => void;
    formatText: (
      range: InlineRange,
      attributes: Record<string, unknown>
    ) => void;
    getInlineRange: () => InlineRange | null;
    insertText: (range: InlineRange, text: string) => void;
    setInlineRange: (range: InlineRange) => void;
    waitForUpdate: () => Promise<void>;
    yTextDeltas: unknown[];
  };
};

type LatexNodeElement = HTMLElement & {
  toggleEditor: () => void;
};

type LatexEditorMenuElement = HTMLElement & {
  abortController: AbortController;
  latexSignal: {
    value: string;
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

function getRichText(paragraphId: string) {
  const richText = document.querySelector<RichTextElement>(
    `[data-block-id="${paragraphId}"] rich-text`
  );
  if (!richText) {
    throw new Error(
      `Cannot find paragraph rich-text for block: ${paragraphId}`
    );
  }
  return richText;
}

function getLatexNodes(paragraphId: string) {
  return Array.from(
    document.querySelectorAll<LatexNodeElement>(
      `[data-block-id="${paragraphId}"] affine-latex-node`
    )
  );
}

function getLatexNode(paragraphId: string, index = 0) {
  const node = getLatexNodes(paragraphId)[index];
  if (!node) {
    throw new Error('Cannot find inline latex node');
  }
  return node;
}

function getLatexEditorMenu() {
  return document.querySelector<LatexEditorMenuElement>('latex-editor-menu');
}

function getInlineDeltas(paragraphId: string) {
  return getRichText(paragraphId).inlineEditor.yTextDeltas;
}

async function expectInlineDeltas(paragraphId: string, expected: unknown[]) {
  await waitForCondition(() => {
    return (
      JSON.stringify(getInlineDeltas(paragraphId)) === JSON.stringify(expected)
    );
  });
  expect(getInlineDeltas(paragraphId)).toEqual(expected);
}

async function openLatexEditor(node: LatexNodeElement) {
  const existingMenu = getLatexEditorMenu();
  if (existingMenu) {
    return existingMenu;
  }

  node.click();
  await waitForCondition(() => !!getLatexEditorMenu());
  const menu = getLatexEditorMenu();
  if (!menu) {
    throw new Error('Cannot find latex editor menu');
  }
  return menu;
}

async function closeLatexEditorWithValue(options: {
  paragraphId: string;
  value: string;
}) {
  const { paragraphId, value } = options;
  const node = getLatexNode(paragraphId);
  const menu = await openLatexEditor(node);
  menu.latexSignal.value = value;
  menu.abortController.abort();
  await waitForCondition(() => !getLatexEditorMenu());
  await getRichText(paragraphId).inlineEditor.waitForUpdate();
}

async function insertInlineLatexAt(paragraphId: string, index: number) {
  const inlineEditor = getRichText(paragraphId).inlineEditor;
  inlineEditor.insertText({ index, length: 0 }, ' ');
  inlineEditor.formatText(
    {
      index,
      length: 1,
    },
    {
      latex: '',
    }
  );
  inlineEditor.setInlineRange({ index, length: 1 });

  await waitForCondition(() => getLatexNodes(paragraphId).length > 0);
}

function applyInlineLatexContentShortcut(
  paragraphId: string,
  content: string,
  cursorIndex: number
) {
  const inlineEditor = getRichText(paragraphId).inlineEditor;
  const startIndex = cursorIndex - 1 - 2 - content.length - 2;
  inlineEditor.deleteText({
    index: startIndex,
    length: 2 + content.length + 2 + 1,
  });
  inlineEditor.insertText(
    {
      index: startIndex,
      length: 0,
    },
    ' '
  );
  inlineEditor.formatText(
    {
      index: startIndex,
      length: 1,
    },
    {
      latex: content,
    }
  );
  inlineEditor.setInlineRange({
    index: startIndex + 1,
    length: 0,
  });
}

test('add inline latex at the start of line', async () => {
  const { paragraphId } = await createEmptyParagraphState();

  await insertInlineLatexAt(paragraphId, 0);
  const node = getLatexNode(paragraphId);

  expect(node.querySelector('.placeholder')?.textContent).toContain('Equation');

  await closeLatexEditorWithValue({
    paragraphId,
    value: 'E=mc^2',
  });

  await expectInlineDeltas(paragraphId, [
    {
      insert: ' ',
      attributes: {
        latex: 'E=mc^2',
      },
    },
  ]);
  expect(node.querySelector('.katex')).toBeTruthy();
});

test('add inline latex in the middle of text', async () => {
  const { paragraphId } = await createEmptyParagraphState();
  const inlineEditor = getRichText(paragraphId).inlineEditor;

  inlineEditor.insertText({ index: 0, length: 0 }, 'aaaa');
  inlineEditor.setInlineRange({ index: 2, length: 0 });

  await insertInlineLatexAt(paragraphId, 2);
  await closeLatexEditorWithValue({
    paragraphId,
    value: 'E=mc^2',
  });

  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aa',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'E=mc^2',
      },
    },
    {
      insert: 'aa',
    },
  ]);
});

test('update inline latex by clicking the node', async () => {
  const { paragraphId } = await createEmptyParagraphState();

  await insertInlineLatexAt(paragraphId, 0);
  await closeLatexEditorWithValue({
    paragraphId,
    value: 'E=mc^2',
  });

  const latex = String.raw`\def\arraystretch{1.5}
\begin{array}{c:c:c}
a & b & c \\ \\ hline
d & e & f \\
\hdashline
g & h & i
\end{array}`;

  const node = getLatexNode(paragraphId);
  node.click();
  await waitForCondition(() => !!getLatexEditorMenu());
  const menu = getLatexEditorMenu();
  if (!menu) {
    throw new Error('Cannot find latex editor menu');
  }
  menu.latexSignal.value = latex;
  menu.abortController.abort();
  await waitForCondition(() => !getLatexEditorMenu());

  await expectInlineDeltas(paragraphId, [
    {
      insert: ' ',
      attributes: {
        latex,
      },
    },
  ]);
});

test('latex editor', async () => {
  const { paragraphId } = await createEmptyParagraphState();

  await insertInlineLatexAt(paragraphId, 0);
  const longText = 'ababababababababababababababababababababababababab';
  await closeLatexEditorWithValue({
    paragraphId,
    value: longText,
  });

  const node = getLatexNode(paragraphId);
  node.click();
  await waitForCondition(() => !!getLatexEditorMenu());
  const menu = getLatexEditorMenu();
  if (!menu) {
    throw new Error('Cannot find latex editor menu');
  }
  expect(menu.latexSignal.value).toBe(longText);

  menu.latexSignal.value = '';
  menu.abortController.abort();
  await waitForCondition(() => !getLatexEditorMenu());
  await waitForCondition(() => !!node.querySelector('.placeholder'));
  await expectInlineDeltas(paragraphId, [
    {
      insert: ' ',
      attributes: {
        latex: '',
      },
    },
  ]);
});

test('add inline latex using slash menu', async () => {
  const { paragraphId } = await createEmptyParagraphState();

  const textSelection = editor.host?.selection.create(TextSelection, {
    from: {
      blockId: paragraphId,
      index: 0,
      length: 0,
    },
    to: null,
  });
  if (!textSelection) {
    throw new Error('Cannot create text selection');
  }

  editor.std.command.exec(insertInlineLatex, {
    textSelection,
  });

  await waitForCondition(() => getLatexNodes(paragraphId).length === 1);
  await waitForCondition(() => !!getLatexEditorMenu());
  await closeLatexEditorWithValue({
    paragraphId,
    value: 'E=mc^2',
  });

  await expectInlineDeltas(paragraphId, [
    {
      insert: ' ',
      attributes: {
        latex: 'E=mc^2',
      },
    },
  ]);
});

test('add inline latex using markdown shortcut', async () => {
  const { paragraphId } = await createEmptyParagraphState();
  const inlineEditor = getRichText(paragraphId).inlineEditor;

  inlineEditor.insertText({ index: 0, length: 0 }, 'aa');
  inlineEditor.insertText({ index: 2, length: 0 }, ' ');
  inlineEditor.formatText(
    { index: 2, length: 1 },
    {
      latex: 'bb',
    }
  );
  inlineEditor.insertText({ index: 3, length: 0 }, 'cc');
  inlineEditor.insertText({ index: 5, length: 0 }, ' ');
  inlineEditor.formatText(
    { index: 5, length: 1 },
    {
      latex: 'dd',
    }
  );

  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aa',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'bb',
      },
    },
    {
      insert: 'cc',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'dd',
      },
    },
  ]);

  inlineEditor.deleteText({ index: 2, length: 1 });

  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aacc',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'dd',
      },
    },
  ]);
});

test('undo-redo when add inline latex using markdown shortcut', async () => {
  const { paragraphId } = await createEmptyParagraphState();
  const inlineEditor = getRichText(paragraphId).inlineEditor;

  inlineEditor.insertText({ index: 0, length: 0 }, 'aa$$bb$$ ');
  doc.captureSync();
  applyInlineLatexContentShortcut(paragraphId, 'bb', 9);

  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aa',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'bb',
      },
    },
  ]);

  doc.undo();
  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aa$$bb$$ ',
    },
  ]);

  doc.redo();
  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aa',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'bb',
      },
    },
  ]);
});

test('auto focus after add inline latex using markdown shortcut', async () => {
  const { paragraphId } = await createEmptyParagraphState();
  const inlineEditor = getRichText(paragraphId).inlineEditor;

  inlineEditor.insertText({ index: 0, length: 0 }, 'aa');
  await insertInlineLatexAt(paragraphId, 2);
  await closeLatexEditorWithValue({
    paragraphId,
    value: 'bbb',
  });

  const latestInlineEditor = getRichText(paragraphId).inlineEditor;
  doc.captureSync();
  latestInlineEditor.insertText({ index: 3, length: 0 }, 'cc');

  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aa',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'bbb',
      },
    },
    {
      insert: 'cc',
    },
  ]);

  doc.undo();
  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aa',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'bbb',
      },
    },
  ]);

  doc.redo();
  await expectInlineDeltas(paragraphId, [
    {
      insert: 'aa',
    },
    {
      insert: ' ',
      attributes: {
        latex: 'bbb',
      },
    },
    {
      insert: 'cc',
    },
  ]);
});
