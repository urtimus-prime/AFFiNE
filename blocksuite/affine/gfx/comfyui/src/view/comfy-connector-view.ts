import { Bound } from '@blocksuite/global/gfx';
import { GfxElementModelView } from '@blocksuite/std/gfx';

import type { ComfyConnectorElementModel } from '../model/comfy-connector-element.js';
import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';
import { COMFY_NODE_CONSTANTS } from '../model/types.js';
import { getNodeDefinition } from '../node-registry/registry.js';

const { TITLE_HEIGHT, PORT_ROW_HEIGHT, PORT_RADIUS } = COMFY_NODE_CONSTANTS;

export class ComfyConnectorElementView extends GfxElementModelView<ComfyConnectorElementModel> {
  static override type = 'comfy-connector';

  override onCreated(): void {
    super.onCreated();
    this._updatePositions();

    // Re-compute when any element updates (node might have moved)
    const surface = this.model.surface;
    if (surface) {
      this.disposable.add(
        surface.elementUpdated.subscribe(({ id, props }) => {
          if (
            props['xywh'] &&
            (id === this.model.sourceNodeId || id === this.model.targetNodeId)
          ) {
            this._updatePositions();
          }
        })
      );
    }
  }

  private _updatePositions(): void {
    const surface = this.model.surface;
    if (!surface) return;

    const sourceNode = surface.getElementById(
      this.model.sourceNodeId
    ) as ComfyNodeElementModel | null;
    const targetNode = surface.getElementById(
      this.model.targetNodeId
    ) as ComfyNodeElementModel | null;
    if (!sourceNode || !targetNode) return;

    const sourceBound = Bound.deserialize(sourceNode.xywh);
    const targetBound = Bound.deserialize(targetNode.xywh);

    // Source output port (right side of source node)
    const sx = sourceBound.x + sourceBound.w;
    const sy =
      sourceBound.y +
      TITLE_HEIGHT +
      PORT_ROW_HEIGHT * (this.model.sourceOutputIndex + 0.5) +
      PORT_RADIUS;

    // Target input port (left side of target node)
    const targetDef = getNodeDefinition(targetNode.classType);
    let targetInputIndex = 0;
    if (targetDef) {
      const allInputs = Object.keys(targetDef.inputs.required);
      if (targetDef.inputs.optional) {
        allInputs.push(...Object.keys(targetDef.inputs.optional));
      }
      targetInputIndex = allInputs.indexOf(this.model.targetInputName);
      if (targetInputIndex < 0) targetInputIndex = 0;
    }
    const tx = targetBound.x;
    const ty =
      targetBound.y +
      TITLE_HEIGHT +
      PORT_ROW_HEIGHT * (targetInputIndex + 0.5) +
      PORT_RADIUS;

    // Update local positions for hit-testing and DOM renderer
    this.model.sourcePos = [sx, sy];
    this.model.targetPos = [tx, ty];

    // Update xywh bounding box so the connector is found by spatial search
    const padding = 10;
    const minX = Math.min(sx, tx) - padding;
    const minY = Math.min(sy, ty) - padding;
    const maxX = Math.max(sx, tx) + padding;
    const maxY = Math.max(sy, ty) + padding;
    const newBound = new Bound(minX, minY, maxX - minX, maxY - minY);
    this.model.xywh = newBound.serialize();
  }
}
