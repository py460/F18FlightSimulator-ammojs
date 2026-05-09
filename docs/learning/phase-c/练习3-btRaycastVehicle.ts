/**
 * 练习 3：btRaycastVehicle 最小实现
 *
 * 目标：
 *   - 理解 btRaycastVehicle 的创建流程
 *   - 理解轮子的添加和参数含义
 *   - 理解如何每帧同步 Ammo 位姿到 Babylon Mesh
 *   - 理解如何施加推力和转向
 *
 * 对应 Phase B-03（f18Physics.ts 的简化版）
 *
 * 运行后你会看到：
 *   - 一个可以用 WASD 控制的「车辆」（飞机物理的基础）
 *   - W/S：前进/后退（油门/刹车）
 *   - A/D：转向
 *   - 车辆有悬挂效果（轮子会随地形起伏）
 */

import * as BABYLON from '@babylonjs/core';
import { AmmoJSPlugin } from '@babylonjs/core';

window.addEventListener('DOMContentLoaded', async () => {
    await window["Ammo"]();
    startVehicleDemo();
});

async function startVehicleDemo() {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);

    scene.enablePhysics(
        new BABYLON.Vector3(0, -10, 0),
        new AmmoJSPlugin(true, Ammo)
    );

    // 相机跟随车辆
    const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 3, 20, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // 地面
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, scene);
    ground.physicsImpostor = new BABYLON.PhysicsImpostor(
        ground, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0 }, scene
    );

    // ============================================================
    // 创建 btRaycastVehicle
    // ============================================================

    // 获取 Ammo 物理世界（Babylon 封装了它）
    const physicsWorld = scene.getPhysicsEngine().getPhysicsPlugin().world;

    // 1. 车体碰撞形状
    const chassisShape = new Ammo.btBoxShape(new Ammo.btVector3(1, 0.3, 2));

    // 2. 初始位置和旋转
    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(0, 2, 0));  // 从高处开始
    transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));

    // 3. 运动状态
    const motionState = new Ammo.btDefaultMotionState(transform);

    // 4. 局部惯性
    const localInertia = new Ammo.btVector3(0, 0, 0);
    const mass = 100;
    chassisShape.calculateLocalInertia(mass, localInertia);

    // 5. 创建刚体
    const vehicleBody = new Ammo.btRigidBody(
        new Ammo.btRigidBodyConstructionInfo(mass, motionState, chassisShape, localInertia)
    );
    vehicleBody.setActivationState(4);  // 永不休眠
    physicsWorld.addRigidBody(vehicleBody);

    // 6. 创建车辆
    const tuning = new Ammo.btVehicleTuning();
    const rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
    const vehicle = new Ammo.btRaycastVehicle(tuning, vehicleBody, rayCaster);
    vehicle.setCoordinateSystem(0, 1, 2);  // X=右, Y=上, Z=前
    physicsWorld.addAction(vehicle);

    // 7. 添加 4 个轮子
    const wheelDir = new Ammo.btVector3(0, -1, 0);   // 悬挂方向（向下）
    const wheelAxle = new Ammo.btVector3(-1, 0, 0);  // 轮轴方向（向左）
    const suspensionRestLength = 0.3;
    const wheelRadius = 0.4;

    function addWheel(isFront: boolean, x: number, z: number, index: number) {
        const pos = new Ammo.btVector3(x, 0, z);
        const wheelInfo = vehicle.addWheel(
            pos, wheelDir, wheelAxle, suspensionRestLength, wheelRadius, tuning, isFront
        );
        wheelInfo.set_m_suspensionStiffness(20);
        wheelInfo.set_m_wheelsDampingRelaxation(2.3);
        wheelInfo.set_m_wheelsDampingCompression(4.4);
        wheelInfo.set_m_maxSuspensionForce(6000);
        wheelInfo.set_m_frictionSlip(1000);
        wheelInfo.set_m_rollInfluence(0.1);
    }

    addWheel(true,  -1, 1.5, 0);   // 前左
    addWheel(true,   1, 1.5, 1);   // 前右
    addWheel(false, -1, -1.5, 2);  // 后左
    addWheel(false,  1, -1.5, 3);  // 后右

    // ============================================================
    // 创建 Babylon 可视化网格
    // ============================================================

    // 车体（透明盒子）
    const chassisMesh = BABYLON.MeshBuilder.CreateBox("chassis", { width: 2, height: 0.6, depth: 4 }, scene);
    chassisMesh.rotationQuaternion = new BABYLON.Quaternion();
    chassisMesh.visibility = 0.3;

    // 4 个轮子
    const wheelMeshes: BABYLON.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const wheel = BABYLON.MeshBuilder.CreateCylinder(
            `wheel${i}`, { diameter: wheelRadius * 2, height: 0.3, tessellation: 12 }, scene
        );
        wheel.rotationQuaternion = new BABYLON.Quaternion();
        wheelMeshes.push(wheel);
    }

    // ============================================================
    // 键盘输入
    // ============================================================
    const keys = { w: false, s: false, a: false, d: false };
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') keys.w = true;
        if (e.code === 'KeyS') keys.s = true;
        if (e.code === 'KeyA') keys.a = true;
        if (e.code === 'KeyD') keys.d = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') keys.w = false;
        if (e.code === 'KeyS') keys.s = false;
        if (e.code === 'KeyA') keys.a = false;
        if (e.code === 'KeyD') keys.d = false;
    });

    // ============================================================
    // 帧循环
    // ============================================================
    scene.onBeforeRenderObservable.add(() => {
        // 施加推力（后轮驱动）
        const engineForce = keys.w ? 500 : keys.s ? -500 : 0;
        vehicle.applyEngineForce(engineForce, 2);  // 后左轮
        vehicle.applyEngineForce(engineForce, 3);  // 后右轮

        // 转向（前轮）
        const steering = keys.a ? 0.3 : keys.d ? -0.3 : 0;
        vehicle.setSteeringValue(steering, 0);  // 前左轮
        vehicle.setSteeringValue(steering, 1);  // 前右轮

        // 刹车
        if (!keys.w && !keys.s) {
            vehicle.setBrake(5, 2);
            vehicle.setBrake(5, 3);
        } else {
            vehicle.setBrake(0, 2);
            vehicle.setBrake(0, 3);
        }

        // 同步轮子位置（Ammo → Babylon）
        for (let i = 0; i < 4; i++) {
            vehicle.updateWheelTransform(i, true);
            const tm = vehicle.getWheelTransformWS(i);
            const p = tm.getOrigin(), q = tm.getRotation();
            wheelMeshes[i].position.set(p.x(), p.y(), p.z());
            wheelMeshes[i].rotationQuaternion.set(q.x(), q.y(), q.z(), q.w());
            wheelMeshes[i].rotate(BABYLON.Axis.Z, Math.PI / 2);  // 修正朝向
        }

        // 同步车体位置（Ammo → Babylon）
        const tm = vehicle.getChassisWorldTransform();
        const p = tm.getOrigin(), q = tm.getRotation();
        chassisMesh.position.set(p.x(), p.y(), p.z());
        chassisMesh.rotationQuaternion.set(q.x(), q.y(), q.z(), q.w());

        // 相机跟随
        camera.target = chassisMesh.position;
    });

    engine.runRenderLoop(() => scene.render());
    window.addEventListener('resize', () => engine.resize());

    // ============================================================
    // 练习扩展：
    // 1. 把 engineForce 改成累积值（像 f18Physics 的 accelerateNumber）
    // 2. 把车体换成飞机形状（用 btCompoundShape 添加翼展）
    // 3. 在速度 > 50 时施加向上的升力（applyForce Y 方向）
    //    → 这就是飞机起飞的基本原理！
    // ============================================================
}
