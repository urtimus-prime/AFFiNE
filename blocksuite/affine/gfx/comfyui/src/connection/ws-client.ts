/**
 * WebSocket event types from ComfyUI.
 */
export interface ComfyWSExecutionStart {
  type: 'execution_start';
  data: { prompt_id: string };
}

export interface ComfyWSExecuting {
  type: 'executing';
  data: { node: string | null; prompt_id: string };
}

export interface ComfyWSProgress {
  type: 'progress';
  data: { value: number; max: number; prompt_id: string; node: string };
}

export interface ComfyWSExecuted {
  type: 'executed';
  data: {
    node: string;
    output: Record<string, unknown>;
    prompt_id: string;
  };
}

export interface ComfyWSExecutionCached {
  type: 'execution_cached';
  data: { nodes: string[]; prompt_id: string };
}

export interface ComfyWSExecutionError {
  type: 'execution_error';
  data: {
    prompt_id: string;
    node_id: string;
    node_type: string;
    exception_message: string;
    exception_type: string;
    traceback: string[];
  };
}

export type ComfyWSMessage =
  | ComfyWSExecutionStart
  | ComfyWSExecuting
  | ComfyWSProgress
  | ComfyWSExecuted
  | ComfyWSExecutionCached
  | ComfyWSExecutionError;

export type ComfyWSMessageHandler = (message: ComfyWSMessage) => void;
export type ComfyWSBinaryHandler = (data: ArrayBuffer) => void;

/**
 * WebSocket client for ComfyUI with automatic reconnection.
 */
export class ComfyUIWebSocketClient {
  private _ws: WebSocket | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _messageHandlers: ComfyWSMessageHandler[] = [];
  private _binaryHandlers: ComfyWSBinaryHandler[] = [];
  private _connected = false;
  private _reconnectAttempts = 0;
  private readonly _maxReconnectAttempts = 10;
  private readonly _reconnectDelay = 2000;

  readonly clientId: string;

  constructor(
    private readonly _baseUrl: string,
    clientId?: string
  ) {
    this.clientId = clientId ?? crypto.randomUUID();
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(): void {
    if (this._ws) return;

    const wsUrl = this._baseUrl
      .replace(/^http/, 'ws')
      .replace(/\/$/, '');
    const url = `${wsUrl}/ws?clientId=${this.clientId}`;

    try {
      this._ws = new WebSocket(url);
      this._ws.binaryType = 'arraybuffer';

      this._ws.onopen = () => {
        this._connected = true;
        this._reconnectAttempts = 0;
      };

      this._ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          for (const handler of this._binaryHandlers) {
            handler(event.data);
          }
          return;
        }

        try {
          const message = JSON.parse(event.data as string) as ComfyWSMessage;
          for (const handler of this._messageHandlers) {
            handler(message);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      this._ws.onclose = () => {
        this._connected = false;
        this._ws = null;
        this._scheduleReconnect();
      };

      this._ws.onerror = () => {
        // Error handling — onclose will fire after this
      };
    } catch {
      this._scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempts = this._maxReconnectAttempts; // Prevent reconnection
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._connected = false;
  }

  onMessage(handler: ComfyWSMessageHandler): () => void {
    this._messageHandlers.push(handler);
    return () => {
      const idx = this._messageHandlers.indexOf(handler);
      if (idx !== -1) this._messageHandlers.splice(idx, 1);
    };
  }

  onBinary(handler: ComfyWSBinaryHandler): () => void {
    this._binaryHandlers.push(handler);
    return () => {
      const idx = this._binaryHandlers.indexOf(handler);
      if (idx !== -1) this._binaryHandlers.splice(idx, 1);
    };
  }

  private _scheduleReconnect(): void {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) return;

    this._reconnectAttempts++;
    const delay = this._reconnectDelay * Math.min(this._reconnectAttempts, 5);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
