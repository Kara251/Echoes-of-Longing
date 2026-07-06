import { gsap } from 'gsap';
import { MalkuthHalo } from './malkuthHalo.js';
import { DustField } from './dust.js';

/**
 * 开场演出（Kara 分镜 2026-07-06；07-06 修订：
 * 抽屉式拉出 / 短线段 / 标题紧贴封面 / 页面 UI 主体英文）
 *
 *  1 「憧れの残響」于页面中部略下方由下往上淡入，停留 1s
 *  2 正中射出一小段竖线，双边内容像抽屉一样自线段后拉出（被中线裁切）：
 *    左 —— 封面；标题同时移至封面正上方（两者组成居中块，上下对称）
 *    右 —— Staff（英文）与「上一级」按钮
 *    双边同始同终；标题随后以 日/英/中/韩 轮播淡入淡出
 *  3 线段消失 → 光环中心点浮现 → 双边继续靠边让位
 *  4 光环轮廓自顶部顺时针、带加速度地发光显现
 *  5 光环下方浮现 Tap Halo to Continue，光环即入口
 *  6 点击：内容区自右下向左上化作粉末消散（光环除外），
 *    光环按入场逆序退场（轮廓逆时针收回 → 中点熄灭）
 *  7 onDone —— 进入播放器（过渡演出待定）
 */

/* ---- 可调参数（逐项打磨用） ---- */
const T = {
  titleIn: 1.8, // 标题升起淡入
  titleHold: 1.0, // 停留
  lineGrow: 0.5, // 线段生长
  split: 1.25, // 双边抽屉拉出
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
  titleStartY: 0.54, // 标题初始纵向位置（×视口高，略低于正中）
  titleRise: 0.04, // 升起距离（×视口高）
  splitX: 0.31, // 分裂后左列中心（×视口宽；右列镜像）
  dockX: 0.22, // 靠边后左列中心（×视口宽；右列镜像）
  dockScale: 0.85, // 靠边时双边收缩，为光环让位
  coverW: [0.3, 0.48], // 封面尺寸 min(coverW[0]×vw, coverW[1]×vh)
  titleH: 0.075, // 标题块高（×视口高）
  titleGapMin: 14, // 标题与封面的间距下限（px）
  titleGap: 0.02, // 间距（×视口高）
};

const TITLES = [
  { cls: 'jp', text: '憧れの残響' },
  { cls: 'en', text: 'Echoes of Longing' },
  { cls: 'zh', text: '憧憬的残响' },
  { cls: 'kr', text: '동경의 잔향' },
];
const STAFF = [
  { role: 'Music', name: 'Mitsukiyo' },
  { role: 'Lyrics', name: 'Yuno Yoshimi (IOSYS)' },
  { role: 'Vocal', name: 'DAZBEE' },
];

function buildDom() {
  const root = document.createElement('div');
  root.id = 'opening';
  root.innerHTML = `
    <div id="op-line"></div>
    <div class="op-drawer left">
      <div id="op-cover"><img src="assets/img/cover.jpg" alt="Echoes of Longing cover art" draggable="false" /></div>
    </div>
    <div class="op-drawer right">
      <div id="op-staff">
        ${STAFF.map(
          (s) => `<div class="op-row"><span class="op-role">${s.role}</span><span class="op-name">${s.name}</span></div>`
        ).join('')}
        <p class="op-note">Blue Archive Ex. &ldquo;Decagrammaton&rdquo; ED</p>
        <a id="op-back" href="/" aria-label="Back to lyrics.kara251.com">&larr; lyrics.kara251.com</a>
      </div>
    </div>
    <div id="op-title">${TITLES.map(
      (t) => `<span class="lang ${t.cls}">${t.text}</span>`
    ).join('')}</div>
    <p id="op-tap">Tap Halo to Continue</p>
    <button id="op-hit" aria-label="Tap halo to continue"></button>
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
  const tap = $('#op-tap');
  const hit = $('#op-hit');
  const langs = [...title.querySelectorAll('.lang')];

  const halo = new MalkuthHalo(stage.scene);
  const bloom0 = stage.bloom.strength;
  let carousel = null;
  let tapped = false;

  /* ---- 布局解算（标题贴封面组成居中块；开场期间不响应 resize） ---- */
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const coverSize = Math.min(POS.coverW[0] * vw, POS.coverW[1] * vh);
  const titleH = POS.titleH * vh;
  const gap = Math.max(POS.titleGapMin, POS.titleGap * vh);
  const blockTop = (vh - (titleH + gap + coverSize)) / 2;
  const titleY = blockTop + titleH / 2;
  const coverY = blockTop + titleH + gap + coverSize / 2;
  const leftX = POS.splitX * vw;
  const rightX = (1 - POS.splitX) * vw;
  const dockShift = (POS.splitX - POS.dockX) * vw;

  /* ---- 初始状态 ---- */
  gsap.set(title, {
    left: vw / 2,
    top: (POS.titleStartY + POS.titleRise) * vh,
    xPercent: -50,
    yPercent: -50,
    height: titleH,
    opacity: 0,
  });
  gsap.set(langs[0], { opacity: 1 });

  // 抽屉内容置于分裂后的位置，再整体推回中线之后（被 .op-drawer 裁切隐藏）
  gsap.set(cover, {
    left: leftX,
    top: coverY,
    xPercent: -50,
    yPercent: -50,
    width: coverSize,
    height: coverSize,
    x: vw / 2 - (leftX - coverSize / 2),
  });
  // 注意：#op-staff 的包含块是右抽屉（起点在 50vw），left 用抽屉局部坐标
  gsap.set(staff, { left: rightX - vw / 2, top: vh / 2, xPercent: -50, yPercent: -50 });
  const staffW = staff.offsetWidth;
  gsap.set(staff, { x: -(rightX - vw / 2 + staffW / 2) });

  /* ---- 入场时间轴 ---- */
  const tl = gsap.timeline();

  // 1 标题升起淡入 + 停留
  tl.to(title, {
    top: POS.titleStartY * vh,
    opacity: 1,
    duration: T.titleIn,
    ease: 'power2.out',
  });
  tl.to({}, { duration: T.titleHold });

  // 2 短线段自正中向上下射出
  tl.add('line');
  tl.to(line, { scaleY: 1, duration: T.lineGrow, ease: 'power4.out' }, 'line');

  // 双边像抽屉一样自线段后拉出（同始同终）；标题同时移至封面正上方
  tl.add('split', `line+=${T.lineGrow * 0.5}`);
  tl.to(cover, { x: 0, duration: T.split, ease: 'power3.out' }, 'split');
  tl.to(staff, { x: 0, duration: T.split, ease: 'power3.out' }, 'split');
  tl.to(
    title,
    { left: leftX, top: titleY, duration: T.split, ease: 'power3.inOut' },
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

  // 3 线段消失，光环中点浮现，双边继续靠边让位
  tl.to(line, { opacity: 0, duration: T.lineOut, ease: 'power1.in' });
  tl.add(halo.showDot(T.dotIn));
  tl.add('dock');
  tl.to(
    cover,
    { x: -dockShift, scale: POS.dockScale, duration: T.dock, ease: 'power2.inOut' },
    'dock'
  );
  tl.to(
    title,
    { left: leftX - dockShift, scale: POS.dockScale, duration: T.dock, ease: 'power2.inOut' },
    'dock'
  );
  tl.to(
    staff,
    { x: dockShift, scale: POS.dockScale, duration: T.dock, ease: 'power2.inOut' },
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
