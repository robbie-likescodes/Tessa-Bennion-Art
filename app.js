/* =========================================================
   Tessa Bennion — app.js
   - intro 6s hold + hard remove
   - menu autoclose
   - profile→about
   - grouped rows (images/videos)
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
function baseName(name){ return name.replace(/\.[a-z0-9]+$/i, ""); }

/* Series key: PortraitB1 → "PortraitB" */
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
    list.forEach(file => {
      if (isVideo(file)) row.appendChild(makeVideoCard(file));
      else row.appendChild(makeImageCard(file));
    });
    frag.appendChild(row);
  });
  mount.appendChild(frag);

  // Desktop: vertical wheel scroll nudges row horizontally
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

  const links = $$(".lb");
  links.forEach(a =>
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
  const menuLinks   = $$("#menuDropdown a");
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

  close(); // force closed on load

  btn.addEventListener('click', toggle);
  veil.addEventListener('click', close);

  window.addEventListener('scroll', close, { passive: true });
  window.addEventListener('resize', close);
  window.addEventListener('hashchange', close);

  drop.querySelectorAll('a').forEach(a=> a.addEventListener('click', close));
}

/* ------------------------- Intro video ------------------------- */
function introFlow() {
  const intro = $("#intro");
  const vid   = $("#introVideo");
  const skip  = $("#skipIntro");
  const SHOW_MS = 6000;

  if (!intro || !vid) return;

  let hideTimer = null;
  let ended = false;

  const hardHide = () => {
    if (!intro || intro.classList.contains("hide")) return;
    intro.classList.add("hide");
    const onTransEnd = () => {
      intro.removeEventListener("transitionend", onTransEnd);
      try { vid.pause(); vid.removeAttribute("src"); vid.load(); } catch {}
      intro.remove();
    };
    intro.addEventListener("transitionend", onTransEnd);
  };

  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!ended) hardHide(); }, SHOW_MS);
  };

  on(vid, "playing", scheduleHide);
  on(vid, "canplay", () => { if (vid.paused) vid.play().catch(()=>{}); });
  on(vid, "loadeddata", () => { if (vid.paused) vid.play().catch(()=>{}); });
  setTimeout(() => { if (!hideTimer) scheduleHide(); }, 1500);

  on(vid, "ended", () => { ended = true; hardHide(); });
  on(skip, "click", hardHide);
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
