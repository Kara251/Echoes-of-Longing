import { Cut } from '../base.js';
import { createTextParticles } from '../../fx/textParticles.js';

/**
 * 【演示卡 · 将被正式演出替换】文字粒子：聚合成字、随乐漂流、爆散消逝。
 * 演示副歌级 kinetic typography 的粒子管线（fx/textParticles）。
 */
export class DemoParticles extends Cut {
  async init() {
    // 字体已在 main.js await document.fonts.ready 后才装载导演，可安全栅格化
    this.tp = createTextParticles('残響', {
      font: '500 220px "Shippori Mincho", serif',
      worldHeight: 2.4,
    });
    this.tp.mesh.position.set(0, -0.6, 0); // 让位于上方的光环
  }

  enter() {
    this.ctx.stage.scene.add(this.tp.mesh);
    this.tp.uniforms.uMix.value = 0;
    this.tp.uniforms.uOpacity.value = 0;
    this._assembled = false;
    this._scattered = false;
  }

  update(p, t, dt, audio) {
    const lt = t - this.def.tIn;
    this.tp.update(t);

    // 透明度包络：入场 1s 淡入，尾段 2s 淡出
    const dur = this.def.tOut - this.def.tIn;
    this.tp.uniforms.uOpacity.value = Math.min(lt / 1, (dur - lt) / 2, 1);

    if (lt > 0.4 && !this._assembled) {
      this._assembled = true;
      this.tp.assemble(2.6);
    }
    if (lt > dur - 4 && !this._scattered) {
      this._scattered = true;
      this.tp.scatter(2.4);
      this.ctx.stage.flash('#dfe0ff', 0.35, 0.22); // 爆散瞬间轻微闪光
    }
  }

  exit() {
    this.ctx.stage.scene.remove(this.tp.mesh);
  }

  dispose() {
    this.tp.dispose();
  }
}
