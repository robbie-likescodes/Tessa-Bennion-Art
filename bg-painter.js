/* =========================================================
   Academic Painter — bg-painter.js (FADING STROKES)
   - Paint anywhere that's NOT a direct interactive target
   - While painting, page won't scroll (re-enabled when you lift)
   - Palette tap unlock; top-edge long-press also unlocks
   - Earthy color drift, DPR-aware canvas
   - NEW: each dab fades out and disappears ~3s after being placed
========================================================= */

(() => {
  // ---------------- Config ----------------
  const HOLD_TO_UNLOCK_MS = 700;      // long-press in top margin
  const HOLD_ON_PALETTE_MS = 600;     // long-press on palette
  const INACTIVITY_MS     = 6000;     // auto-relock after no input
  const TOP_UNLOCK_BOUNDS = 80;       // top 80px region
  const MAX_BRUSH         = 72;
  const MIN_BRUSH         = 10;
  const OPACITY           = 0.16;
  const JITTER_HUE        = 4;
  const JITTER_VAL        = 0.06;
  const COLOR_EASE        = 0.06;

  // NEW: how long a dab should live before fully disappearing
  const LIFESPAN_MS       = 3000;

  // Earthy anchors
  const EARTHS = [
    { h: 45,  s: 0.35, v: 0.86 }, // yellow ochre
    { h: 16,  s: 0.50, v: 0.55 }, // burnt sienna
    { h: 25,  s: 0.40, v: 0.40 }, // umber
    { h: 350, s: 0.45, v: 0.55 }, // alizarin-ish
    { h: 220, s: 0.45, v: 0.55 }, // ultramarine
    { h: 105, s: 0.35, v: 0.55 }  // oxide green
  ];

  /* Only these are off-limits to start a paint stroke. */
  const AP_DISALLOW_SELECTOR =
    'a, button, input, textarea, select, ' +
    'img, video, ' +
    '.menu-trigger, #menuTrigger, .menu-dropdown, ' +
    '.bottom-dock, header, .site-header, ' +
    '.lightbox, .lb, #lightbox';

  // ---------------- State ----------------
  const state = {
    unlocked: false,
    painting: false,
    lastPt: null,
    lastT: 0,
    lastSpeed: 0.3,
    inactivity: null,
    dpr: Math.max(1, Math.min(3, window.devicePixelRatio || 1)),
    colorCur: { ...EARTHS[0] },
    colorTarget: { ...EARTHS[1] },
    animRunning: false
  };

  // Retained-mode list of dabs that fade out over time
  const dabs = []; // each: {x,y, rx, ry, rot, h,s,v, alpha0, birth}

  // ---------------- Elements ----------------
  const els = { canvas: null, ctx: null, palette: null, toast: null };

  // ---------------- Utils ----------------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp  = (a, b, t) => a + (b - a) * t;

  function hsbToRgba(h, s, v, a = 1) {
    const C = v * s;
    const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - C;
    let r=0,g=0,b=0;
    if (0 <= h && h < 60)      { r=C; g=X; b=0; }
    else if (60 <= h && h <120){ r=X; g=C; b=0; }
    else if (120<= h && h<180){ r=0; g=C; b=X; }
    else if (180<= h && h<240){ r=0; g=X; b=C; }
    else if (240<= h && h<300){ r=X; g=0; b=C; }
    else                       { r=C; g=0; b=X; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return `rgba(${r},${g},${b},${a})`;
  }

  const jitterColor = c => ({
    h: (c.h + (Math.random()*2-1)*JITTER_HUE + 360) % 360,
    s: c.s,
    v: clamp(c.v + (Math.random()*2-1)*JITTER_VAL, 0, 1)
  });

  const pickNewTarget = () => { state.colorTarget = { ...EARTHS[(Math.random() * EARTHS.length) | 0] }; };

  function easeColor() {
    let dh = ((state.colorTarget.h - state.colorCur.h + 540) % 360) - 180;
    state.colorCur.h = (state.colorCur.h + dh * COLOR_EASE + 360) % 360;
    state.colorCur.s = lerp(state.colorCur.s, state.colorTarget.s, COLOR_EASE);
    state.colorCur.v = lerp(state.colorCur.v, state.colorTarget.v, COLOR_EASE);
  }

  const showToast = (msg = 'Pigment unlocked') => {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 1200);
  };

  const apIsDisallowedTarget = target => {
    try { return !!(target && target.closest(AP_DISALLOW_SELECTOR)); }
    catch { return false; }
  };

  const kickInactivity = () => {
    clearTimeout(state.inactivity);
    state.inactivity = setTimeout(() => relock(), INACTIVITY_MS);
  };

  // ---------------- Canvas ----------------
  function ensureCanvas() {
    if (els.canvas) return;
    const c = document.createElement('canvas');
    c.id = 'ap-canvas';
    // Paint sits behind everything
    c.style.position = 'fixed';
    c.style.inset = '0';
    c.style.zIndex = '0';
    c.style.pointerEvents = 'none'; // we listen on document, not the canvas
    document.body.prepend(c);
    els.canvas = c;
    els.ctx = c.getContext('2d', { alpha: true, desynchronized: true });

    const resize = () => {
      const w = innerWidth, h = innerHeight, d = state.dpr;
      c.width = Math.round(w * d);
      c.height = Math.round(h * d);
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      els.ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();
    addEventListener('resize', resize, { passive: true });

    // Start the animation loop for fade-out rendering
    startAnim();
  }

  // ---------------- Animation loop (retained rendering) ----------------
  function startAnim() {
    if (state.animRunning) return;
    state.animRunning = true;

    const step = (now) => {
      // clear whole canvas
      const ctx = els.ctx;
      if (!ctx) { state.animRunning = false; return; }
      ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

      // draw all live dabs, drop expired ones
      const out = [];
      for (let i = 0; i < dabs.length; i++) {
        const d = dabs[i];
        const age = now - d.birth;
        if (age >= LIFESPAN_MS) continue; // expired

        const lifeT = 1 - (age / LIFESPAN_MS); // 1 → 0
        drawDab(d, lifeT);
        out.push(d);
      }
      // keep only survivors
      dabs.length = 0;
      Array.prototype.push.apply(dabs, out);

      // keep going
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  function drawDab(d, lifeT) {
    const ctx = els.ctx; if (!ctx) return;
    const alpha = d.alpha0 * lifeT;

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);

    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(d.rx, d.ry));
    const rgbaCore = hsbToRgba(d.h, d.s, d.v, alpha);
    grd.addColorStop(0.0, rgbaCore);
    grd.addColorStop(0.8, hsbToRgba(d.h, d.s * 0.8, d.v * 0.85, alpha * 0.45));
    grd.addColorStop(1.0, hsbToRgba(d.h, d.s * 0.6, d.v * 0.75, 0));
    ctx.fillStyle = grd;

    ctx.beginPath();
    ctx.ellipse(0, 0, d.rx, d.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------- UI Injection ----------------
  function injectUI() {
    // Palette button
    const btn = document.createElement('button');
    btn.className = 'ap-palette';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open pigment palette');
    btn.innerHTML = `
      <svg viewBox="0 0 128 96" aria-hidden="true">
        <defs>
          <linearGradient id="apWood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stop-color="#caa36f"/>
            <stop offset="100%" stop-color="#8b673d"/>
          </linearGradient>
        </defs>
        <path d="M94 10c-18-8-44-8-62 2C14 20 6 34 8 48c2 12 12 18 22 18 7 0 10 7 16 11 9 6 24 7 38 2 20-7 34-25 34-40s-12-23-24-29zM40 44a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"
              fill="url(#apWood)" stroke="rgba(0,0,0,.15)" stroke-width="1"/>
        <circle cx="58" cy="26" r="6" fill="#b28e4a"/>
        <circle cx="74" cy="20" r="6" fill="#6c3b2c"/>
        <circle cx="90" cy="24" r="6" fill="#2B55AE"/>
        <circle cx="86" cy="38" r="6" fill="#4b1f1f"/>
        <circle cx="70" cy="36" r="6" fill="#557a4d"/>
      </svg>
      <span class="ap-sparkle"></span>
    `;
    // Prefer docking inside header mount; fallback to fixed button
    const mount = document.getElementById('ap-palette-mount');
    if (mount) {
      mount.appendChild(btn);
      btn.style.position = 'static';
    } else {
      document.body.appendChild(btn);
      btn.style.position = 'fixed';
      btn.style.top = '10px';
      btn.style.right = '56px';
      btn.style.zIndex = '901';
    }
    els.palette = btn;

    // Toast
    const toast = document.createElement('div');
    toast.id = 'ap-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
    els.toast = toast;
  }

  // ---------------- Lock / Unlock ----------------
  function unlock() {
    if (state.unlocked) return;
    state.unlocked = true;
    pickNewTarget();
    showToast('Pigment unlocked');
    kickInactivity();
  }

  function relock() {
    state.unlocked = false;
    endPaint();
  }

  // ---------------- Painting Engine ----------------
  function beginPaintFrom(e) {
    ensureCanvas();
    state.painting = true;
    document.body.classList.add('ap-painting-active'); // stop page scroll while painting
    state.lastPt = getPoint(e);
    state.lastT = performance.now();
    state.lastSpeed = 0.3;
    kickInactivity();
    // seed a tiny dab so users see immediate feedback
    dot(state.lastPt.x, state.lastPt.y, 1);
  }

  function endPaint() {
    if (!state.painting) return;
    state.painting = false;
    document.body.classList.remove('ap-painting-active'); // restore normal scrolling
    state.lastPt = null;
  }

  function getPoint(e) {
    const x = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    const p = (typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 0.3;
    return { x, y, p };
  }

  function onPointerDown(e) {
    if (!state.unlocked) return;

    // If the gesture starts on an interactive thing (image/video/button/link/etc), DO NOT paint.
    if (apIsDisallowedTarget(e.target)) {
      endPaint();
      return; // let the page handle tap/scroll/swipe normally
    }

    // Otherwise, start painting and prevent the page from scrolling.
    e.preventDefault();
    beginPaintFrom(e);
  }

  function onPointerMove(e) {
    if (!state.painting) return;
    kickInactivity();
    e.preventDefault(); // keep the stroke from panning the page

    const pt = getPoint(e);
    const t = performance.now();
    const dx = pt.x - state.lastPt.x;
    const dy = pt.y - state.lastPt.y;
    const dt = Math.max(1, t - state.lastT);
    const speed = Math.sqrt(dx*dx + dy*dy) / dt; // px/ms
    state.lastSpeed = lerp(state.lastSpeed, speed, 0.35);

    const size = clamp(
      MIN_BRUSH + (state.lastSpeed * 450) * (0.4 + pt.p * 0.9),
      MIN_BRUSH, MAX_BRUSH
    );

    easeColor();
    if (Math.random() < 0.02) pickNewTarget();
    const c = jitterColor(state.colorCur);

    const steps = 1 + ((size / 28) | 0);
    for (let i=0; i<steps; i++) {
      const ox = (Math.random()*2-1) * size * 0.18;
      const oy = (Math.random()*2-1) * size * 0.18;
      pushDab(pt.x + ox, pt.y + oy, size * (0.9 + Math.random()*0.2), c, OPACITY * (0.9 + Math.random()*0.2));
    }

    state.lastPt = pt;
    state.lastT = t;
  }

  function onPointerUp() {
    if (state.painting) endPaint();
  }

  function dot(x, y, k = 1) {
    const c = jitterColor(state.colorCur);
    pushDab(x, y, MIN_BRUSH * k, c, OPACITY);
  }

  // NEW: retained "dab" record (rendered each frame, then fades out)
  function pushDab(x, y, size, colorHSB, alpha0) {
    const rot = (Math.random()*2-1) * 0.25;
    const rx  = size * (0.72 + Math.random()*0.20);
    const ry  = size * (0.95 + Math.random()*0.15);
    dabs.push({
      x, y, rx, ry, rot,
      h: colorHSB.h, s: colorHSB.s, v: colorHSB.v,
      alpha0,
      birth: performance.now()
    });
  }

  // ---------------- Unlock Gestures ----------------
  let holdTimer = null;
  function onTopHoldStart(e) {
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? Infinity;
    if (y > TOP_UNLOCK_BOUNDS) return;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => unlock(), HOLD_TO_UNLOCK_MS);
  }
  function onTopHoldEnd() { clearTimeout(holdTimer); }

  function bindPalette() {
    // Single tap/click unlock
    els.palette.addEventListener('click', () => unlock(), { passive: true });

    // Double-click unlock (desktop convenience)
    els.palette.addEventListener('dblclick', () => unlock());

    // Long-press unlock (touch)
    let pressTimer = null;
    els.palette.addEventListener('pointerdown', () => {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => unlock(), HOLD_ON_PALETTE_MS);
    }, { passive: true });
    ['pointerup','pointercancel','pointerleave'].forEach(ev =>
      els.palette.addEventListener(ev, () => clearTimeout(pressTimer), { passive: true })
    );
  }

  // ESC to relock
  const onKey = e => { if (e.key === 'Escape') relock(); };

  // ---------------- Init ----------------
  function init() {
    injectUI();
    ensureCanvas();

    // Document-level pointer routing (lets us paint across elements)
    document.addEventListener('pointerdown', onPointerDown, { passive: false });
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointercancel', onPointerUp, { passive: true });

    // Unlock gestures
    document.addEventListener('pointerdown', onTopHoldStart, { passive: true });
    document.addEventListener('pointerup', onTopHoldEnd, { passive: true });
    document.addEventListener('pointercancel', onTopHoldEnd, { passive: true });

    bindPalette();
    document.addEventListener('keydown', onKey, { passive: true });

    window.addEventListener('blur', () => endPaint());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
