/* =========================================================
   Academic Portfolio — app.js
   - Pure static (GitHub Pages)
   - Data-driven sections (no hard-coded counts)
   - Gentle, performant interactions
========================================================= */

/* --------------- Data source --------------- */
// Put your real JSON at: content/portfolio.json (optional).
// We’ll try to fetch it; if missing, we fall back to SAMPLE_DATA.
const DATA_URL = 'content/portfolio.json';

const SAMPLE_DATA = [
  // Minimal demo items (replace with your own)
  { title:'Portrait Study', year:2024, medium:'Oil on linen', categories:['portraits'], image:'uploads/sample/portraits-1-thumb.jpg', full:'uploads/sample/portraits-1-full.jpg' },
  { title:'Still Life w/ Copper', year:2023, medium:'Oil on panel', categories:['still-life'], image:'uploads/sample/still-1-thumb.jpg', full:'uploads/sample/still-1-full.jpg' },
  { title:'Plein Air Trees', year:2022, medium:'Oil on panel', categories:['plein-air'], image:'uploads/sample/plein-1-thumb.jpg', full:'uploads/sample/plein-1-full.jpg' },
  { title:'Figure Gesture', year:2024, medium:'Charcoal on paper', categories:['life-drawing'], image:'uploads/sample/life-1-thumb.jpg', full:'uploads/sample/life-1-full.jpg' },
  // Process pair: add 'under'
  { title:'Underdrawing Demo', year:2023, medium:'Oil', categories:['underdrawings'], image:'uploads/sample/final-thumb.jpg', full:'uploads/sample/final-full.jpg', under:'uploads/sample/under-full.jpg' },
];

/* --------------- Helpers --------------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const on = (el, ev, fn, opt)=> el && el.addEventListener(ev, fn, opt);

const fitList = (list=[], target=10, pad=false) => {
  const out = list.slice(0, target);
  if (!pad) return out;
  while (out.length < target) out.push({ placeholder:true });
  return out;
};

const byCategory = (items=[]) => {
  const map = { 'portraits':[], 'still-life':[], 'plein-air':[], 'life-drawing':[], 'underdrawings':[] };
  items.forEach(x => (x.categories||[]).forEach(c => { if(map[c]) map[c].push(x); }));
  return map;
};

const imgEl = (item) => {
  const fig = document.createElement('figure');
  fig.className = 'card';
  if (item.placeholder) {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.style.aspectRatio = '4/5';
    ph.textContent = 'Coming soon';
    fig.appendChild(ph);
    return fig;
  }
  const a = document.createElement('a');
  a.href = item.full || item.image;
  a.className = 'lb';
  a.setAttribute('data-cap', `${item.title || ''}${item.year ? ` · ${item.year}`:''}${item.medium ? ` · ${item.medium}`:''}`);
  const img = document.createElement('img');
  img.loading = 'lazy'; img.decoding = 'async';
  img.src = item.image || item.full;
  img.alt = `${item.title||'Artwork'}${item.year?`, ${item.year}`:''}${item.medium?`, ${item.medium}`:''}`;
  a.appendChild(img);
  fig.appendChild(a);
  const cap = document.createElement('figcaption');
  cap.textContent = item.title || '';
  fig.appendChild(cap);
  if (item.status === 'Sold' || item.sold) {
    const b = document.createElement('div'); b.className='badge'; b.textContent='Sold'; fig.appendChild(b);
  }
  return fig;
};

/* --------------- Renderers --------------- */
function renderCarousel(mount, items=[], target=10, pad=true){
  if (!mount) return;
  const slides = fitList(items, target, pad);
  slides.forEach(it => {
    const cell = document.createElement('div');
    cell.className = 'slide';
    cell.appendChild(imgEl(it));
    mount.appendChild(cell);
  });
  // autoplay only when visible
  if (items.length > 1) {
    let i=0, timer=null;
    const go = n => {
      const w = mount.querySelector('.slide')?.offsetWidth || 0;
      mount.scrollTo({ left: n*w + n*parseInt(getComputedStyle(mount).gap||'0',10), behavior:'smooth' });
    };
    const io = new IntersectionObserver(es=>{
      es.forEach(e=>{
        if (e.isIntersecting) {
          timer = setInterval(()=>{ i = (i+1)%items.length; go(i); }, 3500);
        } else { clearInterval(timer); }
      });
    }, {threshold:0.3});
    io.observe(mount.closest('.carousel'));
  }
}

function renderGrid(mount, items=[]){
  if (!mount) return;
  if (!items.length){ mount.innerHTML = '<p class="muted">More coming soon.</p>'; return; }
  const frag = document.createDocumentFragment();
  items.forEach(it => frag.appendChild(imgEl(it)));
  mount.appendChild(frag);
}

function renderFilmstrip(rail, items=[]){
  if (!rail) return;
  if (!items.length) return;
  const frag = document.createDocumentFragment();
  items.forEach(it=>{
    const img = document.createElement('img');
    img.loading='lazy'; img.decoding='async';
    img.src = it.image || it.full;
    img.alt = it.title || 'Artwork';
    frag.appendChild(img);
  });
  rail.appendChild(frag);
}

function renderScrubbers(mount, items=[]){
  if (!mount) return;
  const pairs = items.filter(x => x.under); // needs an 'under' image
  pairs.forEach(it=>{
    const wrap = document.createElement('div'); wrap.className='scrub';
    wrap.innerHTML = `
      <img class="base" src="${it.full || it.image}" alt="${it.title||'Final'}">
      <img class="top"  src="${it.under}" alt="${it.title||'Underdrawing'} (under)">
      <div class="ui"><input class="range" type="range" value="50" min="0" max="100" aria-label="Reveal underdrawing"></div>
    `;
    const r = $('.range', wrap);
    const set = v => wrap.style.setProperty('--cut', `${100-v}%`);
    on(r, 'input', e => set(e.target.value));
    set(r.value);
    mount.appendChild(wrap);
  });
}

/* --------------- Lightbox (simple) --------------- */
const LB = {
  el: $('#lightbox'), img: $('#lb-img'), cap: $('#lb-cap'),
  btnX: $('.lb-close'), btnP: $('.lb-prev'), btnN: $('.lb-next'),
  items: [], index: 0
};
function openLB(i){
  LB.index = i;
  const it = LB.items[i];
  LB.img.src = it.href;
  LB.img.alt = it.alt || '';
  LB.cap.textContent = it.cap || '';
  LB.el.hidden = false;
}
function closeLB(){ LB.el.hidden = true; }
function nextLB(d=1){
  LB.index = (LB.index + d + LB.items.length) % LB.items.length;
  openLB(LB.index);
}
function wireLightbox(){
  const links = $$('.lb');
  LB.items = links.map(a => ({ href:a.href, cap:a.dataset.cap, alt:$('img',a)?.alt || '' }));
  links.forEach((a,i)=> on(a,'click', (e)=>{ e.preventDefault(); openLB(i); }));
  on(LB.btnX,'click', closeLB);
  on(LB.btnN,'click', ()=>nextLB(+1));
  on(LB.btnP,'click', ()=>nextLB(-1));
  on(LB.el,'click', (e)=>{ if(e.target===LB.el) closeLB(); });
  on(document,'keydown', (e)=> {
    if (LB.el.hidden) return;
    if (e.key==='Escape') closeLB();
    if (e.key==='ArrowRight') nextLB(+1);
    if (e.key==='ArrowLeft') nextLB(-1);
  });
}

/* --------------- Scroll effects & IO --------------- */
function stackedHero(){
  const panels = $$('.panel');
  const onScroll = () => {
    panels.forEach(p=>{
      const r = p.getBoundingClientRect();
      const t = Math.min(Math.max(1 - r.top/innerHeight,0),1); // 0..1
      p.style.setProperty('--o', 0.25 + 0.75*t);
      p.style.setProperty('--py', `${(1-t)*16}px`);
    });
  };
  on(window,'scroll', onScroll, {passive:true});
  onScroll();
}
function filmstripMotion(){
  const rails = $$('.film .rail');
  const onScroll = ()=> rails.forEach(rail=>{
    rail.style.transform = `translateX(${-(scrollY*0.15)%400}px)`;
  });
  on(window,'scroll', onScroll, {passive:true});
  onScroll();
}
function ioRevealsAndDock(){
  const dockLinks = $$('.bottom-dock a');
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{
      e.target.classList.toggle('in', e.isIntersecting);
      if (e.isIntersecting){
        const id = '#' + e.target.id;
        dockLinks.forEach(a => a.classList.toggle('active-chip', a.getAttribute('href')===id));
        // top nav active
        $$('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href')===id));
      }
    });
  }, {threshold:0.15});
  $$('[data-io]').forEach(el=> io.observe(el));
}

/* --------------- View Transitions (cross-fade) --------------- */
function softInternalNav(){
  document.addEventListener('click', (e)=>{
    const a = e.target.closest('a[href^="#"]');
    if(!a) return;
    // normal anchor scroll; we just add a tiny highlight via :target behavior (handled by CSS if desired)
  });
}

/* --------------- Boot --------------- */
async function boot(){
  // Load data (try JSON, else sample)
  let items = [];
  try {
    const res = await fetch(DATA_URL, {cache:'no-store'});
    if (res.ok) items = await res.json();
    else items = SAMPLE_DATA;
  } catch { items = SAMPLE_DATA; }

  // Group
  const cats = byCategory(items);

  // Render per section
  renderCarousel($('#track-portraits'),     cats['portraits'], 12, true);
  renderGrid    ($('#grid-portraits'),      cats['portraits']);

  renderCarousel($('#track-still-life'),    cats['still-life'], 10, true);
  renderGrid    ($('#grid-still-life'),     cats['still-life']);

  renderFilmstrip($('#rail-plein-air'),     cats['plein-air']);
  renderGrid    ($('#grid-plein-air'),      cats['plein-air']);

  renderCarousel($('#track-life-drawing'),  cats['life-drawing'], 8, true);
  renderGrid    ($('#grid-life-drawing'),   cats['life-drawing']);

  renderScrubbers($('#scrub-wrap'),         cats['underdrawings']);
  renderGrid    ($('#grid-underdrawings'),  cats['underdrawings']);

  // Interactions
  wireLightbox();
  stackedHero();
  filmstripMotion();
  ioRevealsAndDock();
  softInternalNav();
}
boot();
