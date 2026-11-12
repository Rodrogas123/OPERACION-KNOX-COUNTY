import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { ui } from './ui.js';

export function createWeapons(camera, manager, onFire) {
  const listener = new THREE.AudioListener(); camera.add(listener);
  const audioLoader = new THREE.AudioLoader(manager), gltfLoader = new GLTFLoader(manager);
  const sound = (file, vol = 1) => {
    const s = new THREE.Audio(listener); s.setVolume(vol);
    audioLoader.load('assets/' + file, (b) => s.setBuffer(b), undefined, () => console.warn('Falta audio:', file));
    return s;
  };
  // Un único sonido de recarga compartido por ambas armas
  const reloadSnd = sound(CONFIG.reloadSound, 0.7);

  const holder = new THREE.Group(); holder.position.set(0.35, -0.3, -0.5); camera.add(holder);
  const baseZ = holder.position.z;

  const list = {};
  for (const [id, c] of Object.entries(CONFIG.weapons)) {
    const w = (list[id] = { ...c, id: +id, cur: c.mag, res: c.reserve, reloading: false, timer: null,
                            group: new THREE.Group(), shotSnd: sound(c.shot) });
    w.group.visible = false; w.group.position.set(...c.pos); holder.add(w.group);
    gltfLoader.load('assets/' + c.file, (g) => {
      g.scene.scale.setScalar(c.scale); g.scene.rotation.y = c.rotY;
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        if (c.material) {
          const { accents, ...m } = c.material;
          o.material = new THREE.MeshStandardMaterial({ ...m, color: accents?.[o.material.name] ?? m.color, side: THREE.DoubleSide });
        }
      });
      w.group.add(g.scene);
    }, undefined, (e) => console.error('Error cargando', c.file, e));
  }
  let cur = list[1]; cur.group.visible = true;

  function cancelReload() {
    if (!cur.reloading) return;
    clearTimeout(cur.timer); cur.reloading = false;
    if (reloadSnd.isPlaying) reloadSnd.stop();
  }
  function select(id) {
    if (!list[id] || cur === list[id]) return;
    cancelReload(); cur.group.visible = false; cur = list[id]; cur.group.visible = true;
    ui.slot(id); ui.hud(cur);
  }
  function reload() {
    const w = cur;
    if (w.reloading || w.cur >= w.mag || w.res <= 0) return;
    const n = Math.min(w.mag - w.cur, w.res);
    w.reloading = true; ui.hud(w);
    if (reloadSnd.buffer) { if (reloadSnd.isPlaying) reloadSnd.stop(); reloadSnd.play(); }
    const ms = (reloadSnd.buffer ? reloadSnd.buffer.duration : 1.8) * 1000;
    w.timer = setTimeout(() => { w.cur += n; w.res -= n; w.reloading = false; ui.hud(w); }, ms);
  }

  function fire() {
    const w = cur;
    if (w.reloading) return;
    if (w.cur <= 0) { reload(); return; }
    w.cur--; ui.hud(w);
    if (w.shotSnd.buffer) { if (w.shotSnd.isPlaying) w.shotSnd.stop(); w.shotSnd.play(); }
    holder.position.z = baseZ + w.recoil;
    onFire();
  }
  return {
    fire, reload, select,
    update(dt) { holder.position.z += (baseZ - holder.position.z) * Math.min(1, dt * 12); },
    addAmmo() { for (const id in list) list[id].res += CONFIG.ammoPack[id]; ui.hud(cur); },
    refresh() { ui.hud(cur); },
  };
}
