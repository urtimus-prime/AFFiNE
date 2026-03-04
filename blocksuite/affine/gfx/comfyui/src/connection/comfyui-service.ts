import type { ComfyConnectorElementModel } from '../model/comfy-connector-element.js';
import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';
import { fetchNodeDefinitions } from '../node-registry/fetcher.js';
import { nodeRegistry } from '../node-registry/registry.js';
import {
  serializeToApiFormat,
  type ComfyUIApiFormat,
} from '../serialization/workflow-serializer.js';
import { ComfyUIRestClient } from './rest-client.js';
import { ComfyUIWebSocketClient, type ComfyWSMessage } from './ws-client.js';

export interface ComfyUIServiceConfig {
  baseUrl: string;
}

/**
 * High-level service managing ComfyUI backend connection.
 * Coordinates REST + WebSocket clients, execution tracking, and node definition sync.
 */
export class ComfyUIService {
  private _rest: ComfyUIRestClient | null = null;
  private _ws: ComfyUIWebSocketClient | null = null;
  private _config: ComfyUIServiceConfig | null = null;
  private _disposeWsHandler: (() => void) | null = null;
  private _disposeWsBinaryHandler: (() => void) | null = null;

  /** Currently tracked prompt ID. */
  private _activePromptId: string | null = null;

  /** Last node that received an 'executing' event (for binary preview routing). */
  private _lastExecutingNodeId: string | null = null;

  /** Callbacks for execution state updates. */
  private _onNodeExecuting: ((nodeId: string) => void) | null = null;
  private _onNodeProgress:
    | ((nodeId: string, value: number, max: number) => void)
    | null = null;
  private _onNodeExecuted:
    | ((nodeId: string, output: Record<string, unknown>) => void)
    | null = null;
  private _onNodeError: ((nodeId: string, message: string) => void) | null =
    null;
  private _onPreviewImage: ((nodeId: string, imageUrl: string) => void) | null =
    null;

  get connected(): boolean {
    return this._ws?.connected ?? false;
  }

  get baseUrl(): string | null {
    return this._config?.baseUrl ?? null;
  }

  /**
   * Connect to a ComfyUI backend.
   */
  async connect(config: ComfyUIServiceConfig): Promise<void> {
    this.disconnect();

    this._config = config;
    this._rest = new ComfyUIRestClient(config.baseUrl);
    this._ws = new ComfyUIWebSocketClient(config.baseUrl);

    // Set up WebSocket message handling
    this._disposeWsHandler = this._ws.onMessage((msg: ComfyWSMessage) => {
      this._handleWSMessage(msg);
    });

    this._disposeWsBinaryHandler = this._ws.onBinary((data: ArrayBuffer) => {
      this._handleWSBinary(data);
    });

    this._ws.connect();

    // Fetch live node definitions
    try {
      const defs = await fetchNodeDefinitions(config.baseUrl);
      nodeRegistry.mergeDefinitions(defs);
    } catch (e) {
      console.warn('Failed to fetch live node definitions:', e);
    }
  }

  /**
   * Disconnect from the backend.
   */
  disconnect(): void {
    this._disposeWsHandler?.();
    this._disposeWsBinaryHandler?.();
    this._ws?.disconnect();
    this._ws = null;
    this._rest = null;
    this._config = null;
    this._activePromptId = null;
  }

  /**
   * Execute a workflow from canvas elements.
   */
  async executeWorkflow(
    nodes: ComfyNodeElementModel[],
    connectors: ComfyConnectorElementModel[]
  ): Promise<string> {
    if (!this._rest || !this._ws) {
      throw new Error('Not connected to ComfyUI backend');
    }

    const workflow = serializeToApiFormat(nodes, connectors);
    return this.executeApiWorkflow(workflow);
  }

  /**
   * Execute a pre-serialized API format workflow.
   */
  async executeApiWorkflow(workflow: ComfyUIApiFormat): Promise<string> {
    if (!this._rest || !this._ws) {
      throw new Error('Not connected to ComfyUI backend');
    }

    const response = await this._rest.queuePrompt(
      workflow,
      this._ws.clientId
    );
    this._activePromptId = response.prompt_id;
    return response.prompt_id;
  }

  /**
   * Interrupt current execution.
   */
  async interrupt(): Promise<void> {
    await this._rest?.interrupt();
  }

  /**
   * Set execution event handlers.
   */
  setExecutionHandlers(handlers: {
    onNodeExecuting?: (nodeId: string) => void;
    onNodeProgress?: (
      nodeId: string,
      value: number,
      max: number
    ) => void;
    onNodeExecuted?: (
      nodeId: string,
      output: Record<string, unknown>
    ) => void;
    onNodeError?: (nodeId: string, message: string) => void;
    onPreviewImage?: (nodeId: string, imageUrl: string) => void;
  }): void {
    this._onNodeExecuting = handlers.onNodeExecuting ?? null;
    this._onNodeProgress = handlers.onNodeProgress ?? null;
    this._onNodeExecuted = handlers.onNodeExecuted ?? null;
    this._onNodeError = handlers.onNodeError ?? null;
    this._onPreviewImage = handlers.onPreviewImage ?? null;
  }

  /**
   * Get image URL for a generated output.
   */
  getImageUrl(filename: string, subfolder = '', type = 'output'): string {
    if (!this._rest) return '';
    return this._rest.getImageUrl(filename, subfolder, type);
  }

  private _handleWSMessage(msg: ComfyWSMessage): void {
    if (
      'prompt_id' in msg.data &&
      msg.data.prompt_id !== this._activePromptId
    ) {
      return; // Ignore messages for other prompts
    }

    switch (msg.type) {
      case 'executing': {
        if (msg.data.node === null) {
          // Execution complete
          this._activePromptId = null;
          this._lastExecutingNodeId = null;
        } else {
          this._lastExecutingNodeId = msg.data.node;
          this._onNodeExecuting?.(msg.data.node);
        }
        break;
      }
      case 'progress': {
        this._onNodeProgress?.(
          msg.data.node,
          msg.data.value,
          msg.data.max
        );
        break;
      }
      case 'executed': {
        this._onNodeExecuted?.(msg.data.node, msg.data.output);

        // Check for image outputs
        const images = msg.data.output['images'] as
          | Array<{ filename: string; subfolder: string; type: string }>
          | undefined;
        if (images && images.length > 0 && this._rest) {
          const img = images[0];
          const url = this._rest.getImageUrl(
            img.filename,
            img.subfolder,
            img.type
          );
          this._onPreviewImage?.(msg.data.node, url);
        }
        break;
      }
      case 'execution_error': {
        this._onNodeError?.(
          msg.data.node_id,
          msg.data.exception_message
        );
        break;
      }
    }
  }

  private _handleWSBinary(data: ArrayBuffer): void {
    // ComfyUI sends binary preview images as:
    // [4 bytes: event type][4 bytes: image format][...image data]
    // event type 1 = preview image, format 1 = JPEG, 2 = PNG
    if (data.byteLength < 8) return;

    const view = new DataView(data);
    const eventType = view.getUint32(0);
    if (eventType !== 1) return; // Only handle preview images

    // Create a blob URL for the preview image and dispatch it
    // to the currently executing node
    if (this._activePromptId && this._lastExecutingNodeId) {
      const imageData = data.slice(8);
      const blob = new Blob([imageData], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      this._onPreviewImage?.(this._lastExecutingNodeId, url);
    }
  }
}

/** Singleton service instance. */
export const comfyUIService = new ComfyUIService();
