import { SKILL_TREE_CONSTANTS } from '../model/types.js';

export interface SkillNodeLayout {
  id: string;
  tier: number;
  indexInTier: number;
  x: number;
  y: number;
}

export function computeSkillTreeLayout(
  nodes: { id: string; tier: number }[]
): Map<string, SkillNodeLayout> {
  const { TIER_SPACING_Y, NODE_SPACING_X } = SKILL_TREE_CONSTANTS;

  // Group by tier
  const tiers = new Map<number, { id: string; tier: number }[]>();
  for (const node of nodes) {
    const list = tiers.get(node.tier) ?? [];
    list.push(node);
    tiers.set(node.tier, list);
  }

  const result = new Map<string, SkillNodeLayout>();
  const startY = 100;

  for (const [tier, tierNodes] of tiers) {
    const count = tierNodes.length;
    const totalWidth = (count - 1) * NODE_SPACING_X;
    const startX = 400 - totalWidth / 2;

    for (let i = 0; i < tierNodes.length; i++) {
      const node = tierNodes[i];
      result.set(node.id, {
        id: node.id,
        tier,
        indexInTier: i,
        x: startX + i * NODE_SPACING_X,
        y: startY + tier * TIER_SPACING_Y,
      });
    }
  }

  return result;
}
