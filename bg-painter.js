/* =========================================================
   Academic Painter — bg-painter.js
   Hidden pigment painter for background, designed to:
   - Inject its own canvas, pigment blob, and toast
   - Unlock via long-press top margin OR double-tap blob
   - Paint oily dabs (pressure/speed responsive) in earth tones
   - Relock after inactivity, ESC to relock
   - Never hijack normal scrolling if a gesture starts on content
   - Stylus/pen may paint anywhere
   - DPR-aware, desynchronized 2D for performance
========================================================= */

(() => {
  // ---------------- Config ----------------
  const HOLD_TO_UNLOCK_MS = 700;      // long-press in top margin
  const INACTIVITY_MS     = 6000;     // auto-relock after no input
  const TOP_UNLOCK_BOUNDS = 80;       // top 80px
  const MAX_BRUSH         = 72;       // px on high speed/pressure
  const MIN_BRUSH         = 10;       // px minimum
  const OPACITY           = 0.16;     // base alpha per dab
  const JITTER_HUE        = 4;        // ± hue jitter degrees
  const JITTER_VAL        = 0.06;     // ± value jitter
  const COLOR_EASE        = 0.06;     // color drift easing

  // Earthy palette (OK to tweak)
  const EARTHS = [
    { h: 45,  s: 0.35, v: 0.86 }, // Yellow Ochre
    { h: 16,  s: 0.50, v: 0.55 }, // Burnt Sienna
    { h: 25,  s: 0.40, v: 0.40 }, // Burnt Umber
    { h: 350, s: 0.45, v: 0.55 }, // Alizarin-ish (crimson)
    { h: 220, s: 0.45, v: 0.55 }, // Ultramarine
    { h: 105, s: 0.35, v: 0.55 }  // Oxide Green
  ];

  // Painting should NOT start if the gesture begins on these elements (unless stylus).
  const AP_DISALLOW_SELECTOR =
    'img, figure, .card, .row, .grid, a, .nav, header, .bottom-dock, .lb, video, .site-header, button, input, textarea, select';

  // --------------- State ---------------
  const state = {
    unlocked: false,
    painting: false,
    lastPt: null,
    lastT: 0,
    lastSpeed: 0,
    inactivity: null,
    dpr: Math.max(1, Math.min(3, window.devicePixelRatio || 1)),
    colorCur: { ...EARTHS[0] },
    colorTarget: { ...EARTHS[1] }
  };

  // --------------- Elements ---------------
  const els = {
    canvas: null,
    ctx: null,
    blob: null,
    toast: null
  };

  // --------------- Utilities ---------------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;

  function hsbToRgba(h, s, v, a = 1) {
    // h in [0..360), s/v in [0..1]
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

  function jitterColor(c) {
    let h = (c.h + (Math.random()*2-1)*JITTER_HUE + 360) % 360;
    let v = clamp(c.v + (Math.random()*2-1)*JITTER_VAL, 0, 1);
    return { h, s: c.s, v };
  }

  function pickNewTarget() {
    state.colorTarget = { ...EARTHS[(Math.random() * EARTHS.length) | 0] };
  }

  function easeColor() {
    // move current color toward target
    // shortest hue distance
    let dh = ((state.colorTarget.h - state.colorCur.h + 540) % 360) - 180;
    state.colorCur.h = (state.colorCur.h + dh * COLOR_EASE + 360) % 360;
    state.colorCur.s = lerp(state.colorCur.s, state.colorTarget.s, COLOR_EASE);
    state.colorCur.v = lerp(state.colorCur.v, state.colorTarget.v, COLOR_EASE);
  }

  function showToast(msg = 'Pigment unlocked') {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 1200);
  }

  function apIsDisallowedTarget(target) {
    try { return !!(target && target.closest(AP_DISALLOW_SELECTOR)); }
    catch { return false; }
  }

  function kickInactivity() {
    clearTimeout(state.inactivity);
    state.inactivity = setTimeout(() => relock(), INACTIVITY_MS);
  }

  // --------------- Canvas setup ---------------
  function ensureCanvas() {
    if (els.canvas) return;
    const c = document.createElement('canvas');
    c.id = 'ap-canvas';
    document.body.prepend(c);
    els.canvas = c;
    // Allow desynchronized if supported for smoother input (not fatal if ignored)
    els.ctx = c.getContext('2d', { alpha: true, desynchronized: true });

    // size & scale
    const resize = () => {
      const { innerWidth: w, innerHeight: h } = window;
      const dpr = state.dpr;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      els.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });
  }

  // --------------- UI injection ---------------
  function injectUI() {
    // Pigment blob (bottom-left by default)
    const blob = document.createElement('div');
    blob.className = 'ap-blob';
    blob.style.left = '12px';
    blob.style.bottom = '12px';
    // pretty pigment gradient
    blob.style.background = 'radial-gradient(circle at 30% 35%, #b28e4a 0%, #6c3b2c 55%, #2e2a1f 100%)';
    blob.title = 'Pigment';
    document.body.appendChild(blob);
    els.blob = blob;

    // Toast
    const toast = document.createElement('div');
    toast.id = 'ap-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
    els.toast = toast;
  }

  // --------------- Lock / Unlock ---------------
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
    // No toast here; keep it subtle
  }

  // --------------- Painting engine ---------------
  function beginPaintFrom(e) {
    // Ensure canvas exists and can accept input
    ensureCanvas();
    els.canvas.classList.add('active');
    document.body.classList.add('ap-painting-active');
    state.painting = true;
    state.lastPt = getPoint(e);
    state.lastT = performance.now();
    state.lastSpeed = 0.3;
    kickInactivity();
    dot(state.lastPt.x, state.lastPt.y, 1); // seed a dab
  }

  function endPaint() {
    state.painting = false;
    state.lastPt = null;
    els.canvas?.classList.remove('active');
    document.body.classList.remove('ap-painting-active');
  }

  function getPoint(e) {
    const x = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    const p = (typeof e.pressure === 'number' && e.pressure > 0) ? e.pressure : 0.3;
    return { x, y, p };
  }

  function onPointerDown(e) {
    // Unlock gestures:
    // - Long-press top area handled separately
    // - Double-tap on blob handled separately
    if (!state.unlocked) return;

    // If gesture starts on content, do NOT paint (unless stylus/pen).
    if (apIsDisallowedTarget(e.target) && e.pointerType !== 'pen') {
      endPaint();
      return;
    }

    // Start painting
    e.preventDefault();
    beginPaintFrom(e);
  }

  function onPointerMove(e) {
    if (!state.painting) return;
    // Keep canvas on top of pointer to avoid latency
    kickInactivity();
    const pt = getPoint(e);
    const t = performance.now();

    // compute speed
    const dx = pt.x - state.lastPt.x;
    const dy = pt.y - state.lastPt.y;
    const dt = Math.max(1, t - state.lastT);
    const speed = Math.sqrt(dx*dx + dy*dy) / dt; // px per ms
    state.lastSpeed = lerp(state.lastSpeed, speed, 0.35);

    // brush size from speed & pressure
    const size = clamp(MIN_BRUSH + (state.lastSpeed * 450) * (0.4 + pt.p * 0.9), MIN_BRUSH, MAX_BRUSH);

    // color drift toward target
    easeColor();
    if (Math.random() < 0.02) pickNewTarget(); // occasionally pick a new anchor
    const c = jitterColor(state.colorCur);

    // lay a few overlapping dabs for oil feel
    const steps = 1 + ((size / 28) | 0);
    for (let i=0; i<steps; i++) {
      const ox = (Math.random()*2-1) * size * 0.18;
      const oy = (Math.random()*2-1) * size * 0.18;
      dab(pt.x + ox, pt.y + oy, size * (0.9 + Math.random()*0.2), c, OPACITY * (0.9 + Math.random()*0.2));
    }

    state.lastPt = pt;
    state.lastT = t;
  }

  function onPointerUp() {
    if (state.painting) {
      // keep unlocked but stop painting
      endPaint();
    }
  }

  function dot(x, y, k = 1) {
    const c = jitterColor(state.colorCur);
    dab(x, y, MIN_BRUSH * k, c, OPACITY);
  }

  function dab(x, y, size, colorHSB, alpha) {
    const ctx = els.ctx;
    if (!ctx) return;
    // Elliptical soft dab with slight rotation
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random()*2-1) * 0.25); // radians, subtle
    const rx = size * (0.72 + Math.random()*0.20);
    const ry = size * (0.95 + Math.random()*0.15);

    // radial fade
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    const rgbaCore = hsbToRgba(colorHSB.h, colorHSB.s, colorHSB.v, alpha);
    grd.addColorStop(0.0, rgbaCore);
    grd.addColorStop(0.8, hsbToRgba(colorHSB.h, colorHSB.s * 0.8, colorHSB.v * 0.85, alpha * 0.45));
    grd.addColorStop(1.0, hsbToRgba(colorHSB.h, colorHSB.s * 0.6, colorHSB.v * 0.75, 0));

    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // --------------- Unlock gestures ---------------
  // A) Long-press near top margin
  let holdTimer = null;
  function onTopHoldStart(e) {
    // Only if they press the top margin area
    const y = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? Infinity;
    if (y > TOP_UNLOCK_BOUNDS) return;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => unlock(), HOLD_TO_UNLOCK_MS);
  }
  function onTopHoldEnd() { clearTimeout(holdTimer); }

  // B) Double-tap/double-click pigment blob
  let lastTap = 0;
  function onBlobTap() {
    const now = performance.now();
    if (now - lastTap < 380) {
      unlock();
    }
    lastTap = now;
  }

  // ESC relock
  function onKey(e) { if (e.key === 'Escape') relock(); }

  // --------------- Init ---------------
  function init() {
    injectUI();
    ensureCanvas();

    // Pointer routing (document-level so painting can continue over elements)
    document.addEventListener('pointerdown', onPointerDown, { passive: false });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointercancel', onPointerUp, { passive: true });
    document.addEventListener('keydown', onKey, { passive: true });

    // Unlock gestures
    document.addEventListener('pointerdown', onTopHoldStart, { passive: true });
    document.addEventListener('pointerup', onTopHoldEnd, { passive: true });
    document.addEventListener('pointercancel', onTopHoldEnd, { passive: true });

    els.blob.addEventListener('pointerdown', onBlobTap, { passive: true });
    els.blob.addEventListener('dblclick', () => unlock()); // desktop double-click

    // If window blurs, be safe
    window.addEventListener('blur', () => endPaint());

    // Ensure scroll is never blocked unless actively painting
    // (CSS makes #ap-canvas pointer-events:auto only when .active)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
