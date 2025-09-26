/* =========================================================
   Academic Painter — bg-painter.js (ALWAYS-ON + FADING STROKES)
   - Paint anywhere that's NOT a direct interactive target
   - While painting, page won't scroll (re-enabled when you lift)
   - Earthy color drift, DPR-aware canvas
   - Each dab fades out and disappears ~3s after being placed
========================================================= */

(() => {
  // ---------------- Config ----------------
  const MAX_BRUSH   = 72;
  const MIN_BRUSH   = 10;
  const OPACITY     = 0.16;
  const JITTER_HUE  = 4;
  const JITTER_VAL  = 0.06;
  const COLOR_EASE  = 0.06;

  // How long a dab should live before fully disappearing
  const LIFESPAN_MS = 3000;

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
    unlocked: true,                  // ← always ON
    painting: false,
    lastPt: null,
    lastT: 0,
    lastSpeed: 0.3,
    dpr: Math.max(1, Math.min(3, window.devicePixelRatio || 1)),
    colorCur: { ...EARTHS[0] },
    colorTarget: { ...EARTHS[1] },
    animRunning: false
  };

  // Retained-mode list of dabs that fade out over time
  const dabs = []; // each: {x,y, rx, ry, rot, h,s,v, alpha0, birth}

  // ---------------- Elements ----------------
  const els = { canvas: null, ctx: null };

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

  const pickNewTarget = () => {
    state.colorTarget = { ...EARTHS[(Math.random() * EARTHS.length) | 0] };
  };

  function easeColor() {
    let dh = ((state.colorTarget.h - state.colorCur.h + 540) % 360) - 180;
    state.colorCur.h = (state.colorCur.h + dh * COLOR_EASE + 360) % 360;
    state.colorCur.s = lerp(state.colorCur.s, state.colorTarget.s, COLOR_EASE);
    state.colorCur.v = lerp(state.colorCur.v, state.colorTarget.v, COLOR_EASE);
  }

  const apIsDisallowedTarget = target => {
    try { return !!(target && target.closest(AP_DISALLOW_SELECTOR)); }
    catch { return false; }
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
      const ctx = els.ctx;
      if (!ctx) { state.animRunning = false; return; }

      // Clear whole canvas each frame
      ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

      // Draw all live dabs, drop expired ones
      const survivors = [];
      for (let i = 0; i < dabs.length; i++) {
        const d = dabs[i];
        const age = now - d.birth;
        if (age >= LIFESPAN_MS) continue; // expired

        const lifeT = 1 - (age / LIFESPAN_MS); // 1 → 0
        drawDab(d, lifeT);
        survivors.push(d);
      }
      dabs.length = 0;
      Array.prototype.push.apply(dabs, survivors);

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

  // ---------------- Painting Engine ----------------
  function beginPaintFrom(e) {
    ensureCanvas();
    state.painting = true;
    document.body.classList.add('ap-painting-active'); // stop page scroll while painting
    state.lastPt = getPoint(e);
    state.lastT = performance.now();
    state.lastSpeed = 0.3;
    // tiny seed dab for immediate feedback
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

    // If the gesture starts on an interactive thing, DO NOT paint.
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

  // Retained "dab" record (rendered each frame, then fades out)
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

  // ---------------- Init ----------------
  function init() {
    ensureCanvas();

    // Document-level pointer routing (lets us paint across elements)
    document.addEventListener('pointerdown', onPointerDown, { passive: false });
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointercancel', onPointerUp, { passive: true });

    // Safety: stop painting if tab loses focus
    window.addEventListener('blur', () => endPaint());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
