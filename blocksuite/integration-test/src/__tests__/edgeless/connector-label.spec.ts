import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { ConnectorElementModel, ConnectorMode } from '@blocksuite/affine/model';
import { PointerEventState } from '@blocksuite/std';
import { GfxElementModelView } from '@blocksuite/std/gfx';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { click, wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type ConnectorLabelEditorElement = HTMLElement & {
  inlineEditor?: {
    setText: (text: string) => void;
    rootElement?: HTMLElement | null;
  };
};

const isMac = navigator.platform.toLowerCase().includes('mac');
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

describe('connector label', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const waitForCondition = async (condition: () => boolean, retries = 80) => {
    for (let i = 0; i < retries; i++) {
      if (condition()) {
        return;
      }
      await wait(30);
    }
    expect(condition()).toBe(true);
  };

  const dispatchKey = (
    type: 'keydown' | 'keyup',
    init: {
      key: string;
      code?: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
    }
  ) => {
    const target =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : document.body;
    target.dispatchEvent(
      new KeyboardEvent(type, {
        key: init.key,
        code: init.code ?? init.key,
        bubbles: true,
        composed: true,
        cancelable: true,
        ctrlKey: init.ctrlKey ?? false,
        metaKey: init.metaKey ?? false,
        altKey: init.altKey ?? false,
        shiftKey: init.shiftKey ?? false,
      })
    );
  };

  const pressKey = (init: {
    key: string;
    code?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
  }) => {
    dispatchKey('keydown', init);
    dispatchKey('keyup', init);
  };

  const pressEnter = () => {
    pressKey({ key: 'Enter', code: 'Enter' });
  };

  const pressEscape = () => {
    dispatchKey('keydown', { key: 'Escape', code: 'Escape' });
  };

  const pressModEnter = () => {
    dispatchKey('keydown', {
      key: 'Enter',
      code: 'Enter',
      metaKey: isMac,
      ctrlKey: !isMac,
    });
  };

  const getConnector = (id: string) => {
    const model = service.crud.getElementById(id);
    if (!(model instanceof ConnectorElementModel)) {
      throw new Error(`Cannot find connector: ${id}`);
    }
    return model;
  };

  const addStraightConnector = async (
    start: [number, number],
    end: [number, number]
  ) => {
    const id = service.crud.addElement('connector', {
      source: { position: start },
      target: { position: end },
      mode: ConnectorMode.Straight,
    });
    if (!id) {
      throw new Error('Cannot create connector');
    }

    await waitForCondition(() => getConnector(id).absolutePath.length >= 2);
    return getConnector(id);
  };

  const toPointerEventState = (
    point: [number, number],
    options?: {
      last?: PointerEventState | null;
      start?: [number, number];
      type?: 'pointerdown' | 'pointermove' | 'pointerup';
    }
  ) => {
    const rect = edgeless.host.getBoundingClientRect();
    const [viewX, viewY] = service.viewport.toViewCoord(point[0], point[1]);
    const [startX, startY] = service.viewport.toViewCoord(
      ...(options?.start ?? point)
    );

    return new PointerEventState({
      event: new PointerEvent(options?.type ?? 'pointerup', {
        clientX: rect.left + viewX,
        clientY: rect.top + viewY,
        bubbles: true,
        pointerId: 1,
        isPrimary: true,
      }),
      rect,
      startX,
      startY,
      last: options?.last ?? null,
    });
  };

  const getLabelEditors = () =>
    Array.from(
      document.querySelectorAll<ConnectorLabelEditorElement>(
        'edgeless-connector-label-editor'
      )
    );

  const getLabelEditor = () => getLabelEditors().at(-1) ?? null;

  const waitForLabelEditor = async (mounted: boolean) => {
    await waitForCondition(() =>
      mounted ? getLabelEditors().length > 0 : getLabelEditors().length === 0
    );
  };

  const setLabelText = async (text: string) => {
    await waitForCondition(() => Boolean(getLabelEditor()?.inlineEditor));
    const inlineEditor = getLabelEditor()?.inlineEditor;
    if (!inlineEditor) {
      throw new Error('Cannot find connector label inline editor');
    }
    inlineEditor.rootElement?.focus();
    inlineEditor.setText(text);
    await wait();
  };

  const removeAllLabelEditors = () => {
    getLabelEditors().forEach(editor => {
      try {
        editor.remove();
      } catch {
        // The editor can remove itself during blur/dispose; that's fine.
      }
    });
  };

  const closeLabelEditorDirectly = async () => {
    removeAllLabelEditors();
    await wait();
    await waitForLabelEditor(false);
  };

  const selectConnector = (connectorId: string) => {
    service.selection.set({
      elements: [connectorId],
      editing: false,
    });
  };

  const openLabelEditorByEnter = async (connectorId: string) => {
    selectConnector(connectorId);
    editor.std.event.active = true;
    pressEnter();
    await waitForLabelEditor(true);
  };

  const openLabelEditorByDblClick = async (
    connector: ConnectorElementModel,
    point: [number, number]
  ) => {
    const view =
      service.gfx.view.get(`#${connector.id}-label`) ??
      service.gfx.view.get(connector.id);
    if (!view || !(view instanceof GfxElementModelView)) {
      throw new Error(`Cannot find connector or label view: ${connector.id}`);
    }
    view.dispatch('dblclick', toPointerEventState(point));
    await waitForLabelEditor(true);
  };

  const getLabelCenter = (connector: ConnectorElementModel) => {
    if (!connector.labelXYWH) {
      throw new Error(`Cannot find label bounds: ${connector.id}`);
    }
    const [x, y, w, h] = connector.labelXYWH;
    return [x + w / 2, y + h / 2] as const;
  };

  const expectPointAlmostEqual = (
    actual: [number, number] | readonly [number, number],
    expected: [number, number]
  ) => {
    expect(actual[0]).toBeCloseTo(expected[0], 0);
    expect(actual[1]).toBeCloseTo(expected[1], 0);
  };

  const getLabelView = async (connector: ConnectorElementModel) => {
    await waitForCondition(() =>
      Boolean(service.gfx.view.get(`#${connector.id}-label`))
    );

    const labelView = service.gfx.view.get(`#${connector.id}-label`);
    if (!labelView || !(labelView instanceof GfxElementModelView)) {
      throw new Error(`Cannot find connector label view: ${connector.id}`);
    }
    return labelView;
  };

  const dragLabel = async (
    connector: ConnectorElementModel,
    from: [number, number],
    to: [number, number]
  ) => {
    const labelView = await getLabelView(connector);
    const start = toPointerEventState(from, {
      start: from,
      type: 'pointerdown',
    });
    const move = toPointerEventState(to, {
      last: start,
      start: from,
      type: 'pointermove',
    });
    const end = toPointerEventState(to, {
      last: move,
      start: from,
      type: 'pointerup',
    });
    labelView.dispatch('dragstart', start);
    labelView.dispatch('dragmove', move);
    labelView.dispatch('dragend', end);
    await wait();
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(doc, editor, 'edgeless');
    service = edgeless.service;
    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    click(edgeless.host, { x: 10, y: 10 });
    editor.std.event.active = true;
    await wait();
    return cleanup;
  });

  afterEach(async () => {
    removeAllLabelEditors();
    await wait();
  });

  test('should insert in the middle when starting to edit by Enter', async () => {
    const connector = await addStraightConnector([100, 200], [300, 300]);
    await openLabelEditorByEnter(connector.id);
    await setLabelText(' a ');
    await closeLabelEditorDirectly();

    expect(connector.text?.toString()).toBe('a');
    expect(connector.labelOffset.distance).toBeCloseTo(0.5, 2);
    expectPointAlmostEqual(getLabelCenter(connector), [200, 250]);

    await openLabelEditorByEnter(connector.id);
    await setLabelText('');
    await closeLabelEditorDirectly();

    expect(connector.text).toBeUndefined();
    expect(connector.labelXYWH).toBeUndefined();
  });

  test('should insert at the clicked place when double clicking path', async () => {
    const connector = await addStraightConnector([100, 100], [300, 100]);

    await openLabelEditorByDblClick(connector, [150, 100]);
    await setLabelText('a');
    await closeLabelEditorDirectly();
    expect(connector.text?.toString()).toBe('a');
    expectPointAlmostEqual(getLabelCenter(connector), [150, 100]);

    await openLabelEditorByDblClick(connector, [150, 100]);
    await setLabelText('ab');
    await closeLabelEditorDirectly();
    expect(connector.text?.toString()).toBe('ab');
    expectPointAlmostEqual(getLabelCenter(connector), [150, 100]);

    await openLabelEditorByDblClick(connector, [150, 100]);
    await setLabelText('c');
    await closeLabelEditorDirectly();
    expect(connector.text?.toString()).toBe('c');
    expectPointAlmostEqual(getLabelCenter(connector), [150, 100]);
    expect(connector.labelOffset.distance).toBeCloseTo(50 / 200, 2);
  });

  test('should move label along path only', async () => {
    const connector = await addStraightConnector([100, 50], [200, 50]);

    await openLabelEditorByDblClick(connector, [150, 50]);
    await setLabelText('label');
    await closeLabelEditorDirectly();
    expectPointAlmostEqual(getLabelCenter(connector), [150, 50]);

    await dragLabel(connector, [150, 50], [130, 30]);
    expectPointAlmostEqual(getLabelCenter(connector), [130, 50]);

    await dragLabel(connector, [130, 50], [170, 70]);
    expectPointAlmostEqual(getLabelCenter(connector), [170, 50]);
  });

  test('should keep label movement within endpoint constraints', async () => {
    const connector = await addStraightConnector([100, 50], [200, 50]);

    await openLabelEditorByDblClick(connector, [150, 50]);
    await setLabelText('label');
    await closeLabelEditorDirectly();

    await dragLabel(connector, [150, 50], [300, 110]);
    expectPointAlmostEqual(getLabelCenter(connector), [200, 50]);

    await dragLabel(connector, [200, 50], [0, 50]);
    expectPointAlmostEqual(getLabelCenter(connector), [100, 50]);
  });

  test('should adjust position by offset distance when path changes', async () => {
    const connector = await addStraightConnector([100, 50], [200, 50]);

    await openLabelEditorByDblClick(connector, [170, 50]);
    await setLabelText('label');
    await closeLabelEditorDirectly();

    const offsetDistance = connector.labelOffset.distance;
    expect(offsetDistance).toBeCloseTo(0.7, 2);

    service.crud.updateElement(connector.id, {
      source: { position: [0, 50] },
      target: { position: [300, 50] },
    });

    await waitForCondition(() => {
      const [cx, cy] = getLabelCenter(connector);
      return Math.abs(cx - 210) < 1 && Math.abs(cy - 50) < 1;
    });

    expectPointAlmostEqual(getLabelCenter(connector), [210, 50]);
    expect(connector.labelOffset.distance).toBeCloseTo(offsetDistance, 3);
  });

  test('should enter label editing state when pressing Enter', async () => {
    const connector = await addStraightConnector([100, 200], [300, 300]);

    await openLabelEditorByEnter(connector.id);
    await setLabelText(' a ');
    await closeLabelEditorDirectly();

    expect(connector.text?.toString()).toBe('a');
  });

  test.skipIf(isFirefox)(
    'should exit label editing state on Mod-Enter and Escape',
    async () => {
      const connector = await addStraightConnector([100, 200], [300, 300]);

      await openLabelEditorByEnter(connector.id);
      await setLabelText('a');
      editor.std.event.active = true;
      pressModEnter();
      await waitForLabelEditor(false);
      expect(connector.text?.toString()).toBe('a');

      await openLabelEditorByEnter(connector.id);
      await setLabelText('b');
      editor.std.event.active = true;
      pressEscape();
      await waitForLabelEditor(false);
      expect(connector.text?.toString()).toBe('b');

      await openLabelEditorByEnter(connector.id);
      await setLabelText('c');
      editor.std.event.active = true;
      pressEscape();
      await waitForLabelEditor(false);
      expect(connector.text?.toString()).toBe('c');
    }
  );

  test('should edit label on the correct connector', async () => {
    const connector1 = await addStraightConnector([100, 200], [300, 300]);
    const connector2 = await addStraightConnector([300, 200], [100, 300]);

    await openLabelEditorByDblClick(connector1, [155, 207]);
    await setLabelText('Connector 1');
    await closeLabelEditorDirectly();
    expect(connector1.text?.toString()).toBe('Connector 1');
    expect(connector2.text).toBeUndefined();

    await openLabelEditorByDblClick(connector2, [245, 207]);
    await setLabelText('Connector 2');
    await closeLabelEditorDirectly();
    expect(connector1.text?.toString()).toBe('Connector 1');
    expect(connector2.text?.toString()).toBe('Connector 2');
  });
});
