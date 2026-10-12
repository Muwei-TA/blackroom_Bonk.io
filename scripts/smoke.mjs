import assert from "node:assert/strict";
import { WebSocket } from "ws";
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const peers = [];
async function connect() {
  const url = new URL("/ws", base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(url);
  peers.push(ws);
  const inbox = [];
  ws.on("message", (b) => inbox.push(JSON.parse(b.toString())));
  await new Promise((ok, fail) => {
    ws.once("open", ok);
    ws.once("error", fail);
  });
  return {
    ws,
    send: (m) => ws.send(JSON.stringify(m)),
    wait: async (type, predicate = () => true) => {
      const end = Date.now() + 8000;
      while (Date.now() < end) {
        const i = inbox.findIndex((m) => m.type === type && predicate(m));
        if (i >= 0) return inbox.splice(i, 1)[0];
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error(`Timed out waiting for ${type}`);
    },
  };
}
try {
  const health = await fetch(new URL("/healthz", base));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /黑房弹球/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)];
  assert.ok(assets.length >= 2, "production JS and CSS are linked");
  for (const asset of assets)
    assert.equal((await fetch(new URL(asset[1], base))).status, 200);
  const a = await connect(),
    b = await connect();
  const id = (await a.wait("welcome")).playerId;
  a.send({ type: "create", nickname: "Smoke A" });
  const code = (await a.wait("room")).room.code;
  b.send({ type: "join", nickname: "Smoke B", code });
  await b.wait("room");
  a.send({ type: "start" });
  const initial = (await a.wait("snapshot", (m) => m.world.phase === "playing"))
    .world;
  a.send({
    type: "input",
    seq: 1,
    state: { left: true, right: false, jump: false, heavy: false },
  });
  const moved = (await b.wait("snapshot", (m) => m.world.seq > initial.seq + 4))
    .world;
  assert.ok(
    moved.bodies.find((p) => p.id === id).x <
      initial.bodies.find((p) => p.id === id).x,
    "input moves authoritative ball",
  );
  a.send({ type: "leave" });
  assert.equal(
    (
      await b.wait(
        "room",
        (m) => m.room.phase === "lobby" && m.room.players.length === 1,
      )
    ).room.players.length,
    1,
  );
  console.log(
    "PASS: health, HTML, production assets, two-player WebSocket join/start/move/leave",
  );
} finally {
  for (const ws of peers) ws.terminate();
}
