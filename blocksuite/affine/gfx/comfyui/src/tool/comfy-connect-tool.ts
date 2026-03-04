import {
  EdgelessCRUDIdentifier,
  type SurfaceBlockComponent,
} from '@blocksuite/affine-block-surface';
import { Bound } from '@blocksuite/global/gfx';
import type { PointerEventState } from '@blocksuite/std';
import { BaseTool } from '@blocksuite/std/gfx';

import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';
import { COMFY_NODE_CONSTANTS } from '../model/types.js';
import { getNodeDefinition } from '../node-registry/registry.js';

interface PortHit {
  nodeId: string;
  node: ComfyNodeElementModel;
  side: 'output' | 'input';
  index: number;
  name: string;
  type: string;
  x: number;
  y: number;
}

/**
 * Tool for drawing typed connections between ComfyUI node ports.
 * Drag from an output port to an input port to create a connection.
 */
export class ComfyConnectTool extends BaseTool {
  static override toolName = 'comfy-connect';

  private _sourcePort: PortHit | null = null;
  private _isDragging = false;

  private get _surfaceComponent() {
    return this.gfx.surfaceComponent as SurfaceBlockComponent | null;
  }

  override dragStart(e: PointerEventState): void {
    const [mx, my] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const hit = this._findPortAt(mx, my);

    if (hit && hit.side === 'output') {
      this._sourcePort = hit;
      this._isDragging = true;
    }
  }

  override dragMove(_e: PointerEventState): void {
    if (!this._isDragging) return;
  }

  override dragEnd(e: PointerEventState): void {
    if (!this._isDragging || !this._sourcePort) {
      this._reset();
      return;
    }

    const [mx, my] = this.gfx.viewport.toModelCoord(e.x, e.y);
    const targetPort = this._findPortAt(mx, my);

    if (
      targetPort &&
      targetPort.side === 'input' &&
      targetPort.nodeId !== this._sourcePort.nodeId
    ) {
      // Validate type compatibility
      if (this._isCompatible(this._sourcePort.type, targetPort.type)) {
        this._createConnection(this._sourcePort, targetPort);
      }
    }

    this._reset();
  }

  private _reset(): void {
    this._sourcePort = null;
    this._isDragging = false;
  }

  private _isCompatible(outputType: string, inputType: string): boolean {
    if (outputType === '*' || inputType === '*') return true;
    return outputType === inputType;
  }

  private _createConnection(source: PortHit, target: PortHit): void {
    const crud = this.std.get(EdgelessCRUDIdentifier);

    // Compute bounding box from source/target positions
    const minX = Math.min(source.x, target.x);
    const minY = Math.min(source.y, target.y);
    const maxX = Math.max(source.x, target.x);
    const maxY = Math.max(source.y, target.y);
    const bound = new Bound(minX, minY, maxX - minX, maxY - minY);

    crud.addElement('comfy-connector', {
      sourceNodeId: source.nodeId,
      sourceOutputIndex: source.index,
      targetNodeId: target.nodeId,
      targetInputName: target.name,
      ioType: source.type,
      xywh: bound.serialize(),
    });
  }

  private _findPortAt(x: number, y: number): PortHit | null {
    const surface = this._surfaceComponent;
    if (!surface) return null;

    const hitRadius = COMFY_NODE_CONSTANTS.PORT_RADIUS * 2;

    // Iterate all comfy-node elements
    for (const element of surface.model.elementModels) {
      if (element.type !== 'comfy-node') continue;

      const node = element as ComfyNodeElementModel;
      const definition = getNodeDefinition(node.classType);
      if (!definition) continue;

      // Check output ports
      const outputPositions = node.computeOutputPortPositions(definition);
      for (let i = 0; i < outputPositions.length; i++) {
        const port = outputPositions[i];
        if (Math.hypot(port.x - x, port.y - y) < hitRadius) {
          return {
            nodeId: node.id,
            node,
            side: 'output',
            index: i,
            name: port.name,
            type: port.type,
            x: port.x,
            y: port.y,
          };
        }
      }

      // Check input ports
      const inputPositions = node.computeInputPortPositions(definition);
      for (let i = 0; i < inputPositions.length; i++) {
        const port = inputPositions[i];
        if (Math.hypot(port.x - x, port.y - y) < hitRadius) {
          return {
            nodeId: node.id,
            node,
            side: 'input',
            index: i,
            name: port.name,
            type: port.type,
            x: port.x,
            y: port.y,
          };
        }
      }
    }

    return null;
  }
}
