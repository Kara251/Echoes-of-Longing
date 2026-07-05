/**
 * 歌词数据 —— 逐句创作的原料表。
 *
 * ⚠️ 目前全部为占位。等官方歌词（日文原词 + 认可的中文译文）与
 * 逐句时间轴确定后在此填入真实数据，并为每句开设专属 cut。
 *
 * 单句结构：
 *   {
 *     id:   'v1-01',            句唯一标识（cut 与 timeline 通过它对应）
 *     tIn:  24.0, tOut: 31.5,   进出场时间（秒）
 *     jp:   '……',               日文原词（主视觉）
 *     zh:   '……',               中文译文（副层）
 *     kr:   '……',               可选：韩文（标题性节点使用）
 *     // 任意演出所需的附加字段都可以加：perChar 时间、素材路径……
 *   }
 */
export const SONG = {
  title: {
    jp: '憧れの残響',
    kr: '동경의 잔향',
    en: 'Echoes of Longing',
  },
  artist: {
    composer: 'Mitsukiyo',
    lyricist: '夕野ヨシミ (IOSYS)',
    vocalist: 'DAZBEE',
  },
  duration: 268, // 4:28，接入真实音源后以 metadata 为准
};

export const LYRICS = [
  // —— 占位示例：仅供 demo-typeline 卡演示逐字演出与残响机制 ——
  {
    id: 'demo-line',
    tIn: 24,
    tOut: 34,
    jp: 'ここに歌詞が入る、一文字ずつ',
    zh: '此处将逐字填入歌词',
  },
];
