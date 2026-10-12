import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { parseClientMessage, type ServerMessage } from "../shared/protocol";
import { STEP_MS } from "../shared/constants";
import { RoomManager } from "./rooms";
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
/** Bound outgoing queues so a slow peer cannot accumulate unlimited snapshots. */
export function sendBounded(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > 1024 * 1024) {
    ws.terminate();
    return;
  }
  ws.send(JSON.stringify(message));
}
export function createGameServer(options: { staticDir?: string } = {}) {
  const root = resolve(options.staticDir ?? "dist/client");
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url ?? "/", "http://localhost").pathname,
      );
      if (pathname === "/healthz") {
        res
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify({ status: "ok" }));
        return;
      }
      const path = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      const data = await readFile(path);
      res
        .writeHead(200, {
          "Content-Type": mime[extname(path)] ?? "application/octet-stream",
          "Cache-Control": pathname.startsWith("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        })
        .end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4096,
    perMessageDeflate: false,
  });
  const peers = new Map<string, WebSocket>();
  const rooms = new RoomManager((id, m) => {
    const ws = peers.get(id);
    if (ws) sendBounded(ws, m);
  });
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws") {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  const alive = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    const id = randomUUID();
    peers.set(id, ws);
    alive.add(ws);
    rooms.connect(id);
    let windowStart = performance.now(),
      count = 0;
    ws.on("pong", () => alive.add(ws));
    ws.on("error", () => {}); // ws emits an error before closing an oversized frame.
    ws.on("message", (data, binary) => {
      const now = performance.now();
      if (now - windowStart >= 1000) {
        windowStart = now;
        count = 0;
      }
      if (++count > 60) {
        ws.close(1008, "Message rate exceeded");
        return;
      }
      try {
        if (binary) throw new Error("binary");
        rooms.handle(id, parseClientMessage(JSON.parse(data.toString())));
      } catch {
        sendBounded(ws, {
          type: "error",
          code: "INVALID_MESSAGE",
          message: "消息格式无效，请检查昵称、房间码或刷新页面",
        });
      }
    });
    ws.on("close", () => {
      alive.delete(ws);
      peers.delete(id);
      rooms.disconnect(id);
    });
  });
  let last = performance.now(),
    accumulator = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    accumulator += now - last;
    last = now;
    let steps = 0;
    while (accumulator >= STEP_MS && steps++ < 5) {
      rooms.tick(now - accumulator + STEP_MS);
      accumulator -= STEP_MS;
    }
    if (accumulator >= STEP_MS) {
      console.warn("Simulation behind; discarded excess catch-up time");
      accumulator = 0;
    }
  }, STEP_MS);
  const heartbeat = setInterval(() => {
    for (const ws of peers.values()) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }, 15000);
  let closed: Promise<void> | null = null;
  return {
    listen: (port: number, host = "0.0.0.0") =>
      new Promise<number>((ok, fail) => {
        server.once("error", fail);
        server.listen(port, host, () => {
          server.off("error", fail);
          ok((server.address() as { port: number }).port);
        });
      }),
    close: () =>
      (closed ??= new Promise<void>((ok) => {
        clearInterval(timer);
        clearInterval(heartbeat);
        rooms.dispose();
        for (const ws of peers.values()) ws.terminate();
        wss.close();
        server.close(() => ok());
        server.closeAllConnections();
      })),
  };
}
