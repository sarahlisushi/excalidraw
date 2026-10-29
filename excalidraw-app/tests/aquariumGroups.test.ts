import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { pointFrom } from "@excalidraw/math";

import { groupAquariumElements } from "../aquariumGroups";

describe("aquarium fish", () => {
  it("joins a loop drawn in separate strokes, including an eye inside", () => {
    const elements = convertToExcalidrawElements([
      {
        type: "line",
        x: 0,
        y: 0,
        points: [pointFrom(0, 0), pointFrom(100, 0), pointFrom(100, 100)],
      },
      {
        type: "line",
        x: 0,
        y: 0,
        points: [pointFrom(0, 0), pointFrom(0, 100), pointFrom(100, 100)],
      },
      {
        type: "line",
        x: 60,
        y: 40,
        points: [pointFrom(0, 0), pointFrom(5, 5)],
      },
      {
        type: "line",
        x: 250,
        y: 0,
        points: [pointFrom(0, 0), pointFrom(30, 30)],
      },
    ]);
    const groups = groupAquariumElements(elements);
    expect(groups.map((g) => g.length).sort()).toEqual([1, 3]);
  });

  it("does not merge disjoint paths just because their bounding boxes overlap", () => {
    const elements = convertToExcalidrawElements([
      {
        type: "line",
        x: 0,
        y: 0,
        points: [pointFrom(0, 0), pointFrom(100, 100)],
      },
      {
        type: "line",
        x: 0,
        y: 30,
        points: [pointFrom(0, 0), pointFrom(100, 100)],
      },
    ]);
    expect(groupAquariumElements(elements)).toHaveLength(2);
  });
});
