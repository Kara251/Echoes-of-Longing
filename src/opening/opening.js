import { gsap } from 'gsap';
import { MalkuthHalo } from './malkuthHalo.js';
import { DustField } from './dust.js';

/**
 * 开场演出（Kara 分镜，2026-07-06）：
 *  1 「憧れの残響」于页面中部略下方由下往上淡入（BA 剧情标题式），停留 1s
 *  2 正中向上下同时射出线段，画面自线段左右分裂：
 *    左 —— 封面自线段拉出，标题移至封面上方（整体上下对称），
 *          随后以 日/英/中/韩 轮播淡入淡出
 *    右 —— Staff 列表与「上一级」按钮自线段拉出
 *    双边动画同始同终
 *  3 线段消失 → 光环中心点浮现 → 双边继续靠边让位
 *  4 让位完成后，光环轮廓自顶部顺时针、带加速度地发光显现
 *  5 光环下方浮现 Tap Halo to Continue，光环即入口
 *  6 点击：内容区自右下向左上化作粉末消散（光环除外），
 *    光环按入场逆序退场（轮廓逆时针收回 → 中点熄灭）
 *  7 onDone —— 进入播放器（过渡演出待定）
 */

/* ---- 可调参数（逐项打磨用） ---- */
const T = {
  titleIn: 1.8, // 标题升起淡入
  titleHold: 1.0, // 停留
  lineGrow: 0.55, // 线段生长
  split: 1.25, // 双边自线段拉出
  carousel: 2.8, // 标题轮播每种语言的停留
  crossfade: 0.7, // 轮播交叉淡化时长
  lineOut: 0.4, // 线段消失
  dotIn: 0.35, // 中心点浮现
  dock: 0.85, // 双边继续靠边
  ringDraw: 1.45, // 轮廓顺时针显现（加速）
  tapIn: 0.6, // Tap 提示浮现
  dissolve: 1.9, // 粉末消散
  ringUndraw: 1.15, // 轮廓逆时针收回（减速）
  dotOut: 0.35, // 中点熄灭
};
const POS = {
  titleStartY: 54, // 标题初始纵向位置（vh，略低于正中）
  titleRise: 4, // 升起距离（vh）
  leftSplit: 31, // 分裂后左列中心 x（vw）
  leftDock: 22, // 靠边后左列中心 x（vw）
  rightSplit: 69,
  rightDock: 78,
  titleY: 24.5, // 左列内：标题纵向中心（vh）
  coverY: 56.5, // 左列内：封面纵向中心（vh）
  dockScale: 0.85, // 靠边时双边略微收缩，为光环让位
  tapY: 'calc(50% + 21vh)',
};

const TITLES = [
  { cls: 'jp', text: '憧れの残響' },
  { cls: 'en', text: 'Echoes of Longing' },
  { cls: 'zh', text: '憧憬的残响' },
  { cls: 'kr', text: '동경의 잔향' },
];
const STAFF = [
  { role: '作曲・編曲', name: 'Mitsukiyo' },
  { role: '作詞', name: '夕野ヨシミ（IOSYS）' },
  { role: '歌', name: 'DAZBEE' },
];

function buildDom() {
  const root = document.createElement('div');
  root.id = 'opening';
  root.innerHTML = `
    <div id="op-line"></div>
    <div id="op-title">${TITLES.map(
      (t) => `<span class="lang ${t.cls}">${t.text}</span>`
    ).join('')}</div>
    <div id="op-cover"><img src="assets/img/cover.jpg" alt="憧れの残響 封面" draggable="false" /></div>
    <div id="op-staff">
      ${STAFF.map(
        (s) => `<div class="op-row"><span class="op-role">${s.role}</span><span class="op-name">${s.name}</span></div>`
      ).join('')}
      <p class="op-note">Blue Archive Ex.「Decagrammaton」ED</p>
      <a id="op-back" href="/" aria-label="返回上一级">← lyrics.kara251.com</a>
    </div>
    <p id="op-tap">Tap Halo to Continue</p>
    <button id="op-hit" aria-label="点击光环开始"></button>
  `;
  document.getElementById('app').appendChild(root);
  return root;
}

/** 消散前沿 f（2→0）对应的 clip-path：保留前沿左上侧 */
function clipFor(f) {
  const p = (v) => `${(v * 100).toFixed(2)}%`;
  if (f >= 2) return 'none';
  if (f >= 1) {
    return `polygon(0% 0%, 100% 0%, 100% ${p(f - 1)}, ${p(f - 1)} 100%, 0% 100%)`;
  }
  return `polygon(0% 0%, ${p(f)} 0%, 0% ${p(f)})`;
}

export function runOpening({ stage, audio, onDone }) {
  const root = buildDom();
  const $ = (sel) => root.querySelector(sel);
  const line = $('#op-line');
  const title = $('#op-title');
  const cover = $('#op-cover');
  const coverImg = cover.querySelector('img');
  const staff = $('#op-staff');
  const rows = [...staff.children];
  const tap = $('#op-tap');
  const hit = $('#op-hit');
  const langs = [...title.querySelectorAll('.lang')];

  const halo = new MalkuthHalo(stage.scene);
  const bloom0 = stage.bloom.strength;
  let carousel = null;
  let tapped = false;

  /* ---- 初始状态 ---- */
  gsap.set(title, { left: '50vw', top: `${POS.titleStartY + POS.titleRise}vh`, opacity: 0 });
  gsap.set(langs[0], { opacity: 1 });
  gsap.set(cover, { left: '50vw', top: `${POS.coverY}vh` });
  gsap.set(coverImg, { xPercent: 103 });
  gsap.set(staff, { left: '50vw', top: '50vh' });
  gsap.set(rows, { opacity: 0, x: -46 });

  /* ---- 入场时间轴 ---- */
  const tl = gsap.timeline();

  // 1 标题升起淡入 + 停留
  tl.to(title, {
    top: `${POS.titleStartY}vh`,
    opacity: 1,
    duration: T.titleIn,
    ease: 'power2.out',
  });
  tl.to({}, { duration: T.titleHold });

  // 2 线段自正中向上下射出
  tl.add('line');
  tl.to(line, { scaleY: 1, duration: T.lineGrow, ease: 'power4.out' }, 'line');

  // 双边自线段分裂拉出（同始同终）
  tl.add('split', `line+=${T.lineGrow * 0.6}`);
  tl.to(
    title,
    { left: `${POS.leftSplit}vw`, top: `${POS.titleY}vh`, duration: T.split, ease: 'power3.inOut' },
    'split'
  );
  tl.to(cover, { left: `${POS.leftSplit}vw`, duration: T.split, ease: 'power3.inOut' }, 'split');
  tl.to(coverImg, { xPercent: 0, duration: T.split, ease: 'power3.out' }, 'split');
  tl.to(staff, { left: `${POS.rightSplit}vw`, duration: T.split, ease: 'power3.inOut' }, 'split');
  tl.to(
    rows,
    { opacity: 1, x: 0, duration: T.split * 0.62, stagger: T.split * 0.09, ease: 'power2.out' },
    'split'
  );

  // 标题开始多语言轮播
  tl.call(() => {
    carousel = gsap.timeline({ repeat: -1 });
    for (let i = 0; i < langs.length; i++) {
      const cur = langs[i];
      const next = langs[(i + 1) % langs.length];
      carousel
        .to(cur, { opacity: 0, duration: T.crossfade, ease: 'power1.inOut' }, `+=${T.carousel}`)
        .to(next, { opacity: 1, duration: T.crossfade, ease: 'power1.inOut' }, '<15%');
    }
  });

  // 3 线段消失，光环中点浮现，双边继续靠边
  tl.to(line, { opacity: 0, duration: T.lineOut, ease: 'power1.in' });
  tl.add(halo.showDot(T.dotIn));
  tl.add('dock');
  tl.to(
    [title, cover],
    { left: `${POS.leftDock}vw`, scale: POS.dockScale, duration: T.dock, ease: 'power2.inOut' },
    'dock'
  );
  tl.to(
    staff,
    { left: `${POS.rightDock}vw`, scale: POS.dockScale, duration: T.dock, ease: 'power2.inOut' },
    'dock'
  );

  // 4 光环轮廓顺时针加速显现 + 辉光抬升
  tl.add('ring');
  tl.add(halo.draw(T.ringDraw), 'ring');
  tl.to(stage.bloom, { strength: 0.9, duration: T.ringDraw, ease: 'power2.in' }, 'ring');
  tl.to(stage.bloom, { strength: 0.6, duration: 0.8, ease: 'power2.out' });

  // 5 Tap 提示，开放点击
  tl.to(tap, { opacity: 0.85, duration: T.tapIn, ease: 'power1.out' }, '<');
  tl.call(() => {
    halo.breathe();
    hit.classList.add('armed');
    gsap.to(tap, { opacity: 0.35, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
  });

  /* ---- 6 点击光环：粉末消散 + 光环逆序退场 ---- */
  hit.addEventListener('click', async () => {
    if (tapped) return;
    tapped = true;
    hit.classList.remove('armed');
    carousel?.kill();
    gsap.killTweensOf(tap);

    // 浏览器手势内解锁音频（先播即停，正式起播交给播放器）
    let hasAudio = false;
    if (audio.el.src) {
      try {
        audio.ensureGraph();
        await audio.el.play();
        audio.el.pause();
        audio.el.currentTime = 0;
        hasAudio = true;
      } catch (err) {
        console.warn('[opening] 音频解锁失败，转静默排演', err);
      }
    }

    const dust = new DustField();
    await new Promise((resolve) => {
      const front = { f: 2 };
      gsap.to(front, {
        f: 0,
        duration: T.dissolve,
        ease: 'power1.inOut',
        onUpdate: () => {
          root.style.clipPath = clipFor(front.f);
          dust.emitAlongFront(front.f);
        },
        onComplete: resolve,
      });
    });
    root.style.visibility = 'hidden';

    await halo.undraw(T.ringUndraw);
    gsap.to(stage.bloom, { strength: bloom0, duration: T.ringUndraw, ease: 'power1.out' });
    await halo.hideDot(T.dotOut);

    dust.dispose();
    halo.dispose();
    tl.kill();
    root.remove();
    onDone({ hasAudio });
  });

  // 封面预解码，避免拉出瞬间的空白闪变
  coverImg.decode?.().catch(() => {});
}
