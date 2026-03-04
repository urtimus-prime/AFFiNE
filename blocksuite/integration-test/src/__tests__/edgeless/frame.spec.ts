import {
  EdgelessFrameManagerIdentifier,
  type FrameBlockComponent,
} from '@blocksuite/affine/blocks/frame';
import {
  duplicate,
  type EdgelessRootBlockComponent,
} from '@blocksuite/affine/blocks/root';
import { DefaultTool } from '@blocksuite/affine/blocks/surface';
import { ConnectorTool } from '@blocksuite/affine/gfx/connector';
import { createGroupFromSelectedCommand } from '@blocksuite/affine/gfx/group';
import { ConnectorMode, type FrameBlockModel } from '@blocksuite/affine/model';
import type { AffineFrameTitleWidget } from '@blocksuite/affine/widgets/frame-title';
import type { MindmapElementModel } from '@blocksuite/affine-model';
import { Bound } from '@blocksuite/global/gfx';
import { assertType } from '@blocksuite/global/utils';
import { getTopElements, type GfxModel } from '@blocksuite/std/gfx';
import { Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, drag, wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('frame', () => {
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

  const createFrame = (
    x: number,
    y: number,
    width: number,
    height: number,
    title = 'Frame 1'
  ) => {
    return service.doc.addBlock(
      'affine:frame',
      {
        xywh: `[${x},${y},${width},${height}]`,
        title: new Text(title),
      },
      service.surface.id
    );
  };

  const getFrame = (frameId: string) => {
    const frame = service.doc.getBlock(frameId);
    if (!frame) {
      throw new Error(`Cannot find frame block: ${frameId}`);
    }
    assertType<FrameBlockComponent>(frame);
    return frame.model;
  };

  const getFrameTitleElement = (frameId: string) => {
    const frameTitleWidget = service.std.view.getWidget(
      'affine-frame-title-widget',
      frameId
    ) as AffineFrameTitleWidget | null;
    return frameTitleWidget?.shadowRoot?.querySelector(
      'affine-frame-title'
    ) as HTMLElement | null;
  };

  type FrameTitleEditorElement = HTMLElement & {
    inlineEditor?: {
      setText: (text: string) => void;
      rootElement?: HTMLElement | null;
    };
  };

  const getFrameTitleEditor = () =>
    document.querySelector<FrameTitleEditorElement>(
      'edgeless-frame-title-editor'
    );

  const waitForFrameTitleEditor = (mounted: boolean) => {
    return waitForCondition(() => Boolean(getFrameTitleEditor()) === mounted);
  };

  const openFrameTitleEditor = async (frameId: string) => {
    await waitForCondition(() => Boolean(getFrameTitleElement(frameId)));
    const frameTitle = getFrameTitleElement(frameId);
    if (!frameTitle) {
      throw new Error('frame title is not found');
    }
    frameTitle.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        composed: true,
      })
    );
    await waitForFrameTitleEditor(true);
    await waitForCondition(() => Boolean(getFrameTitleEditor()?.inlineEditor));
  };

  const clearSelection = () => {
    service.selection.set({
      elements: [],
      editing: false,
    });
  };

  const getGroupId = (id: string) => service.surface.getGroup(id)?.id ?? null;

  const getFrameManager = () => service.std.get(EdgelessFrameManagerIdentifier);

  const createShape = (x: number, y: number, w = 100, h = 100) => {
    return service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: `[${x},${y},${w},${h}]`,
    });
  };

  const getElement = (id: string) => {
    const element = service.crud.getElementById(id);
    if (!element) {
      throw new Error(`Cannot find element: ${id}`);
    }
    return element;
  };

  const getElementBound = (id: string) => {
    const { x, y, w, h } = getElement(id).elementBound;
    return { x, y, w, h };
  };

  type ReorderDirection = 'forward' | 'front' | 'backward' | 'back';

  const reorderElement = (id: string, direction: ReorderDirection) => {
    const element = getElement(id);
    service.crud.updateElement(id, {
      index: service.layer.getReorderedIndex(element, direction),
    });
  };

  const expectContainer = async (
    elementId: string,
    containerId: string | null
  ) => {
    await waitForCondition(() => getGroupId(elementId) === containerId);
    expect(getGroupId(elementId)).toBe(containerId);
  };

  const moveFrame = async (frameId: string, dx: number, dy: number) => {
    await waitForCondition(() => Boolean(getFrame(frameId).externalBound));
    const frame = getFrame(frameId);
    if (!frame.externalBound) {
      throw new Error('frame external bound is not found');
    }
    const center = service.viewport.toViewCoord(...frame.externalBound.center);
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

  const resizeFrameAndRefreshChildren = async (
    frameId: string,
    bound: [number, number, number, number]
  ) => {
    const [x, y, w, h] = bound;
    const frameManager = getFrameManager();
    service.crud.updateElement(frameId, {
      xywh: `[${x},${y},${w},${h}]`,
    });
    await wait();

    const frame = getFrame(frameId);
    const oldChildren = frameManager.getChildElementsInFrame(frame);
    const nextChildren = getTopElements(
      frameManager.getElementsInFrameBound(frame)
    ).concat(
      oldChildren.filter(oldChild =>
        frame.intersectsBound(oldChild.elementBound)
      )
    );

    frameManager.removeAllChildrenFromFrame(frame);
    frameManager.addElementsToFrame(frame, nextChildren);
    await wait();
  };

  const getLatestConnectorId = () => {
    const connector = [...service.elements]
      .reverse()
      .find(element => element.type === 'connector');
    return connector?.id ?? null;
  };

  const quickConnect = async (
    sourceId: string,
    source: [number, number],
    target: [number, number]
  ) => {
    const sourceElement = getElement(sourceId);
    edgeless.gfx.tool.setTool(ConnectorTool, {
      mode: ConnectorMode.Curve,
    });
    const connectorTool = edgeless.gfx.tool.get(ConnectorTool);
    connectorTool.quickConnect(
      service.viewport.toViewCoord(source[0], source[1]),
      sourceElement
    );
    await wait();

    connectorTool.findTargetByPoint(service.viewport.toViewCoord(...target));
    await wait();

    const connectorId = getLatestConnectorId();
    if (!connectorId) {
      throw new Error('connector id is not found');
    }
    return connectorId;
  };

  const createMindmap = () => {
    const mindmapId = service.crud.addElement('mindmap', {
      children: {
        text: 'root',
        children: [{ text: 'child' }],
      },
    });
    if (!mindmapId) {
      throw new Error('mindmap id is not found');
    }
    return mindmapId;
  };

  const getMindmap = (mindmapId: string) => {
    const mindmap = service.crud.getElementById(mindmapId);
    if (!mindmap) {
      throw new Error(`Cannot find mindmap element: ${mindmapId}`);
    }
    return mindmap as MindmapElementModel;
  };

  const placeMindmap = async (mindmapId: string, x: number, y: number) => {
    const mindmap = getMindmap(mindmapId);
    const root = mindmap.tree.element;
    mindmap.moveTo([x, y, root.w, root.h]);
    await wait();
  };

  const dragMindmapRootTo = async (
    mindmapId: string,
    targetModelX: number,
    targetModelY: number
  ) => {
    const mindmap = getMindmap(mindmapId);
    const root = mindmap.tree.element;
    const [startX, startY] = service.viewport.toViewCoord(
      root.x + 10,
      root.y + root.h / 2
    );
    const [endX, endY] = service.viewport.toViewCoord(
      targetModelX,
      targetModelY
    );

    click(edgeless.host, { x: startX, y: startY });
    await wait();
    drag(edgeless.host, { x: startX, y: startY }, { x: endX, y: endY }, 10);
    await wait();
  };

  const createFrameAndMindmap = async () => {
    const frameId = createFrame(50, 50, 500, 500);
    await waitForCondition(() => !!getFrame(frameId).elementBound);
    const frameBound = getFrame(frameId).elementBound;

    const mindmapId = createMindmap();
    await wait();
    await placeMindmap(
      mindmapId,
      frameBound.x - 280,
      frameBound.y + frameBound.h / 2 - 30
    );
    await expectContainer(mindmapId, null);

    return { frameId, frameBound, mindmapId };
  };

  const duplicateElement = async (id: string) => {
    const model = service.crud.getElementById(id);
    if (!model) {
      throw new Error(`Cannot find element: ${id}`);
    }
    const prevIds = new Set(
      service.edgelessElements.map(element => element.id)
    );
    await duplicate(edgeless, [model as GfxModel], false);
    await wait();

    return service.edgelessElements
      .map(element => element.id)
      .filter(nextId => !prevIds.has(nextId));
  };

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

  const getElementType = (id: string) => {
    const element = service.crud.getElementById(id) as {
      type?: string;
    } | null;
    return element?.type ?? null;
  };

  const dispatchKey = (
    type: 'keydown' | 'keyup',
    init: {
      key: string;
      code?: string;
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
        ctrlKey: init.ctrlKey ?? false,
        metaKey: init.metaKey ?? false,
      })
    );
  };

  const selectAllByShortcut = () => {
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

  const pressEnter = () => {
    dispatchKey('keydown', {
      key: 'Enter',
      code: 'Enter',
    });
    dispatchKey('keyup', {
      key: 'Enter',
      code: 'Enter',
    });
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

  test('frame should have title', async () => {
    const frame = service.doc.addBlock(
      'affine:frame',
      {
        xywh: '[0,0,300,300]',
        title: new Text('Frame 1'),
      },
      service.surface.id
    );
    await wait();

    const getFrameTitle = (frameId: string) => {
      const frameTitleWidget = service.std.view.getWidget(
        'affine-frame-title-widget',
        frameId
      ) as AffineFrameTitleWidget | null;
      return frameTitleWidget?.shadowRoot?.querySelector('affine-frame-title');
    };

    const frameTitle = getFrameTitle(frame);
    const rect = frameTitle?.getBoundingClientRect();

    expect(frameTitle).toBeTruthy();
    expect(rect).toBeTruthy();
    expect(rect!.width).toBeGreaterThan(0);
    expect(rect!.height).toBeGreaterThan(0);

    const [titleX, titleY] = service.viewport.toModelCoordFromClientCoord([
      rect!.x,
      rect!.y,
    ]);
    expect(titleX).toBeCloseTo(0);
    expect(titleY).toBeLessThan(0);

    const nestedFrame = service.doc.addBlock(
      'affine:frame',
      {
        xywh: '[20,20,200,200]',
        title: new Text('Frame 2'),
      },
      service.surface.id
    );
    await wait();

    const nestedTitle = getFrameTitle(nestedFrame);
    expect(nestedTitle).toBeTruthy();
    if (!nestedTitle) return;

    const nestedTitleRect = nestedTitle.getBoundingClientRect()!;
    const [nestedTitleX, nestedTitleY] =
      service.viewport.toModelCoordFromClientCoord([
        nestedTitleRect.x,
        nestedTitleRect.y,
      ]);

    expect(nestedTitleX).toBeGreaterThan(20);
    expect(nestedTitleY).toBeGreaterThan(20);
  });

  test('frame should have externalXYWH after moving viewport to contains frame', async () => {
    const frameId = service.doc.addBlock(
      'affine:frame',
      {
        xywh: '[1800,1800,200,200]',
        title: new Text('Frame 1'),
      },
      service.surface.id
    );
    await wait();

    const frame = service.doc.getBlock(frameId);
    expect(frame).toBeTruthy();

    assertType<FrameBlockComponent>(frame);

    service.viewport.setCenter(900, 900);
    expect(frame?.model.externalXYWH).toBeDefined();
  });

  test('descendant of frame should not contain itself', async () => {
    const frameIds = [1, 2, 3].map(i => {
      return service.doc.addBlock(
        'affine:frame',
        {
          xywh: '[0,0,300,300]',
          title: new Text(`Frame ${i}`),
        },
        service.surface.id
      );
    });

    await wait();

    const frames = frameIds.map(
      id => service.doc.getBlock(id)?.model as FrameBlockModel
    );

    frames.forEach(frame => {
      expect(frame.descendantElements).toHaveLength(0);
    });

    frames[0].addChild(frames[1]);
    frames[1].addChild(frames[2]);
    frames[2].addChild(frames[0]);

    await wait();
    expect(frames[0].descendantElements).toHaveLength(2);
    expect(frames[1].descendantElements).toHaveLength(1);
    expect(frames[2].descendantElements).toHaveLength(0);
  });

  test('frame can not be selected by click blank area of frame if it has title', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);

    clearSelection();
    click(edgeless.host, { x: 100, y: 100 });
    await wait();

    expect(service.selection.selectedElements).toHaveLength(0);
  });

  test('frame can be selected by click frame title', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);

    clearSelection();

    const frameTitle = getFrameTitleElement(frameId);
    expect(frameTitle).toBeTruthy();
    if (!frameTitle) return;
    const hostRect = edgeless.host.getBoundingClientRect();
    const titleRect = frameTitle.getBoundingClientRect();
    click(edgeless.host, {
      x: Math.round(titleRect.x - hostRect.x + titleRect.width / 2),
      y: Math.round(titleRect.y - hostRect.y + titleRect.height / 2),
    });
    await wait();

    expect(service.selection.selectedIds).toEqual([frameId]);
  });

  test('frame can be selected by body only if frame is locked or its background is not transparent', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);

    clearSelection();
    click(edgeless.host, { x: 100, y: 100 });
    await wait();
    expect(service.selection.selectedElements).toHaveLength(0);

    service.crud.updateElement(frameId, {
      lockedBySelf: true,
    });
    await wait();
    clearSelection();
    click(edgeless.host, { x: 100, y: 100 });
    await wait();
    expect(service.selection.selectedIds).toEqual([frameId]);

    service.crud.updateElement(frameId, {
      lockedBySelf: false,
      background: '#fb7081',
    });
    await wait();
    clearSelection();
    click(edgeless.host, { x: 100, y: 100 });
    await wait();
    expect(service.selection.selectedIds).toEqual([frameId]);
  });

  test('shape inside frame can be directly selected', async () => {
    const frameId = createFrame(50, 50, 200, 200);
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,100,100]',
    });
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await wait();

    const frame = getFrame(frameId);
    const shape = service.crud.getElementById(shapeId);
    if (!shape) {
      throw new Error('shape is not found');
    }
    expect(frame.hasChild(shape)).toBe(true);

    clearSelection();
    click(edgeless.host, { x: 150, y: 150 });
    await wait();
    expect(service.selection.selectedIds).toEqual([shapeId]);

    service.crud.updateElement(frameId, {
      background: '#fb7081',
    });
    await wait();
    clearSelection();
    click(edgeless.host, { x: 150, y: 150 });
    await wait();
    expect(service.selection.selectedIds).toEqual([shapeId]);
  });

  test('dom inside frame can be selected', async () => {
    const frameId = createFrame(50, 50, 200, 200);
    const noteId = addNote(doc, {
      xywh: '[90,90,120,80]',
    });
    await wait();

    const frame = getFrame(frameId);
    const note = service.crud.getElementById(noteId);
    if (!note) {
      throw new Error('note is not found');
    }
    expect(frame.hasChild(note)).toBe(true);

    clearSelection();
    click(edgeless.host, { x: 120, y: 120 });
    await wait();
    expect(service.selection.selectedIds).toEqual([noteId]);
  });

  test('dom moved into frame should stay hittable after sending to back', async () => {
    const frameId = createFrame(50, 50, 300, 300);
    service.crud.updateElement(frameId, {
      background: '#fb7081',
    });
    const noteId = addNote(doc, {
      xywh: '[360,260,120,80]',
    });
    await wait();

    reorderElement(noteId, 'back');
    await wait();

    const dragStart = service.viewport.toViewCoord(420, 300);
    const dragEnd = service.viewport.toViewCoord(120, 120);
    drag(
      edgeless.host,
      { x: dragStart[0], y: dragStart[1] },
      { x: dragEnd[0], y: dragEnd[1] },
      10
    );
    await wait();

    const frame = getFrame(frameId);
    const note = service.crud.getElementById(noteId);
    if (!note) {
      throw new Error('note is not found');
    }
    expect(frame.hasChild(note)).toBe(true);

    clearSelection();
    click(edgeless.host, { x: dragEnd[0], y: dragEnd[1] });
    await wait();
    expect(service.selection.selectedIds).toEqual([noteId]);
  });

  test('element in frame should not be selected when frame is selected by drag or Cmd/Ctrl + A', async () => {
    const frameId = createFrame(50, 50, 150, 150);
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,50,50]',
    });
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await wait();

    drag(edgeless.host, { x: 0, y: 0 }, { x: 250, y: 250 });
    await wait();
    expect(service.selection.selectedIds).toEqual([frameId]);

    clearSelection();
    selectAllByShortcut();
    await wait();
    expect(service.selection.selectedIds).toEqual([frameId]);
  });

  test('should not display frame title component when title is empty', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);

    await openFrameTitleEditor(frameId);
    const editor = getFrameTitleEditor();
    if (!editor?.inlineEditor) {
      throw new Error('frame title inline editor is not found');
    }
    editor.inlineEditor.setText('');
    await wait();
    pressEnter();
    await waitForFrameTitleEditor(false);
    await waitForCondition(() => !getFrame(frameId).externalBound);

    const frameTitle = getFrameTitleElement(frameId);
    expect(frameTitle).toBeTruthy();
    if (!frameTitle) return;
    expect(getComputedStyle(frameTitle).display).toBe('none');
  });

  test('edit frame title by db-click title', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);

    await openFrameTitleEditor(frameId);
    expect(getFrameTitleEditor()).toBeTruthy();
    pressEnter();
    await waitForFrameTitleEditor(false);
  });

  test('frame title can be edited repeatedly', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);

    await openFrameTitleEditor(frameId);
    pressEnter();
    await waitForFrameTitleEditor(false);

    await openFrameTitleEditor(frameId);
    expect(getFrameTitleEditor()).toBeTruthy();
    pressEnter();
    await waitForFrameTitleEditor(false);
  });

  test('edit frame title after zoom', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    service.viewport.setViewport(0.8, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    await wait();

    await openFrameTitleEditor(frameId);
    const editor = getFrameTitleEditor();
    if (!editor?.inlineEditor) {
      throw new Error('frame title inline editor is not found');
    }
    editor.inlineEditor.setText('ZOOM');
    await wait();
    pressEnter();
    await waitForFrameTitleEditor(false);

    expect(getFrame(frameId).props.title.toString()).toBe('ZOOM');
  });

  test('edit frame title after drag', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    service.selection.set({
      elements: [frameId],
      editing: false,
    });
    await wait();
    drag(edgeless.host, { x: 60, y: 60 }, { x: 70, y: 70 });
    await wait();

    await openFrameTitleEditor(frameId);
    const editor = getFrameTitleEditor();
    if (!editor?.inlineEditor) {
      throw new Error('frame title inline editor is not found');
    }
    editor.inlineEditor.setText('DRAG');
    await wait();
    pressEnter();
    await waitForFrameTitleEditor(false);

    expect(getFrame(frameId).props.title.toString()).toBe('DRAG');
  });

  test('blur unmount frame editor', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);
    await openFrameTitleEditor(frameId);

    const editor = getFrameTitleEditor();
    const root = editor?.inlineEditor?.rootElement;
    if (!root) {
      throw new Error('frame title inline root element is not found');
    }
    root.dispatchEvent(new FocusEvent('blur'));
    await waitForFrameTitleEditor(false);
  });

  test('enter unmount frame editor', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);
    await openFrameTitleEditor(frameId);

    pressEnter();
    await waitForFrameTitleEditor(false);
  });

  test('frame title should be draggable', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    await waitForCondition(() => !!getFrame(frameId).externalBound);

    const frame = getFrame(frameId);
    if (!frame.externalBound) {
      throw new Error('frame title bound is not found');
    }
    const center = service.viewport.toViewCoord(...frame.externalBound.center);
    drag(
      edgeless.host,
      { x: center[0], y: center[1] },
      { x: center[0] + 10, y: center[1] + 10 }
    );
    await wait();

    const moved = getFrame(frameId).elementBound;
    expect(moved.x).toBeCloseTo(60, 0);
    expect(moved.y).toBeCloseTo(60, 0);
  });

  test('create frame from selection should wrap selected elements', async () => {
    const shapeA = createShape(0, 0);
    const shapeB = createShape(100, 0);
    const shapeC = createShape(200, 0);
    if (!shapeA || !shapeB || !shapeC) {
      throw new Error('shape id is not found');
    }
    await wait();

    service.selection.set({
      elements: [shapeA, shapeB],
      editing: false,
    });
    await wait();

    const frame = getFrameManager().createFrameOnSelected();
    if (!frame) {
      throw new Error('frame is not created');
    }
    await wait();

    expect(frame.elementBound.x).toBeCloseTo(-40, 0);
    expect(frame.elementBound.y).toBeCloseTo(-40, 0);
    expect(frame.elementBound.w).toBeCloseTo(280, 0);
    expect(frame.elementBound.h).toBeCloseTo(180, 0);
    expect(service.selection.selectedIds).toEqual([frame.id]);

    await expectContainer(shapeA, frame.id);
    await expectContainer(shapeB, frame.id);
    await expectContainer(shapeC, null);
  });

  test('create frame on bound should include only elements in bound', async () => {
    const shapeA = createShape(0, 0);
    const shapeB = createShape(100, 0);
    const shapeC = createShape(200, 0);
    if (!shapeA || !shapeB || !shapeC) {
      throw new Error('shape id is not found');
    }
    await wait();

    const frame = getFrameManager().createFrameOnBound(
      new Bound(-10, -10, 220, 120)
    );
    await wait();

    await expectContainer(shapeA, frame.id);
    await expectContainer(shapeB, frame.id);
    await expectContainer(shapeC, null);
  });

  test('create inner frame from selected shape should stay in outer frame', async () => {
    const outerFrameId = createFrame(50, 50, 400, 400);
    const shapeId = createShape(200, 200);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, outerFrameId);

    service.selection.set({
      elements: [shapeId],
      editing: false,
    });
    await wait();

    const innerFrame = getFrameManager().createFrameOnSelected();
    if (!innerFrame) {
      throw new Error('inner frame is not created');
    }
    await wait();

    await expectContainer(innerFrame.id, outerFrameId);
    await expectContainer(shapeId, innerFrame.id);
    expect(getFrame(outerFrameId).containsBound(innerFrame.elementBound)).toBe(
      true
    );
  });

  test('elements created in frame should move with frame', async () => {
    const frameId = createFrame(50, 50, 500, 500);
    const shapeId = createShape(120, 120);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    const noteId = addNote(doc, {
      xywh: '[220,210,120,80]',
    });
    await expectContainer(shapeId, frameId);
    await expectContainer(noteId, frameId);

    const shapeBefore = getElementBound(shapeId);
    const noteBefore = getElementBound(noteId);

    await moveFrame(frameId, 50, 50);

    const shapeAfter = getElementBound(shapeId);
    const noteAfter = getElementBound(noteId);
    const frameAfter = getFrame(frameId).elementBound;

    expect(shapeAfter.x - shapeBefore.x).toBeCloseTo(50, 0);
    expect(shapeAfter.y - shapeBefore.y).toBeCloseTo(50, 0);
    expect(noteAfter.x - noteBefore.x).toBeCloseTo(50, 0);
    expect(noteAfter.y - noteBefore.y).toBeCloseTo(50, 0);
    expect(frameAfter.x).toBeCloseTo(100, 0);
    expect(frameAfter.y).toBeCloseTo(100, 0);
  });

  test('elements created out of frame should not move with frame', async () => {
    const frameId = createFrame(50, 50, 500, 500);
    const shapeId = createShape(620, 620);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, null);
    const before = getElementBound(shapeId);

    await moveFrame(frameId, 50, 50);

    const after = getElementBound(shapeId);
    const frameAfter = getFrame(frameId).elementBound;
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
    expect(frameAfter.x).toBeCloseTo(100, 0);
    expect(frameAfter.y).toBeCloseTo(100, 0);
  });

  test('group in frame should move with frame', async () => {
    const frameId = createFrame(50, 50, 500, 500);
    const shapeA = createShape(100, 100);
    const shapeB = createShape(150, 150);
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeA, frameId);
    await expectContainer(shapeB, frameId);

    const groupId = createGroupFromSelection([shapeA, shapeB]);
    await expectContainer(groupId, frameId);
    await expectContainer(shapeA, groupId);
    await expectContainer(shapeB, groupId);

    const groupBefore = getElementBound(groupId);
    await moveFrame(frameId, 50, 50);
    const groupAfter = getElementBound(groupId);
    expect(groupAfter.x - groupBefore.x).toBeCloseTo(50, 0);
    expect(groupAfter.y - groupBefore.y).toBeCloseTo(50, 0);
  });

  test('inner frame and its children should move with outer frame', async () => {
    const outerFrameId = createFrame(50, 50, 500, 500);
    const innerFrameId = createFrame(100, 100, 200, 200);
    const shapeId = createShape(150, 150);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    const outerFrame = getFrame(outerFrameId);
    const innerFrame = getFrame(innerFrameId);
    const shape = getElement(shapeId);
    outerFrame.addChild(innerFrame);
    innerFrame.addChild(shape);
    await wait();

    const innerBefore = getFrame(innerFrameId).elementBound;
    const shapeBefore = getElementBound(shapeId);
    await moveFrame(outerFrameId, 50, 50);

    const innerAfter = getFrame(innerFrameId).elementBound;
    const shapeAfter = getElementBound(shapeId);
    expect(innerAfter.x - innerBefore.x).toBeCloseTo(50, 0);
    expect(innerAfter.y - innerBefore.y).toBeCloseTo(50, 0);
    expect(shapeAfter.x - shapeBefore.x).toBeCloseTo(50, 0);
    expect(shapeAfter.y - shapeBefore.y).toBeCloseTo(50, 0);
  });

  test('resizing frame to include shape should make shape move with frame', async () => {
    const frameId = createFrame(50, 50, 100, 100);
    const shapeId = createShape(200, 200);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, null);

    await resizeFrameAndRefreshChildren(frameId, [50, 50, 400, 400]);
    await expectContainer(shapeId, frameId);
    const before = getElementBound(shapeId);

    await moveFrame(frameId, 50, 50);

    const after = getElementBound(shapeId);
    expect(after.x - before.x).toBeCloseTo(50, 0);
    expect(after.y - before.y).toBeCloseTo(50, 0);
  });

  test('resizing frame to exclude shape should make shape stop moving with frame', async () => {
    const frameId = createFrame(50, 50, 400, 400);
    const shapeId = createShape(200, 200);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, frameId);

    await resizeFrameAndRefreshChildren(frameId, [50, 50, 100, 100]);
    await expectContainer(shapeId, null);
    const before = getElementBound(shapeId);

    await moveFrame(frameId, 50, 50);

    const after = getElementBound(shapeId);
    const frameAfter = getFrame(frameId).elementBound;
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
    expect(frameAfter.w).toBeCloseTo(100, 0);
    expect(frameAfter.h).toBeCloseTo(100, 0);
  });

  test('removing frame should remove its children', async () => {
    const frameId = createFrame(50, 50, 400, 400);
    const shapeId = createShape(200, 200);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, frameId);

    service.removeElement(getFrame(frameId));
    await wait();

    expect(service.doc.getBlock(frameId)).toBeUndefined();
    expect(service.crud.getElementById(shapeId)).toBeNull();
  });

  test('removing frame after ungroup should keep children', async () => {
    const frameId = createFrame(50, 50, 400, 400);
    const shapeId = createShape(200, 200);
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeId, frameId);

    getFrameManager().removeAllChildrenFromFrame(getFrame(frameId));
    service.removeElement(getFrame(frameId));
    await wait();

    expect(service.doc.getBlock(frameId)).toBeUndefined();
    expect(service.crud.getElementById(shapeId)).toBeTruthy();
    await expectContainer(shapeId, null);
  });

  test('undo should work when creating frame on bound', async () => {
    const frame = getFrameManager().createFrameOnBound(
      new Bound(0, 0, 100, 100)
    );
    await wait();
    expect(service.doc.getBlock(frame.id)).toBeTruthy();

    doc.undo();
    await wait();
    expect(service.doc.getBlock(frame.id)).toBeUndefined();
  });

  test('undo/redo should work when changing frame background', async () => {
    const frameId = createFrame(50, 50, 400, 400);
    await wait();

    const prevBackground = getFrame(frameId).props.background;
    doc.captureSync();
    service.crud.updateElement(frameId, {
      background: '#fb7081',
    });
    await wait();

    const nextBackground = getFrame(frameId).props.background;
    expect(nextBackground).not.toEqual(prevBackground);

    doc.undo();
    await wait();
    expect(getFrame(frameId).props.background).toEqual(prevBackground);

    doc.redo();
    await wait();
    expect(getFrame(frameId).props.background).toEqual(nextBackground);
  });

  test('shape and connector created in frame should belong to frame', async () => {
    const frameId = createFrame(50, 50, 600, 600);
    const shapeA = createShape(150, 150);
    const shapeB = createShape(300, 150);
    if (!shapeA || !shapeB) {
      throw new Error('shape id is not found');
    }
    await expectContainer(shapeA, frameId);
    await expectContainer(shapeB, frameId);

    const connectorId = await quickConnect(shapeA, [200, 200], [350, 200]);
    await expectContainer(connectorId, frameId);
  });

  test('drag root node of mindmap into frame partially, then drag out', async () => {
    const { frameId, frameBound, mindmapId } = await createFrameAndMindmap();

    await dragMindmapRootTo(mindmapId, frameBound.x + 10, frameBound.y + 100);
    await expectContainer(mindmapId, frameId);

    await dragMindmapRootTo(mindmapId, frameBound.x - 120, frameBound.y - 120);
    await expectContainer(mindmapId, null);
  });

  test('drag root node of mindmap into frame fully, then drag out', async () => {
    const { frameId, frameBound, mindmapId } = await createFrameAndMindmap();

    await dragMindmapRootTo(
      mindmapId,
      frameBound.x + frameBound.w / 2,
      frameBound.y + frameBound.h / 2
    );
    await expectContainer(mindmapId, frameId);

    await dragMindmapRootTo(mindmapId, frameBound.x - 120, frameBound.y - 120);
    await expectContainer(mindmapId, null);
  });

  test('drag whole mindmap into frame, then drag root node out', async () => {
    const { frameId, frameBound, mindmapId } = await createFrameAndMindmap();

    await dragMindmapRootTo(
      mindmapId,
      frameBound.x + frameBound.w / 2 - 30,
      frameBound.y + frameBound.h / 2 + 80
    );
    await expectContainer(mindmapId, frameId);

    await dragMindmapRootTo(mindmapId, frameBound.x - 120, frameBound.y - 120);
    await expectContainer(mindmapId, null);
  });

  test('drag mindmap into frame, then drag root node out', async () => {
    const { frameId, frameBound, mindmapId } = await createFrameAndMindmap();

    await dragMindmapRootTo(
      mindmapId,
      frameBound.x + 80,
      frameBound.y + frameBound.h / 2
    );
    await expectContainer(mindmapId, frameId);

    await dragMindmapRootTo(mindmapId, frameBound.x - 20, frameBound.y - 20);
    await expectContainer(mindmapId, null);
  });

  test('add mindmap out of frame and add node near frame should still not belong to frame', async () => {
    const frameId = createFrame(500, 50, 500, 500);
    await waitForCondition(() => !!getFrame(frameId).externalBound);

    const mindmapId = createMindmap();
    await wait();
    await placeMindmap(mindmapId, 20, 200);
    await expectContainer(mindmapId, null);

    const mindmap = getMindmap(mindmapId);
    mindmap.addNode(mindmap.tree.id, undefined, 'after', {
      text: 'new node',
    });
    await wait();
    await expectContainer(mindmapId, null);

    const root = mindmap.tree.element;
    const rootX = root.x;
    const rootY = root.y;
    service.selection.set({
      elements: [frameId],
      editing: false,
    });
    await wait();

    const frame = getFrame(frameId);
    if (!frame.externalBound) {
      throw new Error('frame external bound is not found');
    }
    const center = service.viewport.toViewCoord(...frame.externalBound.center);
    drag(
      edgeless.host,
      { x: center[0], y: center[1] },
      { x: center[0] + 30, y: center[1] + 30 }
    );
    await wait();

    const after = mindmap.tree.element;
    expect(after.x).toBeCloseTo(rootX, 0);
    expect(after.y).toBeCloseTo(rootY, 0);
    await expectContainer(mindmapId, null);
  });

  test('copy of frame should keep relationship of child elements', async () => {
    const frameId = createFrame(50, 50, 400, 400);
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[200,200,100,100]',
    });
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await waitForCondition(() => getGroupId(shapeId) === frameId);

    const copiedIds = await duplicateElement(frameId);
    const copiedFrameId = copiedIds.find(
      id => id !== shapeId && id !== frameId
    );
    if (!copiedFrameId) {
      throw new Error('copied frame is not found');
    }
    const copiedShapeId = copiedIds.find(id => id !== copiedFrameId);
    if (!copiedShapeId) {
      throw new Error('copied shape is not found');
    }

    await waitForCondition(() => getGroupId(copiedShapeId) === copiedFrameId);
    expect(getGroupId(shapeId)).toBe(frameId);
    expect(getGroupId(copiedShapeId)).toBe(copiedFrameId);
  });

  test('copy of frame with grouped children should keep nested relationships', async () => {
    const frameId = createFrame(50, 50, 400, 400);
    const shapeA = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[200,200,100,100]',
    });
    const shapeB = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[250,250,100,100]',
    });
    const shapeC = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[300,300,100,100]',
    });
    if (!shapeA || !shapeB || !shapeC) {
      throw new Error('shape id is not found');
    }
    await waitForCondition(() => {
      return (
        getGroupId(shapeA) === frameId &&
        getGroupId(shapeB) === frameId &&
        getGroupId(shapeC) === frameId
      );
    });

    const groupId = createGroupFromSelection([shapeB, shapeC]);
    await waitForCondition(() => {
      return getGroupId(shapeB) === groupId && getGroupId(shapeC) === groupId;
    });

    const prevFrameIds = new Set(service.frame.frames.map(frame => frame.id));
    const copiedIds = await duplicateElement(frameId);
    const copiedFrame = service.frame.frames.find(
      frame => !prevFrameIds.has(frame.id)
    );
    if (!copiedFrame) {
      throw new Error('copied frame is not found');
    }

    const copiedGroupId = copiedIds.find(id => getElementType(id) === 'group');
    if (!copiedGroupId) {
      throw new Error('copied group is not found');
    }

    const copiedShapeIds = copiedIds.filter(
      id => getElementType(id) === 'shape'
    );
    expect(copiedShapeIds).toHaveLength(3);

    const shapesInCopiedGroup = copiedShapeIds.filter(
      id => getGroupId(id) === copiedGroupId
    );
    const shapesInCopiedFrame = copiedShapeIds.filter(
      id => getGroupId(id) === copiedFrame.id
    );

    expect(getGroupId(copiedGroupId)).toBe(copiedFrame.id);
    expect(shapesInCopiedGroup).toHaveLength(2);
    expect(shapesInCopiedFrame).toHaveLength(1);
  });

  test('copy of element in frame should belong to frame', async () => {
    const frameId = createFrame(50, 50, 400, 400);
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,100,100]',
    });
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await waitForCondition(() => getGroupId(shapeId) === frameId);

    const copiedIds = await duplicateElement(shapeId);
    const copiedShapeId = copiedIds.find(id => id !== frameId);
    if (!copiedShapeId) {
      throw new Error('copied shape is not found');
    }

    await waitForCondition(() => getGroupId(copiedShapeId) === frameId);
    expect(getGroupId(shapeId)).toBe(frameId);
    expect(getGroupId(copiedShapeId)).toBe(frameId);
  });

  test('copy of element out of frame should not belong to frame', async () => {
    const frameId = createFrame(50, 50, 200, 200);
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,100,100]',
    });
    if (!shapeId) {
      throw new Error('shape id is not found');
    }
    await waitForCondition(() => getGroupId(shapeId) === frameId);

    const copiedIds = await duplicateElement(shapeId);
    const copiedShapeId = copiedIds.find(id => id !== frameId);
    if (!copiedShapeId) {
      throw new Error('copied shape is not found');
    }

    await waitForCondition(() => getGroupId(copiedShapeId) !== undefined);
    expect(getGroupId(shapeId)).toBe(frameId);
    expect(getGroupId(copiedShapeId)).toBe(null);
  });
});
