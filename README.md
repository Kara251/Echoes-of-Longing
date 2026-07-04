# 동경의 잔향 — Echoes of Longing

Blue Archive Ex.「Decagrammaton」篇 ED《憧れの残響 / Echoes of Longing》（Mitsukiyo × 夕野ヨシミ × DAZBEE）的**网页版静止系MAD**：不是歌词列表，而是以歌曲播放为时间轴的一场 4:28 实时演出。每句歌词是一个独立的"卡"（cut），拥有自己的分镜、镜头语言与文字演出。

> 当前状态：**引擎与创作框架已就绪，演出内容为演示卡占位**。正式演出将随歌词、译文与素材逐句设计。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
```

音源与图片素材放入 `public/assets/`（不入库，见 [public/assets/README.md](public/assets/README.md)）。没有任何素材也可以完整空放整场（静默排演模式）。

### 创作 HUD 与调试参数

| 操作 | 作用 |
| --- | --- |
| `H` | 显隐 HUD（时间码 / 当前 cut / seek 条） |
| `空格` | 播放 / 暂停 |
| `←` `→` | ±2s（按住 Shift ±10s） |
| `[` `]` | 跳到上 / 下一个 cut 边界 |
| `?t=95` | 直达 95 秒 |
| `?hud=1` | 启动即显示 HUD |
| `?silent=1` | 跳过入场仪式，直接静默排演（自动化验证用） |

## 架构：三层舞台 + 导演时间轴

```
WebGL 层   Three.js 场景（海面 / 光环 / 粒子 / 图像平面）
           + 后期管线（Bloom / 胶片颗粒 / 暗角 / 色差）
文字层     DOM 排印，逐字 span 化，GSAP 编舞；#ghosts 承载「残响」
电影层     letterbox / 闪帧 / 黑场幕布
```

- `src/core/` — 引擎四件套：`clock`（主时钟，无音频可自由走）、`audio`（音源加载 + bass/mid/high/beat 实时分析）、`director`（cut 生命周期调度，区间可重叠）、`stage`（三层舞台）；以及 `type`（逐字排印与残响工具）、`hud`（创作工作台）。
- `src/fx/` — 共享演出组件：`halo`（呼吸 / 涟漪 / 碎裂）、`ocean`（暮色海面）、`grain`（胶片后期）、`imagePlane`（任意素材的视差 / 溶解 / RGB 分离管线）、`textParticles`（文字粒子聚散）。
- `src/cuts/` — 每卡一个文件。契约见 `base.js`：`init → enter → update(p, t, dt, audio) → exit → dispose`，`enter` 必须支持从任意时间点 seek 进入。`demo/` 下为演示卡，将被正式演出替换。
- `src/data/` — `lyrics.js`（歌词原料表，待填入官方词与译文）、`timeline.js`（分镜表）。

## 逐句创作流程

1. 在 `data/lyrics.js` 填入一句歌词（日文 / 中文 / 时间）
2. 在 `cuts/` 为它新建专属 cut 文件，自由设计演出（可复用 `fx/` 组件，也可完全另起炉灶）
3. 在 `data/timeline.js` 挂上这一卡
4. 用 HUD 的 `?t=` 与 `[` `]` 反复打磨这一卡，直到满意

## 部署

推送到 `main` 后由 GitHub Actions 构建并发布到 GitHub Pages（需在仓库设置中将 Pages 来源设为 "GitHub Actions"）。线上环境不含受版权素材，页面自动以纯代码视觉运行。
