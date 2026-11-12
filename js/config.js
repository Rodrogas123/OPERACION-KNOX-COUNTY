// Reparte zombis al azar 
function scatter(zones) {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (const [x0, x1, z0, z1, n] of zones) {
    for (let i = 0, tries = 0; i < n && tries < 200; tries++) {
      const p = [x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)];
      if (out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.8)) continue;
      out.push(p); i++;
    }
  }
  return out;
}

export const CONFIG = {
  player: { speed: 5, radius: 0.4, height: 1.7, start: [0, 1.6, 5] },

  weapons: {
    1: { name: 'Pistola Beretta', mag: 15, reserve: 30, file: 'beretta.glb', shot: 'Beretta shot.mp3', scale: 1,     pos: [0, 0.12, 0], rotY: Math.PI / 2, recoil: 0.06,
      material: { color: 0x3c4148, metalness: 0.35, roughness: 0.45, accents: { 'Material.005': 0x8a9099 } } },
    2: { name: 'Rifle M16',       mag: 30, reserve: 60, file: 'm16.glb',     shot: 'M16 shot.mp3',     scale: 0.007, pos: [0, 0, 0],    rotY: Math.PI / 2, recoil: 0.04 },
  },
  reloadSound: 'Reloading.mp3',
  ammoPack: { 1: 15, 2: 30 },

  zombie: {
    height: 1.35, hits: 2, detect: 14, speed: 2.2, radius: 0.45,

    contact: 1.1,
    walk: 'walk01', idle: 'idle01',

    yawOffset: 0,
  },
  zombieSpawns: scatter([
    [-12, 12, -12, -23, 5], [-12, 12, -28, -47, 7], [-12, 12, -53, -72, 7], [-12, 12, -78, -97, 7],
    [-12, 12, -103, -110, 4], [-12, 12, -114, -132, 6],
    [-38, -29, -42, -34, 4], [-25, -19, -41, -35, 2],
    [20, 33, -66, -60, 4], [37, 43, -88, -70, 5],
    [-43, -32, -94, -88, 5], [-28, -18, -94, -88, 3],
  ]),
  hordeSize: 14,


  keycards: [
    { pos: [-37, -38], color: 0xff3030, name: 'ROJA', horde: [-18, -38, -1] },
    { pos: [40, -86],  color: 0x30a0ff, name: 'AZUL', horde: [18, -63, 1] },
    { pos: [-42, -91], color: 0xffd020, name: 'AMARILLA', horde: [-18, -91, -1] },
  ],
  ammoBoxes: [[11, -28], [0, -60], [30, -63], [-36, -41], [-8, -85]],
  gateZ: -112,
  extractionPos: [0, 3, -125],
};
