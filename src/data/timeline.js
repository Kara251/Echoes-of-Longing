import { IntroSanctum } from '../cuts/intro/sanctum.js';
import { IntroCredits } from '../cuts/intro/credits.js';

/**
 * 时间轴 —— 整场演出的分镜表。区间允许重叠（背景床 + 前景演出叠放）。
 * 逐句创作时在这里增卡：每句歌词一行，指向它专属的 cut。
 * 分镜与设计决策见 docs/design.md；歌词时间轴见 docs/lyrics.md。
 */
export function buildTimeline() {
  return [
    { id: 'intro-sanctum', tIn: 0, tOut: 22.5, Cut: IntroSanctum },
    { id: 'intro-credits', tIn: 0, tOut: 22.2, Cut: IntroCredits },
    // —— 主歌一起（22s–）的逐句 cut 待 Kara 分镜 ——
  ];
}
