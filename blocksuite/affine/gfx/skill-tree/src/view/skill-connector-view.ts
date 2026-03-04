import { Bound } from '@blocksuite/global/gfx';
import { GfxElementModelView } from '@blocksuite/std/gfx';

import type { SkillConnectorElementModel } from '../model/skill-connector-element.js';
import type { SkillNodeElementModel } from '../model/skill-node-element.js';
import { SKILL_TREE_CONSTANTS } from '../model/types.js';

export class SkillConnectorElementView extends GfxElementModelView<SkillConnectorElementModel> {
  static override type = 'skill-connector';

  private _animationId: number | null = null;

  override onCreated(): void {
    super.onCreated();
    this._updatePositions();
    this._updateActive();
    this._startFlowAnimation();

    const surface = this.model.surface;
    if (surface) {
      this.disposable.add(
        surface.elementUpdated.subscribe(({ id, props }) => {
          if (
            (props['xywh'] || props['skillState']) &&
            (id === this.model.sourceNodeId || id === this.model.targetNodeId)
          ) {
            this._updatePositions();
            this._updateActive();
          }
        })
      );
    }
  }

  private _updatePositions(): void {
    const surface = this.model.surface;
    if (!surface) return;

    const sourceNode = surface.getElementById(
      this.model.sourceNodeId
    ) as SkillNodeElementModel | null;
    const targetNode = surface.getElementById(
      this.model.targetNodeId
    ) as SkillNodeElementModel | null;

    if (!sourceNode || !targetNode) return;

    const sBound = Bound.deserialize(sourceNode.xywh);
    const tBound = Bound.deserialize(targetNode.xywh);

    // Source: bottom-center of node
    const sx = sBound.x + sBound.w / 2;
    const sy = sBound.y + sBound.h;
    // Target: top-center of node
    const tx = tBound.x + tBound.w / 2;
    const ty = tBound.y;

    this.model.sourceEdge = [sx, sy];
    this.model.targetEdge = [tx, ty];

    // Update connector's bounding box
    const minX = Math.min(sx, tx) - 20;
    const minY = Math.min(sy, ty) - 20;
    const maxX = Math.max(sx, tx) + 20;
    const maxY = Math.max(sy, ty) + 20;
    const newBound = new Bound(minX, minY, maxX - minX, maxY - minY);
    this.model.xywh = newBound.serialize();
  }

  private _updateActive(): void {
    const surface = this.model.surface;
    if (!surface) return;

    const sourceNode = surface.getElementById(
      this.model.sourceNodeId
    ) as SkillNodeElementModel | null;

    this.model.isActive =
      sourceNode != null &&
      (sourceNode.skillState === 'unlocked' ||
        sourceNode.skillState === 'maxed');
  }

  private _startFlowAnimation(): void {
    let lastTime = performance.now();
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (this.model.isActive) {
        this.model.flowPhase =
          (this.model.flowPhase + dt * SKILL_TREE_CONSTANTS.FLOW_SPEED * 100) %
          1;
      }

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
}
