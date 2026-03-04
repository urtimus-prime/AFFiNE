import type { FrameBlockComponent } from '@blocksuite/affine/blocks/frame';
import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { DefaultTool } from '@blocksuite/affine/blocks/surface';
import { createGroupFromSelectedCommand } from '@blocksuite/affine/gfx/group';
import { assertType } from '@blocksuite/global/utils';
import { Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, drag, wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('lock', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];
  type Lockable = {
    lock: () => void;
    unlock: () => void;
    isLocked: () => boolean;
    isLockedBySelf: () => boolean;
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

  const createShape = (x: number, y: number, w = 50, h = 50) =>
    service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: `[${x},${y},${w},${h}]`,
    });

  const createFrame = (x: number, y: number, w: number, h: number) =>
    service.doc.addBlock(
      'affine:frame',
      {
        xywh: `[${x},${y},${w},${h}]`,
        title: new Text('Frame 1'),
      },
      service.surface.id
    );

  const getFrame = (id: string) => {
    const frame = service.doc.getBlock(id);
    if (!frame) {
      throw new Error(`Cannot find frame block: ${id}`);
    }
    assertType<FrameBlockComponent>(frame);
    return frame.model;
  };

  const getElement = (id: string) => {
    const element = service.crud.getElementById(id);
    if (!element) {
      throw new Error(`Cannot find element: ${id}`);
    }
    return element;
  };

  const isLockable = (value: unknown): value is Lockable => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const maybeLockable = value as Partial<Lockable>;
    return (
      typeof maybeLockable.lock === 'function' &&
      typeof maybeLockable.unlock === 'function' &&
      typeof maybeLockable.isLocked === 'function' &&
      typeof maybeLockable.isLockedBySelf === 'function'
    );
  };

  const getLockable = (id: string, name = id) => {
    const element = service.crud.getElementById(id);
    if (element && isLockable(element)) {
      return element;
    }

    const blockModel = service.doc.getBlock(id)?.model;
    if (blockModel && isLockable(blockModel)) {
      return blockModel;
    }

    throw new Error(`Cannot find lockable element: ${name}(${id})`);
  };

  const getGroupId = (id: string) => service.surface.getGroup(id)?.id ?? null;

  const expectContainer = async (
    elementId: string,
    containerId: string | null
  ) => {
    await waitForCondition(() => getGroupId(elementId) === containerId);
    expect(getGroupId(elementId)).toBe(containerId);
  };

  const createGroup = (elementIds: string[]) => {
    service.selection.set({
      elements: elementIds,
      editing: false,
    });
    const [_, result] = service.std.command.exec(
      createGroupFromSelectedCommand
    );
    if (!result.groupId) {
      throw new Error('group id is not found');
    }
    return result.groupId;
  };

  const clearSelection = () => {
    service.selection.set({
      elements: [],
      editing: false,
    });
  };

  const moveFrame = async (frameId: string, dx: number, dy: number) => {
    const center = service.viewport.toViewCoord(
      ...getFrame(frameId).elementBound.center
    );
    service.selection.set({
      elements: [frameId],
      editing: false,
    });
    await wait();

    drag(
      edgeless.host,
      { x: center[0], y: center[1] },
      { x: center[0] + dx, y: center[1] + dy }
    );
    await wait();
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgeless.service;
    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    edgeless.gfx.tool.setTool(DefaultTool);
    await wait();

    return cleanup;
  });

  test('elements can be locked and unlocked', async () => {
    const shape = createShape(100, 100);
    const shapeA = createShape(200, 100);
    const shapeB = createShape(300, 100);
    const frame = createFrame(50, 50, 120, 120);
    const edgelessText = service.crud.addBlock(
      'affine:edgeless-text',
      {
        xywh: '[100,220,80,40]',
      },
      service.surface.id
    );
    const note = addNote(doc, {
      xywh: '[240,220,120,80]',
    });

    if (!shape || !shapeA || !shapeB || !edgelessText) {
      throw new Error('element id is not found');
    }
    await wait();

    const group = createGroup([shapeA, shapeB]);
    await wait();

    for (const [name, id] of [
      ['shape', shape],
      ['frame', frame],
      ['edgelessText', edgelessText],
      ['note', note],
      ['group', group],
    ] as const) {
      const element = getLockable(id, name);
      expect(element.isLocked()).toBe(false);
      element.lock();
      await wait();
      expect(element.isLockedBySelf()).toBe(true);
      expect(element.isLocked()).toBe(true);
      element.unlock();
      await wait();
      expect(element.isLockedBySelf()).toBe(false);
      expect(element.isLocked()).toBe(false);
    }
  });

  test('locked element can still be selected by click', async () => {
    const shapeId = createShape(100, 100);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }

    getElement(shapeId).lock();
    await wait();
    clearSelection();
    click(edgeless.host, { x: 125, y: 125 });
    await wait();

    expect(service.selection.selectedIds).toEqual([shapeId]);
  });

  test('locked element should not be selected by box drag until unlocked', async () => {
    const shapeId = createShape(100, 100);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }

    getElement(shapeId).lock();
    await wait();
    clearSelection();
    drag(edgeless.host, { x: 90, y: 90 }, { x: 160, y: 160 });
    await wait();
    expect(service.selection.selectedIds).toHaveLength(0);

    getElement(shapeId).unlock();
    await wait();
    drag(edgeless.host, { x: 90, y: 90 }, { x: 160, y: 160 });
    await wait();
    expect(service.selection.selectedIds).toEqual([shapeId]);
  });

  test('descendant of locked group should be locked by ancestor until unlock', async () => {
    const shapeA = createShape(100, 100);
    const shapeB = createShape(150, 150);
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }
    const groupId = createGroup([shapeA, shapeB]);
    await wait();

    getElement(groupId).lock();
    await wait();
    expect(getElement(shapeA).isLockedByAncestor()).toBe(true);
    expect(getElement(shapeA).isLocked()).toBe(true);

    getElement(groupId).unlock();
    await wait();
    expect(getElement(shapeA).isLockedByAncestor()).toBe(false);
    expect(getElement(shapeA).isLocked()).toBe(false);
  });

  test('locked frame selected bound should include descendants', async () => {
    const frameId = createFrame(0, 0, 100, 100);
    const shapeId = createShape(70, 70);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, frameId);

    service.selection.set({
      elements: [frameId],
      editing: false,
    });
    await wait();
    const shape = getElement(shapeId);
    expect(shape.isLockedByAncestor()).toBe(false);

    getFrame(frameId).lock();
    await wait();
    expect(shape.isLockedByAncestor()).toBe(true);
    expect(shape.isLocked()).toBe(true);
    clearSelection();
    click(edgeless.host, { x: 95, y: 95 });
    await wait();
    expect(service.selection.selectedIds).toEqual([frameId]);

    getFrame(frameId).unlock();
    await wait();
    expect(shape.isLockedByAncestor()).toBe(false);
    clearSelection();
    click(edgeless.host, { x: 95, y: 95 });
    await wait();
    expect(service.selection.selectedIds).toEqual([shapeId]);
  });

  test('locked frame and children should not move by drag until unlocked', async () => {
    const frameId = createFrame(50, 50, 200, 200);
    const shapeA = createShape(100, 100);
    const shapeB = createShape(150, 150);
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeA, frameId);
    await expectContainer(shapeB, frameId);

    const beforeFrame = getFrame(frameId).elementBound;
    const beforeA = getElement(shapeA).elementBound;
    const beforeB = getElement(shapeB).elementBound;

    getFrame(frameId).lock();
    await wait();
    await moveFrame(frameId, 50, 50);

    const lockedFrame = getFrame(frameId).elementBound;
    const lockedA = getElement(shapeA).elementBound;
    const lockedB = getElement(shapeB).elementBound;
    expect(lockedFrame.x).toBeCloseTo(beforeFrame.x, 0);
    expect(lockedFrame.y).toBeCloseTo(beforeFrame.y, 0);
    expect(lockedA.x).toBeCloseTo(beforeA.x, 0);
    expect(lockedA.y).toBeCloseTo(beforeA.y, 0);
    expect(lockedB.x).toBeCloseTo(beforeB.x, 0);
    expect(lockedB.y).toBeCloseTo(beforeB.y, 0);

    getFrame(frameId).unlock();
    await wait();
    await moveFrame(frameId, 50, 50);

    const movedFrame = getFrame(frameId).elementBound;
    const movedA = getElement(shapeA).elementBound;
    const movedB = getElement(shapeB).elementBound;
    expect(movedFrame.x - beforeFrame.x).toBeCloseTo(50, 0);
    expect(movedFrame.y - beforeFrame.y).toBeCloseTo(50, 0);
    expect(movedA.x - beforeA.x).toBeCloseTo(50, 0);
    expect(movedA.y - beforeA.y).toBeCloseTo(50, 0);
    expect(movedB.x - beforeB.x).toBeCloseTo(50, 0);
    expect(movedB.y - beforeB.y).toBeCloseTo(50, 0);
  });

  test('locked child should still move with unlocked parent frame', async () => {
    const frameId = createFrame(50, 50, 200, 200);
    const shapeId = createShape(100, 100);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, frameId);

    const shape = getElement(shapeId);
    shape.lock();
    await wait();
    const before = shape.elementBound;

    await moveFrame(frameId, 50, 50);
    const after = shape.elementBound;
    expect(after.x - before.x).toBeCloseTo(50, 0);
    expect(after.y - before.y).toBeCloseTo(50, 0);
  });

  test('locked frame should not add new children until unlocked', async () => {
    const frameId = createFrame(50, 50, 200, 200);
    getFrame(frameId).lock();
    await wait();

    const shapeId = createShape(100, 100);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await wait();
    await expectContainer(shapeId, null);

    getFrame(frameId).unlock();
    await wait();

    drag(edgeless.host, { x: 125, y: 125 }, { x: 130, y: 130 });
    await expectContainer(shapeId, frameId);
  });

  test('unlocking parent should not unlock locked descendant', async () => {
    const frameId = createFrame(50, 50, 200, 200);
    const shapeId = createShape(100, 100);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, frameId);

    const frame = getFrame(frameId);
    const shape = getElement(shapeId);
    shape.lock();
    frame.lock();
    await wait();

    frame.unlock();
    await wait();

    expect(frame.isLocked()).toBe(false);
    expect(shape.isLockedBySelf()).toBe(true);
    expect(shape.isLocked()).toBe(true);
  });

  test('locking multiple elements can be grouped then unlocked to children', async () => {
    const shapeA = createShape(100, 100);
    const shapeB = createShape(150, 150);
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }

    const groupId = createGroup([shapeA, shapeB]);
    const group = getElement(groupId);
    group.lock();
    await wait();

    expect(service.selection.selectedIds).toEqual([groupId]);
    expect(group.isLocked()).toBe(true);

    group.unlock();
    await wait();
    expect(group.isLocked()).toBe(false);
  });

  test('locking a group should not create new group', async () => {
    const shapeA = createShape(100, 100);
    const shapeB = createShape(150, 150);
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }

    const groupId = createGroup([shapeA, shapeB]);
    const before = service.elements.filter(
      element => element.type === 'group'
    ).length;

    getElement(groupId).lock();
    await wait();

    const after = service.elements.filter(
      element => element.type === 'group'
    ).length;
    expect(after).toBe(before);
  });
});
