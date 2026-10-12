import { RADIUS, COLORS } from "../shared/constants";
import type { MapDefinition } from "../shared/maps";
import type { BodyView, PlayerView } from "../shared/protocol";
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  map: MapDefinition,
  bodies: BodyView[],
  players: PlayerView[] = [],
  selfId = "",
) {
  const canvas = ctx.canvas;
  const w = canvas.clientWidth,
    h = canvas.clientHeight,
    dpr = Math.min(devicePixelRatio || 1, 2);
  if (
    canvas.width !== Math.round(w * dpr) ||
    canvas.height !== Math.round(h * dpr)
  ) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const s = Math.min(w / 1400, h / 1000);
  ctx.translate(w / 2 - 600 * s, h / 2 - 360 * s);
  ctx.scale(s, s);
  ctx.fillStyle = "#333c40";
  for (let x = -80; x < 1300; x += 40)
    for (let y = -100; y < 850; y += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.strokeStyle = "#ccff6212";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(600, 360, 270, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(600, 360, 350, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "600 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#586263";
  ctx.fillText("BLACKROOM  /  ARENA", 600, 140);
  for (const p of map.platforms) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = "#0b0f13";
    ctx.fillRect(-p.width / 2 + 7, -p.height / 2 + 9, p.width, p.height);
    ctx.fillStyle = "#39474a";
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    ctx.fillStyle = "#b8d895";
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, 4);
    ctx.strokeStyle = "#566766";
    ctx.strokeRect(-p.width / 2, -p.height / 2, p.width, p.height);
    ctx.restore();
  }
  for (const [index, b] of bodies.entries()) {
    if (!b.alive) continue;
    const player = players.find((p) => p.id === b.id);
    const color = player?.color ?? COLORS[index % COLORS.length];
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.heavy) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, RADIUS + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.shadowBlur = 18;
    ctx.shadowColor = color + "50";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#18201d";
    ctx.beginPath();
    ctx.arc(-6, -3, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#18201d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 1, 7, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.font = "500 14px sans-serif";
    ctx.fillStyle = "#e9eee9";
    ctx.fillText(player?.nickname ?? "", 0, -42);
    if (b.id === selfId) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-5, -65);
      ctx.lineTo(5, -65);
      ctx.lineTo(0, -58);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.setLineDash([7, 8]);
  ctx.strokeStyle = "#fa8b7455";
  ctx.beginPath();
  ctx.moveTo(-100, 870);
  ctx.lineTo(1300, 870);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ad766e";
  ctx.font = "12px sans-serif";
  ctx.fillText("掉出场地即淘汰", 600, 900);
}
export function drawMapPreview(canvas: HTMLCanvasElement, map: MapDefinition) {
  const ctx = canvas.getContext("2d")!;
  canvas.width = 300;
  canvas.height = 110;
  ctx.clearRect(0, 0, 300, 110);
  ctx.fillStyle = "#819485";
  for (const p of map.platforms) {
    ctx.save();
    ctx.translate(p.x / 4, (p.y - 280) / 4);
    ctx.rotate(p.angle);
    ctx.fillRect(-p.width / 8, -p.height / 8, p.width / 4, p.height / 4);
    ctx.restore();
  }
  ctx.fillStyle = "#ccff62";
  ctx.beginPath();
  ctx.arc(map.spawns[0].x / 4, (map.spawns[0].y - 280) / 4, 5, 0, 7);
  ctx.fill();
}
