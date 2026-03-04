import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type HandlePosition =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';

let edgeless!: EdgelessRootBlockComponent;
let service!: EdgelessRootBlockComponent['service'];

const rotatePointByDegree = (
  point: { x: number; y: number },
  center: { x: number; y: number },
  degree: number
) => {
  if (degree === 0) {
    return point;
  }
  const radian = (degree * Math.PI) / 180;
  const sine = Math.sin(radian);
  const cosine = Math.cos(radian);
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: offsetX * cosine - offsetY * sine + center.x,
    y: offsetX * sine + offsetY * cosine + center.y,
  };
};

const dispatchPointer = (
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  point: { x: number; y: number },
  modifiers?: { shiftKey?: boolean }
) => {
  target.dispatchEvent(
    new PointerEvent(type, {
      clientX: point.x,
      clientY: point.y,
      bubbles: true,
      composed: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      shiftKey: modifiers?.shiftKey ?? false,
    })
  );
};

const getSelectedRect = () => {
  const selectedRect = document
    .querySelector('edgeless-selected-rect')
    ?.shadowRoot?.querySelector<HTMLElement>('.affine-edgeless-selected-rect');
  if (!selectedRect) {
    throw new Error('Cannot find selected rect');
  }
  return selectedRect;
};

const getHandle = (corner: HandlePosition, mode: 'resize' | 'rotate') => {
  const handle = getSelectedRect().querySelector<HTMLElement>(
    `.handle[aria-label="${corner}"] .${mode}`
  );
  if (!handle) {
    throw new Error(`Cannot find ${mode} handle ${corner}`);
  }
  return handle;
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

const getSelectedRotation = () => {
  const style = getSelectedRect().style.transform;
  const matched = style.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
  return matched ? Number.parseFloat(matched[1]) : 0;
};

const dragHandle = async (
  handle: HTMLElement,
  start: { x: number; y: number },
  end: { x: number; y: number },
  steps = 1,
  modifiers?: { shiftKey?: boolean }
) => {
  dispatchPointer(handle, 'pointerdown', start, modifiers);
  dispatchPointer(handle, 'pointermove', start, modifiers);

  if (steps > 0) {
    const stepX = (end.x - start.x) / steps;
    const stepY = (end.y - start.y) / steps;

    for (const [index] of Array.from({ length: steps }).entries()) {
      dispatchPointer(
        handle,
        'pointermove',
        {
          x: start.x + stepX * (index + 1),
          y: start.y + stepY * (index + 1),
        },
        modifiers
      );
    }
  }

  dispatchPointer(handle, 'pointerup', end, modifiers);
  await wait();
};

const rotateByHandle = async (
  degree: number,
  corner:
    | 'top-left'
    | 'top-right'
    | 'bottom-right'
    | 'bottom-left' = 'top-left',
  steps = 1,
  modifiers?: { shiftKey?: boolean }
) => {
  const selectedRect = getSelectedRect();
  const rotateHandle = getHandle(corner, 'rotate');

  const selectedRectBox = selectedRect.getBoundingClientRect();
  const handleBox = rotateHandle.getBoundingClientRect();
  const center = {
    x: selectedRectBox.left + selectedRectBox.width / 2,
    y: selectedRectBox.top + selectedRectBox.height / 2,
  };
  const start = {
    x: handleBox.left + handleBox.width / 2,
    y: handleBox.top + handleBox.height / 2,
  };
  const end = rotatePointByDegree(start, center, degree);

  await dragHandle(rotateHandle, start, end, steps, modifiers);
};

const resizeByHandle = async (
  delta: { x: number; y: number },
  corner: HandlePosition = 'top-left',
  steps = 1
) => {
  const resizeHandle = getHandle(corner, 'resize');
  const handleBox = resizeHandle.getBoundingClientRect();
  const start = {
    x: handleBox.left + handleBox.width / 2,
    y: handleBox.top + handleBox.height / 2,
  };
  const end = {
    x: start.x + delta.x,
    y: start.y + delta.y,
  };

  await dragHandle(resizeHandle, start, end, steps);
};

const addRect = (x: number, y: number, w: number, h: number) => {
  const id = service.crud.addElement('shape', {
    shapeType: 'rect',
    xywh: `[${x},${y},${w},${h}]`,
    fillColor: 'red',
  });
  if (!id) {
    throw new Error('Cannot create shape');
  }
  return id;
};

const selectElements = async (elements: string[]) => {
  service.selection.set({
    elements,
    editing: false,
  });
  await wait();
};

const dispatchShift = (type: 'keydown' | 'keyup') => {
  document.dispatchEvent(
    new KeyboardEvent(type, {
      key: 'Shift',
      shiftKey: type === 'keydown',
      bubbles: true,
      cancelable: true,
    })
  );
};

const getResizeCursor = (corner: HandlePosition) => {
  return getComputedStyle(getHandle(corner, 'resize')).cursor;
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

describe('rotation', () => {
  test('angle adjustment by four corners', async () => {
    const rectId = addRect(100, 100, 100, 100);
    await wait();
    await selectElements([rectId]);

    await rotateByHandle(45, 'top-left');
    expect(getSelectedRotation()).toBeCloseTo(45, 0);

    await rotateByHandle(45, 'top-right');
    expect(getSelectedRotation()).toBeCloseTo(90, 0);

    await rotateByHandle(45, 'bottom-right');
    expect(getSelectedRotation()).toBeCloseTo(135, 0);

    await rotateByHandle(45, 'bottom-left');
    expect(getSelectedRotation()).toBeCloseTo(180, 0);
  });

  test('angle snap', async () => {
    const rectId = addRect(100, 100, 100, 100);
    await wait();
    await selectElements([rectId]);

    dispatchShift('keydown');
    try {
      await rotateByHandle(5, 'top-left', 1, { shiftKey: true });
      expect(getSelectedRotation()).toBeCloseTo(0, 0);

      await rotateByHandle(10, 'top-left', 1, { shiftKey: true });
      expect(getSelectedRotation()).toBeCloseTo(15, 0);

      await rotateByHandle(10, 'top-left', 1, { shiftKey: true });
      expect(getSelectedRotation()).toBeCloseTo(30, 0);

      await rotateByHandle(10, 'top-left', 1, { shiftKey: true });
      expect(getSelectedRotation()).toBeCloseTo(45, 0);

      await rotateByHandle(5, 'top-left', 1, { shiftKey: true });
      expect(getSelectedRotation()).toBeCloseTo(45, 0);
    } finally {
      dispatchShift('keyup');
    }
  });

  test('single shape', async () => {
    const rectId = addRect(100, 100, 100, 100);
    await wait();
    await selectElements([rectId]);
    expect(getSelectedBound()).toEqual([100, 100, 100, 100]);

    await rotateByHandle(45, 'top-right');
    expect(getSelectedRotation()).toBeCloseTo(45, 0);
  });

  test('multiple shapes', async () => {
    const rectA = addRect(100, 100, 100, 100);
    const rectB = addRect(200, 100, 100, 100);
    await wait();
    await selectElements([rectA, rectB]);
    expect(getSelectedBound()).toEqual([100, 100, 200, 100]);

    await rotateByHandle(90, 'bottom-right');
    expect(getSelectedRotation()).toBeCloseTo(0, 0);
    expect(getSelectedBound()).toEqual([150, 50, 100, 200]);
  });

  test('combination with resizing', async () => {
    const rectId = addRect(100, 100, 100, 100);
    await wait();
    await selectElements([rectId]);

    await rotateByHandle(90, 'bottom-left', 10);
    expect(getSelectedRotation()).toBeCloseTo(90, 0);

    await resizeByHandle({ x: 10, y: -10 }, 'bottom-right');
    expect(getSelectedBound()).toEqual([110, 100, 90, 90]);

    await rotateByHandle(-90, 'bottom-right');
    expect(getSelectedRotation()).toBeCloseTo(0, 0);

    await resizeByHandle({ x: 10, y: 10 }, 'bottom-right');
    expect(getSelectedBound()).toEqual([110, 100, 100, 100]);
  });

  test('combination with resizing for multiple shapes', async () => {
    const rectA = addRect(100, 100, 100, 100);
    const rectB = addRect(200, 100, 100, 100);
    await wait();
    await selectElements([rectA, rectB]);
    expect(getSelectedBound()).toEqual([100, 100, 200, 100]);

    await rotateByHandle(90, 'bottom-left');
    expect(getSelectedRotation()).toBeCloseTo(0, 0);
    expect(getSelectedBound()).toEqual([150, 50, 100, 200]);

    await resizeByHandle({ x: -10, y: -20 }, 'bottom-right');
    expect(getSelectedBound()).toEqual([150, 50, 90, 180]);

    await rotateByHandle(-90, 'bottom-right');
    expect(getSelectedRotation()).toBeCloseTo(0, 0);
    expect(getSelectedBound()).toEqual([105, 95, 180, 90]);

    await resizeByHandle({ x: 20, y: 10 }, 'bottom-right');
    expect(getSelectedBound()).toEqual([105, 95, 200, 100]);
  });
});

describe('cursor style', () => {
  test('update resize cursor direction after rotating', async () => {
    const rectId = addRect(100, 100, 100, 100);
    await wait();
    await selectElements([rectId]);

    await rotateByHandle(45, 'top-left');
    expect(getSelectedRotation()).toBeCloseTo(45, 0);

    expect(getResizeCursor('top')).toContain('nesw-resize');
    expect(getResizeCursor('right')).toContain('nwse-resize');
    expect(getResizeCursor('bottom')).toContain('nesw-resize');
    expect(getResizeCursor('left')).toContain('nwse-resize');
    expect(getResizeCursor('top-right')).toContain('ew-resize');
    expect(getResizeCursor('top-left')).toContain('ns-resize');
    expect(getResizeCursor('bottom-right')).toContain('ns-resize');
    expect(getResizeCursor('bottom-left')).toContain('ew-resize');
  });
});
