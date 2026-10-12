# 随机地图与能量天平实施计划

> 使用 superpowers:executing-plans 在本会话直接执行。用户此前明确选择直接实现，保留执行与推送授权。

**目标：** 交付联机随机场地、能量成长、真实中心支点天平、可视化旋转编辑。
**架构：** 共享地图校验和物理决定玩法，服务端随机生成与广播，快照同步动态平台/能量/体型，工坊共享试跑。
**技术：** TypeScript、Matter.js、WebSocket、Canvas、Node 22、Docker，无新增依赖。
**设计：** docs/superpowers/specs/2026-10-12-energy-arena-design.md。

## 全局约束与审查重点

兼容旧文件和本地作品；服务端权威；随机图八个出生点有支撑；成长上限及每轮重置；天平支点不平移、角度不越界；拾取单次奖励且淘汰球不拾取；编辑拖动取消不残留；切换地图与回合不混用快照。

## Task 1: 地图格式与随机生成

接口：Platform.motion?；MapDocument.version 1|2；generateRandomMap(seed:number):MapDefinition。服务端 randomMap 消息仅房主/lobby，广播完整地图，新身份。

- [ ] RED：旧版本兼容、非法动态类型/角度/扫掠边界拒绝、多个种子合法且出生有支撑、同种子可复现不同种子变化。
- [ ] GREEN：maps/custom-map/random-map 更新，随机生成固定+天平场地；协议及 rooms 加入 randomMap。
- [ ] 验证目标测试/类型并提交。

## Task 2: 物理、能量与快照

接口：BodyView.radius/energy/mass；PlatformView.index/x/y/angle；EnergyView.id/x/y；WorldSnapshot.platforms/energies；PhysicsWorld.platformSnapshot()/energySnapshot()。EnergyRain 负责随机生成、寿命、上限、单次拾取。

- [ ] RED：掉落拾取增加半径与真实质量、加重切换恢复成长质量、上限/重置/双人唯一奖励；不平衡载荷倾斜、对称平衡、固定地面不动、支点和限角。
- [ ] GREEN：添加能量模块与支点刚体，快照扩展。插值动态平台与能量，切轮清理。
- [ ] 验证完整单元/集成测试并提交。

## Task 3: 玩法视图和可视化编辑

接口：renderFrame 增加动态平台/能量参数；drawEditor 同样接收试跑状态；rotationHandle/normalizeAngle 在 geometry。工坊随机草稿、类型、顺逆时针、滑杆及拖动手柄；取消一拖一撤销。

- [ ] RED：浏览器双人随机图同步、切换限制、能量与天平快照、旋转拖动/方向按钮/滑杆/撤销、类型导入导出、旧图兼容。
- [ ] GREEN：renderer、interpolation、ui、editor 视图/交互更新；更新使用说明。
- [ ] 验证类型、完整测试、构建、浏览器；提交。

## Task 4: 交付

- [ ] 独立全分支审查；重要问题回归先失败再修复。
- [ ] Docker 构建及浏览器/联机验收；记录 docs/validation。
- [ ] 普通推送 work，核实远程提交及清洁状态。
