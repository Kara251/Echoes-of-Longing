import * as THREE from 'three';

/**
 * 钢铁大陆（可变化大陆）—— Decagrammaton 的大陆本体，正在沉没于海。
 *
 * 中心在宫殿正下方（世界原点 XZ），占地约为宫殿的三倍（半径 ≈ √3×）。
 * 算法生成：圆盘上密铺高低不一的钢铁台块 + 顶面细碎结构（符合原著
 * 「可变化大陆」的不规则体素质感）。中心偏高、边缘低伏成滩，读作一块
 * 缓缓没入水面的大陆。整块随时间下沉（cut 驱动 group.position.y）。
 * InstancedMesh，形态由种子决定；下沉是连续位移，seek 安全。
 */
const TOP = 0xdfe9f4;
const FACE = 0xc7d6e5;
const SIDE = 0xaebfd0;
const WET = 0x7f93a8; // 近水线的湿冷色
const PANEL = 0x5f7183;

export class Continent {
  constructor(
    scene,
    { center = new THREE.Vector3(0, -70, 0), radius = 95, seed = 20260707, rings = 26 } = {}
  ) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.copy(center);

    let s = seed >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const signed = () => rnd() * 2 - 1;

    const mats = new THREE.Vector3();
    const boxes = [];
    const colors = [];
    const color = new THREE.Color();
    const push = (x, y, z, sx, sy, sz, hex, jitter = 0.05) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion(),
        mats.set(sx, sy, sz)
      );
      boxes.push(m.clone());
      color.setHex(hex);
      if (hex !== PANEL) color.offsetHSL(0, 0, signed() * jitter);
      colors.push(color.clone());
    };

    // 大陆剖面：中心高、边缘低（岛形），顶面在 0 上下、随半径下沉成滩。
    const profile = (r) => {
      const t = r / radius; // 0 中心 → 1 边缘
      return 7.5 * (1 - t * t) - t * 3.2; // 中心 +7.5，边缘 -3.2
    };

    for (let ri = 0; ri < rings; ri++) {
      const r0 = (ri / rings) * radius;
      const r1 = ((ri + 1) / rings) * radius;
      const rMid = (r0 + r1) * 0.5;
      const circumference = Math.PI * 2 * Math.max(rMid, 3);
      const cells = Math.max(6, Math.round(circumference / 6.4));
      const top = profile(rMid);

      for (let ci = 0; ci < cells; ci++) {
        if (ri > 2 && rnd() < 0.12 + (rMid / radius) * 0.35) continue; // 边缘更破碎
        const ang = (ci / cells) * Math.PI * 2 + signed() * 0.05;
        const rr = rMid + signed() * (r1 - r0) * 0.35;
        const x = Math.cos(ang) * rr;
        const z = Math.sin(ang) * rr;

        const plotW = (r1 - r0) * (0.7 + rnd() * 0.6);
        const plotD = plotW * (0.7 + rnd() * 0.7);
        const th = 6 + rnd() * 10; // 台块厚度（向下延伸）
        const topY = top + signed() * 1.6;

        const near = rnd() < 0.32;
        push(x, topY - th * 0.5, z, plotW, th, plotD, near ? WET : rnd() < 0.6 ? FACE : SIDE, 0.06);

        // 顶面台阶
        if (rnd() < 0.62) {
          const sw = plotW * (0.4 + rnd() * 0.4);
          const sd = plotD * (0.4 + rnd() * 0.4);
          const sh = 0.8 + rnd() * 2.4;
          push(
            x + signed() * plotW * 0.2,
            topY + sh * 0.5,
            z + signed() * plotD * 0.2,
            sw,
            sh,
            sd,
            rnd() < 0.7 ? TOP : FACE,
            0.05
          );
        }

        // 顶面细碎结构：塔、天线、机械嵌板（细腻感，中心区更密）
        const detail = rMid < radius * 0.6 ? 1 + Math.floor(rnd() * 3) : Math.floor(rnd() * 2);
        for (let d = 0; d < detail; d++) {
          const kind = rnd();
          const lx = x + signed() * plotW * 0.4;
          const lz = z + signed() * plotD * 0.4;
          if (kind < 0.4) {
            const tw = 0.6 + rnd() * 1.6;
            const tht = 1.5 + rnd() * 6;
            push(lx, topY + tht * 0.5, lz, tw, tht, tw, rnd() < 0.7 ? TOP : FACE, 0.05);
          } else if (kind < 0.62) {
            push(lx, topY + (2 + rnd() * 5), lz, 0.18, 3 + rnd() * 5, 0.18, SIDE, 0.03); // 天线
          } else if (kind < 0.85) {
            push(lx, topY + 0.4, lz, 0.8 + rnd() * 1.6, 0.5, 0.8 + rnd() * 1.6, PANEL, 0); // 嵌板
          } else {
            const bw = 1.2 + rnd() * 2.6;
            push(lx, topY + 0.8, lz, bw, 1.4 + rnd() * 1.6, bw * (0.6 + rnd() * 0.5), rnd() < 0.6 ? FACE : SIDE, 0.05);
          }
        }
      }
    }

    const box = new THREE.BoxGeometry(1, 1, 1);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, opacity: 0 });
    this.mesh = new THREE.InstancedMesh(box, this.mat, boxes.length);
    boxes.forEach((m, i) => this.mesh.setMatrixAt(i, m));
    colors.forEach((c, i) => this.mesh.setColorAt(i, c));
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    scene.add(this.group);

    this._box = box;
    this._baseY = center.y;
  }

  set opacity(v) {
    this.mat.opacity = v;
  }

  /** 下沉：相对基准下沉 depth 个单位（正数向下） */
  setSubmersion(depth) {
    this.group.position.y = this._baseY - depth;
  }

  dispose() {
    this.scene.remove(this.group);
    this.mesh.dispose();
    this._box.dispose();
    this.mat.dispose();
  }
}
