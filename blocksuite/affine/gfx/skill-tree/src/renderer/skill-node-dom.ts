import type { DomRenderer } from '@blocksuite/affine-block-surface';
import { DomElementRendererExtension } from '@blocksuite/affine-block-surface';

import type { SkillNodeElementModel } from '../model/skill-node-element.js';
import { SKILL_STATE_COLORS } from '../model/types.js';

const skillNodeDomRenderer = (
  model: SkillNodeElementModel,
  element: HTMLElement,
  renderer: DomRenderer
): void => {
  const zoom = renderer.viewport.zoom;
  const state = model.skillState;
  const stateColors = SKILL_STATE_COLORS[state];

  element.style.width = `${model.w * zoom}px`;
  element.style.height = `${model.h * zoom}px`;
  element.style.opacity = String(stateColors.opacity);
  element.style.display = 'flex';
  element.style.flexDirection = 'column';
  element.style.alignItems = 'center';
  element.style.justifyContent = 'center';
  element.style.fontFamily = 'sans-serif';
  element.style.color = state === 'locked' ? '#666' : '#fff';
  element.style.pointerEvents = 'none';

  const icon = document.createElement('div');
  icon.style.fontSize = `${24 * zoom}px`;
  icon.textContent = model.iconEmoji;

  const name = document.createElement('div');
  name.style.fontSize = `${11 * zoom}px`;
  name.style.fontWeight = 'bold';
  name.style.marginTop = `${4 * zoom}px`;
  name.textContent = model.skillName;

  const children: HTMLElement[] = [icon, name];

  if (model.maxLevel > 1) {
    const level = document.createElement('div');
    level.style.fontSize = `${10 * zoom}px`;
    level.style.color = state === 'maxed' ? '#ffd700' : '#aaa';
    level.textContent = `${model.currentLevel}/${model.maxLevel}`;
    children.push(level);
  }

  element.replaceChildren(...children);
};

export const SkillNodeDomRendererExtension = DomElementRendererExtension(
  'skill-node',
  skillNodeDomRenderer
);
