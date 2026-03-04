import { Bound } from '@blocksuite/global/gfx';
import {
  Boxed,
  nanoid,
  native2Y,
  Text,
  type Workspace,
} from '@blocksuite/affine/store';
import {
  COMFY_NODE_CONSTANTS,
  comfyUIService,
  deserializeWorkflow,
  serializeToApiFormat,
} from '@blocksuite/affine-gfx-comfyui';
import type * as Y from 'yjs';

import type { InitFn } from './utils.js';

// ---- Txt2Img workflow definition ----

interface NodeDef {
  id: string;
  classType: string;
  category: string;
  displayName: string;
  widgetValues: Record<string, unknown>;
  inputCount: number;
  outputCount: number;
}

interface ConnDef {
  sourceNodeId: string;
  sourceOutputIndex: number;
  targetNodeId: string;
  targetInputName: string;
  ioType: string;
}

function estimateHeight(inputCount: number, outputCount: number): number {
  const maxPorts = Math.max(inputCount, outputCount, 1);
  return (
    COMFY_NODE_CONSTANTS.TITLE_HEIGHT +
    COMFY_NODE_CONSTANTS.PORT_ROW_HEIGHT * maxPorts +
    COMFY_NODE_CONSTANTS.BOTTOM_PADDING
  );
}

function buildTxt2ImgWorkflow(): {
  elements: Record<string, unknown>;
} {
  const W = COMFY_NODE_CONSTANTS.DEFAULT_WIDTH;

  // Node IDs
  const ckptId = nanoid();
  const clipPosId = nanoid();
  const clipNegId = nanoid();
  const emptyLatentId = nanoid();
  const ksamplerId = nanoid();
  const vaeDecodeId = nanoid();
  const saveImageId = nanoid();

  const nodes: NodeDef[] = [
    {
      id: ckptId,
      classType: 'CheckpointLoaderSimple',
      category: 'loaders',
      displayName: 'Load Checkpoint',
      widgetValues: { ckpt_name: 'v1-5-pruned-emaonly.safetensors' },
      inputCount: 1,
      outputCount: 3,
    },
    {
      id: clipPosId,
      classType: 'CLIPTextEncode',
      category: 'conditioning',
      displayName: 'CLIP Text Encode (Positive)',
      widgetValues: {
        text: 'beautiful scenery nature glass bottle landscape, purple galaxy bottle,',
      },
      inputCount: 2,
      outputCount: 1,
    },
    {
      id: clipNegId,
      classType: 'CLIPTextEncode',
      category: 'conditioning',
      displayName: 'CLIP Text Encode (Negative)',
      widgetValues: { text: 'text, watermark' },
      inputCount: 2,
      outputCount: 1,
    },
    {
      id: emptyLatentId,
      classType: 'EmptyLatentImage',
      category: 'latent',
      displayName: 'Empty Latent Image',
      widgetValues: { width: 512, height: 512, batch_size: 1 },
      inputCount: 3,
      outputCount: 1,
    },
    {
      id: ksamplerId,
      classType: 'KSampler',
      category: 'sampling',
      displayName: 'KSampler',
      widgetValues: {
        seed: 8566257,
        steps: 20,
        cfg: 8.0,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
      },
      inputCount: 7,
      outputCount: 1,
    },
    {
      id: vaeDecodeId,
      classType: 'VAEDecode',
      category: 'latent',
      displayName: 'VAE Decode',
      widgetValues: {},
      inputCount: 2,
      outputCount: 1,
    },
    {
      id: saveImageId,
      classType: 'SaveImage',
      category: 'image',
      displayName: 'Save Image',
      widgetValues: { filename_prefix: 'ComfyUI' },
      inputCount: 1,
      outputCount: 0,
    },
  ];

  const connectors: ConnDef[] = [
    // Checkpoint → CLIP positive (MODEL output 0 → KSampler model, CLIP output 1 → both CLIPs)
    {
      sourceNodeId: ckptId,
      sourceOutputIndex: 1, // CLIP
      targetNodeId: clipPosId,
      targetInputName: 'clip',
      ioType: 'CLIP',
    },
    {
      sourceNodeId: ckptId,
      sourceOutputIndex: 1, // CLIP
      targetNodeId: clipNegId,
      targetInputName: 'clip',
      ioType: 'CLIP',
    },
    {
      sourceNodeId: ckptId,
      sourceOutputIndex: 0, // MODEL
      targetNodeId: ksamplerId,
      targetInputName: 'model',
      ioType: 'MODEL',
    },
    // CLIP positive → KSampler positive
    {
      sourceNodeId: clipPosId,
      sourceOutputIndex: 0,
      targetNodeId: ksamplerId,
      targetInputName: 'positive',
      ioType: 'CONDITIONING',
    },
    // CLIP negative → KSampler negative
    {
      sourceNodeId: clipNegId,
      sourceOutputIndex: 0,
      targetNodeId: ksamplerId,
      targetInputName: 'negative',
      ioType: 'CONDITIONING',
    },
    // EmptyLatentImage → KSampler latent_image
    {
      sourceNodeId: emptyLatentId,
      sourceOutputIndex: 0,
      targetNodeId: ksamplerId,
      targetInputName: 'latent_image',
      ioType: 'LATENT',
    },
    // KSampler → VAEDecode samples
    {
      sourceNodeId: ksamplerId,
      sourceOutputIndex: 0,
      targetNodeId: vaeDecodeId,
      targetInputName: 'samples',
      ioType: 'LATENT',
    },
    // Checkpoint VAE → VAEDecode vae
    {
      sourceNodeId: ckptId,
      sourceOutputIndex: 2, // VAE
      targetNodeId: vaeDecodeId,
      targetInputName: 'vae',
      ioType: 'VAE',
    },
    // VAEDecode → SaveImage images
    {
      sourceNodeId: vaeDecodeId,
      sourceOutputIndex: 0,
      targetNodeId: saveImageId,
      targetInputName: 'images',
      ioType: 'IMAGE',
    },
  ];

  // Auto-layout: build DAG layers
  // Layer 0: CheckpointLoaderSimple, EmptyLatentImage
  // Layer 1: CLIPTextEncode (pos), CLIPTextEncode (neg)
  // Layer 2: KSampler
  // Layer 3: VAEDecode
  // Layer 4: SaveImage

  // Compute layout using simple layer assignment
  const layers: NodeDef[][] = [
    [nodes[0], nodes[3]], // ckpt, emptyLatent
    [nodes[1], nodes[2]], // clip pos, clip neg
    [nodes[4]],           // ksampler
    [nodes[5]],           // vaeDecode
    [nodes[6]],           // saveImage
  ];

  const H_GAP = 100;
  const V_GAP = 40;
  const positions = new Map<string, { x: number; y: number }>();
  let currentX = 0;

  for (const layer of layers) {
    let currentY = 0;
    let maxW = 0;
    for (const node of layer) {
      positions.set(node.id, { x: currentX, y: currentY });
      const h = estimateHeight(node.inputCount, node.outputCount);
      currentY += h + V_GAP;
      maxW = Math.max(maxW, W);
    }
    currentX += maxW + H_GAP;
  }

  // Build surface elements
  const elements: Record<string, unknown> = {};

  for (const node of nodes) {
    const pos = positions.get(node.id)!;
    const h = estimateHeight(node.inputCount, node.outputCount);
    const bound = new Bound(pos.x, pos.y, W, h);

    elements[node.id] = native2Y(
      {
        id: node.id,
        index: 'a0',
        type: 'comfy-node',
        xywh: bound.serialize(),
        rotate: 0,
        classType: node.classType,
        category: node.category,
        displayName: node.displayName,
        widgetValues: node.widgetValues,
      },
      { deep: false }
    );
  }

  // Build a map of node ID → { position, height, inputCount, outputCount } for connector bounds
  const nodeInfoMap = new Map<
    string,
    { x: number; y: number; w: number; h: number; inputNames: string[] }
  >();
  for (const node of nodes) {
    const pos = positions.get(node.id)!;
    const h = estimateHeight(node.inputCount, node.outputCount);
    // Build input name list in order (matching bundled definitions)
    const inputNames: string[] = [];
    // For simplicity, use the connector targetInputName to find index at render time
    nodeInfoMap.set(node.id, { x: pos.x, y: pos.y, w: W, h, inputNames });
  }

  for (const conn of connectors) {
    const connId = nanoid();

    // Compute connector bounding box from source/target port positions
    const sourceInfo = nodeInfoMap.get(conn.sourceNodeId);
    const targetInfo = nodeInfoMap.get(conn.targetNodeId);
    let connXywh = '[0,0,0,0]';
    if (sourceInfo && targetInfo) {
      const { TITLE_HEIGHT: TH, PORT_ROW_HEIGHT: PRH, PORT_RADIUS: PR } =
        COMFY_NODE_CONSTANTS;
      const sx = sourceInfo.x + sourceInfo.w;
      const sy =
        sourceInfo.y + TH + PRH * (conn.sourceOutputIndex + 0.5) + PR;
      const tx = targetInfo.x;
      // Find target input index — match targetInputName against the target node
      const targetNode = nodes.find(n => n.id === conn.targetNodeId);
      let targetInputIdx = 0;
      if (targetNode) {
        // Use connector order within this target to estimate index
        const targetConns = connectors.filter(
          c => c.targetNodeId === conn.targetNodeId
        );
        targetInputIdx = targetConns.indexOf(conn);
        if (targetInputIdx < 0) targetInputIdx = 0;
      }
      const ty = targetInfo.y + TH + PRH * (targetInputIdx + 0.5) + PR;
      const padding = 10;
      const minX = Math.min(sx, tx) - padding;
      const minY = Math.min(sy, ty) - padding;
      const maxX = Math.max(sx, tx) + padding;
      const maxY = Math.max(sy, ty) + padding;
      connXywh = new Bound(minX, minY, maxX - minX, maxY - minY).serialize();
    }

    elements[connId] = native2Y(
      {
        id: connId,
        index: 'a0',
        type: 'comfy-connector',
        xywh: connXywh,
        rotate: 0,
        sourceNodeId: conn.sourceNodeId,
        sourceOutputIndex: conn.sourceOutputIndex,
        targetNodeId: conn.targetNodeId,
        targetInputName: conn.targetInputName,
        ioType: conn.ioType,
      },
      { deep: false }
    );
  }

  return { elements };
}

// ---- Control Panel ----

function createControlPanel(
  getDoc: () => { getStore: () => unknown } | undefined
): void {
  const panel = document.createElement('div');
  panel.id = 'comfyui-control-panel';
  panel.innerHTML = `
    <style>
      #comfyui-control-panel {
        position: fixed;
        top: 60px;
        right: 16px;
        z-index: 10000;
        background: #1e1e1e;
        color: #ccc;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 12px;
        font-family: monospace;
        font-size: 13px;
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      #comfyui-control-panel h3 {
        margin: 0 0 4px 0;
        color: #fff;
        font-size: 14px;
      }
      #comfyui-control-panel input[type="text"] {
        background: #2a2a2a;
        border: 1px solid #555;
        color: #eee;
        padding: 4px 8px;
        border-radius: 4px;
        width: 100%;
        box-sizing: border-box;
      }
      #comfyui-control-panel .row {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      #comfyui-control-panel button {
        background: #353535;
        color: #ccc;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 4px 10px;
        cursor: pointer;
        font-family: monospace;
        font-size: 12px;
      }
      #comfyui-control-panel button:hover {
        background: #444;
      }
      #comfyui-control-panel .status {
        color: #888;
        font-size: 11px;
        min-height: 16px;
      }
      #comfyui-control-panel .status.ok { color: #81c784; }
      #comfyui-control-panel .status.err { color: #ef5350; }
    </style>
    <h3>ComfyUI Controls</h3>
    <div class="row">
      <input type="text" id="comfy-url" value="http://127.0.0.1:8188" />
      <button id="comfy-connect">Connect</button>
    </div>
    <div class="row">
      <button id="comfy-run">Run</button>
      <button id="comfy-interrupt">Interrupt</button>
    </div>
    <div class="row">
      <button id="comfy-import">Import JSON</button>
      <button id="comfy-export">Export JSON</button>
    </div>
    <div class="status" id="comfy-status">Disconnected</div>
  `;
  document.body.appendChild(panel);

  const statusEl = panel.querySelector('#comfy-status') as HTMLDivElement;
  const urlInput = panel.querySelector('#comfy-url') as HTMLInputElement;

  function setStatus(text: string, type: '' | 'ok' | 'err' = '') {
    statusEl.textContent = text;
    statusEl.className = 'status' + (type ? ` ${type}` : '');
  }

  // -- Helpers to get surface elements --
  function getSurfaceElements(): {
    nodes: unknown[];
    connectors: unknown[];
  } | null {
    const doc = getDoc();
    if (!doc) return null;
    const store = doc.getStore() as {
      getBlock: (id: string) => { model: { elementModels: unknown[] } } | null;
      root: { children: Array<{ flavour: string; id: string }> } | null;
    };
    const root = store.root;
    if (!root) return null;
    const surfaceBlock = root.children.find(
      (b: { flavour: string }) => b.flavour === 'affine:surface'
    );
    if (!surfaceBlock) return null;
    const block = store.getBlock(surfaceBlock.id);
    if (!block) return null;
    const elements = (block.model as { elementModels: Array<{ type: string }> })
      .elementModels;
    const nodes = elements.filter(e => e.type === 'comfy-node');
    const connectors = elements.filter(e => e.type === 'comfy-connector');
    return { nodes, connectors };
  }

  // -- Connect --
  panel.querySelector('#comfy-connect')!.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    setStatus('Connecting...');
    try {
      await comfyUIService.connect({ baseUrl: url });
      setStatus('Connected to ' + url, 'ok');

      // Set up execution handlers
      comfyUIService.setExecutionHandlers({
        onNodeExecuting: (nodeId: string) => {
          setStatus(`Executing node ${nodeId.slice(0, 8)}...`, 'ok');
        },
        onNodeProgress: (_nodeId: string, value: number, max: number) => {
          setStatus(
            `Progress: ${Math.round((value / max) * 100)}%`,
            'ok'
          );
        },
        onNodeExecuted: () => {
          setStatus('Node done', 'ok');
        },
        onNodeError: (_nodeId: string, message: string) => {
          setStatus(`Error: ${message}`, 'err');
        },
      });
    } catch (e) {
      setStatus(`Connection failed: ${(e as Error).message}`, 'err');
    }
  });

  // -- Run --
  panel.querySelector('#comfy-run')!.addEventListener('click', async () => {
    if (!comfyUIService.connected) {
      setStatus('Not connected', 'err');
      return;
    }
    const elems = getSurfaceElements();
    if (!elems) {
      setStatus('No surface elements found', 'err');
      return;
    }
    try {
      setStatus('Queuing workflow...', 'ok');
      const workflow = serializeToApiFormat(
        elems.nodes as never[],
        elems.connectors as never[]
      );
      await comfyUIService.executeApiWorkflow(workflow);
      setStatus('Workflow queued', 'ok');
    } catch (e) {
      setStatus(`Run failed: ${(e as Error).message}`, 'err');
    }
  });

  // -- Interrupt --
  panel
    .querySelector('#comfy-interrupt')!
    .addEventListener('click', async () => {
      try {
        await comfyUIService.interrupt();
        setStatus('Interrupted', 'ok');
      } catch (e) {
        setStatus(`Interrupt failed: ${(e as Error).message}`, 'err');
      }
    });

  // -- Export JSON --
  panel.querySelector('#comfy-export')!.addEventListener('click', () => {
    const elems = getSurfaceElements();
    if (!elems) {
      setStatus('No surface elements found', 'err');
      return;
    }
    const workflow = serializeToApiFormat(
      elems.nodes as never[],
      elems.connectors as never[]
    );
    const blob = new Blob([JSON.stringify(workflow, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comfyui-workflow.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported workflow JSON', 'ok');
  });

  // -- Import JSON --
  panel.querySelector('#comfy-import')!.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const workflow = deserializeWorkflow(json);

        // Add deserialized nodes and connectors to the surface
        const doc = getDoc();
        if (!doc) {
          setStatus('No doc available', 'err');
          return;
        }
        const store = doc.getStore() as {
          root: { children: Array<{ flavour: string; id: string }> } | null;
          getBlock: (
            id: string
          ) => {
            model: {
              addElement: (props: Record<string, unknown>) => string;
            };
          } | null;
        };
        const root = store.root;
        if (!root) return;
        const surfaceBlock = root.children.find(
          (b: { flavour: string }) => b.flavour === 'affine:surface'
        );
        if (!surfaceBlock) return;
        const block = store.getBlock(surfaceBlock.id);
        if (!block) return;
        const surface = block.model as {
          addElement: (props: Record<string, unknown>) => string;
        };

        // Create nodes first, collecting ID mapping
        const idMap = new Map<string, string>();
        for (let i = 0; i < workflow.nodes.length; i++) {
          const node = workflow.nodes[i];
          const origId = Array.from(workflow.idMap.keys())[i];
          const newId = surface.addElement({
            type: 'comfy-node',
            classType: node.classType,
            category: node.category,
            displayName: node.displayName,
            widgetValues: node.widgetValues,
            xywh: node.xywh,
          });
          idMap.set(origId, newId);
        }

        // Create connectors with remapped IDs
        for (const conn of workflow.connectors) {
          const sourceId = idMap.get(conn.sourceNodeId) ?? conn.sourceNodeId;
          const targetId = idMap.get(conn.targetNodeId) ?? conn.targetNodeId;
          surface.addElement({
            type: 'comfy-connector',
            sourceNodeId: sourceId,
            sourceOutputIndex: conn.sourceOutputIndex,
            targetNodeId: targetId,
            targetInputName: conn.targetInputName,
            ioType: conn.ioType,
            xywh: '[0,0,0,0]',
          });
        }

        setStatus(`Imported ${workflow.nodes.length} nodes`, 'ok');
      } catch (e) {
        setStatus(`Import failed: ${(e as Error).message}`, 'err');
      }
    });
    input.click();
  });
}

// ---- Init Function ----

export const comfyui: InitFn = (collection: Workspace, id: string) => {
  const { elements } = buildTxt2ImgWorkflow();

  const doc = collection.createDoc(id);
  const store = doc.getStore();
  doc.load(() => {
    const rootId = store.addBlock('affine:page', {
      title: new Text('ComfyUI Demo'),
    });

    store.addBlock(
      'affine:surface',
      {
        elements: new Boxed(native2Y(elements, { deep: false })) as Boxed<
          Y.Map<Y.Map<unknown>>
        >,
      },
      rootId
    );
  });

  // Attach the control panel after a tick so the editor mounts first
  setTimeout(() => {
    createControlPanel(() => doc);
  }, 100);
};

comfyui.id = 'comfyui';
comfyui.displayName = 'ComfyUI Workflow';
comfyui.description =
  'ComfyUI txt2img workflow demo with 7 nodes and live execution';
