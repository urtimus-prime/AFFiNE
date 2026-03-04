import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blocksuite/affine-ext-loader';

import { skillTreeElementRegistrationExtension } from './middleware.js';

export class SkillTreeStoreExtension extends StoreExtensionProvider {
  override name = 'affine-skill-tree-gfx';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(skillTreeElementRegistrationExtension);
  }
}
