export type SkillState = 'locked' | 'available' | 'unlocked' | 'maxed';

export type SkillCategory = 'combat' | 'magic' | 'stealth';

export interface SkillCategoryColors {
  primary: string;
  background: string;
  glow: string;
}

export const SKILL_CATEGORY_COLORS: Record<SkillCategory, SkillCategoryColors> =
  {
    combat: { primary: '#e74c3c', background: '#2c1a1a', glow: '#ff6b6b' },
    magic: { primary: '#9b59b6', background: '#1f1a2e', glow: '#c49bde' },
    stealth: { primary: '#27ae60', background: '#1a2c1f', glow: '#5ddb92' },
  };

export const SKILL_STATE_COLORS = {
  locked: { border: '#444444', fill: '#2a2a2a', opacity: 0.5 },
  available: { border: '#88aacc', fill: '#1a2a3a', opacity: 1.0 },
  unlocked: { border: '#ffffff', fill: '#2a3a4a', opacity: 1.0 },
  maxed: { border: '#ffd700', fill: '#3a3520', opacity: 1.0 },
};

export const SKILL_TREE_CONSTANTS = {
  HEX_RADIUS: 40,
  NODE_WIDTH: 100,
  NODE_HEIGHT: 110,
  TIER_SPACING_Y: 180,
  NODE_SPACING_X: 160,
  SPARKLE_COUNT: 8,
  GLOW_MIN: 5,
  GLOW_MAX: 20,
  FLOW_DOT_RADIUS: 3,
  FLOW_SPEED: 0.01,
};

export interface SparkleParticle {
  angle: number;
  distance: number;
  size: number;
  speed: number;
  phase: number;
}
