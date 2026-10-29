import { isGoal, stepBall } from "../playPhysics";

describe("ball drop physics", () => {
  it("falls under gravity", () => {
    const ball = stepBall({ x: 50, y: 10, vx: 0, vy: 0 }, [], 1 / 60);
    expect(ball.y).toBeGreaterThan(10);
    expect(ball.vy).toBeGreaterThan(0);
  });

  it("bounces off a horizontal rail", () => {
    const ball = stepBall(
      { x: 50, y: 90, vx: 0, vy: 100 },
      [{ a: { x: 0, y: 100 }, b: { x: 100, y: 100 } }],
      1 / 240,
    );
    expect(ball.y).toBeLessThanOrEqual(88);
    expect(ball.vy).toBeLessThan(0);
  });

  it("deflects right off a downhill ramp", () => {
    const ball = stepBall(
      { x: 50, y: 40, vx: 0, vy: 100 },
      [{ a: { x: 0, y: 0 }, b: { x: 100, y: 100 } }],
      1 / 240,
    );
    expect(ball.vx).toBeGreaterThan(0);
  });

  it("handles a zero-length stroke", () => {
    const ball = stepBall(
      { x: 0, y: 0, vx: 0, vy: 0 },
      [{ a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }],
      1 / 240,
    );
    expect(Number.isFinite(ball.x)).toBe(true);
  });

  it("scores only within the goal opening", () => {
    expect(isGoal({ x: 100, y: 100, vx: 0, vy: 10 }, { x: 100, y: 100 })).toBe(
      true,
    );
    expect(isGoal({ x: 160, y: 100, vx: 0, vy: 10 }, { x: 100, y: 100 })).toBe(
      false,
    );
  });

  it("can guide a dropped ball into the goal with a drawn ramp", () => {
    let ball = { x: 388.8, y: 130, vx: 0, vy: 0 };
    const rails = [{ a: { x: 318.8, y: 210 }, b: { x: 946.8, y: 655 } }];
    let scored = false;
    for (let step = 0; step < 240 * 10; step++) {
      ball = stepBall(ball, rails, 1 / 240);
      if (isGoal(ball, { x: 1036.8, y: 755 })) {
        scored = true;
        break;
      }
    }
    expect(scored).toBe(true);
  });
});
