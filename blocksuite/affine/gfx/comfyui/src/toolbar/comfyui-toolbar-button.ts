import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * Toolbar button that opens the ComfyUI node palette.
 */
@customElement('comfyui-toolbar-button')
export class ComfyUIToolbarButton extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
    }

    .comfyui-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--affine-icon-color, #e0e0e0);
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
    }

    .comfyui-btn:hover {
      background: var(--affine-hover-color, #333);
    }

    .comfyui-btn.active {
      background: var(--affine-primary-color, #1e96eb);
      color: white;
    }
  `;

  @property({ attribute: false })
  accessor edgeless: unknown = null;

  @property({ attribute: false })
  accessor toolbarContainer: unknown = null;

  @state()
  private accessor _active = false;

  private _togglePalette() {
    this._active = !this._active;
    this.dispatchEvent(
      new CustomEvent('comfyui-toggle-palette', {
        bubbles: true,
        composed: true,
        detail: { active: this._active },
      })
    );
  }

  override render() {
    return html`
      <button
        class="comfyui-btn ${this._active ? 'active' : ''}"
        @click=${this._togglePalette}
        title="ComfyUI Nodes"
      >
        ⬡
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'comfyui-toolbar-button': ComfyUIToolbarButton;
  }
}
