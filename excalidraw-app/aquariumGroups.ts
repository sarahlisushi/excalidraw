import { getCommonBounds } from "@excalidraw/excalidraw";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

type Point = { x: number; y: number };
type Segment = [Point, Point];
const distance = (p: Point, [a, b]: Segment) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const touching = (a: Segment, b: Segment, tolerance: number) => {
  if (
    Math.max(a[0].x, a[1].x) + tolerance < Math.min(b[0].x, b[1].x) ||
    Math.max(b[0].x, b[1].x) + tolerance < Math.min(a[0].x, a[1].x) ||
    Math.max(a[0].y, a[1].y) + tolerance < Math.min(b[0].y, b[1].y) ||
    Math.max(b[0].y, b[1].y) + tolerance < Math.min(a[0].y, a[1].y)
  ) {
    return false;
  }
  return (
    (cross(...a, b[0]) * cross(...a, b[1]) < 0 &&
      cross(...b, a[0]) * cross(...b, a[1]) < 0) ||
    Math.min(
      distance(a[0], b),
      distance(a[1], b),
      distance(b[0], a),
      distance(b[1], a),
    ) <= tolerance
  );
};

/** Group actual touching paths, not overlapping bounding boxes. */
export const groupAquariumElements = (
  elements: readonly NonDeletedExcalidrawElement[],
) => {
  const visible = elements.filter(
    (e) => !e.isDeleted && e.type !== "frame" && e.type !== "magicframe",
  );
  const paths = visible.map((e) => {
    if (e.type !== "freedraw" && e.type !== "line") {
      return [];
    }
    const cx = e.width / 2;
    const cy = e.height / 2;
    return e.points.map(([x, y]) => ({
      x: e.x + cx + (x - cx) * Math.cos(e.angle) - (y - cy) * Math.sin(e.angle),
      y: e.y + cy + (x - cx) * Math.sin(e.angle) + (y - cy) * Math.cos(e.angle),
    }));
  });
  const segments = paths.map((points) =>
    points.length === 1
      ? [[points[0], points[0]] as Segment]
      : points.slice(1).map((p, i) => [points[i], p] as Segment),
  );
  const parents = visible.map((_, i) => i);
  const root = (i: number): number =>
    parents[i] === i ? i : (parents[i] = root(parents[i]));
  const join = (a: number, b: number) => {
    parents[root(b)] = root(a);
  };
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const tolerance =
        5 + (visible[i].strokeWidth + visible[j].strokeWidth) / 2;
      if (
        visible[i].groupIds.some((id) => visible[j].groupIds.includes(id)) ||
        segments[i].some((a) =>
          segments[j].some((b) => touching(a, b, tolerance)),
        )
      ) {
        join(i, j);
      }
    }
  }
  // Flood from outside the ink. Closed pockets stay enclosed even when
  // fins or tails branch off the body, or strokes overshoot their joins.
  const components = new Map<number, number[]>();
  visible.forEach((_, i) =>
    components.set(root(i), [...(components.get(root(i)) || []), i]),
  );
  for (const indices of components.values()) {
    const outline = indices.flatMap((i) => segments[i]);
    if (!outline.length) {
      continue;
    }
    const [left, top, right, bottom] = getCommonBounds(
      indices.map((i) => visible[i]),
    );
    const cell = Math.max(1, (right - left) / 192, (bottom - top) / 192);
    const width = Math.ceil((right - left) / cell) + 12;
    const height = Math.ceil((bottom - top) / cell) + 12;
    const grid = new Uint8Array(width * height);
    const position = (p: Point) => ({
      x: Math.round((p.x - left) / cell) + 6,
      y: Math.round((p.y - top) / cell) + 6,
    });
    for (const [a, b] of outline) {
      const steps = Math.max(
        1,
        Math.ceil((Math.hypot(b.x - a.x, b.y - a.y) / cell) * 2),
      );
      for (let step = 0; step <= steps; step++) {
        const p = position({
          x: a.x + ((b.x - a.x) * step) / steps,
          y: a.y + ((b.y - a.y) * step) / steps,
        });
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (
              p.x + dx >= 0 &&
              p.x + dx < width &&
              p.y + dy >= 0 &&
              p.y + dy < height
            ) {
              grid[(p.y + dy) * width + p.x + dx] = 1;
            }
          }
        }
      }
    }
    const queue = [0];
    grid[0] = 2;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height &&
          grid[ny * width + nx] === 0
        ) {
          grid[ny * width + nx] = 2;
          queue.push(ny * width + nx);
        }
      }
    }
    const inside = (point: Point) => {
      const p = position(point);
      return (
        p.x >= 0 &&
        p.x < width &&
        p.y >= 0 &&
        p.y < height &&
        grid[p.y * width + p.x] !== 2
      );
    };
    visible.forEach((e, i) => {
      const [x1, y1, x2, y2] = getCommonBounds([e]);
      const samples = paths[i].length
        ? paths[i]
        : [
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x1, y: y2 },
            { x: x2, y: y2 },
          ];
      if (samples.every(inside)) {
        join(indices[0], i);
      }
    });
  }
  const groups = new Map<number, NonDeletedExcalidrawElement[]>();
  visible.forEach((element, i) =>
    groups.set(root(i), [...(groups.get(root(i)) || []), element]),
  );
  return [...groups.values()];
};
