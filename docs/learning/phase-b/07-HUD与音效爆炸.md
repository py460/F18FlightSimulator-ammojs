# Phase B-07 · HUD、音效与爆炸系统

> 对应模块：`f18HUD.ts` + `f18Sound.ts` + `f18Explode.ts`  
> 核心问题：HUD 是怎么显示在 3D 世界里的？3D 音效怎么实现？爆炸解体是怎么做的？

---

## 7.1 HUD 抬头显示器

### 这个模块做什么

HUD 不是 2D 覆盖层（不是 HTML div），而是**贴在 3D 平面上的 GUI**，随飞机一起运动。就像真实飞机的平视显示器——投影在挡风玻璃上，飞行员不需要低头看仪表。

### HUD 的组成

```
hudGround（父节点，parent 到 chassisMesh）
├── rollRectGui（俯仰刻度条 + 翻滚旋转）
│     └── AdvancedDynamicTexture（4320×1024 的大纹理，通过 vOffset 滚动）
├── yawRectGui（偏航刻度条）
│     └── AdvancedDynamicTexture（5760×1024 的宽纹理，通过 uOffset 滚动）
├── numberGui（速度/油门/起落架状态面板）
│     └── AdvancedDynamicTexture（从 hud_speed.xml 加载布局）
└── forwardIcon（前向指示箭头）
```

### 核心实现

```typescript
// 来源：src/vehicleObject/f18/f18HUD.ts

private async creatFppUI_HUD(scene) {
    // 创建父节点（不可见的地面网格，parent 到飞机）
    this.hudGround = BABYLON.Mesh.CreateGround("ground1", 0, 0, 2, scene);
    this.hudGround.position = new BABYLON.Vector3(0, -1.30, -7);  // 座舱前方
    this.hudGround.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);  // 竖立
    this.hudGround.scaling = new BABYLON.Vector3(0.3, 1, 0.3);
    this.hudGround.isVisible = false;
    this.hudGround.applyFog = false;  // HUD 不受雾影响

    // 创建各个 HUD 面板（都是 Ground 网格，贴上 GUI 纹理）
    this.rollRectGui = BABYLON.Mesh.CreateGround("ground1", 8, 4, 2, scene);
    this.yawRectGui  = BABYLON.Mesh.CreateGround("ground1", 8, 4, 2, scene);
    this.numberGui   = BABYLON.Mesh.CreateGround("numberGui", 10.08, 1.6, 2, scene);

    // 所有面板 parent 到 hudGround
    this.rollRectGui.parent = this.hudGround;
    this.yawRectGui.parent  = this.hudGround;
    this.numberGui.parent   = this.hudGround;

    // 设置渲染组（2 = 在其他物体之上渲染，防止被遮挡）
    for (let mesh of this.hudGround.getChildMeshes()) {
        mesh.applyFog = false;
        mesh.renderingGroupId = 2
    }

    // 创建各面板的 GUI 内容
    this.setHudMaterial(this.rollRectGui, this.creatPitchGuiTool(this.rollRectGui), scene)
    this.setHudMaterial(this.yawRectGui,  this.creatYawGuiTool(this.yawRectGui), scene)
    await this.creatSpeedGuiTool(this.numberGui)  // 从 XML 加载速度面板
}
```

### 俯仰刻度的滚动原理

```typescript
// 来源：src/vehicleObject/f18/f18HUD.ts

// 创建一个超高的纹理（4320 * 3 = 12960 像素高）
// 里面画了 72 条刻度线（每 5° 一条）
this.advancedTexturePitch = GUI.AdvancedDynamicTexture.CreateForMesh(
    mesh, 1024, 4320 * this.ySet  // ySet = 3
);
this.advancedTexturePitch.vScale = 0.125 / this.ySet;  // 只显示 1/24 的高度

// 每帧根据飞机俯仰角偏移纹理
public setPitch(val) {
    // val = flyRotation.x / (Math.PI * 2)，范围 [-0.5, 0.5]
    this.rollRectGui.material["opacityTexture"].vOffset = val + offset
    // vOffset 改变纹理的垂直偏移，产生刻度条滚动效果
}
```

> ⚡ 核心技巧：不是每帧重新绘制刻度，而是**预先画好一张超长的纹理，通过改变 UV 偏移来「滚动」**。这比每帧重绘高效得多。

### 速度面板（XML 布局）

```typescript
// 来源：src/vehicleObject/f18/f18HUD.ts

private async creatSpeedGuiTool(mesh) {
    this.advancedTextureSpeed = GUI.AdvancedDynamicTexture.CreateForMesh(mesh, 1080, 190);

    return new Promise((success) => {
        // 从 XML 文件加载 GUI 布局（类似 Android 的 layout XML）
        this.xmlLoader = new GUI.XmlLoader(this);
        this.xmlLoader.loadLayout(
            url + "assets/gui/hud_speed.xml",
            this.advancedTextureSpeed,
            () => { success(this.xmlLoader) }
        );
    })
}

// 每帧更新数值
updateFlyData() {
    if (this.xmlLoader.getNodeById("flySpeed")) {
        // 通过 ID 找到 XML 里的文本节点，更新内容
        this.xmlLoader.getNodeById("flySpeed").text =
            `${this.vehicle.flyData.flySpeed.toFixed()}`
        this.xmlLoader.getNodeById("throttleSize").text =
            `${this.vehicle.flyData.accelerateSize}`
        this.xmlLoader.getNodeById("undercarriageState").text =
            this.vehicle.undercarriageState ? "起落架:打开" : "起落架:收起"
    }
}
```

---

## 7.2 3D 空间音效

### 这个模块做什么

飞机引擎声会随距离衰减，在座舱内和座舱外听到的音量不同，手柄会随油门震动。`F18SoundController` 管理这些音效细节。

### 核心实现

```typescript
// 来源：src/vehicleObject/f18/f18Sound.ts

public init() {
    // 引擎循环声（3D 空间音效，附着在飞机网格上）
    this.f18EngineSound = new BABYLON.Sound(
        "f18",
        url + "assets/sound/f18.mp3",
        this.scene,
        () => {
            this.f18EngineSound.play()
            this.f18EngineSound.setVolume(0.5)
            this.f18EngineSound.attachToMesh(this.mesh);  // 音源跟随飞机移动
        },
        { loop: true, maxDistance: 100 }  // 超过 100 单位距离后听不到
    )

    // 爆炸声（一次性）
    this.f18EngineBoom = new BABYLON.Sound(
        "f18", url + "assets/sound/boom2.mp3", this.scene,
        () => {
            this.f18EngineBoom.setVolume(1)
            this.f18EngineBoom.attachToMesh(this.mesh);
        },
        { loop: false, maxDistance: 150 }
    )

    // 选中飞机时的引擎声（非 3D，直接播放）
    this.f18EngineSoundSelect = new BABYLON.Sound(
        "f18", url + "assets/sound/f18.mp3", this.scene,
        () => {
            this.f18EngineSoundSelect.play()
            this.f18EngineSoundSelect.setVolume(0.5)
        },
        { loop: true }  // 没有 attachToMesh，不是 3D 音效
    )
}

public render(f18PhysicsController: F18Physics) {
    // 根据视角调整音量（座舱内音量更小，模拟隔音效果）
    this.targetSoundRender(this.f18EngineSound)

    // 手柄震动反馈（油门越大震动越强）
    F18GamepadController.ins.vibrationActuator(
        100,
        f18PhysicsController.flyGamePadData.accelerateNumber / 2000,
        0
    )

    // 当前驾驶的飞机：用非 3D 音效（避免 3D 衰减）
    if (F18CameraController.ins.vehicle.chassisMesh == f18PhysicsController.chassisMesh) {
        this.f18EngineSound.setVolume(0)        // 关闭 3D 音效
        this.targetSoundRender(this.f18EngineSoundSelect)  // 开启非 3D 音效
    } else {
        this.f18EngineSoundSelect.setVolume(0)  // 关闭非 3D 音效
    }

    // 引擎音调随油门变化（音调 = 速度感）
    this.f18EngineSoundSelect.setPlaybackRate(
        (2000 + f18PhysicsController.flyData.accelerateSize) / 3000
    )
}
```

---

## 7.3 爆炸解体系统

### 这个模块做什么

飞机爆炸时，`f18_explode.glb` 里的每一块碎片都变成独立的物理刚体，被随机冲量弹飞，同时播放烟雾粒子和爆炸 Sprite 动画。

### 核心实现

```typescript
// 来源：src/vehicleObject/f18/f18Explode.ts

public init() {
    // 创建爆炸 Sprite（序列帧动画）
    this.boomSprite = new BABYLON.SpriteManager(
        "treesManager",
        url + "assets/texture/boom3.png",  // 爆炸序列帧贴图
        160,                               // 最大 Sprite 数量
        { width: 200, height: 200 },       // 每帧尺寸
        this.scene
    );
    this.boom = new BABYLON.Sprite("player", this.boomSprite);
    this.boom.size = 0;  // 初始不可见

    // 遍历爆炸模型的所有子网格，为每块创建物理盒子
    let node = this.vehicle.flyMeshExplode.rootNodes[0];
    for (let mesh of node.getChildMeshes(false)) {
        this.createBox(mesh, ...);
    }
}

private createBox(mesh: BABYLON.Mesh, size, position, rotation, mass) {
    let index = this.boxList.length;
    this.clones[index] = mesh

    // 用网格的包围盒尺寸创建物理盒子
    size = this.clones[index].getBoundingInfo().boundingBox.extendSize;
    this.boxList[index] = BABYLON.MeshBuilder.CreateBox("box", {
        width: size.x, depth: size.z, height: size.y
    }, this.scene);
    this.boxList[index].scaling = new BABYLON.Vector3(5, 5, 5)
    this.boxList[index].visibility = 0;  // 物理盒子不可见
    this.boxList[index].parent = this.vehicle.chassisMesh  // 跟随飞机

    // 把碎片网格 parent 到物理盒子
    this.clones[index].setEnabled(false)  // 初始隐藏
    this.clones[index].parent = this.boxList[index];

    // 创建物理刚体（初始休眠）
    this.boxList[index].physicsImpostor = new BABYLON.PhysicsImpostor(
        this.boxList[index],
        BABYLON.PhysicsImpostor.BoxImpostor,
        { mass: mass, friction: 0.5, restitution: 0.7 },
        this.scene
    );
    this.boxList[index].physicsImpostor.sleep()  // 休眠，等爆炸时唤醒

    // 为每块碎片创建烟雾粒子
    BABYLON.ParticleHelper.CreateAsync("smoke", this.scene).then((set) => {
        this.particles[index] = set
        this.particles[index].emitterNode = this.boxList[index];
        set.systems[0].emitRate = 10;
        set.systems[0].maxLifeTime = 1.5;
    });
}

public start() {
    // 播放爆炸音效
    this.vehicle.f18SoundController.f18EngineBoom.play()

    // 播放爆炸 Sprite 动画（0~36 帧）
    this.boom.position = this.vehicle.chassisMesh.absolutePosition.clone();
    this.boom.position.y += 3
    this.boom.size = 15;
    this.boom.playAnimation(0, 36, false, 60, () => {
        this.boom.size = 0;  // 动画结束后隐藏
    });

    // 唤醒所有碎片刚体，施加随机冲量
    for (let i = 0; i < this.boxList.length; i++) {
        this.physicsStart(i)
        this.particleStart(i)
    }

    setTimeout(() => { this.dispose() }, 5000)  // 5 秒后清理
}

physicsStart(index) {
    this.boxList[index].parent = null  // 脱离飞机，独立运动
    this.boxList[index].position = this.vehicle.chassisMesh.absolutePosition
    this.clones[index].setEnabled(true)  // 显示碎片
    this.boxList[index].physicsImpostor.wakeUp()  // 唤醒物理
    // 施加随机冲量（向四面八方飞散）
    this.boxList[index].physicsImpostor.applyImpulse(
        new BABYLON.Vector3(
            Math.random() * 20 - 10,  // X: -10 ~ 10
            Math.random() * 20,       // Y: 0 ~ 20（向上）
            Math.random() * 20 - 10   // Z: -10 ~ 10
        ),
        this.boxList[index].getAbsolutePosition()
    );
}
```

---

## 三个系统的共同模式

| 系统 | 初始化时机 | 每帧更新 | 销毁时机 |
|------|-----------|---------|---------|
| HUD | `F18Physics` 构造函数 | `f18HUDController.updateFlyData()` | `f18Physics.dispose()` |
| Sound | `createChassisMesh` 内 | `f18SoundController.render()` | `f18Physics.dispose()` |
| Explode | `F18Physics` 构造函数 | 无（爆炸后自动清理） | `start()` 后 5 秒 |

**Phase B 逻辑理解部分完成！**  
**下一步**：[Phase C 动手练习骨架](../phase-c/README.md)
