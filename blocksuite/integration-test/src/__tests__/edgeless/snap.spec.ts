import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { beforeEach, describe, expect, test } from 'vitest';

import { click, drag, wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

let edgeless!: EdgelessRootBlockComponent;
let service!: EdgelessRootBlockComponent['service'];

const addSquare = (x: number, y: number) => {
  const id = service.crud.addElement('shape', {
    shapeType: 'rect',
    xywh: `[${x},${y},100,100]`,
    fillColor: 'red',
  });
  if (!id) {
    throw new Error('Cannot create shape');
  }
  return id;
};

const getBound = (id: string) => {
  const element = service.crud.getElementById(id);
  if (!element) {
    throw new Error(`Cannot find element: ${id}`);
  }
  return JSON.parse(element.xywh) as [number, number, number, number];
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

describe('snap', () => {
  test('snap', async () => {
    addSquare(0, 0);
    const movingId = addSquare(300, 0);
    await wait();

    click(edgeless.host, { x: 350, y: 50 });
    drag(edgeless.host, { x: 350, y: 50 }, { x: 350, y: 60 });
    await wait();
    expect(getBound(movingId)).toEqual([300, 10, 100, 100]);

    doc.undo();
    await wait();

    click(edgeless.host, { x: 350, y: 50 });
    drag(edgeless.host, { x: 350, y: 50 }, { x: 350, y: 57 });
    await wait();
    expect(getBound(movingId)).toEqual([300, 0, 100, 100]);
  });

  test('snapDistribute', async () => {
    addSquare(0, 0);
    addSquare(300, 0);
    const middleId = addSquare(144, 0);
    await wait();

    drag(edgeless.host, { x: 235, y: 91 }, { x: 238, y: 91 });
    await wait();

    expect(getBound(middleId)).toEqual([150, 0, 100, 100]);
  });
});
