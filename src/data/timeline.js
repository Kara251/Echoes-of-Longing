import { DemoBed } from '../cuts/demo/bed.js';
import { DemoTypeline } from '../cuts/demo/typeline.js';
import { DemoParticles } from '../cuts/demo/particles.js';
import { SONG } from './lyrics.js';

/**
 * 时间轴 —— 整场演出的分镜表。区间允许重叠（背景床 + 前景演出叠放）。
 * 逐句创作时在这里增卡：每句歌词一行，指向它专属的 cut。
 *
 * ⚠️ 目前挂载的全部是演示卡，用于打通并验证管线，将被正式演出替换。
 */
export function buildTimeline() {
  return [
    { id: 'demo-bed', tIn: 0, tOut: SONG.duration, Cut: DemoBed },
    { id: 'demo-typeline', tIn: 24, tOut: 34, Cut: DemoTypeline },
    { id: 'demo-particles', tIn: 40, tOut: 58, Cut: DemoParticles },
  ];
}
