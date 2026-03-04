import type { EdgelessRootBlockComponent } from '@blocksuite/affine/blocks/root';
import { NoteDisplayMode } from '@blocksuite/affine/model';
import { FeatureFlagService } from '@blocksuite/affine/shared/services';
import { Bound } from '@blocksuite/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  click,
  drag,
  pointerdown,
  pointermove,
  pointerup,
  wait,
} from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('auto-connect', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const waitForCondition = async (condition: () => boolean) => {
    for (let i = 0; i < 40; i++) {
      if (condition()) {
        return;
      }
      await wait(30);
    }
    expect(condition()).toBe(true);
  };

  const addNoteWithMode = (
    x: number,
    y: number,
    mode: NoteDisplayMode,
    width = 100,
    height = 100
  ) => {
    const noteId = addNote(doc, {
      xywh: `[${x},${y},${width},${height}]`,
    });
    service.crud.updateElement(noteId, {
      displayMode: mode,
    });
    return noteId;
  };

  const selectElement = (id: string) => {
    service.selection.set({
      elements: [id],
      editing: false,
    });
  };

  const getSelectedId = () =>
    service.selection.surfaceSelections[0]?.elements[0] ?? null;

  const getWidget = () =>
    document.querySelector<HTMLElement>('affine-edgeless-auto-connect-widget');

  const queryLabels = (selector: string) => {
    const labels = [...document.querySelectorAll<HTMLElement>(selector)];
    const widget = getWidget();
    if (widget?.shadowRoot) {
      labels.push(...widget.shadowRoot.querySelectorAll<HTMLElement>(selector));
    }
    return labels;
  };

  const getPageVisibleLabels = () => queryLabels('.page-visible-index-label');

  const getEdgelessOnlyLabels = () => queryLabels('.edgeless-only-index-label');

  const getNextButton = () =>
    queryLabels('.edgeless-auto-connect-next-button')[0] ?? null;

  const getNoteViewRect = (id: string) => {
    const element = service.crud.getElementById(id);
    if (!element) {
      throw new Error('Cannot find note element');
    }
    const bound = Bound.deserialize(element.xywh);
    const [x, y] = service.viewport.toViewCoord(bound.x, bound.y);
    const { zoom } = service.viewport;
    return {
      x,
      y,
      w: bound.w * zoom,
      h: bound.h * zoom,
    };
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(doc, editor, 'edgeless');
    service = edgeless.service;

    doc
      .get(FeatureFlagService)
      .setFlag('enable_advanced_block_visibility', true);

    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    await wait();

    return cleanup;
  });

  test('navigator', async () => {
    const id1 = addNoteWithMode(200, 300, NoteDisplayMode.DocAndEdgeless);
    const id2 = addNoteWithMode(300, 500, NoteDisplayMode.DocAndEdgeless);
    const id3 = addNoteWithMode(400, 700, NoteDisplayMode.DocAndEdgeless);

    selectElement(id1);
    await waitForCondition(() => getPageVisibleLabels().length === 3);

    const firstLabel = getPageVisibleLabels()[0];
    if (!firstLabel) {
      throw new Error('Cannot find page visible label');
    }
    click(firstLabel, { x: 12, y: 12 });

    await waitForCondition(() => !!getNextButton());
    const nextButton = getNextButton();
    if (!nextButton) {
      throw new Error('Cannot find navigator next button');
    }

    click(nextButton, { x: 8, y: 8 });
    await waitForCondition(() => getSelectedId() === id2);

    click(nextButton, { x: 8, y: 8 });
    await waitForCondition(() => getSelectedId() === id3);
  });

  test('should display index label when select note', async () => {
    const pageVisibleNote = addNoteWithMode(
      200,
      300,
      NoteDisplayMode.DocAndEdgeless
    );
    const edgelessOnlyNote = addNoteWithMode(
      300,
      500,
      NoteDisplayMode.EdgelessOnly
    );

    selectElement(edgelessOnlyNote);
    await waitForCondition(() => getEdgelessOnlyLabels().length === 1);
    expect(getEdgelessOnlyLabels()).toHaveLength(1);

    selectElement(pageVisibleNote);
    await waitForCondition(() => getPageVisibleLabels().length === 1);
    expect(getPageVisibleLabels()).toHaveLength(1);
  });

  test('should hide index label when dragging note', async () => {
    const noteId = addNoteWithMode(200, 300, NoteDisplayMode.DocAndEdgeless);

    selectElement(noteId);
    await waitForCondition(() => getPageVisibleLabels().length === 1);

    const rect = getNoteViewRect(noteId);
    const start = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };

    pointerdown(edgeless.host, start);
    pointermove(edgeless.host, {
      x: start.x + 80,
      y: start.y + 80,
    });
    await waitForCondition(() => getPageVisibleLabels().length === 0);

    pointerup(edgeless.host, {
      x: start.x + 80,
      y: start.y + 80,
    });
    await waitForCondition(() => getPageVisibleLabels().length === 1);
  });

  test('should update index label position after dragging', async () => {
    addNoteWithMode(200, 300, NoteDisplayMode.DocAndEdgeless);
    const noteId = addNoteWithMode(300, 500, NoteDisplayMode.EdgelessOnly);

    selectElement(noteId);
    await waitForCondition(() => getEdgelessOnlyLabels().length === 1);
    await wait(200);

    const label = getEdgelessOnlyLabels()[0];
    if (!label) {
      throw new Error('Cannot find edgeless-only label');
    }
    const initialNoteRect = getNoteViewRect(noteId);
    const initialLabelRect = label.getBoundingClientRect();

    const rect = getNoteViewRect(noteId);
    drag(
      edgeless.host,
      { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
      { x: rect.x + rect.w / 2 + 100, y: rect.y + rect.h / 2 + 100 }
    );
    await waitForCondition(() => getEdgelessOnlyLabels().length === 1);
    await wait(150);

    const movedLabel = getEdgelessOnlyLabels()[0];
    if (!movedLabel) {
      throw new Error('Cannot find moved edgeless-only label');
    }
    const movedNoteRect = getNoteViewRect(noteId);
    const movedLabelRect = movedLabel.getBoundingClientRect();

    const noteDeltaX = movedNoteRect.x - initialNoteRect.x;
    const noteDeltaY = movedNoteRect.y - initialNoteRect.y;
    const labelDeltaX = movedLabelRect.x - initialLabelRect.x;
    const labelDeltaY = movedLabelRect.y - initialLabelRect.y;

    expect(Math.abs(labelDeltaX - noteDeltaX)).toBeLessThan(2);
    expect(Math.abs(labelDeltaY - noteDeltaY)).toBeLessThan(2);
  });
});
