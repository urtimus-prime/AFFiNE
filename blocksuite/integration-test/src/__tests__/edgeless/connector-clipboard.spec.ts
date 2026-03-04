import {
  duplicate,
  type EdgelessRootBlockComponent,
} from '@blocksuite/affine/blocks/root';
import { createGroupFromSelectedCommand } from '@blocksuite/affine/gfx/group';
import {
  type ConnectorElementModel,
  GroupElementModel,
} from '@blocksuite/affine/model';
import type { GfxModel } from '@blocksuite/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type Endpoint = { id: string } | { position: [number, number] };

describe('connector clipboard', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const getModelType = (model: GfxModel) =>
    (model as unknown as { type?: string }).type;

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

  const addConnector = (source: Endpoint, target: Endpoint) => {
    const id = service.crud.addElement('connector', {
      source,
      target,
    });
    if (!id) {
      throw new Error('Cannot create connector');
    }
    return id;
  };

  const getConnector = (id: string) => {
    const model = service.crud.getElementById(id);
    if (!model || getModelType(model as GfxModel) !== 'connector') {
      throw new Error(`Cannot find connector: ${id}`);
    }
    return model as ConnectorElementModel;
  };

  const duplicateModels = async (models: GfxModel[]) => {
    const prevIds = new Set(service.edgelessElements.map(model => model.id));
    await duplicate(edgeless, models, false);
    await wait();
    return service.edgelessElements.filter(model => !prevIds.has(model.id));
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

  test('copy and paste connector with two floating endpoints', async () => {
    const connectorId = addConnector(
      { position: [0, 0] },
      { position: [200, 100] }
    );
    const connector = getConnector(connectorId);

    const added = await duplicateModels([connector as GfxModel]);
    const copiedConnector = added.find(
      model => getModelType(model) === 'connector'
    ) as ConnectorElementModel | undefined;
    if (!copiedConnector) {
      throw new Error('Cannot find copied connector');
    }

    expect(copiedConnector.source.id).toBeUndefined();
    expect(copiedConnector.target.id).toBeUndefined();
    expect(copiedConnector.source.position).toBeDefined();
    expect(copiedConnector.target.position).toBeDefined();

    const source = connector.source.position;
    const target = connector.target.position;
    const copiedSource = copiedConnector.source.position;
    const copiedTarget = copiedConnector.target.position;
    if (!source || !target || !copiedSource || !copiedTarget) {
      throw new Error('Missing connector position');
    }
    expect(copiedTarget[0] - copiedSource[0]).toBeCloseTo(
      target[0] - source[0],
      4
    );
    expect(copiedTarget[1] - copiedSource[1]).toBeCloseTo(
      target[1] - source[1],
      4
    );
  });

  test('copy and paste connector with both endpoints connected', async () => {
    const shapeA = addShape(0, 0);
    const shapeB = addShape(200, 0);
    const connector = getConnector(
      addConnector({ id: shapeA }, { id: shapeB })
    );
    const sourceShape = service.crud.getElementById(shapeA);
    const targetShape = service.crud.getElementById(shapeB);
    if (!sourceShape || !targetShape) {
      throw new Error('Cannot find source or target shape');
    }

    const added = await duplicateModels([
      sourceShape as GfxModel,
      targetShape as GfxModel,
      connector as GfxModel,
    ]);

    const copiedShapeIds = added
      .filter(model => getModelType(model) === 'shape')
      .map(model => model.id);
    const copiedConnector = added.find(
      model => getModelType(model) === 'connector'
    ) as ConnectorElementModel | undefined;
    if (!copiedConnector) {
      throw new Error('Cannot find copied connector');
    }

    expect(copiedShapeIds).toHaveLength(2);
    expect(copiedConnector.source.id).toBeDefined();
    expect(copiedConnector.target.id).toBeDefined();
    expect(copiedShapeIds).toContain(copiedConnector.source.id);
    expect(copiedShapeIds).toContain(copiedConnector.target.id);
    expect(copiedConnector.source.id).not.toBe(shapeA);
    expect(copiedConnector.target.id).not.toBe(shapeB);
  });

  test('copy and paste only connector should detach from both endpoints', async () => {
    const shapeA = addShape(0, 0);
    const shapeB = addShape(200, 0);
    const connector = getConnector(
      addConnector({ id: shapeA }, { id: shapeB })
    );

    const added = await duplicateModels([connector as GfxModel]);
    const copiedConnector = added.find(
      model => getModelType(model) === 'connector'
    ) as ConnectorElementModel | undefined;
    if (!copiedConnector) {
      throw new Error('Cannot find copied connector');
    }

    expect(copiedConnector.source.id).toBeUndefined();
    expect(copiedConnector.target.id).toBeUndefined();
    expect(copiedConnector.absolutePath.length).toBeGreaterThanOrEqual(0);
  });

  test('copy and paste connector with one endpoint connected', async () => {
    const shapeA = addShape(0, 0);
    const connector = getConnector(
      addConnector({ id: shapeA }, { position: [300, 50] })
    );
    const sourceShape = service.crud.getElementById(shapeA);
    if (!sourceShape) {
      throw new Error('Cannot find source shape');
    }

    const added = await duplicateModels([
      sourceShape as GfxModel,
      connector as GfxModel,
    ]);

    const copiedShape = added.find(model => getModelType(model) === 'shape');
    const copiedConnector = added.find(
      model => getModelType(model) === 'connector'
    ) as ConnectorElementModel | undefined;
    if (!copiedShape || !copiedConnector) {
      throw new Error('Cannot find copied shape or connector');
    }

    expect(copiedConnector.source.id).toBe(copiedShape.id);
    expect(copiedConnector.target.id).toBeUndefined();
    expect(copiedConnector.target.position).toBeDefined();
  });

  test('copy and paste group with note and shape should keep relative order', async () => {
    const shapeId = addShape(0, 0);
    const noteId = addNote(doc, {
      xywh: '[100,50,800,100]',
    });

    service.selection.set({
      elements: [shapeId, noteId],
      editing: false,
    });
    const [ok, result] = service.std.command.exec(
      createGroupFromSelectedCommand
    );
    if (!ok || !result.groupId) {
      throw new Error('Cannot create group');
    }
    const originalGroup = service.crud.getElementById(result.groupId);
    if (!(originalGroup instanceof GroupElementModel)) {
      throw new Error('Cannot find original group');
    }

    const added = await duplicateModels([originalGroup as GfxModel]);
    const copiedGroup = added.find(model => model instanceof GroupElementModel);
    if (!(copiedGroup instanceof GroupElementModel)) {
      throw new Error('Cannot find copied group');
    }

    const getSortedChildTypes = (group: GroupElementModel) => {
      return Array.from(group.children.keys())
        .map(id => service.crud.getElementById(id))
        .filter(model => !!model)
        .sort(service.layer.compare)
        .map(model => getModelType(model as GfxModel) ?? '');
    };

    expect(getSortedChildTypes(copiedGroup)).toEqual(
      getSortedChildTypes(originalGroup)
    );
  });
});
