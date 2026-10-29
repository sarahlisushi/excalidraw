import { useEffect, useRef, useState } from "react";

import { exportScene, getCommonBounds } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { BALL_RADIUS, isGoal, stepBall } from "../playPhysics";
import { groupAquariumElements } from "../aquariumGroups";

import "./PlayModes.scss";

import type { Ball, Rail } from "../playPhysics";

type Mode = "draw" | "ball" | "aquarium";
type Sprite = {
  version: string;
  image: HTMLCanvasElement;
  x: number;
  y: number;
  phase: number;
  direction: number;
};

export const PlayModes = ({ api }: { api: ExcalidrawImperativeAPI }) => {
  const [mode, setMode] = useState<Mode>("draw");
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("Draw ramps, then drop the ball.");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballRef = useRef<Ball | null>(null);
  const pausedRef = useRef(false);
  const resetRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const win = canvas?.ownerDocument.defaultView;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !win || !ctx || mode === "draw") {
      return;
    }
    let alive = true;
    let request = 0;
    let last = 0;
    let elapsed = 0;
    let updating = false;
    let lastCapture = 0;
    let accumulator = 0;
    const sprites = new Map<string, Sprite>();
    const capture = async () => {
      updating = true;
      try {
        const elements = api.getSceneElements();
        const groups = groupAquariumElements(elements);
        const ids = new Set<string>();
        for (const group of groups) {
          if (!alive) {
            break;
          }
          const id = group
            .map((e) => e.id)
            .sort()
            .join(":");
          ids.add(id);
          const version = group.map((e) => `${e.id}:${e.version}`).join(",");
          const old = sprites.get(id);
          if (old?.version === version) {
            continue;
          }
          const image = await exportScene({
            type: "canvas",
            data: { elements: group, files: api.getFiles() },
            config: {
              canvasBackgroundColor: false,
              padding: 8,
              maxWidthOrHeight: 240,
              environment: { document: canvas.ownerDocument },
            },
          });
          const state = api.getAppState();
          const bounds = getCommonBounds(group);
          sprites.set(id, {
            version,
            image,
            x: old?.x ?? (bounds[0] + state.scrollX) * state.zoom.value,
            y: old?.y ?? (bounds[1] + state.scrollY) * state.zoom.value,
            phase: old?.phase ?? sprites.size * 2.4,
            direction: old?.direction ?? 1,
          });
        }
        for (const id of sprites.keys()) {
          if (!ids.has(id)) {
            sprites.delete(id);
          }
        }
      } catch {
        // An unfinished element may not be exportable until its next edit.
      } finally {
        updating = false;
      }
    };

    const render = (now: number) => {
      if (!alive) {
        return;
      }
      const dt = last ? Math.min((now - last) / 1000, 0.04) : 0;
      last = now;
      const { width, height, zoom, scrollX, scrollY } = api.getAppState();
      const ratio = Math.min(win.devicePixelRatio || 1, 2);
      if (
        canvas.width !== Math.round(width * ratio) ||
        canvas.height !== Math.round(height * ratio)
      ) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (!pausedRef.current) {
        elapsed += dt;
      }
      if (mode === "aquarium") {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, "#e0fbff");
        gradient.addColorStop(1, "#67bfc8");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "#ffffff70";
        for (let i = 0; i < 24; i++) {
          const y = height - ((elapsed * (18 + (i % 5) * 4) + i * 79) % height);
          ctx.beginPath();
          ctx.arc(
            (i * 137 + Math.sin(elapsed + i) * 16) % width,
            y,
            3 + (i % 5),
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
        if (resetRef.current) {
          sprites.clear();
          resetRef.current = false;
        }
        if (!updating && now - lastCapture > 250) {
          lastCapture = now;
          void capture();
        }
        for (const sprite of sprites.values()) {
          if (!pausedRef.current) {
            sprite.x +=
              sprite.direction *
              dt *
              (45 + Math.sin(elapsed * 3 + sprite.phase) * 12);
            sprite.y += Math.sin(elapsed * 0.7 + sprite.phase) * dt * 22;
          }
          const w = sprite.image.width;
          const h = sprite.image.height;
          if (sprite.x > width - w - 16) {
            sprite.direction = -1;
          } else if (sprite.x < 16) {
            sprite.direction = 1;
          }
          sprite.y = Math.max(70, Math.min(height - 110, sprite.y));
          ctx.save();
          ctx.translate(sprite.x + w / 2, sprite.y + h / 2);
          ctx.scale(sprite.direction, 1);
          ctx.rotate(Math.sin(elapsed * 1.5 + sprite.phase) * 0.06);
          for (let x = 0; x < w; x += 2) {
            const slice = Math.min(2, w - x);
            const wave =
              Math.sin(elapsed * 7 + (x / w) * 7 + sprite.phase) *
              Math.min(22, h * 0.2) *
              (1 - x / w);
            ctx.drawImage(
              sprite.image,
              x,
              0,
              slice,
              h,
              x - w / 2,
              -h / 2 + wave,
              slice,
              h,
            );
          }
          ctx.restore();
        }
        if (!sprites.size) {
          ctx.fillStyle = "#155e75";
          ctx.font = "22px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            "Draw a creature — watch it come alive",
            width / 2,
            height / 2,
          );
        }
      } else {
        const spawn = { x: width * 0.27, y: 130 };
        const goal = { x: width * 0.72, y: height - 145 };
        ctx.strokeStyle = "#16a34a";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(goal.x - 45, goal.y - 40);
        ctx.lineTo(goal.x - 45, goal.y + 25);
        ctx.lineTo(goal.x + 45, goal.y + 25);
        ctx.lineTo(goal.x + 45, goal.y - 40);
        ctx.stroke();
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#15803d";
        ctx.fillText("GOAL", goal.x, goal.y + 49);
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(spawn.x, spawn.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText("DROP", spawn.x, spawn.y - 25);
        if (resetRef.current) {
          ballRef.current = { ...spawn, vx: 0, vy: 0 };
          resetRef.current = false;
          accumulator = 0;
        }
        if (ballRef.current && !pausedRef.current) {
          const rails: Rail[] = [];
          for (const element of api.getSceneElements()) {
            if (
              element.type !== "line" &&
              element.type !== "arrow" &&
              element.type !== "freedraw"
            ) {
              continue;
            }
            const bounds = getCommonBounds([element]);
            // Rotate points about the element center, then map to viewport pixels.
            const cx = element.x + element.width / 2;
            const cy = element.y + element.height / 2;
            const points = element.points.map(([x, y]) => {
              const dx = element.x + x - cx;
              const dy = element.y + y - cy;
              return {
                x:
                  (cx +
                    dx * Math.cos(element.angle) -
                    dy * Math.sin(element.angle) +
                    scrollX) *
                  zoom.value,
                y:
                  (cy +
                    dx * Math.sin(element.angle) +
                    dy * Math.cos(element.angle) +
                    scrollY) *
                  zoom.value,
              };
            });
            if (!Number.isFinite(bounds[0])) {
              continue;
            }
            for (let i = 1; i < points.length; i++) {
              rails.push({ a: points[i - 1], b: points[i] });
            }
          }
          accumulator += dt;
          while (accumulator >= 1 / 240 && ballRef.current) {
            ballRef.current = stepBall(ballRef.current, rails, 1 / 240);
            accumulator -= 1 / 240;
            if (isGoal(ballRef.current, goal)) {
              setStatus("Goal! Nicely drawn. Try another route?");
              ballRef.current = null;
            } else if (
              ballRef.current.y > height + 40 ||
              ballRef.current.x < -40 ||
              ballRef.current.x > width + 40
            ) {
              setStatus("Missed! Adjust your ramps and try again.");
              ballRef.current = null;
            }
          }
        }
        const ball = ballRef.current;
        if (ball) {
          ctx.fillStyle = "#f97316";
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      request = win.requestAnimationFrame(render);
    };
    request = win.requestAnimationFrame(render);
    return () => {
      alive = false;
      win.cancelAnimationFrame(request);
      ballRef.current = null;
      resetRef.current = false;
    };
  }, [api, mode]);

  const changeMode = (next: Mode) => {
    setMode(next);
    setPaused(false);
    setStatus("Draw ramps with Line or Pencil, then drop the ball.");
    if (next !== "draw") {
      api.setActiveTool({ type: next === "ball" ? "line" : "freedraw" });
    }
  };

  return (
    <>
      {mode !== "draw" && (
        <canvas
          ref={canvasRef}
          className="play-mode-canvas"
          aria-hidden="true"
        />
      )}
      <section className="play-modes" aria-label="Play modes">
        <div className="play-modes__tabs">
          <button
            aria-pressed={mode === "draw"}
            onClick={() => changeMode("draw")}
          >
            Draw
          </button>
          <button
            aria-pressed={mode === "ball"}
            onClick={() => changeMode("ball")}
          >
            Ball Drop
          </button>
          <button
            aria-pressed={mode === "aquarium"}
            onClick={() => changeMode("aquarium")}
          >
            Aquarium
          </button>
        </div>
        {mode !== "draw" && (
          <>
            <p role="status">
              {mode === "ball"
                ? status
                : "Keep drawing — new creatures join the dance. Draw mode restores your canvas."}
            </p>
            <div className="play-modes__actions">
              {mode === "ball" && (
                <button
                  onClick={() => {
                    resetRef.current = true;
                    setPaused(false);
                    setStatus("Ball in motion…");
                  }}
                >
                  Drop / retry
                </button>
              )}
              <button onClick={() => setPaused((value) => !value)}>
                {paused ? "Resume" : "Pause"}
              </button>
              {mode === "aquarium" && (
                <button
                  onClick={() => {
                    resetRef.current = true;
                  }}
                >
                  Reset swimmers
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
};
