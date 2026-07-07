import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Cut } from '../base.js';
import { Sanctum } from '../../fx/sanctum.js';
import { SkyDome } from '../../fx/sky.js';

/**
 * 前奏 · 钢铁殿堂（0:00–0:22.5，Kara 分镜 2026-07-06）
 *
 * 开场页粉末消散后，殿堂光环自暗场淡入；背景渐变为「上蓝下白」的晴空。
 *  - 0:00–0:11 近景仰视：置身破碎的钢铁环带之间（MV 图一视角）
 *  - 0:11–0:14.5 拉远过渡
 *  - 0:14.5–0:22.5 殿堂光环全景（MV 图三视角）
 *  - 0:21–0:22.4 整体淡出，交棒给主歌一
 *
 * 交互原则：3D 内容可操控——全程可拖拽旋转观测角度（OrbitControls，
 * 禁缩放/平移；镜头距离与过渡由演出接管，方向交给用户）。
 * 所有淡入淡出/相机相位均由绝对时间 t 决定，seek 进入状态正确。
 */

/* ---- 可调参数 ---- */
const CAM = {
  targetA: new THREE.Vector3(0, 2, 0), // 近景注视点
  targetB: new THREE.Vector3(0, -6, 0), // 全景注视点
  radiusA: 24,
  radiusB: 110,
  polarB: THREE.MathUtils.degToRad(108), // 全景俯仰：略低于环系仰视，环衬蓝天
  transIn: 11, // 拉远开始
  transOut: 14.5, // 拉远结束
};
const FADE = {
  sanctumIn: 2.5,
  skyIn: 4,
  outFrom: 21,
  outTo: 22.4,
};

const smoothstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export class IntroSanctum extends Cut {
  enter() {
    const { stage } = this.ctx;
    const t0 = this.ctx.clock.t;

    this.sky = new SkyDome(stage.scene);
    this.sanctum = new Sanctum();
    stage.scene.add(this.sanctum.group);

    this.hemi = new THREE.HemisphereLight(0xdfeeff, 0x9aa8cc, 1.6);
    this.dir = new THREE.DirectionalLight(0xffffff, 1.8);
    this.dir.position.set(40, 80, 25);
    stage.scene.add(this.hemi, this.dir);

    // 初始相机按当前时间就位（seek 进入直接落在正确相位）
    const k = smoothstep(CAM.transIn, CAM.transOut, t0);
    const radius = THREE.MathUtils.lerp(CAM.radiusA, CAM.radiusB, k);
    const target = CAM.targetA.clone().lerp(CAM.targetB, k);
    const polar = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(100), CAM.polarB, k);
    const azimuth = 0.4;
    stage.camera.position.set(
      target.x + radius * Math.sin(polar) * Math.sin(azimuth),
      target.y + radius * Math.cos(polar),
      target.z + radius * Math.sin(polar) * Math.cos(azimuth)
    );

    this.controls = new OrbitControls(stage.camera, stage.renderer.domElement);
    this.controls.target.copy(target);
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.rotateSpeed = 0.55;
    this._polarStart = null;
  }

  update(p, t, dt) {
    const k = smoothstep(CAM.transIn, CAM.transOut, t);

    // 镜头距离与注视点由演出接管；方向（方位/俯仰）交给用户拖拽
    const radius = THREE.MathUtils.lerp(CAM.radiusA, CAM.radiusB, k);
    this.controls.minDistance = radius;
    this.controls.maxDistance = radius;
    this.controls.target.lerpVectors(CAM.targetA, CAM.targetB, k);

    // 拉远期间把俯仰角柔性引导到全景视角，结束后释放给用户
    if (k > 0 && k < 1) {
      if (this._polarStart === null) this._polarStart = this.controls.getPolarAngle();
      const polar = THREE.MathUtils.lerp(this._polarStart, CAM.polarB, k);
      this.controls.minPolarAngle = polar;
      this.controls.maxPolarAngle = polar;
    } else {
      this.controls.minPolarAngle = 0.35;
      this.controls.maxPolarAngle = 2.35;
    }
    this.controls.update();

    // 淡入 / 淡出（时间驱动，seek 安全）
    const out = 1 - smoothstep(FADE.outFrom, FADE.outTo, t);
    this.sanctum.opacity = smoothstep(0, FADE.sanctumIn, t) * out;
    this.sky.mix = smoothstep(0, FADE.skyIn, t) * out;

    this.sanctum.update(t);
  }

  exit() {
    const { stage } = this.ctx;
    this.controls?.dispose();
    stage.scene.remove(this.sanctum.group, this.hemi, this.dir);
    this.sanctum.dispose();
    this.sky.dispose();
    stage.camera.position.set(0, 0, 10);
    stage.camera.lookAt(0, 0, 0);
  }
}
