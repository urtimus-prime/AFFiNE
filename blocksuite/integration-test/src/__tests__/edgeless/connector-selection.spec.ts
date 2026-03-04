import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { beforeEach, describe, expect, test } from 'vitest';

import { drag, wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

let edgeless!: EdgelessRootBlockComponent;
let service!: EdgelessRootBlockComponent['service'];

const addConnector = (
  source: { id: string } | { position: [number, number] },
  target: { id: string } | { position: [number, number] }
) => {
  const id = service.crud.addElement('connector', {
    source,
    target,
  });
  if (!id) {
    throw new Error('Cannot create connector');
  }
  return id;
};

const getSelectedRect = () => {
  const selectedRectWidget = document.querySelector('edgeless-selected-rect');
  const selectedRect = selectedRectWidget?.shadowRoot?.querySelector(
    '.affine-edgeless-selected-rect'
  );
  if (!selectedRect) {
    throw new Error('Cannot find selected rect');
  }
  return selectedRect;
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

describe('select multiple connectors', () => {
  test('should show single selection rect', async () => {
    addConnector({ position: [100, 200] }, { position: [300, 200] });
    addConnector({ position: [100, 230] }, { position: [300, 230] });
    addConnector({ position: [100, 260] }, { position: [300, 260] });
    await wait();

    drag(edgeless.host, { x: 50, y: 50 }, { x: 400, y: 290 });
    await wait();

    expect(getSelectedRect().querySelectorAll('.element-handle')).toHaveLength(
      0
    );
  });

  test('should disable resize when a connector is already connected', async () => {
    const shapeId = service.crud.addElement('shape', {
      shapeType: 'diamond',
      xywh: '[100,0,100,100]',
      fillColor: 'red',
    });
    if (!shapeId) {
      throw new Error('Cannot create shape');
    }

    addConnector({ id: shapeId }, { position: [450, 50] });
    addConnector({ position: [250, 200] }, { position: [450, 200] });
    addConnector({ position: [250, 230] }, { position: [450, 230] });
    addConnector({ position: [250, 260] }, { position: [450, 260] });
    await wait();

    drag(edgeless.host, { x: 500, y: 20 }, { x: 400, y: 290 });
    await wait();

    const selectedRect = getSelectedRect();
    expect(selectedRect.querySelectorAll('.element-handle')).toHaveLength(0);
    expect(selectedRect.querySelectorAll('.handle .resize')).toHaveLength(0);
  });
});
