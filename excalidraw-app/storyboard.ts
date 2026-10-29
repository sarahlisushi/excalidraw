import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  getCommonBounds,
} from "@excalidraw/excalidraw";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/** Native frames and text remain editable with the standard drawing tools. */
export const createStoryboardElements = (x = 0, y = 0) => {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  for (let index = 0; index < 6; index++) {
    const left = x + (index % 3) * 360;
    const top = y + Math.floor(index / 3) * 300;
    skeletons.push(
      {
        type: "frame",
        children: [],
        x: left,
        y: top,
        width: 320,
        height: 180,
        name: `Shot ${index + 1}`,
      },
      {
        type: "text",
        x: left,
        y: top + 196,
        text: "Shot notes...",
        fontSize: 20,
      },
    );
  }
  return convertToExcalidrawElements(skeletons);
};

export const insertStoryboard = (api: ExcalidrawImperativeAPI) => {
  const existing = api.getSceneElements();
  const bounds = existing.length ? getCommonBounds(existing) : null;
  const elements = createStoryboardElements(
    bounds ? bounds[2] + 80 : 0,
    bounds ? bounds[1] : 0,
  );
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), ...elements],
    appState: {
      selectedElementIds: Object.fromEntries(
        elements.map((element) => [element.id, true]),
      ),
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.setViewport({ target: elements, fit: "scale-down" });
};
