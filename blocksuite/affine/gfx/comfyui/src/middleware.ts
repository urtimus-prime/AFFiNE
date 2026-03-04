import {
  type SurfaceMiddleware,
  surfaceMiddlewareExtension,
} from '@blocksuite/affine-block-surface';

import { ComfyConnectorElementModel } from './model/comfy-connector-element.js';
import { ComfyNodeElementModel } from './model/comfy-node-element.js';

/**
 * Surface middleware that registers comfy-node and comfy-connector element
 * constructors into the surface's element map at runtime.
 *
 * This avoids a circular dependency between the surface block and the comfyui package.
 * Uses the same pattern as connector-watcher and group-watcher.
 */
const comfyElementRegistration: SurfaceMiddleware = surface => {
  // Access the protected _extendElement method via type assertion.
  // This is the standard pattern for registering new element types
  // from external packages.
  const surfaceAny = surface as unknown as {
    _extendElement: (
      ctorMap: Record<string, unknown>
    ) => void;
  };

  surfaceAny._extendElement({
    'comfy-node': ComfyNodeElementModel,
    'comfy-connector': ComfyConnectorElementModel,
  });

  // Return cleanup function (no-op — element registrations persist)
  return () => {};
};

export const comfyElementRegistrationExtension = surfaceMiddlewareExtension(
  'comfy-element-registration',
  comfyElementRegistration
);
