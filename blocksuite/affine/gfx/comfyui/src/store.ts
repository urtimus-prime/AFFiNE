import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blocksuite/affine-ext-loader';

import { comfyElementRegistrationExtension } from './middleware.js';
import { BUNDLED_NODE_DEFINITIONS } from './node-registry/bundled-nodes.js';
import { nodeRegistry } from './node-registry/registry.js';

export class ComfyUIStoreExtension extends StoreExtensionProvider {
  override name = 'affine-comfyui-gfx';

  override setup(context: StoreExtensionContext) {
    super.setup(context);

    // Register comfy element types into the surface element map
    context.register(comfyElementRegistrationExtension);

    // Register bundled node definitions on first setup
    if (nodeRegistry.size === 0) {
      for (const def of BUNDLED_NODE_DEFINITIONS) {
        nodeRegistry.register(def);
      }
    }
  }
}
