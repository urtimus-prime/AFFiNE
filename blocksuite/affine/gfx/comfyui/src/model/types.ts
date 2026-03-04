/**
 * ComfyUI I/O type enum — matches ComfyUI's type system for port connections.
 */
export enum ComfyIOType {
  IMAGE = 'IMAGE',
  MODEL = 'MODEL',
  VAE = 'VAE',
  CLIP = 'CLIP',
  CONDITIONING = 'CONDITIONING',
  LATENT = 'LATENT',
  MASK = 'MASK',
  CONTROL_NET = 'CONTROL_NET',
  STYLE_MODEL = 'STYLE_MODEL',
  GLIGEN = 'GLIGEN',
  UPSCALE_MODEL = 'UPSCALE_MODEL',
  SAMPLER = 'SAMPLER',
  SIGMAS = 'SIGMAS',
  NOISE = 'NOISE',
  GUIDER = 'GUIDER',
  INT = 'INT',
  FLOAT = 'FLOAT',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  COMBO = 'COMBO',
  /** Wildcard type — accepts any connection. */
  WILDCARD = '*',
}

/**
 * Color map for port/connector rendering per I/O type.
 * Matches ComfyUI's default color scheme.
 */
export const COMFY_IO_COLORS: Record<string, string> = {
  [ComfyIOType.IMAGE]: '#64b5f6',
  [ComfyIOType.MODEL]: '#b39ddb',
  [ComfyIOType.VAE]: '#ef5350',
  [ComfyIOType.CLIP]: '#ffd54f',
  [ComfyIOType.CONDITIONING]: '#ffa726',
  [ComfyIOType.LATENT]: '#ff63c7',
  [ComfyIOType.MASK]: '#81c784',
  [ComfyIOType.CONTROL_NET]: '#4fc3f7',
  [ComfyIOType.STYLE_MODEL]: '#ce93d8',
  [ComfyIOType.GLIGEN]: '#a1887f',
  [ComfyIOType.UPSCALE_MODEL]: '#90a4ae',
  [ComfyIOType.SAMPLER]: '#7e57c2',
  [ComfyIOType.SIGMAS]: '#26a69a',
  [ComfyIOType.NOISE]: '#78909c',
  [ComfyIOType.GUIDER]: '#5c6bc0',
  [ComfyIOType.INT]: '#29b6f6',
  [ComfyIOType.FLOAT]: '#26c6da',
  [ComfyIOType.STRING]: '#66bb6a',
  [ComfyIOType.BOOLEAN]: '#9ccc65',
  [ComfyIOType.COMBO]: '#42a5f5',
  [ComfyIOType.WILDCARD]: '#aaaaaa',
};

/** Default fallback color for unknown I/O types. */
export const COMFY_IO_DEFAULT_COLOR = '#aaaaaa';

/**
 * Port definition — describes an input or output on a ComfyUI node.
 */
export interface ComfyPortDef {
  name: string;
  type: string;
  /** For inputs only: whether this input is a link-only input (no widget). */
  isLink?: boolean;
}

/**
 * Widget definition — describes a parameter control on a ComfyUI node.
 */
export interface ComfyWidgetDef {
  name: string;
  type: 'INT' | 'FLOAT' | 'STRING' | 'BOOLEAN' | 'COMBO' | string;
  /** Default value. */
  default?: unknown;
  /** Min value (for INT/FLOAT). */
  min?: number;
  /** Max value (for INT/FLOAT). */
  max?: number;
  /** Step (for INT/FLOAT). */
  step?: number;
  /** Options (for COMBO). */
  options?: string[];
  /** Whether the widget is multiline (for STRING). */
  multiline?: boolean;
}

/**
 * Full node definition from ComfyUI's object_info API.
 */
export interface ComfyNodeDefinition {
  classType: string;
  category: string;
  displayName: string;
  description?: string;
  inputs: {
    required: Record<string, [string, ...unknown[]]>;
    optional?: Record<string, [string, ...unknown[]]>;
  };
  outputs: Array<{ name: string; type: string }>;
  outputNames?: string[];
}

/** Execution state for a node (local-only, not synced). */
export type ComfyExecutionState = 'idle' | 'executing' | 'done' | 'error';

/** Layout constants for ComfyUI nodes. */
export const COMFY_NODE_CONSTANTS = {
  /** Minimum node width. */
  MIN_WIDTH: 200,
  /** Default node width. */
  DEFAULT_WIDTH: 280,
  /** Title bar height. */
  TITLE_HEIGHT: 30,
  /** Port row height. */
  PORT_ROW_HEIGHT: 24,
  /** Port circle radius. */
  PORT_RADIUS: 5,
  /** Horizontal padding. */
  H_PADDING: 12,
  /** Vertical padding below ports. */
  BOTTOM_PADDING: 8,
  /** Border radius. */
  BORDER_RADIUS: 8,
};

/**
 * Get the color for a given I/O type.
 */
export function getIOColor(ioType: string): string {
  return COMFY_IO_COLORS[ioType] ?? COMFY_IO_DEFAULT_COLOR;
}
