import * as THREE from 'three';
import { CONFIG } from './js/config.js';
import { createWorld, obstacles } from './js/world.js';
import { createPlayer } from './js/player.js';
import { createWeapons } from './js/weapons.js';
import { loadZombies, spawnHorde, buildNavGrid, shootZombies, updateZombies } from './js/zombies.js';
import { ui } from './js/ui.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 300);
scene.add(camera);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

let ready = false, state = 'menu';
const manager = new THREE.LoadingManager(() => {
  ready = true; ui.overlay('OPERACIÓN EXTRACCIÓN', 'Click para jugar'); 
});
ui.overlay('OPERACIÓN EXTRACCIÓN', 'Cargando recursos…');

const world = createWorld(scene, renderer, manager);
const player = createPlayer(camera);
const weapons = createWeapons(camera, manager, () => shootZombies(camera, obstacles, scene));
loadZombies(scene, manager);
buildNavGrid(obstacles);
camera.add(new THREE.PointLight(0xffffff, 0.6, 18));

// Objetivos: tarjetas en las rutas -> horda -> puerta -> zona de extracción
const pickups = [];
let cards = 0, gateOpening = false;
const need = CONFIG.keycards.length;
const objective = () => ui.objective(cards < need
  ? `OBJETIVO: consigue las tarjetas de acceso en las rutas laterales (${cards}/${need})`
  : 'OBJETIVO: la puerta está abierta. ¡Corre a la zona de extracción!');
objective();

function makePickup(x, z, color, geo, onTake, beam = false) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
  const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, 0.9, z); mesh.castShadow = true;
  if (beam) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, fog: false }));
    b.position.y = 3.5; mesh.add(b);
  }
  scene.add(mesh); pickups.push({ mesh, onTake });
}
for (const k of CONFIG.keycards) {
  makePickup(k.pos[0], k.pos[1], k.color, new THREE.BoxGeometry(0.5, 0.08, 0.32), () => {
    spawnHorde(...k.horde, CONFIG.hordeSize);
    ui.toast(`Tarjeta ${k.name} (${++cards}/${need}) — ¡VIENE UNA HORDA!`, 3500); objective();
    if (cards === need) { world.openGate(); buildNavGrid(obstacles); gateOpening = true; ui.toast('¡PUERTA DESBLOQUEADA! ¡Y VIENE UNA HORDA!', 4000); }
  }, true);
}
for (const [x, z] of CONFIG.ammoBoxes) {
  makePickup(x, z, 0x00ff55, new THREE.BoxGeometry(0.7, 0.5, 0.5), () => { weapons.addAmmo(); ui.toast('Munición recogida'); });
}
const extraction = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6),
  new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.3 }));
extraction.position.set(...CONFIG.extractionPos); scene.add(extraction);

// Game Over / misión completada: overlay, se libera el mouse y se recarga la página
function endGame(kind, title, sub) {
  if (state === 'over' || state === 'win') return;
  state = kind; ui.overlay(title, sub, kind === 'over' ? 'gameover' : 'win');
  player.controls.unlock();
  setTimeout(() => location.reload(), kind === 'over' ? 3000 : 6000);
}

const overlayEl = document.getElementById('overlay');
overlayEl.addEventListener('click', () => { if (ready && (state === 'menu' || state === 'play')) player.controls.lock(); });
player.controls.addEventListener('lock', () => { state = 'play'; ui.hideOverlay(); weapons.refresh(); });
player.controls.addEventListener('unlock', () => { if (state === 'play') ui.overlay('PAUSA', 'Click para continuar'); });
addEventListener('keydown', (e) => {
  if (state !== 'play') return;
  if (e.code === 'Digit1') weapons.select(1);
  if (e.code === 'Digit2') weapons.select(2);
  if (e.code === 'KeyR') weapons.reload();
});
addEventListener('mousedown', (e) => { if (e.button === 0 && state === 'play' && player.controls.isLocked) weapons.fire(); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
(function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;

  if (state === 'play' && player.controls.isLocked) {
    player.update(dt); weapons.update(dt);
    if (updateZombies(dt, camera.position, obstacles)) endGame('over', 'GAME OVER', 'Un zombi te atrapó…');

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i]; p.mesh.rotation.y += dt * 2; p.mesh.position.y = 0.9 + Math.sin(t * 2 + i) * 0.12;
      if (flat(camera.position, p.mesh.position) < 1.5) { scene.remove(p.mesh); pickups.splice(i, 1); p.onTake(); }
    }
    if (gateOpening) {
      world.gate.mesh.position.y -= 3 * dt;
      if (world.gate.mesh.position.y < -3) { scene.remove(world.gate.mesh); gateOpening = false; }
    }
    if (cards === need && flat(camera.position, extraction.position) < 4) endGame('win', '¡MISIÓN COMPLETADA!', 'Has llegado a la zona de extracción.');
  }
  world.followSun(camera.position);
  renderer.render(scene, camera);
})();
