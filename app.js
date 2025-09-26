/* =========================================================
   Tessa Bennion — app.js (intro 6s hold → two-stage fade, menu autoclose, profile→about)
========================================================= */

/* ------------ List your files (exact names) ------------ */
const FILES = {
  life: [
    "LifeA1.jpeg", "LifeA2.jpeg",
    "LifeB1.jpeg", "LifeB2.jpeg", "LifeB3.jpeg",
    "LifeC1.jpeg", "LifeC2.jpeg"
  ],
  portrait: [
    "PortraitA1.JPEG",
    "PortraitB1.jpeg", "PortraitB2.jpeg", "PortraitB3.PNG",
    "PortraitC1.jpeg", "PortraitD1.jpeg", "PortraitE1.jpeg",
    "PortraitF1.jpeg", "PortraitG1.jpeg", "PortraitH1.jpeg"
  ],
  still: [
    "StillA1.jpeg", "StillA2.JPG", "StillA3.JPEG", "StillA4.jpeg",
    "StillB1.jpeg"
  ],
  exhibitions: [
    "VidA2.mp4", "VidA3.mp4"
  ],
  sketches: [
    "SketchA1.jpeg","SketchB1.jpeg","SketchC1.jpeg","SketchD1.jpeg","SketchE1.jpeg"
  ]
};

const BASE = "uploads/";

/* --------------------------- Helpers --------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

function ext(name){ return (name.split(".").pop() || "").toLowerCase(); }
function isVideo(name){ return ext(name) === "mp4"; }
function isImage(name){ return /jpe?g|png|webp|gif|bmp|tiff?/i.test(ext(name)); }
function baseName(name){ return name.replace(/\.[a-z0-9]+$/i, ""); }

/* Series & collection keys */
function seriesKey(name){
  const b = baseName(name);
  const m = b.match(/^([A-Za-z]+[A-Z])[0-9]+$/);
  return m ? m[1] : b;
}
function collectionKey(name){
  const b = baseName(name);
  const m = b.match(/^([A-Za-z]+[A-Z])/);
  return m ? m[1] : seriesKey(name);
}

/* Group by collection (A/B/C…), then sort numerically inside */
function groupIntoCollections(fileList){
  const map = new Map();
  for(const f of fileList){
    const key = collectionKey(f);
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  map.forEach(arr => arr.sort((a,b) => {
    const na = parseInt(baseName(a).match(/(\d+)$/)?.[1] || "0", 10);
    const nb = parseInt(baseName(b).match(/(\d+)$/)?.[1] || "0", 10);
    return na - nb;
  }));
  const entries = [...map.entries()];
  entries.sort((a,b) => {
    const la = a[0].slice(-1), lb = b[0].slice(-1);
    if (la !== lb) return la.localeCompare(lb);
    return a[0].localeCompare(b[0]);
  });
  return entries;
}

/* ---------------------- Card factories ---------------------- */
function humanizeFilename(file) {
  const name = baseName(file);
  return name.replace(/[-_]+/g, " ").replace(/([a-z])([0-9])/gi, "$1 $2");
}

function makeImageCard(src, caption = "") {
  const fig = document.createElement("figure");
  fig.className = "card";
  const a = document.createElement("a");
  a.href = BASE + src;
  a.className = "lb";
  a.setAttribute("aria-label", "Open image");
  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = BASE + src;
  img.alt = caption || humanizeFilename(src);
  a.appendChild(img);
  fig.appendChild(a);
  return fig;
}

function makeVideoCard(src) {
  const fig = document.createElement("figure");
  fig.className = "card";

  const v = document.createElement("video");
  v.src = BASE + src;
  v.playsInline = true;
  v.muted = true;
  v.preload = "metadata";
  v.controls = false;                 // preview mode (no big play overlay)
  v.setAttribute("disablepictureinpicture", "");

  // show an early frame so it looks like a thumbnail
  v.addEventListener("loadedmetadata", () => {
    try { v.currentTime = Math.min(0.1, v.duration || 0.1); } catch {}
  }, { once: true });

  // on tap: enable controls and play
  v.addEventListener("click", () => {
    if (!v.controls) v.controls = true;
    v.play().catch(()=>{});
  });

  fig.appendChild(v);
  return fig;
}

/* ---------- Flip Stack (shows X1 on top; X2/X3… revealed) ---------- */
function makeFlipStackCard(files) {
  const ordered = [...files].sort((a,b)=>{
    const na = parseInt(baseName(a).match(/(\d+)$/)?.[1] || "0", 10);
    const nb = parseInt(baseName(b).match(/(\d+)$/)?.[1] || "0", 10);
    return na - nb;
  });

  const wrap = document.createElement("div");
  wrap.className = "flipstack";

  // layers
  const layers = ordered.map((f,i)=>{
    const item = document.createElement("div");
    item.className = "flipstack__item";
    item.dataset.pos = i===0 ? "0" : i===1 ? "1" : i===2 ? "2" : "rest";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = BASE + f;
    img.alt = humanizeFilename(f);
    item.appendChild(img);
    wrap.appendChild(item);
    return item;
  });

  // classy pager dots (instead of numeric badge)
  let dots = [];
  let dotsWrap = null;
  if (ordered.length > 1) {
    dotsWrap = document.createElement("div");
    dotsWrap.className = "flipstack__dots";
    dots = ordered.map((_, i) => {
      const d = document.createElement("span");
      d.className = "flipstack__dot" + (i === 0 ? " is-active" : "");
      dotsWrap.appendChild(d);
      return d;
    });
    wrap.appendChild(dotsWrap);
  }

  let head = 0;

  const setActiveDot = (idx) => {
    dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
  };

  const apply = ()=>{
    layers.forEach((el,i)=>{
      const rel = (i - head + ordered.length) % ordered.length;
      el.dataset.pos = rel===0 ? "0" : rel===1 ? "1" : rel===2 ? "2" : "rest";
      if (rel===0) {
        el.onclick = () => openLightbox(BASE+ordered[head], humanizeFilename(ordered[head]));
      } else {
        el.onclick = null;
      }
    });
    if (dots.length) setActiveDot(head);
  };
  apply();

  // tap to advance (ignore taps on dots)
  wrap.addEventListener("click", (e)=>{
    if (dotsWrap && dotsWrap.contains(e.target)) return;
    head = (head + 1) % ordered.length;
    apply();
  });

  // horizontal swipe to flip (phone-friendly)
  const drag = {down:false, x:0, y:0};
  wrap.addEventListener("pointerdown", e=>{
    drag.down = true; drag.x = e.clientX; drag.y = e.clientY;
    wrap.setPointerCapture?.(e.pointerId);
  });
  wrap.addEventListener("pointermove", e=>{
    if(!drag.down) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 14) {
      e.preventDefault(); // stop page scroll while flipping
      const current = wrap.querySelectorAll('.flipstack__item')[head];
      if (current) current.style.transform = `rotate(${dx*0.05}deg) translateX(${dx*0.1}px)`;
    }
  }, {passive:false});
  wrap.addEventListener("pointerup", e=>{
    if(!drag.down) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    const current = wrap.querySelectorAll('.flipstack__item')[head];
    if (current) current.style.transform = "";
    drag.down = false;
    wrap.releasePointerCapture?.(e.pointerId);
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
      head = (head + (dx < 0 ? 1 : ordered.length - 1)) % ordered.length;
      apply();
      e.preventDefault();
    }
  });

  return wrap;
}

/* -------------------------- Render (VERTICAL stacks) --------------------------- */
function renderGroupedRows(mountId, fileList) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  // Vertical list of collections
  mount.classList.add("stacks");

  const collections = groupIntoCollections(fileList);
  if (!collections.length) {
    const empty = document.getElementById(mountId.replace("rows-", "") + "-empty");
    if (empty) empty.hidden = false;
    return;
  }

  const frag = document.createDocumentFragment();

  collections.forEach(([key, files]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "stack-row";

    const allImgs = files.every(isImage);
    const anyVid  = files.some(isVideo);

    if (allImgs && files.length >= 1) {
      wrapper.appendChild(makeFlipStackCard(files)); // iMessage-like stack
    } else if (anyVid) {
      const row = document.createElement("div");
      row.className = "row";
      files.forEach(f => {
        if (isVideo(f)) row.appendChild(makeVideoCard(f));
        else row.appendChild(makeImageCard(f));
      });
      wrapper.appendChild(row);
    } else {
      wrapper.appendChild(makeImageCard(files[0]));
    }

    frag.appendChild(wrapper);
  });

  mount.appendChild(frag);
}

/* --------------------------- Lightbox -------------------------- */
const LB = { el: null, img: null, cap: null };
function wireLightbox() {
  LB.el  = $("#lightbox");
  LB.img = $("#lb-img");
  LB.cap = $("#lb-cap");

  // Bind click handlers for all .lb links present at load
  $$(".lb").forEach(a =>
    on(a, "click", e => {
      e.preventDefault();
      const img = $("img", a);
      LB.img.src = a.href;
      LB.img.alt = img?.alt || "";
      LB.cap.textContent = img?.alt || "";
      LB.el.hidden = false;
    })
  );

  on($(".lb-close"), "click", () => (LB.el.hidden = true));
  on(LB.el, "click", (e) => { if (e.target === LB.el) LB.el.hidden = true; });
  on(document, "keydown", (e) => { if (e.key === "Escape") LB.el.hidden = true; });
}

/* ---------------------- Smooth section nav --------------------- */
function smoothNav() {
  const dockLinks   = $$(".bottom-dock a");
  const menuLinks   = $$(".menu-dropdown a");
  const allLinks    = [...dockLinks, ...menuLinks];

  allLinks.forEach(a =>
    on(a, "click", (e) => {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#")) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", href);
    })
  );

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = "#" + entry.target.id;
      allLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === id));
      $$(".bottom-dock a").forEach(link =>
        link.classList.toggle("active-chip", link.getAttribute("href") === id)
      );
    });
  }, { threshold: 0.2 });

  $$("section[id]").forEach(sec => io.observe(sec));
}

/* ----------------------- Menu dropdown UX ---------------------- */
function menuControls(){
  const btn   = document.getElementById('menuTrigger');
  const drop  = document.getElementById('menuDropdown');
  const veil  = document.getElementById('menuOverlay');
  if (!btn || !drop || !veil) return;

  const open  = () => { btn.setAttribute('aria-expanded','true');  drop.hidden = false; veil.hidden = false; };
  const close = () => { btn.setAttribute('aria-expanded','false'); drop.hidden = true;  veil.hidden = true;  };
  const toggle = () => (btn.getAttribute('aria-expanded') === 'true' ? close() : open());

  // Force closed on load
  close();

  btn.addEventListener('click', (e)=>{ e.stopPropagation(); toggle(); });
  veil.addEventListener('click', close);

  // Close on outside clicks
  document.addEventListener('click', (e)=>{
    if (drop.hidden) return;
    const inside = drop.contains(e.target) || btn.contains(e.target);
    if (!inside) close();
  });

  // Auto-close on scroll/resize/hashchange
  window.addEventListener('scroll', close, { passive: true });
  window.addEventListener('resize', close);
  window.addEventListener('hashchange', close);

  // Close when picking a link
  drop.querySelectorAll('a').forEach(a=> a.addEventListener('click', close));
}

/* ------------------------- Intro video ------------------------- */
/* Show ~6s then two-stage fade: video→black, then overlay fades away.
   Always snap back to top when the intro ends or is skipped. */
function introFlow() {
  const intro = $("#intro");
  const vid   = $("#introVideo");
  const skip  = $("#skipIntro");
  if (!intro || !vid) return;

  const SHOW_MS = 6000;
  const STAGE1  = 700;
  let started = false;

  // Safe on iOS/desktop
  const snapTop = () => {
    try { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); }
    catch { window.scrollTo(0, 0); }
  };

  const startFade = () => {
    snapTop();
    intro.classList.add("fade-video");
    setTimeout(() => {
      intro.classList.add("fade-overlay");
      intro.addEventListener("transitionend", () => {
        try { vid.pause(); vid.removeAttribute("src"); vid.load(); } catch {}
        snapTop();
        intro.remove();
      }, { once:true });
    }, STAGE1 + 50);
  };

  const scheduleStartFade = () => {
    if (started) return;
    started = true;
    setTimeout(startFade, SHOW_MS);
  };

  const tryPlay = () => vid.play().catch(()=>{});
  if (vid.readyState >= 2) tryPlay();
  else vid.addEventListener("canplay", tryPlay, { once:true });

  vid.addEventListener("playing", scheduleStartFade, { once:true });
  vid.addEventListener("ended", startFade, { once:true });
  skip?.addEventListener("click", startFade);
}

/* ---------------- Profile → About link ---------------- */
function profileLink(){
  const prof = document.querySelector(".profile");
  const about = document.querySelector("#about");
  if (!prof || !about) return;
  prof.style.cursor = "pointer";
  on(prof, "click", () =>
    about.scrollIntoView({ behavior: "smooth", block: "start" })
  );
}

/* --------- Global scroll gating: only scroll when touch starts on art --------- */
/* We rely on native scrolling and only cancel touchmoves that start OFF art. */
function gateScrollToArt() {
  // art selectors (images, videos, stacks, etc.)
  const ART_SELECTOR = `
    .card img, .card video,
    .card, .card a.lb,
    .flipstack, .flipstack__item, .flipstack__item img
  `.replace(/\s+/g,' ');

  // non-art sections that should always allow scroll
  const FREE_SELECTOR = `
    #about, #contact, .section-about, .section-contact
  `.replace(/\s+/g,' ');

  let allowScroll = false;

  document.addEventListener("touchstart", (e) => {
    allowScroll = !!(e.target.closest(ART_SELECTOR) || e.target.closest(FREE_SELECTOR));
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!allowScroll) e.preventDefault();
  }, { passive: false });

  const reset = () => { allowScroll = false; };
  document.addEventListener("touchend", reset, { passive: true });
  document.addEventListener("touchcancel", reset, { passive: true });
}

/* --------- Briefly exaggerate the fan while scrolling (CSS hook) --------- */
function hintStacksWhileScrolling(){
  let t;
  window.addEventListener('scroll', () => {
    document.body.classList.add('stack-peek');
    clearTimeout(t);
    t = setTimeout(() => document.body.classList.remove('stack-peek'), 350);
  }, { passive: true });
}

/* --------------------------- Boot ------------------------------ */
function boot() {
  // Render in requested order: Portrait → Still → Life → Exhibitions → Sketches
  renderGroupedRows("rows-portrait",    FILES.portrait);
  renderGroupedRows("rows-still",       FILES.still);
  renderGroupedRows("rows-life",        FILES.life);
  renderGroupedRows("rows-exhibitions", FILES.exhibitions);
  renderGroupedRows("rows-sketches",    FILES.sketches);

  wireLightbox();
  smoothNav();
  menuControls();
  introFlow();
  profileLink();
  gateScrollToArt();
  hintStacksWhileScrolling();
}

document.addEventListener("DOMContentLoaded", boot);

/* ------------- Lightbox opener used by Flip Stack --------------- */
function openLightbox(src, caption){
  const lb = $("#lightbox"); if(!lb) return;
  $("#lb-img").src = src;
  $("#lb-cap").textContent = caption || "";
  lb.hidden = false;
}
