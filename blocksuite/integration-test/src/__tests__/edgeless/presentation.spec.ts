import { PresentTool } from '@blocksuite/affine/blocks/frame';
import {
  duplicate,
  type EdgelessRootBlockComponent,
} from '@blocksuite/affine/blocks/root';
import { DefaultTool } from '@blocksuite/affine/blocks/surface';
import type { FrameBlockModel, NoteBlockModel } from '@blocksuite/affine/model';
import { Bound } from '@blocksuite/global/gfx';
import type { EditorHost } from '@blocksuite/std';
import { generateKeyBetweenV2 } from '@blocksuite/std/gfx';
import { Text } from '@blocksuite/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { drag, wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type FramePanelFrameItem = {
  frame: FrameBlockModel;
  frameIndex: string;
  cardIndex: number;
};

type FramePanelBodyElement = HTMLElement & {
  _frameItems: FramePanelFrameItem[];
  _reorderFrames: (
    selected: string[],
    framesMap: Map<string, FramePanelFrameItem>,
    insertIndex: number
  ) => void;
};

type FramePanelElement = HTMLElement & {
  host: EditorHost;
  fitPadding: number[];
};

type PresentationToolbarElement = HTMLElement & {
  _currentFrameIndex: number;
  _nextFrame: () => void;
  _previousFrame: () => void;
  _exitPresentation: () => void;
};

type KeyboardManagerWithSpace = {
  _space: (event: KeyboardEvent) => void;
};

describe('presentation', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];

  const waitForCondition = async (condition: () => boolean, retries = 60) => {
    for (let i = 0; i < retries; i++) {
      if (condition()) {
        return;
      }
      await wait(30);
    }
    expect(condition()).toBe(true);
  };

  const createFrame = (x: number, y: number, w: number, h: number) => {
    return service.frame.createFrameOnBound(new Bound(x, y, w, h));
  };

  const getFrameTitles = () => {
    return service.frames.map(frame => frame.props.title.toString());
  };

  const queryDeep = <T extends Element>(
    selector: string,
    root?: ParentNode
  ): T | null => {
    const searchRoot = root ?? document;
    const direct = searchRoot.querySelector<T>(selector);
    if (direct) {
      return direct;
    }

    const nodes = searchRoot.querySelectorAll('*');
    for (const node of nodes) {
      const shadow = (node as Element).shadowRoot;
      if (!shadow) {
        continue;
      }
      const nested: T | null = queryDeep<T>(selector, shadow);
      if (nested) {
        return nested;
      }
    }
    return null;
  };

  const getBlackBackground = () => {
    return queryDeep('.edgeless-navigator-black-background');
  };

  const getPresentationToolbar = () => {
    const toolbar = queryDeep<PresentationToolbarElement>(
      'presentation-toolbar'
    );
    if (!toolbar) {
      throw new Error('Cannot find presentation toolbar');
    }
    return toolbar;
  };

  const getCurrentFrameTitle = () => {
    const toolbar = getPresentationToolbar();
    return (
      service.frames[toolbar._currentFrameIndex]?.props.title.toString() ?? ''
    );
  };

  const nextFrame = async () => {
    getPresentationToolbar()._nextFrame();
    await wait();
  };

  const previousFrame = async () => {
    getPresentationToolbar()._previousFrame();
    await wait();
  };

  const exitPresentation = async () => {
    getPresentationToolbar()._exitPresentation();
    await wait();
  };

  const isElementVisibleInViewport = (element: HTMLElement | null) => {
    if (!element) return false;

    const style = getComputedStyle(element);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.left < window.innerWidth &&
      rect.top < window.innerHeight
    );
  };

  const isNoteVisible = (noteId: string) => {
    const note = queryDeep<HTMLElement>(
      `affine-edgeless-note[data-block-id="${noteId}"]`
    );
    return isElementVisibleInViewport(note);
  };

  const enterPresentationMode = async () => {
    edgeless.gfx.tool.setTool(PresentTool);
    await waitForCondition(
      () => edgeless.gfx.tool.currentToolName$.peek() === 'frameNavigator'
    );
    await waitForCondition(() => !!queryDeep('presentation-toolbar'));
    await wait(100);
  };

  const moveFrameInPresentationOrder = (from: number, to: number) => {
    const frames = [...service.frames];
    const frame = frames[from];
    if (!frame) {
      throw new Error(`Cannot find frame from index ${from}`);
    }

    const remaining = frames.filter((_, index) => index !== from);
    const before = remaining[to - 1]?.props.presentationIndex ?? null;
    const after = remaining[to]?.props.presentationIndex ?? null;

    service.crud.updateElement(frame.id, {
      presentationIndex: generateKeyBetweenV2(before, after),
    });
    service.doc.captureSync();
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(doc, editor, 'edgeless');
    service = edgeless.service;
    service.viewport.setViewport(1, [
      service.viewport.width / 2,
      service.viewport.height / 2,
    ]);
    await wait();

    return cleanup;
  });

  test('should render note when enter presentation mode', async () => {
    service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[100,100,100,100]',
      fillColor: 'red',
    });
    const noteId = addNote(doc, { xywh: '[300,100,240,120]' });
    createFrame(80, 80, 140, 140);
    createFrame(240, 0, 560, 220);
    await wait();

    await enterPresentationMode();
    await waitForCondition(() => !isNoteVisible(noteId));

    await nextFrame();
    await waitForCondition(() => isNoteVisible(noteId));

    await previousFrame();
    await waitForCondition(() => !isNoteVisible(noteId));

    await nextFrame();
    await waitForCondition(() => isNoteVisible(noteId));
  });

  test('should exit presentation mode when press escape', async () => {
    addNote(doc, { xywh: '[300,100,240,120]' });
    createFrame(240, 0, 560, 220);
    await wait();

    await enterPresentationMode();
    await waitForCondition(() => !!getBlackBackground());
    expect(edgeless.gfx.tool.currentToolName$.peek()).toBe('frameNavigator');

    await exitPresentation();
    await waitForCondition(
      () => edgeless.gfx.tool.currentToolName$.peek() === DefaultTool.toolName
    );
    await waitForCondition(() => !getBlackBackground());
  });

  test('should be able to adjust order of presentation in toolbar', async () => {
    createFrame(100, 100, 100, 100);
    createFrame(220, 100, 100, 100);
    createFrame(340, 100, 100, 100);
    createFrame(460, 100, 100, 100);
    await wait();

    await enterPresentationMode();

    moveFrameInPresentationOrder(2, 0);
    moveFrameInPresentationOrder(3, 2);
    moveFrameInPresentationOrder(1, 2);
    await wait();

    expect(getFrameTitles()).toEqual([
      'Frame 3',
      'Frame 4',
      'Frame 1',
      'Frame 2',
    ]);

    await waitForCondition(() => getCurrentFrameTitle() === 'Frame 3');
    await nextFrame();
    await waitForCondition(() => getCurrentFrameTitle() === 'Frame 4');
    await nextFrame();
    await waitForCondition(() => getCurrentFrameTitle() === 'Frame 1');
    await nextFrame();
    await waitForCondition(() => getCurrentFrameTitle() === 'Frame 2');
  });

  test('should be able to adjust order of presentation in frame panel', async () => {
    createFrame(100, 100, 100, 100);
    createFrame(220, 100, 100, 100);
    createFrame(340, 100, 100, 100);
    createFrame(460, 100, 100, 100);
    await wait();

    const panel = document.createElement(
      'affine-frame-panel'
    ) as FramePanelElement;
    panel.host = editor.host as EditorHost;
    panel.fitPadding = [0, 0, 0, 0];
    document.body.append(panel);

    try {
      await waitForCondition(
        () => !!panel.querySelector('affine-frame-panel-body')
      );
      const panelBody = panel.querySelector(
        'affine-frame-panel-body'
      ) as FramePanelBodyElement;

      await waitForCondition(() => panelBody._frameItems.length === 4);

      const moveInFramePanel = async (from: number, to: number) => {
        const items = [...panelBody._frameItems];
        const selectedFrameId = items[from]?.frame.id;
        if (!selectedFrameId) {
          throw new Error(`Cannot find frame id from index ${from}`);
        }
        const framesMap = new Map(items.map(item => [item.frame.id, item]));
        panelBody._reorderFrames([selectedFrameId], framesMap, to);
        await wait();
      };

      await moveInFramePanel(2, 0);
      await moveInFramePanel(3, 2);
      await moveInFramePanel(1, 3);

      expect(getFrameTitles()).toEqual([
        'Frame 3',
        'Frame 4',
        'Frame 1',
        'Frame 2',
      ]);

      await enterPresentationMode();
      await waitForCondition(() => getCurrentFrameTitle() === 'Frame 3');
      await nextFrame();
      await waitForCondition(() => getCurrentFrameTitle() === 'Frame 4');
      await nextFrame();
      await waitForCondition(() => getCurrentFrameTitle() === 'Frame 1');
      await nextFrame();
      await waitForCondition(() => getCurrentFrameTitle() === 'Frame 2');
    } finally {
      panel.remove();
    }
  });

  test('duplicate frames should keep the presentation orders', async () => {
    createFrame(100, 100, 100, 100);
    createFrame(220, 100, 100, 100);
    createFrame(340, 100, 100, 100);
    createFrame(460, 100, 100, 100);
    await wait();

    const originalTitles = getFrameTitles();
    await duplicate(edgeless, service.frames);
    await waitForCondition(() => service.frames.length === 8);

    expect(getFrameTitles()).toEqual([...originalTitles, ...originalTitles]);
  });

  test('note should hide the collapse button when enter presentation mode', async () => {
    const noteId = addNote(doc, {
      xywh: '[300,100,280,180]',
    });
    const noteModel = doc.getModelById(noteId) as NoteBlockModel | null;
    if (!noteModel) {
      throw new Error('Cannot find note model');
    }
    const firstParagraph = noteModel.children[0];
    if (!firstParagraph) {
      throw new Error('Cannot find note paragraph');
    }

    doc.updateBlock(firstParagraph, {
      text: new Text('line 1\nline 2\nline 3\nline 4\nline 5'),
    });
    doc.updateBlock(noteModel, {
      edgeless: {
        ...noteModel.props.edgeless,
        collapse: false,
        collapsedHeight: 80,
      },
    });

    createFrame(260, 80, 360, 260);
    await wait();

    const getCollapseButton = () =>
      queryDeep(
        `affine-edgeless-note[data-block-id="${noteId}"] [data-testid="edgeless-note-collapse-button"]`
      );

    await waitForCondition(() => !!getCollapseButton());
    await enterPresentationMode();
    await waitForCondition(() => !getCollapseButton());
  });

  test('note should be visible when enter presentation mode', async () => {
    const noteId = addNote(doc, { xywh: '[300,100,260,120]' });
    createFrame(280, 80, 320, 180);
    createFrame(640, 80, 320, 180);
    await wait();

    await enterPresentationMode();
    await waitForCondition(() => isNoteVisible(noteId));

    await nextFrame();
    await waitForCondition(() => !isNoteVisible(noteId));

    await previousFrame();
    await waitForCondition(() => isNoteVisible(noteId));
  });

  test('should disable black background when space+drag in presentation mode', async () => {
    addNote(doc, { xywh: '[300,100,260,120]' });
    createFrame(260, 80, 360, 220);
    await wait();

    await enterPresentationMode();
    await waitForCondition(() => !!getBlackBackground());
    expect(edgeless.gfx.tool.currentToolName$.peek()).toBe('frameNavigator');

    const keyboardManager =
      edgeless.keyboardManager as unknown as KeyboardManagerWithSpace | null;
    if (!keyboardManager) {
      throw new Error('Cannot find keyboard manager');
    }
    keyboardManager._space(
      new KeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
      })
    );
    drag(edgeless.host, { x: 400, y: 300 }, { x: 500, y: 400 });
    document.dispatchEvent(
      new KeyboardEvent('keyup', {
        key: ' ',
        code: 'Space',
        bubbles: true,
      })
    );

    await waitForCondition(() => !getBlackBackground());
    await waitForCondition(
      () => edgeless.gfx.tool.currentToolName$.peek() === 'frameNavigator'
    );
  });
});
