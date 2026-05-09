/**
 * 练习 4：键盘输入控制器单例
 *
 * 目标：
 *   - 理解单例模式的实现
 *   - 理解键盘布尔状态 → 归一化数值的转换
 *   - 理解油门累积 vs 即时输入的区别
 *   - 理解事件的正确注册和清理
 *
 * 对应 Phase B-02（f18InputController.ts 的简化版）
 *
 * 运行后你会看到：
 *   - 一个可以用键盘控制的立方体
 *   - WASD：移动（即时，松开停止）
 *   - Shift：加速（累积，松开保持）
 *   - Space：减速（累积，松开保持）
 *   - 屏幕上显示当前控制数值
 */

import * as BABYLON from '@babylonjs/core';
import { AmmoJSPlugin } from '@babylonjs/core';

// ============================================================
// 输入控制器单例（对应 F18InputController）
// ============================================================
class SimpleInputController {

    // 单例实现
    private static instance: SimpleInputController;
    public static get ins(): SimpleInputController {
        if (!this.instance) {
            this.instance = new SimpleInputController();
        }
        return this.instance;
    }

    // 原始键盘状态（布尔值）
    private keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        accelerate: false,
        brake: false
    };

    // 归一化数值（这才是外部使用的）
    public moveX = 0;      // [-1, 1]
    public moveZ = 0;      // [-1, 1]
    public throttle = 0;   // [0, 100]，累积值

    // 事件句柄（用于取消注册）
    private _keydown;
    private _keyup;
    private beforeRender;

    public init(scene: BABYLON.Scene) {
        // 注册键盘事件
        window.addEventListener('keydown', this._keydown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': this.keys.forward   = true; break;
                case 'KeyS': this.keys.backward  = true; break;
                case 'KeyA': this.keys.left      = true; break;
                case 'KeyD': this.keys.right     = true; break;
                case 'ShiftLeft': this.keys.accelerate = true; break;
                case 'Space':     this.keys.brake      = true; break;
            }
        });

        window.addEventListener('keyup', this._keyup = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': this.keys.forward   = false; break;
                case 'KeyS': this.keys.backward  = false; break;
                case 'KeyA': this.keys.left      = false; break;
                case 'KeyD': this.keys.right     = false; break;
                case 'ShiftLeft': this.keys.accelerate = false; break;
                case 'Space':     this.keys.brake      = false; break;
            }
        });

        // 帧循环：每帧把键盘状态转换成数值
        this.beforeRender = scene.onBeforeRenderObservable.add(() => {
            this.update();
        });
    }

    private update() {
        // 即时输入：松开立刻归零
        this.moveX = this.keys.right ? 1 : this.keys.left ? -1 : 0;
        this.moveZ = this.keys.forward ? 1 : this.keys.backward ? -1 : 0;

        // 累积输入：松开后保持当前值
        if (this.keys.accelerate) {
            this.throttle = Math.min(100, this.throttle + 1);  // 每帧 +1，上限 100
        } else if (this.keys.brake) {
            this.throttle = Math.max(0, this.throttle - 1);    // 每帧 -1，下限 0
        }
        // 注意：不按任何键时 throttle 保持不变（这就是油门的特性）
    }

    public dispose(scene: BABYLON.Scene) {
        scene.onBeforeRenderObservable.remove(this.beforeRender);
        window.removeEventListener('keydown', this._keydown, false);
        window.removeEventListener('keyup', this._keyup, false);
    }
}

// ============================================================
// 主程序
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
    await window["Ammo"]();

    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    scene.enablePhysics(new BABYLON.Vector3(0, -10, 0), new AmmoJSPlugin(true, Ammo));

    const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 3, 15, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // 地面
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 30, height: 30 }, scene);
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
        ground, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0 }, scene
    );

    // 可控制的立方体
    const box = BABYLON.MeshBuilder.CreateBox("box", { size: 1 }, scene);
    box.position.y = 0.5;
    box.physicsImpostor = new BABYLON.PhysicsImpostor(
        box, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 1, friction: 0.5 }, scene
    );

    // 初始化输入控制器
    SimpleInputController.ins.init(scene);

    // 数值显示
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'position:fixed;top:10px;left:10px;color:white;font-size:16px;background:rgba(0,0,0,0.5);padding:10px;border-radius:5px;';
    document.body.appendChild(infoDiv);

    // 帧循环：根据输入控制器的数值移动立方体
    scene.onBeforeRenderObservable.add(() => {
        const input = SimpleInputController.ins;
        const fpsDt = scene.getAnimationRatio();

        // 根据 moveX/moveZ 施加力
        const forceMagnitude = 20;
        box.physicsImpostor.applyForce(
            new BABYLON.Vector3(
                input.moveX * forceMagnitude * fpsDt,
                0,
                input.moveZ * forceMagnitude * fpsDt
            ),
            box.getAbsolutePosition()
        );

        // 油门控制跳跃高度（按 Shift 积累油门，按 Space 减少）
        // 这里用油门控制向上的力，模拟飞机升力
        if (input.throttle > 50) {
            box.physicsImpostor.applyForce(
                new BABYLON.Vector3(0, (input.throttle - 50) * 0.5 * fpsDt, 0),
                box.getAbsolutePosition()
            );
        }

        // 更新显示
        infoDiv.innerHTML = `
            moveX: ${input.moveX.toFixed(1)}<br>
            moveZ: ${input.moveZ.toFixed(1)}<br>
            throttle: ${input.throttle.toFixed(0)}<br>
            <br>
            WASD: 移动<br>
            Shift: 加油门（累积）<br>
            Space: 减油门（累积）<br>
            油门 > 50 时产生升力
        `;

        // 相机跟随
        camera.target = BABYLON.Vector3.Lerp(camera.target, box.position, 0.1);
    });

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());

    // ============================================================
    // 练习扩展：
    // 1. 添加手柄支持（navigator.getGamepads()）
    // 2. 添加「切换控制目标」功能（创建两个 box，按 Tab 切换）
    // 3. 把 throttle 的范围改成 0~1000（和 F18 一样）
    // ============================================================
});
