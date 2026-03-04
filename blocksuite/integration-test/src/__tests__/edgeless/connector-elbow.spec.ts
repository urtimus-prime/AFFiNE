import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { ConnectorTool } from '@blocksuite/affine/gfx/connector';
import {
  type ConnectorElementModel,
  ConnectorMode,
} from '@blocksuite/affine/model';
import type { GfxModel } from '@blocksuite/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type Endpoint = {
  id?: string;
  position?: [number, number];
};

describe('connector elbow paths', () => {
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

  const addShape = (x: number, y: number) => {
    const id = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: `[${x},${y},100,100]`,
    });
    if (!id) {
      throw new Error('Cannot create shape');
    }
    return id;
  };

  const addCurveConnector = async (source: Endpoint, target: Endpoint) => {
    const id = service.crud.addElement('connector', {
      mode: ConnectorMode.Curve,
      source,
      target,
    });
    if (!id) {
      throw new Error('Cannot create connector');
    }
    await waitForCondition(() => {
      const connector = service.crud.getElementById(
        id
      ) as ConnectorElementModel;
      return connector.absolutePath.length > 0;
    });
    return service.crud.getElementById(id) as ConnectorElementModel;
  };

  const expectEndpointPath = (
    connector: ConnectorElementModel,
    expected: Array<[number, number]>
  ) => {
    expect(connector.absolutePath.length).toBe(expected.length);
    expected.forEach((point, index) => {
      expect(connector.absolutePath[index][0]).toBeCloseTo(point[0], 0);
      expect(connector.absolutePath[index][1]).toBeCloseTo(point[1], 0);
    });
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

    const connector = [...service.elements]
      .reverse()
      .find(element => element.type === 'connector') as
      | ConnectorElementModel
      | undefined;
    if (!connector) {
      throw new Error('Cannot find connector');
    }
    return connector;
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

  test('elbow connector without node and width greater than height', async () => {
    const connector = await addCurveConnector(
      { position: [0, 0] },
      { position: [200, 100] }
    );

    expectEndpointPath(connector, [
      [0, 0],
      [200, 100],
    ]);
    expect(connector.source.id).toBeUndefined();
    expect(connector.target.id).toBeUndefined();
  });

  test('elbow connector without node and width less than height', async () => {
    const connector = await addCurveConnector(
      { position: [0, 0] },
      { position: [100, 200] }
    );

    expectEndpointPath(connector, [
      [0, 0],
      [100, 200],
    ]);
    expect(connector.source.id).toBeUndefined();
    expect(connector.target.id).toBeUndefined();
  });

  test('elbow connector one side attached and one side free', async () => {
    const shapeId = addShape(0, 0);
    const sourceShape = service.crud.getElementById(shapeId);
    if (!sourceShape) {
      throw new Error('Cannot find source shape');
    }

    const connector1 = await quickConnect(
      sourceShape as GfxModel,
      [100, 50],
      [200, 0]
    );
    expectEndpointPath(connector1, [
      [100, 50],
      [200, 0],
    ]);
    expect(connector1.source.id).toBe(shapeId);
    expect(connector1.target.id).toBeUndefined();

    service.removeElement(connector1.id);
    await wait();

    const connector2 = await quickConnect(
      sourceShape as GfxModel,
      [50, 0],
      [125, 0]
    );
    expectEndpointPath(connector2, [
      [50, 0],
      [125, 0],
    ]);
    expect(connector2.source.id).toBe(shapeId);
    expect(connector2.target.id).toBeUndefined();
  });

  test('elbow connector with both sides attached', async () => {
    const sourceId = addShape(0, 0);
    const targetId = addShape(200, 0);
    const sourceShape = service.crud.getElementById(sourceId);
    if (!sourceShape) {
      throw new Error('Cannot find source shape');
    }
    const connector = await quickConnect(
      sourceShape as GfxModel,
      [100, 50],
      [200, 50]
    );
    expectEndpointPath(connector, [
      [100, 50],
      [200, 50],
    ]);
    expect(connector.source.id).toBe(sourceId);
    expect(connector.target.id).toBe(targetId);
  });

  test('elbow connector with one attached endpoint and one fixed endpoint', async () => {
    const sourceId = addShape(0, 0);
    const targetId = addShape(200, 0);
    const sourceShape = service.crud.getElementById(sourceId);
    if (!sourceShape) {
      throw new Error('Cannot find source shape');
    }
    const connector = await quickConnect(
      sourceShape as GfxModel,
      [50, 0],
      [200, 50]
    );
    expectEndpointPath(connector, [
      [50, 0],
      [200, 50],
    ]);
    expect(connector.source.id).toBe(sourceId);
    expect(connector.target.id).toBe(targetId);
  });

  test('elbow connector with both fixed endpoints attached', async () => {
    const sourceId = addShape(0, 0);
    const targetId = addShape(200, 0);
    const sourceShape = service.crud.getElementById(sourceId);
    if (!sourceShape) {
      throw new Error('Cannot find source shape');
    }
    const connector = await quickConnect(
      sourceShape as GfxModel,
      [50, 0],
      [300, 50]
    );
    expectEndpointPath(connector, [
      [50, 0],
      [300, 50],
    ]);
    expect(connector.source.id).toBe(sourceId);
    expect(connector.target.id).toBe(targetId);
  });
});
