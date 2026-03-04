import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blocksuite/affine-ext-loader';

import { effects } from './effects.js';
import { SkillConnectorRendererExtension } from './renderer/skill-connector-canvas.js';
import { SkillConnectorDomRendererExtension } from './renderer/skill-connector-dom.js';
import { SkillNodeRendererExtension } from './renderer/skill-node-canvas.js';
import { SkillNodeDomRendererExtension } from './renderer/skill-node-dom.js';
import { SkillConnectorElementView } from './view/skill-connector-view.js';
import { SkillNodeElementView } from './view/skill-node-view.js';

export class SkillTreeViewExtension extends ViewExtensionProvider {
  override name = 'affine-skill-tree-gfx';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(SkillNodeRendererExtension);
      context.register(SkillConnectorRendererExtension);
      context.register(SkillNodeDomRendererExtension);
      context.register(SkillConnectorDomRendererExtension);
      context.register(SkillNodeElementView);
      context.register(SkillConnectorElementView);
    }
  }
}
