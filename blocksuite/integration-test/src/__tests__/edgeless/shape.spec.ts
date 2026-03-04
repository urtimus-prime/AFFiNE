import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { type ShapeName, ShapeType } from '@blocksuite/affine/model';
import { ShapeTool } from '@blocksuite/affine-gfx-shape';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, drag, wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

let edgeless!: EdgelessRootBlockComponent;
let service!: EdgelessRootBlockComponent['service'];

const dispatchHostPointer = (
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  point: { x: number; y: number },
  modifiers?: { shiftKey?: boolean }
) => {
  const hostRect = edgeless.host.getBoundingClientRect();
  edgeless.host.dispatchEvent(
    new PointerEvent(type, {
      clientX: hostRect.left + point.x,
      clientY: hostRect.top + point.y,
      bubbles: true,
      composed: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      shiftKey: modifiers?.shiftKey ?? false,
    })
  );
};

const dispatchKey = (
  type: 'keydown' | 'keyup',
  init: {
    key: string;
    code?: string;
    shiftKey?: boolean;
  }
) => {
  document.dispatchEvent(
    new KeyboardEvent(type, {
      key: init.key,
      code: init.code ?? init.key,
      bubbles: true,
      cancelable: true,
      shiftKey: init.shiftKey ?? false,
    })
  );
};

const getSelectedBound = () => {
  const bound = service.selection.selectedBound;
  return [
    Math.round(bound.x),
    Math.round(bound.y),
    Math.round(bound.w),
    Math.round(bound.h),
  ] as const;
};

const getCurrentToolName = () => edgeless.gfx.tool.currentToolName$.peek();

const setShapeTool = async (shapeName: ShapeName = ShapeType.Rect) => {
  edgeless.gfx.tool.setTool(ShapeTool, { shapeName });
  await wait();
};

const createShapeByDrag = async (
  start: { x: number; y: number },
  end: { x: number; y: number },
  options?: {
    shiftKey?: boolean;
    beforePointerUp?: () => Promise<void> | void;
  }
) => {
  dispatchHostPointer('pointerdown', start, { shiftKey: options?.shiftKey });
  dispatchHostPointer('pointermove', end, { shiftKey: options?.shiftKey });
  if (options?.beforePointerUp) {
    await options.beforePointerUp();
  }
  dispatchHostPointer('pointerup', end, { shiftKey: options?.shiftKey });
  await wait();
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

  return cleanup;
});

describe('add shape', () => {
  test('without holding shift key', async () => {
    await setShapeTool(ShapeType.Rect);
    await createShapeByDrag({ x: 100, y: 100 }, { x: 150, y: 200 });
    expect(getCurrentToolName()).toBe('default');
    expect(getSelectedBound()).toEqual([100, 100, 50, 100]);

    await setShapeTool(ShapeType.Rect);
    await createShapeByDrag({ x: 100, y: 100 }, { x: 200, y: 150 });
    expect(getCurrentToolName()).toBe('default');
    expect(getSelectedBound()).toEqual([100, 100, 100, 50]);
  });

  test('with holding shift key', async () => {
    await setShapeTool(ShapeType.Rect);
    dispatchKey('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    await createShapeByDrag(
      { x: 100, y: 100 },
      { x: 150, y: 200 },
      { shiftKey: true }
    );
    dispatchKey('keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: false });
    expect(getCurrentToolName()).toBe('default');
    expect(getSelectedBound()).toEqual([100, 100, 100, 100]);

    await setShapeTool(ShapeType.Rect);
    dispatchKey('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    await createShapeByDrag(
      { x: 100, y: 100 },
      { x: 200, y: 150 },
      { shiftKey: true }
    );
    dispatchKey('keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: false });
    expect(getCurrentToolName()).toBe('default');
    expect(getSelectedBound()).toEqual([100, 100, 100, 100]);
  });

  test('with holding space bar', async () => {
    await setShapeTool(ShapeType.Rect);
    await createShapeByDrag(
      { x: 100, y: 100 },
      { x: 500, y: 600 },
      {
        beforePointerUp: async () => {
          dispatchHostPointer('pointermove', { x: 200, y: 200 });
          dispatchKey('keydown', { key: ' ', code: 'Space' });
          dispatchHostPointer('pointermove', { x: 300, y: 300 });
          dispatchKey('keyup', { key: ' ', code: 'Space' });
          dispatchHostPointer('pointermove', { x: 500, y: 600 });
        },
      }
    );

    expect(getSelectedBound()).toEqual([200, 200, 300, 400]);
  });

  test('with holding space bar + shift', async () => {
    await setShapeTool(ShapeType.Rect);
    dispatchKey('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    await createShapeByDrag(
      { x: 100, y: 100 },
      { x: 500, y: 600 },
      {
        shiftKey: true,
        beforePointerUp: async () => {
          dispatchHostPointer(
            'pointermove',
            { x: 200, y: 200 },
            { shiftKey: true }
          );
          dispatchKey('keydown', { key: ' ', code: 'Space', shiftKey: true });
          dispatchHostPointer(
            'pointermove',
            { x: 300, y: 300 },
            { shiftKey: true }
          );
          dispatchKey('keyup', { key: ' ', code: 'Space', shiftKey: true });
          dispatchHostPointer(
            'pointermove',
            { x: 500, y: 600 },
            { shiftKey: true }
          );
        },
      }
    );
    dispatchKey('keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: false });

    expect(getSelectedBound()).toEqual([200, 200, 400, 400]);
  });
});

test('shape element should not move when the selected state is inactive', async () => {
  await setShapeTool(ShapeType.Rect);
  await createShapeByDrag({ x: 100, y: 100 }, { x: 200, y: 200 });
  expect(getSelectedBound()).toEqual([100, 100, 100, 100]);

  drag(edgeless.host, { x: 50, y: 50 }, { x: 110, y: 110 }, 2);
  await wait();

  expect(getSelectedBound()).toEqual([100, 100, 100, 100]);
});

test('click to add shape', async () => {
  await setShapeTool(ShapeType.Rect);
  click(edgeless.host, { x: 200, y: 200 });
  await wait();

  expect(getCurrentToolName()).toBe('default');
  expect(getSelectedBound()).toEqual([200, 200, 100, 100]);
});

test('delete shape block by keyboard', async () => {
  const shapeId = service.crud.addElement('shape', {
    shapeType: 'rect',
    xywh: '[100,100,100,100]',
  });
  if (!shapeId) {
    throw new Error('Cannot create shape');
  }
  await wait();

  service.selection.set({
    elements: [shapeId],
    editing: false,
  });
  await wait();

  const keyboardManager = edgeless.keyboardManager as {
    _delete: () => void;
  } | null;
  if (!keyboardManager) {
    throw new Error('Cannot find keyboard manager');
  }
  keyboardManager._delete();
  await wait();

  expect(service.crud.getElementById(shapeId)).toBeNull();
});

describe('shape hit test', () => {
  const addTransparentRect = () => {
    const id = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,100,100]',
      fillColor: 'transparent',
      filled: false,
    });
    if (!id) {
      throw new Error('Cannot create transparent shape');
    }
    return id;
  };

  test('can select hollow shape by clicking center area', async () => {
    addTransparentRect();
    await wait();

    click(edgeless.host, { x: 80, y: 80 });
    await wait();
    expect(service.selection.selectedElements).toHaveLength(0);

    click(edgeless.host, { x: 150, y: 150 });
    await wait();
    expect(getSelectedBound()).toEqual([100, 100, 100, 100]);
  });
});
