// PlazaIT Product Lightbox (vanilla, no CDN) — v4 (swipe-down to close)
(function(){
  const state = {
    items: [],
    open: false,
    idx: 0,
    scale: 1,
    minScale: 1,
    maxScale: 4,
    tx: 0, ty: 0,
    isDragging: false,
    dragStartX: 0, dragStartY: 0,
    baseTx: 0, baseTy: 0,
    touchStartX: 0, touchStartY: 0,
    lastTap: 0,
    swipeMode: 'none', // 'none' | 'h' | 'v'
    totalDx: 0, totalDy: 0
  };

  let root, imgEl, counterEl, btnPrev, btnNext, btnClose, canvas;

  const ORIGIN = (location.origin || (location.protocol + '//' + location.host));

  function absUrl(u){
    if (!u) return '';
    try {
      if (/^https?:\/\//i.test(u)) return u;
      return new URL(u, ORIGIN).href;
    } catch(_) { return u; }
  }
  function fileName(u){
    try { return new URL(u, ORIGIN).pathname.split('/').pop().toLowerCase(); }
    catch(_){ return String(u||'').split('/').pop().toLowerCase(); }
  }

  function buildItems(){
    const gd = (window.galleryData || []).filter(Boolean);
    if (gd.length){
      state.items = gd.map(g => ({
        src: absUrl(g.url), alt: g.alt || '', slug: g.slug || '', w: g.w || 1200, h: g.h || 1200
      })).filter(it => !!it.src);
      return;
    }
    const thumbs = document.querySelectorAll('.pd-thumb-btn');
    state.items = Array.from(thumbs).map(btn => {
      const raw = btn.getAttribute('data-full') || '';
      return { src: absUrl(raw), alt: btn.getAttribute('data-alt') || '', slug: btn.getAttribute('data-slug') || '', w: 1200, h: 1200 };
    }).filter(it => !!it.src);
  }

  function ensureUI(){
    if (root) return;
    root = document.createElement('div');
    root.className = 'pd-lb';
    root.id = 'pd-lightbox';
    root.setAttribute('role','dialog');
    root.setAttribute('aria-modal','true');
    root.setAttribute('aria-hidden','true');
    root.setAttribute('tabindex','-1');

    // Canvas terlebih dulu (z-index di CSS membuat tombol di atas)
    root.innerHTML = `
      <div class="pd-lb-canvas"><img class="pd-lb-img" id="pd-lb-img" alt=""></div>
      <button class="pd-lb-close" aria-label="Tutup" title="Tutup">&times;</button>
      <button class="pd-lb-prev" aria-label="Sebelumnya" title="Sebelumnya">&#10094;</button>
      <button class="pd-lb-next" aria-label="Berikutnya" title="Berikutnya">&#10095;</button>
      <div class="pd-lb-counter" id="pd-lb-counter">1 / 1</div>
    `;
    document.body.appendChild(root);

    imgEl     = root.querySelector('#pd-lb-img');
    counterEl = root.querySelector('#pd-lb-counter');
    btnPrev   = root.querySelector('.pd-lb-prev');
    btnNext   = root.querySelector('.pd-lb-next');
    btnClose  = root.querySelector('.pd-lb-close');
    canvas    = root.querySelector('.pd-lb-canvas');

    // Button clicks
    btnPrev.addEventListener('click', (e)=>{ e.stopPropagation(); prev(); });
    btnNext.addEventListener('click', (e)=>{ e.stopPropagation(); next(); });
    btnClose.addEventListener('click', (e)=>{ e.stopPropagation(); close(); });

    // Klik backdrop untuk tutup
    root.addEventListener('click', (e)=>{ if (e.target === root) close(); });

    // Keyboard global
    document.addEventListener('keydown', (e)=>{
      if (!state.open) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    });

    // Wheel zoom (desktop)
    root.addEventListener('wheel', (e)=>{
      if (!state.open) return;
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.2;
      zoomAt(delta, e.clientX, e.clientY);
    }, { passive: false });

    // Drag pan (mouse)
    canvas.addEventListener('mousedown', (e)=>{
      if (state.scale <= 1) return;
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.baseTx = state.tx;
      state.baseTy = state.ty;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e)=>{
      if (!state.isDragging) return;
      const dx = e.clientX - state.dragStartX;
      const dy = e.clientY - state.dragStartY;
      setTranslate(state.baseTx + dx, state.baseTy + dy);
    });
    window.addEventListener('mouseup', ()=>{ state.isDragging = false; });

    // Touch: swipe navigate (H), swipe-down close (V), double-tap zoom, drag pan
    canvas.addEventListener('touchstart', (e)=>{
      if (!state.open) return;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        state.touchStartX = t.clientX;
        state.touchStartY = t.clientY;
        state.totalDx = 0;
        state.totalDy = 0;
        state.swipeMode = 'none';

        state.isDragging = state.scale > 1;
        state.dragStartX = t.clientX;
        state.dragStartY = t.clientY;
        state.baseTx = state.tx;
        state.baseTy = state.ty;

        // Double-tap toggle zoom
        const now = Date.now();
        if (now - state.lastTap < 300) {
          if (state.scale > 1) resetTransform(); else zoomAt(+1, t.clientX, t.clientY, 2);
          state.lastTap = 0;
          e.preventDefault();
          return;
        }
        state.lastTap = now;
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e)=>{
      if (!state.open) return;

      // Drag pan saat zoom
      if (state.isDragging && e.touches.length === 1 && state.scale > 1) {
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - state.dragStartX;
        const dy = t.clientY - state.dragStartY;
        setTranslate(state.baseTx + dx, state.baseTy + dy);
        return;
      }

      // Gesture saat scale <= 1
      if (state.scale <= 1 && e.touches.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - state.touchStartX;
        const dy = t.clientY - state.touchStartY;
        state.totalDx = dx; state.totalDy = dy;

        // Tentukan mode swipe di awal gerakan
        if (state.swipeMode === 'none') {
          const absX = Math.abs(dx), absY = Math.abs(dy);
          if (absY > 12 && absY > absX * 1.3) {
            state.swipeMode = 'v'; // swipe vertical (untuk close)
          } else if (absX > 12 && absX > absY * 1.3) {
            state.swipeMode = 'h'; // swipe horizontal (ganti slide)
          }
        }

        if (state.swipeMode === 'v') {
          // Ikuti jari, kurangi opacity untuk feedback
          e.preventDefault();
          setRootDrag(dy);
        } else if (state.swipeMode === 'h') {
          // Biarkan sampai touchend untuk menentukan next/prev (tidak perlu preventDefault di sini)
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e)=>{
      if (!state.open) return;

      if (state.scale <= 1) {
        const dx = state.totalDx;
        const dy = state.totalDy;

        if (state.swipeMode === 'v') {
          const TH = 80; // threshold jarak piksel untuk menutup
          if (Math.abs(dy) > TH) {
            // Animasi keluar arah swipe
            animateClose(dy);
          } else {
            // Snap back
            resetRootDrag(true);
          }
        } else if (state.swipeMode === 'h') {
          if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
        }
      }

      state.isDragging = false;
      state.swipeMode = 'none';
      state.totalDx = 0;
      state.totalDy = 0;
    });
  }

  function setImage(idx){
    if (!state.items.length) return;
    state.idx = (idx + state.items.length) % state.items.length;
    const it = state.items[state.idx];
    imgEl.src = it.src;
    imgEl.alt = it.alt || '';
    counterEl.textContent = (state.idx + 1) + ' / ' + state.items.length;
    resetTransform();
    preloadNeighbors();
  }

  function resetTransform(){
    state.scale = 1;
    state.tx = 0; state.ty = 0;
    applyTransform();
  }

  function setTranslate(tx, ty){
    state.tx = tx; state.ty = ty;
    applyTransform();
  }

  function applyTransform(){
    imgEl.style.transform = `translate3d(${state.tx}px, ${state.ty}px, 0) scale(${state.scale})`;
  }

  function zoomAt(delta, clientX, clientY, snapTo){
    const old = state.scale;
    let next = (typeof snapTo === 'number') ? snapTo : (old + delta);
    next = Math.max(state.minScale, Math.min(state.maxScale, next));

    if (next !== old) {
      const rect = imgEl.getBoundingClientRect();
      const cx = clientX - rect.left - rect.width/2;
      const cy = clientY - rect.top  - rect.height/2;
      state.tx -= cx * (next/old - 1);
      state.ty -= cy * (next/old - 1);
      state.scale = next;
      applyTransform();
    }
  }

  function preloadNeighbors(){
    if (state.items.length < 2) return;
    const nextIdx = (state.idx + 1) % state.items.length;
    const prevIdx = (state.idx - 1 + state.items.length) % state.items.length;
    [nextIdx, prevIdx].forEach(i=>{
      const img = new Image(); img.src = state.items[i].src;
    });
  }

  // ----- Swipe-down visual helpers -----
  function setRootDrag(dy){
    const damped = dy * 0.6; // redam gerakan agar lembut
    const abs = Math.abs(dy);
    const fade = Math.max(0, Math.min(1, 1 - abs / 300)); // transparansi sesuai jarak
    root.style.transform = `translate3d(0, ${damped}px, 0)`;
    root.style.opacity = String(0.95 * fade + 0.05); // jangan jadi 0 total sebelum close
  }
  function resetRootDrag(withAnim){
    if (withAnim) {
      root.style.transition = 'transform .18s ease, opacity .18s ease';
      root.style.transform = 'translate3d(0,0,0)';
      root.style.opacity = '1';
      setTimeout(()=>{ root.style.transition = ''; }, 190);
    } else {
      root.style.transition = '';
      root.style.transform = '';
      root.style.opacity = '';
    }
  }
  function animateClose(dy){
    root.style.transition = 'transform .18s ease, opacity .18s ease';
    const off = (dy > 0 ? window.innerHeight : -window.innerHeight);
    root.style.transform = `translate3d(0, ${off}px, 0)`;
    root.style.opacity = '0';
    setTimeout(()=>{ root.style.transition = ''; close(); }, 180);
  }

  function setSiblingsInert(makeInert){
    // Inert semua saudara root (elemen lain di body) agar fokus tidak lari
    const nodes = Array.from(document.body.children).filter(el => el !== root);
    nodes.forEach(el=>{
      if (makeInert) {
        if (!el.hasAttribute('inert')) el.setAttribute('inert','');
      } else {
        if (el.hasAttribute('inert')) el.removeAttribute('inert');
      }
    });
  }

  function open(idx){
    if (!state.items.length) buildItems();
    if (!state.items.length) return;
    ensureUI();

    // Reset efek drag visual
    resetRootDrag(false);

    document.body.style.overflow = 'hidden';
    root.classList.add('show');
    root.removeAttribute('aria-hidden'); // hindari aria-hidden saat fokus child
    setSiblingsInert(true);

    state.open = true;
    setImage(typeof idx === 'number' ? idx : 0);

    // Fokuskan dialog agar keyboard pasti tertangkap
    try { root.focus(); } catch(_){}
  }

  function close(){
    state.open = false;
    root.classList.remove('show');
    root.setAttribute('aria-hidden','true');
    setSiblingsInert(false);
    document.body.style.overflow = '';

    // Bersihkan transform/opacity
    resetRootDrag(false);
  }

  function next(){ setImage(state.idx + 1); }
  function prev(){ setImage(state.idx - 1); }

  function findIndexByUrl(url){
    const target = fileName(absUrl(url));
    const idx = state.items.findIndex(it => fileName(it.src) === target);
    return idx >= 0 ? idx : 0;
  }

  function initPdLightbox(){
    buildItems();
    ensureUI();

    // Klik gambar utama → buka LB di index yang sama
    const mainImg = document.getElementById('pd-main-img');
    if (mainImg) {
      mainImg.style.cursor = 'zoom-in';
      mainImg.addEventListener('click', ()=>{
        open(findIndexByUrl(mainImg.src));
      });
    }

    // Klik gambar slider mobile → buka LB di gambar yang diketuk
    const slider = document.getElementById('pd-mobile-slider');
    if (slider) {
      slider.addEventListener('click', (e)=>{
        const im = e.target && e.target.tagName === 'IMG' ? e.target : e.target.closest('img');
        if (!im) return;
        open(findIndexByUrl(im.src));
      });
    }

    // (Opsional) double-click pada thumbnail untuk buka langsung
    const thumbs = document.querySelectorAll('.pd-thumb-btn');
    thumbs.forEach((btn)=>{
      let last = 0;
      btn.addEventListener('click', ()=>{
        const now = Date.now();
        if (now - last < 300) {
          const src = btn.getAttribute('data-full') || '';
          open(findIndexByUrl(absUrl(src)));
          last = 0;
        } else {
          last = now;
        }
      });
    });

    // Ekspos API
    window.PDLightbox = { open, close, next, prev, findIndexByUrl };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPdLightbox);
  } else {
    initPdLightbox();
  }
})();