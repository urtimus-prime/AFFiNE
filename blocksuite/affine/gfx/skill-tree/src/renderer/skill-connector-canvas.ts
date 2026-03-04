import type { ElementRenderer } from '@blocksuite/affine-block-surface';
import { ElementRendererExtension } from '@blocksuite/affine-block-surface';

import type { SkillConnectorElementModel } from '../model/skill-connector-element.js';
import { SKILL_TREE_CONSTANTS } from '../model/types.js';

const skillConnectorRenderer: ElementRenderer<SkillConnectorElementModel> = (
  model,
  ctx,
  matrix,
  _renderer
) => {
  ctx.save();
  ctx.setTransform(matrix);

  const [sx, sy] = model.sourceEdge;
  const [tx, ty] = model.targetEdge;

  // Convert world coords to local coords
  const ox = model.x;
  const oy = model.y;
  const lsx = sx - ox;
  const lsy = sy - oy;
  const ltx = tx - ox;
  const lty = ty - oy;

  if (lsx === 0 && lsy === 0 && ltx === 0 && lty === 0) {
    ctx.restore();
    return;
  }

  const cpOffset = Math.max(Math.abs(lty - lsy) * 0.4, 40);
  const cp1x = lsx;
  const cp1y = lsy + cpOffset;
  const cp2x = ltx;
  const cp2y = lty - cpOffset;

  if (model.isActive) {
    // Glowing active connector
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lsx, lsy);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ltx, lty);
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Bright overlay stroke
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(lsx, lsy);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ltx, lty);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Flowing energy dot
    const t = model.flowPhase;
    const it = 1 - t;
    const dotX =
      it * it * it * lsx +
      3 * it * it * t * cp1x +
      3 * it * t * t * cp2x +
      t * t * t * ltx;
    const dotY =
      it * it * it * lsy +
      3 * it * it * t * cp1y +
      3 * it * t * t * cp2y +
      t * t * t * lty;

    const dotGradient = ctx.createRadialGradient(
      dotX,
      dotY,
      0,
      dotX,
      dotY,
      SKILL_TREE_CONSTANTS.FLOW_DOT_RADIUS * 3
    );
    dotGradient.addColorStop(0, '#ffffff');
    dotGradient.addColorStop(0.3, '#88ccff');
    dotGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = dotGradient;
    ctx.beginPath();
    ctx.arc(
      dotX,
      dotY,
      SKILL_TREE_CONSTANTS.FLOW_DOT_RADIUS * 3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else {
    // Inactive dashed grey line
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(lsx, lsy);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ltx, lty);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
};

export const SkillConnectorRendererExtension = ElementRendererExtension(
  'skill-connector',
  skillConnectorRenderer
);
