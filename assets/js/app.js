(function initLiveSearch(){
  function setup() {
    const searchInput = document.getElementById('searchInput');
    const suggest = document.getElementById('searchSuggest');
    const searchBtn = document.getElementById('searchBtn');
    const aiToggleBtn = document.getElementById('aiToggleBtn');
    
    if (!searchInput || !suggest || !aiToggleBtn) {
      console.log('[LiveSearch] Elemen belum ada, retry...');
      return false;
    }

    let debounceTimer = null;
    let lastQuery = '';
    let currentIndex = -1;
    let currentAbortController = null;
    let isAIModeEnabled = false; // AI mode OFF by default
    let isAIProcessing = false; // Flag to prevent closing suggest box during AI processing
    
    // Trending cache
    let trendingCache = null;
    let trendingLoading = false;
    
    // Trending products cache
    let trendingProductsCache = null;
    let trendingProductsLoading = false;
    
    const MIN_LEN = 2;
    const DEBOUNCE = 300;
    const AI_TIMEOUT = 15000; // 15 seconds timeout for AI endpoint

    // Load AI mode preference from localStorage
    const savedAIMode = localStorage.getItem('plazait_ai_search_mode');
    if (savedAIMode === 'enabled') {
      isAIModeEnabled = false;
      aiToggleBtn.classList.remove('active');
    }
    
    // Update placeholder based on AI mode
    function updatePlaceholder() {
      if (isAIModeEnabled) {
        searchInput.placeholder = '🤖 Coba: "laptop HP core i3 untuk kerja" atau "tinta epson l3210"';
      } else {
        // Static placeholder for typing animation
        searchInput.placeholder = '';
      }
    }
    
    // Typing animation for placeholder
    let typingTimeout = null;
    let currentProductIndex = 0;
    let currentCharIndex = 0;
    let isTyping = false;
    let isDeleting = false;
    
    const popularProducts = [
      'Oppo A6',
      'Asus Ryzen 3',
      'Starlink V4',
      'HP Victus',
      'Lenovo RTX 5060',
      'ROG Strix',
      'iPhone 13',
      'Xpad 20',
      'Xiaomi 14',
      'Epson L3210',
      'Realme C85',
      'Brother T720',
      'Mouse Logitech'
    ];
    
    function typeWriter() {
      if (isAIModeEnabled || document.activeElement === searchInput) {
        return; // Skip typing if AI mode is on or input is focused
      }
      
      const currentProduct = popularProducts[currentProductIndex];
      
      if (!isDeleting) {
        // Typing forward
        if (currentCharIndex < currentProduct.length) {
          searchInput.placeholder = currentProduct.substring(0, currentCharIndex + 1);
          currentCharIndex++;
          typingTimeout = setTimeout(typeWriter, 100); // Typing speed
        } else {
          // Finished typing, wait before deleting
          typingTimeout = setTimeout(() => {
            isDeleting = true;
            typeWriter();
          }, 2000); // Pause before deleting
        }
      } else {
        // Deleting backward
        if (currentCharIndex > 0) {
          searchInput.placeholder = currentProduct.substring(0, currentCharIndex - 1);
          currentCharIndex--;
          typingTimeout = setTimeout(typeWriter, 50); // Deleting speed (faster)
        } else {
          // Finished deleting, move to next product
          isDeleting = false;
          currentProductIndex = (currentProductIndex + 1) % popularProducts.length;
          typingTimeout = setTimeout(typeWriter, 500); // Pause before typing next
        }
      }
    }
    
    function startTypingAnimation() {
      if (!isAIModeEnabled && !typingTimeout) {
        currentCharIndex = 0;
        isDeleting = false;
        typeWriter();
      }
    }
    
    function stopTypingAnimation() {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
      }
    }
    
    // Set initial placeholder
    updatePlaceholder();
    
    // Start typing animation for normal mode
    if (!isAIModeEnabled) {
      startTypingAnimation();
    }

    function esc(str){
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
    }

    function clearSuggest(){
      suggest.innerHTML = '';
      suggest.hidden = true;
      suggest.classList.remove('open', 'trending-mode');
      currentIndex = -1;
    }

    // ==================== TRENDING FUNCTIONS ====================
    
    async function fetchTrending() {
      if (trendingCache) return trendingCache;
      if (trendingLoading) return null;
      
      trendingLoading = true;
      
      try {
        const res = await fetch('/api/trending_searches.php?timeframe=7d&limit=8');
        const data = await res.json();
        
        if (data.ok && Array.isArray(data.data)) {
          trendingCache = data.data;
          console.log('[Trending] Loaded', trendingCache.length, 'items');
          return trendingCache;
        }
      } catch (err) {
        console.error('[Trending] Fetch error:', err);
      } finally {
        trendingLoading = false;
      }
      
      return null;
    }
    
    async function fetchTrendingProducts() {
      if (trendingProductsCache) return trendingProductsCache;
      if (trendingProductsLoading) return null;
      
      trendingProductsLoading = true;
      
      try {
        const res = await fetch('/api/trending_products.php?timeframe=7d&limit=6');
        const data = await res.json();
        
        if (data.ok && Array.isArray(data.data)) {
          trendingProductsCache = data.data;
          console.log('[Trending Products] Loaded', trendingProductsCache.length, 'items');
          return trendingProductsCache;
        }
      } catch (err) {
        console.error('[Trending Products] Fetch error:', err);
      } finally {
        trendingProductsLoading = false;
      }
      
      return null;
    }
    
    function renderTrendingSuggestions(trends, products) {
      if ((!trends || trends.length === 0) && (!products || products.length === 0)) {
        clearSuggest();
        return;
      }
      
      let html = `<div class="trending-container">`;
      
      // Left column: Trending searches
      if (trends && trends.length > 0) {
        html += `
          <div class="trending-column trending-searches">
            <div class="trending-header">
              <span class="trending-icon">🔥</span>
              <span class="trending-title">Pencarian Trending</span>
            </div>
        `;
        
        html += trends.map((t, idx) => {
          const categoryHint = t.category_hint ? `<span class="trending-category">${esc(t.category_hint)}</span>` : '';
          return `
            <div class="trending-item" data-query="${esc(t.query)}" data-index="${idx}">
              <span class="trending-rank">
                <img src="/assets/img/uptrend.image" alt="trending" width="16" height="16" style="vertical-align: middle;">
              </span>
              <span class="trending-query">${esc(t.query)}</span>
              ${categoryHint}
            </div>
          `;
        }).join('');
        
        html += `</div>`;
      }
      
      // Right column: Trending products
      if (products && products.length > 0) {
        html += `
          <div class="trending-column trending-products">
            <div class="trending-header">
              <span class="trending-icon">⭐</span>
              <span class="trending-title">Produk Populer</span>
            </div>
        `;
        
        html += products.map((p, idx) => {
          return `
            <div class="trending-product-item" data-product-id="${esc(p.id)}" data-slug="${esc(p.slug)}" data-query="${esc(p.top_query || '')}" data-index="${idx}">
              <img src="${esc(p.image)}" alt="${esc(p.name)}" class="trending-product-thumb">
              <div class="trending-product-info">
                <div class="trending-product-name">${esc(p.name)}</div>
                <div class="trending-product-price">${esc(p.price_label)}</div>
              </div>
            </div>
          `;
        }).join('');
        
        html += `</div>`;
      }
      
      html += `</div>`;
      
      suggest.innerHTML = html;
      suggest.hidden = false;
      suggest.classList.add('open', 'trending-mode');
      suggest.style.display = 'block';
      
      console.log('[Trending] Rendered', trends?.length || 0, 'searches and', products?.length || 0, 'products');
    }
    
    function trackSearchClick(query, productId) {
      fetch('/api/track_search_click.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          product_id: productId,
          click_type: 'suggestion'
        })
      }).catch(() => {}); // silent fail
    }
    
    function trackTrendingClick(query) {
      fetch('/api/track_search_click.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          click_type: 'trending'
        })
      }).catch(() => {});
    }
    
    function trackTrendingProductClick(productId, query) {
      fetch('/api/track_search_click.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query || 'trending_product',
          product_id: productId,
          click_type: 'trending_product'
        })
      }).catch(() => {});
    }
    
    function trackSearchSubmit(query) {
      fetch('/api/track_search_click.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          click_type: 'submit'
        })
      }).catch(() => {});
    }
    
    function logFinalSearch(query) {
      // Log the final search to analytics (not during typing)
      fetch('/api/search_products.php?q=' + encodeURIComponent(query) + '&log=1', {
        headers: { 'Accept': 'application/json' }
      }).catch(() => {});
    }

    // ==================== END TRENDING FUNCTIONS ====================

    function clearSuggest(){
      suggest.innerHTML = '';
      suggest.hidden = true;
      suggest.classList.remove('open', 'trending-mode');
      currentIndex = -1;
    }

    // AI Toggle Handler
    aiToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      isAIModeEnabled = !isAIModeEnabled;
      
      if (isAIModeEnabled) {
        aiToggleBtn.classList.add('active');
        localStorage.setItem('plazait_ai_search_mode', 'enabled');
        updatePlaceholder(); // Update placeholder text
        stopTypingAnimation(); // Stop typing animation in AI mode
        
        // Show AI prompt if there's a query
        const query = searchInput.value.trim();
        if (query.length >= MIN_LEN) {
          showAISearchPrompt(query);
        } else {
          showAIActivationMessage();
        }
      } else {
        aiToggleBtn.classList.remove('active');
        localStorage.setItem('plazait_ai_search_mode', 'disabled');
        updatePlaceholder(); // Update placeholder text
        startTypingAnimation(); // Start typing animation in normal mode
        clearSuggest();
        
        // Switch to normal search if there's a query
        const query = searchInput.value.trim();
        if (query.length >= MIN_LEN) {
          performSearch(query);
        }
      }
    });

    function showAIActivationMessage() {
      suggest.innerHTML = `
        <div class="ai-progress-container">
          <div class="ai-progress-header">
            <div class="ai-progress-icon">✨</div>
            <div class="ai-progress-text">
              <div class="ai-progress-title">AI Search Mode Activated!</div>
              <div class="ai-progress-subtitle">Ketik query Anda untuk pencarian cerdas</div>
            </div>
          </div>
        </div>
      `;
      suggest.hidden = false;
      suggest.classList.add('open');
      suggest.style.display = 'block';
    }

    function renderAIInsights(insights){
      if (!insights) return '';
      
      // Generate AI summary via backend endpoint
      const summary = insights.ai_summary || generateAISummary(insights);
      
      if (!summary) return '';
      
      return `
        <div class="ai-result-banner">
          <div class="ai-result-icon">✨</div>
          <div class="ai-result-text">
            <div class="ai-result-title">AI Assistant</div>
            <div class="ai-result-description">${summary}</div>
          </div>
        </div>
      `;
    }
    
    function generateAISummary(insights) {
      // Fallback client-side summary generation if backend doesn't provide ai_summary
      const productName = insights.product_name || '';
      const categoryPath = insights.category_path || '';
      const priceRange = insights.price_range || {};
      const intent = insights.intent || '';
      
      let summary = '';
      
      // Parse category for natural display
      let categoryDisplay = '';
      if (categoryPath) {
        const categoryParts = categoryPath.split('/');
        categoryDisplay = categoryParts[categoryParts.length - 1] || categoryParts[categoryParts.length - 2] || categoryPath;
      }
      
      // Intent-based opening
      if (intent === 'cek_stok') {
        summary = `Berikut ketersediaan stok untuk <strong>${esc(productName)}</strong>. `;
      } else if (intent === 'rekomendasi_produk') {
        summary = `Berikut rekomendasi produk <strong>${esc(categoryDisplay || productName)}</strong> yang kami pilihkan untuk Anda. `;
      } else {
        // Default: cari_harga or general
        if (productName && categoryDisplay) {
          summary = `Kami menemukan <strong>${esc(productName)}</strong> di kategori ${esc(categoryDisplay)}`;
        } else if (productName) {
          summary = `Kami menemukan produk <strong>${esc(productName)}</strong>`;
        } else if (categoryDisplay) {
          summary = `Kami menemukan produk ${esc(categoryDisplay)}`;
        }
        
        // Add price context
        if (priceRange.min > 0 && priceRange.max > 0) {
          const minPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(priceRange.min);
          const maxPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(priceRange.max);
          summary += ` dengan kisaran harga ${minPrice} - ${maxPrice}`;
        } else if (priceRange.min > 0) {
          const minPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(priceRange.min);
          summary += ` dengan harga mulai ${minPrice}`;
        } else if (priceRange.max > 0) {
          const maxPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(priceRange.max);
          summary += ` dengan harga maksimal ${maxPrice}`;
        }
        
        summary += ' yang sesuai dengan kebutuhan Anda.';
      }
      
      return summary || esc(insights.explanation || '');
    }

    function showAIProgressSteps() {
      return `
        <div class="ai-progress-container">
          <div class="ai-progress-header">
            <div class="ai-progress-icon">🤖</div>
            <div class="ai-progress-text">
              <div class="ai-progress-title">AI sedang menganalisis...</div>
              <div class="ai-progress-subtitle">Memproses query Anda dengan kecerdasan buatan</div>
            </div>
          </div>
          <div class="ai-progress-steps">
            <div class="ai-progress-step active">
              <div class="ai-step-icon">1</div>
              <div class="ai-step-text">Memahami maksud pencarian...</div>
            </div>
            <div class="ai-progress-step pending">
              <div class="ai-step-icon">2</div>
              <div class="ai-step-text">Mengekstrak parameter pencarian...</div>
            </div>
            <div class="ai-progress-step pending">
              <div class="ai-step-icon">3</div>
              <div class="ai-step-text">Mencari produk yang relevan...</div>
            </div>
          </div>
        </div>
      `;
    }

    function updateAIProgressStep(step) {
      const steps = suggest.querySelectorAll('.ai-progress-step');
      
      steps.forEach((stepEl, idx) => {
        const icon = stepEl.querySelector('.ai-step-icon');
        
        if (idx < step) {
          stepEl.classList.remove('active', 'pending');
          stepEl.classList.add('completed');
          icon.textContent = '✓';
        } else if (idx === step) {
          stepEl.classList.remove('pending', 'completed');
          stepEl.classList.add('active');
        }
      });
    }

    function renderSuggest(items, aiInsights){
      if (!items.length){
        clearSuggest();
        return;
      }
      
      let html = '';
      
      // Show AI insights if available
      if (aiInsights && aiInsights.explanation) {
        html += renderAIInsights(aiInsights);
      }
      
      // Section header for products with hint
      html += `
        <div class="suggest-section-header">
          <div class="suggest-header-main">
            <span class="suggest-header-icon">📦</span>
            <span class="suggest-header-text">Produk yang ditemukan (${items.length})</span>
          </div>
          <div class="suggest-header-hint">Tekan <kbd>Enter</kbd> untuk lihat semua hasil</div>
        </div>
      `;
      
      // Render product items
      html += items.map((it, idx)=>{
        // Normalisasi & fallback
        const id    = it.id != null ? it.id : '';
        const name  = esc(it.name);
        const slug  = esc(it.slug != null ? it.slug : it.id);
        const img   = esc(it.image || '/assets/img/no-image.png');
        const price = esc(it.price_label || '');

       const url = '/product/' + encodeURIComponent(slug);

        return `
          <div class="suggest-item" data-index="${idx}" data-url="${url}" data-id="${esc(id)}">
            <img src="${img}" alt="${name}" class="suggest-thumb">
            <div class="suggest-meta">
              <div class="suggest-name">${name}</div>
              <div class="suggest-price">${price}</div>
            </div>
          </div>
        `;
      }).join('');
      
      // Footer hint for more results - only show if 10 items (means there might be more)
      if (items.length >= 10) {
        html += `
          <div class="suggest-footer-hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: -3px; margin-right: 6px;">
              <path d="M9.29 6.71a.996.996 0 0 0 0 1.41L13.17 12l-3.88 3.88a.996.996 0 1 0 1.41 1.41l4.59-4.59a.996.996 0 0 0 0-1.41L10.7 6.7c-.38-.39-1.02-.39-1.41.01z"/>
            </svg>
            <span>Lihat hasil lengkap dengan menekan <kbd>Enter</kbd> atau <a href="#" class="suggest-footer-link" id="footerSearchLink">klik di sini</a></span>
          </div>
        `;
      }
      
      suggest.innerHTML = html;
      suggest.hidden = false;
      suggest.classList.add('open');
      suggest.style.display = 'block';
      suggest.style.visibility = 'visible';
      suggest.style.opacity = '1';
    }

    function fetchRemote(q, shouldLog = false){
      // Cancel previous request if any
      if (currentAbortController) {
        currentAbortController.abort();
      }
      currentAbortController = new AbortController();

      // Always use standard search for normal mode
      // Only add log=1 parameter when shouldLog is true (intentional search)
      const logParam = shouldLog ? '&log=1' : '';
      const url = '/api/search_products.php?q=' + encodeURIComponent(q) + logParam;
      const fetchOptions = {
        headers: {'Accept':'application/json'},
        signal: currentAbortController.signal
      };

      return fetch(url, fetchOptions)
        .then(r=>r.json())
        .then(j=>{
          if (j.ok && Array.isArray(j.data)) {
            return j;
          }
          return { ok: false, data: [] };
        })
        .catch(err=>{
          if (err.name === 'AbortError') {
            return { ok: false, data: [] };
          }
          return { ok:false, data:[] };
        });
    }

    function showNoResults(q, aiInsights) {
      suggest.innerHTML = `
        <div style="padding: 32px 24px; text-align: center; color: #64748b;">
          <div style="font-size: 56px; margin-bottom: 16px; opacity: 0.6;">🔍</div>
          <div style="font-size: 16px; font-weight: 600; color: #334155; margin-bottom: 8px;">
            Tidak ada hasil untuk "${esc(q)}"
          </div>
          ${aiInsights && aiInsights.explanation ? `
            <div style="font-size: 13px; margin: 16px auto; padding: 12px 16px; background: #f1f5f9; border-radius: 8px; max-width: 400px; color: #475569;">
              <strong style="color: #667eea;">🤖 AI memahami:</strong><br>
              ${esc(aiInsights.explanation)}
            </div>
          ` : ''}
          <div style="font-size: 13px; margin-top: 16px; opacity: 0.8;">
            Coba kata kunci lain atau hubungi kami untuk bantuan
          </div>
        </div>
      `;
      suggest.hidden = false;
      suggest.classList.add('open');
      suggest.style.display = 'block';
    }

    function showErrorMessage() {
      suggest.innerHTML = `
        <div style="padding: 32px 24px; text-align: center; color: #dc2626;">
          <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
          <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">
            Pencarian tidak tersedia
          </div>
          <div style="font-size: 12px; opacity: 0.8;">
            Silakan coba lagi dalam beberapa saat
          </div>
        </div>
      `;
      suggest.hidden = false;
      suggest.classList.add('open');
      suggest.style.display = 'block';
    }

    function showAIErrorState(q) {
      suggest.innerHTML = `
        <div class="ai-progress-container">
          <div class="ai-progress-header">
            <div class="ai-progress-icon" style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);">⚡</div>
            <div class="ai-progress-text">
              <div class="ai-progress-title">AI sedang memproses...</div>
              <div class="ai-progress-subtitle">Menganalisis query: "${esc(q)}"</div>
            </div>
          </div>
          <div style="padding: 16px; margin-top: 12px; background: #fef3c7; border-radius: 8px; border-left: 3px solid #f59e0b;">
            <div style="font-size: 13px; color: #92400e; line-height: 1.6;">
              <strong style="display: block; margin-bottom: 4px;">💡 Sedang mencari produk terbaik untuk Anda</strong>
              AI kami sedang menganalisis database untuk menemukan hasil yang paling relevan.
              Mohon tunggu sebentar...
            </div>
          </div>
          <div style="padding: 12px 16px; margin-top: 12px; text-align: center;">
            <button onclick="location.reload()" style="padding: 8px 16px; background: #fb923c; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">
              🔄 Refresh & Coba Lagi
            </button>
          </div>
        </div>
      `;
      suggest.hidden = false;
      suggest.classList.add('open');
      suggest.style.display = 'block';
    }

    function triggerAISearch(q) {
      lastQuery = q; // Update lastQuery to prevent re-triggering
      isAIProcessing = true; // Set flag to prevent suggest box from closing
      
      // Show AI progress UI - keep suggest box visible
      suggest.innerHTML = showAIProgressSteps();
      suggest.hidden = false;
      suggest.classList.add('open');
      suggest.style.display = 'block';
      
      setTimeout(() => updateAIProgressStep(1), 1000);
      setTimeout(() => updateAIProgressStep(2), 2500);

      // Cancel previous request if any
      if (currentAbortController) {
        currentAbortController.abort();
      }
      currentAbortController = new AbortController();

      const url = '/api/search_ai.php?q=' + encodeURIComponent(q);
      const fetchOptions = {
        headers: {'Accept':'application/json'},
        signal: currentAbortController.signal
      };
      
      // Add timeout
      const timeoutId = setTimeout(() => {
        currentAbortController.abort();
        
        // Show fallback loading state
        suggest.innerHTML = `
          <div class="ai-progress-container">
            <div class="ai-progress-header">
              <div class="ai-progress-icon">⏳</div>
              <div class="ai-progress-text">
                <div class="ai-progress-title">AI timeout - switching to standard search</div>
                <div class="ai-progress-subtitle">Mencari dengan metode tradisional...</div>
              </div>
            </div>
          </div>
        `;
        
        // Fallback to traditional search
        fetch('/api/search_products.php?q=' + encodeURIComponent(q), {
          headers: { 'Accept': 'application/json' }
        })
          .then(r => r.json())
          .then(j => {
            isAIProcessing = false; // Reset flag
            if (j.ok && Array.isArray(j.data) && j.data.length) {
              renderSuggest(j.data, null);
            } else {
              showNoResults(q, null);
            }
          })
          .catch(() => {
            isAIProcessing = false; // Reset flag
            showAIErrorState(q);
          });
      }, AI_TIMEOUT);

      fetch(url, fetchOptions)
        .then(r => r.json())
        .then(j => {
          clearTimeout(timeoutId);
          isAIProcessing = false; // Reset flag when done
          
          if (j.ok && Array.isArray(j.data)) {
            if (j.data.length > 0) {
              renderSuggest(j.data, j.ai_insights || null);
            } else {
              showNoResults(q, j.ai_insights || null);
            }
          } else {
            showAIErrorState(q);
          }
        })
        .catch(err => {
          clearTimeout(timeoutId);
          isAIProcessing = false; // Reset flag on error
          if (err.name !== 'AbortError') {
            showAIErrorState(q);
          }
        });
    }

    function performSearch(q){
      if (q.length < MIN_LEN){
        clearSuggest();
        return;
      }
      if (q === lastQuery) return;
      lastQuery = q;
      
      // Normal mode only - AI mode uses triggerAISearch()
      fetchRemote(q).then(j=>{
        if (j.ok && Array.isArray(j.data)){
          if (j.data.length > 0) {
            renderSuggest(j.data, null);
          } else {
            showNoResults(q, null);
          }
        } else {
          clearSuggest();
        }
      }).catch(() => {
        clearSuggest();
      });
    }

    function debounce(){
      const q = searchInput.value.trim();
      clearTimeout(debounceTimer);
      
      // If empty, show trending suggestions and products
      if (q.length === 0) {
        debounceTimer = setTimeout(async () => {
          const trends = trendingCache || await fetchTrending();
          const products = trendingProductsCache || await fetchTrendingProducts();
          if ((trends && trends.length > 0) || (products && products.length > 0)) {
            renderTrendingSuggestions(trends, products);
          } else {
            clearSuggest();
          }
        }, 100);
        return;
      }
      
      // For AI mode, just show search prompt (no auto search)
      if (isAIModeEnabled && q.length >= MIN_LEN) {
        showAISearchPrompt(q);
      } else if (!isAIModeEnabled && q.length >= MIN_LEN) {
        // Normal mode: auto search with debounce
        debounceTimer = setTimeout(()=> performSearch(q), DEBOUNCE);
      } else {
        clearSuggest();
      }
    }

    function showAISearchPrompt(q) {
      suggest.innerHTML = `
        <div class="ai-search-prompt">
          <div class="ai-prompt-header">
            <div class="ai-prompt-icon">🤖</div>
            <div class="ai-prompt-text">
              <div class="ai-prompt-title">Pencarian AI Siap!</div>
              <div class="ai-prompt-subtitle">Klik tombol di bawah untuk mencari dengan AI</div>
            </div>
          </div>
          <div class="ai-prompt-query">
            <div class="ai-query-label">Query Anda:</div>
            <div class="ai-query-text">"${esc(q)}"</div>
          </div>
          <button class="ai-search-trigger-btn" data-query="${esc(q)}">
            <span class="ai-btn-icon">✨</span>
            <span class="ai-btn-text">Cari dengan AI</span>
          </button>
          <div class="ai-prompt-footer">
            AI akan menganalisis query Anda untuk hasil yang lebih relevan
          </div>
        </div>
      `;
      suggest.hidden = false;
      suggest.classList.add('open');
      suggest.style.display = 'block';
    }

    function moveHighlight(dir){
      if (suggest.hidden) return;
      const items = suggest.querySelectorAll('.suggest-item');
      if (!items.length) return;
      currentIndex += dir;
      if (currentIndex < 0) currentIndex = items.length - 1;
      if (currentIndex >= items.length) currentIndex = 0;
      items.forEach(it=> it.classList.remove('active'));
      const active = items[currentIndex];
      if (active){
        active.classList.add('active');
        active.scrollIntoView({block:'nearest'});
      }
    }

    function activate(){
      const active = suggest.querySelector('.suggest-item.active');
      if (!active) return;
      window.location.href = active.getAttribute('data-url');
    }

    searchInput.addEventListener('input', debounce);
    
    // Stop typing animation when focused & load trending if empty
    searchInput.addEventListener('focus', async () => {
      stopTypingAnimation();
      
      const q = searchInput.value.trim();
      
      // If empty, show trending suggestions and products
      if (q.length === 0) {
        const trends = trendingCache || await fetchTrending();
        const products = trendingProductsCache || await fetchTrendingProducts();
        if ((trends && trends.length > 0) || (products && products.length > 0)) {
          renderTrendingSuggestions(trends, products);
        }
        return;
      }
      
      // If AI mode and has query, show AI prompt
      if (isAIModeEnabled && q.length >= MIN_LEN && suggest.hidden) {
        showAISearchPrompt(q);
      }
    });
    
    // Resume typing animation when blurred (if suggest is closed)
    searchInput.addEventListener('blur', () => {
      // Add delay to allow click events to fire first
      setTimeout(() => {
        if (!isAIModeEnabled && suggest.hidden && searchInput.value.trim() === '') {
          startTypingAnimation();
        }
      }, 200);
    });
    
    searchInput.addEventListener('keydown', e=>{
      switch(e.key){
        case 'ArrowDown': moveHighlight(1); e.preventDefault(); break;
        case 'ArrowUp': moveHighlight(-1); e.preventDefault(); break;
        case 'Enter':
          if (!suggest.hidden){
            activate();
            e.preventDefault();
          } else {
            // Direct enter without suggestion - track search submit and log final search
            const q = searchInput.value.trim();
            if (q.length >= MIN_LEN) {
              trackSearchSubmit(q);
              logFinalSearch(q);
            }
          }
          break;
        case 'Escape': clearSuggest(); break;
      }
    });

    suggest.addEventListener('click', e=>{
      // Check if footer link clicked
      const footerLink = e.target.closest('#footerSearchLink');
      if (footerLink) {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (q.length >= MIN_LEN) {
          trackSearchSubmit(q);
          logFinalSearch(q);
          window.location.href = '/product/search/?q=' + encodeURIComponent(q);
        }
        return;
      }
      
      // Check if AI search button clicked
      const aiBtn = e.target.closest('.ai-search-trigger-btn');
      if (aiBtn) {
        const query = aiBtn.getAttribute('data-query');
        if (query) {
          triggerAISearch(query);
        }
        return;
      }
      
      // Handle trending item click
      const trendingItem = e.target.closest('.trending-item');
      if (trendingItem) {
        const query = trendingItem.getAttribute('data-query');
        if (query) {
          searchInput.value = query;
          trackTrendingClick(query);
          logFinalSearch(query); // Log final search when user clicks trending
          performSearch(query);
        }
        return;
      }
      
      // Handle trending product click
      const trendingProduct = e.target.closest('.trending-product-item');
      if (trendingProduct) {
        const productId = trendingProduct.getAttribute('data-product-id');
        const slug = trendingProduct.getAttribute('data-slug');
        const query = trendingProduct.getAttribute('data-query');
        
        if (productId && slug) {
          trackTrendingProductClick(productId, query);
          window.location.href = '/product/' + encodeURIComponent(slug);
        }
        return;
      }
      
      // Handle product item click
      const it = e.target.closest('.suggest-item');
      if (!it) return;
      
      const productId = it.getAttribute('data-id');
      trackSearchClick(lastQuery, productId);
      logFinalSearch(lastQuery); // Log final search when user clicks on suggestion
      
      window.location.href = it.getAttribute('data-url');
    });

    document.addEventListener('click', e=>{
      // Don't close suggest box if AI is processing
      if (isAIProcessing) return;
      
      if (e.target === searchInput || e.target === aiToggleBtn || 
          suggest.contains(e.target) || aiToggleBtn.contains(e.target)) return;
      clearSuggest();
    });

    if (searchBtn){
      searchBtn.addEventListener('click', ()=>{
        const q = searchInput.value.trim();
        if (q.length >= MIN_LEN){
          // Track search submit and log final search
          trackSearchSubmit(q);
          logFinalSearch(q);
          window.location.href = '/product/search/?q=' + encodeURIComponent(q);
        }
      });
    }

    // Pastikan style dasar muncul
    if (!suggest.classList.contains('wired')) {
      suggest.classList.add('wired');
      suggest.style.position = 'absolute';
      suggest.style.zIndex = '9999';
      suggest.style.background = '#fff';
      suggest.style.border = '1px solid #ccc';
      suggest.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
      suggest.style.maxHeight = '360px';
      suggest.style.overflowY = 'auto';
    }

    return true;
  }

  if (!setup()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup);
    } else {
      setTimeout(setup, 80);
    }
  }
})();