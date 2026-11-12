import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CONFIG } from './config.js';
import { obstacles } from './world.js';

export function createPlayer(camera) {
  const P = CONFIG.player;
  const controls = new PointerLockControls(camera, document.body);
  camera.position.set(...P.start);

  const keys = {};
  addEventListener('keydown', (e) => (keys[e.code] = true));
  addEventListener('keyup', (e) => (keys[e.code] = false));

  const box = new THREE.Box3(), c = new THREE.Vector3();
  const size = new THREE.Vector3(P.radius * 2, P.height, P.radius * 2);
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();

  const hits = (x, z) => {
    box.setFromCenterAndSize(c.set(x, P.height / 2, z), size);
    return obstacles.some((o) => o.box.intersectsBox(box));
  };

  function update(dt) {
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, camera.up);
    move.set(0, 0, 0);
    if (keys.KeyW) move.add(fwd);   if (keys.KeyS) move.sub(fwd);
    if (keys.KeyD) move.add(right); if (keys.KeyA) move.sub(right);
    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(P.speed * dt);

    if (!hits(camera.position.x + move.x, camera.position.z)) camera.position.x += move.x;
    if (!hits(camera.position.x, camera.position.z + move.z)) camera.position.z += move.z;
  }
  return { controls, update };
}
