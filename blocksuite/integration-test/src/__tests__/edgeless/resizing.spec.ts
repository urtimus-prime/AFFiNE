import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, drag, wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('resizing shapes and aspect ratio will be maintained', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const getSelectedBound = () => {
    const bound = service.selection.selectedBound;
    return [
      Math.round(bound.x),
      Math.round(bound.y),
      Math.round(bound.w),
      Math.round(bound.h),
    ] as const;
  };

  const getSelectedRect = () => {
    const selectedRect = document
      .querySelector('edgeless-selected-rect')
      ?.shadowRoot?.querySelector<HTMLElement>(
        '.affine-edgeless-selected-rect'
      );
    if (!selectedRect) {
      throw new Error('Cannot find selected rect');
    }
    return selectedRect;
  };

  const resizeByHandle = async (
    delta: { x: number; y: number },
    corner:
      | 'top'
      | 'bottom'
      | 'left'
      | 'right'
      | 'top-left'
      | 'top-right'
      | 'bottom-right'
      | 'bottom-left' = 'top-left',
    steps = 1
  ) => {
    const handle = getSelectedRect().querySelector<HTMLElement>(
      `.handle[aria-label="${corner}"] .resize`
    );
    if (!handle) {
      throw new Error(`Cannot find resize handle ${corner}`);
    }

    const rect = handle.getBoundingClientRect();
    const dispatchPointer = (
      type: 'pointerdown' | 'pointermove' | 'pointerup',
      point: { x: number; y: number }
    ) => {
      handle.dispatchEvent(
        new PointerEvent(type, {
          clientX: point.x,
          clientY: point.y,
          bubbles: true,
          composed: true,
          pointerId: 1,
          isPrimary: true,
          pointerType: 'mouse',
        })
      );
    };

    const start = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const end = {
      x: start.x + delta.x,
      y: start.y + delta.y,
    };

    dispatchPointer('pointerdown', start);
    dispatchPointer('pointermove', start);

    if (steps > 0) {
      const xStep = (end.x - start.x) / steps;
      const yStep = (end.y - start.y) / steps;
      for (const [i] of Array.from({ length: steps }).entries()) {
        dispatchPointer('pointermove', {
          x: start.x + xStep * (i + 1),
          y: start.y + yStep * (i + 1),
        });
      }
    }

    dispatchPointer('pointerup', end);
    await wait();
  };

  const initResizeScene = async () => {
    const brushId = service.crud.addElement('brush', {
      points: [
        [100, 100],
        [200, 200],
      ],
      lineWidth: 4,
    });
    const rectId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[210,210,100,100]',
      fillColor: 'red',
    });
    if (!brushId || !rectId) {
      throw new Error('Cannot create resize scene elements');
    }
    await wait();

    click(edgeless.host, { x: 110, y: 110 });
    await wait();
    expect(getSelectedBound()).toEqual([98, 98, 104, 104]);

    click(edgeless.host, { x: 220, y: 220 });
    await wait();

    drag(edgeless.host, { x: 120, y: 90 }, { x: 220, y: 220 });
    await wait();
    expect(getSelectedBound()).toEqual([98, 98, 212, 212]);
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

  test('positive adjustment', async () => {
    await initResizeScene();
    await resizeByHandle({ x: 50, y: 50 });
    expect(getSelectedBound()).toEqual([148, 148, 162, 162]);
  });

  test('negative adjustment', async () => {
    await initResizeScene();
    await resizeByHandle({ x: 50, y: 50 }, 'bottom-right', 30);
    expect(getSelectedBound()).toEqual([98, 98, 262, 262]);
  });
});

describe('cursor style', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const getResizeCursor = (
    handle:
      | 'top'
      | 'right'
      | 'bottom'
      | 'left'
      | 'top-left'
      | 'top-right'
      | 'bottom-right'
      | 'bottom-left'
  ) => {
    const resizeHandle = document
      .querySelector('edgeless-selected-rect')
      ?.shadowRoot?.querySelector<HTMLElement>(
        `.handle[aria-label="${handle}"] .resize`
      );
    if (!resizeHandle) {
      throw new Error(`Cannot find resize handle ${handle}`);
    }
    return getComputedStyle(resizeHandle).cursor;
  };

  const assertResizeCursors = () => {
    expect(getResizeCursor('top')).toContain('ns-resize');
    expect(getResizeCursor('right')).toContain('ew-resize');
    expect(getResizeCursor('bottom')).toContain('ns-resize');
    expect(getResizeCursor('left')).toContain('ew-resize');
    expect(getResizeCursor('top-left')).toContain('nwse-resize');
    expect(getResizeCursor('top-right')).toContain('nesw-resize');
    expect(getResizeCursor('bottom-left')).toContain('nesw-resize');
    expect(getResizeCursor('bottom-right')).toContain('nwse-resize');
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

  test('editor is aligned at the start of viewport', async () => {
    const rectId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[200,200,100,100]',
      fillColor: 'red',
    });
    if (!rectId) {
      throw new Error('Cannot create shape');
    }
    await wait();

    service.selection.set({
      elements: [rectId],
      editing: false,
    });
    await wait();

    assertResizeCursors();
  });

  test('editor is not aligned at the start of viewport', async () => {
    const originalPadding = document.body.style.padding;
    document.body.style.padding = '100px 150px';

    try {
      const rectId = service.crud.addElement('shape', {
        shapeType: 'rect',
        xywh: '[200,200,100,100]',
        fillColor: 'red',
      });
      if (!rectId) {
        throw new Error('Cannot create shape');
      }
      await wait();

      service.selection.set({
        elements: [rectId],
        editing: false,
      });
      await wait();

      assertResizeCursors();
    } finally {
      document.body.style.padding = originalPadding;
    }
  });
});
