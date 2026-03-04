import { GfxElementModelView } from '@blocksuite/std/gfx';

import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';

export class ComfyNodeElementView extends GfxElementModelView<ComfyNodeElementModel> {
  static override type = 'comfy-node';

  override onCreated(): void {
    super.onCreated();
  }
}
