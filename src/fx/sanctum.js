import * as THREE from 'three';

/**
 * 钢铁殿堂 —— Decagrammaton 的殿堂光环（参考 ED 开头的白色体素环系）。
 *
 * 「由好到坏」的崩解演出：
 *  - 白色钢铁环初始致密完整，每个环段是「主板块 + 贴面直角堆叠的
 *    子结构」（顶部堆叠 / 薄面板 / 端部延伸 / 径向外挂 / 天线），
 *    不规则完全来自棱角分明的形体相加；少量子块用深铜色嵌板点缀
 *    （instanceColor），纹理由算法随机生成——**每次页面加载一个新的
 *    钢铁大陆**（会话内种子固定，seek 一致），实例化渲染无性能负担。
 *  - 每簇拥有自己的崩解时刻（后段加速），到点后整簇外抛/坠落/翻滚
 *    并收缩消散。
 *  - 金色光环初始为完整一圈，于 goldDissolveAt 一刻**整环同时向上
 *    消散成粒子**（块体瞬时收缩 + 粒子云上浮淡出，GPU shader 驱动）。
 *
 * 所有状态都是绝对时间 t 的纯函数，seek 安全。
 */
const WHITE = 0xedf2fa;
const BRONZE = 0x76614d; // 深铜色嵌板（MV 中白块上的暗色面板）
const GOLD = 0xffe9a8;
const PARTICLES_PER_BLOCK = 8;

// 会话种子：每次加载生成一次，本次播放内（含 seek 重建）保持一致
const SESSION_SEED = (Math.random() * 0xffffffff) >>> 0;

export class Sanctum {
  constructor({
    rings = 5,
    baseRadius = 34, // 最外（最上）层半径
    radiusStep = 6,
    yStep = -3.6, // 每层向下
    seed = SESSION_SEED,
    decayStart = 3, // 白簇最早崩解时刻
    decaySpan = 19, // 崩解时刻分布跨度（后段加速）
    breakRatio = 0.62, // 前奏内会崩解的结构比例
    goldCount = 130, // 金环块数（完整一圈）
    goldRingIndex = 3, // 金环所处层（自上往下）
    goldDissolveAt = 7, // 金环整环同时消散的时刻
  } = {}) {
    this.group = new THREE.Group();
    this.goldDissolveAt = goldDissolveAt;

    let s = seed;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };

    const white = [];
    const whiteColors = [];
    const gold = [];
    const euler = new THREE.Euler();
    const yaw = new THREE.Quaternion();
    const cWhite = new THREE.Color(WHITE);
    const cBronze = new THREE.Color(BRONZE);
    const cTmp = new THREE.Color();

    /**
     * 棱角分明的结构簇：主板块 + 若干贴面直角堆叠的子结构，
     * 同一切向坐标系、无随机倾斜；整簇共享崩解时刻与抛出方向。
     */
    const pushCluster = (ang, radius, y, big) => {
      euler.set(0, -ang + Math.PI / 2, 0);
      yaw.setFromEuler(euler);
      const slotPos = new THREE.Vector3(Math.cos(ang) * radius, y, Math.sin(ang) * radius);
      const outward = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));

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

      const pushBox = (local, size, dark) => {
        white.push({
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
        // 白块带 ±4% 冷调差；子结构 12% 概率是深铜色嵌板
        cTmp.copy(dark ? cBronze : cWhite);
        if (!dark) cTmp.offsetHSL(0, 0, (rnd() - 0.5) * 0.05);
        whiteColors.push(cTmp.clone());
      };

      pushBox(new THREE.Vector3(0, 0, 0), main.clone(), false);

      // 子结构：2–5 个，按类型贴面直角拼接
      const subs = 2 + Math.floor(rnd() * 4);
      for (let c = 0; c < subs; c++) {
        const kind = rnd();
        const dark = rnd() < 0.12;
        const local = new THREE.Vector3(
          (rnd() - 0.5) * main.x * 0.7,
          0,
          (rnd() - 0.5) * main.z * 0.4
        );
        let size;
        if (kind < 0.3) {
          // 顶部堆叠块
          size = new THREE.Vector3(
            main.x * (0.2 + rnd() * 0.4),
            main.y * (0.4 + rnd() * 0.7),
            main.z * (0.35 + rnd() * 0.5)
          );
          local.y = (main.y + size.y) / 2;
        } else if (kind < 0.55) {
          // 薄面板：贴顶或贴侧的板线
          size = new THREE.Vector3(
            main.x * (0.35 + rnd() * 0.55),
            0.08 + rnd() * 0.08,
            main.z * (0.5 + rnd() * 0.55)
          );
          local.y = (main.y + size.y) / 2;
        } else if (kind < 0.78) {
          // 端部延伸
          size = new THREE.Vector3(
            main.x * (0.25 + rnd() * 0.45),
            main.y * (0.35 + rnd() * 0.55),
            main.z * (0.35 + rnd() * 0.5)
          );
          local.x = (rnd() < 0.5 ? -1 : 1) * ((main.x + size.x) / 2);
          local.z = (rnd() - 0.5) * main.z * 0.3;
        } else if (kind < 0.92) {
          // 径向外挂舱
          size = new THREE.Vector3(
            main.x * (0.2 + rnd() * 0.3),
            main.y * (0.3 + rnd() * 0.5),
            main.z * (0.3 + rnd() * 0.4)
          );
          local.z = (rnd() < 0.5 ? -1 : 1) * ((main.z + size.z) / 2);
        } else {
          // 天线 / 桅杆
          size = new THREE.Vector3(0.1 + rnd() * 0.1, 0.9 + rnd() * 1.5, 0.1 + rnd() * 0.1);
          local.y = (main.y + size.y) / 2;
        }
        pushBox(local, size, dark);
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
        pushCluster(ang, radius + (rnd() - 0.5) * 0.4, y + (rnd() - 0.5) * 0.3, rnd() < 0.1);
      }
    }

    // —— 金色光环：完整一圈；goldDissolveAt 一刻整环同时消散 ——
    const goldR = baseRadius - goldRingIndex * radiusStep + 0.4;
    const goldY = goldRingIndex * yStep + 0.9;
    for (let j = 0; j < goldCount; j++) {
      const ang = (j / goldCount) * Math.PI * 2 + (rnd() - 0.5) * 0.01;
      euler.set(0, -ang + Math.PI / 2, 0);
      gold.push({
        pos: new THREE.Vector3(
          Math.cos(ang) * goldR,
          goldY + (rnd() - 0.5) * 0.25,
          Math.sin(ang) * goldR
        ),
        quat: new THREE.Quaternion().setFromEuler(euler),
        scale: new THREE.Vector3(1.7, 0.42, 0.5),
        tBreak: goldDissolveAt + rnd() * 0.15, // 全部同时（微抖动防机械感）
        vel: new THREE.Vector3(0, 0.4 + rnd() * 0.3, 0),
        angVel: new THREE.Vector3((rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2),
        gravity: 0,
        dissolve: 0.5, // 块体快速收缩，视觉交给粒子云
      });
    }

    this._records = { white, gold };

    const box = new THREE.BoxGeometry(1, 1, 1);
    this.whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
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
    whiteColors.forEach((c, i) => this.white.setColorAt(i, c));
    this.white.instanceColor.needsUpdate = true;
    this.group.add(this.white, this.gold);

    // —— 金环消散粒子云（GPU shader 驱动，纯 t 函数）——
    const pCount = goldCount * PARTICLES_PER_BLOCK;
    const aPos = new Float32Array(pCount * 3);
    const aVel = new Float32Array(pCount * 3);
    const aLife = new Float32Array(pCount);
    const aDelay = new Float32Array(pCount);
    const aSize = new Float32Array(pCount);
    gold.forEach((g, gi) => {
      for (let q = 0; q < PARTICLES_PER_BLOCK; q++) {
        const idx = gi * PARTICLES_PER_BLOCK + q;
        aPos[idx * 3] = g.pos.x + (rnd() - 0.5) * 1.6;
        aPos[idx * 3 + 1] = g.pos.y + (rnd() - 0.5) * 0.4;
        aPos[idx * 3 + 2] = g.pos.z + (rnd() - 0.5) * 0.6;
        aVel[idx * 3] = (rnd() - 0.5) * 0.5;
        aVel[idx * 3 + 1] = 1.1 + rnd() * 1.6; // 向上
        aVel[idx * 3 + 2] = (rnd() - 0.5) * 0.5;
        aLife[idx] = 2.2 + rnd() * 1.8;
        aDelay[idx] = rnd() * 0.35;
        aSize[idx] = 0.14 + rnd() * 0.22;
      }
    });
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
    pGeo.setAttribute('aVel', new THREE.BufferAttribute(aVel, 3));
    pGeo.setAttribute('aLife', new THREE.BufferAttribute(aLife, 1));
    pGeo.setAttribute('aDelay', new THREE.BufferAttribute(aDelay, 1));
    pGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    this._pUniforms = {
      uT: { value: 0 },
      uT0: { value: goldDissolveAt },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(GOLD) },
      uScale: { value: window.innerHeight * 1.2 },
    };
    this.particles = new THREE.Points(
      pGeo,
      new THREE.ShaderMaterial({
        uniforms: this._pUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec3 aVel;
          attribute float aLife;
          attribute float aDelay;
          attribute float aSize;
          uniform float uT;
          uniform float uT0;
          uniform float uScale;
          varying float vAlpha;
          void main() {
            float age = uT - uT0 - aDelay;
            float k = clamp(age / aLife, 0.0, 1.0);
            vec3 p = position + aVel * max(age, 0.0) * (1.0 - 0.35 * k); // 减速上升
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 22.0) * (1.0 - 0.5 * k);
            vAlpha = (age > 0.0 && k < 1.0) ? (1.0 - k) : 0.0;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float soft = smoothstep(0.5, 0.12, d);
            gl_FragColor = vec4(uColor * 1.4, vAlpha * soft * uOpacity);
          }
        `,
      })
    );
    this.particles.frustumCulled = false;
    this.group.add(this.particles);

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
    this._pUniforms.uOpacity.value = v;
  }

  /** 崩解状态 = f(t)：seek 到任何时刻画面都正确 */
  update(t) {
    this.group.rotation.y = t * 0.015;
    this._pUniforms.uT.value = t;
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
    this.particles.geometry.dispose();
    this.particles.material.dispose();
  }
}
