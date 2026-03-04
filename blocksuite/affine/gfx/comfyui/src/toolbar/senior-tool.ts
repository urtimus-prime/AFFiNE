import { SeniorToolExtension } from '@blocksuite/affine-widget-edgeless-toolbar';
import { html } from 'lit';

export const comfyUISeniorTool = SeniorToolExtension(
  'comfyui',
  ({ block, toolbarContainer }) => {
    return {
      name: 'ComfyUI',
      content: html`<comfyui-toolbar-button
        .edgeless=${block}
        .toolbarContainer=${toolbarContainer}
      ></comfyui-toolbar-button>`,
    };
  }
);
