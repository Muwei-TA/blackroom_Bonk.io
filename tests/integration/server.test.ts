import { it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer } from "../../src/server/app";
import type { ServerMessage } from "../../src/shared/protocol";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const c of cleanup.splice(0).reverse()) await c();
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "arena-"));
  await writeFile(join(dir, "index.html"), "<html>arena test</html>");
  const app = createGameServer({ staticDir: dir });
  const port = await app.listen(0, "127.0.0.1");
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  cleanup.push(() => app.close());
  return { app, port, url: `http://127.0.0.1:${port}` };
}
async function client(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  cleanup.push(async () => ws.terminate());
  const inbox: ServerMessage[] = [];
  ws.on("message", (b) => inbox.push(JSON.parse(b.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  const wait = async (
    type: ServerMessage["type"],
    predicate: (m: any) => boolean = () => true,
  ) => {
    const end = Date.now() + 6500;
    while (Date.now() < end) {
      const i = inbox.findIndex((m) => m.type === type && predicate(m));
      if (i >= 0) return inbox.splice(i, 1)[0] as any;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`Timeout waiting ${type}`);
  };
  return { ws, inbox, wait, send: (m: unknown) => ws.send(JSON.stringify(m)) };
}
it("serves health/assets and isolates real two-client simulation", async () => {
  const f = await fixture();
  expect(await (await fetch(f.url + "/healthz")).json()).toEqual({
    status: "ok",
  });
  expect(await (await fetch(f.url)).text()).toContain("arena test");
  expect((await fetch(f.url + "/%2e%2e%2fsecret")).status).toBe(404);
  const a = await client(f.port),
    b = await client(f.port),
    c = await client(f.port);
  const id = (await a.wait("welcome")).playerId;
  a.send({ type: "create", nickname: "A" });
  const code = (await a.wait("room")).room.code;
  b.send({ type: "join", nickname: "B", code });
  await b.wait("room");
  c.send({ type: "create", nickname: "C" });
  await c.wait("room");
  a.send({ type: "start" });
  const before = (await a.wait("snapshot", (m) => m.world.phase === "playing"))
    .world;
  a.send({
    type: "input",
    seq: 1,
    state: { left: false, right: true, jump: false, heavy: false },
  });
  const after = (
    await b.wait(
      "snapshot",
      (m) => m.world.phase === "playing" && m.world.seq > before.seq + 5,
    )
  ).world;
  expect(after.bodies.find((x: any) => x.id === id).x).toBeGreaterThan(
    before.bodies.find((x: any) => x.id === id).x,
  );
  expect(c.inbox.some((m) => m.type === "snapshot")).toBe(false);
  let seq = 2;
  const inputTimer = setInterval(
    () =>
      a.send({
        type: "input",
        seq: seq++,
        state: { left: true, right: false, jump: false, heavy: false },
      }),
    100,
  );
  try {
    const result = await b.wait("room", (m) => m.room.phase === "roundOver");
    expect(result.room.players.find((p: any) => p.id !== id).score).toBe(1);
  } finally {
    clearInterval(inputTimer);
  }
  a.ws.terminate();
  expect(
    (
      await b.wait(
        "room",
        (m) => m.room.phase === "lobby" && m.room.players.length === 1,
      )
    ).room.hostId,
  ).not.toBe(id);
});
it("malformed JSON stays isolated; oversized and flooding clients close", async () => {
  const f = await fixture();
  const a = await client(f.port);
  a.ws.send("{");
  expect((await a.wait("error")).code).toBe("INVALID_MESSAGE");
  a.send({ type: "input", seq: 0, state: {}, id: "spoof" });
  await a.wait("error");
  const closed = new Promise<number>((r) => a.ws.once("close", r));
  a.ws.send("x".repeat(4097));
  expect(await closed).toBe(1009);
  const b = await client(f.port);
  const end = new Promise<number>((r) => b.ws.once("close", r));
  for (let i = 0; i < 80; i++) b.send({ type: "leave" });
  expect(await end).toBe(1008);
  expect((await fetch(f.url + "/healthz")).status).toBe(200);
});
it("closes live connections and releases listening port", async () => {
  const f = await fixture();
  const a = await client(f.port);
  const ended = new Promise((r) => a.ws.once("close", r));
  await f.app.close();
  await ended;
  const second = createGameServer();
  await second.listen(f.port, "127.0.0.1");
  await second.close();
});

it("syncs custom maps to members and later joins, enforces owner/state/rate and isolates rooms", async () => {
  const { toDocument } = await import("../../src/shared/custom-map");
  const { MAPS } = await import("../../src/shared/maps");
  const f = await fixture(),
    a = await client(f.port),
    b = await client(f.port),
    c = await client(f.port),
    d = await client(f.port);
  a.send({ type: "create", nickname: "Owner" });
  const code = (await a.wait("room")).room.code;
  b.send({ type: "join", nickname: "Guest", code });
  await b.wait("room");
  d.send({ type: "create", nickname: "Other" });
  await d.wait("room");
  const document = toDocument(MAPS[0]);
  document.map.name = "朋友的地图";
  b.send({ type: "applyCustomMap", document });
  expect((await b.wait("error")).code).toBe("HOST_ONLY");
  a.ws.send(
    " ".repeat(5000) + JSON.stringify({ type: "applyCustomMap", document }),
  );
  await a.wait("mapApplied");
  const changed = (
    await b.wait("room", (m) => m.room.map?.name === document.map.name)
  ).room;
  expect(changed.map.platforms).toEqual(document.map.platforms);
  c.send({ type: "join", nickname: "Later", code });
  expect((await c.wait("room")).room.map).toEqual(changed.map);
  expect(
    d.inbox.some(
      (m) => m.type === "room" && m.room.map.name === document.map.name,
    ),
  ).toBe(false);
  a.send({ type: "applyCustomMap", document });
  expect((await a.wait("error")).code).toBe("MAP_RATE_LIMIT");
  a.send({ type: "start" });
  await a.wait("snapshot", (m) => m.world.phase === "playing");
  a.send({ type: "applyCustomMap", document });
  expect((await a.wait("error")).code).toBe("IN_PROGRESS");
});
it("invalid maps do not replace existing map and oversized frames close", async () => {
  const { toDocument } = await import("../../src/shared/custom-map");
  const { MAPS } = await import("../../src/shared/maps");
  const f = await fixture(),
    a = await client(f.port),
    b = await client(f.port);
  a.send({ type: "create", nickname: "A" });
  const code = (await a.wait("room")).room.code;
  const document = toDocument(MAPS[0]);
  document.map.spawns[0] = { x: 600, y: 560 };
  a.send({ type: "applyCustomMap", document });
  expect((await a.wait("error")).message).toContain("出生点");
  b.send({ type: "join", nickname: "B", code });
  expect((await b.wait("room")).room.map.id).toBe("origin");
  const closed = new Promise<number>((r) => a.ws.once("close", r));
  a.ws.send(" ".repeat(32769));
  expect(await closed).toBe(1009);
});
