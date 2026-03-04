import type { ComfyNodeDefinition } from '../model/types.js';

export type { ComfyNodeDefinition };

/**
 * Registry of ComfyUI node definitions.
 * Bundled core definitions are available immediately; live definitions
 * can be merged from a running ComfyUI instance via `mergeDefinitions()`.
 */
class ComfyNodeDefinitionRegistry {
  private _definitions = new Map<string, ComfyNodeDefinition>();
  private _categories = new Map<string, Set<string>>();

  register(def: ComfyNodeDefinition): void {
    this._definitions.set(def.classType, def);
    const cat = def.category || 'uncategorized';
    if (!this._categories.has(cat)) {
      this._categories.set(cat, new Set());
    }
    this._categories.get(cat)!.add(def.classType);
  }

  get(classType: string): ComfyNodeDefinition | null {
    return this._definitions.get(classType) ?? null;
  }

  getAll(): ComfyNodeDefinition[] {
    return Array.from(this._definitions.values());
  }

  getCategories(): string[] {
    return Array.from(this._categories.keys()).sort();
  }

  getByCategory(category: string): ComfyNodeDefinition[] {
    const classTypes = this._categories.get(category);
    if (!classTypes) return [];
    return Array.from(classTypes)
      .map(ct => this._definitions.get(ct)!)
      .filter(Boolean);
  }

  /**
   * Merge definitions from a live ComfyUI instance.
   * New definitions are added; existing ones are updated.
   */
  mergeDefinitions(defs: ComfyNodeDefinition[]): void {
    for (const def of defs) {
      this.register(def);
    }
  }

  /**
   * Search definitions by display name or class type.
   */
  search(query: string): ComfyNodeDefinition[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      def =>
        def.classType.toLowerCase().includes(q) ||
        def.displayName.toLowerCase().includes(q) ||
        def.category.toLowerCase().includes(q)
    );
  }

  get size(): number {
    return this._definitions.size;
  }
}

/** Singleton registry instance. */
export const nodeRegistry = new ComfyNodeDefinitionRegistry();

/** Convenience function used by renderers. */
export function getNodeDefinition(
  classType: string
): ComfyNodeDefinition | null {
  return nodeRegistry.get(classType);
}
