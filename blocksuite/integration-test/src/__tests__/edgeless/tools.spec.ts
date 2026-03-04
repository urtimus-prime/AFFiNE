import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import {
  DefaultTool,
  type SurfaceBlockComponent,
} from '@blocksuite/affine/blocks/surface';
import { BrushTool, EraserTool } from '@blocksuite/affine-gfx-brush';
import { PanTool } from '@blocksuite/affine-gfx-pointer';
import { Point } from '@blocksuite/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  click,
  drag,
  multiTouchDown,
  multiTouchMove,
  multiTouchUp,
  pointerdown,
  pointermove,
  pointerup,
  wait,
} from '../utils/common.js';
import { addNote, getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type EdgelessRootElement = HTMLElement & {
  store?: {
    readonly: boolean;
  };
};

const waitForCondition = async (condition: () => boolean, retries = 40) => {
  for (let i = 0; i < retries; i++) {
    if (condition()) {
      return;
    }
    await wait(30);
  }
  expect(condition()).toBe(true);
};

describe('default tool', () => {
  let surface!: SurfaceBlockComponent;
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');

    edgeless = getDocRootBlock(doc, editor, 'edgeless');
    surface = getSurface(window.doc, window.editor);
    service = edgeless.service;

    edgeless.gfx.tool.setTool(DefaultTool);

    return cleanup;
  });

  test('element click selection', async () => {
    const id = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
      fillColor: 'red',
    });

    await wait();

    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);

    click(edgeless.host, { x: 0, y: 50 });

    expect(edgeless.service.selection.surfaceSelections[0].elements).toEqual([
      id,
    ]);
  });

  test('element drag moving', async () => {
    const id = edgeless.service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
      fillColor: 'red',
    });
    await wait();

    edgeless.service.viewport.setViewport(1, [
      edgeless.service.viewport.width / 2,
      edgeless.service.viewport.height / 2,
    ]);
    await wait();

    click(edgeless.host, { x: 0, y: 50 });
    drag(edgeless.host, { x: 0, y: 50 }, { x: 0, y: 150 });
    await wait();

    const element = service.crud.getElementById(id!)!;
    expect(element.xywh).toEqual(`[0,100,100,100]`);
  });

  test('block drag moving', async () => {
    const noteId = addNote(doc);

    await wait();

    edgeless.service.viewport.setViewport(1, [
      surface.renderer.viewport.width / 2,
      surface.renderer.viewport.height / 2,
    ]);
    await wait();

    click(edgeless.host, { x: 50, y: 50 });
    expect(edgeless.service.selection.surfaceSelections[0].elements).toEqual([
      noteId,
    ]);
    drag(edgeless.host, { x: 50, y: 50 }, { x: 150, y: 150 });
    await wait();

    const element = service.crud.getElementById(noteId)!;
    const [x, y] = JSON.parse(element.xywh);

    expect(x).toEqual(100);
    expect(y).toEqual(100);
  });
});

describe('pan tool', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const getCurrentToolName = () => edgeless.gfx.tool.currentToolName$.peek();

  const dispatchSpace = (type: 'keydown' | 'keyup') => {
    document.dispatchEvent(
      new KeyboardEvent(type, {
        key: ' ',
        code: 'Space',
        bubbles: true,
        cancelable: true,
      })
    );
  };

  const addRect = () => {
    const id = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,100,100]',
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

    return cleanup;
  });

  test('pan tool basic', async () => {
    const shapeId = addRect();
    await wait();

    edgeless.gfx.tool.setTool(PanTool, { panning: false });
    await waitForCondition(() => getCurrentToolName() === 'pan');

    drag(edgeless.host, { x: 105, y: 105 }, { x: 125, y: 125 });
    await wait();

    const element = service.crud.getElementById(shapeId);
    expect(element?.xywh).toBe('[100,100,100,100]');

    edgeless.gfx.tool.setTool(DefaultTool);
    click(edgeless.host, { x: 125, y: 125 });
    await wait();

    expect(service.selection.surfaceSelections[0]?.elements ?? []).toEqual([
      shapeId,
    ]);
  });

  test('pan tool shortcut', async () => {
    const shapeId = addRect();
    await wait();

    click(edgeless.host, { x: 105, y: 105 });
    await wait();
    expect(service.selection.surfaceSelections[0]?.elements ?? []).toEqual([
      shapeId,
    ]);

    dispatchSpace('keydown');
    await waitForCondition(() => getCurrentToolName() === 'pan');

    drag(edgeless.host, { x: 105, y: 105 }, { x: 125, y: 125 });
    await wait();

    dispatchSpace('keyup');
    await waitForCondition(() => getCurrentToolName() === 'default');

    click(edgeless.host, { x: 125, y: 125 });
    await wait();
    expect(service.selection.surfaceSelections[0]?.elements ?? []).toEqual([
      shapeId,
    ]);
  });

  test('pan tool shortcut should revert to the previous tool on keyup', async () => {
    edgeless.gfx.tool.setTool(BrushTool);
    await waitForCondition(() => getCurrentToolName() === 'brush');
    click(edgeless.host, { x: 10, y: 10 });
    await wait();

    dispatchSpace('keydown');
    await waitForCondition(() => getCurrentToolName() === 'pan');

    dispatchSpace('keyup');
    await waitForCondition(() => getCurrentToolName() === 'brush');
  });

  test('pan tool shortcut does not affect other tools while dragging', async () => {
    edgeless.gfx.tool.setTool(BrushTool);
    await waitForCondition(() => getCurrentToolName() === 'brush');

    pointerdown(edgeless.host, { x: 100, y: 110 });
    pointermove(edgeless.host, { x: 200, y: 300 });
    dispatchSpace('keydown');
    await wait();
    expect(getCurrentToolName()).toBe('brush');
    pointerup(edgeless.host, { x: 200, y: 300 });
    dispatchSpace('keyup');
    await wait();

    edgeless.gfx.tool.setTool(EraserTool);
    await waitForCondition(() => getCurrentToolName() === 'eraser');

    pointerdown(edgeless.host, { x: 100, y: 110 });
    pointermove(edgeless.host, { x: 200, y: 300 });
    dispatchSpace('keydown');
    await wait();
    expect(getCurrentToolName()).toBe('eraser');
    pointerup(edgeless.host, { x: 200, y: 300 });
    dispatchSpace('keyup');
  });

  test('pan tool shortcut when user is editing', async () => {
    const noteId = addNote(doc);
    await wait();
    service.selection.set({
      elements: [noteId],
      editing: true,
    });
    await wait();

    expect(getCurrentToolName()).toBe('default');
    dispatchSpace('keydown');
    await wait();
    expect(getCurrentToolName()).toBe('default');
    dispatchSpace('keyup');
  });

  describe('pan tool in readonly mode', () => {
    const setReadonly = (value = true) => {
      const root = document.querySelector<EdgelessRootElement>(
        'affine-edgeless-root'
      );
      if (!root?.store) {
        throw new Error('Cannot find edgeless root store');
      }
      root.store.readonly = value;
    };

    const getNoteRect = (noteId: string) => {
      const noteElement = document.querySelector<HTMLElement>(
        `affine-edgeless-note[data-block-id="${noteId}"]`
      );
      if (!noteElement) {
        throw new Error('Cannot find note element');
      }
      return noteElement.getBoundingClientRect();
    };

    test('can be used by keyboard', async () => {
      const noteId = addNote(doc, {
        xywh: '[100,200,800,120]',
      });
      await waitForCondition(
        () =>
          !!document.querySelector(
            `affine-edgeless-note[data-block-id="${noteId}"]`
          )
      );
      const originalRect = getNoteRect(noteId);

      setReadonly(true);
      await wait();
      click(edgeless.host, { x: 50, y: 100 });
      await wait();

      dispatchSpace('keydown');
      await waitForCondition(() => getCurrentToolName() === 'pan');

      drag(edgeless.host, { x: 300, y: 300 }, { x: 400, y: 400 });
      await waitForCondition(() => {
        const rect = getNoteRect(noteId);
        return rect.x > originalRect.x && rect.y > originalRect.y;
      });

      dispatchSpace('keyup');
    });

    test('can be used by multi-touch', async () => {
      const noteId = addNote(doc, {
        xywh: '[100,200,800,120]',
      });
      await waitForCondition(
        () =>
          !!document.querySelector(
            `affine-edgeless-note[data-block-id="${noteId}"]`
          )
      );
      const originalRect = getNoteRect(noteId);

      setReadonly(true);
      await wait();

      const from = [new Point(300, 300), new Point(400, 300)];
      const to = [new Point(350, 350), new Point(450, 350)];
      multiTouchDown(edgeless.host, from);
      multiTouchMove(edgeless.host, from, to);
      multiTouchUp(edgeless.host, to);

      await waitForCondition(() => {
        const rect = getNoteRect(noteId);
        return rect.x > originalRect.x && rect.y > originalRect.y;
      });
    });
  });
});

describe('eraser tool', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');

    edgeless = getDocRootBlock(doc, editor, 'edgeless');
    service = edgeless.service;
    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    await wait();

    edgeless.gfx.tool.setTool(EraserTool);

    return cleanup;
  });

  test('erase shape', async () => {
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
      fillColor: 'red',
    });
    if (!shapeId) {
      throw new Error('Cannot create shape');
    }
    await wait();

    drag(edgeless.host, { x: 50, y: 150 }, { x: 50, y: 50 });
    click(edgeless.host, { x: 50, y: 50 });
    await wait();

    expect(service.crud.getElementById(shapeId)).toBeNull();
    expect(service.selection.surfaceSelections[0]?.elements ?? []).toEqual([]);
  });

  test('erase note', async () => {
    const noteId = addNote(doc);
    if (!noteId) {
      throw new Error('Cannot create note');
    }
    await wait();

    drag(edgeless.host, { x: -20, y: -20 }, { x: 10, y: 10 });
    await wait();

    expect(service.crud.getElementById(noteId)).toBeNull();
  });
});
