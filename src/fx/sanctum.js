import * as THREE from 'three';

/**
 * 钢铁殿堂 —— Decagrammaton 的殿堂光环（参考 ED 开头的白色体素环系）。
 *
 * 「由好到坏」的崩解演出：
 *  - 白色钢铁环初始致密完整（仅少量原生缺口），每块拥有自己的崩解时刻，
 *    到点后外抛/坠落/翻滚，并在数秒内收缩消散；崩解时刻后段加速分布，
 *    前奏结束时殿堂已明显分崩离析。
 *  - 金色光环初始为**完整一圈**（贴外环上缘的光带），逐渐碎散上浮，
 *    在前奏后段完全消失。
 *
 * 所有块的状态都是绝对时间 t 的纯函数（固定随机种子），seek 安全。
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
    decayStart = 3, // 白块最早崩解时刻
    decaySpan = 19, // 崩解时刻分布跨度（后段加速）
    breakRatio = 0.62, // 前奏内会崩解的结构比例
    goldCount = 130, // 金环块数（完整一圈）
    goldRingIndex = 3, // 金环所处层（自上往下）
    goldBreakStart = 4, // 金环开始破碎时刻
    goldBreakSpan = 13, // 破碎沿圆周蔓延一圈所需时间
  } = {}) {
    this.group = new THREE.Group();

    // 可复现实验的伪随机（重进 cut 时殿堂形态一致）
    let s = seed;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const white = [];
    const gold = [];
    const euler = new THREE.Euler();
    const yaw = new THREE.Quaternion();

    /**
     * 棱角分明的结构簇：主板块 + 若干贴面堆叠的子块（直角拼接，
     * 同一切向坐标系、无随机倾斜），整簇共享崩解时刻与抛出方向。
     */
    const pushCluster = (list, ang, radius, y, big) => {
      euler.set(0, -ang + Math.PI / 2, 0);
      yaw.setFromEuler(euler);
      const slotPos = new THREE.Vector3(Math.cos(ang) * radius, y, Math.sin(ang) * radius);
      const outward = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));

      // 主板块（切向拉长；少数是「巨舰级」大块）
      const main = new THREE.Vector3(
        (big ? 4.2 : 2.0) + rnd() * (big ? 3.0 : 2.2),
        (big ? 1.6 : 0.8) + rnd() * (big ? 1.2 : 0.7),
        (big ? 1.6 : 1.0) + rnd() * 0.9
      );
      const tBreak =
        rnd() < breakRatio ? decayStart + decaySpan * Math.pow(rnd(), 1.6) : Infinity;
      const baseVel = outward
        .clone()
        .multiplyScalar(0.5 + rnd() * 1.3)
        .add(new THREE.Vector3((rnd() - 0.5) * 0.4, -(0.2 + rnd() * 0.6), (rnd() - 0.5) * 0.4));
      const dissolve = 3.5 + rnd() * 3;

      const pushBox = (local, size) => {
        list.push({
          pos: slotPos.clone().add(local.applyQuaternion(yaw)),
          quat: yaw.clone(),
          scale: size,
          tBreak: tBreak === Infinity ? Infinity : tBreak + rnd() * 0.5,
          vel: baseVel
            .clone()
            .add(new THREE.Vector3((rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.5)),
          angVel: new THREE.Vector3((rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.6),
          gravity: -1.1,
          dissolve: dissolve + rnd() * 0.8,
        });
      };

      pushBox(new THREE.Vector3(0, 0, 0), main.clone());

      // 子块：贴主板块的面直角堆叠（顶部 / 端部 / 径向侧）
      const subs = 1 + Math.floor(rnd() * 3);
      for (let c = 0; c < subs; c++) {
        const size = new THREE.Vector3(
          main.x * (0.2 + rnd() * 0.4),
          main.y * (0.3 + rnd() * 0.6),
          main.z * (0.3 + rnd() * 0.5)
        );
        const axis = rnd();
        const local = new THREE.Vector3(
          (rnd() - 0.5) * main.x * 0.7,
          0,
          (rnd() - 0.5) * main.z * 0.4
        );
        if (axis < 0.5) {
          local.y = (main.y + size.y) / 2; // 顶部堆叠
        } else if (axis < 0.8) {
          local.x = (Math.sign(rnd() - 0.5) || 1) * ((main.x + size.x) / 2); // 端部延伸
          local.z = (rnd() - 0.5) * main.z * 0.3;
        } else {
          local.z = (Math.sign(rnd() - 0.5) || 1) * ((main.z + size.z) / 2); // 径向外挂
        }
        pushBox(local, size);
      }
    };

    // —— 白色钢铁环：致密整齐的棱角结构带 ——
    for (let i = 0; i < rings; i++) {
      const radius = baseRadius - i * radiusStep;
      const y = i * yStep;
      const slots = Math.max(16, Math.round(radius * 2));

      for (let k = 0; k < slots; k++) {
        if (rnd() < 0.06) continue; // 少量原生缺口
        const ang = (k / slots) * Math.PI * 2 + (rnd() - 0.5) * 0.01;
        pushCluster(white, ang, radius + (rnd() - 0.5) * 0.4, y + (rnd() - 0.5) * 0.3, rnd() < 0.1);
      }
    }

    // —— 金色光环：完整一圈；破碎自随机起点沿圆周蔓延（引信式），
    //    先崩离漂散、后收缩消逝，「由完整圆环破碎消逝」的过程一眼可读 ——
    const goldR = baseRadius - goldRingIndex * radiusStep + 0.4;
    const goldY = goldRingIndex * yStep + 0.9;
    const fuseStart = rnd() * Math.PI * 2;
    for (let j = 0; j < goldCount; j++) {
      const ang = (j / goldCount) * Math.PI * 2 + (rnd() - 0.5) * 0.01;
      const pos = new THREE.Vector3(Math.cos(ang) * goldR, goldY + (rnd() - 0.5) * 0.25, Math.sin(ang) * goldR);
      euler.set(0, -ang + Math.PI / 2, 0);
      const outward = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const fuse = ((ang - fuseStart) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

      gold.push({
        pos,
        quat: new THREE.Quaternion().setFromEuler(euler),
        scale: new THREE.Vector3(1.7, 0.42, 0.5),
        tBreak: goldBreakStart + (fuse / (Math.PI * 2)) * goldBreakSpan + rnd() * 0.8,
        vel: outward
          .multiplyScalar(0.4 + rnd() * 0.8)
          .add(new THREE.Vector3(0, 0.15 + rnd() * 0.35, 0)), // 火星式上浮
        angVel: new THREE.Vector3((rnd() - 0.5) * 2.2, (rnd() - 0.5) * 2.2, (rnd() - 0.5) * 2.2),
        gravity: -0.25,
        dissolve: 3.5 + rnd() * 2,
      });
    }

    this._records = { white, gold };

    const box = new THREE.BoxGeometry(1, 1, 1);
    this.whiteMat = new THREE.MeshStandardMaterial({
      color: WHITE,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0,
    });
    this.goldMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0 });

    this.white = new THREE.InstancedMesh(box, this.whiteMat, white.length);
    this.gold = new THREE.InstancedMesh(box, this.goldMat, gold.length);
    this.white.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gold.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.white, this.gold);

    this._box = box;
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._sc = new THREE.Vector3();
    this._e = new THREE.Euler();
    this._qd = new THREE.Quaternion();
    this._q = new THREE.Quaternion();
  }

  /** 整体不透明度（淡入淡出） */
  set opacity(v) {
    this.whiteMat.opacity = v;
    this.goldMat.opacity = v;
  }

  /** 崩解状态 = f(t)：seek 到任何时刻画面都正确 */
  update(t) {
    this.group.rotation.y = t * 0.015;
    this._apply(this.white, this._records.white, t);
    this._apply(this.gold, this._records.gold, t);
  }

  _apply(mesh, records, t) {
    const { _m: m, _p: p, _sc: sc, _e: e, _qd: qd, _q: q } = this;
    for (let i = 0; i < records.length; i++) {
      const it = records[i];
      const dt = t - it.tBreak;
      if (dt <= 0) {
        m.compose(it.pos, it.quat, it.scale);
      } else {
        const k = Math.max(0, 1 - dt / it.dissolve);
        if (k <= 0) {
          m.makeScale(0, 0, 0);
        } else {
          p.copy(it.pos).addScaledVector(it.vel, dt);
          p.y += 0.5 * it.gravity * dt * dt;
          e.set(it.angVel.x * dt, it.angVel.y * dt, it.angVel.z * dt);
          qd.setFromEuler(e);
          q.multiplyQuaternions(it.quat, qd);
          sc.copy(it.scale).multiplyScalar(k);
          m.compose(p, q, sc);
        }
      }
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.white.dispose();
    this.gold.dispose();
    this._box.dispose();
    this.whiteMat.dispose();
    this.goldMat.dispose();
  }
}
