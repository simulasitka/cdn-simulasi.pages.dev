(function() {
  'use strict';
  
  // State management
  let compareList = [];
  let isAnalyzing = false;
  let currentAnalysis = null;
  
  // DOM elements
  const compareBtn = document.getElementById('compareBtn');
  const compareSidebar = document.getElementById('compareSidebar');
  const compareOverlay = document.getElementById('compareOverlay');
  const compareClose = document.getElementById('compareClose');
  const compareModal = document.getElementById('aiCompareModal');
  const compareModalClose = document.getElementById('aiCompareModalClose');
  
  // Initialize
  document.addEventListener('DOMContentLoaded', async function() {
    await initializeCompare();
    setupEventListeners();
  });
  
  /**
   * Initialize compare functionality
   */
  async function initializeCompare() {
    // Load compare list first before setting up buttons
    await loadCompareList();
    
    // Setup product detail compare button if exists
    const productCompareBtn = document.getElementById('pd-compare-btn');
    
    if (productCompareBtn) {
      setupProductCompareButton(productCompareBtn);
    }
    
    // Check for existing compare list and update UI
    if (compareList.length > 0) {
      // Only update badge and buttons, no sticky bar
    }
  }
  
  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Navigation compare button
    if (compareBtn) {
      compareBtn.addEventListener('click', toggleCompareSidebar);
    }
    
    // Sidebar controls
    if (compareClose) {
      compareClose.addEventListener('click', closeCompareSidebar);
    }
    
    if (compareOverlay) {
      compareOverlay.addEventListener('click', closeCompareSidebar);
    }
    
    // Sidebar actions
    const clearAllBtn = document.getElementById('compareClearAll');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', clearAllProducts);
    }
    
    const analyzeBtn = document.getElementById('compareAnalyze');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', startAIAnalysis);
    }
    
    // Modal controls
    if (compareModalClose) {
      compareModalClose.addEventListener('click', closeModal);
    }
    
    const modalBackdrop = compareModal?.querySelector('.modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', closeModal);
    }
    
    // Modal actions
    const retryBtn = document.getElementById('aiRetry');
    if (retryBtn) {
      retryBtn.addEventListener('click', startAIAnalysis);
    }
    
    // Removed share and add to cart buttons - replaced with AI disclaimer
  }
  
  /**
   * Setup product detail compare button
   */
  function setupProductCompareButton(button) {
    const productId = parseInt(button.dataset.productId);
    if (!productId) return;
    
    // Check if product is already in compare list
    updateProductCompareButtonState(button, productId);
    
    button.addEventListener('click', async function() {
      // Get current variant ID (if any)
      const variantIdElement = document.getElementById('pd-variant-id');
      const variantId = variantIdElement ? parseInt(variantIdElement.value) || 0 : 0;
      
      // Update button's variant data for current selection
      button.dataset.variantId = variantId.toString();
      
      await toggleProductInCompare(productId, button, variantId);
    });
  }
  
  /**
   * Toggle product in compare list
   */
  async function toggleProductInCompare(productId, button, variantId = 0) {
    // Check by product ID (variants of same product treated as same item)
    const isInCompare = compareList.some(p => parseInt(p.id) === parseInt(productId));
    
    try {
      if (isInCompare) {
        await removeFromCompare(productId);
        showToast('Produk dihapus dari perbandingan', 'success');
      } else {
        await addToCompare(productId, variantId);
        showToast('Produk ditambahkan ke perbandingan', 'success');
        
        // Trigger fly-to-compare animation
        triggerFlyToCompareAnimation(button);
      }
      
      updateProductCompareButtonState(button, productId);
      updateCompareBadge();
      updateAllCompareButtons();
      
    } catch (error) {
      showToast(error.message || 'Terjadi kesalahan', 'error');
    }
  }
  
  /**
   * Update product compare button state
   */
  function updateProductCompareButtonState(button, productId) {
    // Ensure both IDs are compared as integers
    const isInCompare = compareList.some(p => parseInt(p.id) === parseInt(productId));
    button.classList.toggle('added', isInCompare);
    
    // Handle visibility of text elements
    const compareText = button.querySelector('.compare-text');
    const compareRemove = button.querySelector('.compare-remove');
    const compareNote = document.getElementById('compare-note');
    
    if (compareText) {
      compareText.style.display = isInCompare ? 'none' : 'inline';
    }
    
    if (compareRemove) {
      if (isInCompare) {
        compareRemove.removeAttribute('hidden');
        compareRemove.style.display = 'flex';
      } else {
        compareRemove.setAttribute('hidden', '');
        compareRemove.style.display = 'none';
      }
    }
    
    // Update info note
    if (compareNote) {
      if (isInCompare) {
        const currentCount = compareList.length;
        compareNote.textContent = `Produk sudah ada di daftar perbandingan (${currentCount}/5). Klik tombol untuk menghapus.`;
      } else {
        compareNote.textContent = 'Bandingkan hingga 5 produk dengan bantuan AI';
      }
    }
    
    // Inline compare preview removed - keeping it simple
  }
  
  /**
   * Add product to compare list
   */
  async function addToCompare(productId, variantId = 0) {
    const requestData = { product_id: productId };
    if (variantId > 0) {
      requestData.variant_id = variantId;
    }
    
    const response = await fetch('/api/compare/add.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Gagal menambahkan produk');
    }
    
    // Send Google Analytics event for add to compare
    if (typeof gtag === 'function') {
      gtag('event', 'add_to_compare', {
        event_category: 'Product Compare',
        event_label: 'Product Added to Compare',
        product_id: productId,
        variant_id: variantId || 0,
        custom_map: {
          custom_parameter_1: 'compare_add_product'
        }
      });
    }
    
    await loadCompareList();
    return result;
  }
  
  /**
   * Remove product from compare list
   */
  async function removeFromCompare(productId) {
    const response = await fetch('/api/compare/remove.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ product_id: productId }),
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Gagal menghapus produk');
    }
    
    // Send Google Analytics event for remove from compare
    if (typeof gtag === 'function') {
      gtag('event', 'remove_from_compare', {
        event_category: 'Product Compare',
        event_label: 'Product Removed from Compare',
        product_id: productId,
        custom_map: {
          custom_parameter_1: 'compare_remove_product'
        }
      });
    }
    
    await loadCompareList();
    return result;
  }
  
  /**
   * Clear all products from compare list
   */
  async function clearAllProducts() {
    if (compareList.length === 0) return;
    
    // Show confirmation modal
    const confirmed = await showConfirmModal({
      title: 'Hapus Semua Produk',
      message: 'Apakah Anda yakin ingin menghapus semua produk dari daftar perbandingan?',
      confirmText: 'Hapus Semua',
      cancelText: 'Batal',
      type: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await fetch('/api/compare/clear.php', {
        method: 'POST',
        credentials: 'same-origin'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Gagal menghapus produk');
      }
      
      // Send Google Analytics event for clear all products
      if (typeof gtag === 'function') {
        gtag('event', 'compare_clear_all', {
          event_category: 'Product Compare',
          event_label: 'Clear All Products',
          products_count: compareList.length,
          custom_map: {
            custom_parameter_1: 'compare_clear_action'
          }
        });
      }
      
      await loadCompareList();
      showToast('Semua produk dihapus dari perbandingan', 'success');
      
    } catch (error) {
      showToast(error.message || 'Terjadi kesalahan', 'error');
    }
  }
  
  /**
   * Load compare list from server
   */
  async function loadCompareList() {
    try {
      const response = await fetch('/api/compare/get.php', {
        credentials: 'same-origin'
      });
      
      const result = await response.json();
      
      if (result.success) {
        compareList = result.products || [];
        updateCompareSidebar();
        updateCompareBadge();
        updateAllCompareButtons();
      }
      
    } catch (error) {
      // Silently handle error - compare functionality will work with empty list
    }
  }
  
  /**
   * Update compare sidebar content
   */
  function updateCompareSidebar() {
    const emptyState = document.getElementById('compareEmpty');
    const listContainer = document.getElementById('compareList');
    const actionsContainer = document.getElementById('compareActions');
    const countElement = document.getElementById('compareCountSidebar');
    
    if (!emptyState || !listContainer || !actionsContainer || !countElement) return;
    
    // Update count
    countElement.textContent = `(${compareList.length})`;
    
    if (compareList.length === 0) {
      emptyState.style.display = 'block';
      listContainer.style.display = 'none';
      actionsContainer.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      listContainer.style.display = 'block';
      actionsContainer.style.display = 'flex';
      
      // Render product list
      listContainer.innerHTML = compareList.map(product => {
        // Display variant name if available
        let displayName = product.name;
        if (product.combination_name) {
          displayName += ` (${product.combination_name})`;
        }
        
        // Use variant price if available
        let displayPrice = product.price;
        if (product.variant_price !== undefined && product.variant_price !== null) {
          displayPrice = product.variant_price;
        }
        
        return `
          <div class="compare-item" data-product-id="${product.id}">
            <div class="compare-item-image">
              <img src="${product.image_url}" alt="${escapeHtml(displayName)}" loading="lazy">
            </div>
            <div class="compare-item-info">
              <div class="compare-item-name">${escapeHtml(displayName)}</div>
              <div class="compare-item-price">${formatPrice(displayPrice)}</div>
            </div>
            <button class="compare-item-remove" data-product-id="${product.id}" aria-label="Hapus">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
              </svg>
            </button>
          </div>
        `;
      }).join('');
      
      // Setup event listeners for remove buttons
      setupRemoveButtons();
      
      // Update analyze button state
      const analyzeBtn = document.getElementById('compareAnalyze');
      if (analyzeBtn) {
        analyzeBtn.disabled = compareList.length < 2;
      }
    }
  }
  
  /**
   * Setup remove buttons event listeners
   */
  function setupRemoveButtons() {
    const removeButtons = document.querySelectorAll('.compare-item-remove');
    removeButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        const productId = parseInt(button.dataset.productId);
        if (productId) {
          await removeProduct(productId);
        }
      });
    });
  }

  /**
   * Update all compare buttons on the page
   */
  function updateAllCompareButtons() {
    // Update product detail compare button
    const productBtn = document.getElementById('pd-compare-btn');
    if (productBtn) {
      const productId = parseInt(productBtn.dataset.productId);
      if (productId) {
        updateProductCompareButtonState(productBtn, productId);
      }
    }
    
    // Update any other compare buttons on the page
    const allCompareButtons = document.querySelectorAll('[data-product-id][class*="compare"]');
    allCompareButtons.forEach(button => {
      const productId = parseInt(button.dataset.productId);
      if (productId && button.id !== 'pd-compare-btn') {
        updateProductCompareButtonState(button, productId);
      }
    });
  }

  /**
   * Update compare badge
   */
  function updateCompareBadge() {
    const badge = document.getElementById('compareCount');
    if (!badge) return;
    
    const oldCount = parseInt(badge.textContent) || 0;
    const newCount = compareList.length;
    
    badge.textContent = newCount;
    badge.classList.toggle('active', newCount > 0);
    
    // Animate badge if count increased
    if (newCount > oldCount) {
      animateCompareBadge();
      highlightCompareButton();
    }
    
    // Sticky bar removed - keeping only fly-to-navbar animation
  }
  
  /**
   * Animate compare badge when new product added
   */
  function animateCompareBadge() {
    const badge = document.getElementById('compareCount');
    if (!badge) return;
    
    badge.style.transform = 'scale(1.3)';
    badge.style.transition = 'transform 0.3s ease';
    
    setTimeout(() => {
      badge.style.transform = 'scale(1)';
    }, 300);
  }
  
  /**
   * Highlight compare button temporarily
   */
  function highlightCompareButton() {
    const compareBtn = document.getElementById('compareBtn');
    if (!compareBtn) return;
    
    compareBtn.classList.add('pulse-highlight');
    
    setTimeout(() => {
      compareBtn.classList.remove('pulse-highlight');
    }, 3000);
  }
  
  /**
   * Trigger fly-to-compare animation
   */
  function triggerFlyToCompareAnimation(sourceButton) {
    if (!sourceButton) {
      return;
    }
    
    // Check if mobile view (bottom nav) or desktop (top nav)
    const isMobile = window.innerWidth <= 768;
    
    // Get source position
    const sourceRect = sourceButton.getBoundingClientRect();
    
    // Calculate target position
    let targetTop, targetLeft;
    
    if (isMobile) {
      // Mobile: fly to fixed bottom position (bottom nav area)
      // Use fixed coordinates regardless of bottom nav visibility
      targetTop = window.innerHeight - 80; // Just above bottom nav area
      targetLeft = window.innerWidth / 2 - 30; // Center horizontally
    } else {
      // Desktop: fly to top navbar compare button
      const targetElement = document.getElementById('compareBtn');
      if (!targetElement) {
        return;
      }
      const targetRect = targetElement.getBoundingClientRect();
      targetTop = targetRect.top + 10;
      targetLeft = targetRect.left + 10;
    }
    
    // Get product image for animation - try multiple selectors
    let productImage = document.querySelector('#pd-main-img, .product-gallery img, .pd-image img, .product-image img, .product-main-image img, img[alt*="produk"], img[src*="product"]');
    
    // Create animated element
    const flyingElement = document.createElement('div');
    flyingElement.className = 'flying-product';
    
    if (productImage) {
      flyingElement.innerHTML = `<img src="${productImage.src}" alt="Flying product">`;
      flyingElement.querySelector('img').style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
    } else {
      // Fallback: colored div with icon
      flyingElement.innerHTML = `<div class="flying-fallback">📦</div>`;
      flyingElement.querySelector('.flying-fallback').style.cssText = `
        width: 100%;
        height: 100%;
        background: #3b82f6;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      `;
    }
    
    flyingElement.style.cssText = `
      position: fixed;
      top: ${sourceRect.top}px;
      left: ${sourceRect.left}px;
      width: 60px;
      height: 60px;
      z-index: 9999;
      pointer-events: none;
      opacity: 1;
      transform: scale(1);
    `;
    
    document.body.appendChild(flyingElement);
    
    // Use Web Animations API for more reliable animation
    flyingElement.animate([
      // Keyframe 1: Initial state
      {
        top: `${sourceRect.top}px`,
        left: `${sourceRect.left}px`,
        transform: 'scale(1)',
        opacity: 1
      },
      // Keyframe 2: Final state
      {
        top: `${targetTop}px`,
        left: `${targetLeft}px`,
        transform: 'scale(0.3)',
        opacity: 0
      }
    ], {
      duration: 800,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    });
    
    // Clean up after animation completes
    setTimeout(() => {
      if (flyingElement.parentNode) {
        flyingElement.parentNode.removeChild(flyingElement);
      }
    }, 850);
  }
  
  // Sticky compare bar functions removed - using only fly-to-navbar animation
  
  /**
   * Toggle compare sidebar
   */
  function toggleCompareSidebar() {
    if (!compareSidebar) return;
    
    const isOpen = compareSidebar.classList.contains('open');
    
    if (isOpen) {
      closeCompareSidebar();
    } else {
      openCompareSidebar();
    }
  }
  
  /**
   * Open compare sidebar
   */
  function openCompareSidebar() {
    if (!compareSidebar || !compareOverlay) return;
    
    compareSidebar.classList.add('open');
    compareOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Send Google Analytics event for compare sidebar open
    if (typeof gtag === 'function') {
      gtag('event', 'compare_sidebar_open', {
        event_category: 'Product Compare',
        event_label: 'Compare Sidebar Opened',
        products_count: compareList.length,
        custom_map: {
          custom_parameter_1: 'compare_sidebar_view'
        }
      });
    }
  }
  
  /**
   * Close compare sidebar
   */
  function closeCompareSidebar() {
    if (!compareSidebar || !compareOverlay) return;
    
    compareSidebar.classList.remove('open');
    compareOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  /**
   * Start AI analysis
   */
  async function startAIAnalysis() {
    if (compareList.length < 2) {
      showToast('Minimal 2 produk diperlukan untuk analisis AI', 'warning');
      return;
    }
    
    if (isAnalyzing) return;
    
    // Send Google Analytics event for AI Analysis start
    if (typeof gtag === 'function') {
      gtag('event', 'ai_analysis_start', {
        event_category: 'Product Compare',
        event_label: 'AI Analysis Button Click',
        products_count: compareList.length,
        product_ids: compareList.map(p => p.id).join(','),
        custom_map: {
          custom_parameter_1: 'compare_ai_analysis'
        }
      });
    }
    
    // Check if products are in similar categories
    const mismatchInfo = await checkProductCategoryMismatch();
    if (mismatchInfo.shouldWarn) {
      const categoryList = Array.from(mismatchInfo.categories).join(', ');
      const confirmed = await showConfirmModal({
        title: 'Produk Berbeda Kategori',
        message: `Produk yang Anda pilih berasal dari kategori yang berbeda: ${categoryList}. AI tetap bisa menganalisis, tapi perbandingan mungkin kurang relevan. Lanjutkan analisis?`,
        confirmText: 'Ya, Analisis Tetap',
        cancelText: 'Batal',
        type: 'warning'
      });
      
      if (!confirmed) return;
    }
    
    openModal();
    showLoadingState();
    isAnalyzing = true;
    
    try {
      const response = await fetch('/api/compare/ai-analysis.php', {
        method: 'POST',
        credentials: 'same-origin'
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Analisis AI gagal');
      }
      
      currentAnalysis = result;
      showAnalysisResults(result);
      
      // Send Google Analytics event for successful AI Analysis
      if (typeof gtag === 'function') {
        gtag('event', 'ai_analysis_success', {
          event_category: 'Product Compare',
          event_label: 'AI Analysis Completed',
          products_count: compareList.length,
          analysis_type: 'product_comparison',
          custom_map: {
            custom_parameter_1: 'compare_ai_success'
          }
        });
      }
      
    } catch (error) {
      showErrorState(error.message);
      
      // Send Google Analytics event for failed AI Analysis
      if (typeof gtag === 'function') {
        gtag('event', 'ai_analysis_error', {
          event_category: 'Product Compare',
          event_label: 'AI Analysis Failed',
          products_count: compareList.length,
          error_message: error.message,
          custom_map: {
            custom_parameter_1: 'compare_ai_error'
          }
        });
      }
    } finally {
      isAnalyzing = false;
    }
  }
  
  /**
   * Show modal
   */
  function openModal() {
    if (!compareModal) return;
    compareModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  
  /**
   * Close modal
   */
  function closeModal() {
    if (!compareModal) return;
    compareModal.classList.remove('open');
    document.body.style.overflow = '';
  }
  
  /**
   * Show loading state
   */
  function showLoadingState() {
    const loading = document.getElementById('aiLoading');
    const error = document.getElementById('aiError');
    const results = document.getElementById('aiResults');
    
    if (loading) loading.style.display = 'block';
    if (error) error.hidden = true;
    if (results) results.hidden = true;
  }
  
  /**
   * Show error state
   */
  function showErrorState(message) {
    const loading = document.getElementById('aiLoading');
    const error = document.getElementById('aiError');
    const results = document.getElementById('aiResults');
    const errorMessage = document.getElementById('aiErrorMessage');
    
    if (loading) loading.style.display = 'none';
    if (error) error.hidden = false;
    if (results) results.hidden = true;
    if (errorMessage) errorMessage.textContent = message;
  }
  
  /**
   * Show analysis results
   */
  function showAnalysisResults(analysis) {
    const loading = document.getElementById('aiLoading');
    const error = document.getElementById('aiError');
    const results = document.getElementById('aiResults');
    
    if (loading) loading.style.display = 'none';
    if (error) error.hidden = true;
    if (results) results.hidden = false;
    
    const data = analysis.data;
    
    // Update summary
    const summaryElement = document.getElementById('aiSummary');
    if (summaryElement) summaryElement.textContent = data.summary || '';
    
    const winnerProduct = document.getElementById('winnerProduct');
    const winnerReason = document.getElementById('winnerReason');
    if (winnerProduct && winnerReason && data.winner_overall) {
      const winner = compareList.find(p => parseInt(p.id) === parseInt(data.winner_overall));
      winnerProduct.textContent = winner ? winner.name : 'Tidak diketahui';
      winnerReason.textContent = data.winner_reason || '';
    }
    
    // Update comparison table
    updateComparisonTable(data.comparison_table);
    
    // Update detailed analysis
    updateDetailedAnalysis(data.detailed_analysis);
    
    // Update recommendations
    updateRecommendations(data.recommendations);
    
    // Update buying tips
    updateBuyingTips(data.buying_tips);
  }
  
  /**
   * Update comparison table
   */
  function updateComparisonTable(comparisonData) {
    const container = document.getElementById('comparisonTable');
    if (!container || !comparisonData?.categories) return;
    
    // First, create product header row with names
    const productHeaderHtml = `
      <div class="comparison-category">
        <div class="category-header">Produk</div>
        <div class="category-products">
          ${compareList.map(product => `
            <div class="product-score">
              <div class="product-name-header">
                <strong>${escapeHtml(product.name)}</strong>
              </div>
              <div class="product-price">
                ${formatPrice(product.price)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Then create comparison categories
    const categoriesHtml = comparisonData.categories.map(category => `
      <div class="comparison-category">
        <div class="category-header">${escapeHtml(category.name)}</div>
        <div class="category-products">
          ${compareList.map(product => {
            const productData = category.products?.[product.id];
            return `
              <div class="product-score">
                <div class="score-value">
                  <span class="score-stars">${'★'.repeat(productData?.score || 0)}${'☆'.repeat(5 - (productData?.score || 0))}</span>
                  <span>${productData?.score || 0}/5</span>
                </div>
                <div class="score-note">${escapeHtml(productData?.note || '')}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
    
    container.innerHTML = productHeaderHtml + categoriesHtml;
  }
  
  /**
   * Update detailed analysis
   */
  function updateDetailedAnalysis(analysisData) {
    const container = document.getElementById('detailedAnalysis');
    if (!container || !analysisData) return;
    
    container.innerHTML = compareList.map(product => {
      const productAnalysis = analysisData[product.id];
      if (!productAnalysis) return '';
      
      // Use product name from API response if available, fallback to local name
      const productName = productAnalysis.product_name || product.name;
      
      return `
        <div class="product-analysis">
          <h5>${escapeHtml(productName)}</h5>
          
          ${productAnalysis.strengths ? `
            <div class="analysis-section">
              <h6 class="strengths">✅ Kelebihan</h6>
              <ul>
                ${productAnalysis.strengths.map(strength => 
                  `<li>${escapeHtml(strength)}</li>`
                ).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${productAnalysis.weaknesses ? `
            <div class="analysis-section">
              <h6 class="weaknesses">❌ Kekurangan</h6>
              <ul>
                ${productAnalysis.weaknesses.map(weakness => 
                  `<li>${escapeHtml(weakness)}</li>`
                ).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${productAnalysis.best_for ? `
            <div class="analysis-section">
              <h6 class="best-for">🎯 Cocok Untuk</h6>
              <p class="best-for-text">${escapeHtml(productAnalysis.best_for)}</p>
            </div>
          ` : ''}
        </div>
      `;
    }).filter(Boolean).join('');
  }
  
  /**
   * Update recommendations
   */
  function updateRecommendations(recommendations) {
    if (!recommendations) return;
    
    const budgetEl = document.getElementById('budgetRecommendation');
    const performanceEl = document.getElementById('performanceRecommendation');
    const balancedEl = document.getElementById('balancedRecommendation');
    
    if (budgetEl && recommendations.budget_conscious) {
      const product = compareList.find(p => parseInt(p.id) === parseInt(recommendations.budget_conscious));
      budgetEl.textContent = product ? product.name : 'Tidak tersedia';
    }
    
    if (performanceEl && recommendations.performance_focused) {
      const product = compareList.find(p => parseInt(p.id) === parseInt(recommendations.performance_focused));
      performanceEl.textContent = product ? product.name : 'Tidak tersedia';
    }
    
    if (balancedEl && recommendations.balanced) {
      const product = compareList.find(p => parseInt(p.id) === parseInt(recommendations.balanced));
      balancedEl.textContent = product ? product.name : 'Tidak tersedia';
    }
  }
  
  /**
   * Check if products are from different categories
   */
  async function checkProductCategoryMismatch() {
    if (compareList.length < 2) {
      return { shouldWarn: false, categories: new Set() };
    }
    
    // Get the root categories from each product
    const rootCategories = new Set();
    const productCategories = [];
    
    for (const product of compareList) {
      // Extract root category from the product's category_path if available
      const rootCategory = await getProductRootCategory(product);
      if (rootCategory) {
        rootCategories.add(rootCategory);
        productCategories.push({
          product: product.name,
          category: rootCategory
        });
      }
    }
    
    // If we have more than 1 different root categories, show warning
    const shouldWarn = rootCategories.size > 1 && compareList.length >= 2;
    
    return {
      shouldWarn: shouldWarn,
      categories: rootCategories,
      productCategories: productCategories
    };
  }
  
  /**
   * Get product root category from category_path or fallback to name detection
   */
  async function getProductRootCategory(product) {
    // First try to get from category_path if available
    if (product.category_path) {
      const rootCategory = product.category_path.split('/')[0];
      return rootCategory;
    }
    
    // If no category_path, try to fetch from product detail or use name detection
    const detectedCategory = detectProductCategory(product.name);
    return detectedCategory;
  }

  /**
   * Detect product category from name (fallback method)
   */
  function detectProductCategory(productName) {
    const name = productName.toLowerCase();
    
    // Map keywords to actual root categories from the API structure
    const categoryMappings = {
      // Komputer & Laptop
      'Komputer & Laptop': ['laptop', 'notebook', 'macbook', 'thinkpad', 'gaming laptop', 'desktop', 'pc', 'mini pc', 'all-in-one', 'server'],
      
      // Printer & Scanner  
      'Printer & Scanner': ['printer', 'epson printer', 'canon printer', 'hp printer', 'brother printer', 'scanner', 'laser printer', 'inkjet', 'dot matrix'],
      
      // Gadget
      'Gadget': ['smartphone', 'iphone', 'samsung phone', 'xiaomi', 'oppo', 'vivo', 'realme', 'tablet', 'ipad', 'android tablet'],
      
      // Periferal
      'Periferal': ['monitor', 'lcd monitor', 'led monitor', 'gaming monitor', 'keyboard', 'mouse', 'gaming keyboard', 'mechanical keyboard', 'webcam'],
      
      // Audio
      'Audio': ['headset', 'headphone', 'earphone', 'gaming headset', 'speaker', 'mikrofon', 'sound card'],
      
      // Jaringan
      'Jaringan': ['router', 'wifi', 'access point', 'switch', 'modem', 'network'],
      
      // Penyimpanan
      'Penyimpanan': ['ssd', 'hdd', 'nvme', 'solid state', 'hard disk', 'flash drive', 'usb drive', 'memory card'],
      
      // Komponen PC
      'Komponen PC': ['ram', 'memory', 'ddr4', 'ddr5', 'processor', 'cpu', 'intel', 'amd', 'motherboard', 'graphics card', 'gpu', 'psu', 'power supply', 'casing'],
      
      // UPS & Power
      'UPS & Power': ['ups', 'uninterruptible', 'stabilizer', 'power supply'],
      
      // Proyektor
      'Proyektor': ['proyektor', 'projector', 'layar proyektor'],
      
      // Security System
      'Security System': ['cctv', 'security camera', 'surveillance'],
      
      // Aksesoris
      'Aksesoris': ['charger laptop', 'adaptor', 'converter', 'dock', 'hub', 'kabel', 'cable', 'power bank', 'tas laptop'],
      
      // Software
      'Software': ['software', 'lisensi', 'license', 'antivirus'],
      
      // Perlengkapan Kantor
      'Perlengkapan Kantor': ['fingerprint', 'finger print', 'atk', 'alat tulis']
    };
    
    // Check which root category matches
    for (const [rootCategory, keywords] of Object.entries(categoryMappings)) {
      for (const keyword of keywords) {
        if (name.includes(keyword)) {
          return rootCategory;
        }
      }
    }
    
    return null;
  }

  /**
   * Update buying tips
   */
  function updateBuyingTips(tips) {
    const container = document.getElementById('buyingTips');
    if (!container || !Array.isArray(tips)) return;
    
    container.innerHTML = tips.map(tip => 
      `<li>${escapeHtml(tip)}</li>`
    ).join('');
  }
  
  // Removed share and cart functions - replaced with AI disclaimer in UI
  
  /**
   * Remove product from compare (public method)
   */
  async function removeProduct(productId) {
    try {
      await removeFromCompare(productId);
      showToast('Produk dihapus dari perbandingan', 'success');
      
      // Update all compare buttons
      updateAllCompareButtons();
      
    } catch (error) {
      showToast(error.message || 'Terjadi kesalahan', 'error');
    }
  }
  
  /**
   * Utility functions
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function formatPrice(price) {
    return 'Rp ' + parseInt(price).toLocaleString('id-ID');
  }
  
  /**
   * Show confirmation modal using the existing modal.css design
   */
  function showConfirmModal(options = {}) {
    return new Promise((resolve) => {
      const {
        title = 'Konfirmasi',
        message = 'Apakah Anda yakin?',
        confirmText = 'Ya',
        cancelText = 'Tidak',
        type = 'warning'
      } = options;
      
      // Create modal HTML
      const modalHTML = `
        <div class="modal-overlay" id="confirmModal">
          <div class="modal-dialog">
            <div class="modal-header">
              <h3 class="modal-title">
                <div class="modal-icon ${type}">
                  ${getModalIcon(type)}
                </div>
                ${escapeHtml(title)}
              </h3>
            </div>
            <div class="modal-body">
              <p class="modal-message">${escapeHtml(message)}</p>
              <div class="modal-actions">
                <button type="button" class="modal-btn modal-btn-secondary" id="confirmCancel">
                  ${escapeHtml(cancelText)}
                </button>
                <button type="button" class="modal-btn modal-btn-${type === 'danger' ? 'danger' : 'primary'}" id="confirmOk">
                  ${escapeHtml(confirmText)}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add to DOM
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      const modal = document.getElementById('confirmModal');
      const cancelBtn = document.getElementById('confirmCancel');
      const okBtn = document.getElementById('confirmOk');
      
      // Show modal
      requestAnimationFrame(() => {
        modal.classList.add('show');
      });
      
      // Handle events
      function cleanup() {
        modal.remove();
      }
      
      function handleCancel() {
        modal.classList.remove('show');
        setTimeout(() => {
          cleanup();
          resolve(false);
        }, 200);
      }
      
      function handleConfirm() {
        modal.classList.remove('show');
        setTimeout(() => {
          cleanup();
          resolve(true);
        }, 200);
      }
      
      cancelBtn.addEventListener('click', handleCancel);
      okBtn.addEventListener('click', handleConfirm);
      
      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      });
      
      // Close on escape
      document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', escapeHandler);
          handleCancel();
        }
      });
      
      // Focus on confirm button
      setTimeout(() => okBtn.focus(), 100);
    });
  }
  
  /**
   * Get icon for modal type
   */
  function getModalIcon(type) {
      const icons = {
        danger: '🚨 ',
        warning: '⚠️',
        success: '✅',
        info: 'ℹ️'
      };
      return icons[type] || icons.info;
    }


  function showToast(message, type = 'info') {
    // Integration with existing toast system or create simple one
    
    // Simple alert fallback - replace with proper toast system
    if (type === 'error') {
      alert('Error: ' + message);
    }
  }
  
  // Inline compare preview functions removed - keeping it simple and clean
  
  /**
   * Get current product ID from page
   */
  function getCurrentProductId() {
    const button = document.getElementById('pd-compare-btn');
    return button ? parseInt(button.dataset.productId) : null;
  }
  
  // hideStickyCompareBar function removed - no longer using sticky bar

  // Public API
  window.productCompare = {
    removeProduct: removeProduct,
    addToCompare: addToCompare,
    loadCompareList: loadCompareList,
    getCompareList: function() { return compareList; },
    openSidebar: openCompareSidebar,
    startAnalysis: startAIAnalysis,
    // Helper function to add from external sources with variant support
    addProductWithVariant: async function(productId, variantId = 0) {
      return await addToCompare(productId, variantId);
    }
  };

})();

