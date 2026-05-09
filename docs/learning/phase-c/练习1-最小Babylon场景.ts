/**
 * 练习 1：最小 Babylon.js 场景 + 物理引擎
 *
 * 目标：
 *   - 理解 Engine → Scene → Camera → Light 的装配顺序
 *   - 理解 enablePhysics 的调用时机
 *   - 理解 runRenderLoop 帧循环
 *
 * 对应 Phase B-01
 *
 * 运行后你会看到：
 *   - 一个蓝色天空背景
 *   - 一个白色地面
 *   - 一个红色立方体从空中落下，落地后弹起
 *   - 右上角显示 FPS
 */

import * as BABYLON from '@babylonjs/core';
import { AmmoJSPlugin } from '@babylonjs/core';

// ============================================================
// 步骤 1：等待 Ammo.js 初始化（必须在最前面）
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
    await window["Ammo"]();  // 等待 wasm 编译
    startGame();
});

async function startGame() {
    // ============================================================
    // 步骤 2：创建引擎（绑定到 canvas）
    // ============================================================
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    const engine = new BABYLON.Engine(canvas, true);  // true = 抗锯齿

    // ============================================================
    // 步骤 3：创建场景
    // ============================================================
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.2, 0.4, 0.8, 1);  // 天空蓝背景

    // ============================================================
    // 步骤 4：启用物理引擎（必须在创建任何物理对象之前！）
    // ============================================================
    scene.enablePhysics(
        new BABYLON.Vector3(0, -9.8, 0),  // 重力方向和大小
        new AmmoJSPlugin(true, Ammo)       // Ammo 是全局变量（CDN 加载）
    );

    // ============================================================
    // 步骤 5：创建相机
    // ============================================================
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,  // alpha（水平角）
        Math.PI / 3,   // beta（垂直角）
        20,            // radius（距离）
        BABYLON.Vector3.Zero(),
        scene
    );
    camera.attachControl(canvas, true);  // 允许鼠标控制

    // ============================================================
    // 步骤 6：创建光源
    // ============================================================
    const light = new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 1, 0),  // 光从上方照射
        scene
    );
    light.intensity = 0.8;

    // ============================================================
    // 步骤 7：创建地面（静态物理体，mass=0）
    // ============================================================
    const ground = BABYLON.MeshBuilder.CreateGround(
        "ground",
        { width: 20, height: 20 },
        scene
    );
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
        ground,
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: 0, restitution: 0.5 },  // mass=0 = 静态，不会被推动
        scene
    );

    // ============================================================
    // 步骤 8：创建一个会掉落的立方体（动态物理体，mass>0）
    // ============================================================
    const box = BABYLON.MeshBuilder.CreateBox("box", { size: 1 }, scene);
    box.position.y = 10;  // 从高处开始

    // 红色材质
    const mat = new BABYLON.StandardMaterial("mat", scene);
    mat.diffuseColor = new BABYLON.Color3(1, 0.2, 0.2);
    box.material = mat;

    box.physicsImpostor = new BABYLON.PhysicsImpostor(
        box,
        BABYLON.PhysicsImpostor.BoxImpostor,
        {
            mass: 1,          // 质量 1kg
            restitution: 0.7, // 弹性系数（0=不弹，1=完全弹）
            friction: 0.5     // 摩擦力
        },
        scene
    );

    // ============================================================
    // 步骤 9：FPS 显示
    // ============================================================
    const fpsDiv = document.createElement('div');
    fpsDiv.style.cssText = 'position:fixed;top:10px;right:10px;color:white;font-size:20px;font-weight:bold;';
    document.body.appendChild(fpsDiv);

    // ============================================================
    // 步骤 10：启动渲染循环
    // ============================================================
    engine.runRenderLoop(() => {
        scene.render();
        fpsDiv.textContent = `FPS: ${engine.getFps().toFixed()}`;
    });

    // ============================================================
    // 步骤 11：响应窗口大小变化
    // ============================================================
    window.addEventListener('resize', () => engine.resize());

    // ============================================================
    // 练习扩展：
    // 1. 把 restitution 改成 0.9，看看弹跳效果
    // 2. 在 runRenderLoop 里每帧给 box 施加一个向上的力：
    //    box.physicsImpostor.applyForce(new BABYLON.Vector3(0, 5, 0), box.getAbsolutePosition())
    // 3. 按空格键时给 box 施加冲量（applyImpulse）
    // ============================================================
}
