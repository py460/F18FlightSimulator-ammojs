# F18 Flight Simulator — 学习导航地图

> 项目：F18 Fighter Simulation (ammojs)  
> 源语言：TypeScript 4.2  
> 技术栈：Babylon.js 5 + Ammo.js + Webpack  
> 读者假设：有其他语言基础（Java/Python/C++ 均可），不熟悉 TS/Babylon/Ammo  
> 生成时间：2026-05-09

---

## 学习路径总览

```
阶段 0 → 本文件（导航地图）
阶段 A → TypeScript 语法（以项目代码为例）
阶段 B → 项目逻辑理解（模块逐个拆解）
阶段 C → 动手练习骨架（可运行的最小实现）
```

---

## Phase 0 · 模块-知识点索引

| # | 模块 | 核心文件 | 涉及 TS 知识点 | 架构概念 | 优先级 |
|---|------|----------|--------------|---------|--------|
| 1 | 入口与启动 | `index.ts` / `game.ts` | 模块导入、async/await、class | 依赖装配、帧循环 | ⭐⭐⭐ |
| 2 | 类型与接口 | `interface/fly.ts` / `base/config.ts` | interface、全局声明、模块导出 | 领域模型 | ⭐⭐⭐ |
| 3 | 输入控制 | `f18InputController.ts` / `f18GamePadController.ts` | 单例模式、事件监听、class 属性 | 输入解耦、归一化 | ⭐⭐⭐ |
| 4 | 物理核心 | `f18Physics.ts` | class 构造函数、public/private、泛型数组 | btRaycastVehicle、复合刚体 | ⭐⭐⭐⭐⭐ |
| 5 | 场景与资源 | `airportScene.ts` / `f18Assets.ts` | Promise、async/await、模块注册 | AssetContainer、约定命名 | ⭐⭐⭐ |
| 6 | 相机控制 | `f18CameraController.ts` | 单例、pointerLock API、Lerp/Slerp | 多相机切换、视角状态机 | ⭐⭐⭐ |
| 7 | 骨骼动画 | `f18Animation.ts` | class 数组属性、setInterval/setTimeout | 骨骼 FK 驱动、舵面联动 | ⭐⭐⭐⭐ |
| 8 | HUD 显示 | `f18HUD.ts` | async 方法、GUI API 链式调用 | 3D 平面 GUI、纹理偏移 | ⭐⭐⭐ |
| 9 | 爆炸系统 | `f18Explode.ts` | 数组遍历、PhysicsImpostor、粒子 | 刚体唤醒、冲量爆炸 | ⭐⭐ |
| 10 | 音效系统 | `f18Sound.ts` | 构造函数注入、条件音量 | 3D 空间音效、视角衰减 | ⭐⭐ |
| 11 | LOD 优化 | `f18LODManager.ts` / `base/funt.ts` | 单例、命名约定、Promise 封装 | LOD 策略、网格简化 | ⭐ |
| 12 | 全局状态 | `f18Global.ts` | 模块级变量、export let | 跨实例共享状态 | ⭐ |

---

## TypeScript 知识点全清单

按学习依赖顺序排列（先学的在前）：

### 基础层（必须先掌握）
- `import` / `export` 模块系统 → 出现在所有文件
- `class` 定义与实例化 → `Game`、`F18Physics`、`AirportScene` 等
- `public` / `private` 访问修饰符 → `f18Physics.ts` 大量使用
- `interface` 类型定义 → `interface/fly.ts`
- 箭头函数 `() => {}` → 所有事件回调
- 模板字符串 `` `${变量}` `` → `f18HUD.ts`

### 中级层（理解项目结构必须）
- `async` / `await` + `Promise` → `game.ts`、`f18Assets.ts`、`airportScene.ts`
- 静态属性 `static` + 单例模式 → `F18InputController.ins`、`F18CameraController.ins`
- 可选链 `?.` 和非空断言 `!` → `f18Animation.ts`、`f18Sound.ts`
- 类型断言 `as` / `<Type>` → `game.ts` 中 `<HTMLCanvasElement>`
- 数组方法 `map`、`forEach`、`every` → `f18GamePadController.ts`
- 全局声明 `declare` / `interface` 无 export → `interface/fly.ts`

### 进阶层（理解架构设计）
- `window["key"]` 动态属性访问 → `index.ts` 中 `window["Ammo"]()`
- `Observable` 订阅模式（Babylon 的 `onBeforeRenderObservable`）→ 所有 Controller
- 泛型数组 `Array<T>` → `f18Explode.ts`
- 交叉类型与联合类型 → `f18CameraController.ts`

---

## 文档清单

### Phase A — 语法学习

| 文件 | 内容 | 对应模块 |
|------|------|---------|
| `phase-a/01-模块系统与类.md` | import/export、class、访问修饰符 | 所有模块 |
| `phase-a/02-接口与类型系统.md` | interface、全局声明、类型断言 | 模块 2 |
| `phase-a/03-异步编程.md` | Promise、async/await、回调 | 模块 1、5 |
| `phase-a/04-单例与静态属性.md` | static、单例模式、get accessor | 模块 3、6 |
| `phase-a/05-事件与帧循环.md` | addEventListener、Observable、帧循环 | 模块 3、4 |

### Phase B — 项目逻辑理解

| 文件 | 内容 | 对应模块 |
|------|------|---------|
| `phase-b/01-入口与场景装配.md` | index.ts → game.ts 启动链路 | 模块 1 |
| `phase-b/02-输入归一化系统.md` | 键盘/手柄 → flyGamePadData | 模块 3 |
| `phase-b/03-物理飞控核心.md` | btRaycastVehicle + 推力/升力/力矩 | 模块 4 ★ |
| `phase-b/04-场景与资源加载.md` | AssetContainer + 约定命名 | 模块 5 |
| `phase-b/05-相机与视角切换.md` | 三相机状态机 + pointerLock | 模块 6 |
| `phase-b/06-骨骼动画驱动.md` | 副翼/方向舵/起落架骨骼 | 模块 7 |
| `phase-b/07-HUD与音效爆炸.md` | GUI + Sound + Explode | 模块 8、9、10 |

### Phase C — 动手练习骨架

| 文件 | 内容 |
|------|------|
| `phase-c/README.md` | 骨架说明与运行方式 |
| `phase-c/练习1-最小Babylon场景.ts` | 引擎+场景+相机+灯光 |
| `phase-c/练习2-物理刚体.ts` | 重力+碰撞+applyForce |
| `phase-c/练习3-btRaycastVehicle.ts` | 车辆类最小实现 |
| `phase-c/练习4-输入控制器.ts` | 键盘归一化单例 |
| `phase-c/练习5-完整飞机骨架.ts` | 整合以上，可起飞的最小飞机 |

---

## 推荐学习顺序

```
第 1 天：Phase A 01 + 02（TS 基础语法）
第 2 天：Phase A 03 + 04 + 05（异步/单例/帧循环）
第 3 天：Phase B 01 + 04（场景装配 + 资源加载）+ Phase C 练习 1
第 4 天：Phase B 02（输入系统）+ Phase C 练习 4
第 5 天：Phase C 练习 2 + 3（物理基础）
第 6 天：Phase B 03（物理飞控核心，最难）+ Phase C 练习 5
第 7 天：Phase B 05 + 06 + 07（相机/动画/HUD）
```
