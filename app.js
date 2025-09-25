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
    "PortaitB1.jpeg", "PortrainB2.jpeg", "PortraitB3.PNG",
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

/* Series key: PortraitB1 → "PortraitB" (letters + ONE capital + digits) */
function seriesKey(name){
  const b = baseName(name);
  const m = b.match(/^([A-Za-z]+[A-Z])[0-9]+$/);
  return m ? m[1] : b;
}

function groupIntoRows(fileList){
  const map = new Map();
  for(const f of fileList){
    const key = seriesKey(f);
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  const rows = [];
  map.forEach(arr => {
    arr.sort((a,b) => {
      const na = parseInt(baseName(a).match(/(\d+)$/)?.[1] || "0", 10);
      const nb = parseInt(baseName(b).match(/(\d+)$/)?.[1] || "0", 10);
      return na - nb;
    });
    rows.push(arr);
  });
  rows.sort((ra, rb) => (ra[0] < rb[0] ? -1 : 1));
  return rows;
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
  v.controls = true;
  v.preload = "metadata";
  v.muted = true;
  fig.appendChild(v);
  return fig;
}

/* ---------- Flip Stack (A1 on top; A2/A3… revealed) ---------- */
function makeFlipStackCard(files) {
  // Ensure numeric order: A1, A2, A3...
  const ordered = [...files].sort((a,b)=>{
    const na = parseInt(baseName(a).match(/(\d+)$/)?.[1] || "0", 10);
    const nb = parseInt(baseName(b).match(/(\d+)$/)?.[1] || "0", 10);
    return na - nb;
  });

  const wrap = document.createElement("div");
  wrap.className = "flipstack";

  const layers = ordered.map((f,i)=>{
    const item = document.createElement("div");
    item.className = "flipstack__item";
    item.dataset.pos = i===0 ? "0" : i===1 ? "1" : i===2 ? "2" : "rest";
    const img = document.createElement("img");
    img.loading="lazy"; img.decoding="async";
    img.src = BASE + f; img.alt = humanizeFilename(f);
    item.appendChild(img);
    wrap.appendChild(item);
    return item;
  });

  const badge = document.createElement("div");
  badge.className = "flipstack__badge";
  badge.textContent = `1/${ordered.length}`;
  wrap.appendChild(badge);

  let head = 0;
  const apply = ()=>{
    layers.forEach((el,i)=>{
      const rel = (i - head + ordered.length) % ordered.length;
      el.dataset.pos = rel===0 ? "0" : rel===1 ? "1" : rel===2 ? "2" : "rest";
      if (rel===0) {
        // clicking the visible image opens lightbox
        el.onclick = () => openLightbox(BASE+ordered[head], humanizeFilename(ordered[head]));
      } else {
        el.onclick = null;
      }
    });
    badge.textContent = `${head+1}/${ordered.length}`;
  };
  apply();

  // tap to advance
  wrap.addEventListener("click", e=>{
    // ignore if user tapped a link inside (we don't have links inside)
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
      layers[head].style.transform = `rotate(${dx*0.05}deg) translateX(${dx*0.1}px)`;
    }
  }, {passive:false});
  wrap.addEventListener("pointerup", e=>{
    if(!drag.down) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    layers[head].style.transform = ""; // restore
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

/* -------------------------- Render --------------------------- */
function renderGroupedRows(mountId, fileList) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const rows = groupIntoRows(fileList);
  if (!rows.length) {
    const empty = document.getElementById(mountId.replace("rows-", "") + "-empty");
    if (empty) empty.hidden = false;
    return;
  }

  const frag = document.createDocumentFragment();

  rows.forEach(list => {
    const row = document.createElement("div");
    row.className = "row";

    const allImgs = list.every(isImage);
    const anyVid  = list.some(isVideo);

    if (allImgs && list.length > 1) {
      // iMessage-style stack: show A1 on top; A2/A3… inside
      row.appendChild(makeFlipStackCard(list));
    } else {
      // default: render each file as its own card
      list.forEach(file => {
        if (isVideo(file)) row.appendChild(makeVideoCard(file));
        else row.appendChild(makeImageCard(file));
      });
    }

    frag.appendChild(row);
  });

  mount.appendChild(frag);

  // Desktop convenience: vertical wheel scroll nudges row horizontally
  $$(".row", mount).forEach(row => {
    on(row, "wheel", (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        row.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  });
}

/* --------------------------- Lightbox -------------------------- */
const LB = { el: null, img: null, cap: null };
function wireLightbox() {
  LB.el  = $("#lightbox");
  LB.img = $("#lb-img");
  LB.cap = $("#lb-cap");

  const bind = () => {
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
  };
  bind();

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
/* Show ~6s then two-stage fade: video→black, then overlay fades away */
function introFlow() {
  const intro = $("#intro");
  const vid   = $("#introVideo");
  const skip  = $("#skipIntro");
  if (!intro || !vid) return;

  const SHOW_MS = 6000;    // show time after playback begins
  const STAGE1  = 700;     // video fade to black duration (CSS)
  let started = false, timerStage = null;

  const startFade = () => {
    intro.classList.add("fade-video");                   // Stage 1
    timerStage = setTimeout(() => {
      intro.classList.add("fade-overlay");               // Stage 2
      // remove from DOM after overlay transition
      intro.addEventListener("transitionend", () => {
        try { vid.pause(); vid.removeAttribute("src"); vid.load(); } catch {}
        intro.remove();
      }, { once:true });
    }, STAGE1 + 50);
  };

  const scheduleStartFade = () => {
    if (started) return;
    started = true;
    setTimeout(startFade, SHOW_MS);
  };

  // ensure playback starts
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
  on(prof, "click", () => about.scrollIntoView({ behavior: "smooth", block: "start" }));
}

/* --------------------------- Boot ------------------------------ */
function boot() {
  renderGroupedRows("rows-life",        FILES.life);
  renderGroupedRows("rows-portrait",    FILES.portrait);
  renderGroupedRows("rows-still",       FILES.still);
  renderGroupedRows("rows-exhibitions", FILES.exhibitions);
  renderGroupedRows("rows-sketches",    FILES.sketches);

  wireLightbox();
  smoothNav();
  menuControls();
  introFlow();
  profileLink();
}

document.addEventListener("DOMContentLoaded", boot);

/* ------------- Lightbox opener used by Flip Stack --------------- */
function openLightbox(src, caption){
  const lb = $("#lightbox"); if(!lb) return;
  $("#lb-img").src = src;
  $("#lb-cap").textContent = caption || "";
  lb.hidden = false;
}
