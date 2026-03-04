import type { SerializedXYWH } from '@blocksuite/global/gfx';
import { Bound, polygonNearestPoint } from '@blocksuite/global/gfx';
import type { BaseElementProps, PointTestOptions } from '@blocksuite/std/gfx';
import { field, GfxPrimitiveElementModel, local } from '@blocksuite/std/gfx';

import type { ComfyNodeDefinition } from '../node-registry/registry.js';
import {
  COMFY_NODE_CONSTANTS,
  type ComfyExecutionState,
  type ComfyPortDef,
} from './types.js';

export type ComfyNodeProps = BaseElementProps & {
  classType: string;
  category: string;
  displayName: string;
  widgetValues: Record<string, unknown>;
  xywh: SerializedXYWH;
};

export class ComfyNodeElementModel extends GfxPrimitiveElementModel<ComfyNodeProps> {
  get type() {
    return 'comfy-node' as const;
  }

  /** ComfyUI node class type (e.g. "KSampler", "CheckpointLoaderSimple"). */
  @field()
  accessor classType: string = '';

  /** Node category (e.g. "sampling", "loaders"). */
  @field()
  accessor category: string = '';

  /** Human-readable display name. */
  @field()
  accessor displayName: string = '';

  /** Widget parameter values — maps directly to ComfyUI `inputs`. */
  @field()
  accessor widgetValues: Record<string, unknown> = {};

  /** Position and size on canvas. */
  @field()
  accessor xywh: SerializedXYWH = '[0,0,280,150]';

  /** Rotation — ComfyUI nodes don't rotate, always 0. */
  @field()
  accessor rotate: number = 0;

  // --- Local-only (per-client) state ---

  /** Execution state — not synced across peers. */
  @local()
  accessor executionState: ComfyExecutionState = 'idle';

  /** Execution progress 0-1. */
  @local()
  accessor executionProgress: number = 0;

  /** Preview image URL from execution output. */
  @local()
  accessor previewImageUrl: string | null = null;

  /**
   * Compute port positions based on node definition and element bounds.
   * Ports are derived, not stored — avoids element proliferation.
   */
  computeInputPortPositions(definition: ComfyNodeDefinition | null): Array<{
    name: string;
    type: string;
    x: number;
    y: number;
  }> {
    if (!definition) return [];

    const bound = Bound.deserialize(this.xywh);
    const inputs = this._getInputPorts(definition);
    const { TITLE_HEIGHT, PORT_ROW_HEIGHT, PORT_RADIUS } =
      COMFY_NODE_CONSTANTS;

    return inputs.map((port, i) => ({
      name: port.name,
      type: port.type,
      x: bound.x,
      y: bound.y + TITLE_HEIGHT + PORT_ROW_HEIGHT * (i + 0.5) + PORT_RADIUS,
    }));
  }

  computeOutputPortPositions(definition: ComfyNodeDefinition | null): Array<{
    name: string;
    type: string;
    x: number;
    y: number;
  }> {
    if (!definition) return [];

    const bound = Bound.deserialize(this.xywh);
    const { TITLE_HEIGHT, PORT_ROW_HEIGHT, PORT_RADIUS } =
      COMFY_NODE_CONSTANTS;

    return definition.outputs.map((output, i) => ({
      name: output.name,
      type: output.type,
      x: bound.x + bound.w,
      y: bound.y + TITLE_HEIGHT + PORT_ROW_HEIGHT * (i + 0.5) + PORT_RADIUS,
    }));
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
    const bound = Bound.deserialize(this.xywh);
    return bound.isPointInBound([x, y]);
  }

  override getNearestPoint(point: [number, number]): [number, number] {
    const bound = Bound.deserialize(this.xywh);
    return polygonNearestPoint(bound.points, point) as [number, number];
  }

  private _getInputPorts(definition: ComfyNodeDefinition): ComfyPortDef[] {
    const ports: ComfyPortDef[] = [];

    for (const [name, config] of Object.entries(
      definition.inputs.required
    )) {
      const type = config[0] as string;
      ports.push({ name, type });
    }

    if (definition.inputs.optional) {
      for (const [name, config] of Object.entries(
        definition.inputs.optional
      )) {
        const type = config[0] as string;
        ports.push({ name, type });
      }
    }

    return ports;
  }
}
