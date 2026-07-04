import { gsap } from 'gsap';
import { Cut } from '../base.js';
import { makeLine, ghostify } from '../../core/type.js';
import { LYRICS } from '../../data/lyrics.js';

/**
 * 【演示卡 · 将被正式演出替换】一句歌词的逐字演出 + 残响机制。
 * 演示内容：
 *   - 逐字 span 编舞（GSAP timeline，seek 精确同步）
 *   - 节拍驱动的字距呼吸
 *   - 句末 ghostify —— 歌词不消失，化作残响上浮消散
 * 正式创作时每句歌词都会有自己风格迥异的这样一个文件。
 */
export class DemoTypeline extends Cut {
  async init() {
    this.data = LYRICS.find((l) => l.id === 'demo-line');
  }

  enter() {
    this.line = makeLine({ jp: this.data.jp, zh: this.data.zh });
    this._synced = false;
    this._ghosted = false;

    this.tl = gsap.timeline({ paused: true });
    this.tl.fromTo(
      this.line.chars,
      { opacity: 0, y: 26, filter: 'blur(7px)', rotateZ: () => gsap.utils.random(-7, 7) },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        rotateZ: 0,
        duration: 1.5,
        stagger: 0.07,
        ease: 'power3.out',
      },
      0.2
    );
    if (this.line.zhEl) {
      this.tl.fromTo(
        this.line.zhEl,
        { opacity: 0, letterSpacing: '0.6em' },
        { opacity: 0.72, letterSpacing: '0.32em', duration: 2.2, ease: 'power2.out' },
        1.4
      );
    }
  }

  update(p, t, dt, audio) {
    // 与主时钟精确对齐（seek 进入区间中段时演出状态正确）
    if (!this._synced) {
      this.tl.seek(t - this.def.tIn).play();
      this._synced = true;
    }

    // 节拍让整句轻轻"吸一口气"
    if (this.line.jpEl) {
      this.line.jpEl.style.letterSpacing = `${0.14 + audio.beat * 0.045}em`;
    }

    // 句末：残响化，本体退场
    if (p > 0.82 && !this._ghosted) {
      this._ghosted = true;
      ghostify(this.line.root, { rise: 110, dur: 7 });
      gsap.to(this.line.chars, {
        opacity: 0,
        y: -14,
        filter: 'blur(5px)',
        duration: 1.2,
        stagger: 0.04,
        ease: 'power2.in',
      });
      if (this.line.zhEl) gsap.to(this.line.zhEl, { opacity: 0, duration: 1.4 });
    }
  }

  exit() {
    this.tl?.kill();
    gsap.killTweensOf(this.line?.chars ?? []);
    this.line?.root.remove();
  }
}
