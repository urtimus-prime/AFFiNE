/**
 * Register Lit custom elements for ComfyUI components.
 * Called once during the view extension's effect() phase.
 */
export function effects(): void {
  // Import Lit components to trigger @customElement registration
  import('./toolbar/node-palette.js');
  import('./toolbar/property-panel.js');
  import('./toolbar/comfyui-toolbar-button.js');
}
