/**
 * Product Card Quick Actions
 * Bottom sheet menu for quick add to cart & compare
 * Integrates with existing product-compare.js and cart.js
 */

(function() {
  'use strict';
  
  let activeSheet = null;
  let activeProductData = null;
  
  // DOM elements (will be created dynamically)
  let overlay = null;
  let bottomSheet = null;
  
  /**
   * Initialize on DOM ready
   */
  document.addEventListener('DOMContentLoaded', function() {
    createBottomSheet();
    attachEventListeners();
  });
  
  /**
   * Create bottom sheet HTML structure
   */
  function createBottomSheet() {
    // Create overlay
    overlay = document.createElement('div');
    overlay.className = 'pca-overlay';
    overlay.addEventListener('click', closeBottomSheet);
    
    // Create bottom sheet
    bottomSheet = document.createElement('div');
    bottomSheet.className = 'pca-bottom-sheet';
    bottomSheet.innerHTML = `
      <div class="pca-sheet-handle"></div>
      <div class="pca-sheet-product" id="pca-product-preview">
        <!-- Product info will be inserted here -->
      </div>
      <div class="pca-sheet-actions">
        <button type="button" class="pca-action-item cart" id="pca-add-cart">
          <svg class="pca-action-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17,18A2,2 0 0,1 19,20A2,2 0 0,1 17,22C15.89,22 15,21.1 15,20C15,18.89 15.89,18 17,18M1,2H4.27L5.21,4H20A1,1 0 0,1 21,5C21,5.17 20.95,5.34 20.88,5.5L17.3,11.97C16.96,12.58 16.3,13 15.55,13H8.1L7.2,14.63L7.17,14.75A0.25,0.25 0 0,0 7.42,15H19V17H7C5.89,17 5,16.1 5,15C5,14.65 5.09,14.32 5.24,14.04L6.6,11.59L3,4H1V2M7,18A2,2 0 0,1 9,20A2,2 0 0,1 7,22C5.89,22 5,21.1 5,20C5,18.89 5.89,18 7,18M16,11L18.78,6H6.14L8.5,11H16Z"/>
          </svg>
          <div class="pca-action-content">
            <div class="pca-action-label">Tambah ke Keranjang</div>
            <div class="pca-action-desc">Lanjut belanja produk lain</div>
          </div>
        </button>
        
        <button type="button" class="pca-action-item compare" id="pca-add-compare">
          <svg class="pca-action-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21,9L17,5V8H10V10H17V13M7,11L3,15L7,19V16H14V14H7V11Z"/>
          </svg>
          <div class="pca-action-content">
            <div class="pca-action-label">Bandingkan Produk</div>
            <div class="pca-action-desc">Analisis dengan AI</div>
          </div>
          <span class="pca-action-badge compare" id="pca-compare-count" style="display:none;">0</span>
        </button>
      </div>
    `;
    
    // Append to body
    document.body.appendChild(overlay);
    document.body.appendChild(bottomSheet);
    
    // Setup action buttons
    document.getElementById('pca-add-cart').addEventListener('click', handleAddToCart);
    document.getElementById('pca-add-compare').addEventListener('click', handleAddToCompare);
    
    // Prevent clicks inside bottom sheet from closing it
    bottomSheet.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }
  
  /**
   * Attach event listeners to all 3-dot buttons
   */
  function attachEventListeners() {
    // Use event delegation for dynamically loaded product cards
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.prod-card-actions-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        handleActionsButtonClick(btn);
      }
    });
    
    // Handle ESC key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && activeSheet) {
        closeBottomSheet();
      }
    });
  }
  
  /**
   * Handle 3-dot button click
   */
  function handleActionsButtonClick(button) {
    // Get product ID directly from button
    const productId = parseInt(button.dataset.productId) || 0;
    if (!productId) {
      console.error('Product ID not found on button:', button);
      showToast('Data produk tidak ditemukan', 'error');
      return;
    }
    
    // Find parent card for additional data
    const card = button.closest('.prod-card, .pa-card');
    if (!card) {
      console.error('Product card not found');
      showToast('Data produk tidak ditemukan', 'error');
      return;
    }
    
    // Extract product data from card
    const productData = extractProductData(card, productId);
    if (!productData) {
      showToast('Data produk tidak ditemukan', 'error');
      return;
    }
    
    activeProductData = productData;
    openBottomSheet(productData);
  }
  
  /**
   * Extract product data from card element
   */
  function extractProductData(card, productId) {
    try {
      // Product ID already passed from button
      if (!productId) {
        console.error('Product ID not provided');
        return null;
      }
      // Product ID already passed from button
      if (!productId) {
        console.error('Product ID not provided');
        return null;
      }
      
      const id = productId;
      
      // Get product name
      const nameEl = card.querySelector('.prod-name, .title');
      const name = nameEl ? nameEl.textContent.trim() : 'Produk';
      
      // Get product image
      const imgEl = card.querySelector('.thumb img, img');
      const image = imgEl ? imgEl.src : '/assets/img/placeholder.png';
      
      // Get product price and detect variants
      const priceEl = card.querySelector('.prod-price-final, .final, .prod-price');
      let price = 0;
      let hasVariants = false;
      let priceDisplay = '';
      
      if (priceEl) {
        // Get text content and clean it
        let priceText = priceEl.textContent.trim();
        priceDisplay = priceText;
        
        // Check if it's a range (indicates product has variants)
        if (priceText.includes('-')) {
          hasVariants = true;
          // Take the first price for calculation
          priceText = priceText.split('-')[0].trim();
        }
        
        // Remove all non-numeric characters
        priceText = priceText.replace(/[^0-9]/g, '');
        price = parseInt(priceText) || 0;
      }
      
      // Get stock status
      const stockDot = card.querySelector('.stock-dot');
      let stockStatus = 'unknown';
      let stockLabel = 'Cek stok';
      
      if (stockDot) {
        if (stockDot.classList.contains('ready')) {
          stockStatus = 'in';
          stockLabel = 'Stok tersedia';
        } else if (stockDot.classList.contains('low')) {
          stockStatus = 'low';
          stockLabel = 'Stok terbatas';
        } else if (stockDot.classList.contains('out')) {
          stockStatus = 'out';
          stockLabel = 'Stok habis';
        }
      }
      
      // Get category path (if available)
      const categoryPath = card.dataset.category || '';
      
      // Get URL
      let url = '#';
      if (card.tagName === 'A') {
        url = card.href;
      } else {
        const link = card.querySelector('a[href*="/product/"]');
        if (link) url = link.href;
      }
      
      return {
        id: id,
        name: name,
        image: image,
        price: price,
        priceDisplay: priceDisplay,
        hasVariants: hasVariants,
        stockStatus: stockStatus,
        stockLabel: stockLabel,
        categoryPath: categoryPath,
        url: url
      };
    } catch (error) {
      console.error('Error extracting product data:', error);
      return null;
    }
  }
  
  /**
   * Open bottom sheet
   */
  function openBottomSheet(productData) {
    if (!overlay || !bottomSheet) return;
    
    // Update product preview
    updateProductPreview(productData);
    
    // Update cart button based on variant status
    updateCartButtonForVariant(productData);
    
    // Update compare button state
    updateCompareButtonState(productData.id);
    
    // Show overlay and sheet
    overlay.classList.add('active');
    bottomSheet.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    activeSheet = true;
    
    // Google Analytics
    if (typeof gtag === 'function') {
      gtag('event', 'quick_actions_open', {
        event_category: 'Product Card',
        event_label: 'Quick Actions Menu Opened',
        product_id: productData.id,
        product_name: productData.name
      });
    }
  }
  
  /**
   * Close bottom sheet
   */
  function closeBottomSheet() {
    if (!overlay || !bottomSheet) return;
    
    overlay.classList.remove('active');
    bottomSheet.classList.remove('active');
    document.body.style.overflow = '';
    
    activeSheet = false;
    activeProductData = null;
  }
  
  /**
   * Update product preview in bottom sheet
   */
  function updateProductPreview(productData) {
    const preview = document.getElementById('pca-product-preview');
    if (!preview) return;
    
    // Use full price display (shows range for variants)
    const priceDisplay = productData.priceDisplay || formatPrice(productData.price);
    
    preview.innerHTML = `
      <img src="${escapeHtml(productData.image)}" 
           alt="${escapeHtml(productData.name)}" 
           class="pca-product-image"
           loading="lazy">
      <div class="pca-product-info">
        <h4 class="pca-product-name">${escapeHtml(productData.name)}</h4>
        <p class="pca-product-price">${escapeHtml(priceDisplay)}</p>
        <p class="pca-product-stock ${productData.stockStatus}">${productData.stockLabel}</p>
      </div>
    `;
  }
  
  /**
   * Update cart button for variant products
   */
  function updateCartButtonForVariant(productData) {
    const cartBtn = document.getElementById('pca-add-cart');
    if (!cartBtn) return;
    
    if (productData.hasVariants) {
      // Product has variants - change to "View Detail"
      cartBtn.dataset.hasVariants = 'true';
      cartBtn.dataset.productUrl = productData.url;
      
      // Update icon to eye/external
      const iconSvg = cartBtn.querySelector('svg');
      if (iconSvg) {
        iconSvg.innerHTML = '<path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>';
      }
      
      // Update text
      const label = cartBtn.querySelector('.pca-action-label');
      const desc = cartBtn.querySelector('.pca-action-desc');
      if (label) label.textContent = 'Lihat Detail Produk';
      if (desc) desc.textContent = 'Pilih varian terlebih dahulu';
      
    } else {
      // Single product - normal cart button
      cartBtn.dataset.hasVariants = 'false';
      
      // Restore cart icon
      const iconSvg = cartBtn.querySelector('svg');
      if (iconSvg) {
        iconSvg.innerHTML = '<path d="M17,18A2,2 0 0,1 19,20A2,2 0 0,1 17,22C15.89,22 15,21.1 15,20C15,18.89 15.89,18 17,18M1,2H4.27L5.21,4H20A1,1 0 0,1 21,5C21,5.17 20.95,5.34 20.88,5.5L17.3,11.97C16.96,12.58 16.3,13 15.55,13H8.1L7.2,14.63L7.17,14.75A0.25,0.25 0 0,0 7.42,15H19V17H7C5.89,17 5,16.1 5,15C5,14.65 5.09,14.32 5.24,14.04L6.6,11.59L3,4H1V2M7,18A2,2 0 0,1 9,20A2,2 0 0,1 7,22C5.89,22 5,21.1 5,20C5,18.89 5.89,18 7,18M16,11L18.78,6H6.14L8.5,11H16Z"/>';
      }
      
      // Restore text
      const label = cartBtn.querySelector('.pca-action-label');
      const desc = cartBtn.querySelector('.pca-action-desc');
      if (label) label.textContent = 'Tambah ke Keranjang';
      if (desc) desc.textContent = 'Lanjut belanja produk lain';
    }
  }
  
  /**
   * Update compare button state
   */
  function updateCompareButtonState(productId) {
    const compareBtn = document.getElementById('pca-add-compare');
    const compareBadge = document.getElementById('pca-compare-count');
    
    if (!compareBtn) return;
    
    // Check if product is in compare list (using global compareList if available)
    let isInCompare = false;
    let compareCount = 0;
    
    // Try to get compare list from product-compare.js via window.productCompare
    if (typeof window.productCompare !== 'undefined' && typeof window.productCompare.getCompareList === 'function') {
      const compareList = window.productCompare.getCompareList();
      compareCount = compareList.length;
      isInCompare = compareList.some(p => parseInt(p.id) === parseInt(productId));
    } else {
      // Fallback: check badge count
      const mainBadge = document.getElementById('compareCount');
      if (mainBadge) {
        compareCount = parseInt(mainBadge.textContent) || 0;
      }
    }
    
    // Update button state
    if (isInCompare) {
      compareBtn.classList.add('active');
      compareBtn.querySelector('.pca-action-label').textContent = 'Hapus dari Perbandingan';
      compareBtn.querySelector('.pca-action-desc').textContent = 'Sudah ada di daftar';
    } else {
      compareBtn.classList.remove('active');
      compareBtn.querySelector('.pca-action-label').textContent = 'Bandingkan Produk';
      compareBtn.querySelector('.pca-action-desc').textContent = 'Analisis dengan AI';
    }
    
    // Update badge
    if (compareBadge && compareCount > 0) {
      compareBadge.textContent = compareCount;
      compareBadge.style.display = 'inline-flex';
    } else if (compareBadge) {
      compareBadge.style.display = 'none';
    }
  }
  
  /**
   * Handle add to cart
   */
  async function handleAddToCart() {
    if (!activeProductData) return;
    
    const button = document.getElementById('pca-add-cart');
    if (!button) return;
    
    // If product has variants, redirect to detail page
    if (activeProductData.hasVariants) {
      window.location.href = activeProductData.url;
      return;
    }
    
    // Check stock
    if (activeProductData.stockStatus === 'out') {
      showToast('Produk sedang habis', 'warning');
      return;
    }
    
    // Show loading state
    button.classList.add('loading');
    button.disabled = true;
    
    // CSRF Token Helper
    function getCsrfToken() {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }
    
    try {
      // Call cart API with proper format
      const response = await fetch('/api/cart/add.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        body: JSON.stringify({
          csrf_token: getCsrfToken(),
          product_id: activeProductData.id,
          qty: 1, // Use 'qty' not 'quantity'
          variant_id: 0, // Default variant
          meta: {
            name: activeProductData.name,
            image_url: activeProductData.image
          }
        }),
        credentials: 'same-origin'
      });
      
      const result = await response.json();
      
      // Check both response status and result.ok
      if (!response.ok || !result.ok) {
        throw new Error(result.error || result.message || 'Gagal menambahkan ke keranjang');
      }
      
      // Success animation
      button.classList.remove('loading');
      button.classList.add('success');
      
      // Update cart badge
      updateCartBadge();
      
      // Show success toast
      showToast('Produk ditambahkan ke keranjang', 'success');
      
      // Google Analytics
      if (typeof gtag === 'function') {
        gtag('event', 'add_to_cart', {
          event_category: 'Ecommerce',
          event_label: 'Quick Add to Cart',
          items: [{
            item_id: activeProductData.id,
            item_name: activeProductData.name,
            price: activeProductData.price,
            quantity: 1
          }]
        });
      }
      
      // Close sheet after short delay
      setTimeout(() => {
        closeBottomSheet();
        button.classList.remove('success');
        button.disabled = false;
      }, 1000);
      
    } catch (error) {
      console.error('Add to cart error:', error);
      button.classList.remove('loading');
      button.disabled = false;
      showToast(error.message || 'Terjadi kesalahan', 'error');
    }
  }
  
  /**
   * Handle add to compare
   */
  async function handleAddToCompare() {
    if (!activeProductData) return;
    
    const button = document.getElementById('pca-add-compare');
    if (!button) return;
    
    // Check if already in compare
    const isActive = button.classList.contains('active');
    
    // Check 5-product limit before adding
    if (!isActive) {
      const mainBadge = document.getElementById('compareCount');
      const currentCount = mainBadge ? parseInt(mainBadge.textContent) || 0 : 0;
      
      if (currentCount >= 5) {
        showToast('Maksimal 5 produk untuk perbandingan', 'warning');
        return;
      }
    }
    
    // Show loading state
    button.classList.add('loading');
    button.disabled = true;
    
    try {
      if (isActive) {
        // Remove from compare
        await removeFromCompare(activeProductData.id);
        showToast('Produk dihapus dari perbandingan', 'success');
      } else {
        // Add to compare
        await addToCompare(activeProductData.id);
        showToast('Produk ditambahkan ke perbandingan', 'success');
        
        // Trigger fly animation
        triggerFlyToCompareAnimation();
      }
      
      // Success animation
      button.classList.remove('loading');
      button.classList.add('success');
      
      // Update compare button state
      updateCompareButtonState(activeProductData.id);
      
      // Close sheet after short delay
      setTimeout(() => {
        closeBottomSheet();
        button.classList.remove('success');
        button.disabled = false;
      }, 800);
      
    } catch (error) {
      console.error('Compare error:', error);
      button.classList.remove('loading');
      button.disabled = false;
      showToast(error.message || 'Terjadi kesalahan', 'error');
    }
  }
  
  /**
   * Add to compare (calls existing API)
   */
  async function addToCompare(productId) {
    const response = await fetch('/api/compare/add.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        variant_id: 0
      }),
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Gagal menambahkan produk');
    }
    
    // Trigger compare list reload if function exists
    if (typeof window.productCompare !== 'undefined' && typeof window.productCompare.loadCompareList === 'function') {
      await window.productCompare.loadCompareList();
    }
    
    return result;
  }
  
  /**
   * Remove from compare (calls existing API)
   */
  async function removeFromCompare(productId) {
    const response = await fetch('/api/compare/remove.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId
      }),
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Gagal menghapus produk');
    }
    
    // Trigger compare list reload if function exists
    if (typeof window.productCompare !== 'undefined' && typeof window.productCompare.loadCompareList === 'function') {
      await window.productCompare.loadCompareList();
    }
    
    return result;
  }
  
  /**
   * Update cart badge
   */
  function updateCartBadge() {
    // Try to call global cart update function if exists
    if (typeof window.updateCartBadge === 'function') {
      window.updateCartBadge();
    } else {
      // Fallback: increment badge manually
      const badge = document.getElementById('cartCount');
      if (badge) {
        const currentCount = parseInt(badge.textContent) || 0;
        badge.textContent = currentCount + 1;
        badge.classList.add('active');
      }
    }
  }
  
  /**
   * Trigger fly to compare animation
   */
  function triggerFlyToCompareAnimation() {
    const compareBtn = document.getElementById('compareBtn');
    if (!compareBtn || !activeProductData) return;
    
    // Create flying element
    const flyingElement = document.createElement('div');
    flyingElement.className = 'flying-product';
    flyingElement.style.cssText = `
      position: fixed;
      width: 60px;
      height: 60px;
      z-index: 99999;
      pointer-events: none;
    `;
    
    flyingElement.innerHTML = `
      <img src="${activeProductData.image}" 
           style="width:100%;height:100%;object-fit:cover;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
    `;
    
    // Position at bottom sheet
    const sheetRect = bottomSheet.getBoundingClientRect();
    const targetRect = compareBtn.getBoundingClientRect();
    
    flyingElement.style.top = `${sheetRect.top + 20}px`;
    flyingElement.style.left = `${sheetRect.left + 20}px`;
    
    document.body.appendChild(flyingElement);
    
    // Animate to target
    requestAnimationFrame(() => {
      flyingElement.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      flyingElement.style.top = `${targetRect.top + 10}px`;
      flyingElement.style.left = `${targetRect.left + 10}px`;
      flyingElement.style.transform = 'scale(0.3)';
      flyingElement.style.opacity = '0';
    });
    
    // Clean up
    setTimeout(() => {
      if (flyingElement.parentNode) {
        flyingElement.parentNode.removeChild(flyingElement);
      }
    }, 800);
  }
  
  /**
   * Format price as Rupiah
   */
  function formatPrice(price) {
    if (!price || price === 0) return 'Rp 0';
    return 'Rp ' + parseInt(price).toLocaleString('id-ID');
  }
  
  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Show toast notification (uses global showToast if available)
   */
  function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast({
        title: type === 'success' ? 'Berhasil' : type === 'error' ? 'Gagal' : 'Info',
        message: message,
        type: type,
        duration: 3000
      });
    } else {
      // Fallback: console log
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
  
  /**
   * Expose functions for external access
   */
  window.ProductCardActions = {
    openSheet: openBottomSheet,
    closeSheet: closeBottomSheet,
    updateCompareState: updateCompareButtonState
  };
  
})();