# 可视化地图工坊实施计划

> 使用 executing-plans 在本会话直接执行；用户已明确要求直接实现，不再增加计划确认步骤。

**目标：** 实现已确认的可视化地图工坊、本地保存与文件分享、服务端地图同步。
**设计：** `docs/superpowers/specs/2026-10-12-map-editor-design.md`。
**约束：** Node 22、现有检出与 work 分支、保留现有玩法与 Docker 单服务结构。

## 接口与步骤

- [ ] 共享校验与文件：新增 `src/shared/custom-map.ts`、`geometry.ts`，定义版本化 `MapDocument`、`validateDocument(unknown)`、`parseMapFile(string)`、`toDocument(MapDefinition)`、`toDefinition(MapDocument,id)`；测试旋转边界、出生点相交、非法数字和格式/尺寸上限。
- [ ] 编辑状态与本地库：`src/client/editor/model.ts` 提供最多 50 步撤销重做、一次拖动一次提交；`library.ts` 以注入的 Storage 为边界，处理 20 张限制、逐条损坏、整库备份、写入失败、同 ID 修改冲突。先写失败测试再实现。
- [ ] 房间与协议：新增 `applyCustomMap` 和成功回执，RoomView 携带完整 MapDefinition；服务端校验、房主/lobby 限制、每秒一次提交限制。WebSocket 最大帧 32 KiB，但普通消息保持 4 KiB。真实连接验证后加入同步、非法地图保持原地图、限流和隔离。
- [ ] 编辑器：`view.ts`、`canvas.ts`、`workshop.ts` 负责布局、坐标交互与生命周期；属性编辑、拖拽、缩放、键盘、吸附、八个出生点、模板、地图库、文件、脏数据离开确认和单人试跑。共享无网络依赖的 PhysicsWorld，游戏输入与编辑输入互斥。
- [ ] 浏览器与部署：实际拖拽/缩放/旋转/出生点、撤销、保存刷新、导出导入、试跑、双窗口地图同步与计分；运行既有测试、类型检查、构建和 Docker 验收，独立审查，修复重要问题后提交并普通推送 work。

## 审查重点

服务器不能接受客户端伪造的边界或出生点；地图变更与快照切换不能混用；失焦/取消指针不留下持续输入；存储失败及跨窗口冲突不能丢作品；关闭工坊时移除所有监听和动画；文件导入不能绕过服务端校验；断线期间仍能保存本地地图。
