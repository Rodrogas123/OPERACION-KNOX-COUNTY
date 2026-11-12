const $ = (id) => document.getElementById(id);
let toastTimer;

export const ui = {
  hud(w) {
    $('weapon-name').textContent = w.name + (w.reloading ? '  (recargando…)' : '');
    $('current-ammo').textContent = w.cur;
    $('reserve-ammo').textContent = w.res;
  },
  slot(id) { document.querySelectorAll('.hotbar-slot').forEach((s) => s.classList.toggle('active', s.id === 'slot-' + id)); },
  objective(txt) { $('objective').textContent = txt; },
  toast(msg, ms = 2500) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  },
  overlay(title, sub, cls = '') {
    const o = $('overlay'); o.className = cls; o.style.display = 'flex';
    $('overlay-title').textContent = title; $('overlay-sub').textContent = sub;
  },
  hideOverlay() { $('overlay').style.display = 'none'; },
};
