import * as THREE from 'three';

/**
 * 光环 —— 全片核心视觉母题（封面上 Malkuth 头顶倾斜的巨环）。
 * 三种状态供 cut 调用：
 *   breathe  随低频呼吸（默认）
 *   ripple   周期性荡出扩散涟漪（副歌）
 *   shatter  碎裂成弧段飘散（终幕，对应 Ain-Soph Aur 的逝去）
 */
export function createHalo({ radius = 3, tube = 0.045, color = 0xf4ecc8 } = {}) {
  const group = new THREE.Group();
  group.rotation.set(0.9, 0, -0.28); // 封面式倾斜

  const haloColor = new THREE.Color(color).multiplyScalar(1.15); // 略超 1 → 恰好吃进 Bloom 而不过曝
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 16, 220),
    new THREE.MeshBasicMaterial({ color: haloColor })
  );
  group.add(ring);

  // 柔光内环
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube * 3.2, 16, 220),
    new THREE.MeshBasicMaterial({
      color: haloColor,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(glow);

  // 碎裂弧段（隐藏备用）
  const SHARDS = 42;
  const shards = new THREE.Group();
  shards.visible = false;
  const shardVel = [];
  for (let i = 0; i < SHARDS; i++) {
    const arc = (Math.PI * 2) / SHARDS;
    const seg = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 8, 6, arc * 0.82),
      new THREE.MeshBasicMaterial({ color: haloColor, transparent: true })
    );
    seg.rotation.z = i * arc;
    shards.add(seg);
    shardVel.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.9,
        Math.random() * 0.5 + 0.1,
        (Math.random() - 0.5) * 0.5
      )
    );
  }
  group.add(shards);

  let mode = 'breathe';
  let modeT = 0;
  const ripples = [];

  const api = {
    group,

    setMode(m) {
      if (mode === m) return;
      mode = m;
      modeT = 0;
      if (m === 'shatter') {
        ring.visible = false;
        glow.visible = false;
        shards.visible = true;
      } else {
        ring.visible = true;
        glow.visible = true;
        shards.visible = false;
        shards.children.forEach((s, i) => {
          s.position.set(0, 0, 0);
          s.material.opacity = 1;
        });
      }
      if (m === 'ripple') api._spawnRipple();
    },

    _spawnRipple() {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(radius, tube * 0.6, 8, 160),
        new THREE.MeshBasicMaterial({
          color: haloColor,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      group.add(r);
      ripples.push({ mesh: r, age: 0 });
    },

    update(t, dt, audio) {
      modeT += dt;
      const bass = audio ? audio.bass : 0;
      const beat = audio ? audio.beat : 0;

      if (mode === 'breathe') {
        const s = 1 + Math.sin(t * 0.9) * 0.015 + bass * 0.06;
        ring.scale.setScalar(s);
        glow.scale.setScalar(s);
        glow.material.opacity = 0.12 + bass * 0.25;
      } else if (mode === 'ripple') {
        const s = 1 + bass * 0.05;
        ring.scale.setScalar(s);
        glow.scale.setScalar(s);
        if (beat > 0.96) api._spawnRipple();
      } else if (mode === 'shatter') {
        shards.children.forEach((s, i) => {
          s.position.addScaledVector(shardVel[i], dt);
          s.rotation.x += dt * shardVel[i].x * 0.6;
          s.material.opacity = Math.max(0, 1 - modeT / 7);
        });
      }

      // 涟漪扩散与消散
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += dt;
        const k = 1 + r.age * 0.9;
        r.mesh.scale.setScalar(k);
        r.mesh.material.opacity = Math.max(0, 0.5 - r.age * 0.22);
        if (r.mesh.material.opacity <= 0) {
          group.remove(r.mesh);
          r.mesh.geometry.dispose();
          r.mesh.material.dispose();
          ripples.splice(i, 1);
        }
      }

      // 整体极缓慢进动，让环永远是"活"的
      group.rotation.z = -0.28 + Math.sin(t * 0.11) * 0.05;
    },

    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose?.();
        o.material?.dispose?.();
      });
    },
  };

  return api;
}
