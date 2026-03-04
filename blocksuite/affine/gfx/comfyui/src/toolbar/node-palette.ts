import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { ComfyNodeDefinition } from '../node-registry/registry.js';
import { nodeRegistry } from '../node-registry/registry.js';

/**
 * Categorized, searchable node library panel.
 * Allows users to browse and select ComfyUI nodes for placement.
 */
@customElement('comfyui-node-palette')
export class ComfyUINodePalette extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 260px;
      max-height: 400px;
      background: var(--affine-background-primary-color, #1e1e1e);
      border: 1px solid var(--affine-border-color, #444);
      border-radius: 8px;
      overflow: hidden;
      font-family: sans-serif;
      font-size: 13px;
      color: var(--affine-text-primary-color, #e0e0e0);
    }

    .search-bar {
      padding: 8px;
      border-bottom: 1px solid var(--affine-border-color, #444);
    }

    .search-bar input {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      border: 1px solid var(--affine-border-color, #555);
      border-radius: 4px;
      background: var(--affine-background-secondary-color, #2a2a2a);
      color: inherit;
      font-size: 12px;
      outline: none;
    }

    .search-bar input:focus {
      border-color: var(--affine-primary-color, #1e96eb);
    }

    .categories {
      overflow-y: auto;
      flex: 1;
    }

    .category-header {
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--affine-text-secondary-color, #999);
      background: var(--affine-background-secondary-color, #252525);
      cursor: pointer;
      user-select: none;
    }

    .category-header:hover {
      background: var(--affine-hover-color, #333);
    }

    .node-item {
      padding: 6px 12px 6px 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .node-item:hover {
      background: var(--affine-hover-color, #333);
    }

    .node-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .node-type {
      font-size: 10px;
      color: var(--affine-text-secondary-color, #888);
    }

    .empty {
      padding: 16px;
      text-align: center;
      color: var(--affine-text-secondary-color, #888);
    }
  `;

  @state()
  private accessor _searchQuery = '';

  @state()
  private accessor _expandedCategories = new Set<string>();

  @property({ attribute: false })
  accessor onSelectNode: ((classType: string) => void) | null = null;

  private _onSearch(e: Event) {
    this._searchQuery = (e.target as HTMLInputElement).value;
  }

  private _toggleCategory(cat: string) {
    if (this._expandedCategories.has(cat)) {
      this._expandedCategories.delete(cat);
    } else {
      this._expandedCategories.add(cat);
    }
    this.requestUpdate();
  }

  private _selectNode(classType: string) {
    this.onSelectNode?.(classType);
  }

  override render() {
    const query = this._searchQuery.trim();
    let definitions: ComfyNodeDefinition[];

    if (query) {
      definitions = nodeRegistry.search(query);
    } else {
      definitions = nodeRegistry.getAll();
    }

    // Group by category
    const grouped = new Map<string, ComfyNodeDefinition[]>();
    for (const def of definitions) {
      const cat = def.category || 'uncategorized';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(def);
    }

    const sortedCategories = Array.from(grouped.keys()).sort();

    return html`
      <div class="search-bar">
        <input
          type="text"
          placeholder="Search nodes..."
          .value=${this._searchQuery}
          @input=${this._onSearch}
        />
      </div>
      <div class="categories">
        ${sortedCategories.length === 0
          ? html`<div class="empty">No nodes found</div>`
          : sortedCategories.map(cat => {
              const nodes = grouped.get(cat)!;
              const isExpanded =
                this._expandedCategories.has(cat) || query.length > 0;

              return html`
                <div
                  class="category-header"
                  @click=${() => this._toggleCategory(cat)}
                >
                  ${isExpanded ? '▾' : '▸'} ${cat} (${nodes.length})
                </div>
                ${isExpanded
                  ? nodes.map(
                      def => html`
                        <div
                          class="node-item"
                          @click=${() => this._selectNode(def.classType)}
                        >
                          <span class="node-name">${def.displayName}</span>
                          <span class="node-type">${def.classType}</span>
                        </div>
                      `
                    )
                  : nothing}
              `;
            })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'comfyui-node-palette': ComfyUINodePalette;
  }
}
