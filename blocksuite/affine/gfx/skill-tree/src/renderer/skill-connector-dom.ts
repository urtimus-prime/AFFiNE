import type { DomRenderer } from '@blocksuite/affine-block-surface';
import { DomElementRendererExtension } from '@blocksuite/affine-block-surface';

import type { SkillConnectorElementModel } from '../model/skill-connector-element.js';

const skillConnectorDomRenderer = (
  model: SkillConnectorElementModel,
  element: HTMLElement,
  renderer: DomRenderer
): void => {
  const zoom = renderer.viewport.zoom;
  const [sx, sy] = model.sourceEdge;
  const [tx, ty] = model.targetEdge;
  const ox = model.x;
  const oy = model.y;
  const lsx = (sx - ox) * zoom;
  const lsy = (sy - oy) * zoom;
  const ltx = (tx - ox) * zoom;
  const lty = (ty - oy) * zoom;

  if (lsx === 0 && lsy === 0 && ltx === 0 && lty === 0) {
    element.style.display = 'none';
    return;
  }
  element.style.display = 'block';

  const w = model.w * zoom;
  const h = model.h * zoom;
  const cpOffset = Math.max(Math.abs(lty - lsy) * 0.4, 40 * zoom);
  const color = model.isActive ? '#4a9eff' : '#444444';
  const strokeDash = model.isActive ? '' : 'stroke-dasharray="6 4"';

  element.innerHTML = `<svg width="${w}" height="${h}" style="overflow:visible">
    <path d="M${lsx},${lsy} C${lsx},${lsy + cpOffset} ${ltx},${lty - cpOffset} ${ltx},${lty}"
      fill="none" stroke="${color}" stroke-width="${model.isActive ? 2.5 : 1.5}" ${strokeDash}/>
  </svg>`;
};

export const SkillConnectorDomRendererExtension = DomElementRendererExtension(
  'skill-connector',
  skillConnectorDomRenderer
);
