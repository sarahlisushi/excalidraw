import { CaptureUpdateAction } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { createStoryboardElements, insertStoryboard } from "../storyboard";

describe("storyboard preset", () => {
  it("creates six numbered 16:9 frames in two rows with editable notes", () => {
    const elements = createStoryboardElements(100, 200);
    const frames = elements.filter((element) => element.type === "frame");
    const notes = elements.filter((element) => element.type === "text");
    expect(frames).toHaveLength(6);
    expect(notes).toHaveLength(6);
    frames.forEach((frame, index) => {
      expect(frame).toMatchObject({
        name: `Shot ${index + 1}`,
        x: 100 + (index % 3) * 360,
        y: 200 + Math.floor(index / 3) * 300,
        width: 320,
        height: 180,
        locked: false,
      });
      expect(notes[index]).toMatchObject({
        text: "Shot notes...",
        x: frame.x,
        y: frame.y + 196,
        locked: false,
        frameId: null,
      });
    });
  });

  it("uses fresh IDs each time", () => {
    const first = createStoryboardElements();
    const second = createStoryboardElements();
    expect(new Set([...first, ...second].map(({ id }) => id)).size).toBe(24);
  });

  it("preserves existing elements and inserts to their right in one undo step", () => {
    const existing = createStoryboardElements();
    const deleted = { ...existing[0], id: "deleted-frame", isDeleted: true };
    const updateScene = vi.fn();
    const setViewport = vi.fn();
    const api = {
      getSceneElements: () => existing,
      getSceneElementsIncludingDeleted: () => [...existing, deleted],
      updateScene,
      setViewport,
    } as unknown as ExcalidrawImperativeAPI;
    insertStoryboard(api);
    const update = updateScene.mock.calls[0][0];
    expect(update.elements.slice(0, 13)).toEqual([...existing, deleted]);
    expect(update.elements).toHaveLength(25);
    expect(update.elements[13].x).toBe(1120);
    expect(Object.keys(update.appState.selectedElementIds)).toHaveLength(12);
    expect(update.captureUpdate).toBe(CaptureUpdateAction.IMMEDIATELY);
    expect(setViewport).toHaveBeenCalledWith({
      target: update.elements.slice(13),
      fit: "scale-down",
    });
  });
});
