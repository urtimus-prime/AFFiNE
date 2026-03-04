import type { ElementRenderer } from '@blocksuite/affine-block-surface';
import { ElementRendererExtension } from '@blocksuite/affine-block-surface';
import { Bound } from '@blocksuite/global/gfx';

import type { ComfyConnectorElementModel } from '../model/comfy-connector-element.js';
import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';
import { COMFY_NODE_CONSTANTS } from '../model/types.js';
import { getNodeDefinition } from '../node-registry/registry.js';

const { TITLE_HEIGHT, PORT_ROW_HEIGHT, PORT_RADIUS } = COMFY_NODE_CONSTANTS;

/**
 * Compute source/target port world positions from the connected nodes.
 */
function computePortPositions(model: ComfyConnectorElementModel): {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
} | null {
  const surface = model.surface;
  if (!surface) return null;

  const sourceNode = surface.getElementById(
    model.sourceNodeId
  ) as ComfyNodeElementModel | null;
  const targetNode = surface.getElementById(
    model.targetNodeId
  ) as ComfyNodeElementModel | null;
  if (!sourceNode || !targetNode) return null;

  const sourceBound = Bound.deserialize(sourceNode.xywh);
  const targetBound = Bound.deserialize(targetNode.xywh);

  // Source output port (right side of node)
  const sy =
    sourceBound.y +
    TITLE_HEIGHT +
    PORT_ROW_HEIGHT * (model.sourceOutputIndex + 0.5) +
    PORT_RADIUS;
  const sx = sourceBound.x + sourceBound.w;

  // Target input port (left side of node)
  const targetDef = getNodeDefinition(targetNode.classType);
  let targetInputIndex = 0;
  if (targetDef) {
    const allInputs = Object.keys(targetDef.inputs.required);
    if (targetDef.inputs.optional) {
      allInputs.push(...Object.keys(targetDef.inputs.optional));
    }
    targetInputIndex = allInputs.indexOf(model.targetInputName);
    if (targetInputIndex < 0) targetInputIndex = 0;
  }
  const ty =
    targetBound.y +
    TITLE_HEIGHT +
    PORT_ROW_HEIGHT * (targetInputIndex + 0.5) +
    PORT_RADIUS;
  const tx = targetBound.x;

  return { sx, sy, tx, ty };
}

export const comfyConnectorRenderer: ElementRenderer<ComfyConnectorElementModel> =
  (model, ctx, matrix, _renderer) => {
    const positions = computePortPositions(model);
    if (!positions) return;

    const { sx, sy, tx, ty } = positions;
    const strokeColor = model.strokeColor;
    const cpOffset = Math.max(Math.abs(tx - sx) * 0.5, 50);

    // The matrix is: scale.translate(element.x - viewportBound.x, element.y - viewportBound.y).
    // Convert world coords to local coords by subtracting the element origin.
    const ox = model.x;
    const oy = model.y;
    const lsx = sx - ox;
    const lsy = sy - oy;
    const ltx = tx - ox;
    const lty = ty - oy;

    ctx.save();
    ctx.setTransform(matrix);

    ctx.beginPath();
    ctx.moveTo(lsx, lsy);
    ctx.bezierCurveTo(
      lsx + cpOffset,
      lsy,
      ltx - cpOffset,
      lty,
      ltx,
      lty
    );
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  };

export const ComfyConnectorRendererExtension = ElementRendererExtension(
  'comfy-connector',
  comfyConnectorRenderer
);
