import { DomElementRendererExtension } from '@blocksuite/affine-block-surface';
import type { DomRenderer } from '@blocksuite/affine-block-surface';

import type { ComfyConnectorElementModel } from '../model/comfy-connector-element.js';

const comfyConnectorDomRenderer = (
  model: ComfyConnectorElementModel,
  element: HTMLElement,
  renderer: DomRenderer
): void => {
  const { zoom } = renderer.viewport;
  const [sx, sy] = model.sourcePos;
  const [tx, ty] = model.targetPos;

  if (sx === 0 && sy === 0 && tx === 0 && ty === 0) {
    element.style.display = 'none';
    return;
  }

  const minX = Math.min(sx, tx);
  const minY = Math.min(sy, ty);
  const maxX = Math.max(sx, tx);
  const maxY = Math.max(sy, ty);
  const padding = 60;

  const w = (maxX - minX + padding * 2) * zoom;
  const h = (maxY - minY + padding * 2) * zoom;

  element.style.width = `${w}px`;
  element.style.height = `${h}px`;
  element.style.overflow = 'visible';
  element.style.position = 'relative';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute(
    'viewBox',
    `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`
  );
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';

  const cpOffset = Math.max(Math.abs(tx - sx) * 0.5, 50);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute(
    'd',
    `M ${sx} ${sy} C ${sx + cpOffset} ${sy}, ${tx - cpOffset} ${ty}, ${tx} ${ty}`
  );
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', model.strokeColor);
  path.setAttribute('stroke-width', '2.5');
  svg.append(path);

  element.replaceChildren(svg);
};

export const ComfyConnectorDomRendererExtension = DomElementRendererExtension(
  'comfy-connector',
  comfyConnectorDomRenderer
);
