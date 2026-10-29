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
  // Ray parity works across separately drawn pieces of the same outline.
  // Only accept a closed outline: every path endpoint must meet another.
  const components = new Map<number, number[]>();
  visible.forEach((_, i) =>
    components.set(root(i), [...(components.get(root(i)) || []), i]),
  );
  for (const indices of components.values()) {
    const ends = indices.flatMap((i) =>
      paths[i].length > 1 ? [paths[i][0], paths[i][paths[i].length - 1]] : [],
    );
    if (
      !ends.length ||
      !ends.every((p, i) =>
        ends.some((q, j) => i !== j && Math.hypot(p.x - q.x, p.y - q.y) <= 8),
      )
    ) {
      continue;
    }
    const outline = indices.flatMap((i) => segments[i]);
    const inside = (p: Point) =>
      outline.reduce(
        (count, [a, b]) =>
          count +
          Number(
            (a.y > p.y ? b.y <= p.y : b.y > p.y) &&
              p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x,
          ),
        0,
      ) %
        2 ===
      1;
    visible.forEach((e, i) => {
      if (paths[i].length && paths[i].every(inside)) {
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
