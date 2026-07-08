import * as THREE from 'three';

/**
 * 坠物入水 —— 上方宫殿崩落的钢铁碎块坠入海面，激起扩散涟漪与水花。
 *
 *  - 0:22–0:28 段：较大的钢铁块坠落；
 *  - 0:28 起：碎块「被分解为较小的颗粒」，更密更细，入水涟漪相互交叠启奏。
 *
 * 三部分都是绝对时间 t 的纯函数（预排程 + 弹道解析），seek 安全：
 *   1) 下坠碎块 InstancedMesh；2) 入水扩散环 InstancedMesh（自定义 shader）；
 *   3) 溅起水花 Points。入水时刻 = 弹道落到海面 uSeaY 的解析解。
 */
const STEEL = [0xe9f4ff, 0xd8e7f4, 0xc4d6e6, 0xaebfd0];
const HALO = 0xffe9a8;

export class FallingField {
  constructor(
    scene,
    { seaY = -70, seed = 77213, bigStart = 22, bigEnd = 28.6, fineStart = 27.4, fineEnd = 32.6 } = {}
  ) {
    this.scene = scene;
    this.seaY = seaY;
    this.group = new THREE.Group();

    let s = seed >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const signed = () => rnd() * 2 - 1;

    // —— 预排程碎块 ——
    const chunks = [];
    // 坠落点收拢到相机正视的近前海面（相机看向 ~(14,44)），入水反应更突出
    const spawnChunk = (t0, big) => {
      const ang = rnd() * Math.PI * 2;
      const rr = 4 + rnd() * 42;
      const x = 12 + Math.cos(ang) * rr;
      const z = 34 + Math.sin(ang) * rr;
      const y0 = seaY + 40 + rnd() * 34;
      const g = 8 + rnd() * 4;
      const tImpact = t0 + Math.sqrt((2 * (y0 - seaY)) / g);
      const sz = big ? 2.0 + rnd() * 3.4 : 0.4 + rnd() * 0.8;
      chunks.push({
        t0,
        tImpact,
        x,
        z,
        y0,
        g,
        vx: signed() * 1.2,
        vz: signed() * 1.2,
        size: new THREE.Vector3(sz * (0.7 + rnd() * 0.8), sz * (0.5 + rnd() * 0.6), sz * (0.7 + rnd() * 0.8)),
        rot: new THREE.Vector3(signed() * 2.4, signed() * 2.4, signed() * 2.4),
        quat0: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)),
        colorHex: rnd() < 0.12 ? HALO : STEEL[(rnd() * STEEL.length) | 0],
        strength: big ? 1.0 : 0.42 + rnd() * 0.3,
      });
    };

    const bigN = 36;
    for (let i = 0; i < bigN; i++) {
      const t0 = bigStart + (bigEnd - bigStart) * Math.pow(i / bigN, 0.9) + signed() * 0.3;
      spawnChunk(t0, true);
    }
    const fineN = 96;
    for (let i = 0; i < fineN; i++) {
      const t0 = fineStart + (fineEnd - fineStart) * (i / fineN) + signed() * 0.25;
      spawnChunk(t0, false);
    }
    this._chunks = chunks;

    // 碎块 mesh
    const box = new THREE.BoxGeometry(1, 1, 1);
    this._chunkMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
    this.chunkMesh = new THREE.InstancedMesh(box, this._chunkMat, chunks.length);
    this.chunkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.Color();
    chunks.forEach((c, i) => {
      col.setHex(c.colorHex);
      this.chunkMesh.setColorAt(i, col);
    });
    this.chunkMesh.instanceColor.needsUpdate = true;
    this.chunkMesh.frustumCulled = false;
    this.group.add(this.chunkMesh);
    this._box = box;

    // —— 入水扩散环（自定义 shader，实例 = 每次入水）——
    const ringGeo = new THREE.RingGeometry(0.82, 1.0, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const aData = new Float32Array(chunks.length * 3); // t0impact, maxScale, strength
    chunks.forEach((c, i) => {
      aData[i * 3] = c.tImpact;
      aData[i * 3 + 1] = (c.strength > 0.8 ? 20 : 9) + rnd() * 6;
      aData[i * 3 + 2] = c.strength;
    });
    ringGeo.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 3));
    this._ringUniforms = { uT: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xdfeefc) } };
    this.rings = new THREE.InstancedMesh(
      ringGeo,
      new THREE.ShaderMaterial({
        uniforms: this._ringUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          attribute vec3 aData;
          uniform float uT;
          varying float vAlpha;
          void main() {
            float age = uT - aData.x;
            float dur = 2.9;
            float k = clamp(age / dur, 0.0, 1.0);
            float scale = mix(0.6, aData.y, 1.0 - pow(1.0 - k, 2.2));
            vAlpha = (age > 0.0 && k < 1.0) ? (1.0 - k) * (1.0 - k) * aData.z : 0.0;
            vec3 p = position * scale;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vAlpha;
          void main() {
            gl_FragColor = vec4(uColor, vAlpha * uOpacity * 1.35);
          }
        `,
      }),
      chunks.length
    );
    const m = new THREE.Matrix4();
    chunks.forEach((c, i) => {
      m.makeTranslation(c.x, seaY + 0.06, c.z);
      this.rings.setMatrixAt(i, m);
    });
    this.rings.instanceMatrix.needsUpdate = true;
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 1;
    this.group.add(this.rings);

    // —— 入水白沫盘（比涟漪环更亮、更快的水面反应）——
    const foamGeo = new THREE.CircleGeometry(1, 36);
    foamGeo.rotateX(-Math.PI / 2);
    const fData = new Float32Array(chunks.length * 3); // t0, maxScale, strength
    chunks.forEach((c, i) => {
      fData[i * 3] = c.tImpact;
      fData[i * 3 + 1] = (c.strength > 0.8 ? 6.5 : 3) + rnd() * 2;
      fData[i * 3 + 2] = c.strength;
    });
    foamGeo.setAttribute('aData', new THREE.InstancedBufferAttribute(fData, 3));
    this._foamUniforms = { uT: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xf2f9ff) } };
    this.foam = new THREE.InstancedMesh(
      foamGeo,
      new THREE.ShaderMaterial({
        uniforms: this._foamUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          attribute vec3 aData;
          uniform float uT;
          varying float vAlpha;
          varying vec2 vXz;
          void main() {
            float age = uT - aData.x;
            float dur = 0.95;
            float k = clamp(age / dur, 0.0, 1.0);
            float scale = mix(0.5, aData.y, 1.0 - pow(1.0 - k, 3.0));
            vAlpha = (age > 0.0 && k < 1.0) ? pow(1.0 - k, 1.4) * aData.z : 0.0;
            vXz = position.xz;
            vec3 p = position * scale;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vAlpha;
          varying vec2 vXz;
          void main() {
            float edge = smoothstep(1.0, 0.35, length(vXz)); // 中心实、边缘软
            gl_FragColor = vec4(uColor, vAlpha * uOpacity * edge * 0.85);
          }
        `,
      }),
      chunks.length
    );
    chunks.forEach((c, i) => {
      m.makeTranslation(c.x, seaY + 0.05, c.z);
      this.foam.setMatrixAt(i, m);
    });
    this.foam.instanceMatrix.needsUpdate = true;
    this.foam.frustumCulled = false;
    this.foam.renderOrder = 1;
    this.group.add(this.foam);

    // —— 溅起水花 Points ——
    const drops = [];
    chunks.forEach((c) => {
      const n = c.strength > 0.8 ? 24 : 9;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const sp = (c.strength > 0.8 ? 4.2 : 1.8) * (0.5 + rnd());
        drops.push({
          t0: c.tImpact,
          x: c.x + Math.cos(a) * 0.5,
          z: c.z + Math.sin(a) * 0.5,
          vx: Math.cos(a) * sp,
          vz: Math.sin(a) * sp,
          vy: (c.strength > 0.8 ? 7.5 : 3.6) * (0.6 + rnd() * 0.7),
          life: 0.8 + rnd() * 0.8,
          size: 0.14 + rnd() * 0.2,
        });
      }
    });
    const dN = drops.length;
    const dPos = new Float32Array(dN * 3);
    const dVel = new Float32Array(dN * 3);
    const dMeta = new Float32Array(dN * 3); // t0, life, size
    drops.forEach((d, i) => {
      dPos[i * 3] = d.x;
      dPos[i * 3 + 1] = seaY + 0.1;
      dPos[i * 3 + 2] = d.z;
      dVel[i * 3] = d.vx;
      dVel[i * 3 + 1] = d.vy;
      dVel[i * 3 + 2] = d.vz;
      dMeta[i * 3] = d.t0;
      dMeta[i * 3 + 1] = d.life;
      dMeta[i * 3 + 2] = d.size;
    });
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dGeo.setAttribute('aVel', new THREE.BufferAttribute(dVel, 3));
    dGeo.setAttribute('aMeta', new THREE.BufferAttribute(dMeta, 3));
    this._dropUniforms = {
      uT: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(0xeef6ff) },
      uScale: { value: window.innerHeight * 1.1 },
      uG: { value: 9.0 },
    };
    this.drops = new THREE.Points(
      dGeo,
      new THREE.ShaderMaterial({
        uniforms: this._dropUniforms,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          attribute vec3 aVel;
          attribute vec3 aMeta;
          uniform float uT;
          uniform float uScale;
          uniform float uG;
          varying float vAlpha;
          void main() {
            float age = uT - aMeta.x;
            float k = clamp(age / aMeta.y, 0.0, 1.0);
            vec3 p = position + aVel * max(age, 0.0);
            p.y -= 0.5 * uG * max(age, 0.0) * max(age, 0.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = min(aMeta.z * uScale / max(-mv.z, 0.1), 20.0);
            vAlpha = (age > 0.0 && k < 1.0) ? (1.0 - k) : 0.0;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float soft = smoothstep(0.5, 0.1, d);
            gl_FragColor = vec4(uColor, vAlpha * soft * uOpacity);
          }
        `,
      })
    );
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 2;
    this.group.add(this.drops);

    scene.add(this.group);

    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._qd = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._sc = new THREE.Vector3();
  }

  set opacity(v) {
    this._chunkMat.opacity = v;
    this._ringUniforms.uOpacity.value = v;
    this._foamUniforms.uOpacity.value = v;
    this._dropUniforms.uOpacity.value = v;
  }

  update(t) {
    this._ringUniforms.uT.value = t;
    this._foamUniforms.uT.value = t;
    this._dropUniforms.uT.value = t;

    const { _m: m, _p: p, _q: q, _qd: qd, _e: e, _sc: sc } = this;
    const chunks = this._chunks;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (t < c.t0 || t >= c.tImpact) {
        m.makeScale(0, 0, 0);
      } else {
        const dt = t - c.t0;
        p.set(c.x + c.vx * dt, c.y0 - 0.5 * c.g * dt * dt, c.z + c.vz * dt);
        e.set(c.rot.x * dt, c.rot.y * dt, c.rot.z * dt);
        qd.setFromEuler(e);
        q.multiplyQuaternions(c.quat0, qd);
        m.compose(p, q, sc.copy(c.size));
      }
      this.chunkMesh.setMatrixAt(i, m);
    }
    this.chunkMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.chunkMesh.dispose();
    this._box.dispose();
    this._chunkMat.dispose();
    this.rings.dispose();
    this.rings.geometry.dispose();
    this.rings.material.dispose();
    this.foam.dispose();
    this.foam.geometry.dispose();
    this.foam.material.dispose();
    this.drops.geometry.dispose();
    this.drops.material.dispose();
  }
}
