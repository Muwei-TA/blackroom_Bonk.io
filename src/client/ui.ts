import { MAPS, getMap } from "../shared/maps";
import { openWorkshop } from "./editor/workshop";
import type {
  ClientMessage,
  ServerMessage,
  RoomView,
  WorldSnapshot,
  BodyView,
} from "../shared/protocol";
import { SnapshotBuffer } from "./interpolation";
import { renderFrame, drawMapPreview } from "./renderer";
export function mountUi(root: HTMLElement, send: (m: ClientMessage) => void) {
  root.innerHTML = `
 <header class="topbar"><a class="brand" href="/" aria-label="黑房弹球首页"><span class="brand-mark">b<span>•</span></span><span>BLACKROOM<small>黑房弹球</small></span></a><div class="top-links"><button id="open-workshop" class="workshop-link">地图工坊</button><span class="edition">物理碰撞 · 朋友对战</span><span id="connection" class="connection">连接中</span></div></header>
 <main>
 <section id="home" class="home">
 <div class="hero"><div class="eyebrow"><span></span> GOOD FRIENDS. GREAT COLLISIONS.</div><h1>把快乐，<br><em>撞出来。</em></h1><p class="hero-copy">小小的球，大大的胜负欲。<br>叫上朋友，留在场上，成为最后的赢家。</p>
 <div class="hero-scene" aria-hidden="true"><span class="scene-label">物理法则在线，友谊暂时下线。</span><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-ball ball-lime"><i></i><i></i><b></b></div><div class="hero-ball ball-purple"><i></i><i></i><b></b></div><div class="impact">✦</div><div class="hero-platform"></div><div class="scene-coordinate">ARENA_01 <span>↗</span></div></div>
 <div class="hero-tags"><span><b>02–08</b> 位朋友</span><span><b>05</b> 回合制胜</span><span><b>∞</b> 次快乐碰撞</span></div></div>
 <aside class="entry-panel"><div class="panel-heading"><span class="small-label">LET'S PLAY</span><span class="tiny-cross">✳</span></div><h2>朋友到齐，就开场。</h2><p class="muted">无需注册，为自己取个名字吧。</p>
 <label for="nickname">你的昵称<span>最多 20 个字符</span></label><div class="input-wrap"><span class="avatar-mini">◡</span><input id="nickname" maxlength="40" placeholder="今天你叫什么？" autocomplete="nickname"></div>
 <button id="create" class="button primary" disabled>创建房间 <span aria-hidden="true">↗</span></button><p class="field-hint">创建专属房间，邀请朋友加入</p>
 <div class="separator"><span>或加入朋友的房间</span></div><label for="code">房间码</label><div class="join-row"><input id="code" maxlength="8" placeholder="6 位房间码" autocomplete="off" spellcheck="false"><button id="join" class="button secondary" disabled>加入房间</button></div>
 <div class="entry-note"><span>◎</span><p>同一个房间，同一份快乐。<br><small>推荐使用电脑与键盘游玩</small></p></div></aside>
 </section>
 <section id="room" class="room-layout" hidden>
 <div class="arena-column"><div class="arena-heading"><div><div class="eyebrow">PRIVATE ARENA</div><h2 data-testid="map-name" id="map-name">起点站</h2></div><div class="round-pill"><span id="round-label">自由准备</span><b id="timer">—</b></div></div>
 <div class="arena"><div class="arena-top"><span class="status-dot"></span><span id="phase" data-testid="phase">等待朋友加入</span><span class="first-to">先赢 5 回合获胜</span></div><canvas id="arena-canvas" aria-label="实时物理对战场地"></canvas><div id="overlay" class="arena-overlay"><b id="overlay-title"></b><p id="overlay-subtitle"></p></div><div class="arena-bottom"><span id="self-status" data-testid="self-status">等待开场</span><span>稳住，别掉下去。</span></div></div>
 <div class="arena-tip"><span>↳</span><p id="notice">邀请朋友，开始一场友好的较量。</p></div>
 </div>
 <aside class="room-sidebar"><div class="room-code-box"><span class="small-label">你的专属房间</span><div class="code-line"><strong id="room-code" data-testid="room-code"></strong><button id="copy" class="icon-button" aria-label="复制房间码">⧉</button></div><p class="muted">把房间码发给朋友，一起入场</p></div>
 <div class="roster-heading"><h3>场上好友</h3><span id="player-count">1 / 8</span></div><ul id="players" data-testid="players"></ul>
 <div class="map-heading"><h3>选择竞技场</h3><span>房主设置</span></div><div id="map-options" class="map-options"></div>
 <button id="custom-map" class="button secondary custom-map-button">自定义地图</button>
 <button id="start" class="button primary">开始比赛</button><button id="rematch" class="button primary" hidden>返回准备页</button><p id="start-hint" class="field-hint">至少 2 人即可开始</p><button id="leave" class="leave-button">离开房间</button></aside>
 </section>
 <section class="howto"><div class="howto-title"><span class="small-label">HOW TO BONK</span><h3>三步上手，碰个痛快。</h3></div><div class="control-item"><div class="keys"><kbd>A</kbd><kbd>D</kbd><span>/</span><kbd>←</kbd><kbd>→</kbd></div><b>左右移动</b><p>找准位置，蓄势出击</p></div><div class="control-item"><div class="keys"><kbd>W</kbd><span>/</span><kbd>↑</kbd></div><b>跳跃</b><p>落地后再次起跳</p></div><div class="control-item"><div class="keys"><kbd class="space-key">SPACE</kbd></div><b>加重防御</b><p>按住变重，稳住别掉</p></div></section>
 </main><footer><span>BLACKROOM <span class="footer-divider">/</span> 为一起玩的时光而造</span><span>保持轻松，别掉下去。 <b>↗</b></span></footer>
 <div id="error" class="toast" role="alert" hidden></div><div id="disconnected" class="disconnect-cover" hidden><div><span class="small-label">CONNECTION LOST</span><h2>连接暂时断开</h2><p>本场身份不会保留，重新连接后可再次加入。</p><button class="button primary" id="reconnect">返回首页并重连</button></div></div>`;
  const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>("#" + id)!;
  let room: RoomView | null = null,
    selfId = "",
    connected = false,
    world: WorldSnapshot | null = null,
    receivedAt = 0,
    raf = 0,
    errorTimer: ReturnType<typeof setTimeout> | undefined;
  const buffer = new SnapshotBuffer();
  let workshop: ReturnType<typeof openWorkshop> | null = null;
  const launchWorkshop = () => {
    if (workshop) return;
    window.dispatchEvent(new Event("blur"));
    workshop = openWorkshop(root, {
      initial: room?.map ?? MAPS[0],
      canApply: () =>
        connected && room?.hostId === selfId && room?.phase === "lobby",
      apply: (document) => send({ type: "applyCustomMap", document }),
      close: () => {
        workshop = null;
        if (!connected) el("disconnected").hidden = false;
      },
    });
  };
  el("open-workshop").onclick = launchWorkshop;
  el("custom-map").onclick = launchWorkshop;
  const error = (message: string) => {
    el("error").textContent = message;
    el("error").hidden = false;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => (el("error").hidden = true), 6000);
  };
  const nickname = () => {
    const value = el<HTMLInputElement>("nickname").value.trim();
    if (!value || [...value].length > 20) {
      error("请输入 1–20 个字符的昵称");
      return null;
    }
    return value;
  };
  el("create").onclick = () => {
    const n = nickname();
    if (n) send({ type: "create", nickname: n });
  };
  el("join").onclick = () => {
    const n = nickname(),
      code = el<HTMLInputElement>("code").value.trim().toUpperCase();
    if (!n) return;
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      error("请输入 6 位房间码");
      return;
    }
    send({ type: "join", nickname: n, code });
  };
  el("start").onclick = () => send({ type: "start" });
  el("rematch").onclick = () => send({ type: "rematch" });
  el("leave").onclick = () => send({ type: "leave" });
  el("reconnect").onclick = () => location.reload();
  el("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(room?.code ?? "");
      error("房间码已复制，发给朋友吧");
    } catch {
      error("请手动选择并复制房间码");
    }
  };
  for (const map of MAPS) {
    const button = document.createElement("button");
    button.className = "map-card";
    button.dataset.map = map.id;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    button.append(canvas);
    const text = document.createElement("span");
    text.textContent = map.name;
    button.append(text);
    button.title = map.subtitle;
    button.onclick = () => send({ type: "selectMap", mapId: map.id });
    el("map-options").append(button);
    drawMapPreview(canvas, map);
  }
  function renderRoom() {
    el("home").hidden = !!room;
    el("room").hidden = !room;
    if (!room) return;
    el("error").hidden = true;
    el("room-code").textContent = room.code;
    el("map-name").textContent = room.map.name;
    el("player-count").textContent = `${room.players.length} / 8`;
    el("notice").textContent = room.notice;
    el("round-label").textContent =
      room.phase === "lobby"
        ? "自由准备"
        : `ROUND ${String(room.round).padStart(2, "0")}`;
    el("phase").textContent = {
      lobby: "等待朋友加入",
      countdown: "准备开场",
      playing: "对战进行中",
      roundOver: "回合结算",
      matchOver: "比赛结束",
    }[room.phase];
    el("players").replaceChildren();
    for (const player of room.players) {
      const li = document.createElement("li");
      const avatar = document.createElement("span");
      avatar.className = "player-avatar";
      avatar.style.setProperty("--ball", player.color);
      avatar.textContent = "◡";
      const name = document.createElement("span");
      name.className = "player-name";
      name.textContent = player.nickname;
      const tag = document.createElement("small");
      tag.textContent =
        player.id === selfId
          ? "你"
          : player.id === room.hostId
            ? "房主"
            : "已加入";
      if (player.id === selfId && player.id === room.hostId)
        tag.textContent = "你 · 房主";
      name.append(tag);
      const score = document.createElement("b");
      score.textContent = `${player.score} 分`;
      li.append(avatar, name, score);
      el("players").append(li);
    }
    const host = room.hostId === selfId,
      lobby = room.phase === "lobby";
    el<HTMLButtonElement>("custom-map").disabled =
      !connected || !host || !lobby;
    el<HTMLButtonElement>("start").disabled =
      !connected || !host || !lobby || room.players.length < 2;
    el("start").hidden = room.phase === "matchOver";
    el("rematch").hidden = room.phase !== "matchOver";
    el<HTMLButtonElement>("rematch").disabled = !host;
    el("start-hint").textContent = !host
      ? "等待房主开始比赛"
      : room.players.length < 2
        ? "再来一位朋友，就能开场"
        : "人齐了？随时开始";
    for (const button of el("map-options").querySelectorAll<HTMLButtonElement>(
      "button",
    )) {
      button.disabled = !host || !lobby;
      button.classList.toggle("selected", button.dataset.map === room.mapId);
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.map === room.mapId),
      );
    }
    if (lobby) {
      buffer.clear();
      world = null;
    }
  }
  function frame() {
    if (room) {
      const map = room.map;
      const bodies: BodyView[] =
        room.phase === "lobby"
          ? room.players.map((p, i) => ({
              id: p.id,
              ...map.spawns[i],
              angle: 0,
              heavy: false,
              alive: true,
              radius:20,energy:0,mass:0,
            }))
          : buffer.sample(
              (world?.serverTime ?? 0) + (performance.now() - receivedAt) - 100,
            );
      renderFrame(
        el<HTMLCanvasElement>("arena-canvas").getContext("2d")!,
        map,
        bodies,
        room.players,
        selfId,
      );
      const self = bodies.find((b) => b.id === selfId);
      el("self-status").textContent =
        room.phase === "lobby"
          ? "等待开场"
          : self && !self.alive
            ? "你已出局 · 观战中"
            : self?.heavy
              ? "加重防御"
              : "轻装出击";
      const remaining = Math.max(
        0,
        (world?.remainingMs ?? 0) - (performance.now() - receivedAt),
      );
      el("timer").textContent =
        room.phase === "playing" ? `${Math.ceil(remaining / 1000)}s` : "—";
      const overlay = el("overlay");
      overlay.hidden = room.phase === "playing";
      const winner =
        room.players.find((p) => p.id === room!.winnerId)?.nickname ?? "";
      el("overlay-title").textContent =
        room.phase === "lobby"
          ? "就等你们了"
          : room.phase === "countdown"
            ? String(Math.max(1, Math.ceil(remaining / 1000)))
            : room.phase === "matchOver"
              ? `${winner} 赢了！`
              : room.winnerId
                ? `${winner} +1`
                : "本轮平局";
      el("overlay-subtitle").textContent =
        room.phase === "lobby"
          ? "分享房间码，邀请朋友进入竞技场"
          : room.phase === "countdown"
            ? "准备碰撞！"
            : room.phase === "matchOver"
              ? "五场胜利，一位冠军。再来一局？"
              : "稍作休息，下一轮马上开始";
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    update(m: ServerMessage) {
      if (m.type === "welcome") {
        selfId = m.playerId;
        connected = true;
        el("connection").textContent = "已连接";
        el("connection").classList.add("online");
        el<HTMLButtonElement>("create").disabled = false;
        el<HTMLButtonElement>("join").disabled = false;
      } else if (m.type === "mapApplied") workshop?.applied();
      else if (m.type === "error") {
        error(m.message);
        workshop?.failed(m.message);
      } else if (m.type === "room") {
        if (room?.code !== m.room.code || room?.map.id !== m.room.map.id) {
          buffer.clear();
          world = null;
        }
        room = m.room;
        renderRoom();
        workshop?.refresh();
      } else if (m.type === "left") {
        room = null;
        world = null;
        buffer.clear();
        renderRoom();
      } else if (m.type === "snapshot" && room) {
        if (world && m.world.seq <= world.seq) return;
        world = m.world;
        receivedAt = performance.now();
        buffer.push(world);
      }
    },
    disconnected() {
      connected = false;
      el("connection").textContent = "已断开";
      el("connection").classList.remove("online");
      el("disconnected").hidden = !!workshop;
      for (const b of root.querySelectorAll<HTMLButtonElement>("button"))
        if (
          b.id !== "reconnect" &&
          !b.closest(".workshop") &&
          b.id !== "open-workshop"
        )
          b.disabled = true;
      workshop?.failed("连接已断开，你仍可保存或导出本地作品。");
    },
    dispose() {
      workshop?.dispose();
      cancelAnimationFrame(raf);
      clearTimeout(errorTimer);
    },
    isEditing() {
      return !!workshop;
    },
    isPlaying() {
      return !workshop && room?.phase === "playing";
    },
  };
}
