import * as THREE from 'three';

/**
 * 钢铁殿堂 —— Decagrammaton 的白色机械环系。
 *
 * 随机生成是设计要求：每次加载生成一座新的钢铁大陆，但随机只负责布局，
 * 不负责把画面打碎成噪声。每个结构簇都由主块、贴面、端舱、外挂舱、
 * 细桅和少量深冷灰机械嵌板组成，整体保持冷白钢铁质感。
 *
 * 真光环是连续 torus shader：完整光带向上漂散，再由粒子云延续。
 * 所有演出状态都是绝对时间 t 的纯函数，seek 安全。
 */
const STEEL_TOP = 0xe9f4ff;
const STEEL_FACE = 0xd8e7f4;
const STEEL_SIDE = 0xc4d6e6;
const STEEL_EDGE = 0x9fb5c8;
const PANEL = 0x687988;
const HALO = 0xffe9a8;
const TAU = Math.PI * 2;
const HALO_PARTICLES = 1400;
const SESSION_SEED = (Math.random() * 0xffffffff) >>> 0;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export class Sanctum {
  constructor({
    rings = 7,
    baseRadius = 46,
    radiusStep = 4.8,
    yStep = -2.65,
    seed = SESSION_SEED,
    decayStart = 7.8,
    decaySpan = 13.8,
    breakRatio = 0.58,
    haloRingIndex = 3,
    haloDissolveAt = 7.1,
  } = {}) {
    this.group = new THREE.Group();

    let s = seed;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const signed = () => rnd() * 2 - 1;

    const steel = [];
    const colors = [];
    const color = new THREE.Color();
    const euler = new THREE.Euler();
    const yaw = new THREE.Quaternion();

    const pushColor = (hex, lightJitter = 0.04) => {
      color.setHex(hex);
      if (hex !== PANEL) color.offsetHSL(0, 0, signed() * lightJitter);
      colors.push(color.clone());
    };

    const makeMotion = (ang, layer, anchor = false) => {
      const broken =
        !anchor && rnd() < breakRatio
          ? decayStart + decaySpan * Math.pow(rnd(), 1.45) + layer * 0.16
          : Infinity;
      const outward = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const tangent = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
      return {
        tBreak: broken,
        vel: outward
          .multiplyScalar(0.28 + rnd() * 0.95)
          .addScaledVector(tangent, signed() * 0.34)
          .add(new THREE.Vector3(signed() * 0.12, -0.08 + rnd() * 0.44, signed() * 0.12)),
        angVel: new THREE.Vector3(signed() * 1.25, signed() * 1.15, signed() * 1.25),
        gravity: -0.035 - rnd() * 0.045,
        dissolve: 4.6 + rnd() * 3.8,
        floatAmp: 0.16 + rnd() * 0.38,
        floatFreq: 0.32 + rnd() * 0.62,
        phase: rnd() * TAU,
      };
    };

    const pushBox = ({ origin, quat, local, size, motion, colorHex, jitter = 0 }) => {
      steel.push({
        pos: origin.clone().add(local.clone().applyQuaternion(quat)),
        quat: quat.clone(),
        scale: size.clone(),
        tBreak: motion.tBreak === Infinity ? Infinity : motion.tBreak + jitter + rnd() * 0.28,
        vel: motion.vel
          .clone()
          .add(new THREE.Vector3(signed() * 0.09, signed() * 0.09, signed() * 0.09)),
        angVel: motion.angVel
          .clone()
          .add(new THREE.Vector3(signed() * 0.24, signed() * 0.24, signed() * 0.24)),
        gravity: motion.gravity,
        dissolve: motion.dissolve + rnd() * 0.9,
        floatAmp: motion.floatAmp,
        floatFreq: motion.floatFreq,
        phase: motion.phase + rnd() * TAU,
      });
      pushColor(colorHex);
    };

    const buildCluster = (ang, radius, y, layer, big) => {
      euler.set(0, -ang + Math.PI / 2, 0);
      yaw.setFromEuler(euler);

      const origin = new THREE.Vector3(
        Math.cos(ang) * (radius + signed() * 0.28),
        y + signed() * 0.18,
        Math.sin(ang) * (radius + signed() * 0.28)
      );

      const main = new THREE.Vector3(
        (big ? 4.5 : 2.08) + rnd() * (big ? 3.35 : 2.48),
        (big ? 1.08 : 0.58) + rnd() * (big ? 1.02 : 0.68),
        (big ? 1.22 : 0.68) + rnd() * (big ? 0.92 : 0.58)
      );
      const anchor = layer < 2 && rnd() < 0.16;
      const motion = makeMotion(ang, layer, anchor);

      pushBox({
        origin,
        quat: yaw,
        local: new THREE.Vector3(0, 0, 0),
        size: main,
        motion,
        colorHex: rnd() < 0.62 ? STEEL_TOP : STEEL_FACE,
      });

      // 冷灰下缘压出厚度，近景才不会像纸片。
      if (rnd() < 0.84) {
        pushBox({
          origin,
          quat: yaw,
          local: new THREE.Vector3(signed() * main.x * 0.08, -main.y * 0.5 - 0.09, signed() * main.z * 0.08),
          size: new THREE.Vector3(main.x * (0.62 + rnd() * 0.28), 0.14 + rnd() * 0.16, main.z * (0.62 + rnd() * 0.28)),
          motion,
          colorHex: rnd() < 0.72 ? STEEL_SIDE : STEEL_EDGE,
          jitter: 0.08,
        });
      }

      const grooveCount = 2 + Math.floor(rnd() * (big ? 5 : 3));
      for (let i = 0; i < grooveCount; i++) {
        pushBox({
          origin,
          quat: yaw,
          local: new THREE.Vector3(
            signed() * main.x * 0.36,
            main.y * 0.5 + 0.035,
            signed() * main.z * 0.38
          ),
          size: new THREE.Vector3(
            main.x * (0.12 + rnd() * 0.26),
            0.035 + rnd() * 0.028,
            0.035 + rnd() * 0.055
          ),
          motion,
          colorHex: rnd() < 0.18 ? PANEL : STEEL_EDGE,
          jitter: 0.1 + rnd() * 0.22,
        });
      }

      const railCount = 1 + Math.floor(rnd() * (big ? 4 : 3));
      for (let i = 0; i < railCount; i++) {
        const side = rnd() < 0.5 ? -1 : 1;
        pushBox({
          origin,
          quat: yaw,
          local: new THREE.Vector3(
            signed() * main.x * 0.32,
            -main.y * 0.34 + signed() * main.y * 0.12,
            side * (main.z * 0.5 + 0.035)
          ),
          size: new THREE.Vector3(main.x * (0.18 + rnd() * 0.3), 0.08 + rnd() * 0.08, 0.055),
          motion,
          colorHex: STEEL_EDGE,
          jitter: 0.12 + rnd() * 0.25,
        });
      }

      if (rnd() < 0.78) {
        const strutCount = 1 + Math.floor(rnd() * (big ? 4 : 2));
        for (let i = 0; i < strutCount; i++) {
          pushBox({
            origin,
            quat: yaw,
            local: new THREE.Vector3(
              signed() * main.x * 0.46,
              -main.y * 0.5 - (0.34 + rnd() * 0.72),
              signed() * main.z * 0.44
            ),
            size: new THREE.Vector3(0.055 + rnd() * 0.055, 0.55 + rnd() * 1.15, 0.055 + rnd() * 0.055),
            motion,
            colorHex: rnd() < 0.75 ? STEEL_SIDE : STEEL_EDGE,
            jitter: 0.16 + rnd() * 0.28,
          });
        }
      }

      // 贴面直角子结构：顶块、薄板、端舱、径向外挂、桅杆。
      const subs = 3 + Math.floor(rnd() * (big ? 6 : 4));
      for (let i = 0; i < subs; i++) {
        const kind = rnd();
        const local = new THREE.Vector3(
          signed() * main.x * 0.34,
          0,
          signed() * main.z * 0.32
        );
        let size;
        let colorHex = rnd() < 0.64 ? STEEL_TOP : STEEL_FACE;

        if (kind < 0.28) {
          size = new THREE.Vector3(
            main.x * (0.18 + rnd() * 0.36),
            main.y * (0.32 + rnd() * 0.64),
            main.z * (0.28 + rnd() * 0.48)
          );
          local.y = (main.y + size.y) * 0.5;
        } else if (kind < 0.5) {
          size = new THREE.Vector3(
            main.x * (0.36 + rnd() * 0.52),
            0.07 + rnd() * 0.08,
            main.z * (0.42 + rnd() * 0.48)
          );
          local.y = (main.y + size.y) * 0.5 + 0.02;
          colorHex = rnd() < 0.18 ? STEEL_EDGE : colorHex;
        } else if (kind < 0.72) {
          size = new THREE.Vector3(
            main.x * (0.22 + rnd() * 0.42),
            main.y * (0.28 + rnd() * 0.5),
            main.z * (0.28 + rnd() * 0.46)
          );
          local.x = (rnd() < 0.5 ? -1 : 1) * ((main.x + size.x) * 0.5);
          local.z = signed() * main.z * 0.18;
        } else if (kind < 0.9) {
          size = new THREE.Vector3(
            main.x * (0.16 + rnd() * 0.28),
            main.y * (0.3 + rnd() * 0.48),
            main.z * (0.28 + rnd() * 0.42)
          );
          local.z = (rnd() < 0.5 ? -1 : 1) * ((main.z + size.z) * 0.5);
          colorHex = rnd() < 0.48 ? STEEL_SIDE : colorHex;
        } else {
          size = new THREE.Vector3(0.08 + rnd() * 0.08, 0.68 + rnd() * 1.38, 0.08 + rnd() * 0.08);
          local.y = (main.y + size.y) * 0.5;
          colorHex = rnd() < 0.65 ? STEEL_FACE : STEEL_SIDE;
        }

        if (rnd() < 0.065) colorHex = PANEL;
        pushBox({
          origin,
          quat: yaw,
          local,
          size,
          motion,
          colorHex,
          jitter: 0.12 + rnd() * 0.34,
        });
      }

      // 少量细长冷灰面板，模拟 ED 近景里块体表面的机械刻面。
      if (rnd() < 0.55) {
        const panelCount = 1 + Math.floor(rnd() * 3);
        for (let i = 0; i < panelCount; i++) {
          pushBox({
            origin,
            quat: yaw,
            local: new THREE.Vector3(signed() * main.x * 0.32, main.y * 0.52 + 0.035, signed() * main.z * 0.36),
            size: new THREE.Vector3(main.x * (0.16 + rnd() * 0.34), 0.045, 0.05 + rnd() * 0.08),
            motion,
            colorHex: rnd() < 0.22 ? PANEL : STEEL_EDGE,
            jitter: 0.18 + rnd() * 0.3,
          });
        }
      }
    };

    for (let layer = 0; layer < rings; layer++) {
      const radius = baseRadius - layer * radiusStep;
      const y = layer * yStep;
      const slots = Math.max(24, Math.round(radius * 1.32));
      for (let slot = 0; slot < slots; slot++) {
        if (rnd() < 0.075) continue;
        const ang = (slot / slots) * TAU + signed() * 0.012;
        buildCluster(ang, radius, y, layer, rnd() < 0.12);
      }
    }

    // 漂浮细碎片：比主体小得多，只强化破碎时的空间感。
    for (let i = 0; i < 180; i++) {
      const ang = rnd() * TAU;
      const radius = baseRadius * (0.38 + rnd() * 0.82);
      const layerY = -Math.abs(yStep) * (rnd() * (rings - 1));
      euler.set(signed() * 0.2, -ang + Math.PI / 2 + signed() * 0.22, signed() * 0.2);
      const quat = new THREE.Quaternion().setFromEuler(euler);
      const motion = makeMotion(ang, rings, false);
      motion.tBreak = decayStart + 2.2 + decaySpan * rnd();
      motion.vel.y += 0.24 + rnd() * 0.32;
      motion.gravity = -0.015;
      pushBox({
        origin: new THREE.Vector3(Math.cos(ang) * radius, layerY + signed() * 1.4, Math.sin(ang) * radius),
        quat,
        local: new THREE.Vector3(0, 0, 0),
        size: new THREE.Vector3(0.24 + rnd() * 0.95, 0.08 + rnd() * 0.26, 0.1 + rnd() * 0.34),
        motion,
        colorHex: rnd() < 0.7 ? STEEL_FACE : STEEL_SIDE,
        jitter: rnd() * 0.6,
      });
    }

    this._records = { steel };

    const box = new THREE.BoxGeometry(1, 1, 1);
    // 实体块使用面片伪光照：顶面白、侧面冷灰、底面略暗。
    // 近景大量看见底面时也不会被真实光照压成黑剪影。
    this.steelMats = [
      new THREE.MeshBasicMaterial({ color: 0xc5d5e3, transparent: true, opacity: 0 }),
      new THREE.MeshBasicMaterial({ color: 0xc5d5e3, transparent: true, opacity: 0 }),
      new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0 }),
      new THREE.MeshBasicMaterial({ color: 0x92a9bb, transparent: true, opacity: 0 }),
      new THREE.MeshBasicMaterial({ color: 0xd5e5f2, transparent: true, opacity: 0 }),
      new THREE.MeshBasicMaterial({ color: 0xd5e5f2, transparent: true, opacity: 0 }),
    ];

    this.steel = new THREE.InstancedMesh(box, this.steelMats, steel.length);
    this.steel.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    colors.forEach((c, i) => this.steel.setColorAt(i, c));
    this.steel.instanceColor.needsUpdate = true;
    this.group.add(this.steel);

    this._buildHalo({
      radius: baseRadius - haloRingIndex * radiusStep + 0.45,
      y: haloRingIndex * yStep + 0.92,
      t0: haloDissolveAt,
      rnd,
      signed,
    });

    this._box = box;
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._sc = new THREE.Vector3();
    this._e = new THREE.Euler();
    this._qd = new THREE.Quaternion();
    this._q = new THREE.Quaternion();
  }

  _buildHalo({ radius, y, t0, rnd, signed }) {
    this._haloUniforms = {
      uT: { value: 0 },
      uT0: { value: t0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(HALO) },
    };
    this.halo = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.13, 12, 256),
      new THREE.ShaderMaterial({
        uniforms: this._haloUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uT;
          uniform float uT0;
          varying vec2 vUv;
          varying float vAng;
          float hash(float n) { return fract(sin(n) * 43758.5453123); }
          void main() {
            vUv = uv;
            vAng = atan(position.y, position.x);
            float age = max(uT - uT0, 0.0);
            float k = clamp(age / 4.2, 0.0, 1.0);
            float n = hash(floor(vAng * 96.0) + floor(uv.y * 10.0) * 17.0);
            vec3 p = position;
            p.z -= k * k * (3.5 + n * 3.4);
            p.x += sin(age * 0.9 + n * 6.2831) * 0.34 * k;
            p.y += cos(age * 0.72 + n * 8.7) * 0.28 * k;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uT;
          uniform float uT0;
          uniform float uOpacity;
          uniform vec3 uColor;
          varying vec2 vUv;
          varying float vAng;
          float hash(float n) { return fract(sin(n) * 43758.5453123); }
          void main() {
            float age = max(uT - uT0, 0.0);
            float k = clamp(age / 4.0, 0.0, 1.0);
            float cell = floor(vAng * 144.0) + floor(vUv.y * 12.0) * 19.0;
            float shard = hash(cell);
            if (k > 0.04 && shard < k * 0.9) discard;
            float core = 1.0 - smoothstep(0.38, 0.5, abs(vUv.y - 0.5));
            float fade = 1.0 - smoothstep(0.05, 1.0, k);
            float alpha = uOpacity * (0.48 + 0.52 * core) * fade;
            gl_FragColor = vec4(uColor * (1.3 + core * 0.75), alpha);
          }
        `,
      })
    );
    this.halo.position.y = y;
    this.halo.rotation.x = Math.PI / 2;
    this.group.add(this.halo);

    this._particleUniforms = {
      uT: { value: 0 },
      uT0: { value: t0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(HALO) },
      uScale: { value: window.innerHeight * 1.16 },
    };
    const pGeo = new THREE.BufferGeometry();
    const aPos = new Float32Array(HALO_PARTICLES * 3);
    const aVel = new Float32Array(HALO_PARTICLES * 3);
    const aLife = new Float32Array(HALO_PARTICLES);
    const aDelay = new Float32Array(HALO_PARTICLES);
    const aSize = new Float32Array(HALO_PARTICLES);
    for (let i = 0; i < HALO_PARTICLES; i++) {
      const ang = (i / HALO_PARTICLES) * TAU + signed() * 0.04;
      const spread = signed() * 0.18;
      aPos[i * 3] = Math.cos(ang) * (radius + spread);
      aPos[i * 3 + 1] = y + signed() * 0.1;
      aPos[i * 3 + 2] = Math.sin(ang) * (radius + spread);
      aVel[i * 3] = signed() * 0.4;
      aVel[i * 3 + 1] = 1.1 + rnd() * 1.7;
      aVel[i * 3 + 2] = signed() * 0.4;
      aLife[i] = 2.15 + rnd() * 2.25;
      aDelay[i] = rnd() * 0.52;
      aSize[i] = 0.09 + rnd() * 0.2;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(aPos, 3));
    pGeo.setAttribute('aVel', new THREE.BufferAttribute(aVel, 3));
    pGeo.setAttribute('aLife', new THREE.BufferAttribute(aLife, 1));
    pGeo.setAttribute('aDelay', new THREE.BufferAttribute(aDelay, 1));
    pGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    this.haloParticles = new THREE.Points(
      pGeo,
      new THREE.ShaderMaterial({
        uniforms: this._particleUniforms,
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
            vec3 p = position + aVel * max(age, 0.0) * (1.0 - 0.34 * k);
            p.x += sin(age * 0.82 + position.z * 0.04) * 0.3 * k;
            p.z += cos(age * 0.68 + position.x * 0.04) * 0.3 * k;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 18.0) * (1.0 - 0.45 * k);
            vAlpha = (age > 0.0 && k < 1.0) ? (1.0 - k) : 0.0;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float soft = smoothstep(0.5, 0.08, d);
            gl_FragColor = vec4(uColor * 1.45, vAlpha * soft * uOpacity);
          }
        `,
      })
    );
    this.haloParticles.frustumCulled = false;
    this.group.add(this.haloParticles);
  }

  set opacity(v) {
    for (const mat of this.steelMats) mat.opacity = v;
    this._haloUniforms.uOpacity.value = v * 0.58;
    this._particleUniforms.uOpacity.value = v * 0.74;
  }

  update(t) {
    this.group.rotation.y = t * 0.014;
    this._haloUniforms.uT.value = t;
    this._particleUniforms.uT.value = t;
    this._apply(this.steel, this._records.steel, t);
  }

  _apply(mesh, records, t) {
    const { _m: m, _p: p, _sc: sc, _e: e, _qd: qd, _q: q } = this;
    for (let i = 0; i < records.length; i++) {
      const it = records[i];
      const dt = t - it.tBreak;
      if (dt <= 0) {
        m.compose(it.pos, it.quat, it.scale);
      } else {
        const k = clamp01(dt / it.dissolve);
        if (k >= 1) {
          m.makeScale(0, 0, 0);
        } else {
          const wander = Math.sin(dt * it.floatFreq + it.phase) * it.floatAmp;
          p.copy(it.pos).addScaledVector(it.vel, dt);
          p.x += Math.sin(dt * 0.37 + it.phase) * wander;
          p.y += 0.5 * it.gravity * dt * dt + Math.cos(dt * 0.53 + it.phase) * it.floatAmp;
          p.z += Math.cos(dt * 0.41 + it.phase) * wander;
          e.set(it.angVel.x * dt, it.angVel.y * dt, it.angVel.z * dt);
          qd.setFromEuler(e);
          q.multiplyQuaternions(it.quat, qd);
          sc.copy(it.scale).multiplyScalar(1 - k * k);
          m.compose(p, q, sc);
        }
      }
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.steel.dispose();
    this._box.dispose();
    for (const mat of this.steelMats) mat.dispose();
    this.halo.geometry.dispose();
    this.halo.material.dispose();
    this.haloParticles.geometry.dispose();
    this.haloParticles.material.dispose();
  }
}
