import { Bound } from '@blocksuite/global/gfx';

import type { ComfyConnectorElementModel } from '../model/comfy-connector-element.js';
import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';

/**
 * ComfyUI API format — used for execution.
 * Node IDs map to { class_type, inputs }.
 * Linked inputs are encoded as [sourceNodeId, sourceOutputIndex].
 */
export interface ComfyUIApiFormat {
  [nodeId: string]: {
    class_type: string;
    inputs: Record<string, unknown>;
    _meta?: { title: string };
  };
}

/**
 * ComfyUI frontend format — includes position data for reimport.
 */
export interface ComfyUIFrontendFormat {
  last_node_id: number;
  last_link_id: number;
  nodes: Array<{
    id: number;
    type: string;
    pos: [number, number];
    size: [number, number];
    properties: Record<string, unknown>;
    widgets_values?: unknown[];
    inputs?: Array<{
      name: string;
      type: string;
      link: number | null;
    }>;
    outputs?: Array<{
      name: string;
      type: string;
      links: number[];
      slot_index?: number;
    }>;
  }>;
  links: Array<
    [
      number, // link_id
      number, // source_node_id
      number, // source_output_index
      number, // target_node_id
      number, // target_input_index
      string, // type
    ]
  >;
  groups: unknown[];
  config: Record<string, unknown>;
  extra: Record<string, unknown>;
  version: number;
}

/**
 * Serialize AFFiNE canvas elements to ComfyUI API format (for execution).
 */
export function serializeToApiFormat(
  nodes: ComfyNodeElementModel[],
  connectors: ComfyConnectorElementModel[]
): ComfyUIApiFormat {
  const result: ComfyUIApiFormat = {};

  // Build a map of connections: targetNodeId+inputName → [sourceNodeId, outputIndex]
  const connectionMap = new Map<string, [string, number]>();
  for (const conn of connectors) {
    const key = `${conn.targetNodeId}:${conn.targetInputName}`;
    connectionMap.set(key, [conn.sourceNodeId, conn.sourceOutputIndex]);
  }

  for (const node of nodes) {
    const inputs: Record<string, unknown> = {};

    // Copy widget values as base inputs
    for (const [key, value] of Object.entries(node.widgetValues)) {
      inputs[key] = value;
    }

    // Override with link references where connections exist
    for (const [key] of Object.entries(inputs)) {
      const connectionKey = `${node.id}:${key}`;
      const link = connectionMap.get(connectionKey);
      if (link) {
        inputs[key] = link; // [sourceNodeId, outputIndex]
      }
    }

    // Also check for inputs that are only links (no widget value)
    for (const conn of connectors) {
      if (conn.targetNodeId === node.id) {
        const link = connectionMap.get(
          `${conn.targetNodeId}:${conn.targetInputName}`
        );
        if (link) {
          inputs[conn.targetInputName] = link;
        }
      }
    }

    result[node.id] = {
      class_type: node.classType,
      inputs,
      _meta: { title: node.displayName || node.classType },
    };
  }

  return result;
}

/**
 * Serialize AFFiNE canvas elements to ComfyUI frontend format (with positions).
 */
export function serializeToFrontendFormat(
  nodes: ComfyNodeElementModel[],
  connectors: ComfyConnectorElementModel[]
): ComfyUIFrontendFormat {
  // Create numeric ID mapping (ComfyUI frontend uses numeric IDs)
  const idToNumeric = new Map<string, number>();
  let nextId = 1;
  for (const node of nodes) {
    idToNumeric.set(node.id, nextId++);
  }

  // Build links
  const links: ComfyUIFrontendFormat['links'] = [];
  let linkId = 1;
  const linkMap = new Map<string, number>(); // connectorId → linkId

  for (const conn of connectors) {
    const sourceNumId = idToNumeric.get(conn.sourceNodeId);
    const targetNumId = idToNumeric.get(conn.targetNodeId);
    if (sourceNumId === undefined || targetNumId === undefined) continue;

    // Find target input index
    const targetNode = nodes.find(n => n.id === conn.targetNodeId);
    if (!targetNode) continue;

    const currentLinkId = linkId++;
    linkMap.set(conn.id, currentLinkId);
    // target input index is determined by order — simplified to 0 for now
    links.push([
      currentLinkId,
      sourceNumId,
      conn.sourceOutputIndex,
      targetNumId,
      0, // target_input_index (simplified)
      conn.ioType,
    ]);
  }

  // Build nodes
  const frontendNodes = nodes.map(node => {
    const numId = idToNumeric.get(node.id)!;
    const bound = Bound.deserialize(node.xywh);

    // Build widget values as array
    const widgetValues = Object.values(node.widgetValues);

    return {
      id: numId,
      type: node.classType,
      pos: [bound.x, bound.y] as [number, number],
      size: [bound.w, bound.h] as [number, number],
      properties: { 'Node name for S&R': node.classType },
      widgets_values: widgetValues,
    };
  });

  return {
    last_node_id: nextId - 1,
    last_link_id: linkId - 1,
    nodes: frontendNodes,
    links,
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
  };
}
