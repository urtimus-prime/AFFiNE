import type { ComfyUIApiFormat } from '../serialization/workflow-serializer.js';

export interface QueuePromptResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, unknown>;
}

export interface ComfyUISystemStats {
  system: {
    os: string;
    python_version: string;
    embedded_python: boolean;
  };
  devices: Array<{
    name: string;
    type: string;
    index: number;
    vram_total: number;
    vram_free: number;
  }>;
}

/**
 * REST API client for ComfyUI backend.
 */
export class ComfyUIRestClient {
  constructor(private readonly _baseUrl: string) {}

  get baseUrl(): string {
    return this._baseUrl;
  }

  /**
   * Queue a prompt for execution.
   */
  async queuePrompt(
    workflow: ComfyUIApiFormat,
    clientId?: string
  ): Promise<QueuePromptResponse> {
    const body: Record<string, unknown> = { prompt: workflow };
    if (clientId) body.client_id = clientId;

    const response = await fetch(`${this._baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to queue prompt: ${response.status} — ${text}`);
    }

    return response.json() as Promise<QueuePromptResponse>;
  }

  /**
   * Get current queue status.
   */
  async getQueue(): Promise<{
    queue_running: unknown[];
    queue_pending: unknown[];
  }> {
    const response = await fetch(`${this._baseUrl}/queue`);
    if (!response.ok) throw new Error(`Failed to get queue: ${response.status}`);
    return response.json() as Promise<{
      queue_running: unknown[];
      queue_pending: unknown[];
    }>;
  }

  /**
   * Get execution history for a prompt.
   */
  async getHistory(
    promptId?: string
  ): Promise<Record<string, unknown>> {
    const url = promptId
      ? `${this._baseUrl}/history/${promptId}`
      : `${this._baseUrl}/history`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to get history: ${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Get system stats (GPU info, etc.).
   */
  async getSystemStats(): Promise<ComfyUISystemStats> {
    const response = await fetch(`${this._baseUrl}/system_stats`);
    if (!response.ok)
      throw new Error(`Failed to get system stats: ${response.status}`);
    return response.json() as Promise<ComfyUISystemStats>;
  }

  /**
   * Get object info (all node definitions).
   */
  async getObjectInfo(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this._baseUrl}/object_info`);
    if (!response.ok)
      throw new Error(`Failed to get object info: ${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Interrupt current execution.
   */
  async interrupt(): Promise<void> {
    await fetch(`${this._baseUrl}/interrupt`, { method: 'POST' });
  }

  /**
   * Get a generated image by filename.
   */
  getImageUrl(filename: string, subfolder = '', type = 'output'): string {
    const params = new URLSearchParams({ filename, subfolder, type });
    return `${this._baseUrl}/view?${params.toString()}`;
  }
}
