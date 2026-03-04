import { Bound } from '@blocksuite/global/gfx';

import { COMFY_NODE_CONSTANTS } from '../model/types.js';
import { getNodeDefinition } from '../node-registry/registry.js';
import { computeAutoLayout, estimateNodeHeight } from './auto-layout.js';
import type {
  ComfyUIApiFormat,
  ComfyUIFrontendFormat,
} from './workflow-serializer.js';

export interface DeserializedNode {
  classType: string;
  category: string;
  displayName: string;
  widgetValues: Record<string, unknown>;
  xywh: string;
}

export interface DeserializedConnector {
  sourceNodeId: string;
  sourceOutputIndex: number;
  targetNodeId: string;
  targetInputName: string;
  ioType: string;
}

export interface DeserializedWorkflow {
  nodes: DeserializedNode[];
  connectors: DeserializedConnector[];
  /** Map from original ID → new element ID (set after creation). */
  idMap: Map<string, string>;
}

/**
 * Detect which format a JSON object is in.
 */
export function detectFormat(
  json: unknown
): 'api' | 'frontend' | 'unknown' {
  if (!json || typeof json !== 'object') return 'unknown';

  // Frontend format has a `nodes` array
  if ('nodes' in json && Array.isArray((json as Record<string, unknown>).nodes)) {
    return 'frontend';
  }

  // API format is a flat dict where each value has `class_type`
  const values = Object.values(json as Record<string, unknown>);
  if (
    values.length > 0 &&
    values.every(
      v =>
        typeof v === 'object' &&
        v !== null &&
        'class_type' in (v as Record<string, unknown>)
    )
  ) {
    return 'api';
  }

  return 'unknown';
}

/**
 * Deserialize from ComfyUI API format.
 * Nodes have no position — auto-layout is applied.
 */
export function deserializeApiFormat(
  data: ComfyUIApiFormat
): DeserializedWorkflow {
  const nodes: DeserializedNode[] = [];
  const connectors: DeserializedConnector[] = [];
  const idMap = new Map<string, string>();

  // First pass: collect nodes and connections
  const layoutNodes: Array<{
    id: string;
    inputs: string[];
    width: number;
    height: number;
  }> = [];

  for (const [nodeId, nodeData] of Object.entries(data)) {
    const definition = getNodeDefinition(nodeData.class_type);
    const category = definition?.category ?? 'uncategorized';
    const displayName =
      nodeData._meta?.title ?? definition?.displayName ?? nodeData.class_type;

    // Separate widget values from link references
    const widgetValues: Record<string, unknown> = {};
    const inputDeps: string[] = [];

    for (const [inputName, value] of Object.entries(nodeData.inputs)) {
      if (
        Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === 'string' &&
        typeof value[1] === 'number'
      ) {
        // This is a link: [sourceNodeId, outputIndex]
        connectors.push({
          sourceNodeId: value[0],
          sourceOutputIndex: value[1],
          targetNodeId: nodeId,
          targetInputName: inputName,
          ioType: definition
            ? (definition.inputs.required[inputName]?.[0] as string ??
                definition.inputs.optional?.[inputName]?.[0] as string ??
                '*')
            : '*',
        });
        inputDeps.push(value[0]);
      } else {
        widgetValues[inputName] = value;
      }
    }

    const inputCount = Object.keys(nodeData.inputs).length;
    const outputCount = definition?.outputs.length ?? 1;
    const height = estimateNodeHeight(inputCount, outputCount);

    layoutNodes.push({
      id: nodeId,
      inputs: inputDeps,
      width: COMFY_NODE_CONSTANTS.DEFAULT_WIDTH,
      height,
    });

    nodes.push({
      classType: nodeData.class_type,
      category,
      displayName,
      widgetValues,
      xywh: '', // Will be set by auto-layout
    });

    idMap.set(nodeId, nodeId);
  }

  // Apply auto-layout
  const positions = computeAutoLayout(layoutNodes);
  const nodeIds = Object.keys(data);

  for (let i = 0; i < nodeIds.length; i++) {
    const pos = positions.get(nodeIds[i]);
    const layoutNode = layoutNodes[i];
    if (pos) {
      const bound = new Bound(
        pos.x,
        pos.y,
        layoutNode.width,
        layoutNode.height
      );
      nodes[i].xywh = bound.serialize();
    } else {
      const bound = new Bound(
        0,
        i * 200,
        layoutNode.width,
        layoutNode.height
      );
      nodes[i].xywh = bound.serialize();
    }
  }

  return { nodes, connectors, idMap };
}

/**
 * Deserialize from ComfyUI frontend format (has positions).
 */
export function deserializeFrontendFormat(
  data: ComfyUIFrontendFormat
): DeserializedWorkflow {
  const nodes: DeserializedNode[] = [];
  const connectors: DeserializedConnector[] = [];
  const idMap = new Map<string, string>();

  // Map numeric IDs to string IDs
  const numericToStringId = new Map<number, string>();
  for (const node of data.nodes) {
    const stringId = String(node.id);
    numericToStringId.set(node.id, stringId);
    idMap.set(stringId, stringId);
  }

  // Build nodes
  for (const node of data.nodes) {
    const definition = getNodeDefinition(node.type);

    const [px, py] = node.pos;
    const [sw, sh] = node.size;
    const bound = new Bound(px, py, sw, sh);

    // Reconstruct widget values from widgets_values array
    const widgetValues: Record<string, unknown> = {};
    if (definition && node.widgets_values) {
      const allInputs = {
        ...definition.inputs.required,
        ...(definition.inputs.optional ?? {}),
      };
      let widgetIdx = 0;
      for (const [name, config] of Object.entries(allInputs)) {
        const type = config[0] as string;
        // Only widget types have values in widgets_values
        if (
          type === 'INT' ||
          type === 'FLOAT' ||
          type === 'STRING' ||
          type === 'BOOLEAN' ||
          type === 'COMBO'
        ) {
          if (widgetIdx < node.widgets_values.length) {
            widgetValues[name] = node.widgets_values[widgetIdx];
          }
          widgetIdx++;
        }
      }
    }

    nodes.push({
      classType: node.type,
      category: definition?.category ?? 'uncategorized',
      displayName: definition?.displayName ?? node.type,
      widgetValues,
      xywh: bound.serialize(),
    });
  }

  // Build connectors from links
  for (const link of data.links) {
    const [, sourceNumId, sourceOutputIndex, targetNumId, targetInputIndex, ioType] =
      link;
    const sourceId = numericToStringId.get(sourceNumId);
    const targetId = numericToStringId.get(targetNumId);
    if (!sourceId || !targetId) continue;

    // Find target input name
    const targetNode = data.nodes.find(n => n.id === targetNumId);
    const inputName =
      targetNode?.inputs?.[targetInputIndex]?.name ?? `input_${targetInputIndex}`;

    connectors.push({
      sourceNodeId: sourceId,
      sourceOutputIndex,
      targetNodeId: targetId,
      targetInputName: inputName,
      ioType,
    });
  }

  return { nodes, connectors, idMap };
}

/**
 * Import a ComfyUI workflow JSON (auto-detects format).
 */
export function deserializeWorkflow(json: unknown): DeserializedWorkflow {
  const format = detectFormat(json);

  switch (format) {
    case 'api':
      return deserializeApiFormat(json as ComfyUIApiFormat);
    case 'frontend':
      return deserializeFrontendFormat(json as ComfyUIFrontendFormat);
    default:
      throw new Error(
        'Unknown workflow format. Expected ComfyUI API format or frontend format.'
      );
  }
}
