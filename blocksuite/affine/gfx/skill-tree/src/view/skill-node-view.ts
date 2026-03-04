import { GfxElementModelView } from '@blocksuite/std/gfx';

import type { SkillNodeElementModel } from '../model/skill-node-element.js';
import { SKILL_TREE_CONSTANTS, type SparkleParticle } from '../model/types.js';

export class SkillNodeElementView extends GfxElementModelView<SkillNodeElementModel> {
  static override type = 'skill-node';

  private _animationId: number | null = null;

  override onCreated(): void {
    super.onCreated();
    this._initSparkles();
    this._startAnimation();
  }

  private _initSparkles(): void {
    if (
      this.model.skillState === 'maxed' &&
      this.model.sparkleSeeds.length === 0
    ) {
      const sparkles: SparkleParticle[] = [];
      for (let i = 0; i < SKILL_TREE_CONSTANTS.SPARKLE_COUNT; i++) {
        sparkles.push({
          angle: (Math.PI * 2 * i) / SKILL_TREE_CONSTANTS.SPARKLE_COUNT,
          distance:
            SKILL_TREE_CONSTANTS.HEX_RADIUS * 0.8 +
            Math.random() * SKILL_TREE_CONSTANTS.HEX_RADIUS * 0.6,
          size: 2 + Math.random() * 3,
          speed: 0.3 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
        });
      }
      this.model.sparkleSeeds = sparkles;
    }
  }

  private _startAnimation(): void {
    const state = this.model.skillState;
    if (state !== 'available' && state !== 'maxed') return;

    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const currentState = this.model.skillState;
      if (currentState !== 'available' && currentState !== 'maxed') {
        this._animationId = null;
        return;
      }

      this.model.glowPhase = (this.model.glowPhase + dt * 2.5) % (Math.PI * 2);
      this._animationId = requestAnimationFrame(animate);
    };

    this._animationId = requestAnimationFrame(animate);
    this.disposable.add(() => {
      if (this._animationId !== null) {
        cancelAnimationFrame(this._animationId);
        this._animationId = null;
      }
    });
  }

  restartAnimationIfNeeded(): void {
    if (this._animationId !== null) return;
    this._initSparkles();
    this._startAnimation();
  }
}
