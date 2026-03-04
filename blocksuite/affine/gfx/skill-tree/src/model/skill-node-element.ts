import type { SerializedXYWH } from '@blocksuite/global/gfx';
import { Bound } from '@blocksuite/global/gfx';
import type { BaseElementProps, PointTestOptions } from '@blocksuite/std/gfx';
import { field, GfxPrimitiveElementModel, local } from '@blocksuite/std/gfx';

import {
  SKILL_TREE_CONSTANTS,
  type SkillCategory,
  type SkillState,
  type SparkleParticle,
} from './types.js';

export type SkillNodeProps = BaseElementProps & {
  skillName: string;
  skillDescription: string;
  category: SkillCategory;
  tier: number;
  skillState: SkillState;
  iconEmoji: string;
  maxLevel: number;
  currentLevel: number;
  prerequisiteIds: string[];
  xywh: SerializedXYWH;
};

export class SkillNodeElementModel extends GfxPrimitiveElementModel<SkillNodeProps> {
  get type() {
    return 'skill-node' as const;
  }

  @field() accessor skillName: string = '';
  @field() accessor skillDescription: string = '';
  @field() accessor category: SkillCategory = 'combat';
  @field() accessor tier: number = 0;
  @field() accessor skillState: SkillState = 'locked';
  @field() accessor iconEmoji: string = '';
  @field() accessor maxLevel: number = 1;
  @field() accessor currentLevel: number = 0;
  @field() accessor prerequisiteIds: string[] = [];
  @field() accessor xywh: SerializedXYWH = '[0,0,100,110]';
  @field() accessor rotate: number = 0;

  @local() accessor glowPhase: number = 0;
  @local() accessor sparkleSeeds: SparkleParticle[] = [];
  @local() accessor transitionProgress: number = 1;

  override containsBound(bounds: Bound): boolean {
    return bounds.contains(Bound.deserialize(this.xywh));
  }

  override includesPoint(
    x: number,
    y: number,
    _options: PointTestOptions
  ): boolean {
    const bound = Bound.deserialize(this.xywh);
    const cx = bound.x + bound.w / 2;
    const cy = bound.y + bound.h / 2;
    const r = SKILL_TREE_CONSTANTS.HEX_RADIUS;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r * 1.2;
  }

  override getNearestPoint(_point: [number, number]): [number, number] {
    const bound = Bound.deserialize(this.xywh);
    return [bound.x + bound.w / 2, bound.y + bound.h / 2];
  }
}
