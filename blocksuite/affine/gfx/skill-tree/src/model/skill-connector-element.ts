import type { SerializedXYWH } from '@blocksuite/global/gfx';
import type { BaseElementProps, PointTestOptions } from '@blocksuite/std/gfx';
import { field, GfxPrimitiveElementModel, local } from '@blocksuite/std/gfx';

export type SkillConnectorProps = BaseElementProps & {
  sourceNodeId: string;
  targetNodeId: string;
  xywh: SerializedXYWH;
};

export class SkillConnectorElementModel extends GfxPrimitiveElementModel<SkillConnectorProps> {
  get type() {
    return 'skill-connector' as const;
  }

  @field() accessor sourceNodeId: string = '';
  @field() accessor targetNodeId: string = '';
  @field() accessor xywh: SerializedXYWH = '[0,0,0,0]';
  @field() accessor rotate: number = 0;

  @local() accessor sourceEdge: [number, number] = [0, 0];
  @local() accessor targetEdge: [number, number] = [0, 0];
  @local() accessor flowPhase: number = 0;
  @local() accessor isActive: boolean = false;

  override includesPoint(
    x: number,
    y: number,
    _options: PointTestOptions
  ): boolean {
    const [sx, sy] = this.sourceEdge;
    const [tx, ty] = this.targetEdge;
    if (sx === 0 && sy === 0 && tx === 0 && ty === 0) return false;

    const threshold = 8;
    for (let t = 0; t <= 1; t += 0.05) {
      const cpOffset = Math.max(Math.abs(ty - sy) * 0.4, 40);
      const cp1y = sy + cpOffset;
      const cp2y = ty - cpOffset;
      const it = 1 - t;
      const px =
        it * it * it * sx +
        3 * it * it * t * sx +
        3 * it * t * t * tx +
        t * t * t * tx;
      const py =
        it * it * it * sy +
        3 * it * it * t * cp1y +
        3 * it * t * t * cp2y +
        t * t * t * ty;
      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy <= threshold * threshold) return true;
    }
    return false;
  }

  override getNearestPoint(_point: [number, number]): [number, number] {
    return [
      (this.sourceEdge[0] + this.targetEdge[0]) / 2,
      (this.sourceEdge[1] + this.targetEdge[1]) / 2,
    ];
  }
}
