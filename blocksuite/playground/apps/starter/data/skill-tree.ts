import { Bound } from '@blocksuite/affine/global/gfx';
import {
  Boxed,
  nanoid,
  native2Y,
  Text,
  type Workspace,
} from '@blocksuite/affine/store';
import {
  SKILL_TREE_CONSTANTS,
  type SkillCategory,
  type SkillState,
} from '@blocksuite/affine-gfx-skill-tree';
import type * as Y from 'yjs';

import type { InitFn } from './utils.js';

// ---- Skill Tree Definition ----

interface SkillDef {
  id: string;
  skillName: string;
  skillDescription: string;
  category: SkillCategory;
  tier: number;
  skillState: SkillState;
  iconEmoji: string;
  maxLevel: number;
  currentLevel: number;
  prerequisiteIds: string[];
}

interface ConnDef {
  sourceId: string;
  targetId: string;
}

function buildSkillTree(): { elements: Record<string, unknown> } {
  const { NODE_WIDTH, NODE_HEIGHT, TIER_SPACING_Y, NODE_SPACING_X } =
    SKILL_TREE_CONSTANTS;

  // Node IDs
  const strengthId = nanoid();
  const arcaneId = nanoid();
  const agilityId = nanoid();
  const slashId = nanoid();
  const shieldId = nanoid();
  const fireId = nanoid();
  const healId = nanoid();
  const stealthId = nanoid();
  const daggersId = nanoid();
  const berserkerId = nanoid();
  const blizzardId = nanoid();
  const summonId = nanoid();
  const shadowId = nanoid();
  const poisonId = nanoid();
  const godOfWarId = nanoid();
  const archmageId = nanoid();
  const assassinId = nanoid();

  const skills: SkillDef[] = [
    // Tier 0 — Unlocked (starting skills)
    {
      id: strengthId,
      skillName: 'Strength',
      skillDescription: 'Raw physical power',
      category: 'combat',
      tier: 0,
      skillState: 'unlocked',
      iconEmoji: '💪',
      maxLevel: 1,
      currentLevel: 1,
      prerequisiteIds: [],
    },
    {
      id: arcaneId,
      skillName: 'Arcane Lore',
      skillDescription: 'Basic magical knowledge',
      category: 'magic',
      tier: 0,
      skillState: 'unlocked',
      iconEmoji: '📖',
      maxLevel: 1,
      currentLevel: 1,
      prerequisiteIds: [],
    },
    {
      id: agilityId,
      skillName: 'Agility',
      skillDescription: 'Speed and reflexes',
      category: 'stealth',
      tier: 0,
      skillState: 'unlocked',
      iconEmoji: '🏃',
      maxLevel: 1,
      currentLevel: 1,
      prerequisiteIds: [],
    },

    // Tier 1
    {
      id: slashId,
      skillName: 'Slash',
      skillDescription: 'Powerful sword strike',
      category: 'combat',
      tier: 1,
      skillState: 'available',
      iconEmoji: '⚔️',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [strengthId],
    },
    {
      id: shieldId,
      skillName: 'Shield',
      skillDescription: 'Defensive stance',
      category: 'combat',
      tier: 1,
      skillState: 'available',
      iconEmoji: '🛡️',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [strengthId],
    },
    {
      id: fireId,
      skillName: 'Fireball',
      skillDescription: 'Launch a ball of fire',
      category: 'magic',
      tier: 1,
      skillState: 'available',
      iconEmoji: '🔥',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [arcaneId],
    },
    {
      id: healId,
      skillName: 'Heal',
      skillDescription: 'Restore health',
      category: 'magic',
      tier: 1,
      skillState: 'available',
      iconEmoji: '💚',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [arcaneId],
    },
    {
      id: stealthId,
      skillName: 'Stealth',
      skillDescription: 'Become invisible',
      category: 'stealth',
      tier: 1,
      skillState: 'unlocked',
      iconEmoji: '👤',
      maxLevel: 3,
      currentLevel: 2,
      prerequisiteIds: [agilityId],
    },
    {
      id: daggersId,
      skillName: 'Daggers',
      skillDescription: 'Dual wield daggers',
      category: 'stealth',
      tier: 1,
      skillState: 'unlocked',
      iconEmoji: '🗡️',
      maxLevel: 3,
      currentLevel: 3,
      prerequisiteIds: [agilityId],
    },

    // Tier 2
    {
      id: berserkerId,
      skillName: 'Berserker',
      skillDescription: 'Rage-fueled combat',
      category: 'combat',
      tier: 2,
      skillState: 'locked',
      iconEmoji: '🔱',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [slashId, shieldId],
    },
    {
      id: blizzardId,
      skillName: 'Blizzard',
      skillDescription: 'Freezing ice storm',
      category: 'magic',
      tier: 2,
      skillState: 'locked',
      iconEmoji: '❄️',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [fireId],
    },
    {
      id: summonId,
      skillName: 'Summon',
      skillDescription: 'Call a creature',
      category: 'magic',
      tier: 2,
      skillState: 'locked',
      iconEmoji: '🐉',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [healId],
    },
    {
      id: shadowId,
      skillName: 'Shadow',
      skillDescription: 'Meld with darkness',
      category: 'stealth',
      tier: 2,
      skillState: 'available',
      iconEmoji: '🌑',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [stealthId],
    },
    {
      id: poisonId,
      skillName: 'Poison',
      skillDescription: 'Coat weapons in venom',
      category: 'stealth',
      tier: 2,
      skillState: 'available',
      iconEmoji: '☠️',
      maxLevel: 3,
      currentLevel: 0,
      prerequisiteIds: [daggersId],
    },

    // Tier 3
    {
      id: godOfWarId,
      skillName: 'God of War',
      skillDescription: 'Ultimate warrior',
      category: 'combat',
      tier: 3,
      skillState: 'locked',
      iconEmoji: '⚡',
      maxLevel: 1,
      currentLevel: 0,
      prerequisiteIds: [berserkerId],
    },
    {
      id: archmageId,
      skillName: 'Archmage',
      skillDescription: 'Master of all magic',
      category: 'magic',
      tier: 3,
      skillState: 'locked',
      iconEmoji: '🌟',
      maxLevel: 1,
      currentLevel: 0,
      prerequisiteIds: [blizzardId, summonId],
    },
    {
      id: assassinId,
      skillName: 'Assassin',
      skillDescription: 'Silent death dealer',
      category: 'stealth',
      tier: 3,
      skillState: 'maxed',
      iconEmoji: '🎭',
      maxLevel: 1,
      currentLevel: 1,
      prerequisiteIds: [shadowId, poisonId],
    },
  ];

  // Connectors (prerequisite → skill)
  const connectors: ConnDef[] = [];
  for (const skill of skills) {
    for (const prereqId of skill.prerequisiteIds) {
      connectors.push({ sourceId: prereqId, targetId: skill.id });
    }
  }

  // Layout — group by tier, center horizontally
  const tiers = new Map<number, SkillDef[]>();
  for (const skill of skills) {
    const list = tiers.get(skill.tier) ?? [];
    list.push(skill);
    tiers.set(skill.tier, list);
  }

  const START_Y = 100;
  const CENTER_X = 500;
  const positions = new Map<string, { x: number; y: number }>();

  for (const [tier, tierSkills] of tiers) {
    const count = tierSkills.length;
    const totalWidth = (count - 1) * NODE_SPACING_X;
    const startX = CENTER_X - totalWidth / 2;
    for (let i = 0; i < tierSkills.length; i++) {
      positions.set(tierSkills[i].id, {
        x: startX + i * NODE_SPACING_X,
        y: START_Y + tier * TIER_SPACING_Y,
      });
    }
  }

  // Build surface elements
  const elements: Record<string, unknown> = {};

  for (const skill of skills) {
    const pos = positions.get(skill.id)!;
    const bound = new Bound(pos.x, pos.y, NODE_WIDTH, NODE_HEIGHT);

    elements[skill.id] = native2Y(
      {
        id: skill.id,
        index: 'a0',
        type: 'skill-node',
        xywh: bound.serialize(),
        rotate: 0,
        skillName: skill.skillName,
        skillDescription: skill.skillDescription,
        category: skill.category,
        tier: skill.tier,
        skillState: skill.skillState,
        iconEmoji: skill.iconEmoji,
        maxLevel: skill.maxLevel,
        currentLevel: skill.currentLevel,
        prerequisiteIds: skill.prerequisiteIds,
      },
      { deep: false }
    );
  }

  for (const conn of connectors) {
    const connId = nanoid();
    const sPos = positions.get(conn.sourceId)!;
    const tPos = positions.get(conn.targetId)!;

    // Connector bounding box
    const sx = sPos.x + NODE_WIDTH / 2;
    const sy = sPos.y + NODE_HEIGHT;
    const tx = tPos.x + NODE_WIDTH / 2;
    const ty = tPos.y;
    const pad = 20;
    const minX = Math.min(sx, tx) - pad;
    const minY = Math.min(sy, ty) - pad;
    const maxX = Math.max(sx, tx) + pad;
    const maxY = Math.max(sy, ty) + pad;
    const connBound = new Bound(minX, minY, maxX - minX, maxY - minY);

    elements[connId] = native2Y(
      {
        id: connId,
        index: 'a0',
        type: 'skill-connector',
        xywh: connBound.serialize(),
        rotate: 0,
        sourceNodeId: conn.sourceId,
        targetNodeId: conn.targetId,
      },
      { deep: false }
    );
  }

  return { elements };
}

// ---- Control Panel ----

function createControlPanel(
  getDoc: () => { getStore: () => unknown } | undefined
): void {
  const panel = document.createElement('div');
  panel.id = 'skill-tree-control-panel';
  panel.innerHTML = `
    <style>
      #skill-tree-control-panel {
        position: fixed;
        top: 60px;
        right: 16px;
        z-index: 10000;
        background: #1a1a2e;
        color: #ccc;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 12px;
        font-family: monospace;
        font-size: 13px;
        width: 280px;
        max-height: 80vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #skill-tree-control-panel h3 {
        margin: 0 0 4px 0;
        color: #ffd700;
        font-size: 14px;
      }
      #skill-tree-control-panel h4 {
        margin: 8px 0 2px 0;
        font-size: 12px;
      }
      #skill-tree-control-panel h4.combat { color: #e74c3c; }
      #skill-tree-control-panel h4.magic { color: #9b59b6; }
      #skill-tree-control-panel h4.stealth { color: #27ae60; }
      #skill-tree-control-panel .skill-btn {
        background: #2a2a3e;
        color: #ccc;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-family: monospace;
        font-size: 11px;
        text-align: left;
        width: 100%;
        display: flex;
        justify-content: space-between;
      }
      #skill-tree-control-panel .skill-btn:hover { background: #3a3a4e; }
      #skill-tree-control-panel .skill-btn .state { font-weight: bold; }
      #skill-tree-control-panel .skill-btn .state.locked { color: #666; }
      #skill-tree-control-panel .skill-btn .state.available { color: #88aacc; }
      #skill-tree-control-panel .skill-btn .state.unlocked { color: #fff; }
      #skill-tree-control-panel .skill-btn .state.maxed { color: #ffd700; }
      #skill-tree-control-panel button.reset {
        background: #4a1a1a;
        color: #ff6666;
        border: 1px solid #663333;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        font-family: monospace;
        font-size: 12px;
        margin-top: 8px;
      }
      #skill-tree-control-panel button.reset:hover { background: #5a2a2a; }
    </style>
    <h3>⚔️ Skill Tree</h3>
    <div id="skill-list"></div>
    <button class="reset" id="skill-reset">Reset All Skills</button>
  `;
  document.body.append(panel);

  const listEl = panel.querySelector('#skill-list') as HTMLDivElement;

  const STATE_ORDER: SkillState[] = [
    'locked',
    'available',
    'unlocked',
    'maxed',
  ];

  function getSurfaceModel(): {
    elementModels: Array<{
      type: string;
      id: string;
      skillName?: string;
      category?: string;
      skillState?: SkillState;
      currentLevel?: number;
      maxLevel?: number;
      prerequisiteIds?: string[];
    }>;
  } | null {
    const doc = getDoc();
    if (!doc) return null;
    const store = doc.getStore() as {
      getBlock: (id: string) => { model: unknown } | null;
      root: { children: Array<{ flavour: string; id: string }> } | null;
    };
    const root = store.root;
    if (!root) return null;
    const surfaceBlock = root.children.find(
      (b: { flavour: string }) => b.flavour === 'affine:surface'
    );
    if (!surfaceBlock) return null;
    const block = store.getBlock(surfaceBlock.id);
    if (!block) return null;
    return block.model as ReturnType<typeof getSurfaceModel>;
  }

  function getSkillNodes() {
    const surface = getSurfaceModel();
    if (!surface) return [];
    return surface.elementModels.filter(e => e.type === 'skill-node') as Array<{
      type: string;
      id: string;
      skillName: string;
      category: SkillCategory;
      skillState: SkillState;
      currentLevel: number;
      maxLevel: number;
      prerequisiteIds: string[];
    }>;
  }

  function cascadeAvailability(
    nodes: ReturnType<typeof getSkillNodes>,
    surface: NonNullable<ReturnType<typeof getSurfaceModel>>
  ): void {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (const node of nodes) {
      if (node.skillState !== 'locked') continue;
      if (node.prerequisiteIds.length === 0) continue;
      const allPrereqsMet = node.prerequisiteIds.every(pid => {
        const prereq = nodeMap.get(pid);
        return (
          prereq &&
          (prereq.skillState === 'unlocked' || prereq.skillState === 'maxed')
        );
      });
      if (allPrereqsMet) {
        const el = surface.elementModels.find(e => e.id === node.id);
        if (el) {
          (el as { skillState: SkillState }).skillState = 'available';
        }
      }
    }
  }

  function renderList(): void {
    const nodes = getSkillNodes();
    if (nodes.length === 0) {
      listEl.innerHTML = '<div style="color:#666">No skill nodes found</div>';
      return;
    }

    const categories: SkillCategory[] = ['combat', 'magic', 'stealth'];
    let html = '';
    for (const cat of categories) {
      const catNodes = nodes.filter(n => n.category === cat);
      if (catNodes.length === 0) continue;
      html += `<h4 class="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</h4>`;
      for (const node of catNodes) {
        html += `<button class="skill-btn" data-id="${node.id}">
          <span>${node.skillName} (${node.currentLevel}/${node.maxLevel})</span>
          <span class="state ${node.skillState}">${node.skillState}</span>
        </button>`;
      }
    }
    listEl.innerHTML = html;

    // Attach click handlers
    for (const btn of listEl.querySelectorAll('.skill-btn')) {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!;
        const surface = getSurfaceModel();
        if (!surface) return;
        const el = surface.elementModels.find(e => e.id === id);
        if (!el || el.type !== 'skill-node') return;

        const currentIdx = STATE_ORDER.indexOf(el.skillState!);
        const nextState = STATE_ORDER[(currentIdx + 1) % STATE_ORDER.length];
        (el as { skillState: SkillState }).skillState = nextState;

        // Update level based on state
        if (nextState === 'maxed') {
          (el as { currentLevel: number }).currentLevel = el.maxLevel!;
        } else if (nextState === 'locked' || nextState === 'available') {
          (el as { currentLevel: number }).currentLevel = 0;
        } else if (nextState === 'unlocked') {
          (el as { currentLevel: number }).currentLevel = Math.max(
            1,
            Math.min(el.currentLevel! + 1, el.maxLevel!)
          );
        }

        // Cascade availability
        const freshNodes = getSkillNodes();
        cascadeAvailability(freshNodes, surface);

        renderList();
      });
    }
  }

  // Reset
  panel.querySelector('#skill-reset')!.addEventListener('click', () => {
    const surface = getSurfaceModel();
    if (!surface) return;
    for (const el of surface.elementModels) {
      if (el.type !== 'skill-node') continue;
      const prereqs = el.prerequisiteIds ?? [];
      if (prereqs.length === 0) {
        // Tier 0: unlocked
        (el as { skillState: SkillState }).skillState = 'unlocked';
        (el as { currentLevel: number }).currentLevel = 1;
      } else {
        (el as { skillState: SkillState }).skillState = 'locked';
        (el as { currentLevel: number }).currentLevel = 0;
      }
    }
    // Cascade: make tier 1 available since tier 0 is unlocked
    const freshNodes = getSkillNodes();
    cascadeAvailability(freshNodes, surface);
    renderList();
  });

  renderList();
  // Periodically refresh the list to reflect animation state changes
  setInterval(renderList, 2000);
}

// ---- Init Function ----

export const skillTree: InitFn = (collection: Workspace, id: string) => {
  const { elements } = buildSkillTree();

  const doc = collection.createDoc(id);
  const store = doc.getStore();
  doc.load(() => {
    const rootId = store.addBlock('affine:page', {
      title: new Text('Skill Tree Demo'),
    });

    store.addBlock(
      'affine:surface',
      {
        elements: new Boxed(native2Y(elements, { deep: false })) as Boxed<
          Y.Map<Y.Map<unknown>>
        >,
      },
      rootId
    );
  });

  setTimeout(() => {
    createControlPanel(() => doc);
  }, 100);
};

skillTree.id = 'skill-tree';
skillTree.displayName = 'Skill Tree';
skillTree.description =
  'RPG-style skill tree with hexagonal nodes, glow effects, and animated connections';
