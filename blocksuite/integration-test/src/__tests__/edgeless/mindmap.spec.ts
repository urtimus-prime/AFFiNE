import {
  containsNode,
  createFromTree,
  detachMindmap,
  type MindMapView,
  moveNode,
} from '@blocksuite/affine/gfx/mindmap';
import { LayoutType, type MindmapElementModel } from '@blocksuite/affine-model';
import { Bound } from '@blocksuite/global/gfx';
import type { GfxController } from '@blocksuite/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, pointermove, wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('mindmap', () => {
  let gfx: GfxController;

  const waitForCondition = async (condition: () => boolean, retries = 80) => {
    for (let i = 0; i < retries; i++) {
      if (condition()) {
        return;
      }
      await wait(30);
    }
    expect(condition()).toBe(true);
  };

  const moveAndClick = ({ x, y, w, h }: Bound) => {
    const { left, top } = gfx.viewport;
    x += left;
    y += top;

    // trigger enter event
    pointermove(editor.host!, { x: x + w / 2, y: y + h / 2 });
    // trigger move event
    pointermove(editor.host!, { x: x + w / 2 + 1, y: y + h / 2 + 1 });
    click(editor.host!, { x: x + w / 2, y: y + h / 2 });
  };

  const move = ({ x, y, w, h }: Bound) => {
    x += gfx.viewport.left;
    y += gfx.viewport.top;

    // keep the same "enter -> move" sequence as moveAndClick to avoid hover races
    pointermove(editor.host!, { x: x + w / 2, y: y + h / 2 });
    pointermove(editor.host!, { x: x + w / 2 + 1, y: y + h / 2 + 1 });
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    gfx = getDocRootBlock(window.doc, window.editor, 'edgeless').gfx;

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
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;

    expect(gfx.surface!.elementModels.length).toBe(6);
    doc.captureSync();

    gfx.deleteElement(mindmap().tree.element);
    await wait();
    expect(gfx.surface!.elementModels.length).toBe(0);
    doc.captureSync();
    await wait();

    doc.undo();
    expect(gfx.surface!.elementModels.length).toBe(6);
    await wait();

    gfx.deleteElement(mindmap().tree.children[2].element);
    await wait();
    expect(gfx.surface!.elementModels.length).toBe(4);
    await wait();

    doc.undo();
    await wait();
    expect(gfx.surface!.elementModels.length).toBe(6);
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
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;

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
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;

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

  test('mindmap collapse and expand should work correctly', async () => {
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

    // click to active the editor
    click(editor.host!, { x: 50, y: 50 });

    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    const mindmapView = () => gfx.view.get(mindmapId) as MindMapView;

    doc.captureSync();
    await wait(100);

    // collapse the root node
    {
      const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;

      moveAndClick(gfx.viewport.toViewBound(rootButton.elementBound));
      await wait(500);

      expect(rootButton.hidden).toBe(false);
      expect(rootButton.opacity).toBe(1);
      expect(mindmap().tree.detail.collapsed).toBe(true);
      expect(mindmap().getNodeByPath([0, 0])!.element.hidden).toBe(true);
      expect(mindmap().getNodeByPath([0, 1])!.element.hidden).toBe(true);
      expect(mindmap().getNodeByPath([0, 2])!.element.hidden).toBe(true);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(true);

      doc.captureSync();
      await wait();

      doc.undo();
      await wait();

      expect(mindmap().tree.detail.collapsed).toBe(undefined);
      expect(mindmap().getNodeByPath([0, 0])!.element.hidden).toBe(false);
      expect(mindmap().getNodeByPath([0, 1])!.element.hidden).toBe(false);
      expect(mindmap().getNodeByPath([0, 2])!.element.hidden).toBe(false);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(false);
    }

    // collapse a child node
    {
      const node = mindmap().getNodeByPath([0, 2])!;
      const childButton = mindmapView().getCollapseButton(node)!;

      moveAndClick(gfx.viewport.toViewBound(childButton.elementBound));
      await wait(500);

      expect(childButton.hidden).toBe(false);
      expect(childButton.opacity).toBe(1);

      expect(mindmap().getNodeByPath([0, 2])!.element.hidden).toBe(false);
      expect(mindmap().getNodeByPath([0, 2])!.detail.collapsed).toBe(true);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(true);

      doc.captureSync();
      await wait();

      doc.undo();
      await wait();

      expect(mindmap().getNodeByPath([0, 2])!.detail.collapsed).toBe(undefined);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(false);
    }

    // collapse root node and collapse a child node
    {
      const childButton = mindmapView().getCollapseButton(
        mindmap().getNodeByPath([0, 2])!
      )!;
      // collapse child node
      moveAndClick(gfx.viewport.toViewBound(childButton.elementBound));
      await wait(500);

      doc.captureSync();
      await wait();

      const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;
      // collapse root node
      moveAndClick(gfx.viewport.toViewBound(rootButton.elementBound));
      await wait(500);

      // child button should be hidden
      expect(childButton.hidden).toBe(true);
      expect(childButton.opacity).toBe(0);

      // expand root node
      doc.undo();
      await wait();

      // child button should be visible
      expect(childButton.hidden).toBe(false);
      expect(childButton.opacity).toBe(1);

      // child nodes should still be collapsed
      expect(mindmap().getNodeByPath([0, 2])!.detail.collapsed).toBe(true);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(true);

      // expand child node
      doc.undo();
      await wait();

      // child button should be visible
      expect(mindmap().getNodeByPath([0, 2])!.detail.collapsed).toBe(undefined);
      expect(mindmap().getNodeByPath([0, 2, 0])!.element.hidden).toBe(false);
    }
  });

  test("selected node's collapse button should be visible", async () => {
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

    // click to active the editor
    click(editor.host!, { x: 50, y: 50 });

    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    const mindmapView = () => gfx.view.get(mindmapId) as MindMapView;
    await wait();

    gfx.selection.set({ elements: [mindmap().tree.id] });
    const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;
    expect(rootButton.hidden).toBe(false);
    expect(rootButton.opacity).toBe(1);

    gfx.selection.set({ elements: [mindmap().getNodeByPath([0, 2])!.id] });
    const childButton = mindmapView().getCollapseButton(
      mindmap().getNodeByPath([0, 2])!
    )!;
    expect(childButton.hidden).toBe(false);
    expect(childButton.opacity).toBe(1);
  });

  test('move near to the collapsed button should show the button', async () => {
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

    // click to active the editor
    click(editor.host!, { x: 50, y: 50 });

    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    const mindmapView = () => gfx.view.get(mindmapId) as MindMapView;
    const getRootButton = () => mindmapView().getCollapseButton(mindmap().tree);
    const getChildButton = () => {
      const childNode = mindmap().getNodeByPath([0, 2]);
      return childNode ? mindmapView().getCollapseButton(childNode) : null;
    };
    await wait();

    const rootButton = getRootButton();
    if (!rootButton) {
      throw new Error('Cannot find root collapse button');
    }
    move(gfx.viewport.toViewBound(rootButton.elementBound));
    await waitForCondition(() => {
      const button = getRootButton();
      return !!button && !button.hidden && button.opacity > 0.9;
    });
    expect(getRootButton()?.opacity).toBeCloseTo(1, 2);

    const childButton = getChildButton();
    if (!childButton) {
      throw new Error('Cannot find child collapse button');
    }
    move(gfx.viewport.toViewBound(childButton.elementBound));
    await waitForCondition(() => {
      const button = getChildButton();
      return !!button && !button.hidden && button.opacity > 0.9;
    });
    expect(getChildButton()?.opacity).toBeCloseTo(1, 2);

    move(new Bound(0, 0, 0, 0));
    await waitForCondition(() => {
      const root = getRootButton();
      const child = getChildButton();
      return !!root && !!child && child.opacity < 0.1 && root.opacity < 0.1;
    });

    expect(getChildButton()?.opacity).toBeCloseTo(0, 2);
    expect(getRootButton()?.opacity).toBeCloseTo(0, 2);
  });

  test("collapsed node's button should be always visible except its ancestor is collapsed", async () => {
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

    // click to active the editor
    click(editor.host!, { x: 50, y: 50 });

    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: tree,
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    const mindmapView = () => gfx.view.get(mindmapId) as MindMapView;

    doc.captureSync();
    await wait();

    const childButton = mindmapView().getCollapseButton(
      mindmap().getNodeByPath([0, 2])!
    )!;
    // collapse the child node
    moveAndClick(gfx.viewport.toViewBound(childButton.elementBound));
    // move out of the button, the button should still be visible
    move(new Bound(0, 0, 0, 0));
    await wait();
    expect(childButton.hidden).toBe(false);
    expect(childButton.opacity).toBe(1);

    const rootButton = mindmapView().getCollapseButton(mindmap().tree)!;
    // collapse the root node
    moveAndClick(gfx.viewport.toViewBound(rootButton.elementBound));
    // move out of the button, the root button should be visible
    move(new Bound(0, 0, 0, 0));
    await wait();
    expect(rootButton.hidden).toBe(false);
    expect(rootButton.opacity).toBe(1);
    // the collapsed child button should be hidden
    expect(childButton.hidden).toBe(true);
    expect(childButton.opacity).toBe(0);
  });

  test('move node should reorder siblings', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: {
        text: 'root',
        children: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      },
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    await wait();

    const nodeA = mindmap().getNodeByPath([0, 0]);
    if (!nodeA) {
      throw new Error('nodeA is not found');
    }

    moveNode(mindmap(), nodeA, mindmap(), mindmap().tree, 1);
    await wait();
    expect(mindmap().getPath(nodeA.id)).toEqual([0, 1]);

    moveNode(mindmap(), nodeA, mindmap(), mindmap().tree, 0);
    await wait();
    expect(mindmap().getPath(nodeA.id)).toEqual([0, 0]);
  });

  test('move node should support becoming child and keep subtree', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: {
        text: 'root',
        children: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      },
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    await wait();

    const nodeA = mindmap().getNodeByPath([0, 0]);
    const nodeB = mindmap().getNodeByPath([0, 1]);
    if (!nodeA || !nodeB) {
      throw new Error('nodeA or nodeB is not found');
    }

    moveNode(mindmap(), nodeA, mindmap(), nodeB, 0);
    await wait();
    expect(mindmap().getParentNode(nodeA.id)?.id).toBe(nodeB.id);
    expect(mindmap().getPath(nodeA.id)).toEqual([0, 0, 0]);

    const nodeC = mindmap().getNodeByPath([0, 1]);
    if (!nodeC) {
      throw new Error('nodeC is not found');
    }

    moveNode(mindmap(), nodeB, mindmap(), nodeC, 0);
    await wait();
    expect(mindmap().getParentNode(nodeB.id)?.id).toBe(nodeC.id);
    expect(mindmap().getPath(nodeA.id)).toEqual([0, 0, 0, 0]);
  });

  test('should prevent moving node into itself or descendants', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: {
        text: 'root',
        children: [
          {
            text: 'A',
            children: [{ text: 'A-1' }, { text: 'A-2' }],
          },
          { text: 'B' },
        ],
      },
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    await wait();

    const dragged = mindmap().getNodeByPath([0, 0]);
    const descendant = mindmap().getNodeByPath([0, 0, 1]);
    if (!dragged || !descendant) {
      throw new Error('dragged or descendant node is not found');
    }

    const originalDraggedPath = mindmap().getPath(dragged.id);
    const originalDescendantPath = mindmap().getPath(descendant.id);

    expect(containsNode(mindmap(), dragged, dragged)).toBe(true);
    expect(containsNode(mindmap(), descendant, dragged)).toBe(true);

    if (!containsNode(mindmap(), descendant, dragged)) {
      moveNode(mindmap(), dragged, mindmap(), descendant, 0);
    }
    await wait();

    expect(mindmap().getPath(dragged.id)).toEqual(originalDraggedPath);
    expect(mindmap().getPath(descendant.id)).toEqual(originalDescendantPath);
  });

  test('moving root should keep relative positions of descendants', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: {
        text: 'root',
        children: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      },
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    await wait();

    const root = mindmap().tree.element;
    const childA = mindmap().getNodeByPath([0, 0])!.element;
    const childB = mindmap().getNodeByPath([0, 1])!.element;
    const childC = mindmap().getNodeByPath([0, 2])!.element;
    const before = {
      root: { x: root.x, y: root.y },
      a: { x: childA.x, y: childA.y },
      b: { x: childB.x, y: childB.y },
      c: { x: childC.x, y: childC.y },
    };

    mindmap().moveTo([root.x + 54, root.y + 54, root.w, root.h]);
    await wait();

    const afterA = mindmap().getNodeByPath([0, 0])!.element;
    const afterB = mindmap().getNodeByPath([0, 1])!.element;
    const afterC = mindmap().getNodeByPath([0, 2])!.element;

    const deltaRootX = mindmap().tree.element.x - before.root.x;
    const deltaRootY = mindmap().tree.element.y - before.root.y;

    expect(afterA.x - before.a.x).toBeCloseTo(deltaRootX, 0);
    expect(afterA.y - before.a.y).toBeCloseTo(deltaRootY, 0);
    expect(afterB.x - before.b.x).toBeCloseTo(deltaRootX, 0);
    expect(afterB.y - before.b.y).toBeCloseTo(deltaRootY, 0);
    expect(afterC.x - before.c.x).toBeCloseTo(deltaRootX, 0);
    expect(afterC.y - before.c.y).toBeCloseTo(deltaRootY, 0);
  });

  test('detaching subtree should create a new mindmap and keep subtree structure', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: {
        text: 'root',
        children: [
          { text: 'first child' },
          {
            text: 'second child',
            children: [{ text: 'grand child 1' }, { text: 'grand child 2' }],
          },
        ],
      },
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    await wait();

    const detachedNode = mindmap().getNodeByPath([0, 1]);
    if (!detachedNode) {
      throw new Error('detached node is not found');
    }

    const detached = detachMindmap(mindmap(), detachedNode);
    if (!detached) {
      throw new Error('failed to detach subtree');
    }
    const newMindmap = createFromTree(
      detached,
      mindmap().style,
      mindmap().layoutType,
      mindmap().surface
    );
    await wait();

    const mindmaps = gfx.surface!.elementModels.filter(
      element => element.type === 'mindmap'
    ) as MindmapElementModel[];
    expect(mindmaps).toHaveLength(2);

    const readNodeElementText = (
      node: NonNullable<ReturnType<typeof newMindmap.getNodeByPath>>
    ) => {
      const textElement = node.element as { text?: { toString: () => string } };
      return textElement.text?.toString() ?? '';
    };

    const nodeText = (path: number[]) => {
      const node = newMindmap.getNodeByPath(path);
      if (!node) {
        throw new Error(`node at path ${path} is not found`);
      }
      return readNodeElementText(node);
    };

    expect(nodeText([0])).toBe('second child');
    expect(nodeText([0, 0])).toBe('grand child 1');
    expect(nodeText([0, 1])).toBe('grand child 2');
    expect(mindmap().getNode(detached.id)).toBeNull();
  });

  test('addNode should build parent-child structure from text flow', async () => {
    const mindmapId = gfx.surface!.addElement({
      type: 'mindmap',
      layoutType: LayoutType.RIGHT,
      children: {
        text: 'root',
        children: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
      },
    });
    const mindmap = () => gfx.getElementById(mindmapId) as MindmapElementModel;
    await wait();

    const parentTarget = mindmap().getNodeByPath([0, 1]);
    if (!parentTarget) {
      throw new Error('parent target is not found');
    }

    const parentId = mindmap().addNode(
      mindmap().tree.id,
      parentTarget.id,
      'after',
      {
        text: 'parent node',
      }
    );
    const child1Id = mindmap().addNode(parentId, undefined, 'after', {
      text: 'child node 1',
    });
    mindmap().addNode(parentId, child1Id, 'after', {
      text: 'child node 2',
    });
    await wait();

    const readText = (path: number[]) => {
      const node = mindmap().getNodeByPath(path);
      if (!node) {
        throw new Error(`node at path ${path} is not found`);
      }
      const textElement = node.element as { text?: { toString: () => string } };
      return textElement.text?.toString() ?? '';
    };

    expect(readText([0, 2])).toBe('parent node');
    expect(readText([0, 2, 0])).toBe('child node 1');
    expect(readText([0, 2, 1])).toBe('child node 2');
  });
});
