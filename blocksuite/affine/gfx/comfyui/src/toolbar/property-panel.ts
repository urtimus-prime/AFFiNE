import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { ComfyNodeElementModel } from '../model/comfy-node-element.js';
import type { ComfyNodeDefinition } from '../node-registry/registry.js';
import { getNodeDefinition } from '../node-registry/registry.js';

/**
 * Property panel for editing widget values on a selected ComfyUI node.
 */
@customElement('comfyui-property-panel')
export class ComfyUIPropertyPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 280px;
      max-height: 500px;
      background: var(--affine-background-primary-color, #1e1e1e);
      border: 1px solid var(--affine-border-color, #444);
      border-radius: 8px;
      overflow-y: auto;
      font-family: sans-serif;
      font-size: 13px;
      color: var(--affine-text-primary-color, #e0e0e0);
    }

    .header {
      padding: 10px 12px;
      font-weight: 600;
      border-bottom: 1px solid var(--affine-border-color, #444);
      background: var(--affine-background-secondary-color, #252525);
    }

    .field {
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-bottom: 1px solid var(--affine-border-color, #333);
    }

    .field-label {
      font-size: 11px;
      color: var(--affine-text-secondary-color, #999);
    }

    .field input,
    .field select,
    .field textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 4px 6px;
      border: 1px solid var(--affine-border-color, #555);
      border-radius: 4px;
      background: var(--affine-background-secondary-color, #2a2a2a);
      color: inherit;
      font-size: 12px;
      font-family: inherit;
      outline: none;
    }

    .field input:focus,
    .field select:focus,
    .field textarea:focus {
      border-color: var(--affine-primary-color, #1e96eb);
    }

    .field textarea {
      min-height: 60px;
      resize: vertical;
    }

    .field input[type='range'] {
      padding: 0;
    }

    .range-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .range-row input[type='range'] {
      flex: 1;
    }

    .range-value {
      min-width: 40px;
      text-align: right;
      font-size: 11px;
      font-family: monospace;
    }

    .empty {
      padding: 16px;
      text-align: center;
      color: var(--affine-text-secondary-color, #888);
    }
  `;

  @property({ attribute: false })
  accessor model: ComfyNodeElementModel | null = null;

  @state()
  private accessor _definition: ComfyNodeDefinition | null = null;

  override willUpdate() {
    if (this.model) {
      this._definition = getNodeDefinition(this.model.classType);
    }
  }

  private _updateValue(name: string, value: unknown) {
    if (!this.model) return;
    const newValues = { ...this.model.widgetValues, [name]: value };
    this.model.widgetValues = newValues;
    this.requestUpdate();
  }

  private _renderField(name: string, config: [string, ...unknown[]]) {
    if (!this.model) return nothing;

    const type = config[0] as string;
    const opts = (config[1] as Record<string, unknown>) ?? {};
    const currentValue = this.model.widgetValues[name];

    // Link-only types — no widget
    if (
      type !== 'INT' &&
      type !== 'FLOAT' &&
      type !== 'STRING' &&
      type !== 'BOOLEAN' &&
      type !== 'COMBO'
    ) {
      return nothing;
    }

    switch (type) {
      case 'INT':
      case 'FLOAT': {
        const min = (opts.min as number) ?? 0;
        const max = (opts.max as number) ?? 100;
        const step = (opts.step as number) ?? (type === 'INT' ? 1 : 0.01);
        const val = (currentValue as number) ?? (opts.default as number) ?? min;

        return html`
          <div class="field">
            <span class="field-label">${name}</span>
            <div class="range-row">
              <input
                type="range"
                .min=${String(min)}
                .max=${String(max)}
                .step=${String(step)}
                .value=${String(val)}
                @input=${(e: Event) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  this._updateValue(name, type === 'INT' ? Math.round(v) : v);
                }}
              />
              <span class="range-value">${val}</span>
            </div>
          </div>
        `;
      }

      case 'STRING': {
        const val = (currentValue as string) ?? (opts.default as string) ?? '';
        const multiline = opts.multiline as boolean;

        if (multiline) {
          return html`
            <div class="field">
              <span class="field-label">${name}</span>
              <textarea
                .value=${val}
                @change=${(e: Event) => {
                  this._updateValue(
                    name,
                    (e.target as HTMLTextAreaElement).value
                  );
                }}
              ></textarea>
            </div>
          `;
        }

        return html`
          <div class="field">
            <span class="field-label">${name}</span>
            <input
              type="text"
              .value=${val}
              @change=${(e: Event) => {
                this._updateValue(
                  name,
                  (e.target as HTMLInputElement).value
                );
              }}
            />
          </div>
        `;
      }

      case 'BOOLEAN': {
        const val =
          (currentValue as boolean) ?? (opts.default as boolean) ?? false;

        return html`
          <div class="field">
            <label>
              <input
                type="checkbox"
                .checked=${val}
                @change=${(e: Event) => {
                  this._updateValue(
                    name,
                    (e.target as HTMLInputElement).checked
                  );
                }}
              />
              ${name}
            </label>
          </div>
        `;
      }

      case 'COMBO': {
        const options = (opts.options as string[]) ?? [];
        const val = (currentValue as string) ?? options[0] ?? '';

        return html`
          <div class="field">
            <span class="field-label">${name}</span>
            <select
              .value=${val}
              @change=${(e: Event) => {
                this._updateValue(
                  name,
                  (e.target as HTMLSelectElement).value
                );
              }}
            >
              ${options.map(
                opt => html`<option .value=${opt} ?selected=${opt === val}>${opt}</option>`
              )}
            </select>
          </div>
        `;
      }

      default:
        return nothing;
    }
  }

  override render() {
    if (!this.model || !this._definition) {
      return html`<div class="empty">Select a ComfyUI node</div>`;
    }

    const allInputs = {
      ...this._definition.inputs.required,
      ...(this._definition.inputs.optional ?? {}),
    };

    return html`
      <div class="header">${this.model.displayName || this.model.classType}</div>
      ${Object.entries(allInputs).map(([name, config]) =>
        this._renderField(name, config as [string, ...unknown[]])
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'comfyui-property-panel': ComfyUIPropertyPanel;
  }
}
