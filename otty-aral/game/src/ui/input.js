// Енгізу: сенсорлы экран (джойстик, қарау аймағы, батырмалар) және пернетақта/тышқан.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.moveX = 0; this.moveY = 0;
    this.lookDX = 0; this.lookDY = 0;
    this.fire = false;
    this.aimHold = false;
    this.pressed = new Set();
    this.held = new Set();
    this.keys = new Set();
    this.enabled = true;
    this.joy = null;
    this.lookId = null;
    this.fireIds = new Set();
    this.lastLook = {};
    this.pointerLocked = false;
    this.bindKeyboard();
  }

  // Бір рет басу оқиғасын алу
  take(action) {
    if (this.pressed.has(action)) { this.pressed.delete(action); return true; }
    return false;
  }

  press(action) { this.pressed.add(action); }

  consumeLook() {
    const x = this.lookDX, y = this.lookDY;
    this.lookDX = 0; this.lookDY = 0;
    return [x, y];
  }

  clear() {
    this.pressed.clear(); this.held.clear();
    this.fire = false; this.aimHold = false;
    this.moveX = this.moveY = 0;
    this.joy = null; this.lookId = null; this.fireIds.clear();
    if (this.joyKnob) this.joyKnob.style.transform = 'translate(-50%,-50%)';
  }

  // ---- Сенсорлы басқару элементтері ----
  attachTouch(hud) {
    const lookLayer = hud.lookLayer, joyZone = hud.joyZone, joyBase = hud.joyBase, joyKnob = hud.joyKnob;
    this.joyBase = joyBase; this.joyKnob = joyKnob;
    const R = () => Math.min(70, window.innerHeight * 0.11);
    const setJoy = (e) => {
      const j = this.joy;
      let dx = e.clientX - j.cx, dy = e.clientY - j.cy;
      const r = R();
      const l = Math.hypot(dx, dy);
      if (l > r) { dx = dx / l * r; dy = dy / l * r; }
      this.moveX = dx / r; this.moveY = -dy / r;
      joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };
    joyZone.addEventListener('pointerdown', (e) => {
      if (this.joy) return;
      e.preventDefault();
      const rect = joyBase.getBoundingClientRect();
      const bx = rect.left + rect.width / 2, by = rect.top + rect.height / 2;
      // Қалқымалы джойстик: негіз саусақ тиген жерге жақын жылжиды
      let cx = bx, cy = by;
      if (Math.hypot(e.clientX - bx, e.clientY - by) > R() * 1.2) { cx = e.clientX; cy = e.clientY; joyBase.style.left = cx + 'px'; joyBase.style.top = cy + 'px'; joyBase.classList.add('floating'); }
      this.joy = { id: e.pointerId, cx, cy };
      joyZone.setPointerCapture(e.pointerId);
      setJoy(e);
    });
    joyZone.addEventListener('pointermove', (e) => { if (this.joy && e.pointerId === this.joy.id) setJoy(e); });
    const endJoy = (e) => {
      if (!this.joy || e.pointerId !== this.joy.id) return;
      this.joy = null; this.moveX = 0; this.moveY = 0;
      joyKnob.style.transform = 'translate(-50%,-50%)';
      joyBase.style.left = ''; joyBase.style.top = ''; joyBase.classList.remove('floating');
    };
    joyZone.addEventListener('pointerup', endJoy);
    joyZone.addEventListener('pointercancel', endJoy);

    const startLook = (e, el) => {
      this.lastLook[e.pointerId] = [e.clientX, e.clientY];
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
    };
    const moveLook = (e) => {
      const l = this.lastLook[e.pointerId];
      if (!l) return;
      this.lookDX += e.clientX - l[0];
      this.lookDY += e.clientY - l[1];
      l[0] = e.clientX; l[1] = e.clientY;
    };
    const endLook = (e) => { delete this.lastLook[e.pointerId]; };
    lookLayer.addEventListener('pointerdown', (e) => { e.preventDefault(); startLook(e, lookLayer); });
    lookLayer.addEventListener('pointermove', moveLook);
    lookLayer.addEventListener('pointerup', endLook);
    lookLayer.addEventListener('pointercancel', endLook);

    // Батырмалар
    for (const btn of hud.buttons) {
      const act = btn.dataset.action;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        btn.classList.add('down');
        if (act === 'fire') { this.fireIds.add(e.pointerId); this.fire = true; startLook(e, btn); }
        else if (act === 'aim') this.press('aim');
        else { this.press(act); this.held.add(act); }
        hud.onButton && hud.onButton(act);
      });
      btn.addEventListener('pointermove', (e) => { if (act === 'fire') moveLook(e); });
      const up = (e) => {
        btn.classList.remove('down');
        if (act === 'fire') { this.fireIds.delete(e.pointerId); this.fire = this.fireIds.size > 0; endLook(e); }
        else this.held.delete(act);
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    }
  }

  // ---- Пернетақта мен тышқан ----
  bindKeyboard() {
    const map = {
      KeyR: 'reload', Space: 'jump', KeyC: 'crouch', ControlLeft: 'crouch', KeyF: 'pickup', KeyE: 'pickup', KeyG: 'gloo', KeyH: 'heal', KeyJ: 'kymyz',
      KeyQ: 'grenade', Digit1: 'slot0', Digit2: 'slot1', Digit3: 'slot2', Digit4: 'heal', Digit5: 'kymyz', Escape: 'pause', KeyP: 'pause', KeyX: 'holster', KeyV: 'view',
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = map[e.code];
      if (a) { this.press(a); if (e.code !== 'Escape') e.preventDefault(); }
      this.updateKeys();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.updateKeys(); });
    window.addEventListener('blur', () => { this.keys.clear(); this.updateKeys(); this.fire = false; });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.pointerType === 'touch') return;
      if (!this.pointerLocked && this.wantLock) { this.canvas.requestPointerLock && this.canvas.requestPointerLock(); return; }
      if (e.button === 0) this.fire = true;
      if (e.button === 2) this.aimHold = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.fireIds.size === 0) this.fire = false;
      if (e.button === 2) this.aimHold = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.pointerLocked = document.pointerLockElement === this.canvas; });
    window.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.lookDX += e.movementX; this.lookDY += e.movementY;
    });
    window.addEventListener('wheel', (e) => { if (this.pointerLocked) this.press(e.deltaY > 0 ? 'next' : 'prev'); });
  }

  updateKeys() {
    if (this.joy) return;
    const k = this.keys;
    this.moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    this.moveY = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const l = Math.hypot(this.moveX, this.moveY);
    if (l > 1) { this.moveX /= l; this.moveY /= l; }
    this.walkKey = k.has('ShiftLeft');
  }
}
