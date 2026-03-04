// Models
export type { SkillConnectorProps } from './model/skill-connector-element.js';
export { SkillConnectorElementModel } from './model/skill-connector-element.js';
export type { SkillNodeProps } from './model/skill-node-element.js';
export { SkillNodeElementModel } from './model/skill-node-element.js';
export {
  SKILL_CATEGORY_COLORS,
  SKILL_STATE_COLORS,
  SKILL_TREE_CONSTANTS,
  type SkillCategory,
  type SkillCategoryColors,
  type SkillState,
  type SparkleParticle,
} from './model/types.js';

// Renderers
export { SkillConnectorRendererExtension } from './renderer/skill-connector-canvas.js';
export { SkillConnectorDomRendererExtension } from './renderer/skill-connector-dom.js';
export { SkillNodeRendererExtension } from './renderer/skill-node-canvas.js';
export { SkillNodeDomRendererExtension } from './renderer/skill-node-dom.js';

// Views
export { SkillConnectorElementView } from './view/skill-connector-view.js';
export { SkillNodeElementView } from './view/skill-node-view.js';

// Layout
export {
  computeSkillTreeLayout,
  type SkillNodeLayout,
} from './layout/skill-tree-layout.js';

// Middleware
export { skillTreeElementRegistrationExtension } from './middleware.js';
