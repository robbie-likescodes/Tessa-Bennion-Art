/* =========================================================
   Tessa Bennion — app.js
   - Landing video fade & skip
   - Centered nav with smooth in-page navigation
   - Horizontal, snap-scrolling rows per section (phone-first)
   - Minimal lightbox
   - IntersectionObserver highlights active section in nav & dock
   - Data-driven: add more files/rows without editing HTML
========================================================= */

/* ---------------------- Your ordered media ---------------------- */
/* Tip: Add more by pushing to these arrays (or add new row arrays). */
const DATA = {
  life: [
    ["LifeA1.jpg", "LifeA2.jpg"],
    ["LifeB1.jpg", "LifeB2.jpg", "LifeB3.jpg"],
    ["LifeC1.jpg", "LifeC2.jpg"]
  ],
  portrait: [
    ["PortraitA1.jpg"],
    ["PortraitB1.jpg", "PortraitB2.jpg", "PortraitB3.jpg"],
    ["PortraitC1.jpg"],
    ["PortraitD1.jpg"],
    ["PortraitE1.jpg"],
    ["PortraitF1.jpg"],
    ["PortraitG1.jpg"],
    ["PortraitH1.jpg"]
  ],
  still: [
    ["StillA1.jpg", "StillA2.jpg", "StillA3.jpg", "StillA4.jpg"],
    ["StillB1.jpg"]
  ],
  exhibitions: [
    // Add rows like: ["ShowPoster1.jpg","ShowPoster2.jpg"]
  ],
  sketches: [
    ["SketchA1.jpg"],
    ["SketchB1.jpg"],
    ["SketchC1.jpg"],
    ["SketchD1.jpg"],
    ["SketchE1.jpg"]
  ]
};

/* If you nest by folder later (e.g. uploads/life/LifeA1.jpg),
   either update BASE or put full paths in the arrays above. */
const BASE = "uploads/";

/* --------------------------- Helpers --------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

/* Turn "PortraitB1.jpg" → "Portrait B1" */
function humanizeFilename(file) {
  const name = file.split("/").pop().replace(/\.[a-z0-9]+$/i, "");
  return name.replace(/[-_]+/g, " ").replace(/([a-z])([0-9])/gi, "$1 $2");
}

function makeCard(src, caption = "") {
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

  // Optional caption (comment out if you prefer no under-text)
  // const fc = document.createElement("figcaption");
  // fc.textContent = caption || humanizeFilename(src);
  // fig.appendChild(fc);

  return fig;
}

function renderRows(mountId, rows) {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  if (!rows || rows.length === 0) {
    const empty = document.getElementById(mountId.replace("rows-", "") + "-empty");
    if (empty) empty.hidden = false;
    return;
  }

  const frag = document.createDocumentFragment();
  rows.forEach(list => {
    const row = document.createElement("div");
    row.className = "row";
    list.forEach(file => row.appendChild(makeCard(file)));
    frag.appendChild(row);
  });
  mount.appendChild(frag);

  // Enable wheel-to-horizontal for convenience on desktop trackpads/mice
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
  const headerLinks = $$(".nav a");
  const dockLinks   = $$(".bottom-dock a");
  const allLinks    = [...headerLinks, ...dockLinks];

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

  // Active highlighting as sections enter view
  const map = new Map(allLinks.map(a => [a.getAttribute("href"), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = "#" + entry.target.id;
      allLinks.forEach(link => link.classList.toggle("active", link.getAttribute("href") === id));
      // bottom dock chip style
      $$(".bottom-dock a").forEach(link =>
        link.classList.toggle("active-chip", link.getAttribute("href") === id)
      );
    });
  }, { threshold: 0.2 });

  $$("section[id]").forEach(sec => io.observe(sec));
}

/* ------------------------- Intro video ------------------------- */
function introFlow() {
  const intro = $("#intro");
  const vid   = $("#introVideo");
  const skip  = $("#skipIntro");

  const endIntro = () => {
    intro.classList.add("hide");
    // Move focus to main for accessibility after fade
    setTimeout(() => $("#main")?.focus?.(), 300);
  };

  // Autoplay end (best path)
  on(vid, "ended", endIntro);
  // Fallback timeout (~10s)
  setTimeout(() => { if (!intro.classList.contains("hide")) endIntro(); }, 10000);
  // Manual "Skip"
  on(skip, "click", endIntro);

  // If autoplay is blocked (rare with muted), user scroll should hide intro
  on(window, "scroll", () => {
    if (!intro.classList.contains("hide") && window.scrollY > 40) endIntro();
  }, { passive: true });
}

/* --------------------------- Boot ------------------------------ */
function boot() {
  // Render rows in the exact order you specified
  renderRows("rows-life",        DATA.life);
  renderRows("rows-portrait",    DATA.portrait);
  renderRows("rows-still",       DATA.still);
  renderRows("rows-exhibitions", DATA.exhibitions);
  renderRows("rows-sketches",    DATA.sketches);

  wireLightbox();
  smoothNav();
  introFlow();
}

document.addEventListener("DOMContentLoaded", boot);
