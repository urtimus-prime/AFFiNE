import type { ElementRenderer } from '@blocksuite/affine-block-surface';
import { ElementRendererExtension } from '@blocksuite/affine-block-surface';
import { Bound } from '@blocksuite/global/gfx';

import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';
import {
  COMFY_NODE_CONSTANTS,
  getIOColor,
} from '../model/types.js';
import { getNodeDefinition } from '../node-registry/registry.js';

const {
  TITLE_HEIGHT,
  PORT_ROW_HEIGHT,
  PORT_RADIUS,
  H_PADDING,
  BORDER_RADIUS,
} = COMFY_NODE_CONSTANTS;

/** Category → title bar color mapping. */
const CATEGORY_COLORS: Record<string, string> = {
  sampling: '#4a6a4a',
  loaders: '#4a4a6a',
  conditioning: '#6a4a4a',
  latent: '#6a4a6a',
  image: '#4a5a6a',
  _default: '#353535',
};

function getCategoryColor(category: string): string {
  // Try direct match, then first segment
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const base = category.split('/')[0];
  return CATEGORY_COLORS[base] ?? CATEGORY_COLORS['_default'];
}

export const comfyNodeRenderer: ElementRenderer<ComfyNodeElementModel> = (
  model,
  ctx,
  matrix,
  _renderer
) => {
  const bound = Bound.deserialize(model.xywh);
  const { w, h } = bound;
  const definition = getNodeDefinition(model.classType);

  ctx.save();
  ctx.setTransform(matrix);

  // --- Node body (rounded rect) ---
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, BORDER_RADIUS);
  ctx.fillStyle = '#1e1e1e';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- Title bar ---
  ctx.beginPath();
  ctx.roundRect(0, 0, w, TITLE_HEIGHT, [BORDER_RADIUS, BORDER_RADIUS, 0, 0]);
  ctx.fillStyle = getCategoryColor(model.category);
  ctx.fill();

  // Title text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    model.displayName || model.classType,
    H_PADDING,
    TITLE_HEIGHT / 2
  );

  // --- Execution state indicator ---
  if (model.executionState === 'executing') {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, BORDER_RADIUS);
    ctx.stroke();

    // Progress bar
    if (model.executionProgress > 0) {
      ctx.fillStyle = '#00ff0044';
      ctx.fillRect(0, h - 4, w * model.executionProgress, 4);
    }
  } else if (model.executionState === 'error') {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, BORDER_RADIUS);
    ctx.stroke();
  }

  if (!definition) {
    // Unknown node — just show class type
    ctx.fillStyle = '#999';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Unknown: ${model.classType}`,
      w / 2,
      TITLE_HEIGHT + 20
    );
    ctx.restore();
    return;
  }

  // --- Input ports (left side) ---
  const inputEntries = Object.entries(definition.inputs.required);
  if (definition.inputs.optional) {
    inputEntries.push(...Object.entries(definition.inputs.optional));
  }

  for (let i = 0; i < inputEntries.length; i++) {
    const [name, config] = inputEntries[i];
    const ioType = config[0] as string;
    const py = TITLE_HEIGHT + PORT_ROW_HEIGHT * (i + 0.5) + PORT_RADIUS;

    // Port circle
    ctx.beginPath();
    ctx.arc(0, py, PORT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = getIOColor(ioType);
    ctx.fill();

    // Port label
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(name, H_PADDING, py);
  }

  // --- Output ports (right side) ---
  for (let i = 0; i < definition.outputs.length; i++) {
    const output = definition.outputs[i];
    const py = TITLE_HEIGHT + PORT_ROW_HEIGHT * (i + 0.5) + PORT_RADIUS;

    // Port circle
    ctx.beginPath();
    ctx.arc(w, py, PORT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = getIOColor(output.type);
    ctx.fill();

    // Port label
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(output.name, w - H_PADDING, py);
  }

  ctx.restore();
};

export const ComfyNodeRendererExtension = ElementRendererExtension(
  'comfy-node',
  comfyNodeRenderer
);
