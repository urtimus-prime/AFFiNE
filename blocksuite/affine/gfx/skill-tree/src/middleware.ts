import {
  type SurfaceMiddleware,
  surfaceMiddlewareExtension,
} from '@blocksuite/affine-block-surface';

import { SkillConnectorElementModel } from './model/skill-connector-element.js';
import { SkillNodeElementModel } from './model/skill-node-element.js';

const skillTreeElementRegistration: SurfaceMiddleware = surface => {
  const surfaceAny = surface as unknown as {
    _extendElement: (ctorMap: Record<string, unknown>) => void;
  };

  surfaceAny._extendElement({
    'skill-node': SkillNodeElementModel,
    'skill-connector': SkillConnectorElementModel,
  });

  return () => {};
};

export const skillTreeElementRegistrationExtension = surfaceMiddlewareExtension(
  'skill-tree-element-registration',
  skillTreeElementRegistration
);
