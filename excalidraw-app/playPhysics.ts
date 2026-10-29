export type Point = { x: number; y: number };
export type Rail = { a: Point; b: Point };
export type Ball = Point & { vx: number; vy: number };

export const BALL_RADIUS = 12;

/** Small fixed substeps avoid tunneling through thin drawn rails. */
export const stepBall = (ball: Ball, rails: Rail[], dt: number): Ball => {
  const next = { ...ball, vy: ball.vy + 900 * dt };
  next.x += next.vx * dt;
  next.y += next.vy * dt;
  for (const { a, b } of rails) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) {
      continue;
    }
    const t = Math.max(
      0,
      Math.min(1, ((next.x - a.x) * dx + (next.y - a.y) * dy) / lengthSquared),
    );
    const cx = next.x - (a.x + t * dx);
    const cy = next.y - (a.y + t * dy);
    const distance = Math.hypot(cx, cy);
    if (distance < BALL_RADIUS) {
      const nx =
        distance > 0.001 ? cx / distance : dy / Math.sqrt(lengthSquared);
      const ny =
        distance > 0.001 ? cy / distance : -dx / Math.sqrt(lengthSquared);
      next.x += nx * (BALL_RADIUS - distance);
      next.y += ny * (BALL_RADIUS - distance);
      const speed = next.vx * nx + next.vy * ny;
      if (speed < 0) {
        next.vx = (next.vx - 1.35 * speed * nx) * 0.995;
        next.vy = (next.vy - 1.35 * speed * ny) * 0.995;
      }
    }
  }
  return next;
};

export const isGoal = (ball: Ball, goal: Point) =>
  Math.abs(ball.x - goal.x) < 34 &&
  ball.y > goal.y - 30 &&
  ball.y < goal.y + 18;
