import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGrainPass } from '../fx/grain.js';

/**
 * 三层舞台：
 *   1. WebGL 层（Three.js 场景 + Bloom / 胶片颗粒 / 暗角 / 色差后期）
 *   2. 文字层（DOM，见 core/type.js）
 *   3. 电影层（letterbox / 闪帧 / 黑场幕布）
 * cut 通过 stage.scene 挂载三维演出，通过 cine 系列方法控制电影层。
 */
export class Stage {
  constructor({ canvas, cineLayer }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0d1f);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
    this.camera.position.set(0, 0, 10);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.65, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grain = createGrainPass();
    this.composer.addPass(this.grain);

    this._barTop = cineLayer.querySelector('.bar.top');
    this._barBottom = cineLayer.querySelector('.bar.bottom');
    this._veil = cineLayer.querySelector('#veil');
    this._flash = cineLayer.querySelector('#flash');

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  /* ---- 电影层 ---- */

  /** letterbox 收紧程度 0..1（0.12 ≈ 常规电影黑边） */
  setLetterbox(v) {
    const h = `${(v * 50).toFixed(2)}%`;
    this._barTop.style.height = h;
    this._barBottom.style.height = h;
  }

  /** 黑场幕布不透明度 0..1（开场/转场用） */
  setVeil(opacity, transition = '') {
    this._veil.style.transition = transition;
    this._veil.style.opacity = String(opacity);
  }

  /** 闪帧（默认闪白，可传色） */
  flash(color = '#fff', dur = 0.12, peak = 0.9) {
    const el = this._flash;
    el.style.background = color;
    el.style.transition = 'none';
    el.style.opacity = String(peak);
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${dur}s ease-out`;
      el.style.opacity = '0';
    });
  }

  render(dt, t) {
    this.grain.uniforms.uTime.value = t;
    this.composer.render(dt);
  }
}
