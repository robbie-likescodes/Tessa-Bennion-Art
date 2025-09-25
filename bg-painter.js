(()=>{
// ================= Academic Painter (self-contained) =================
// Injects a background canvas, a pigment blob button, and a toast.
// Long-press the top of the page OR the blob to unlock painting.
// Palette: academic earths with gentle drift within the family.
// =====================================================================

const state = {
  unlocked: false,
  painting: false,
  last: null,
  inactivityTimer: null,
  dpr: 1,
  hue: 30,       // start warm
  sat: 50,
  lit: 45,
  targetIdx: 0,  // which palette color we’re easing toward
};

// Earth palette anchors (approximate art pigments)
const EARTHS = [
  { name:'Yellow Ochre',     h: 45,  s: 60, l: 55 },
  { name:'Burnt Sienna',     h: 20,  s: 55, l: 45 },
  { name:'Burnt Umber',      h: 30,  s: 35, l: 28 },
  { name:'Alizarin Crimson', h: 350, s: 65, l: 38 },
  { name:'Ultramarine',      h: 225, s: 45, l: 35 },
  { name:'Oxide Green',      h: 160, s: 30, l: 32 },
];

const els = {};
const ctx = {};

// ----- Inject DOM -----
function injectDOM(){
  // Canvas
  const c = document.createElement('canvas');
  c.id = 'ap-canvas';
  document.body.prepend(c);
  els.canvas = c;

  // Pigment blob button (SVG)
  const b = document.createElement('button');
  b.className = 'ap-blob';
  b.setAttribute('aria-label','Pigment');
  b.innerHTML = `
    <svg viewBox="0 0 200 200" width="92" height="92" aria-hidden="true">
      <defs>
        <radialGradient id="ap-blob-g" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#7a3b2d" stop-opacity="0.95"/>
          <stop offset="60%" stop-color="#4e2b22" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#2a1a16" stop-opacity="0.0"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="90" fill="url(#ap-blob-g)"/>
      <ellipse cx="66" cy="60" rx="22" ry="12" fill="#a0522d" opacity="0.7"/>
      <ellipse cx="128" cy="120" rx="30" ry="18" fill="#4e2b22" opacity="0.5"/>
    </svg>`;
  document.body.appendChild(b);
  els.blob = b;

  // Toast
  const t = document.createElement('div');
  t.className = 'ap-toast';
  t.id = 'ap-toast';
  t.setAttribute('role','status');
  t.setAttribute('aria-live','polite');
  document.body.appendChild(t);
  els.toast = t;
}

function showToast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add('ap-show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> els.toast.classList.remove('ap-show'), 1800);
}

// ----- Canvas setup -----
function setupCanvas(){
  const c = els.canvas;
  const context = c.getContext('2d', { alpha: true, desynchronized: true });
  ctx.g = context;
  state.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  resize();
  window.addEventListener('resize', resize, { passive: true });
}
function resize(){
  const c = els.canvas;
  const { innerWidth: w, innerHeight: h } = window;
  c.width  = Math.floor(w * state.dpr);
  c.height = Math.floor(h * state.dpr);
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  ctx.g.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

// ----- Unlock by long-press (top 80px margin OR pigment blob) -----
let holdTimer = null;
function onAnyPointerDown(e){
  const y = (e.touches?.[0]?.clientY ?? e.clientY);
  const inTopMargin = y <= 80;
  const onBlob = e.target === els.blob || els.blob.contains(e.target);
  if(!inTopMargin && !onBlob) return;

  if(holdTimer) return;
  if(inTopMargin) document.body.classList.add('ap-holding-hint');
  holdTimer = setTimeout(()=>{
    unlock();
    cancelHold();
    showToast('Pigment unlocked — paint the margins ✨');
  }, 700);
}
function cancelHold(){
  clearTimeout(holdTimer); holdTimer = null;
  document.body.classList.remove('ap-holding-hint');
}
function unlock(){
  state.unlocked = true;
}
function relock(){
  state.unlocked = false;
  els.canvas.style.pointerEvents = 'none';
  document.body.classList.remove('ap-painting-active');
}

// ----- Painting mechanics (earth palette drift) -----
function startPaint(e){
  if(!state.unlocked) return;
  state.painting = true;
  els.canvas.style.pointerEvents = 'auto';
  document.body.classList.add('ap-painting-active');
  state.last = getPoint(e);
  kickInactivity();

  // seed dollop when starting on blob
  if(e.target === els.blob || els.blob.contains(e.target)){
    const r = 20 + Math.random()*10;
    const rect = els.blob.getBoundingClientRect();
    dab(rect.left + rect.width/2, rect.top + rect.height/2, r, 0.8);
  }
}
function endPaint(){
  if(!state.painting) return;
  state.painting = false;
  state.last = null;
  kickInactivity();
}
function movePaint(e){
  if(!state.painting || !state.unlocked) return;
  const p = getPoint(e);
  const dt = Math.max(1, p.t - state.last.t);
  const dx = p.x - state.last.x, dy = p.y - state.last.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const speed = dist / dt;

  // pressure + speed affect size
  const pressure = 'pressure' in e ? (e.pressure || 0.5) : 0.5;
  const size = clamp(6 + pressure*22 + Math.min(18, speed*24), 6, 48);

  // color drift: ease toward current earth target with small local jitter
  easeTowardTarget(0.02);          // slow ease to anchor
  localJitter(pressure, speed);    // subtle variation

  // lay multiple “dabs” along the segment
  const steps = Math.max(1, Math.floor(dist / (size*0.35)));
  for(let i=0;i<=steps;i++){
    const t = steps ? (i/steps) : 1;
    const x = state.last.x + dx*t;
    const y = state.last.y + dy*t;
    dab(x, y, size, pressure);
  }

  // occasionally change target within earth family
  if(Math.random() < 0.006) pickNeighborTarget();

  state.last = p;
  kickInactivity();
}

function getPoint(e){
  const pt = e.touches?.[0] ?? e;
  return { x: pt.clientX, y: pt.clientY, t: performance.now() };
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// Choose a neighboring target in the earth palette
function pickNeighborTarget(){
  const n = EARTHS.length;
  const dir = Math.random() < 0.5 ? -1 : 1;
  state.targetIdx = (state.targetIdx + dir + n) % n;
}
function easeTowardTarget(k){
  const T = EARTHS[state.targetIdx];
  // handle circular hue easing
  const dh = shortestHueDelta(state.hue, T.h);
  state.hue += dh * k;
  state.sat += (T.s - state.sat) * k;
  state.lit += (T.l - state.lit) * k;
}
function shortestHueDelta(a, b){
  let d = (b - a) % 360;
  if(d > 180) d -= 360;
  if(d < -180) d += 360;
  return d;
}
function localJitter(pressure, speed){
  // small bounded jitter so we stay “within” the earth family
  const j = 0.6 + speed*0.5;
  state.hue += (Math.random()-0.5) * j;        // ± small drift
  state.sat += (Math.random()-0.5) * 0.6;
  state.lit += (Math.random()-0.5) * 0.6;

  // clamp to gentle bands per anchor neighborhood
  state.sat = clamp(state.sat, 28, 70);
  state.lit = clamp(state.lit, 26, 60);
}

function hsl(a){ return `hsla(${(a.hue%360+360)%360}, ${Math.round(a.sat)}%, ${Math.round(a.lit)}%, ${a.alpha})`; }

function dab(x, y, r, pressure){
  const g = ctx.g;

  const rx = r * (0.9 + Math.random()*0.2);
  const ry = r * (0.9 + Math.random()*0.2);

  const center = { hue: state.hue,     sat: state.sat,     lit: state.lit,     alpha: 0.26 + pressure*0.35 };
  const mid    = { hue: state.hue+4,   sat: Math.max(30, state.sat-10), lit: Math.max(30, state.lit-6),  alpha: 0.22 };
  const edge   = { hue: state.hue+10,  sat: Math.max(28, state.sat-18), lit: Math.max(24, state.lit-12), alpha: 0 };

  const grd = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  grd.addColorStop(0.0, hsl(center));
  grd.addColorStop(0.55, hsl(mid));
  grd.addColorStop(1.0, hsl(edge));

  g.globalCompositeOperation = 'source-over';
  g.fillStyle = grd;

  g.beginPath();
  g.save();
  g.translate(x, y);
  g.rotate(Math.random()*Math.PI);
  g.scale(rx, ry);
  g.arc(0, 0, 1, 0, Math.PI*2);
  g.restore();
  g.fill();

  // subtle impasto sparkle on high pressure
  if(pressure > 0.7 && Math.random() < 0.12){
    g.globalCompositeOperation = 'overlay';
    g.fillStyle = `hsla(${(state.hue)%360}, 35%, 72%, 0.08)`;
    g.beginPath();
    g.arc(x + (Math.random()-0.5)*r*0.4, y + (Math.random()-0.5)*r*0.4, r*0.25, 0, Math.PI*2);
    g.fill();
  }
}

function kickInactivity(){
  clearTimeout(state.inactivityTimer);
  state.inactivityTimer = setTimeout(()=>{
    endPaint();
    relock();
  }, 6000);
}

// ----- Bindings -----
function bind(){
  // long-press unlock: top margin or blob
  document.addEventListener('pointerdown', onAnyPointerDown, { passive: true });
  document.addEventListener('pointerup', cancelHold, { passive: true });
  document.addEventListener('pointercancel', cancelHold, { passive: true });
  document.addEventListener('touchend', cancelHold, { passive: true });
  document.addEventListener('touchcancel', cancelHold, { passive: true });

  // painting on document (smooth across elements)
  document.addEventListener('pointerdown', startPaint, { passive: true });
  document.addEventListener('pointermove', movePaint,  { passive: true });
  document.addEventListener('pointerup',   endPaint,   { passive: true });
  document.addEventListener('pointercancel', endPaint, { passive: true });

  // dblclick blob = quick unlock
  els.blob.addEventListener('dblclick', ()=>{
    unlock(); showToast('Pigment unlocked — paint the margins ✨');
  });

  // ESC to relock
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){ endPaint(); relock(); showToast('Pigment put away.'); }
  });
}

// ----- Init -----
function init(){
  injectDOM();
  setupCanvas();

  // start from a random earth anchor
  state.targetIdx = Math.floor(Math.random()*EARTHS.length);
  const T = EARTHS[state.targetIdx];
  state.hue = T.h; state.sat = T.s; state.lit = T.l;

  bind();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init, { once:true });
}else{
  init();
}

})();
