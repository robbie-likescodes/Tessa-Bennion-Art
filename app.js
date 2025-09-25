/* =========================================================
   Tessa Bennion — app.js (mp4 intro + auto grouping + video cards)
========================================================= */

/* ------------ List your files (exact names) ------------ */
/* TIP: You only list files; grouping is automatic.
   When you add new images/videos later, just append here. */
const FILES = {
  life: [
    "LifeA1.jpeg", "LifeA2.jpeg",
    "LifeB1.jpeg", "LifeB2.jpeg", "LifeB3.jpeg",
    "LifeC1.jpeg", "LifeC2.jpeg"
  ],
  portrait: [
    "PortraitA1.JPEG",
    "PortaitB1.jpeg", "PortrainB2.jpeg", "PortraitB3.PNG",
    "PortraitC1.jpeg",
    "PortraitD1.jpeg",
    "PortraitE1.jpeg",
    "PortraitF1.jpeg",
    "PortraitG1.jpeg",
    "PortraitH1.jpeg"
  ],
  still: [
    "StillA1.jpeg", "StillA2.JPG", "StillA3.JPEG", "StillA4.jpeg",
    "StillB1.jpeg"
  ],
  exhibitions: [
    // New: show these two videos as a horizontal collection
    "VidA2.mp4", "VidA3.mp4"
    // Add any posters or images here as well; they’ll auto-group.
  ],
  sketches: [
    "SketchA1.jpeg",
    "SketchB1.jpeg",
    "SketchC1.jpeg",
    "SketchD1.jpeg",
    "SketchE1.jpeg"
  ]
};

const BASE = "uploads/";

/* --------------------------- Helpers --------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

function ext(name){ return (name.split(".").pop() || "").toLowerCase(); }
function isVideo(name){ return ext(name) === "mp4"; }
function isImage(name){ return ["jpg","jpeg","png","gif","webp","avif","png"].includes(ext(name)); }

function baseName(name){
  return name.replace(/\.[a-z0-9]+$/i, "");
}

/* Series key:
   - Match: Letters + ONE capital letter + digits (e.g., PortraitB12 → key "PortraitB")
   - Else: use the whole base name so it forms its own row
*/
function seriesKey(name){
  const b = baseName(name);
  const m = b.match(/^([A-Za-z]+[A-Z])[0-9]+$/);
  return m ? m[1] : b;
}

/* Group files into rows by series key, and sort items in a row by number suffix */
function groupIntoRows(fileList){
  const map = new Map();
  for(const f of fileList){
    const key = seriesKey(f);
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(f);
  }
  // sort inside each row by trailing number if present
  const rows = [];
  map.forEach((arr) => {
    arr.sort((a,b) => {
      const na = parseInt(baseName(a).match(/(\d+)$/)?.[1] || "0", 10);
      const nb = parseInt(baseName(b).match(/(\d+)$/)?.[1] || "0", 10);
      return na - nb;
    });
    rows.push(arr);
  });
  // Optional: stable order by first item’s name to keep predictable stacking
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
  v.muted = true;          // less intrusive on mobile
  v.loop = false;          // change to true if you prefer loops in rails
  fig.appendChild(v);

  // Optionally autoplay on visibility (commented out)
  // const io = new IntersectionObserver((es)=>{ es.forEach(e=>{ if(e.isIntersecting) v.play().catch(()=>{}); else v.pause(); }); }, {threshold: 0.6});
  // io.observe(v);

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
/* For images only (videos are playable inline) */
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
  const headerLinks = $$(".nav a");            // (legacy hidden, harmless)
  const dockLinks   = $$(".bottom-dock a");
  const menuLinks   = $$(".menu-dropdown a");  // dropdown links
  const allLinks    = [...headerLinks, ...dockLinks, ...menuLinks];

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

  btn.addEventListener('click', toggle);
  veil.addEventListener('click', close);
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') close(); });
  drop.querySelectorAll('a').forEach(a=> a.addEventListener('click', close));
}

/* ------------------------- Intro video ------------------------- */
function introFlow() {
  const intro = $("#intro");
  const vid   = $("#introVideo");
  const skip  = $("#skipIntro");

  const endIntro = () => {
    if (intro.classList.contains("hide")) return;
    intro.classList.add("hide");
    setTimeout(() => $("#main")?.focus?.(), 300);
  };

  // Try to play proactively (some devices require an explicit call)
  if (vid) {
    const tryPlay = () => vid.play().catch(()=>{ /* ignore */ });
    if (vid.readyState >= 2) tryPlay();
    else vid.addEventListener("canplay", tryPlay, { once: true });
  }

  on(vid, "ended", endIntro);
  // Fallback timeout (~10s) in case mp4 can’t play
  setTimeout(() => { if (!intro.classList.contains("hide")) endIntro(); }, 10000);
  on(skip, "click", endIntro);
  on(window, "scroll", () => { if (!intro.classList.contains("hide") && window.scrollY > 40) endIntro(); }, { passive: true });
}

/* --------------------------- Boot ------------------------------ */
function boot() {
  renderGroupedRows("rows-life",        FILES.life);
  renderGroupedRows("rows-portrait",    FILES.portrait);
  renderGroupedRows("rows-still",       FILES.still);
  renderGroupedRows("rows-exhibitions", FILES.exhibitions); // includes VidA2/VidA3.mp4
  renderGroupedRows("rows-sketches",    FILES.sketches);

  wireLightbox();
  smoothNav();
  menuControls();
  introFlow();
}

document.addEventListener("DOMContentLoaded", boot);
