import { DomElementRendererExtension } from '@blocksuite/affine-block-surface';
import type { DomRenderer } from '@blocksuite/affine-block-surface';
import { Bound } from '@blocksuite/global/gfx';

import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';
import {
  COMFY_NODE_CONSTANTS,
  getIOColor,
} from '../model/types.js';
import { getNodeDefinition } from '../node-registry/registry.js';

const { TITLE_HEIGHT, PORT_ROW_HEIGHT, PORT_RADIUS, H_PADDING, BORDER_RADIUS } =
  COMFY_NODE_CONSTANTS;

const comfyNodeDomRenderer = (
  model: ComfyNodeElementModel,
  element: HTMLElement,
  renderer: DomRenderer
): void => {
  const { zoom } = renderer.viewport;
  const bound = Bound.deserialize(model.xywh);
  const definition = getNodeDefinition(model.classType);

  element.style.width = `${bound.w * zoom}px`;
  element.style.height = `${bound.h * zoom}px`;
  element.style.borderRadius = `${BORDER_RADIUS * zoom}px`;
  element.style.backgroundColor = '#1e1e1e';
  element.style.border = '1px solid #555';
  element.style.overflow = 'hidden';
  element.style.position = 'relative';
  element.style.boxSizing = 'border-box';

  const children: Element[] = [];

  // Title bar
  const title = document.createElement('div');
  title.style.height = `${TITLE_HEIGHT * zoom}px`;
  title.style.backgroundColor = '#353535';
  title.style.color = '#ffffff';
  title.style.fontSize = `${12 * zoom}px`;
  title.style.fontWeight = 'bold';
  title.style.fontFamily = 'sans-serif';
  title.style.lineHeight = `${TITLE_HEIGHT * zoom}px`;
  title.style.paddingLeft = `${H_PADDING * zoom}px`;
  title.textContent = model.displayName || model.classType;
  children.push(title);

  // Execution state border
  if (model.executionState === 'executing') {
    element.style.border = `2px solid #00ff00`;
  } else if (model.executionState === 'error') {
    element.style.border = `2px solid #ff0000`;
  }

  // Preview image
  if (model.previewImageUrl) {
    const img = document.createElement('img');
    img.src = model.previewImageUrl;
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';
    children.push(img);
  }

  // Ports (simplified for DOM rendering)
  if (definition) {
    const inputEntries = Object.entries(definition.inputs.required);
    if (definition.inputs.optional) {
      inputEntries.push(...Object.entries(definition.inputs.optional));
    }

    for (let i = 0; i < inputEntries.length; i++) {
      const [name, config] = inputEntries[i];
      const ioType = config[0] as string;
      const portRow = document.createElement('div');
      portRow.style.height = `${PORT_ROW_HEIGHT * zoom}px`;
      portRow.style.display = 'flex';
      portRow.style.alignItems = 'center';
      portRow.style.paddingLeft = `${H_PADDING * zoom}px`;
      portRow.style.fontSize = `${11 * zoom}px`;
      portRow.style.color = '#cccccc';
      portRow.style.fontFamily = 'sans-serif';

      const dot = document.createElement('span');
      dot.style.width = `${PORT_RADIUS * 2 * zoom}px`;
      dot.style.height = `${PORT_RADIUS * 2 * zoom}px`;
      dot.style.borderRadius = '50%';
      dot.style.backgroundColor = getIOColor(ioType);
      dot.style.marginRight = `${6 * zoom}px`;
      dot.style.flexShrink = '0';
      portRow.appendChild(dot);

      const label = document.createElement('span');
      label.textContent = name;
      portRow.appendChild(label);

      children.push(portRow);
    }
  }

  element.replaceChildren(...children);
};

export const ComfyNodeDomRendererExtension = DomElementRendererExtension(
  'comfy-node',
  comfyNodeDomRenderer
);
