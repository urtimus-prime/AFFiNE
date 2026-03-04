import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { DefaultTool } from '@blocksuite/affine/blocks/surface';
import { NoteDisplayMode } from '@blocksuite/affine/model';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, drag, wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
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
    ctrlKey?: boolean;
    metaKey?: boolean;
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
    })
  );
};

const pressSelectAllByShortcut = () => {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const shortKey = isMac ? 'Meta' : 'Control';
  const shortCode = isMac ? 'MetaLeft' : 'ControlLeft';

  dispatchKey('keydown', { key: shortKey, code: shortCode });
  dispatchKey('keydown', {
    key: 'a',
    code: 'KeyA',
    ctrlKey: !isMac,
    metaKey: isMac,
  });
  dispatchKey('keyup', {
    key: 'a',
    code: 'KeyA',
    ctrlKey: !isMac,
    metaKey: isMac,
  });
  dispatchKey('keyup', { key: shortKey, code: shortCode });
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

const getDraggingArea = () => {
  const area = edgeless.gfx.tool.draggingViewportArea$.value;
  return [
    Math.round(area.x),
    Math.round(area.y),
    Math.round(area.w),
    Math.round(area.h),
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
  edgeless.gfx.tool.setTool(DefaultTool);
  await wait();

  return cleanup;
});

describe('translation should constrain to current axis when dragged with shift', () => {
  test('constrain-x', async () => {
    const rectId = addRect(100, 100);
    await wait();
    service.selection.set({
      elements: [rectId],
      editing: false,
    });
    await wait();

    dispatchHostPointer('pointerdown', { x: 110, y: 110 });
    dispatchHostPointer('pointermove', { x: 110, y: 110 });
    await wait();
    expect(getSelectedBound()).toEqual([100, 100, 100, 100]);

    dispatchKey('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    dispatchHostPointer('pointermove', { x: 110, y: 200 }, { shiftKey: true });
    dispatchHostPointer('pointermove', { x: 300, y: 200 }, { shiftKey: true });
    await wait();

    expect(getSelectedBound()).toEqual([290, 100, 100, 100]);

    dispatchHostPointer('pointerup', { x: 300, y: 200 }, { shiftKey: true });
    dispatchKey('keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: false });
  });

  test('constrain-y', async () => {
    const rectId = addRect(100, 100);
    await wait();
    service.selection.set({
      elements: [rectId],
      editing: false,
    });
    await wait();

    dispatchHostPointer('pointerdown', { x: 110, y: 110 });
    dispatchHostPointer('pointermove', { x: 110, y: 110 });
    await wait();
    expect(getSelectedBound()).toEqual([100, 100, 100, 100]);

    dispatchKey('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    dispatchHostPointer('pointermove', { x: 200, y: 110 }, { shiftKey: true });
    dispatchHostPointer('pointermove', { x: 200, y: 300 }, { shiftKey: true });
    await wait();

    expect(getSelectedBound()).toEqual([100, 290, 100, 100]);

    dispatchHostPointer('pointerup', { x: 200, y: 300 }, { shiftKey: true });
    dispatchKey('keyup', { key: 'Shift', code: 'ShiftLeft', shiftKey: false });
  });
});

test('select multiple shapes and press Escape to cancel selection', async () => {
  service.crud.addElement('brush', {
    points: [
      [100, 100],
      [200, 200],
    ],
    lineWidth: 4,
  });
  addRect(210, 110);
  await wait();

  drag(edgeless.host, { x: 90, y: 90 }, { x: 320, y: 220 });
  await wait();
  expect(getSelectedBound()).toEqual([98, 98, 212, 112]);

  dispatchKey('keydown', { key: 'Escape', code: 'Escape' });
  dispatchKey('keyup', { key: 'Escape', code: 'Escape' });
  await wait();

  expect(service.selection.selectedElements).toHaveLength(0);
});

test('should move selection drag area when holding spaceBar', async () => {
  click(edgeless.host, { x: 100, y: 100 });
  await wait();

  dispatchHostPointer('pointerdown', { x: 100, y: 100 });
  dispatchHostPointer('pointermove', { x: 300, y: 300 });

  dispatchKey('keydown', { key: ' ', code: 'Space' });
  dispatchHostPointer('pointermove', { x: 400, y: 400 });
  await wait();

  expect(getDraggingArea()).toEqual([200, 200, 200, 200]);

  dispatchKey('keyup', { key: ' ', code: 'Space' });
  dispatchHostPointer('pointerup', { x: 400, y: 400 });
});

test('selection drag-area start should be same when space is pressed again', async () => {
  dispatchHostPointer('pointerdown', { x: 100, y: 100 });
  dispatchHostPointer('pointermove', { x: 200, y: 200 });

  dispatchKey('keydown', { key: ' ', code: 'Space' });
  dispatchHostPointer('pointermove', { x: 300, y: 300 });
  await wait();
  const firstArea = getDraggingArea();

  dispatchKey('keyup', { key: ' ', code: 'Space' });
  dispatchHostPointer('pointermove', { x: 400, y: 400 });
  dispatchKey('keydown', { key: ' ', code: 'Space' });
  dispatchHostPointer('pointermove', { x: 410, y: 410 });
  dispatchHostPointer('pointermove', { x: 400, y: 400 });
  await wait();
  const secondArea = getDraggingArea();

  expect([firstArea[0], firstArea[1]]).toEqual([secondArea[0], secondArea[1]]);

  dispatchKey('keyup', { key: ' ', code: 'Space' });
  dispatchHostPointer('pointerup', { x: 400, y: 400 });
});

test('should update selection dragging area after releasing space', async () => {
  click(edgeless.host, { x: 100, y: 100 });
  await wait();

  dispatchHostPointer('pointerdown', { x: 100, y: 100 });
  dispatchHostPointer('pointermove', { x: 300, y: 300 });

  dispatchKey('keydown', { key: ' ', code: 'Space' });
  dispatchHostPointer('pointermove', { x: 400, y: 400 });
  dispatchKey('keyup', { key: ' ', code: 'Space' });
  dispatchHostPointer('pointermove', { x: 500, y: 500 });
  await wait();

  expect(getDraggingArea()).toEqual([200, 200, 300, 300]);

  dispatchHostPointer('pointerup', { x: 500, y: 500 });
});

test('cmd+a should not select doc only note', async () => {
  const noteA = addNote(doc, { xywh: '[0,0,120,80]' });
  const noteB = addNote(doc, { xywh: '[100,200,120,80]' });
  const noteC = addNote(doc, { xywh: '[200,300,120,80]' });
  await wait();

  service.crud.updateElement(noteB, {
    displayMode: NoteDisplayMode.DocOnly,
  });
  await wait();

  click(edgeless.host, { x: 400, y: 500 });
  await wait();

  pressSelectAllByShortcut();
  await wait();

  const selected = new Set(service.selection.selectedIds);
  expect(selected.has(noteA)).toBe(true);
  expect(selected.has(noteB)).toBe(false);
  expect(selected.has(noteC)).toBe(true);
  expect(selected.size).toBe(2);
});
