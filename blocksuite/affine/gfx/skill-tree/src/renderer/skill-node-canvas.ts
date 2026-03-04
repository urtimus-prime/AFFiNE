import type { ElementRenderer } from '@blocksuite/affine-block-surface';
import { ElementRendererExtension } from '@blocksuite/affine-block-surface';

import type { SkillNodeElementModel } from '../model/skill-node-element.js';
import {
  SKILL_CATEGORY_COLORS,
  SKILL_STATE_COLORS,
  SKILL_TREE_CONSTANTS,
} from '../model/types.js';

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    // Flat-top hexagon: start at 0°
    const angle = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

const skillNodeRenderer: ElementRenderer<SkillNodeElementModel> = (
  model,
  ctx,
  matrix,
  _renderer
) => {
  ctx.save();
  ctx.setTransform(matrix);

  const { HEX_RADIUS } = SKILL_TREE_CONSTANTS;
  const w = model.w;
  const cx = w / 2;
  const cy = HEX_RADIUS + 5;
  const state = model.skillState;
  const category = model.category;
  const catColors = SKILL_CATEGORY_COLORS[category];
  const stateColors = SKILL_STATE_COLORS[state];

  ctx.globalAlpha = stateColors.opacity;

  // Glow effect
  if (state === 'available' || state === 'unlocked' || state === 'maxed') {
    const glowColor = state === 'maxed' ? '#ffd700' : catColors.glow;
    const glowIntensity =
      state === 'available'
        ? SKILL_TREE_CONSTANTS.GLOW_MIN +
          (SKILL_TREE_CONSTANTS.GLOW_MAX - SKILL_TREE_CONSTANTS.GLOW_MIN) *
            (0.5 + 0.5 * Math.sin(model.glowPhase))
        : state === 'maxed'
          ? SKILL_TREE_CONSTANTS.GLOW_MAX
          : SKILL_TREE_CONSTANTS.GLOW_MIN + 3;

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowIntensity;
  }

  // Hexagon fill with radial gradient
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, HEX_RADIUS);
  if (state === 'locked') {
    gradient.addColorStop(0, '#3a3a3a');
    gradient.addColorStop(1, '#1a1a1a');
  } else {
    gradient.addColorStop(0, catColors.primary + 'cc');
    gradient.addColorStop(1, catColors.background);
  }

  drawHexagon(ctx, cx, cy, HEX_RADIUS);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Border
  drawHexagon(ctx, cx, cy, HEX_RADIUS);
  ctx.strokeStyle = stateColors.border;
  ctx.lineWidth = state === 'maxed' ? 3 : 2;
  ctx.stroke();

  // Reset shadow for text
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Sparkle particles for maxed state
  if (state === 'maxed' && model.sparkleSeeds.length > 0) {
    for (const spark of model.sparkleSeeds) {
      const angle = spark.angle + model.glowPhase * spark.speed;
      const dist = spark.distance;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const sparkAlpha = 0.5 + 0.5 * Math.sin(model.glowPhase + spark.phase);

      ctx.globalAlpha = sparkAlpha;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      // Draw a small 4-pointed star
      const s = spark.size;
      ctx.moveTo(sx, sy - s);
      ctx.lineTo(sx + s * 0.3, sy - s * 0.3);
      ctx.lineTo(sx + s, sy);
      ctx.lineTo(sx + s * 0.3, sy + s * 0.3);
      ctx.lineTo(sx, sy + s);
      ctx.lineTo(sx - s * 0.3, sy + s * 0.3);
      ctx.lineTo(sx - s, sy);
      ctx.lineTo(sx - s * 0.3, sy - s * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = stateColors.opacity;
  }

  // Icon emoji
  ctx.font = '24px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(model.iconEmoji, cx, cy);

  // Skill name below hexagon
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = state === 'locked' ? '#666666' : '#ffffff';
  ctx.fillText(model.skillName, cx, cy + HEX_RADIUS + 8);

  // Level indicator
  if (model.maxLevel > 1) {
    ctx.font = '10px sans-serif';
    ctx.fillStyle = state === 'maxed' ? '#ffd700' : '#aaaaaa';
    ctx.fillText(
      `${model.currentLevel}/${model.maxLevel}`,
      cx,
      cy + HEX_RADIUS + 22
    );
  }

  ctx.restore();
};

export const SkillNodeRendererExtension = ElementRendererExtension(
  'skill-node',
  skillNodeRenderer
);
