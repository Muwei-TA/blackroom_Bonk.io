import type { Platform } from "../shared/maps";
import type { EnergyView } from "../shared/protocol";
export function drawEnergy(ctx: CanvasRenderingContext2D, energy: EnergyView) {
  ctx.save();
  ctx.translate(energy.x, energy.y);
  ctx.shadowColor = "#ffe28c";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffe28c";
  ctx.strokeStyle = "#fff6d4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(9, 0);
  ctx.lineTo(0, 12);
  ctx.lineTo(-9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#8d6526";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.lineTo(-3, 1);
  ctx.lineTo(3, 1);
  ctx.lineTo(-2, 6);
  ctx.stroke();
  ctx.restore();
}
export function drawPivot(ctx: CanvasRenderingContext2D, p: Platform) {
  if (p.motion !== "seesaw") return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "#725b36";
  ctx.strokeStyle = "#ffe28c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(-15, 31);
  ctx.lineTo(15, 31);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe28c";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
