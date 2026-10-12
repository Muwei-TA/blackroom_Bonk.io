# 黑房弹球 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 交付可通过 Docker Compose 启动、朋友使用房间码参与的 2–8 人浏览器物理竞技游戏。

**Architecture:** Node.js 管理房间并使用 Matter.js 权威模拟，WebSocket 传输输入和快照。浏览器使用 Canvas 插值绘制，Vite 构建前端，生产由一个 Node.js 服务提供页面、健康检查及 WebSocket。

**Tech Stack:** Node.js 22、TypeScript、npm、Matter.js、ws、Vite、Vitest、Playwright、Docker Compose。

**Spec:** `docs/superpowers/specs/2026-10-12-blackroom-design.md`（已由用户确认）。

## Global Constraints

- 朋友通过房间码进行 2–8 人对战，电脑键盘操作，无需账号。
- 使用原创名称、画面和地图，中文界面；不包含账号、匹配、聊天或持久化。
- 服务端使用 Matter.js，固定 60 Hz 更新物理世界；服务器每秒广播 20 次世界快照。
- 单轮最多 90 秒；倒计时三秒；结算停留三秒；先赢五轮者赢得比赛。
- 房间最多八人，服务器默认最多一百个活跃房间。
- 昵称去除首尾空白，限制为 1–20 个字符，按纯文本显示。
- 限制消息大小为 4 KiB、每连接每秒最多 60 条应用消息。
- 固定 Node.js 22 大版本，提交 npm 锁文件，安装使用 `npm ci`。
- 默认端口为 3000，可通过 `PORT` 配置；不需要外部服务或凭据。
- 云任务复用当前隔离环境和检出目录，不另建 Git worktree。
- 工作目录 `/workspace/blackroom_Bonk.io`，在现有 `work` 分支进行阶段提交；不自动推送远程或部署外部服务器。

## Review Focus

1. 房间码带空白或小写：规范化后可加入；陌生或非法消息不得造成进程退出（任务 1、3）。
2. 按住跳跃、窗口失焦或输入停止：不能无限空中跳跃或永久移动（任务 2、4）。
3. 同一步全部掉落、倒计时期间离开、结束时房主离开：不误加分，能继续操作或返回准备页（任务 2、3）。
4. 上一轮延迟到达的快照：不得覆盖新回合状态或插值产生跨地图飞跃（任务 4）。
5. 慢客户端、重复退出及关闭服务：不无限积压发送，不泄漏房间、实体和计时器（任务 3、5）。

---

## 文件结构与公共契约

- `src/shared/protocol.ts`：消息、错误码、玩家/房间/世界快照类型及解析。
- `src/shared/constants.ts`：时间、容量、输入与物理参数。
- `src/shared/maps.ts`：三张地图、平台、出生点及边界。
- `src/server/physics.ts`：Matter.js 世界与玩家实体；`match.ts`：回合状态机；`rooms.ts`：成员及房主权限。
- `src/server/app.ts`：可测试 HTTP/WebSocket 服务工厂；`index.ts`：启动、信号和进程生命周期。
- `src/client/network.ts`、`input.ts`、`interpolation.ts`、`renderer.ts`、`ui.ts`、`main.ts`、`style.css`：连接、键盘、缓冲、绘制、中文界面和入口。
- `tests/unit/`、`tests/integration/`、`tests/e2e/`：纯逻辑、真实连接和浏览器验收；测试控制接口仅在测试代码中存在，不加入网络协议。
- 根目录：npm/TypeScript/Vite/Vitest/Playwright 配置、`index.html`、`.nvmrc`、忽略文件、Dockerfile、`compose.yaml`、`.env.example` 和中文 README。

跨模块类型统一放在 `protocol.ts`：`InputState = {left:boolean,right:boolean,jump:boolean,heavy:boolean}`；玩家标识为字符串；`RoomPhase = 'lobby'|'countdown'|'playing'|'roundOver'|'matchOver'`。

`PlayerView` 含 `id,nickname,color,score`；`BodyView` 含 `id,x,y,angle,heavy,alive`。`RoomView` 含 `code,hostId,mapId,phase,round,players,winnerId,notice`；`WorldSnapshot` 含 `seq,serverTime,round,phase,remainingMs,bodies`。

客户端消息：`create {nickname}`、`join {nickname,code}`、`selectMap {mapId}`、`start`、`rematch`、`leave`、`input {seq,state}`。服务端消息：`welcome {playerId}`、`room {room}`、`snapshot {world}`、`left`、`error {code,message}`。所有消息使用 `type` 判别字段。客户端不能提供可信玩家 ID 或模拟状态。

## Task 1: 建立可验证的协议与工程基础

**Files:** 创建根目录工程配置、`src/shared/{protocol,constants,maps}.ts` 和 `tests/unit/{protocol,maps}.test.ts`。

**Interfaces:** 导出上述类型；`parseClientMessage(value: unknown): ClientMessage`（错误抛出 `ProtocolError`）；`normalizeRoomCode(value:string):string`；`MAPS: readonly MapDefinition[]`；`getMap(id:string):MapDefinition`。地图定义含 `id,name,platforms,spawns,bounds`，平台含中心、尺寸和角度，出生点含 `x,y`。

- [x] 检查已有文件、Git 状态、版本管理器和 Docker 服务状态，使用可用版本管理器激活 Node.js 22；缺失时通过保留 TLS/校验的官方安装方式准备该版本。确认 `node --version` 为 v22。
- [x] 建立 ESM TypeScript 工程及测试配置，安装兼容 Node.js 22 的依赖，保存锁文件。命令约定：`dev`、`typecheck`、`test`、`test:e2e`、`build`、`start`。`build` 使用 Vite 输出 `dist/client`，esbuild 将服务端打包到 `dist/server/index.js` 并外置生产依赖；类型检查独立运行。
- [x] 先写失败测试，断言 `normalizeRoomCode(' ab23cd ') === 'AB23CD'`，解析含未知类型、额外身份字段、负数/非整数序号、非布尔输入和超长昵称时抛错；合法昵称修剪后通过。断言地图恰好三张，每张八个互不重叠且在边界内的出生点，地图 ID 唯一。
- [x] 运行 `npm test -- tests/unit/protocol.test.ts tests/unit/maps.test.ts`，确认测试因缺失实现失败；实现解析、常量和宽平台/阶梯/斜坡地图，再运行相同命令及 `npm run typecheck`，均应通过。
- [x] 提交 `chore: establish typed game protocol and project tooling`，不提交依赖目录或构建输出。

## Task 2: 实现权威物理和比赛状态机

**Files:** 创建 `src/server/{physics,match}.ts`、`tests/unit/{physics,match}.test.ts`。

**Interfaces:** `PhysicsWorld(map:MapDefinition, playerIds:string[])` 提供 `setInput(id:string,state:InputState):void`、`removePlayer(id:string):void`、`step():void`、`snapshot():BodyView[]`、`dispose():void`。`Match(map:MapDefinition,playerIds:string[])` 提供 `phase,round,scores,winnerId`、`start():void`、`setInput(id:string,seq:number,state:InputState,nowMs:number):void`、`removePlayer(id:string):void`、`tick(nowMs:number):void`、`snapshot(seq:number,nowMs:number):WorldSnapshot`、`dispose():void`；使用单调时间，物理步长固定 1000/60 毫秒。

- [x] 先写物理失败测试：落地后跳跃得到向上的速度变化；连续持有跳跃不产生空中二次跳跃；加重质量大于普通质量、移动加速度更低且释放后恢复；两球接触产生碰撞响应；越界玩家 `alive === false` 且输入不能复活。三张地图各模拟八名静止玩家，确认有效出生并可落地。
- [x] 运行 `npm test -- tests/unit/physics.test.ts` 确认缺失实现失败。实现真实碰撞接触法线判定、按下沿跳跃、密度切换、静态平台和边界淘汰；重跑至通过。测试使用真实 Matter.js 世界，不仅 mock 物理调用。
- [x] 先写比赛失败测试：三秒倒计时后开始；单个存活者得一分；同时全灭/90 秒多人存活为零分平局；三秒结算后换轮；第五分进入 `matchOver`；人数少于二人返回 lobby 且清分；旧序号被忽略，输入超过一秒失效。用注入时钟与可控模拟边界驱动测试，禁止生产作弊消息。
- [x] 运行 `npm test -- tests/unit/match.test.ts` 确认失败。实现状态机，批量处理同一步淘汰后再结算；每轮重建世界，回合号递增。重跑两个文件和类型检查，全部通过。
- [x] 提交 `feat: implement authoritative physics and round scoring`。

## Task 3: 实现房间与真实 WebSocket 联机

**Files:** 创建 `src/server/{rooms,app,index}.ts`、`tests/unit/rooms.test.ts`、`tests/integration/server.test.ts`。

**Interfaces:** `RoomManager` 提供 `connect(id:string):void`、`handle(id:string,message:ClientMessage):void`、`disconnect(id:string):void`、`tick(nowMs:number):void`、`dispose():void`，构造时注入 `send(id:string,message:ServerMessage):void`、时钟和 ID 生成器。`createGameServer(options?:{staticDir?:string}):{listen(port:number,host?:string):Promise<number>,close():Promise<void>}` 支持端口 0，测试获得实际端口。

- [x] 先写房间失败测试：六位码冲突会重新生成；容量 8 人/100 房限制；非房主不能选图/开始/重开；不足两人不能开始；开赛后不能加入；同连接不能重复占房；房主离开移交最早成员；倒计时/结算/结束时离开均正确；重复断线幂等，空房清理。运行 `npm test -- tests/unit/rooms.test.ts` 记录预期失败，然后实现房间管理并跑通。
- [x] 先写真实连接失败测试：两个 `ws` 客户端创建和加入同房，开始后收到递增快照，发送移动输入后位置发生变化；其他房间收不到该房间成员或状态；无效 JSON/字段产生错误且服务仍响应；超过 4 KiB 断开；持续超过每秒 60 条断开；慢连接超过 1 MiB 发送缓冲即终止；退出和关闭清理资源。
- [x] 运行 `npm test -- tests/integration/server.test.ts` 确认失败。实现 `/ws`、客户端身份绑定、协议错误处理和限流；每 15 秒 ping，未响应下一次检查时断开；60 Hz 固定步模拟、20 Hz 快照广播。限制单次追赶步数为五，记录落后状态而不无限阻塞事件循环。
- [x] 同时实现 `/healthz` 返回 `200 {status:'ok'}`、安全静态路径解析、未知路由 404、合法 `PORT` 校验和 SIGTERM 清理。通过测试断言路径穿越不能读取静态目录外文件、健康检查可用、`close()` 后端口可复用。
- [x] 执行 `npm test -- tests/unit/rooms.test.ts tests/integration/server.test.ts` 及类型检查，全通过后提交 `feat: add isolated multiplayer rooms and websocket server`。

## Task 4: 实现中文浏览器游戏与双客户端验收

**Files:** 创建 `index.html`、`src/client/` 全部模块、`tests/unit/{input,interpolation}.test.ts`、`tests/e2e/game.spec.ts`、`playwright.config.ts`，完善 `vite.config.ts`。

**Interfaces:** `connect(onMessage:(message:ServerMessage)=>void,onClose:()=>void):{send(message:ClientMessage):void,close():void}`；`bindInput(target:Window,onInput:(state:InputState)=>void):()=>void`；`SnapshotBuffer.push(snapshot:WorldSnapshot):void`、`sample(serverTime:number):BodyView[]`；`renderFrame(ctx:CanvasRenderingContext2D,map:MapDefinition,bodies:BodyView[]):void`；`mountUi(root:HTMLElement,send:(message:ClientMessage)=>void):{update(message:ServerMessage):void,disconnected():void,dispose():void}`。

- [x] 先写输入和插值失败测试：W/上方向键跳跃，空格加重，S 无效果；失焦/隐藏清空；序号倒退快照被丢弃，新回合清空插值缓冲；两帧中点得到位置中值，不外推越过最新帧。运行对应 unit 测试，确认失败后实现并跑通。
- [x] 实现中文首页、房间卡片、地图选择、玩家颜色标识、倒计时、比分、回合结算和最终胜者。采用深色竞技场、醒目彩色圆球和明确焦点状态；原创 Canvas 几何画面，无外部素材依赖。昵称使用文本节点；错误提示使用可读中文与 `aria-live`。
- [x] 连接使用同源 WS/WSS；输入 30 Hz 更新并递增序号；以快照时间估计服务器时钟，使用约 100 毫秒插值缓冲。Canvas 自适应容器和 DPR，所有地图统一可见；淘汰者继续观看。页面断线禁用操作并提供首页入口，新连接不恢复旧身份。
- [x] 建立 Playwright 两个独立 browser context 的验收：输入昵称、创建/加入、拒绝非房主开始、房主选图并开局、键盘移动、按空格显示加重、比分与淘汰提示、离开后回到准备页；错误房间码有中文提示；`<img ...>` 昵称显示为文本；无未处理 console/page 错误。浏览器游戏计分场景通过真实移动越界，不添加调试网络入口。
- [x] 运行 `npm run dev -- --host 0.0.0.0` 的实际开发流程，验证代理；运行 `npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`，浏览器截图保存在忽略的验收产物目录。检查截图的布局、文字和场地可见性，修复发现的问题。
- [x] 提交 `feat: deliver browser arena and multiplayer user flow`。

## Task 5: Docker 部署、可复用云配置与交付

**Files:** 创建 `Dockerfile`、`.dockerignore`、`compose.yaml`、`.env.example`、`README.md`、`scripts/smoke.mjs`，完善 `.gitignore`。

**Interfaces:** `node scripts/smoke.mjs` 使用非敏感 `BASE_URL`（默认 `http://127.0.0.1:3000`），探测健康检查、页面和两条真实 WebSocket 连接，验证创建/加入/开赛/移动/退出；失败非零退出，并始终关闭连接。

- [x] 编写 smoke 脚本，在无服务时确认非零退出。运行 `npm ci` 确认锁文件可复现，再构建并 `npm start`；脚本应成功，终止服务后进程、端口和计时器应释放。静态页面必须引用可获取的构建资源。
- [x] 编写 Node.js 22 多阶段 Dockerfile，构建阶段执行 `npm ci` 和 `npm run build`，运行阶段只保留生产依赖及 dist，使用 `USER node` 与 exec 形式启动。Compose 暴露 `${PORT:-3000}:3000`，容器 PORT 固定 3000，健康检查使用内置 Node fetch，配置 `restart: unless-stopped`。
- [x] 执行 `docker info`、`docker compose config`、`docker compose up --build -d`、`docker compose ps` 和 smoke 脚本；验证健康状态及容器重启后房间不再存在。只清理由本任务创建的容器。若服务不可用，诊断环境能力并明确标注未执行项，不把配置解析当成容器运行成功。
- [x] 写中文 README，包含键位、回合/平局/离线规则、本地开发、所有验证命令、Compose 一键部署、端口配置、HTTPS/WSS 反向代理和内存状态限制。记录当前环境的实际版本和验收结果，不写未经验证的通过结论。
- [x] 通过云环境工具保存完整且已执行过的 `install_script` 和 `start_skill`：仓库工作目录、Node.js 22 激活、`npm ci`、构建、启动和健康检查；说明复用现有检出、不另建 worktree。保存是草稿，不代表发布；网络仅按实际需求增补，不覆盖未知配置。
- [x] 完成最终 `npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e` 及实际可用的容器验证；检查 `git diff --check`、工作区和提交记录。独立复核协议安全、物理公平性、生命周期和部署，修复实质问题后只重跑受影响检查。
- [x] 提交 `build: add docker deployment and verified development guide`。向用户报告启动方式、提交记录、通过/失败/未执行的验证及云配置保存结果，不自动发布环境或推送仓库。

## 计划自审结果

设计中的玩法、房间状态、输入规则、限制、生命周期、中文界面、部署及验证分别由任务 1–5 覆盖。五类 Review Focus 均已分配测试；生产协议没有测试作弊入口。Docker 和浏览器能力需在执行时实际验证，工具存在不等于运行成功。推荐本会话直接按序执行：任务共享协议和状态机较多，顺序实现便于维持一致性。


执行完成：验证结果、环境调整和一项已知 Minor 见 `docs/validation/2026-10-12-readiness.md`。
