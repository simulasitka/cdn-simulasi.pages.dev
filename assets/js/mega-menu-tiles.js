// Tile Mega Menu — Enhanced 2025 (Stagger animations, product counts, loading states)
// Includes safe-area hover handling (no backdrop flicker)

(function(){
  const trigger   = document.querySelector('[data-mm2="trigger"]');
  const panel     = document.querySelector('[data-mm2="panel"]');
  const topView   = document.querySelector('[data-mm2="top"]');
  const detailView= document.querySelector('[data-mm2="detail"]');
  const backdrop  = document.querySelector('[data-mm2="backdrop"]');
  if (!trigger || !panel || !topView || !detailView) return;

  const apiUrl = '/api/categories_tree.php?top=16&child=18&grand=14';
  const isDesktop = () => window.matchMedia('(min-width: 961px)').matches;

  let data = [];
  let hoverTimer, closeTimer;
  let isLoading = false;

  const esc = s => (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  
  // Mobile close button HTML
  const mobileCloseBtn = () => `
    <button type="button" class="mm2-mobile-close" data-mm2="close" aria-label="Tutup menu">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  // Category-specific gradient colors (16 unique combinations)
  const categoryGradients = [
    { from: '#e0e7ff', to: '#fff', border: '#c7d2fe', color: '#4f46e5' },  // Indigo
    { from: '#dbeafe', to: '#fff', border: '#bfdbfe', color: '#1e40af' },  // Blue
    { from: '#d1fae5', to: '#fff', border: '#a7f3d0', color: '#059669' },  // Green
    { from: '#fef3c7', to: '#fff', border: '#fde68a', color: '#d97706' },  // Amber
    { from: '#fce7f3', to: '#fff', border: '#fbcfe8', color: '#db2777' },  // Pink
    { from: '#e9d5ff', to: '#fff', border: '#d8b4fe', color: '#9333ea' },  // Purple
    { from: '#ffedd5', to: '#fff', border: '#fed7aa', color: '#ea580c' },  // Orange
    { from: '#ccfbf1', to: '#fff', border: '#99f6e4', color: '#0d9488' },  // Teal
    { from: '#fef9c3', to: '#fff', border: '#fef08a', color: '#ca8a04' },  // Yellow
    { from: '#ffe4e6', to: '#fff', border: '#fecdd3', color: '#e11d48' },  // Rose
    { from: '#e0f2fe', to: '#fff', border: '#bae6fd', color: '#0284c7' },  // Sky
    { from: '#f3e8ff', to: '#fff', border: '#e9d5ff', color: '#a855f7' },  // Violet
    { from: '#dcfce7', to: '#fff', border: '#bbf7d0', color: '#16a34a' },  // Emerald
    { from: '#fef2f2', to: '#fff', border: '#fecaca', color: '#dc2626' },  // Red
    { from: '#eff6ff', to: '#fff', border: '#dbeafe', color: '#2563eb' },  // Blue-600
    { from: '#f5f3ff', to: '#fff', border: '#ede9fe', color: '#7c3aed' },  // Violet-600
  ];
  
  const icon = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h5l2 3h11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v3"></path></svg>`;

  // Recent (optional future use)
  const REC_KEY='mm2_recent';
  const saveRecent=(path,label)=>{ try{
    let list=JSON.parse(localStorage.getItem(REC_KEY)||'[]').filter(x=>x&&x.path!==path);
    list.unshift({path,label,t:Date.now()}); localStorage.setItem(REC_KEY, JSON.stringify(list.slice(0,8)));
  }catch{} };

  function isToSafeArea(e){
    const t = e && e.relatedTarget ? e.relatedTarget : null;
    if (!t) return false;
    return (trigger.contains(t) || panel.contains(t) || (backdrop && backdrop.contains(t)));
  }

  function open(){ 
    document.body.classList.add('mm2-open'); 
    showTop(); 
    // Add entrance animation class
    setTimeout(() => panel.classList.add('mm2-animated'), 10);
  }
  function close(){ 
    document.body.classList.remove('mm2-open');
    panel.classList.remove('mm2-animated');
  }
  function showTop(){ 
    topView.classList.add('is-active'); 
    detailView.classList.remove('is-active'); 
  }
  
  // Loading skeleton
  function showLoading() {
    const skeletons = Array.from({length: 12}, (_, i) => `
      <div class="mm2-card mm2-skeleton" style="animation-delay: ${i * 0.02}s">
        <span class="mm2-ico skeleton-box"></span>
        <span style="flex: 1;">
          <div class="skeleton-line" style="width: 60%; height: 16px; margin-bottom: 6px;"></div>
          <div class="skeleton-line" style="width: 40%; height: 12px;"></div>
        </span>
      </div>
    `).join('');
    topView.innerHTML = `<div class="mm2-top"><div class="mm2-grid">${skeletons}</div></div>`;
  }
  
  // Count total products in a category tree
  function countProducts(node) {
    let count = node.product_count || 0;
    if (Array.isArray(node.children)) {
      node.children.forEach(child => {
        count += countProducts(child);
      });
    }
    return count;
  }
  
  // Cache for fetched thumbnails to avoid duplicate requests
  const thumbnailCache = new Map();
  
  // Fetch product thumbnails for a category
  function fetchCategoryThumbnails(categoryPath) {
    // Check cache first
    if (thumbnailCache.has(categoryPath)) {
      injectThumbnails(categoryPath, thumbnailCache.get(categoryPath));
      return;
    }
    
    const url = `/api/category_products_preview.php?path=${encodeURIComponent(categoryPath)}&limit=2`;
    
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Network error');
        return r.json();
      })
      .then(data => {
        if (data.success && data.products && data.products.length > 0) {
          thumbnailCache.set(categoryPath, data.products);
          injectThumbnails(categoryPath, data.products);
        } else {
          // No products, remove skeleton
          removeThumbSkeletons(categoryPath);
        }
      })
      .catch(err => {
        console.warn('Failed to load thumbnails for', categoryPath, err);
        removeThumbSkeletons(categoryPath);
      });
  }
  
  // Inject thumbnails into the DOM
  function injectThumbnails(categoryPath, products) {
    const links = detailView.querySelectorAll(`[data-cat-path="${categoryPath}"]`);
    links.forEach(link => {
      const thumbsContainer = link.querySelector('.mm2-thumbs');
      if (!thumbsContainer) return;
      
      const thumbsHtml = products.slice(0, 2).map(p => 
        `<img src="${esc(p.img)}" alt="${esc(p.name)}" class="mm2-thumb" title="${esc(p.name)}" loading="lazy">`
      ).join('');
      
      thumbsContainer.innerHTML = thumbsHtml;
      thumbsContainer.removeAttribute('data-loading');
    });
  }
  
  // Remove skeleton loaders when no products
  function removeThumbSkeletons(categoryPath) {
    const links = detailView.querySelectorAll(`[data-cat-path="${categoryPath}"]`);
    links.forEach(link => {
      const thumbsContainer = link.querySelector('.mm2-thumbs');
      if (thumbsContainer) {
        thumbsContainer.remove();
      }
    });
  }

  function showDetail(node){
    const title = node.label.split('/')[0];
    const children = Array.isArray(node.children) ? node.children : [];
    const hasChildren = children.length > 0;

    const subnav = hasChildren ? `
      <nav class="mm2-subnav" role="tablist">
        ${children.map((c2,i)=>{
          const t = c2.label.split('/').slice(-1)[0];
          return `<button class="mm2-subitem${i===0?' active':''}" role="tab" data-idx="${i}" aria-selected="${i===0?'true':'false'}">${esc(t)}</button>`;
        }).join('')}
      </nav>` : '';

    const subcontent = `<div class="mm2-subcontent" data-mm2="subcontent"></div>`;

    detailView.innerHTML = `
      <div class="mm2-detail">
        <div class="mm2-detail-header">
          <button class="mm2-back" type="button" data-mm2="back" aria-label="Kembali">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div class="mm2-detail-title">${esc(title)}</div>
        </div>

        ${hasChildren ? `
          <div class="mm2-detail-layout">
            ${subnav}
            ${subcontent}
          </div>` : `
          <div class="mm2-links">
            <a class="mm2-link mm2-seeall" href="/product/kategori/?kategori_path=${encodeURIComponent(node.path)}" data-mm2="nav" data-path="${esc(node.path)}" data-label="${esc(node.label)}">
              <strong>Lihat semua ${esc(title)}</strong>
            </a>
          </div>
        `}
      </div>
    `;

    topView.classList.remove('is-active');
    detailView.classList.add('is-active');

    if (hasChildren) {
      const subEl  = detailView.querySelector('.mm2-subnav');
      const contEl = detailView.querySelector('[data-mm2="subcontent"]');
      let activeIdx = 0;

      const renderSubgrid = (idx) => {
        const c2 = children[idx]; if (!c2) { contEl.innerHTML=''; return; }
        const title2 = c2.label.split('/').slice(-1)[0];
        const l3 = Array.isArray(c2.children) ? c2.children : [];
        const l3Html = l3.map(c3 => `
          <a class="mm2-link" href="/product/kategori/?kategori_path=${encodeURIComponent(c3.path)}" data-mm2="nav" data-path="${esc(c3.path)}" data-label="${esc(c3.label)}" data-cat-path="${esc(c3.path)}">
            <span class="mm2-link-text">${esc(c3.label.split('/').slice(-1)[0])}</span>
            <span class="mm2-thumbs" data-loading="true">
              <span class="mm2-thumb-skeleton"></span>
              <span class="mm2-thumb-skeleton"></span>
            </span>
          </a>`).join('');

        contEl.innerHTML = `
          <div class="mm2-links">
            <a class="mm2-link mm2-seeall" href="/product/kategori/?kategori_path=${encodeURIComponent(c2.path)}" data-mm2="nav" data-path="${esc(c2.path)}" data-label="${esc(c2.label)}">
              <strong>Lihat semua ${esc(title2)}</strong>
            </a>
            ${l3Html}
          </div>
        `;
        
        // Fetch product thumbnails for each level-3 category (desktop only)
        if (isDesktop()) {
          setTimeout(() => {
            l3.forEach(c3 => {
              fetchCategoryThumbnails(c3.path);
            });
          }, 100);
        }
      };

      renderSubgrid(activeIdx);

      // Desktop: hover ganti konten; Mobile & Desktop: click pilih
      subEl.addEventListener('mousemove', (e)=>{
        if (!isDesktop()) return;
        const it = e.target.closest('.mm2-subitem'); if (!it) return;
        const idx = +it.dataset.idx; if (!Number.isInteger(idx) || idx===activeIdx) return;
        subEl.querySelectorAll('.mm2-subitem').forEach(el=>el.classList.remove('active'));
        it.classList.add('active');
        subEl.querySelectorAll('.mm2-subitem').forEach(el=>el.setAttribute('aria-selected', el===it ? 'true':'false'));
        activeIdx = idx;
        renderSubgrid(activeIdx);
      });

      subEl.addEventListener('click', (e)=>{
        const it = e.target.closest('.mm2-subitem'); if (!it) return;
        const idx = +it.dataset.idx; if (!Number.isInteger(idx)) return;
        subEl.querySelectorAll('.mm2-subitem').forEach(el=>el.classList.remove('active'));
        it.classList.add('active');
        subEl.querySelectorAll('.mm2-subitem').forEach(el=>el.setAttribute('aria-selected', el===it ? 'true':'false'));
        activeIdx = idx;
        renderSubgrid(activeIdx);
      });

      // Delegate link clicks to add recent
      detailView.addEventListener('click', (e)=>{
        const nav = e.target.closest('[data-mm2="nav"]');
        if (nav) { saveRecent(nav.dataset.path, nav.dataset.label); }
      });
    }
  }

  function buildTop(){
    const html = data.map((n, idx) => {
      const title = n.label.split('/')[0];
      const childCount = (n.children||[]).length;
      const productCount = countProducts(n);
      const gradient = categoryGradients[idx % categoryGradients.length];
      
      // Dynamic subtitle based on content - shorter for mobile
      let sub = '';
      if (productCount > 0) {
        sub = `${productCount} produk`;
        if (childCount > 0) sub += ` · ${childCount} kat`;
      } else if (childCount > 0) {
        sub = `${childCount} kategori`;
      } else {
        sub = 'Lihat semua';
      }
      
      const iconStyle = `background: linear-gradient(135deg, ${gradient.from}, ${gradient.to}); border-color: ${gradient.border}; color: ${gradient.color};`;
      
      return `<a href="/product/kategori/?kategori_path=${encodeURIComponent(n.path)}" class="mm2-card" data-mm2="card" data-path="${esc(n.path)}" data-label="${esc(n.label)}">
        <span class="mm2-ico" style="${iconStyle}">${icon()}</span>
        <span style="flex: 1;">
          <div class="mm2-title">${esc(title)}</div>
          <div class="mm2-sub">${esc(sub)}</div>
        </span>
      </a>`;
    }).join('');
    const closeBtnHtml = !isDesktop() ? mobileCloseBtn() : '';
    topView.innerHTML = `<div class="mm2-top">${closeBtnHtml}<div class="mm2-grid">${html}</div></div>`;
  }

  // Open/close with safe-area
  trigger.addEventListener('click', (e)=>{ e.preventDefault(); document.body.classList.contains('mm2-open') ? close() : open(); });
  trigger.addEventListener('pointerenter', ()=>{ if (isDesktop()) { clearTimeout(closeTimer); hoverTimer=setTimeout(open, 80); }});
  trigger.addEventListener('pointerleave', (e)=>{ if (isDesktop() && !isToSafeArea(e)) { clearTimeout(hoverTimer); closeTimer=setTimeout(close, 200); }});
  panel.addEventListener('pointerenter', ()=>{ if (isDesktop()) clearTimeout(closeTimer); });
  panel.addEventListener('pointerleave', (e)=>{ if (isDesktop() && !isToSafeArea(e)) closeTimer=setTimeout(close, 200); });
  backdrop?.addEventListener('pointerenter', ()=>{ clearTimeout(closeTimer); });
  backdrop?.addEventListener('click', close);
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') close(); });

  // Card click → open detail (unless cmd/ctrl to open link)
  panel.addEventListener('click', (e)=>{
    const closeBtn = e.target.closest('[data-mm2="close"]'); if (closeBtn) { e.preventDefault(); close(); return; }
    const back = e.target.closest('[data-mm2="back"]'); if (back) { e.preventDefault(); showTop(); return; }
    const card = e.target.closest('[data-mm2="card"]');
    if (card && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const n = data.find(d => d.path === card.dataset.path);
      if (n) showDetail(n);
    }
    const nav = e.target.closest('[data-mm2="nav"]');
    if (nav) { saveRecent(nav.dataset.path, nav.dataset.label); }
  });

  // Swipe-down gesture for mobile (bottom sheet close)
  if (!isDesktop()) {
    let startY = 0, currentY = 0, isDragging = false, startTime = 0;
    const SWIPE_THRESHOLD = 80;
    const VELOCITY_THRESHOLD = 0.3;

    panel.addEventListener('touchstart', (e) => {
      if (!document.body.classList.contains('mm2-open')) return;
      const touch = e.touches[0];
      const scrollableContent = e.target.closest('.mm2-top, .mm2-detail');
      
      // Prevent drag if content is scrolled
      if (scrollableContent && scrollableContent.scrollTop > 5) return;
      
      // Only start drag from top area or handle
      const rect = panel.getBoundingClientRect();
      if (touch.clientY - rect.top > 60) return;
      
      startY = touch.clientY;
      currentY = startY;
      startTime = Date.now();
      isDragging = true;
    }, { passive: true });

    panel.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      currentY = touch.clientY;
      const deltaY = currentY - startY;
      
      // Only allow downward swipe
      if (deltaY > 0) {
        const opacity = Math.max(0.4, 1 - (deltaY / 300));
        panel.style.transform = `translateX(0) translateY(${deltaY}px)`;
        panel.style.opacity = opacity;
      }
    }, { passive: true });

    const endDrag = () => {
      if (!isDragging) return;
      const deltaY = currentY - startY;
      const deltaTime = Date.now() - startTime;
      const velocity = deltaY / deltaTime;
      
      // Close if swiped down enough or fast swipe
      if (deltaY > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        close();
      }
      
      // Reset position
      panel.style.transform = '';
      panel.style.opacity = '';
      isDragging = false;
    };

    panel.addEventListener('touchend', endDrag, { passive: true });
    panel.addEventListener('touchcancel', endDrag, { passive: true });
  }

  // Fetch data with loading state
  if (!isLoading) {
    isLoading = true;
    showLoading();
    
    fetch(apiUrl, { headers: { 'Accept': 'application/json' }})
      .then(r => {
        if (!r.ok) throw new Error('Network response was not ok');
        return r.json();
      })
      .then(j => { 
        data = Array.isArray(j.data) ? j.data : []; 
        if (!data.length) {
          topView.innerHTML = `<div class="mm2-top"><div style="text-align:center;padding:40px;color:var(--mm2-fg-muted);">
            <p>Tidak ada kategori tersedia</p>
          </div></div>`;
          return;
        }
        buildTop();
        isLoading = false;
      })
      .catch(err => {
        console.error('Failed to load categories:', err);
        topView.innerHTML = `<div class="mm2-top"><div style="text-align:center;padding:40px;color:var(--mm2-fg-muted);">
          <p>Gagal memuat kategori. Silakan coba lagi.</p>
        </div></div>`;
        isLoading = false;
      });
  }
})();

// Add skeleton animation styles
const style = document.createElement('style');
style.textContent = `
.mm2-skeleton {
  pointer-events: none;
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.skeleton-box, .skeleton-line {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
document.head.appendChild(style);