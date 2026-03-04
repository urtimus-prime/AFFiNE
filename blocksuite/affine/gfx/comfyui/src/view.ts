import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';

import { effects } from './effects.js';
import { ComfyConnectorRendererExtension } from './renderer/comfy-connector-canvas.js';
import { ComfyConnectorDomRendererExtension } from './renderer/comfy-connector-dom.js';
import { ComfyNodeRendererExtension } from './renderer/comfy-node-canvas.js';
import { ComfyNodeDomRendererExtension } from './renderer/comfy-node-dom.js';
import { ComfyConnectTool } from './tool/comfy-connect-tool.js';
import { ComfyNodeTool } from './tool/comfy-node-tool.js';
import { comfyUISeniorTool } from './toolbar/senior-tool.js';
import { ComfyConnectorElementView } from './view/comfy-connector-view.js';
import { ComfyNodeElementView } from './view/comfy-node-view.js';

export class ComfyUIViewExtension extends ViewExtensionProvider {
  override name = 'affine-comfyui-gfx';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      // Canvas renderers
      context.register(ComfyNodeRendererExtension);
      context.register(ComfyConnectorRendererExtension);

      // DOM renderers
      context.register(ComfyNodeDomRendererExtension);
      context.register(ComfyConnectorDomRendererExtension);

      // Element views
      context.register(ComfyNodeElementView);
      context.register(ComfyConnectorElementView);

      // Tools
      context.register(ComfyNodeTool);
      context.register(ComfyConnectTool);

      // Toolbar
      context.register(comfyUISeniorTool);
    }
  }
}
