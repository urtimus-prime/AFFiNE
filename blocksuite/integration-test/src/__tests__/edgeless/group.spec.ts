import {
  duplicate,
  type EdgelessRootBlockComponent,
} from '@blocksuite/affine/blocks/root';
import { ConnectorTool } from '@blocksuite/affine/gfx/connector';
import {
  createGroupFromSelectedCommand,
  mountGroupTitleEditor,
  ungroupCommand,
} from '@blocksuite/affine/gfx/group';
import {
  type ConnectorElementModel,
  ConnectorMode,
  GroupElementModel,
  LayoutType,
  NoteDisplayMode,
} from '@blocksuite/affine/model';
import type { MindmapElementModel } from '@blocksuite/affine-model';
import { PointerEventState } from '@blocksuite/std';
import type { GfxModel } from '@blocksuite/std/gfx';
import {
  batchAddChildren,
  batchRemoveChildren,
  GfxElementModelView,
} from '@blocksuite/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('group', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const createGroupFromSelection = (elementIds: string[]) => {
    service.selection.set({
      elements: elementIds,
      editing: false,
    });
    const [_, result] = service.std.command.exec(
      createGroupFromSelectedCommand
    );
    if (!result.groupId) {
      throw new Error('groupId is not found');
    }
    return result.groupId;
  };

  const getGroupId = (id: string) => service.surface.getGroup(id)?.id ?? null;

  const getParentCountMap = (ids: string[]) => {
    return ids.reduce(
      (result, id) => {
        const parentId = getGroupId(id);
        const key = parentId ?? 'null';
        result[key] = (result[key] ?? 0) + 1;
        return result;
      },
      {} as Record<string, number>
    );
  };

  const duplicateElement = async (id: string) => {
    const model = service.crud.getElementById(id);
    if (!model) {
      throw new Error(`Cannot find element: ${id}`);
    }

    const prevIds = new Set(service.elements.map(element => element.id));
    await duplicate(edgeless, [model as GfxModel], false);
    await wait();

    return service.elements.filter(element => !prevIds.has(element.id));
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgeless.service;

    return cleanup;
  });

  const setViewport = async () => {
    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    await wait();
  };

  const getLatestConnector = () => {
    const connectors = service.elements.filter(
      element => element.type === 'connector'
    ) as ConnectorElementModel[];
    const connector = connectors.at(-1);
    if (!connector) {
      throw new Error('connector is not found');
    }
    return connector;
  };

  const createTwoGroups = () => {
    const shapeA = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shapeB = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,100,100]',
    });
    const shapeC = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[500,0,100,100]',
    });
    const shapeD = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[600,100,100,100]',
    });
    if (!shapeA || !shapeB || !shapeC || !shapeD) {
      throw new Error('shape id is not found');
    }

    const group1Id = createGroupFromSelection([shapeA, shapeB]);
    const group2Id = createGroupFromSelection([shapeC, shapeD]);

    const group1 = service.crud.getElementById(group1Id);
    const group2 = service.crud.getElementById(group2Id);

    if (!(group1 instanceof GroupElementModel)) {
      throw new Error('group1 is not found');
    }
    if (!(group2 instanceof GroupElementModel)) {
      throw new Error('group2 is not found');
    }

    return {
      shapeA,
      group1,
      group1Children: Array.from(group1.children.keys()),
      group2,
      group2Children: Array.from(group2.children.keys()),
    };
  };

  type GroupTitleEditorElement = HTMLElement & {
    inlineEditor?: {
      setText: (text: string) => void;
    };
    inlineEditorContainer?: HTMLElement | null;
  };

  const waitForCondition = async (condition: () => boolean, retries = 80) => {
    for (let i = 0; i < retries; i++) {
      if (condition()) {
        return;
      }
      await wait(30);
    }
    expect(condition()).toBe(true);
  };

  const createGroupForTitle = () => {
    const shapeA = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shapeB = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,0,100,100]',
    });
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }

    const groupId = createGroupFromSelection([shapeA, shapeB]);
    const group = service.crud.getElementById(groupId);
    if (!(group instanceof GroupElementModel)) {
      throw new Error('group is not found');
    }
    return group;
  };

  const getGroupTitleEditor = () =>
    document.querySelector<GroupTitleEditorElement>(
      'edgeless-group-title-editor'
    );

  const waitForGroupTitleEditor = async (mounted: boolean) => {
    await waitForCondition(() => {
      return Boolean(getGroupTitleEditor()) === mounted;
    });
  };

  const waitForGroupTitleBound = async (group: GroupElementModel) => {
    await waitForCondition(() => Boolean(group.externalXYWH));
  };

  const dblclickGroupTitle = async (group: GroupElementModel) => {
    const view = service.gfx.view.get(group.id);
    if (!view || !(view instanceof GfxElementModelView)) {
      throw new Error('group view is not found');
    }

    const rect = edgeless.host.getBoundingClientRect();
    const pointerState = new PointerEventState({
      event: new PointerEvent('pointerup', {
        clientX: rect.left,
        clientY: rect.top,
        bubbles: true,
        pointerId: 1,
        isPrimary: true,
      }),
      rect,
      startX: 0,
      startY: 0,
      last: null,
    });

    view.dispatch('dblclick', pointerState);
    await wait();
  };

  const dispatchKey = (
    type: 'keydown' | 'keyup',
    init: {
      key: string;
      code?: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
    }
  ) => {
    const target =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : document.body;
    target.dispatchEvent(
      new KeyboardEvent(type, {
        key: init.key,
        code: init.code ?? init.key,
        bubbles: true,
        composed: true,
        cancelable: true,
        ctrlKey: init.ctrlKey ?? false,
        metaKey: init.metaKey ?? false,
        altKey: init.altKey ?? false,
        shiftKey: init.shiftKey ?? false,
      })
    );
  };

  const pressEnter = () => {
    dispatchKey('keydown', { key: 'Enter', code: 'Enter' });
    dispatchKey('keyup', { key: 'Enter', code: 'Enter' });
  };

  const quickConnect = async (
    source: GfxModel,
    start: [number, number],
    target: [number, number]
  ) => {
    edgeless.gfx.tool.setTool(ConnectorTool, {
      mode: ConnectorMode.Curve,
    });
    const connectorTool = edgeless.gfx.tool.get(ConnectorTool);
    connectorTool.quickConnect(
      service.viewport.toViewCoord(start[0], start[1]),
      source
    );
    await wait();

    connectorTool.findTargetByPoint(service.viewport.toViewCoord(...target));
    await wait();

    return {
      connector: getLatestConnector(),
      connectorTool,
    };
  };

  const expectAbsolutePath = (
    connector: ConnectorElementModel,
    expectedStart: [number, number],
    expectedEnd: [number, number]
  ) => {
    const [start, end] = connector.absolutePath;
    if (!start || !end) {
      throw new Error('absolutePath is not found');
    }
    expect(start[0]).toBeCloseTo(expectedStart[0], 0);
    expect(start[1]).toBeCloseTo(expectedStart[1], 0);
    expect(end[0]).toBeCloseTo(expectedEnd[0], 0);
    expect(end[1]).toBeCloseTo(expectedEnd[1], 0);
  };

  test('group with no children will be removed automatically', () => {
    const map = new Y.Map<boolean>();
    const ids = Array.from({ length: 2 })
      .map(() => {
        const id = service.crud.addElement('shape', {
          shapeType: 'rect',
        })!;
        map.set(id, true);

        return id;
      })
      .concat(
        Array.from({ length: 2 }).map(() => {
          const id = addNote(doc);
          map.set(id, true);
          return id;
        })
      );
    service.crud.addElement('group', { children: map });
    doc.captureSync();
    expect(service.elements.length).toBe(3);

    service.removeElement(ids[0]);
    service.removeElement(ids[1]);
    doc.captureSync();
    expect(service.elements.length).toBe(1);

    service.removeElement(ids[2]);
    service.removeElement(ids[3]);
    doc.captureSync();
    expect(service.elements.length).toBe(0);

    doc.undo();
    expect(service.elements.length).toBe(1);
    doc.redo();
    expect(service.elements.length).toBe(0);
  });

  test('remove group should remove its children at the same time', () => {
    const map = new Y.Map<boolean>();
    const doc = service.doc;
    const noteId = addNote(doc);
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'rect',
    });
    if (!shapeId) {
      throw new Error('shapeId is not found');
    }

    map.set(noteId, true);
    map.set(shapeId, true);
    const groupId = service.crud.addElement('group', { children: map });
    if (!groupId) {
      throw new Error('groupId is not found');
    }
    expect(service.elements.length).toBe(2);
    expect(doc.getBlock(noteId)).toBeDefined();
    doc.captureSync();

    service.removeElement(groupId);
    expect(service.elements.length).toBe(0);
    expect(doc.getBlock(noteId)).toBeUndefined();

    doc.undo();
    expect(doc.getBlock(noteId)).toBeDefined();
    expect(service.elements.length).toBe(2);
  });

  test("group's xywh should update automatically when children change", async () => {
    const shape1 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    if (!shape1) {
      throw new Error('shape1 is not found');
    }
    const shape2 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,100,100]',
    });
    if (!shape2) {
      throw new Error('shape2 is not found');
    }
    const note1 = addNote(doc, {
      displayMode: NoteDisplayMode.DocAndEdgeless,
      xywh: '[200,200,800,100]',
      edgeless: {
        style: {
          borderRadius: 8,
          borderSize: 4,
          borderStyle: 'solid',
          shadowType: '--affine-note-shadow-box',
        },
        collapse: true,
        collapsedHeight: 100,
      },
    });
    const children = new Y.Map<boolean>();

    children.set(shape1, true);
    children.set(shape2, true);
    children.set(note1, true);

    const groupId = service.crud.addElement('group', { children });
    if (!groupId) {
      throw new Error('groupId is not found');
    }

    const group = service.crud.getElementById(groupId) as GroupElementModel;
    const assertInitial = () => {
      expect(group.x).toBe(0);
      expect(group.y).toBe(0);
      expect(group.w).toBe(1000);
      expect(group.h).toBe(300);
    };

    doc.captureSync();
    await wait();
    assertInitial();

    service.removeElement(note1);
    await wait();
    expect(group.x).toBe(0);
    expect(group.y).toBe(0);
    expect(group.w).toBe(200);
    expect(group.h).toBe(200);
    doc.captureSync();

    doc.undo();
    await wait();
    assertInitial();

    service.crud.updateElement(note1, {
      xywh: '[300,300,800,100]',
    });
    await wait();
    expect(group.x).toBe(0);
    expect(group.y).toBe(0);
    expect(group.w).toBe(1100);
    expect(group.h).toBe(400);
    doc.captureSync();

    doc.undo();
    await wait();
    assertInitial();

    service.removeElement(shape1);
    await wait();
    expect(group.x).toBe(100);
    expect(group.y).toBe(100);
    expect(group.w).toBe(900);
    expect(group.h).toBe(200);
    doc.captureSync();

    doc.undo();
    await wait();
    assertInitial();

    service.crud.updateElement(shape1, {
      xywh: '[100,100,100,100]',
    });
    await wait();
    expect(group.x).toBe(100);
    expect(group.y).toBe(100);
    expect(group.w).toBe(900);
    expect(group.h).toBe(200);
    doc.captureSync();

    doc.undo();
    await wait();
    assertInitial();
  });

  test('empty group should have all zero xywh', () => {
    const map = new Y.Map<boolean>();
    const groupId = service.crud.addElement('group', { children: map });
    if (!groupId) {
      throw new Error('groupId is not found');
    }
    const group = service.crud.getElementById(groupId) as GroupElementModel;

    expect(group.x).toBe(0);
    expect(group.y).toBe(0);
    expect(group.w).toBe(0);
    expect(group.h).toBe(0);
  });

  test('descendant of group should not contain itself', () => {
    const groupIds = [1, 2, 3].map(_ => {
      return service.crud.addElement('group', {
        children: new Y.Map<boolean>(),
      }) as string;
    });
    const groups = groupIds.map(
      id => service.crud.getElementById(id) as GroupElementModel
    );

    groups.forEach(group => {
      expect(group.descendantElements).toHaveLength(0);
    });

    groups[0].addChild(groups[1]);
    groups[1].addChild(groups[2]);
    groups[2].addChild(groups[0]);

    expect(groups[0].descendantElements).toHaveLength(2);
    expect(groups[1].descendantElements).toHaveLength(1);
    expect(groups[2].descendantElements).toHaveLength(0);
  });

  test('group in group', () => {
    const shape1 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shape2 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,0,100,100]',
    });
    const shape3 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[200,0,100,100]',
    });
    if (!shape1 || !shape2 || !shape3) {
      throw new Error('shape id is not found');
    }

    const outerGroupId = createGroupFromSelection([shape1, shape2, shape3]);
    doc.captureSync();

    const innerGroupId = createGroupFromSelection([shape1, shape2]);
    const allIds = [shape1, shape2, shape3, innerGroupId, outerGroupId];
    expect(getParentCountMap(allIds)).toEqual({
      [innerGroupId]: 2,
      [outerGroupId]: 2,
      null: 1,
    });

    doc.undo();
    expect(getParentCountMap([shape1, shape2, shape3, outerGroupId])).toEqual({
      [outerGroupId]: 3,
      null: 1,
    });

    doc.redo();
    expect(getParentCountMap(allIds)).toEqual({
      [innerGroupId]: 2,
      [outerGroupId]: 2,
      null: 1,
    });
  });

  test('ungroup in group', () => {
    const shape1 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shape2 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,0,100,100]',
    });
    const shape3 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[200,0,100,100]',
    });
    if (!shape1 || !shape2 || !shape3) {
      throw new Error('shape id is not found');
    }

    const outerGroupId = createGroupFromSelection([shape1, shape2, shape3]);
    const innerGroupId = createGroupFromSelection([shape1, shape2]);
    doc.captureSync();

    service.std.command.exec(ungroupCommand, {
      group: service.crud.getElementById(innerGroupId) as GroupElementModel,
    });
    expect(getParentCountMap([shape1, shape2, shape3, outerGroupId])).toEqual({
      [outerGroupId]: 3,
      null: 1,
    });

    doc.undo();
    expect(
      getParentCountMap([shape1, shape2, shape3, innerGroupId, outerGroupId])
    ).toEqual({
      [innerGroupId]: 2,
      [outerGroupId]: 2,
      null: 1,
    });

    doc.redo();
    expect(getParentCountMap([shape1, shape2, shape3, outerGroupId])).toEqual({
      [outerGroupId]: 3,
      null: 1,
    });
  });

  test('release element from group', () => {
    const shape1 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shape2 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,0,100,100]',
    });
    const shape3 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[200,0,100,100]',
    });
    if (!shape1 || !shape2 || !shape3) {
      throw new Error('shape id is not found');
    }

    const outerGroupId = createGroupFromSelection([shape1, shape2, shape3]);
    const shape = service.crud.getElementById(shape1);
    if (!shape || !shape.group) {
      throw new Error('shape group is not found');
    }

    doc.captureSync();

    const group = shape.group;
    batchRemoveChildren(group, [shape]);
    shape.index = service.layer.generateIndex();

    const parent = group.group;
    if (parent && parent instanceof GroupElementModel) {
      batchAddChildren(parent, [shape]);
    }

    expect(getParentCountMap([shape1, shape2, shape3, outerGroupId])).toEqual({
      [outerGroupId]: 2,
      null: 2,
    });

    doc.undo();
    expect(getParentCountMap([shape1, shape2, shape3, outerGroupId])).toEqual({
      [outerGroupId]: 3,
      null: 1,
    });

    doc.redo();
    expect(getParentCountMap([shape1, shape2, shape3, outerGroupId])).toEqual({
      [outerGroupId]: 2,
      null: 2,
    });
  });

  test('release group from group', () => {
    const shape1 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shape2 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,0,100,100]',
    });
    const shape3 = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[200,0,100,100]',
    });
    if (!shape1 || !shape2 || !shape3) {
      throw new Error('shape id is not found');
    }

    const outerGroupId = createGroupFromSelection([shape1, shape2, shape3]);
    const innerGroupId = createGroupFromSelection([shape1, shape2]);

    const innerGroup = service.crud.getElementById(innerGroupId);
    if (!innerGroup || !innerGroup.group) {
      throw new Error('inner group is not found');
    }

    doc.captureSync();

    const group = innerGroup.group;
    batchRemoveChildren(group, [innerGroup]);
    innerGroup.index = service.layer.generateIndex();

    const parent = group.group;
    if (parent && parent instanceof GroupElementModel) {
      batchAddChildren(parent, [innerGroup]);
    }

    expect(
      getParentCountMap([shape1, shape2, shape3, innerGroupId, outerGroupId])
    ).toEqual({
      [innerGroupId]: 2,
      [outerGroupId]: 1,
      null: 2,
    });

    doc.undo();
    expect(
      getParentCountMap([shape1, shape2, shape3, innerGroupId, outerGroupId])
    ).toEqual({
      [innerGroupId]: 2,
      [outerGroupId]: 2,
      null: 1,
    });

    doc.redo();
    expect(
      getParentCountMap([shape1, shape2, shape3, innerGroupId, outerGroupId])
    ).toEqual({
      [innerGroupId]: 2,
      [outerGroupId]: 1,
      null: 2,
    });
  });

  test('copy and paste group', async () => {
    const shapeA = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shapeB = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,0,100,100]',
    });
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }

    const originGroupId = createGroupFromSelection([shapeA, shapeB]);
    const added = await duplicateElement(originGroupId);
    const copiedGroup = added.find(element => element.type === 'group');
    if (!(copiedGroup instanceof GroupElementModel)) {
      throw new Error('copied group is not found');
    }

    expect(
      getParentCountMap(service.elements.map(element => element.id))
    ).toEqual({
      [originGroupId]: 2,
      [copiedGroup.id]: 2,
      null: 2,
    });
    expect(
      (service.crud.getElementById(originGroupId) as GroupElementModel).children
        .size
    ).toBe(2);
    expect(copiedGroup.children.size).toBe(2);
  });

  test('copy and paste group with connector', async () => {
    await setViewport();

    const shapeA = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shapeB = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,0,100,100]',
    });
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }
    const sourceShape = service.crud.getElementById(shapeA);
    if (!sourceShape) {
      throw new Error('source shape is not found');
    }

    const { connector } = await quickConnect(sourceShape, [100, 50], [150, 50]);
    const originGroupId = createGroupFromSelection([
      shapeA,
      shapeB,
      connector.id,
    ]);
    const added = await duplicateElement(originGroupId);

    const copiedGroup = added.find(element => element.type === 'group');
    const copiedConnector = added.find(element => element.type === 'connector');
    if (!(copiedGroup instanceof GroupElementModel)) {
      throw new Error('copied group is not found');
    }
    if (!(copiedConnector && copiedConnector.type === 'connector')) {
      throw new Error('copied connector is not found');
    }

    expect(
      getParentCountMap(service.elements.map(element => element.id))
    ).toEqual({
      [originGroupId]: 3,
      [copiedGroup.id]: 3,
      null: 2,
    });
    expect(
      (service.crud.getElementById(originGroupId) as GroupElementModel).children
        .size
    ).toBe(3);
    expect(copiedGroup.children.size).toBe(3);

    const copiedConnectorModel = service.crud.getElementById(
      copiedConnector.id
    ) as ConnectorElementModel;
    if (!copiedConnectorModel.source?.id || !copiedConnectorModel.target?.id) {
      throw new Error('copied connector endpoint is not found');
    }
    expect(copiedGroup.children.has(copiedConnectorModel.id)).toBe(true);
    expect(copiedGroup.children.has(copiedConnectorModel.source.id)).toBe(true);
    expect(copiedGroup.children.has(copiedConnectorModel.target.id)).toBe(true);
  });

  test('copy and paste group with shape and note inside', async () => {
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    const noteId = addNote(doc, {
      xywh: '[100,-100,800,100]',
    });

    const groupId = createGroupFromSelection([shapeId, noteId]);
    expect(service.edgelessElements.length).toBe(3);

    await duplicateElement(groupId);
    expect(service.edgelessElements.length).toBe(6);
  });

  test('copy and paste group with group inside', async () => {
    const shapeA = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const shapeB = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[200,0,100,100]',
    });
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }

    const innerGroupId = createGroupFromSelection([shapeA, shapeB]);
    const noteId = addNote(doc, {
      xywh: '[100,-200,800,100]',
    });
    const outerGroupId = createGroupFromSelection([innerGroupId, noteId]);

    expect(service.edgelessElements.length).toBe(5);
    await duplicateElement(outerGroupId);
    expect(service.edgelessElements.length).toBe(10);
  });

  test('copy and paste group with frame inside', async () => {
    const shapeA = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    if (!shapeA) {
      throw new Error('shape id is not found');
    }
    const noteId = addNote(doc, {
      xywh: '[100,-100,800,100]',
    });

    service.selection.set({
      elements: [shapeA, noteId],
      editing: false,
    });
    const frame = service.frame.createFrameOnSelected();
    if (!frame) {
      throw new Error('frame is not found');
    }

    const shapeB = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[700,0,100,100]',
    });
    if (!shapeB) {
      throw new Error('shape id is not found');
    }

    const groupId = createGroupFromSelection([frame.id, shapeB]);

    expect(service.edgelessElements.length).toBe(5);
    await duplicateElement(groupId);
    expect(service.edgelessElements.length).toBe(10);
  });

  test('connector quick connect should connect group to group', async () => {
    await setViewport();
    const { group2 } = createTwoGroups();
    const { connector } = await quickConnect(group2, [500, 100], [200, 50]);
    expect(connector.source?.id).toBe(group2.id);
    expectAbsolutePath(connector, [500, 100], [200, 50]);
  });

  test('connector quick connect should connect group to a child in another group', async () => {
    await setViewport();
    const { group2, group1Children } = createTwoGroups();

    const { connector, connectorTool } = await quickConnect(
      group2,
      [500, 100],
      [200, 100]
    );
    expectAbsolutePath(connector, [500, 100], [200, 100]);

    connectorTool.findTargetByPoint(service.viewport.toViewCoord(190, 150));
    await wait();
    expect(group1Children).toContain(connector.target?.id);
    expectAbsolutePath(connector, [500, 100], [200, 150]);
  });

  test('connector quick connect should allow switching target from child to group', async () => {
    await setViewport();
    const { shapeA, group2, group2Children } = createTwoGroups();
    const sourceShape = service.crud.getElementById(shapeA);
    if (!sourceShape) {
      throw new Error('source shape is not found');
    }

    const { connector, connectorTool } = await quickConnect(
      sourceShape,
      [100, 50],
      [610, 50]
    );
    expect([group2.id, ...group2Children]).toContain(connector.target?.id);
    expectAbsolutePath(connector, [100, 50], [600, 0]);

    connectorTool.findTargetByPoint(service.viewport.toViewCoord(600, 100));
    await wait();
    expect([group2.id, ...group2Children]).toContain(connector.target?.id);
    expectAbsolutePath(connector, [100, 50], [600, 100]);
  });

  test('edit group title by component toolbar', async () => {
    const group = createGroupForTitle();
    expect(getGroupTitleEditor()).toBeNull();

    await waitForGroupTitleBound(group);
    mountGroupTitleEditor(group, edgeless);
    await waitForGroupTitleEditor(true);
  });

  test('edit group title by dbclick', async () => {
    const group = createGroupForTitle();
    expect(getGroupTitleEditor()).toBeNull();

    await waitForGroupTitleBound(group);
    await dblclickGroupTitle(group);
    await waitForGroupTitleEditor(true);
    await waitForCondition(() => !!getGroupTitleEditor()?.inlineEditor);

    const titleEditor = getGroupTitleEditor();
    if (!titleEditor?.inlineEditor) {
      throw new Error('group title editor inline editor is not found');
    }
    titleEditor.inlineEditor.setText('ABC');
    await wait();
    expect(group.title.toString()).toBe('ABC');
  });

  test('blur unmount group editor', async () => {
    const group = createGroupForTitle();

    await waitForGroupTitleBound(group);
    await dblclickGroupTitle(group);
    await waitForGroupTitleEditor(true);
    await waitForCondition(
      () => !!getGroupTitleEditor()?.inlineEditorContainer
    );

    const titleEditor = getGroupTitleEditor();
    if (!titleEditor?.inlineEditorContainer) {
      throw new Error('group title editor inline container is not found');
    }
    titleEditor.inlineEditorContainer.dispatchEvent(new FocusEvent('blur'));
    await waitForGroupTitleEditor(false);
  });

  test('enter unmount group editor', async () => {
    const group = createGroupForTitle();

    await waitForGroupTitleBound(group);
    mountGroupTitleEditor(group, edgeless);
    if (!getGroupTitleEditor()) {
      await dblclickGroupTitle(group);
    }
    await waitForGroupTitleEditor(true);
    await waitForCondition(
      () => !!getGroupTitleEditor()?.inlineEditorContainer
    );
    await waitForCondition(() => group.showTitle === false);

    const titleEditor = getGroupTitleEditor();
    editor.std.event.active = true;
    titleEditor?.inlineEditorContainer?.focus();

    pressEnter();
    await waitForGroupTitleEditor(false);
  });
});

describe('mindmap', () => {
  let service!: EdgelessRootBlockComponent['service'];

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(window.doc, window.editor, 'edgeless').service;

    return cleanup;
  });

  test('delete the root node should remove all children', async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };
    const mindmapId = service.crud.addElement('mindmap', { children: tree });
    if (!mindmapId) {
      throw new Error('mindmapId is not found');
    }
    const mindmap = () =>
      service.crud.getElementById(mindmapId) as MindmapElementModel;

    expect(service.surface.elementModels.length).toBe(6);
    doc.captureSync();

    service.removeElement(mindmap().tree.element);
    await wait();
    expect(service.surface.elementModels.length).toBe(0);
    doc.captureSync();
    await wait();

    doc.undo();
    expect(service.surface.elementModels.length).toBe(6);
    await wait();

    service.removeElement(mindmap().tree.children[2].element);
    await wait();
    expect(service.surface.elementModels.length).toBe(4);
    await wait();

    doc.undo();
    await wait();
    expect(service.surface.elementModels.length).toBe(6);
  });

  test('mindmap should layout automatically when creating', async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };
    const mindmapId = service.crud.addElement('mindmap', {
      type: LayoutType.RIGHT,
      children: tree,
    });
    if (!mindmapId) {
      throw new Error('mindmapId is not found');
    }
    const mindmap = () =>
      service.crud.getElementById(mindmapId) as MindmapElementModel;

    doc.captureSync();
    await wait();

    const root = mindmap().tree.element;
    const children = mindmap().tree.children.map(child => child.element);
    const leaf4 = mindmap().tree.children[2].children[0].element;

    expect(children[0].x).greaterThan(root.x + root.w);
    expect(children[1].x).greaterThan(root.x + root.w);
    expect(children[2].x).greaterThan(root.x + root.w);

    expect(children[1].y).greaterThan(children[0].y + children[0].h);
    expect(children[2].y).greaterThan(children[1].y + children[1].h);

    expect(leaf4.x).greaterThan(children[2].x + children[2].w);
  });

  test('deliberately creating a circular reference should be resolved correctly', async () => {
    const tree = {
      text: 'root',
      children: [
        {
          text: 'leaf1',
        },
        {
          text: 'leaf2',
        },
        {
          text: 'leaf3',
          children: [
            {
              text: 'leaf4',
            },
          ],
        },
      ],
    };
    const mindmapId = service.crud.addElement('mindmap', {
      type: LayoutType.RIGHT,
      children: tree,
    });
    if (!mindmapId) {
      throw new Error('mindmapId is not found');
    }

    const mindmap = () =>
      service.crud.getElementById(mindmapId) as MindmapElementModel;

    doc.captureSync();
    await wait();

    // create a circular reference
    doc.transact(() => {
      const root = mindmap().tree;
      const leaf3 = root.children[2];
      const leaf4 = root.children[2].children[0];

      mindmap().children.set(leaf3.id, {
        index: leaf3.detail.index,
        parent: leaf4.id,
      });
    });
    doc.captureSync();

    await wait();

    // the circular referenced node should be removed
    expect(mindmap().nodeMap.size).toBe(3);
  });
});
