import { COMFY_NODE_CONSTANTS } from '../model/types.js';

interface LayoutNode {
  id: string;
  inputs: string[]; // IDs of nodes this node depends on
  layer?: number;
  x?: number;
  y?: number;
  width: number;
  height: number;
}

/**
 * Compute DAG layout for nodes that have no position data (API format imports).
 * Uses a topological sort → layer assignment → vertical spacing approach.
 */
export function computeAutoLayout(
  nodes: LayoutNode[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeMap = new Map<string, LayoutNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Build adjacency: forward edges (dependency → dependent)
  const dependents = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    dependents.set(node.id, new Set());
    inDegree.set(node.id, 0);
  }

  for (const node of nodes) {
    for (const dep of node.inputs) {
      if (dependents.has(dep)) {
        dependents.get(dep)!.add(node.id);
      }
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  // Topological sort (Kahn's algorithm) to assign layers
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const layers = new Map<string, number>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    const layer = layers.get(id) ?? 0;

    for (const depId of dependents.get(id) ?? []) {
      const newDeg = (inDegree.get(depId) ?? 1) - 1;
      inDegree.set(depId, newDeg);
      layers.set(depId, Math.max(layers.get(depId) ?? 0, layer + 1));
      if (newDeg === 0) queue.push(depId);
    }
  }

  // Handle cycles: assign remaining nodes to layer 0
  for (const node of nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0);
    }
  }

  // Group by layer
  const layerGroups = new Map<number, string[]>();
  for (const [id, layer] of layers) {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(id);
  }

  // Position nodes
  const H_GAP = 80;
  const V_GAP = 40;
  let currentX = 0;

  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);
  for (const layerIndex of sortedLayers) {
    const layerNodeIds = layerGroups.get(layerIndex)!;
    let currentY = 0;
    let maxWidth = 0;

    for (const id of layerNodeIds) {
      const node = nodeMap.get(id)!;
      positions.set(id, { x: currentX, y: currentY });
      currentY += node.height + V_GAP;
      maxWidth = Math.max(maxWidth, node.width);
    }

    currentX += maxWidth + H_GAP;
  }

  return positions;
}

/**
 * Estimate node height from port count.
 */
export function estimateNodeHeight(
  inputCount: number,
  outputCount: number
): number {
  const maxPorts = Math.max(inputCount, outputCount, 1);
  return (
    COMFY_NODE_CONSTANTS.TITLE_HEIGHT +
    COMFY_NODE_CONSTANTS.PORT_ROW_HEIGHT * maxPorts +
    COMFY_NODE_CONSTANTS.BOTTOM_PADDING
  );
}
