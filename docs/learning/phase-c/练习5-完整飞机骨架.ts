/**
 * 练习 5：可起飞的最小飞机骨架
 *
 * 目标：
 *   - 整合前 4 个练习的所有知识
 *   - 理解 btRaycastVehicle + 升力 + 力矩 = 飞机物理的核心
 *   - 理解 dispose 的正确实现
 *
 * 对应 Phase B-03（f18Physics.ts 的精简版，去掉骨骼/HUD/音效）
 *
 * 运行后你会看到：
 *   - 一个可以滑跑起飞的「飞机」（白色盒子）
 *   - Shift：加油门（累积到 1000）
 *   - Space：刹车/减油门
 *   - W/S：俯仰（速度 > 40 才有效）
 *   - A/D：翻滚（速度 > 40 才有效）
 *   - Q/E：偏航（速度 > 10 才有效）
 *   - V：切换视角（第三人称/第一人称）
 *
 * 这就是 F18 项目的物理核心，去掉了所有视觉装饰。
 */

import * as BABYLON from '@babylonjs/core';
import { AmmoJSPlugin } from '@babylonjs/core';

// ============================================================
// 输入控制器（简化版，来自练习 4）
// ============================================================
class InputController {
    private static _ins: InputController;
    public static get ins() {
        if (!this._ins) this._ins = new InputController();
        return this._ins;
    }

    public pitchNumber = 0;
    public rollNumber = 0;
    public yawNumber = 0;
    public accelerateNumber = 0;
    public brakeNumber = 0;

    private keys = {
        pitchDown: false, pitchUp: false,
        rollLeft: false, rollRight: false,
        yawLeft: false, yawRight: false,
        accelerate: false, brake: false
    };

    private _kd; private _ku; private _br;

    public init(scene: BABYLON.Scene) {
        window.addEventListener('keydown', this._kd = (e: KeyboardEvent) => {
            if (e.code === 'KeyW') this.keys.pitchDown = true;
            if (e.code === 'KeyS') this.keys.pitchUp = true;
            if (e.code === 'KeyA') this.keys.rollLeft = true;
            if (e.code === 'KeyD') this.keys.rollRight = true;
            if (e.code === 'KeyQ') this.keys.yawLeft = true;
            if (e.code === 'KeyE') this.keys.yawRight = true;
            if (e.code === 'ShiftLeft') this.keys.accelerate = true;
            if (e.code === 'Space') this.keys.brake = true;
        });
        window.addEventListener('keyup', this._ku = (e: KeyboardEvent) => {
            if (e.code === 'KeyW') this.keys.pitchDown = false;
            if (e.code === 'KeyS') this.keys.pitchUp = false;
            if (e.code === 'KeyA') this.keys.rollLeft = false;
            if (e.code === 'KeyD') this.keys.rollRight = false;
            if (e.code === 'KeyQ') this.keys.yawLeft = false;
            if (e.code === 'KeyE') this.keys.yawRight = false;
            if (e.code === 'ShiftLeft') this.keys.accelerate = false;
            if (e.code === 'Space') this.keys.brake = false;
        });
        this._br = scene.onBeforeRenderObservable.add(() => this.update());
    }

    private update() {
        this.pitchNumber = this.keys.pitchDown ? -1 : this.keys.pitchUp ? 1 : 0;
        this.rollNumber  = this.keys.rollLeft  ? -1 : this.keys.rollRight ? 1 : 0;
        this.yawNumber   = this.keys.yawLeft   ? -1 : this.keys.yawRight  ? 1 : 0;
        if (this.keys.accelerate) this.accelerateNumber = Math.min(1000, this.accelerateNumber + 5);
        else if (this.keys.brake) this.accelerateNumber = Math.max(0, this.accelerateNumber - 5);
        this.brakeNumber = this.keys.brake ? 1 : 0;
    }

    public dispose(scene: BABYLON.Scene) {
        scene.onBeforeRenderObservable.remove(this._br);
        window.removeEventListener('keydown', this._kd, false);
        window.removeEventListener('keyup', this._ku, false);
    }
}

// ============================================================
// 最小飞机物理类（对应 F18Physics 的核心部分）
// ============================================================
class MinimalAircraft {
    public chassisMesh: BABYLON.Mesh;
    private vehicle: Ammo.btRaycastVehicle;
    private vehicleBody: Ammo.btRigidBody;
    private wheelMeshes: BABYLON.Mesh[] = [];
    private beforeRender;

    // 物理参数（对应 f18Physics.ts 的私有属性）
    private mass = 200;
    private chassisW = 2, chassisH = 0.6, chassisL = 8;

    // 飞行数据
    public flySpeed = 0;
    public accelerateSize = 0;

    constructor(private scene: BABYLON.Scene) {}

    public init(position: BABYLON.Vector3, quaternion: BABYLON.Quaternion) {
        this.createVehicle(position, quaternion);
        this.beforeRender = this.scene.onBeforeRenderObservable.add(() => this.render());
    }

    private createVehicle(position: BABYLON.Vector3, quaternion: BABYLON.Quaternion) {
        const physicsWorld = this.scene.getPhysicsEngine().getPhysicsPlugin().world;

        // 机身碰撞形状
        const shape = new Ammo.btBoxShape(
            new Ammo.btVector3(this.chassisW * .5, this.chassisH * .5, this.chassisL * .5)
        );

        // 初始变换
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z));
        transform.setRotation(new Ammo.btQuaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w));

        const motionState = new Ammo.btDefaultMotionState(transform);
        const localInertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(this.mass, localInertia);

        // 可见网格
        this.chassisMesh = BABYLON.MeshBuilder.CreateBox("aircraft",
            { width: this.chassisW, height: this.chassisH, depth: this.chassisL }, this.scene
        );
        this.chassisMesh.rotationQuaternion = new BABYLON.Quaternion();
        this.chassisMesh.visibility = 0.5;

        // 刚体
        this.vehicleBody = new Ammo.btRigidBody(
            new Ammo.btRigidBodyConstructionInfo(this.mass, motionState, shape, localInertia)
        );
        this.vehicleBody.setActivationState(4);
        physicsWorld.addRigidBody(this.vehicleBody);

        // 车辆
        const tuning = new Ammo.btVehicleTuning();
        const rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
        this.vehicle = new Ammo.btRaycastVehicle(tuning, this.vehicleBody, rayCaster);
        this.vehicle.setCoordinateSystem(0, 1, 2);
        physicsWorld.addAction(this.vehicle);

        // 添加起落架（3 个轮子：前轮居中，后轮左右）
        const wheelDir = new Ammo.btVector3(0, -1, 0);
        const wheelAxle = new Ammo.btVector3(-1, 0, 0);

        const addWheel = (isFront: boolean, x: number, z: number, radius: number, idx: number) => {
            const wi = this.vehicle.addWheel(
                new Ammo.btVector3(x, 0.05, z), wheelDir, wheelAxle, 0.6, radius, tuning, isFront
            );
            wi.set_m_suspensionStiffness(18);
            wi.set_m_wheelsDampingRelaxation(0.3);
            wi.set_m_wheelsDampingCompression(4.4);
            wi.set_m_maxSuspensionForce(600000);
            wi.set_m_frictionSlip(10);
            wi.set_m_rollInfluence(0.1);
            const mesh = BABYLON.MeshBuilder.CreateCylinder(`w${idx}`,
                { diameter: radius * 2, height: 0.3, tessellation: 8 }, this.scene
            );
            mesh.rotationQuaternion = new BABYLON.Quaternion();
            mesh.visibility = 0.8;
            this.wheelMeshes[idx] = mesh;
        };

        addWheel(true,  0,    2.12,  0.181, 0);  // 前轮
        addWheel(true,  0,    2.12,  0.181, 1);  // 前轮（同位置，btRaycastVehicle 需要 4 个）
        addWheel(false, -1.13, -1.32, 0.212, 2); // 后左
        addWheel(false,  1.13, -1.32, 0.212, 3); // 后右
    }

    private render() {
        const input = InputController.ins;
        const fpsDt: any = this.scene.getAnimationRatio();

        this.flySpeed = this.vehicle.getCurrentSpeedKmHour();
        this.accelerateSize = input.accelerateNumber;

        // ① 刹车
        const brakeForce = input.brakeNumber === 1 ? 10 * fpsDt : 0;
        for (let i = 0; i < 4; i++) this.vehicle.setBrake(brakeForce, i);

        // ② 同步轮胎位置
        for (let i = 0; i < 4; i++) {
            this.vehicle.updateWheelTransform(i, true);
            const tm = this.vehicle.getWheelTransformWS(i);
            const p = tm.getOrigin(), q = tm.getRotation();
            this.wheelMeshes[i].position.set(p.x(), p.y(), p.z());
            this.wheelMeshes[i].rotationQuaternion.set(q.x(), q.y(), q.z(), q.w());
            this.wheelMeshes[i].rotate(BABYLON.Axis.Z, Math.PI / 2);
        }

        // ③ 同步机身位置
        const tm = this.vehicle.getChassisWorldTransform();
        const p = tm.getOrigin(), q = tm.getRotation();
        this.chassisMesh.position.set(p.x(), p.y(), p.z());
        this.chassisMesh.rotationQuaternion.set(q.x(), q.y(), q.z(), q.w());
        this.chassisMesh.rotate(BABYLON.Axis.X, Math.PI);  // 修正朝向

        // ④ 推力（沿机头方向）
        const thrust = 18 * this.accelerateSize;
        this.vehicleBody.applyForce(
            new Ammo.btVector3(
                -this.chassisMesh.forward.x * thrust * fpsDt,
                -this.chassisMesh.forward.y * thrust * fpsDt,
                -this.chassisMesh.forward.z * thrust * fpsDt
            ),
            new Ammo.btVector3(0, 0, 0)
        );

        // ⑤ 角速度控制（俯仰/翻滚/偏航）
        const globalAV = this.vehicleBody.getAngularVelocity();
        let ypr = new BABYLON.Vector3(0, 0, 0);

        if (this.flySpeed > 40) ypr.x = -2 * input.pitchNumber;
        if (this.flySpeed > 10) ypr.y = 0.8 * input.yawNumber;
        if (this.flySpeed > 40) ypr.z = 4 * input.rollNumber;

        // 乘以角加速度
        ypr.scaleInPlace(Math.PI * 0.3);

        // 局部 → 世界坐标
        const matr = new BABYLON.Matrix();
        this.chassisMesh.rotationQuaternion.toRotationMatrix(matr);
        ypr = BABYLON.Vector3.TransformCoordinates(ypr, matr);

        // 与当前角速度插值
        const lerp = Math.min(0.05 * fpsDt, 0.99);
        const newYPR = BABYLON.Vector3.Lerp(
            new BABYLON.Vector3(globalAV.x(), globalAV.y(), globalAV.z()),
            ypr, lerp
        );
        newYPR.scaleInPlace(0.95);  // 角速度衰减
        this.vehicleBody.setAngularVelocity(new Ammo.btVector3(newYPR.x, newYPR.y, newYPR.z));

        // ⑥ 升力（分段函数）
        let lift = this.flySpeed > 300 ? 2000 : this.flySpeed > 150 ? 500 : this.flySpeed;
        this.vehicleBody.applyForce(
            new Ammo.btVector3(0, lift * fpsDt, 0),
            new Ammo.btVector3(0, 0, 0)
        );

        // ⑦ 阻力
        const drag = this.flySpeed > 300 ? 0.7 : this.flySpeed > 150 ? 0.5 : 0.2;
        this.vehicleBody.setDamping(drag, 0);
    }

    public dispose() {
        this.scene.onBeforeRenderObservable.remove(this.beforeRender);
        this.chassisMesh.dispose();
        this.wheelMeshes.forEach(w => w.dispose());
        const physicsWorld = this.scene.getPhysicsEngine().getPhysicsPlugin().world;
        physicsWorld.removeRigidBody(this.vehicleBody);
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

    // 地面
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
        ground, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0 }, scene
    );

    // 光源
    const light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(0.3, -1, 0.3), scene);
    light.intensity = 2;

    // 创建飞机
    const aircraft = new MinimalAircraft(scene);
    aircraft.init(
        new BABYLON.Vector3(0, 2, 0),
        BABYLON.Quaternion.RotationAxis(new BABYLON.Vector3(0, 1, 0), 0)
    );

    // 初始化输入
    InputController.ins.init(scene);

    // 相机（第三人称跟随）
    const tpsCamera = new BABYLON.UniversalCamera("tps", new BABYLON.Vector3(0, 5, 15), scene);
    tpsCamera.rotationQuaternion = new BABYLON.Quaternion();
    scene.activeCameras = [tpsCamera];

    // 锚点（parent 到飞机）
    const anchor = BABYLON.MeshBuilder.CreateBox("anchor", { size: 0 }, scene);
    anchor.position = new BABYLON.Vector3(0, 3, 12);
    anchor.visibility = 0;
    anchor.parent = aircraft.chassisMesh;

    // 信息显示
    const info = document.createElement('div');
    info.style.cssText = 'position:fixed;top:10px;left:10px;color:white;font-size:14px;background:rgba(0,0,0,0.6);padding:10px;border-radius:5px;';
    document.body.appendChild(info);

    // 帧循环：相机跟随 + 信息更新
    scene.onBeforeRenderObservable.add(() => {
        const fpsDt: any = scene.getAnimationRatio();
        const lerp = Math.min(0.4 * fpsDt, 0.99);

        // 第三人称相机平滑跟随
        tpsCamera.position = BABYLON.Vector3.Lerp(tpsCamera.position, anchor.absolutePosition, lerp);
        if (!tpsCamera.rotationQuaternion) {
            tpsCamera.rotationQuaternion = anchor.absoluteRotationQuaternion.clone();
        }
        tpsCamera.rotationQuaternion = BABYLON.Quaternion.Slerp(
            tpsCamera.rotationQuaternion, anchor.absoluteRotationQuaternion, Math.min(0.2 * fpsDt, 0.99)
        );

        // 更新信息
        info.innerHTML = `
            速度: ${aircraft.flySpeed.toFixed(0)} km/h<br>
            油门: ${aircraft.accelerateSize.toFixed(0)} / 1000<br>
            <br>
            Shift: 加油门 | Space: 减油门<br>
            W/S: 俯仰（速度>40有效）<br>
            A/D: 翻滚（速度>40有效）<br>
            Q/E: 偏航（速度>10有效）<br>
            <br>
            提示：先按 Shift 加速到 40+ km/h<br>
            再按 W 拉杆起飞！
        `;
    });

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());

    // ============================================================
    // 练习扩展：
    // 1. 加载一个 glb 模型替换白色盒子
    // 2. 添加 HUD（用 AdvancedDynamicTexture 显示速度）
    // 3. 添加爆炸功能（按 X 键触发）
    // 4. 添加第一人称视角切换（按 V 键）
    // 5. 这就是 F18 项目的完整骨架了！
    // ============================================================
});
