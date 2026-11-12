import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from './config.js';

const Z = CONFIG.zombie;
const list = [];

// Navegación:
const CS = 0.5, X0 = -50, Z0 = -140, NX = 200, NZ = 310;
const blocked = new Uint8Array(NX * NZ), dist = new Int32Array(NX * NZ), queue = new Int32Array(NX * NZ);
const ci = (x) => Math.floor((x - X0) / CS), cj = (z) => Math.floor((z - Z0) / CS);
const inGrid = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ;
let lastCell = -1;

export function buildNavGrid(obstacles) {
  blocked.fill(0); lastCell = -1;
  for (const { box } of obstacles) {
    const i0 = Math.max(0, ci(box.min.x - Z.radius)), i1 = Math.min(NX - 1, ci(box.max.x + Z.radius));
    const j0 = Math.max(0, cj(box.min.z - Z.radius)), j1 = Math.min(NZ - 1, cj(box.max.z + Z.radius));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * NX + i] = 1;
  }
}
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function flood(px, pz) {
  const s = Math.min(NZ - 1, Math.max(0, cj(pz))) * NX + Math.min(NX - 1, Math.max(0, ci(px)));
  if (s === lastCell) return;
  lastCell = s; dist.fill(-1); dist[s] = 0;
  let h = 0, t = 0; queue[t++] = s;
  while (h < t) {
    const c = queue[h++], x = c % NX, y = (c / NX) | 0, d = dist[c] + 1;
    for (const [dx, dy] of D4) {
      const a = x + dx, b = y + dy; if (!inGrid(a, b)) continue;
      const n = b * NX + a; if (blocked[n] || dist[n] >= 0) continue;
      dist[n] = d; queue[t++] = n;
    }
  }
}
function nextWaypoint(x, z, out) {
  const i = ci(x), j = cj(z); if (!inGrid(i, j)) return false;
  let best = dist[j * NX + i], bx = -1, by = -1; if (best < 0) return false;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    if (!dx && !dy) continue;
    const a = i + dx, b = j + dy; if (!inGrid(a, b)) continue;
    const d = dist[b * NX + a]; if (d < 0) continue;
    if (dx && dy && (blocked[j * NX + a] || blocked[b * NX + i])) continue;
    if (d < best) { best = d; bx = a; by = b; }
  }
  if (bx < 0) return false;
  out.set(X0 + (bx + 0.5) * CS, 0, Z0 + (by + 0.5) * CS); return true;
}

const zb = new THREE.Box3(), zc = new THREE.Vector3(), zs = new THREE.Vector3(Z.radius * 2, 1.8, Z.radius * 2);
const wallHit = (obstacles, x, z) => { zb.setFromCenterAndSize(zc.set(x, 0.9, z), zs); return obstacles.some((o) => o.box.intersectsBox(zb)); };
function slide(z, dx, dz, obstacles) {
  const p = z.root.position;
  if (!wallHit(obstacles, p.x + dx, p.z)) p.x += dx;
  if (!wallHit(obstacles, p.x, p.z + dz)) p.z += dz;
}
const ray = new THREE.Ray(), eb = new THREE.Box3(), tmp = new THREE.Vector3(), hitPt = new THREE.Vector3();
// Si hay camino recto libre van directo; si no, siguen la ruta de la rejilla
function lineOfSight(a, b, obstacles) {
  ray.origin.set(a.x, 0.9, a.z); tmp.set(b.x - a.x, 0, b.z - a.z);
  const len = tmp.length(); ray.direction.copy(tmp).divideScalar(len || 1);
  for (const o of obstacles) {
    eb.copy(o.box).expandByScalar(Z.radius);
    if (ray.intersectBox(eb, hitPt) && hitPt.distanceTo(ray.origin) < len) return false;
  }
  return true;
}

let ctx = null;

export function loadZombies(scene, manager) {
  new GLTFLoader(manager).load('assets/zombie.glb', (gltf) => {
    const proto = gltf.scene; proto.updateMatrixWorld(true);

    const bb = new THREE.Box3().setFromObject(proto, true);
    const scale = Z.height / (bb.max.y - bb.min.y);
    ctx = { scene, gltf, proto, scale, footY: -bb.min.y * scale };
    CONFIG.zombieSpawns.forEach(([x, z]) => spawnZombie(x, z));
  }, undefined, (e) => console.error('Error cargando zombie.glb', e));
}

export function spawnZombie(x, zz, chase = false) {
  if (!ctx) return;
  const { scene, gltf, proto, scale, footY } = ctx;
  const clip = (n) => THREE.AnimationClip.findByName(gltf.animations, n) || gltf.animations[0];
  const model = SkeletonUtils.clone(proto);
  model.scale.setScalar(scale); model.position.y = footY; model.rotation.y = Z.yawOffset;
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.emissive && mats.push(m));
  });
  const root = new THREE.Group(); root.add(model); root.position.set(x, 0, zz); scene.add(root);
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.8, Z.height, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.position.y = Z.height / 2; root.add(hitbox);

  const mixer = new THREE.AnimationMixer(model);
  const idle = mixer.clipAction(clip(Z.idle)), walk = mixer.clipAction(clip(Z.walk));
  idle.play();
  const zombie = { root, mixer, idle, walk, mats, hitbox, hp: Z.hits, alive: true, chasing: false,
                   flash: 0, dir: new THREE.Vector3(0, 0, 1) };
  hitbox.userData.zombie = zombie; list.push(zombie);
  if (chase) startChase(zombie);
}

export function spawnHorde(x, z, dir, n) {
  for (let i = 0; i < n; i++) spawnZombie(x + dir * (i % 4) * 1.4, z + (Math.floor(i / 4) - 1.5) * 2.2, true);
}

function startChase(z) {
  if (z.chasing) return; z.chasing = true;
  z.walk.reset().play(); z.idle.crossFadeTo(z.walk, 0.3, false);
}

const raycaster = new THREE.Raycaster(); raycaster.far = 80;
// Raycast desde el centro de pantalla; los muros tapan a los zombis
export function shootZombies(camera, obstacles, scene) {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const targets = [...obstacles.map((o) => o.mesh), ...list.filter((z) => z.alive).map((z) => z.hitbox)];
  const hit = raycaster.intersectObjects(targets, false)[0];
  const z = hit && hit.object.userData.zombie; if (!z) return;
  z.hp--; z.flash = 0.12; startChase(z);
  if (z.hp <= 0) {
    z.alive = false; z.chasing = false; z.mixer.stopAllAction(); scene.remove(z.root);
  }
}

const want = new THREE.Vector3(), wp = new THREE.Vector3();
export function updateZombies(dt, player, obstacles) {
  let caught = false;
  for (const z of list) {
    if (!z.alive) continue;
    if (z.flash > 0) { z.flash -= dt; z.mats.forEach((m) => m.emissive.setHex(z.flash > 0 ? 0xff0000 : 0x000000)); }

    const p = z.root.position, d = Math.hypot(player.x - p.x, player.z - p.z);
    if (z.chasing || d < 45) z.mixer.update(dt);
    if (!z.chasing && d < Z.detect) startChase(z);
    if (z.chasing) {
      let tx = player.x, tz = player.z;
      if (!lineOfSight(p, player, obstacles)) {
        flood(player.x, player.z);
        if (nextWaypoint(p.x, p.z, wp)) { tx = wp.x; tz = wp.z; }
      }
      want.set(tx - p.x, 0, tz - p.z).normalize();
      z.dir.lerp(want, Math.min(1, dt * 8)).normalize();
      z.root.lookAt(p.x + z.dir.x, p.y, p.z + z.dir.z);
      slide(z, z.dir.x * Z.speed * dt, z.dir.z * Z.speed * dt, obstacles);
    }
    if (d < Z.contact) caught = true;
  }
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; if (!a.alive || !b.alive) continue;
    const dx = b.root.position.x - a.root.position.x, dz = b.root.position.z - a.root.position.z, dd = Math.hypot(dx, dz);
    if (dd > 0 && dd < Z.radius * 2) { const k = (Z.radius * 2 - dd) / 2 / dd; slide(a, -dx * k, -dz * k, obstacles); slide(b, dx * k, dz * k, obstacles); }
  }
  return caught;
}
