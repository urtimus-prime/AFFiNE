import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import type {
  HighlighterElementModel,
  ShapeName,
} from '@blocksuite/affine/model';
import { ShapeType } from '@blocksuite/affine/model';
import { HighlighterTool } from '@blocksuite/affine-gfx-brush';
import { ShapeTool } from '@blocksuite/affine-gfx-shape';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, drag, wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

let edgeless!: EdgelessRootBlockComponent;
let service!: EdgelessRootBlockComponent['service'];

const waitForCondition = async (condition: () => boolean, retries = 40) => {
  for (let i = 0; i < retries; i++) {
    if (condition()) {
      return;
    }
    await wait(30);
  }
  expect(condition()).toBe(true);
};

const dispatchKey = (
  type: 'keydown' | 'keyup',
  init: {
    key: string;
    code?: string;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
  }
) => {
  document.dispatchEvent(
    new KeyboardEvent(type, {
      key: init.key,
      code: init.code ?? init.key,
      bubbles: true,
      cancelable: true,
      shiftKey: init.shiftKey ?? false,
      ctrlKey: init.ctrlKey ?? false,
      metaKey: init.metaKey ?? false,
      altKey: init.altKey ?? false,
    })
  );
};

const pressKey = (init: {
  key: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}) => {
  dispatchKey('keydown', init);
  dispatchKey('keyup', init);
};

const pressShiftS = () => {
  dispatchKey('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
  pressKey({ key: 's', code: 'KeyS', shiftKey: true });
  dispatchKey('keyup', { key: 'Shift', code: 'ShiftLeft' });
};

const getShortcutModifier = () => {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  return {
    key: isMac ? 'Meta' : 'Control',
    code: isMac ? 'MetaLeft' : 'ControlLeft',
    metaKey: isMac,
    ctrlKey: !isMac,
  };
};

const pressShortcutCombination = (key: string, code: string) => {
  const modifier = getShortcutModifier();

  dispatchKey('keydown', modifier);
  pressKey({
    key,
    code,
    metaKey: modifier.metaKey,
    ctrlKey: modifier.ctrlKey,
  });
  dispatchKey('keyup', modifier);
};

const pressSelectAllByShortcut = () => {
  pressShortcutCombination('a', 'KeyA');
};

const pressZoomOutByShortcut = () => {
  pressShortcutCombination('-', 'Minus');
};

const pressZoomInByShortcut = () => {
  pressShortcutCombination('=', 'Equal');
};

const pressAltDigit = (digit: '0' | '1' | '2') => {
  dispatchKey('keydown', { key: 'Alt', code: 'AltLeft', altKey: true });
  pressKey({ key: digit, code: `Digit${digit}`, altKey: true });
  dispatchKey('keyup', { key: 'Alt', code: 'AltLeft' });
};

const getCurrentToolName = () => edgeless.gfx.tool.currentToolName$.peek();

const getCurrentShapeName = () =>
  edgeless.gfx.tool.get(ShapeTool).activatedOption.shapeName;

const getSelectedBound = () => {
  const bound = service.selection.selectedBound;
  return [
    Math.round(bound.x),
    Math.round(bound.y),
    Math.round(bound.w),
    Math.round(bound.h),
  ] as const;
};

const addRect = (x: number, y: number, width = 100, height = 100) => {
  const id = service.crud.addElement('shape', {
    shapeType: 'rect',
    xywh: `[${x},${y},${width},${height}]`,
    fillColor: 'red',
  });
  if (!id) {
    throw new Error('Cannot create shape');
  }
  return id;
};

beforeEach(async () => {
  const cleanup = await setupEditor('edgeless');
  edgeless = getDocRootBlock(doc, editor, 'edgeless');
  service = edgeless.service;
  service.viewport.setViewport(1, [
    service.viewport.width / 2,
    service.viewport.height / 2,
  ]);
  await wait();
  click(edgeless.host, { x: 10, y: 10 });
  await wait();

  return cleanup;
});

describe('tool shortcuts', () => {
  test('switch tools by keyboard', async () => {
    pressKey({ key: 's', code: 'KeyS' });
    await wait();
    expect(getCurrentToolName()).toBe('shape');

    pressKey({ key: 'p', code: 'KeyP' });
    await wait();
    expect(getCurrentToolName()).toBe('brush');

    pressKey({ key: 'h', code: 'KeyH' });
    await wait();
    expect(getCurrentToolName()).toBe('pan');

    pressKey({ key: 'c', code: 'KeyC' });
    await wait();
    expect(getCurrentToolName()).toBe('connector');
  });

  test('toggle shape type by shortcuts', async () => {
    edgeless.gfx.tool.setTool(ShapeTool, { shapeName: ShapeType.Rect });
    await wait();

    const shapesInOrder: ShapeName[] = [
      ShapeType.Ellipse,
      ShapeType.Diamond,
      ShapeType.Triangle,
      'roundedRect',
      ShapeType.Rect,
    ];

    for (const shape of shapesInOrder) {
      pressKey({ key: 's', code: 'KeyS' });
      await wait();
      expect(getCurrentShapeName()).toBe(shape);
    }

    for (const shape of [...shapesInOrder].reverse()) {
      expect(getCurrentShapeName()).toBe(shape);
      pressShiftS();
      await wait();
    }
  });

  test('should not switch shape when selection is editing', async () => {
    edgeless.gfx.tool.setTool(ShapeTool, { shapeName: ShapeType.Rect });
    await wait();

    const rectId = addRect(100, 100);
    await wait();
    service.selection.set({
      elements: [rectId],
      editing: true,
    });
    await wait();

    pressKey({ key: 's', code: 'KeyS' });
    await wait();
    expect(getCurrentToolName()).toBe('shape');
    expect(getCurrentShapeName()).toBe(ShapeType.Rect);

    pressShiftS();
    await wait();
    expect(getCurrentToolName()).toBe('shape');
    expect(getCurrentShapeName()).toBe(ShapeType.Rect);
  });

  test('should enter highlighter tool', async () => {
    edgeless.gfx.tool.setTool(HighlighterTool);
    await waitForCondition(() => getCurrentToolName() === 'highlighter');
    expect(getCurrentToolName()).toBe('highlighter');
  });

  test('should exit highlighter tool when Escape is pressed', async () => {
    edgeless.gfx.tool.setTool(HighlighterTool);
    await waitForCondition(() => getCurrentToolName() === 'highlighter');

    pressKey({ key: 'Escape', code: 'Escape' });
    await wait();
    expect(getCurrentToolName()).toBe('default');
  });

  test('new highlighter stroke should use default line width', async () => {
    edgeless.gfx.tool.setTool(HighlighterTool);
    await waitForCondition(() => getCurrentToolName() === 'highlighter');

    drag(edgeless.host, { x: 120, y: 180 }, { x: 220, y: 280 });
    await wait();

    const highlighters = service.surface.elementModels.filter(
      element => element.type === 'highlighter'
    ) as HighlighterElementModel[];
    expect(highlighters).toHaveLength(1);
    expect(highlighters[0].lineWidth).toBe(22);
  });
});

describe('zoom shortcuts', () => {
  test('fit to screen by keyboard', async () => {
    addRect(0, 0, 2000, 400);
    await wait();

    pressAltDigit('1');
    await waitForCondition(() => service.zoom < 1);

    expect(service.zoom).toBeLessThan(1);
  });

  test('zoom out by keyboard', async () => {
    pressAltDigit('0');
    await waitForCondition(() => Math.abs(service.zoom - 1) < 0.01);

    pressZoomOutByShortcut();
    await waitForCondition(() => Math.abs(service.zoom - 0.75) < 0.01);
    expect(service.zoom).toBeCloseTo(0.75, 2);

    pressZoomOutByShortcut();
    await waitForCondition(() => Math.abs(service.zoom - 0.5) < 0.01);
    expect(service.zoom).toBeCloseTo(0.5, 2);
  });

  test('zoom reset by keyboard', async () => {
    pressZoomOutByShortcut();
    await waitForCondition(() => Math.abs(service.zoom - 0.75) < 0.01);

    pressAltDigit('0');
    await waitForCondition(() => Math.abs(service.zoom - 1) < 0.01);
    expect(service.zoom).toBeCloseTo(1, 2);
  });

  test('zoom in by keyboard', async () => {
    pressAltDigit('0');
    await waitForCondition(() => Math.abs(service.zoom - 1) < 0.01);

    pressZoomInByShortcut();
    await waitForCondition(() => Math.abs(service.zoom - 1.25) < 0.01);
    expect(service.zoom).toBeCloseTo(1.25, 2);

    pressZoomInByShortcut();
    await waitForCondition(() => Math.abs(service.zoom - 1.5) < 0.01);
    expect(service.zoom).toBeCloseTo(1.5, 2);
  });

  test('zoom to selection by keyboard', async () => {
    const rectId = addRect(0, 0, 900, 200);
    await wait();
    service.selection.set({
      elements: [rectId],
      editing: false,
    });
    await wait();
    service.viewport.setCenter(-1000, -1000);
    await wait();

    pressAltDigit('2');
    await waitForCondition(() =>
      service.viewport.viewportBounds.contains(service.selection.selectedBound)
    );

    expect(
      service.viewport.viewportBounds.contains(service.selection.selectedBound)
    ).toBe(true);
  });
});

describe('selection and delete shortcuts', () => {
  test('cmd/ctrl+a should select all elements by default', async () => {
    addRect(0, 0);
    addRect(100, 0);
    await wait();

    pressSelectAllByShortcut();
    await wait();

    expect(getSelectedBound()).toEqual([0, 0, 200, 100]);
  });

  test('cmd/ctrl+a should not trigger when selection is editing', async () => {
    const noteId = addNote(doc, { xywh: '[100,100,120,80]' });
    await wait();
    service.selection.set({
      elements: [noteId],
      editing: true,
    });
    await wait();

    pressSelectAllByShortcut();
    await wait();

    expect(service.selection.editing).toBe(true);
    expect(service.selection.selectedIds).toEqual([noteId]);
  });

  test('delete key should not delete element when selection is editing', async () => {
    const noteId = addNote(doc, { xywh: '[100,100,120,80]' });
    await wait();
    service.selection.set({
      elements: [noteId],
      editing: true,
    });
    await wait();

    pressKey({ key: 'Backspace', code: 'Backspace' });
    pressKey({ key: 'Delete', code: 'Delete' });
    await wait();

    expect(service.crud.getElementById(noteId)).not.toBeNull();
  });

  test('Arrow keys should move selection by 10px with shift', async () => {
    const rectId = addRect(100, 100);
    await wait();
    service.selection.set({
      elements: [rectId],
      editing: false,
    });
    await wait();

    for (let i = 0; i < 10; i++) {
      pressKey({
        key: 'ArrowLeft',
        code: 'ArrowLeft',
        shiftKey: true,
      });
    }
    for (let i = 0; i < 10; i++) {
      pressKey({
        key: 'ArrowDown',
        code: 'ArrowDown',
        shiftKey: true,
      });
    }
    await wait();

    expect(getSelectedBound()).toEqual([0, 200, 100, 100]);
  });

  test('Arrow keys should move selection by 1px without shift', async () => {
    const rectId = addRect(100, 100);
    await wait();
    service.selection.set({
      elements: [rectId],
      editing: false,
    });
    await wait();

    for (let i = 0; i < 10; i++) {
      pressKey({
        key: 'ArrowRight',
        code: 'ArrowRight',
      });
    }
    for (let i = 0; i < 10; i++) {
      pressKey({
        key: 'ArrowUp',
        code: 'ArrowUp',
      });
    }
    await wait();

    expect(getSelectedBound()).toEqual([110, 90, 100, 100]);
  });
});
