import './styles.css';
import '@fontsource/shippori-mincho/400.css';
import '@fontsource/shippori-mincho/700.css';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/nanum-myeongjo/400.css';

import { Stage } from './core/stage.js';
import { MasterClock } from './core/clock.js';
import { AudioEngine } from './core/audio.js';
import { Director } from './core/director.js';
import { Hud } from './core/hud.js';
import { SONG } from './data/lyrics.js';
import { buildTimeline } from './data/timeline.js';

const params = new URLSearchParams(location.search);

const stage = new Stage({
  canvas: document.getElementById('gl'),
  cineLayer: document.getElementById('cine-layer'),
});
const audio = new AudioEngine();
const clock = new MasterClock(SONG.duration);
const director = new Director({ stage, clock, audio });
clock.onSeek((t) => director.handleSeek(t));

// 字体就绪后再装载导演（文字粒子等需要栅格化字体）
await document.fonts.ready;
await director.load(buildTimeline());

const hud = new Hud({ clock, director });
if (params.get('hud') === '1') hud.show();

/* ---- 入场仪式 ---- */
const gate = document.getElementById('gate');
const hint = document.getElementById('gate-hint');
const actions = document.getElementById('gate-actions');
const fileInput = document.getElementById('gate-file');

let started = false;
function start({ silent }) {
  if (started) return;
  started = true;

  if (!silent) {
    audio.ensureGraph(); // 必须在用户手势内
    clock.attachMedia(audio.el);
  }

  gate.classList.add('leaving');
  setTimeout(() => gate.remove(), 1800);
  stage.setVeil(0, 'opacity 3.5s ease');

  const t0 = parseFloat(params.get('t') || '0');
  if (t0 > 0) clock.seek(t0);
  clock.play();
}

const hasDefault = await audio.tryLoadDefault();
if (hasDefault) {
  hint.textContent = '点击光环，开始';
} else {
  hint.textContent = '未找到本地音源 — 可选择文件，或直接静默排演';
  actions.hidden = false;
}

document.getElementById('gate-halo').addEventListener('click', () => {
  start({ silent: !audio.el.src });
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  audio.loadFile(file);
  start({ silent: false });
});
document.getElementById('gate-silent').addEventListener('click', () => {
  start({ silent: true });
});

// ?silent=1：跳过入场直接静默排演（开发与自动化验证用）
if (params.get('silent') === '1') start({ silent: true });

/* ---- 主循环 ---- */
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  clock.update(dt);
  const f = audio.analyse(dt);
  director.update(clock.t, dt, f);
  hud.update();
  stage.render(dt, clock.t);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
