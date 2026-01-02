/* =========================================================
   Tessa Bennion — app.js (intro 6s hold → two-stage fade,
   menu autoclose, profile→about, modern app-bar drawer)
   + Title-centering failsafe + parallax shadows
========================================================= */

/* ------------ List your files (exact names) ------------ */
const FILES = {
  life: [
    "LifeA1.jpeg",
    "LifeB1.jpeg", "LifeB2.jpeg", "LifeB3.jpeg",
    "LifeC1.jpeg",
  ],
  portrait: [
    "PortraitA1.JPEG",
    "PortraitB1.jpeg",
    "PortraitC1.jpeg", "PortraitD1.jpeg", "PortraitE1.jpeg",
    "PortraitF1.jpeg", "PortraitG1.jpeg", "PortraitH1.jpeg"
  ],
  still: [
    "StillA1.jpeg", "StillA2.JPG",
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

  // parallax shadow layer (behind the media)
  const sh = document.createElement("div");
  sh.className = "parallax-shadow";
  fig.appendChild(sh);

  const a = document.createElement("a");
  a.href = BASE + src;
  a.className = "lb";
  a.setAttribute("aria-label", "Open image");
  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = BASE + src;
  img.alt = caption || humanizeFilename(src);
  if (img.complete) {
    img.classList.add("is-loaded");
  } else {
    img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
  }
  a.appendChild(img);
  fig.appendChild(a);
  return fig;
}

function makeVideoCard(src) {
  const fig = document.createElement("figure");
  fig.className = "card";

  // parallax shadow layer
  const sh = document.createElement("div");
  sh.className = "parallax-shadow";
  fig.appendChild(sh);

  const v = document.createElement("video");
  v.src = BASE + src;
  v.playsInline = true;
  v.muted = true;
  v.preload = "metadata";
  v.controls = false;                 // preview mode (no big play overlay)
  v.setAttribute("disablepictureinpicture", "");

  v.addEventListener("loadedmetadata", () => {
    try { v.currentTime = Math.min(0.1, v.duration || 0.1); } catch {}
  }, { once: true });

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

    // shadow behind each image in the stack
    const sh = document.createElement("div");
    sh.className = "parallax-shadow";
    item.appendChild(sh);

    const img = document.createElement("img");
    img.loading = i === 0 ? "eager" : "lazy";
    img.decoding = "async";
    img.src = BASE + f;
    img.alt = humanizeFilename(f);
    if (img.complete) {
      img.classList.add("is-loaded");
      if (i === 0) wrap.classList.add("is-ready");
    } else {
      img.addEventListener("load", () => {
        img.classList.add("is-loaded");
        if (i === 0) wrap.classList.add("is-ready");
      }, { once: true });
    }
    item.appendChild(img);
    wrap.appendChild(item);
    return item;
  });

  // classy pager dots
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

  const batchSize = 2;
  let index = 0;

  const renderBatch = () => {
    const frag = document.createDocumentFragment();

    for (let i = 0; i < batchSize && index < collections.length; i += 1, index += 1) {
      const [, files] = collections[index];
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
    }

    mount.appendChild(frag);

    if (index < collections.length) {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(renderBatch, { timeout: 200 });
      } else {
        setTimeout(renderBatch, 16);
      }
    }
  };

  renderBatch();
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
  const drawerLinks = $$(".drawer-links a");   // NEW: app-bar drawer links
  const desktopLinks = $$(".desktop-nav a");
  const allLinks    = [...dockLinks, ...menuLinks, ...drawerLinks, ...desktopLinks];

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

  // choose the section centered in the viewport
  const updateActive = (id) => {
    allLinks.forEach(link =>
      link.classList.toggle("active", link.getAttribute("href") === id)
    );
    $$(".bottom-dock a").forEach(link =>
      link.classList.toggle("active-chip", link.getAttribute("href") === id)
    );
  };

  let currentId = null;
  const io = new IntersectionObserver((entries) => {
    let best = null;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
    }
    if (best) {
      const id = "#" + best.target.id;
      if (id !== currentId) {
        currentId = id;
        updateActive(id);
      }
    }
  }, {
    root: null,
    rootMargin: "-45% 0px -45% 0px",
    threshold: [0.01, 0.25, 0.5, 0.75, 1]
  });

  $$("section[id]").forEach(sec => io.observe(sec));
}

/* ----------------------- Legacy dropdown UX -------------------- */
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

/* ----------------------- App-bar drawer UX (NEW) --------------- */
function drawerControls(){
  const burger  = $(".burger");
  const drawer  = $(".side-drawer");
  const overlay = $(".drawer-overlay");

  if (!burger || !drawer || !overlay) return; // only runs if new markup exists

  const open = () => {
    burger.setAttribute("aria-expanded","true");
    drawer.hidden = false;
    overlay.hidden = false;
    // lock background scroll on iOS/Android while drawer is open
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  };
  const close = () => {
    burger.setAttribute("aria-expanded","false");
    drawer.hidden = true;
    overlay.hidden = true;
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  };
  const toggle = () => (burger.getAttribute("aria-expanded")==="true" ? close() : open());

  burger.addEventListener("click", toggle);
  overlay.addEventListener("click", close);

  // Close on ESC
  document.addEventListener("keydown", (e)=>{
    if (e.key === "Escape" && burger.getAttribute("aria-expanded")==="true") close();
  });

  // Close when picking a link
  $$(".drawer-links a").forEach(a => a.addEventListener("click", close));
}

/* ------------------------- Intro video ------------------------- */
function introFlow() {
  const intro = $("#intro");
  const vid   = $("#introVideo");
  const skip  = $("#skipIntro");
  if (!intro || !vid) return;

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    intro.remove();
    return;
  }

  vid.muted = true;
  vid.autoplay = true;
  vid.playsInline = true;
  vid.setAttribute("playsinline", "");
  vid.setAttribute("webkit-playsinline", "");
  vid.controls = false;

  const SHOW_MS = 6000;
  const STAGE1  = 700;
  let started = false;

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
  const profLegacy = document.querySelector(".site-header .profile");
  const profNew = document.querySelector(".app-bar .profile");

  const about = document.querySelector("#about");
  if (!about) return;

  const bind = (el) => {
    if (!el) return;
    el.style.cursor = "pointer";
    on(el, "click", () =>
      about.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  bind(profLegacy);
  bind(profNew);
}

/* --------- Global scroll gating: only scroll when touch starts on art --------- */
function gateScrollToArt() {
  const ART_SELECTOR = `
    .card img, .card video,
    .card, .card a.lb,
    .flipstack, .flipstack__item, .flipstack__item img
  `.replace(/\s+/g,' ');

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
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  let t;
  window.addEventListener('scroll', () => {
    document.body.classList.add('stack-peek');
    clearTimeout(t);
    t = setTimeout(() => document.body.classList.remove('stack-peek'), 350);
  }, { passive: true });
}

/* ---------------- Title centering failsafe (balanced rails) --------------- */
function balanceAppBar(){
  const bar    = $(".app-bar");
  const left   = $(".avatar-btn");
  const right  = $(".burger");
  if (!bar || !left || !right) return;

  const apply = () => {
    if (window.matchMedia && window.matchMedia("(min-width: 1024px)").matches) {
      bar.style.gridTemplateColumns = "";
      return;
    }
    const rail = Math.max(left.offsetWidth || 44, right.offsetWidth || 44);
    // lock symmetric rails so the title stays centered
    bar.style.gridTemplateColumns = `${rail}px 1fr ${rail}px`;
  };

  apply();
  // Re-run when fonts load, icons swap, or window resizes
  window.addEventListener("resize", apply, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(apply).catch(()=>{});
  }
  new ResizeObserver(apply).observe(left);
  new ResizeObserver(apply).observe(right);
}

/* ---------------- Parallax “living” shadows (no device permission) -------- */
function injectShadowCSS(){
  if (document.getElementById("parallax-shadow-css")) return;
  const style = document.createElement("style");
  style.id = "parallax-shadow-css";
  style.textContent = `
    .card{ position:relative; }
    .card img, .card video{ position:relative; z-index:1; }
    .parallax-shadow{
      position:absolute; inset:8px; z-index:0;
      border-radius:2px;
      background:rgba(0,0,0,.20);          /* slightly stronger */
      filter: blur(16px);                   /* slightly bigger */
      transform: translate3d(var(--tiltX,0px), var(--tiltY,0px), 0) scale(.97);
      transition: transform .10s linear, opacity .15s ease;
      pointer-events:none;
    }
    /* gentle hover for desktops */
    .card:hover .parallax-shadow{ opacity:1; }
  `;
  document.head.appendChild(style);
}

function parallaxShadows(){
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  injectShadowCSS();

  // per-card pointer parallax (desktop feel)
  const bindPointer = (card) => {
    const sh = card.querySelector(".parallax-shadow");
    if (!sh) return;
    let raf = null;
    const upd = (x,y) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=>{
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top  + rect.height/2;
        const dx = (x - cx) / rect.width;   // -0.5..0.5
        const dy = (y - cy) / rect.height;  // -0.5..0.5
        const max = 16;                      // slightly larger range
        card.style.setProperty("--tiltX", `${dx * max}px`);
        card.style.setProperty("--tiltY", `${dy * max}px`);
      });
    };
    card.addEventListener("pointermove", (e)=>upd(e.clientX, e.clientY));
    card.addEventListener("pointerleave", ()=>{
      card.style.setProperty("--tiltX","0px");
      card.style.setProperty("--tiltY","0px");
    });
  };

  $$(".card").forEach(bindPointer);

  // subtle global scroll drift (no permissions needed)
  let raf = null;
  const onScroll = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(()=>{
      const y = window.scrollY || 0;
      // tiny oscillation within a few pixels
      const shiftX = ((y % 100) / 100 - 0.5) * 8;  // -4..+4 px
      const shiftY = ((y % 140) / 140 - 0.5) * 8;  // -4..+4 px
      document.querySelectorAll(".card").forEach(card=>{
        card.style.setProperty("--tiltX", `${shiftX}px`);
        card.style.setProperty("--tiltY", `${shiftY}px`);
      });
    });
  };
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll(); // initial
}

/* --------------------------- Boot ------------------------------ */
function boot() {
  renderGroupedRows("rows-portrait",    FILES.portrait);
  renderGroupedRows("rows-still",       FILES.still);
  renderGroupedRows("rows-life",        FILES.life);
  renderGroupedRows("rows-exhibitions", FILES.exhibitions);
  renderGroupedRows("rows-sketches",    FILES.sketches);

  wireLightbox();
  smoothNav();

  menuControls();
  drawerControls();

  introFlow();
  profileLink();
  gateScrollToArt();
  hintStacksWhileScrolling();

  balanceAppBar();      // keep title perfectly centered
  parallaxShadows();    // new: pointer + scroll drifting shadow
}

document.addEventListener("DOMContentLoaded", boot);

/* ------------- Lightbox opener used by Flip Stack --------------- */
function openLightbox(src, caption){
  const lb = $("#lightbox"); if(!lb) return;
  $("#lb-img").src = src;
  $("#lb-cap").textContent = caption || "";
  lb.hidden = false;
}
