import {
  DefaultTool,
  EdgelessCRUDIdentifier,
  type SurfaceBlockComponent,
} from '@blocksuite/affine-block-surface';
import { Bound } from '@blocksuite/global/gfx';
import type { PointerEventState } from '@blocksuite/std';
import { BaseTool } from '@blocksuite/std/gfx';

import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';
import { COMFY_NODE_CONSTANTS } from '../model/types.js';
import { getNodeDefinition } from '../node-registry/registry.js';

export type ComfyNodeToolOption = {
  classType: string;
};

/**
 * Tool for placing ComfyUI nodes on the canvas.
 * Click to place a node at the clicked position.
 */
export class ComfyNodeTool extends BaseTool<ComfyNodeToolOption> {
  static override toolName = 'comfy-node';

  private get _surfaceComponent() {
    return this.gfx.surfaceComponent as SurfaceBlockComponent | null;
  }

  override click(e: PointerEventState): void {
    const classType = this.activatedOption.classType;
    if (!classType) return;

    const definition = getNodeDefinition(classType);
    if (!definition) return;

    // Calculate node height based on port count
    const inputCount =
      Object.keys(definition.inputs.required).length +
      Object.keys(definition.inputs.optional ?? {}).length;
    const outputCount = definition.outputs.length;
    const maxPorts = Math.max(inputCount, outputCount, 1);
    const height =
      COMFY_NODE_CONSTANTS.TITLE_HEIGHT +
      COMFY_NODE_CONSTANTS.PORT_ROW_HEIGHT * maxPorts +
      COMFY_NODE_CONSTANTS.BOTTOM_PADDING;

    const [x, y] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const w = COMFY_NODE_CONSTANTS.DEFAULT_WIDTH;
    const bound = new Bound(x - w / 2, y - height / 2, w, height);

    const crud = this.std.get(EdgelessCRUDIdentifier);
    const id = crud.addElement('comfy-node', {
      classType: definition.classType,
      category: definition.category,
      displayName: definition.displayName,
      widgetValues: this._getDefaultWidgetValues(definition),
      xywh: bound.serialize(),
    });

    if (id) {
      // Switch to default tool and select the new element
      this.gfx.tool.setTool(DefaultTool);
      const surface = this._surfaceComponent;
      if (surface) {
        const element = surface.model.getElementById(
          id
        ) as ComfyNodeElementModel;
        if (element) {
          this.gfx.selection.set({ elements: [id], editing: false });
        }
      }
    }
  }

  private _getDefaultWidgetValues(
    definition: ReturnType<typeof getNodeDefinition>
  ): Record<string, unknown> {
    if (!definition) return {};

    const values: Record<string, unknown> = {};
    const allInputs = {
      ...definition.inputs.required,
      ...(definition.inputs.optional ?? {}),
    };

    for (const [name, config] of Object.entries(allInputs)) {
      const type = config[0] as string;
      // Only set defaults for widget inputs (non-link types)
      if (
        type === 'INT' ||
        type === 'FLOAT' ||
        type === 'STRING' ||
        type === 'BOOLEAN' ||
        type === 'COMBO'
      ) {
        const opts = config[1] as Record<string, unknown> | undefined;
        if (opts && 'default' in opts) {
          values[name] = opts.default;
        } else if (type === 'COMBO' && opts && 'options' in opts) {
          const options = opts.options as string[];
          if (options.length > 0) {
            values[name] = options[0];
          }
        }
      }
    }

    return values;
  }
}
