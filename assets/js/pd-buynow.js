(function(){
  
  // CSRF Token Helper
  function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  }
  
  // Utility functions
  function esc(s){ return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }
  
  function getVariantSummaryText(){
    const vs = document.getElementById('pd-variant-summary');
    if (!vs) return '';
    const items = Array.from(vs.querySelectorAll('.vs-item strong')).map(el => el.textContent.trim()).filter(Boolean);
    return items.length ? items.join(' / ') : '';
  }

  function getCurrentProductData(){
    const form = document.getElementById('pd-buy-form');
    if (!form) return null;

    const productId = parseInt(form.dataset.pid || '0', 10);
    const qty = parseInt(form.querySelector('[name=qty]')?.value || '1', 10) || 1;
    const variantId = parseInt(document.getElementById('pd-variant-id')?.value || '0', 10) || 0;
    
    if (!productId || productId <= 0) {
      throw new Error('Product ID tidak valid');
    }

    if (qty <= 0) {
      throw new Error('Quantity harus lebih dari 0');
    }

    return { productId, qty, variantId };
  }

  function createBuyNowPayload(productId, qty, variantId) {
    // Get product metadata
    const name = (window.PD_NAME !== undefined) ? String(window.PD_NAME) : (document.getElementById('pd-title')?.textContent || '');
    
    // Get correct price, SKU, and weight from selected variant data instead of DOM elements
    let price = 0;
    let sku = '';
    let weight = 0;
    let dimensions = null;
    
    if (variantId > 0 && typeof window.variants !== 'undefined' && Array.isArray(window.variants)) {
      // Find the selected variant in the variants array
      const selectedVariant = window.variants.find(v => v.id === variantId);
      if (selectedVariant) {
        price = selectedVariant.final || 0;
        sku = selectedVariant.sku || '';
        weight = selectedVariant.weight || 0;
        
        // Include dimensions if available
        if (selectedVariant.length_cm || selectedVariant.width_cm || selectedVariant.height_cm) {
          dimensions = {
            length_cm: selectedVariant.length_cm || 0,
            width_cm: selectedVariant.width_cm || 0,
            height_cm: selectedVariant.height_cm || 0
          };
        }
        
        // Debug info to verify fix is working
        if (window.console && window.console.debug) {
          console.debug('BuyNow: Using variant data', {
            variantId: variantId,
            price: price,
            sku: sku,
            weight: weight,
            dimensions: dimensions,
            variantData: selectedVariant
          });
        }
      }
    }
    
    // Fallback to DOM elements if variant data not found
    if (price === 0) {
      const priceTxt = document.getElementById('pd-price-current')?.textContent || '';
      price = parseInt(String(priceTxt).replace(/[^\d]/g,''), 10) || 0;
      
      if (window.console && window.console.debug) {
        console.debug('BuyNow: Using DOM price fallback', { 
          priceTxt: priceTxt, 
          price: price,
          variantId: variantId,
          reason: variantId > 0 ? 'variant_data_not_found' : 'no_variant_selected'
        });
      }
    }
    
    if (!sku) {
      const skuEl = document.getElementById('pd-sku');
      sku = skuEl ? skuEl.textContent.trim() : (window.PD_SKU || '');
    }
    
    const imgEl = document.getElementById('pd-main-img');
    const image_url = imgEl ? (imgEl.getAttribute('src') || '') : '';

    const variantText = getVariantSummaryText();
    
    // Get pre-order data if product is pre-order
    const preorderData = window.PD_PREORDER_DATA || null;
    
    return {
      product_id: productId,
      qty: qty,
      variant_id: variantId,
      meta: {
        name,
        sku,
        price,
        image_url,
        variant_text: variantText,
        weight: weight,
        dimensions: dimensions
      },
      is_preorder: preorderData ? 'Y' : 'N',
      preorder_estimated_arrival: preorderData ? preorderData.estimated_arrival : null,
      preorder_note: preorderData ? preorderData.note : ''
    };
  }

  /**
   * Main Buy Now function
   * Performs validation and redirects to checkout with buy_now mode
   */
  window.buyNow = async function(e) {
    if (e) e.preventDefault();
    
    try {
      // Check user login status
      const isLoggedIn = document.querySelector('meta[name="user-logged-in"]')?.content === 'true' ||
                        document.body.classList.contains('logged-in') ||
                        window.userLoggedIn === true ||
                        document.body.dataset.userLoggedIn === 'true';
      
      if (!isLoggedIn) {
        // Redirect to login with return URL to current page
        const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = '/login?return=' + currentUrl;
        return;
      }

      // Get current product data
      const { productId, qty, variantId } = getCurrentProductData();
      
      // Create payload for buy now
      const payload = createBuyNowPayload(productId, qty, variantId);
      
      // Store buy now data in sessionStorage for checkout page
      sessionStorage.setItem('buyNowData', JSON.stringify(payload));
      
      // Redirect to checkout with buy_now mode
      window.location.href = '/checkout?mode=buy_now';
      
    } catch (err) {
      console.error('Buy Now error:', err);
      
      if (window.showToast) {
        window.showToast({ 
          type: 'warn', 
          title: 'Gagal memproses', 
          message: String(err?.message || 'Terjadi kesalahan saat memproses pembelian'), 
          duration: 4500 
        });
      } else {
        alert(err.message || 'Terjadi kesalahan saat memproses pembelian');
      }
    }
  };

  /**
   * Alternative Buy Now with confirmation dialog
   */
  window.buyNowWithConfirm = async function(e) {
    if (e) e.preventDefault();
    
    try {
      const { productId, qty, variantId } = getCurrentProductData();
      
      const name = (window.PD_NAME !== undefined) ? String(window.PD_NAME) : (document.getElementById('pd-title')?.textContent || '');
      const variantText = getVariantSummaryText();
      const priceTxt = document.getElementById('pd-price-current')?.textContent || 'Rp0';
      
      const confirmMessage = `Lanjut ke checkout?\n\nProduk: ${name}${variantText ? `\nVariant: ${variantText}` : ''}\nQty: ${qty}\nHarga: ${priceTxt}`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
      
      // Proceed with buy now
      await window.buyNow(e);
      
    } catch (err) {
      console.error('Buy Now with confirm error:', err);
      alert(err.message || 'Terjadi kesalahan');
    }
  };

  /**
   * Attach event listener for Buy with Voucher button
   */
  function setupBuyButtons() {
    // Setup desktop buy button (regular buy now without voucher)
    const buyBtn = document.getElementById('btn-buy');
    if (buyBtn) {
      buyBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (buyBtn.disabled) return;
        if (window.buyNow) {
          window.buyNow(e);
        }
      });
    }
    
    // Setup desktop buy with voucher button
    const voucherBtn = document.getElementById('btn-buy-voucher');
    if (voucherBtn) {
      voucherBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Validate stock availability before proceeding
        if (this.disabled || this.getAttribute('data-stock-blocked') === 'true') {
          const stockReason = this.getAttribute('data-stock-reason') || 'Stok tidak tersedia';
          
          if (window.showToast) {
            window.showToast({
              type: 'warn',
              title: 'Stok Tidak Tersedia',
              message: stockReason,
              duration: 3500
            });
          } else {
            alert(stockReason);
          }
          return;
        }
        
        const voucherCode = this.dataset.voucherCode;
        if (voucherCode) {
          window.buyNowWithVoucher(e, voucherCode);
        }
      });
    }
    
  }
  
  // CRITICAL: Attach mobile button handler at DOCUMENT level with CAPTURE phase
  // This is the ONLY way to guarantee it fires regardless of other scripts
  document.addEventListener('click', function(e) {
    // Check if click is on mobile buy button or its children
    const target = e.target.closest('#mf-buy');
    if (!target) return; // Not our button
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    if (target.disabled) return;
    
    // Get voucher code from parent FAB's data attribute
    const mobileFab = document.getElementById('pd-mobile-fab');
    const voucherCode = mobileFab ? (mobileFab.getAttribute('data-voucher-code') || '') : '';
    
    if (voucherCode && voucherCode.trim() !== '' && window.buyNowWithVoucher) {
      window.buyNowWithVoucher(e, voucherCode);
    } else if (window.buyNow) {
      window.buyNow(e);
    }
  }, true); // CAPTURE PHASE - fires BEFORE any bubble phase handlers
  
  // Execute immediately if DOM already loaded, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBuyButtons);
  } else {
    setupBuyButtons();
  }

  /**
   * Buy Now with Auto-Applied Voucher
   * Applies voucher to session before redirecting to checkout (like cart does)
   * 
   * @param {Event} e - Click event
   * @param {string} voucherCode - Voucher code to apply
   */
  window.buyNowWithVoucher = async function(e, voucherCode) {
    if (e) e.preventDefault();
    
    console.log('[buyNowWithVoucher] Called with voucher code:', voucherCode);
    
    try {
      // CRITICAL: Check stock availability first
      const voucherBtn = document.getElementById('btn-buy-voucher');
      if (voucherBtn) {
        if (voucherBtn.disabled || voucherBtn.getAttribute('data-stock-blocked') === 'true') {
          const stockReason = voucherBtn.getAttribute('data-stock-reason') || 'Stok tidak tersedia';
          
          if (window.showToast) {
            window.showToast({
              type: 'warn',
              title: 'Stok Tidak Tersedia',
              message: stockReason,
              duration: 3500
            });
          } else {
            alert(stockReason);
          }
          return;
        }
      }
      
      // Check login status first
      const isLoggedIn = document.querySelector('meta[name="user-logged-in"]')?.content === 'true' ||
                        document.body.classList.contains('logged-in') ||
                        window.userLoggedIn === true ||
                        document.body.dataset.userLoggedIn === 'true';
      
      console.log('[buyNowWithVoucher] User logged in:', isLoggedIn);
      
      if (!isLoggedIn) {
        const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = '/login?return=' + currentUrl;
        return;
      }

      // Get current product data
      const { productId, qty, variantId } = getCurrentProductData();
      const payload = createBuyNowPayload(productId, qty, variantId);
      
      console.log('[buyNowWithVoucher] Product data:', { productId, qty, variantId });
      
      // Get category path for voucher validation
      const categoryPath = window.PD_CATEGORY_PATH || '';
      
      // Step 1: Clear any existing voucher first (important for clean state)
      console.log('[buyNowWithVoucher] Step 1: Clearing existing voucher...');
      try {
        await fetch('/api/voucher/remove.php', {
          method: 'POST',
          headers: { 
            'X-CSRF-Token': getCsrfToken()
          },
          body: JSON.stringify({
            csrf_token: getCsrfToken()
          }),
          credentials: 'same-origin'
        });
      } catch (e) {
        // Ignore error if no voucher exists
        console.debug('No existing voucher to remove or removal failed');
      }
      
      // Step 2: Apply voucher to session (like cart does)
      console.log('[buyNowWithVoucher] Step 2: Applying voucher to session...');
      const applyRes = await fetch('/api/voucher/apply.php', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          csrf_token: getCsrfToken(),
          code: voucherCode,
          items: [{
            pid: productId,
            price: payload.meta.price,
            qty: qty,
            category_path: categoryPath
          }],
          shipping_cost: null // Will be calculated in checkout
        })
      });
      
      const applyData = await applyRes.json();
      
      console.log('[buyNowWithVoucher] Voucher apply response:', applyData);
      
      if (!applyData.success) {
        // Voucher invalid - show error and fallback to regular buy now
        console.warn('[buyNowWithVoucher] Voucher application failed:', applyData.message);
        if (window.showToast) {
          window.showToast({
            type: 'error',
            title: 'Voucher Tidak Valid',
            message: applyData.message || 'Voucher tidak dapat diterapkan untuk produk ini',
            duration: 4000
          });
        } else {
          alert(applyData.message || 'Voucher tidak dapat diterapkan');
        }
        
        // Fallback to regular buy now without voucher
        console.log('Voucher failed, proceeding with regular buy now');
        return window.buyNow(e);
      }
      
      // Step 3: Store buy now data in sessionStorage
      console.log('[buyNowWithVoucher] Step 3: Storing buy now data in sessionStorage');
      sessionStorage.setItem('buyNowData', JSON.stringify(payload));
      
      // Step 4: Redirect to checkout
      // Voucher sudah di session, checkout akan auto-load via loadAppliedVoucher()
      console.log('[buyNowWithVoucher] Step 4: Redirecting to checkout with voucher applied');
      window.location.href = '/checkout?mode=buy_now';
      
    } catch (err) {
      console.error('Buy Now with Voucher error:', err);
      
      if (window.showToast) {
        window.showToast({
          type: 'error',
          title: 'Terjadi Kesalahan',
          message: 'Gagal memproses pembelian dengan voucher. Silakan coba lagi.',
          duration: 3000
        });
      } else {
        alert('Gagal memproses pembelian. Silakan coba lagi.');
      }
    }
  };
})();