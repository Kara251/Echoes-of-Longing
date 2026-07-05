import { Cut } from '../base.js';
import { createDuskSea } from '../../fx/ocean.js';
import { createHalo } from '../../fx/halo.js';
import { SONG } from '../../data/lyrics.js';

/**
 * 【演示卡 · 将被正式演出替换】背景床：暮色海面 + 光环。
 * 演示 WebGL 层的全场景铺底、光环三态切换、音频能量联动。
 * 正式创作时它会被拆成随歌曲段落推进的多个背景卡。
 */
export class DemoBed extends Cut {
  async init() {
    this.sea = createDuskSea();
    this.halo = createHalo({ radius: 3 });
    this.halo.group.position.set(0, 3.1, -14); // 抬高，给中央的歌词留出画面

    // 开场的韩文标题（DOM 直书，演示文字层与 WebGL 的混合）
    this.title = document.createElement('div');
    this.title.className = 'lyric-line';
    this.title.innerHTML = `
      <div class="jp" style="font-family: var(--font-kr); font-size: clamp(1rem, 2.2vw, 1.5rem); letter-spacing: 0.8em; opacity: 0.9;">동경의 잔향</div>
      <div class="zh" style="letter-spacing: 0.5em;">${SONG.title.jp} — ${SONG.title.en}</div>
    `;
    this.title.style.opacity = '0';
    this.title.style.top = '64%'; // 让位于上方的光环
  }

  enter() {
    const { stage } = this.ctx;
    stage.scene.add(this.sea.mesh);
    stage.scene.add(this.halo.group);
    document.getElementById('lines').appendChild(this.title);
    stage.setLetterbox(0.1);
    this.halo.setMode('breathe');
  }

  update(p, t, dt, audio) {
    this.sea.update(t, audio);

    // 光环三态演示：呼吸 → 涟漪（≈副歌）→ 碎裂（≈终幕）
    if (p < 0.72) this.halo.setMode('breathe');
    else if (p < 0.9) this.halo.setMode('ripple');
    else this.halo.setMode('shatter');
    this.halo.update(t, dt, audio);

    // 标题在 t ∈ [2, 10] 淡入淡出（确定性写法，seek 安全）
    const a = Math.min(Math.max((t - 2) / 2.5, 0), 1) * Math.min(Math.max((10 - t) / 2.5, 0), 1);
    this.title.style.opacity = String(a);
    this.title.style.transform = `translate(-50%, calc(-50% - ${t * 2}px))`;
  }

  exit() {
    const { stage } = this.ctx;
    stage.scene.remove(this.sea.mesh);
    stage.scene.remove(this.halo.group);
    this.title.remove();
    stage.setLetterbox(0);
  }

  dispose() {
    this.sea.dispose();
    this.halo.dispose();
  }
}
