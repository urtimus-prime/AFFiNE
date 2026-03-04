import type { SerializedXYWH } from '@blocksuite/global/gfx';
import { Bound } from '@blocksuite/global/gfx';
import type { BaseElementProps, PointTestOptions } from '@blocksuite/std/gfx';
import { field, GfxPrimitiveElementModel, local } from '@blocksuite/std/gfx';

import { getIOColor } from './types.js';

export type ComfyConnectorProps = BaseElementProps & {
  sourceNodeId: string;
  sourceOutputIndex: number;
  targetNodeId: string;
  targetInputName: string;
  ioType: string;
  xywh: SerializedXYWH;
};

/**
 * Typed connector between ComfyUI node ports.
 * Separate from existing ConnectorElementModel to avoid polluting generic connector logic.
 */
export class ComfyConnectorElementModel extends GfxPrimitiveElementModel<ComfyConnectorProps> {
  get type() {
    return 'comfy-connector' as const;
  }

  /** Source ComfyNode element ID. */
  @field()
  accessor sourceNodeId: string = '';

  /** Output port index on source node. */
  @field()
  accessor sourceOutputIndex: number = 0;

  /** Target ComfyNode element ID. */
  @field()
  accessor targetNodeId: string = '';

  /** Input port name on target node. */
  @field()
  accessor targetInputName: string = '';

  /** Data type flowing through this connection (IMAGE, MODEL, etc.). */
  @field()
  accessor ioType: string = '';

  /** Bounding box — computed from source/target port positions. */
  @field()
  accessor xywh: SerializedXYWH = '[0,0,0,0]';

  /** Rotation — connectors don't rotate. */
  @field()
  accessor rotate: number = 0;

  /** Resolved source port position (local, recomputed on layout changes). */
  @local()
  accessor sourcePos: [number, number] = [0, 0];

  /** Resolved target port position (local, recomputed on layout changes). */
  @local()
  accessor targetPos: [number, number] = [0, 0];

  /** Get the stroke color based on I/O type. */
  get strokeColor(): string {
    return getIOColor(this.ioType);
  }

  override containsBound(bounds: Bound): boolean {
    const bound = Bound.deserialize(this.xywh);
    return bound.contains(bounds);
  }

  override includesPoint(
    x: number,
    y: number,
    _options: PointTestOptions
  ): boolean {
    // Hit test: check proximity to the bezier curve
    const [sx, sy] = this.sourcePos;
    const [tx, ty] = this.targetPos;
    const threshold = 8;

    // Sample points along the bezier curve for hit testing
    const cpOffset = Math.max(Math.abs(tx - sx) * 0.5, 50);
    for (let t = 0; t <= 1; t += 0.05) {
      const invT = 1 - t;
      const px =
        invT * invT * invT * sx +
        3 * invT * invT * t * (sx + cpOffset) +
        3 * invT * t * t * (tx - cpOffset) +
        t * t * t * tx;
      const py =
        invT * invT * invT * sy +
        3 * invT * invT * t * sy +
        3 * invT * t * t * ty +
        t * t * t * ty;
      const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
      if (dist < threshold) return true;
    }
    return false;
  }

  override getNearestPoint(_point: [number, number]): [number, number] {
    // Simplified: return midpoint of the connection
    const [sx, sy] = this.sourcePos;
    const [tx, ty] = this.targetPos;
    return [(sx + tx) / 2, (sy + ty) / 2];
  }
}
