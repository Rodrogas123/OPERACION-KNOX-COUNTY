import * as THREE from 'three';
import { CONFIG } from './config.js';

export const obstacles = [];

export function createWorld(scene, renderer, manager) {
  scene.background = new THREE.Color(0x050608);
  scene.fog = new THREE.Fog(0x050608, 8, 55);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  // La luz direccional sigue al jugador para que el shadowMap cubra solo la zona cercana
  const sun = new THREE.DirectionalLight(0xbfd0ff, 0.9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
  scene.add(sun, sun.target);

  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (file, rx = 1, ry = 1) => {
    const t = new THREE.TextureLoader(manager).load('assets/' + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry); t.anisotropy = aniso; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(110, 150),
    new THREE.MeshStandardMaterial({ map: tex('floor2.jpg', 110 / 6, 150 / 6), roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -62.5); floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: tex('brick_wall2.jpg'), roughness: 0.9 });
  const TILE = 4, H = 5, T = 1;


  function addBox(w, h, d, x, z, mat = wallMat) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const s = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i; uv.setXY(k, uv.getX(k) * s[f][0] / TILE, uv.getY(k) * s[f][1] / TILE);
    }
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true;
    scene.add(m); m.updateMatrixWorld(true);
    const o = { mesh: m, box: new THREE.Box3().setFromObject(m) };
    obstacles.push(o); return o;
  }
  const wallZ = (z, x0, x1) => addBox(Math.abs(x1 - x0), H, T, (x0 + x1) / 2, z);
  const wallX = (x, z0, z1) => addBox(T, H, Math.abs(z1 - z0), x, (z0 + z1) / 2);

  // Pasillo principal con huecos hacia las 3 rutas laterales
  wallZ(10, -15, 15); wallZ(-135, -15, 15);
  wallX(-15, 10, -33); wallX(-15, -43, -86); wallX(-15, -96, -135);
  wallX(15, 10, -58);  wallX(15, -68, -135);
  wallZ(-25, -15, 7); wallZ(-50, -7, 15); wallZ(-75, -15, 7); wallZ(-100, -7, 15);

  wallZ(-33, -40, -15); wallZ(-43, -40, -15); wallX(-40, -33, -43); wallX(-27, -43, -38);
  wallZ(-58, 15, 45); wallZ(-68, 15, 35); wallX(35, -68, -90); wallX(45, -58, -90); wallZ(-90, 35, 45);
  wallZ(-86, -45, -15); wallZ(-96, -45, -15); wallX(-45, -86, -96); wallX(-30, -96, -91);

  const gateMat = new THREE.MeshStandardMaterial({ color: 0x551010, emissive: 0xaa0000, emissiveIntensity: 0.7 });
  // Puerta que bloquea el pasillo hasta reunir las 3 tarjetas
  const gate = addBox(30, H, 1.2, 0, CONFIG.gateZ, gateMat);

  return {
    gate,
    followSun(p) { sun.position.set(p.x + 20, 50, p.z + 20); sun.target.position.set(p.x, 0, p.z); },
    openGate() {
      obstacles.splice(obstacles.indexOf(gate), 1);
      gateMat.emissive.set(0x00aa33); gateMat.color.set(0x104010);
    },
  };
}
