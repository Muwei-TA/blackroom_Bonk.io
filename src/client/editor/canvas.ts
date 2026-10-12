import type { GameMode } from "../../shared/game-mode";
import {
  screenToWorld,
  rotationHandle,
  normalizeAngle,
  pointInPlatform,
  localPoint,
  platformCorners,
  type Point,
} from "../../shared/geometry";
import type { Platform } from "../../shared/maps";
import { drawEnergy, drawPivot } from "../arena-paint";
import { COLORS, SEESAW_MAX_ANGLE } from "../../shared/constants";
import type { BodyView, PlatformView, EnergyView } from "../../shared/protocol";
import { EditorModel } from "./model";
export function bindEditorCanvas(
  canvas: HTMLCanvasElement,
  model: EditorModel,
  changed: () => void,
  snap: () => boolean,
) {
  let drag: {
    kind: "move" | "resize" | "rotate";
    start: Point;
    original: Point | Platform;
    pointer: number;
  } | null = null;
  const coords = (e: PointerEvent) =>
    screenToWorld(e.clientX, e.clientY, canvas.getBoundingClientRect());
  const rounded = (n: number) =>
    Math.round(n / (snap() ? 10 : 1)) * (snap() ? 10 : 1);
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    canvas.focus();
    const p = coords(e);
    const selected = model.selection;
    if (selected?.kind === "platform") {
      const platform = model.draft.map.platforms[selected.index];
      const handle = rotationHandle(platform);
      if (Math.hypot(p.x - handle.x, p.y - handle.y) < 18) {
        drag = {
          kind: "rotate",
          start: p,
          original: { ...platform },
          pointer: e.pointerId,
        };
      }
      const corner = platformCorners(platform)[2];
      if (!drag && Math.hypot(p.x - corner.x, p.y - corner.y) < 18) {
        drag = {
          kind: "resize",
          start: p,
          original: { ...platform },
          pointer: e.pointerId,
        };
      }
    }
    if (!drag) {
      let index = model.draft.map.spawns.findIndex(
        (s) => Math.hypot(s.x - p.x, s.y - p.y) <= 24,
      );
      if (index >= 0) model.selection = { kind: "spawn", index };
      else {
        index = model.draft.map.platforms
          .map((s) => pointInPlatform(p, s))
          .lastIndexOf(true);
        model.selection = index >= 0 ? { kind: "platform", index } : null;
      }
      const s = model.selection;
      if (s)
        drag = {
          kind: "move",
          start: p,
          original: {
            ...(s.kind === "platform"
              ? model.draft.map.platforms[s.index]
              : model.draft.map.spawns[s.index]),
          },
          pointer: e.pointerId,
        };
    }
    if (drag) {
      model.begin();
      canvas.setPointerCapture(e.pointerId);
    }
    changed();
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const s = model.selection;
    if (!s) return;
    const p = coords(e);
    if (drag.kind === "resize" && s.kind === "platform") {
      const current = model.draft.map.platforms[s.index];
      const local = localPoint(p, drag.original as Platform);
      current.width = Math.max(
        20,
        Math.min(1200, rounded(Math.abs(local.x) * 2)),
      );
      current.height = Math.max(
        10,
        Math.min(400, rounded(Math.abs(local.y) * 2)),
      );
    } else if (drag.kind === "rotate" && s.kind === "platform") {
      const original = drag.original as Platform;
      const current = model.draft.map.platforms[s.index];
      let angle = normalizeAngle(
        original.angle +
          Math.atan2(p.y - original.y, p.x - original.x) -
          Math.atan2(drag.start.y - original.y, drag.start.x - original.x),
      );
      if (snap()) angle = Math.round(angle / (Math.PI / 36)) * (Math.PI / 36);
      const max = current.motion === "seesaw" ? SEESAW_MAX_ANGLE : Math.PI;
      current.angle = Math.max(-max, Math.min(max, angle));
    } else {
      const current =
        s.kind === "platform"
          ? model.draft.map.platforms[s.index]
          : model.draft.map.spawns[s.index];
      current.x = rounded(drag.original.x + p.x - drag.start.x);
      current.y = rounded(drag.original.y + p.y - drag.start.y);
    }
    changed();
  };
  const end = () => {
    if (!drag) return;
    const pointer = drag.pointer;
    drag = null;
    model.commit();
    if (canvas.hasPointerCapture(pointer))
      canvas.releasePointerCapture(pointer);
    changed();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("lostpointercapture", end);
  window.addEventListener("blur", end);
  return () => {
    end();
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", end);
    canvas.removeEventListener("pointercancel", end);
    canvas.removeEventListener("lostpointercapture", end);
    window.removeEventListener("blur", end);
  };
}
export function drawEditor(
  canvas: HTMLCanvasElement,
  model: EditorModel,
  bodies?: BodyView[],
  platforms: PlatformView[] = [],
  energies: EnergyView[] = [],
  mode: GameMode = "classic",
) {
  const rect = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(rect.width * dpr),
    height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(width / 1200, 0, 0, height / 800, 0, 0);
  ctx.clearRect(0, 0, 1200, 800);
  ctx.fillStyle = "#152024";
  ctx.fillRect(0, 0, 1200, 800);
  ctx.strokeStyle = "#293738";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1200; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 800);
    ctx.stroke();
  }
  for (let y = 0; y <= 800; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1200, y);
    ctx.stroke();
  }
  for (const [i, source] of model.draft.map.platforms.entries()) {
    const p = { ...source, ...platforms.find((p) => p.index === i) };
    if (bodies && mode === "classic") p.motion = "fixed";
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = "#40524c";
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    ctx.fillStyle = p.motion === "seesaw" ? "#ffe28c" : "#b8d895";
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, 3);
    ctx.strokeStyle =
      model.selection?.kind === "platform" && model.selection.index === i
        ? "#ccff62"
        : "#657768";
    ctx.lineWidth = 2;
    ctx.strokeRect(-p.width / 2, -p.height / 2, p.width, p.height);
    ctx.restore();
    drawPivot(ctx, p);
    if (
      !bodies &&
      model.selection?.kind === "platform" &&
      model.selection.index === i
    ) {
      const handle = rotationHandle(p);
      ctx.strokeStyle = "#ccff62";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(handle.x, handle.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = "#26382a";
      ctx.fill();
      ctx.stroke();
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ccff62";
      ctx.fillText("↻", handle.x, handle.y);
      const corner = platformCorners(p)[2];
      ctx.fillStyle = "#ccff62";
      ctx.fillRect(corner.x - 7, corner.y - 7, 14, 14);
    }
  }
  for (const energy of energies) drawEnergy(ctx, energy);
  if (!bodies)
    for (const [i, p] of model.draft.map.spawns.entries()) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[i] + "30";
      ctx.fill();
      ctx.strokeStyle = COLORS[i];
      ctx.lineWidth =
        model.selection?.kind === "spawn" && model.selection.index === i
          ? 4
          : 2;
      ctx.stroke();
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS[i];
      ctx.fillText(String(i + 1), p.x, p.y);
    }
  else
    for (const b of bodies) {
      if (!b.alive) continue;
      ctx.fillStyle = "#ccff62";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      if (b.heavy) {
        ctx.strokeStyle = "#ccff62";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#18211d";
      ctx.fillRect(b.x - 8, b.y - 5, 4, 4);
      ctx.fillRect(b.x + 4, b.y - 5, 4, 4);
    }
  ctx.strokeStyle = "#ef9d77";
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(1, 1, 1198, 798);
  ctx.setLineDash([]);
}
