import * as THREE from 'three';

/**
 * 钢铁殿堂 —— Decagrammaton 的殿堂光环（参考 ED 开头的白色体素环系）。
 * 程序化生成：多层同心「钢铁光环」，环体由白色方块簇构成、带随机缺口
 * （支离破碎感），沿环撒少量发光的淡金方块（Bloom 拾取），四周漂浮碎屑。
 * 返回的 group 由 cut 挂载/卸载；update(t) 驱动整体慢旋与碎块浮动。
 */
const WHITE = 0xedf2fa;
const GOLD = 0xffe9a8;

export class Sanctum {
  constructor({
    rings = 5,
    baseRadius = 34, // 最外（最上）层半径
    radiusStep = 6,
    yStep = -3.6, // 每层向下
    seed = 251,
  } = {}) {
    this.group = new THREE.Group();

    // 可复现实验的伪随机（重进 cut 时殿堂形态一致）
    let s = seed;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const whiteTransforms = [];
    const goldTransforms = [];
    const box = new THREE.BoxGeometry(1, 1, 1);

    const pushBlock = (list, pos, scale, rotY) => {
      const m = new THREE.Matrix4();
      m.compose(
        pos,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
        scale
      );
      list.push(m);
    };

    for (let i = 0; i < rings; i++) {
      const radius = baseRadius - i * radiusStep;
      const y = i * yStep;
      const slots = Math.max(18, Math.round(radius * 2.6));
      const tilt = (rnd() - 0.5) * 0.06; // 每层微倾，避免完美对齐

      for (let k = 0; k < slots; k++) {
        if (rnd() < 0.42) continue; // 缺口：支离破碎
        const ang = (k / slots) * Math.PI * 2;
        const clusterSize = 1 + Math.floor(rnd() * 3);

        for (let c = 0; c < clusterSize; c++) {
          const rr = radius + (rnd() - 0.5) * 1.6;
          const pos = new THREE.Vector3(
            Math.cos(ang) * rr,
            y + Math.sin(ang * 3 + i) * tilt * radius + (rnd() - 0.5) * 1.1,
            Math.sin(ang) * rr
          );
          // 沿切向拉长的白色块
          const scale = new THREE.Vector3(
            0.9 + rnd() * 2.6,
            0.7 + rnd() * 1.3,
            0.9 + rnd() * 1.2
          );
          if (rnd() < 0.07) {
            pushBlock(goldTransforms, pos, scale.multiplyScalar(0.7), ang + Math.PI / 2);
          } else {
            pushBlock(whiteTransforms, pos, scale, ang + Math.PI / 2);
          }
        }
      }
    }

    // 游离碎屑
    const debris = 90;
    for (let d = 0; d < debris; d++) {
      const ang = rnd() * Math.PI * 2;
      const rr = baseRadius * (0.35 + rnd() * 1.05);
      const pos = new THREE.Vector3(
        Math.cos(ang) * rr,
        (rnd() - 0.5) * rings * Math.abs(yStep) * 1.8,
        Math.sin(ang) * rr
      );
      const sBase = 0.35 + rnd() * 1.1;
      const scale = new THREE.Vector3(sBase * (1 + rnd()), sBase, sBase);
      pushBlock(rnd() < 0.06 ? goldTransforms : whiteTransforms, pos, scale, ang);
    }

    this.whiteMat = new THREE.MeshStandardMaterial({
      color: WHITE,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0,
    });
    this.goldMat = new THREE.MeshBasicMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0,
    });

    this.white = new THREE.InstancedMesh(box, this.whiteMat, whiteTransforms.length);
    whiteTransforms.forEach((m, idx) => this.white.setMatrixAt(idx, m));
    this.gold = new THREE.InstancedMesh(box, this.goldMat, goldTransforms.length);
    goldTransforms.forEach((m, idx) => this.gold.setMatrixAt(idx, m));

    this.group.add(this.white);
    this.group.add(this.gold);
    this._box = box;
  }

  /** 整体不透明度（淡入淡出） */
  set opacity(v) {
    this.whiteMat.opacity = v;
    this.goldMat.opacity = v;
  }

  /** 慢旋 + 呼吸级的整体浮动（逐块浮动成本高，整体足够） */
  update(t) {
    this.group.rotation.y = t * 0.02;
    this.group.position.y = Math.sin(t * 0.35) * 0.4;
  }

  dispose() {
    this.white.dispose();
    this.gold.dispose();
    this._box.dispose();
    this.whiteMat.dispose();
    this.goldMat.dispose();
  }
}
