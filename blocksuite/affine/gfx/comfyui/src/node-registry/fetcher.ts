import type { ComfyNodeDefinition } from './registry.js';

/**
 * Parse ComfyUI's /object_info response into our internal definition format.
 */
function parseObjectInfo(
  data: Record<string, unknown>
): ComfyNodeDefinition[] {
  const defs: ComfyNodeDefinition[] = [];

  for (const [classType, info] of Object.entries(data)) {
    const nodeInfo = info as Record<string, unknown>;
    const input = nodeInfo['input'] as Record<string, unknown> | undefined;
    const outputNames = (nodeInfo['output_name'] as string[]) ?? [];
    const outputTypes = (nodeInfo['output'] as string[]) ?? [];

    const required: Record<string, [string, ...unknown[]]> = {};
    const optional: Record<string, [string, ...unknown[]]> = {};

    if (input) {
      const req = input['required'] as Record<string, unknown[]> | undefined;
      if (req) {
        for (const [name, config] of Object.entries(req)) {
          required[name] = config as [string, ...unknown[]];
        }
      }
      const opt = input['optional'] as Record<string, unknown[]> | undefined;
      if (opt) {
        for (const [name, config] of Object.entries(opt)) {
          optional[name] = config as [string, ...unknown[]];
        }
      }
    }

    const outputs = outputTypes.map((type, i) => ({
      name: outputNames[i] || type,
      type,
    }));

    defs.push({
      classType,
      category: (nodeInfo['category'] as string) ?? 'uncategorized',
      displayName:
        (nodeInfo['display_name'] as string) ?? classType,
      description: (nodeInfo['description'] as string) ?? undefined,
      inputs: { required, optional },
      outputs,
    });
  }

  return defs;
}

/**
 * Fetch node definitions from a running ComfyUI instance.
 */
export async function fetchNodeDefinitions(
  baseUrl: string
): Promise<ComfyNodeDefinition[]> {
  const url = `${baseUrl}/object_info`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ComfyUI node definitions: ${response.status} ${response.statusText}`
    );
  }
  const data = (await response.json()) as Record<string, unknown>;
  return parseObjectInfo(data);
}
