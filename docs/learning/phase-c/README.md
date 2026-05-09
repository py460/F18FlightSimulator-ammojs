# Phase C · 动手练习骨架

> 这里是 5 个递进式练习，每个都是可以独立运行的 TypeScript 代码。  
> 建议在读完对应的 Phase B 文档后再做练习。

## 运行方式

每个练习文件都是独立的，可以直接替换 `src/game.ts` 的内容来运行：

```bash
npm install
npm start
# 浏览器打开 http://localhost:8080
```

或者新建一个最小项目：

```bash
mkdir my-babylon-practice
cd my-babylon-practice
npm init -y
npm install @babylonjs/core babylonjs-loaders typescript webpack webpack-cli ts-loader
```

## 练习清单

| 练习 | 对应 Phase B | 目标 |
|------|------------|------|
| 练习 1 | B-01 | 最小 Babylon 场景 + 物理引擎 |
| 练习 2 | B-03 | 物理刚体：重力、碰撞、施力 |
| 练习 3 | B-03 | btRaycastVehicle 最小实现 |
| 练习 4 | B-02 | 键盘输入控制器单例 |
| 练习 5 | 全部 | 整合：可起飞的最小飞机 |
