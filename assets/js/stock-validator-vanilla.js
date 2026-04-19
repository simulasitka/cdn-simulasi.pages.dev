/**
 * Stock Validation - Vanilla JS Version
 * 
 * This script provides client-side stock validation without jQuery dependency
 * - Works with native JavaScript and fetch API
 * - Graceful fallback for older browsers
 * - Same functionality as jQuery version
 */

window.StockValidator = (function() {
    'use strict';

    const config = {
        apiEndpoint: '/api/stock/check.php',
        modalSelector: '#stock-modal-overlay',  // We create our own modal
        loadingClass: 'loading-stock',
        disabledClass: 'stock-disabled',
        debug: true  // Enable debug logging
    };

    /**
     * Cross-browser event listener helper
     */
    function addEventListener(element, event, handler) {
        if (element.addEventListener) {
            element.addEventListener(event, handler);
        } else if (element.attachEvent) {
            element.attachEvent('on' + event, handler);
        }
    }

    /**
     * Get stock information from embedded variant data (instant, no AJAX needed)
     */
    function getStockFromEmbeddedData(variantId) {
        // Check if embedded variant data exists
        if (!window.__PD_VARIANTS_WITH_BRANCH__ || !Array.isArray(window.__PD_VARIANTS_WITH_BRANCH__)) {
            return null;
        }
        
        const variants = window.__PD_VARIANTS_WITH_BRANCH__;
        
        // SPECIAL CASE: Simple product (no variants) - empty array means simple product
        if (variants.length === 0) {
            // For simple products, we cannot determine stock from embedded data
            // Return null to force API validation
            return null;
        }
        
        // If no variant specified, check base product stock (all variants)
        if (!variantId || variantId <= 0) {
            // For base product, check if ANY variant has stock
            const isPreorder = window.isPreorderProduct || false;
            let hasAnyStock = false;
            let totalStock = 0;
            
            if (isPreorder) {
                // For pre-order, check preorder_remaining
                hasAnyStock = variants.some(v => {
                    if ('preorder_remaining' in v && v.preorder_remaining !== null) {
                        return v.preorder_remaining > 0;
                    }
                    return v.stock > 0;
                });
                totalStock = variants.reduce((sum, v) => {
                    if ('preorder_remaining' in v && v.preorder_remaining !== null) {
                        return sum + (v.preorder_remaining || 0);
                    }
                    return sum + (v.stock || 0);
                }, 0);
            } else {
                hasAnyStock = variants.some(v => v.stock > 0);
                totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
            }
            
            return {
                hasStock: hasAnyStock,
                stock: totalStock,
                sku: 'Base Product',
                variant: null
            };
        }
        
        // Find specific variant
        const variant = variants.find(v => v.id === variantId);
        
        if (!variant) {
            return {
                hasStock: false,
                stock: 0,
                sku: 'Unknown Variant',
                variant: null
            };
        }
        
        // For pre-order products, check preorder_remaining instead of stock
        const isPreorder = window.isPreorderProduct || false;
        let hasStock = false;
        let availableStock = 0;
        
        if (isPreorder && 'preorder_remaining' in variant && variant.preorder_remaining !== null) {
            availableStock = parseInt(variant.preorder_remaining, 10);
            if (isNaN(availableStock)) availableStock = 0;
            hasStock = availableStock > 0;
        } else {
            availableStock = variant.stock || 0;
            hasStock = availableStock > 0;
        }
        
        return {
            hasStock: hasStock,
            stock: availableStock,
            sku: variant.sku,
            variant: variant
        };
    }

    /**
     * Cross-browser AJAX helper
     */
    function makeRequest(url, options) {
        return new Promise((resolve, reject) => {
            // Try fetch first (modern browsers)
            if (typeof fetch !== 'undefined') {
                const fetchOptions = {
                    method: options.method || 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: options.data ? new URLSearchParams(options.data).toString() : null
                };

                fetch(url, fetchOptions)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(resolve)
                    .catch(reject);
            } else {
                // Fallback to XMLHttpRequest
                const xhr = new XMLHttpRequest();
                xhr.open(options.method || 'POST', url);
                xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                
                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${xhr.status}`));
                    }
                };
                
                xhr.onerror = function() {
                    reject(new Error('Network error'));
                };
                
                const data = options.data ? new URLSearchParams(options.data).toString() : null;
                xhr.send(data);
            }
        });
    }

    /**
     * Check stock via AJAX
     */
    function checkStock(productId, variantId, qty) {
        return makeRequest(config.apiEndpoint, {
            method: 'POST',
            data: {
                product_id: productId,
                variant_id: variantId || 0,
                qty: qty || 1
            }
        });
    }

    /**
     * Create and show stock alert modal using modal.css structure
     */
    function showStockModal(stockInfo, action = 'add to cart') {
        let title, message, type, iconClass;

        // Handle both string and object formats
        if (typeof stockInfo === 'string') {
            title = 'Stok Tidak Tersedia';
            message = stockInfo;
            type = 'warning';
            iconClass = 'warning';
        } else if (stockInfo && typeof stockInfo === 'object') {
            if (!stockInfo.is_active) {
                title = 'Produk Tidak Tersedia';
                message = 'Maaf, produk ini sudah tidak aktif atau telah dihapus dari katalog.';
                type = 'danger';
                iconClass = 'danger';
            } else if (!stockInfo.is_in_stock) {
                title = 'Stok Habis';
                message = `<strong>${stockInfo.product_name || 'Produk ini'}</strong> sedang habis stok. Silakan pilih varian lain atau tunggu restock.`;
                if (stockInfo.sku) {
                    message += `<br><small style="color: #64748b;">SKU: ${stockInfo.sku}</small>`;
                }
                type = 'warning';
                iconClass = 'warning';
            } else if (!stockInfo.can_add_to_cart) {
                title = 'Stok Tidak Mencukupi';
                message = `Stok <strong>${stockInfo.product_name || 'produk'}</strong> tidak mencukupi.<br>`;
                message += `Tersedia: <strong>${stockInfo.available_stock}</strong>, diminta: <strong>${stockInfo.requested_qty}</strong><br>`;
                message += `Silakan kurangi jumlah atau pilih varian lain.`;
                type = 'warning';
                iconClass = 'warning';
            } else {
                title = 'Stok Tidak Tersedia';
                message = stockInfo.message || 'Produk ini tidak dapat ditambahkan ke keranjang saat ini.';
                type = 'warning';
                iconClass = 'warning';
            }
        } else {
            title = 'Stok Tidak Tersedia';
            message = 'Produk ini tidak dapat ditambahkan ke keranjang saat ini.';
            type = 'warning';
            iconClass = 'warning';
        }

        // Create modal HTML using modal.css structure
        const modalHTML = `
            <div class="modal-overlay" id="stock-modal-overlay">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <div class="modal-icon ${iconClass}">
                            ${getIconSVG(iconClass)}
                        </div>
                        <h3 class="modal-title">${title}</h3>
                    </div>
                    <div class="modal-body">
                        <p class="modal-message">${message}</p>
                        <div class="modal-actions">
                            <button type="button" class="modal-btn modal-btn-secondary" data-action="close">
                                Tutup
                            </button>
                            <button type="button" class="modal-btn modal-btn-primary" data-action="reload">
                                Muat Ulang
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('stock-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Show modal with animation
        const modal = document.getElementById('stock-modal-overlay');
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // Add event listeners to modal buttons
        const closeBtn = modal.querySelector('[data-action="close"]');
        const reloadBtn = modal.querySelector('[data-action="reload"]');
        
        if (closeBtn) {
            addEventListener(closeBtn, 'click', closeStockModal);
        }
        
        if (reloadBtn) {
            addEventListener(reloadBtn, 'click', function() {
                closeStockModal();
                window.location.reload();
            });
        }

        // Close modal when clicking overlay
        addEventListener(modal, 'click', function(event) {
            if (event.target === modal) {
                closeStockModal();
            }
        });

        // Auto-close after 8 seconds
        setTimeout(() => {
            closeStockModal();
        }, 8000);
    }

    /**
     * Get icon SVG based on type
     */
    function getIconSVG(type) {
        const icons = {
            danger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
        };
        return icons[type] || icons.info;
    }

    /**
     * Close stock modal
     */
    function closeStockModal() {
        const modal = document.getElementById('stock-modal-overlay');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
            }, 200);
        }
    }

    // Make closeStockModal globally available
    if (typeof window !== 'undefined') {
        window.closeStockModal = closeStockModal;
    }

    /**
     * Get element data attribute with fallback
     */
    function getDataAttribute(element, attr) {
        if (element.dataset) {
            return element.dataset[attr];
        } else {
            return element.getAttribute('data-' + attr);
        }
    }

    /**
     * Validate stock before cart action
     */
    async function validateBeforeCart(productId, variantId, qty, action = 'add') {
        try {
            // SMART VALIDATION: For simple products, check if we already have cached stock info
            // If buttons are enabled and cached info shows stock available, skip API validation
            if (window._currentStockInfo && window._currentStockInfo.can_add_to_cart) {
        
                return true;
            }
            
            // For variant products or when cached info is not available, do API validation
            const stockInfo = await checkStock(productId, variantId, qty);
            
            if (!stockInfo.ok) {
                showStockModal({ 
                    message: stockInfo.error || 'Gagal mengecek stok',
                    is_active: false 
                }, action);
                return false;
            }

            if (!stockInfo.can_add_to_cart) {
                showStockModal(stockInfo, action);
                return false;
            }

            return true; // Stock available, proceed

        } catch (error) {
            console.error('Stock validation error:', error);
            showStockModal({ 
                message: 'Terjadi kesalahan saat mengecek stok. Silakan coba lagi.',
                is_active: false 
            }, action);
            return false;
        }
    }

    /**
     * Handle button click with stock validation
     */
    function handleButtonClick(event, action) {
        const button = event.target;
        
        
        // FIRST CHECK: Is button marked as stock-blocked? (Anti-tampering)
        if (button.hasAttribute('data-stock-blocked')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            
            const reason = button.getAttribute('data-stock-reason') || 'Stok tidak tersedia';
            showStockModal(reason);
            
            // Show security warning
            if (window.showToast) {
                window.showToast({
                    type: 'warning',
                    title: 'Aksi Tidak Diizinkan',
                    message: 'Produk ini sedang habis stok. Silakan pilih varian lain.',
                    duration: 3000
                });
            }
            return false;
        }
        
        // SECOND CHECK: Real-time stock validation against cached stock info
        if (window._currentStockInfo && !window._currentStockInfo.can_add_to_cart) {
            event.preventDefault();
            event.stopImmediatePropagation();
            
            showStockModal(window._currentStockInfo.message || 'Stok tidak tersedia');
            
            // Re-enforce button disabling
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
            button.setAttribute('data-stock-blocked', 'true');
            
            return false;
        }
        
        // Skip if already processing
        if (button.classList.contains(config.loadingClass)) {
            event.preventDefault();
            return false;
        }

        // Get product data from button attributes or form
        let productId = parseInt(getDataAttribute(button, 'productId') || getDataAttribute(button, 'product-id') || 0);
        let variantId = parseInt(getDataAttribute(button, 'variantId') || getDataAttribute(button, 'variant-id') || 0);
        let qty = parseInt(getDataAttribute(button, 'qty') || 1);

        // Try to get from global variables (set by product detail page)
        if (productId <= 0 && typeof window.PD_ID !== 'undefined') {
            productId = parseInt(window.PD_ID || 0);
        }

        // Try to get from parent form if not in button
        if (productId <= 0) {
            const form = button.closest ? button.closest('form') : null;
            if (form) {
                const pidAttr = form.getAttribute('data-pid');
                const pidInput = form.querySelector('[name="product_id"]');
                const vidInput = form.querySelector('[name="variant_id"]');
                const qtyInput = form.querySelector('[name="qty"]');
                
                if (pidAttr) productId = parseInt(pidAttr);
                if (pidInput) productId = parseInt(pidInput.value || 0);
                if (vidInput) variantId = parseInt(vidInput.value || 0);
                if (qtyInput) qty = parseInt(qtyInput.value || 1);
            }
        }

        // CRITICAL: Always get current variant from selector (overrides button attributes)
        // This ensures we validate against the currently selected variant, not cached button data
        const variantSelector = document.getElementById('pd-variant-id');
        if (variantSelector) {
            const currentVariantId = parseInt(variantSelector.value || 0);
            if (currentVariantId > 0) {
                variantId = currentVariantId;
            }
        }


        if (productId <= 0) {
            return true; // Let default handler deal with it
        }

        // Prevent default and validate stock
        event.preventDefault();
        event.stopPropagation();
        
        // Show loading state
        button.classList.add(config.loadingClass);
        const originalDisabled = button.disabled;
        button.disabled = true;
        
        
        validateBeforeCart(productId, variantId, qty, action)
            .then(isValid => {
                if (isValid) {
                    // Stock OK, proceed with original action
                    if (action === 'cart' && typeof window.addToCart === 'function') {
                        window.addToCart(productId, qty, variantId);
                    } else if (action === 'buy' && typeof window.buyNow === 'function') {
                        // Call buyNow from pd-buynow.js without parameters (it gets data internally)
                        window.buyNow();
                    } else {
                        // Add fallback cart/buy logic here if needed
                    }
                }
            })
            .catch(error => {
            })
            .finally(() => {
                // Remove loading state
                button.classList.remove(config.loadingClass);
                button.disabled = originalDisabled;
            });

        return false;
    }

    /**
     * Handle mobile button click with stock validation
     */
    function handleMobileButtonClick(event, action) {
        const button = event.target;
        
        
        // FIRST CHECK: Is button marked as stock-blocked? (Anti-tampering)
        if (button.hasAttribute('data-stock-blocked')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            
            const reason = button.getAttribute('data-stock-reason') || 'Stok tidak tersedia';
            showStockModal(reason);
            
            // Show security warning
            if (window.showToast) {
                window.showToast({
                    type: 'warning',
                    title: 'Aksi Tidak Diizinkan',
                    message: 'Produk ini sedang habis stok. Silakan pilih varian lain.',
                    duration: 3000
                });
            }
            return false;
        }
        
        // SECOND CHECK: Real-time stock validation against cached stock info
        if (window._currentStockInfo && !window._currentStockInfo.can_add_to_cart) {
            event.preventDefault();
            event.stopImmediatePropagation();
            
            showStockModal(window._currentStockInfo.message || 'Stok tidak tersedia');
            
            // Re-enforce button disabling
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
            button.setAttribute('data-stock-blocked', 'true');
            
            return false;
        }
        
        // Skip if already processing
        if (button.classList.contains(config.loadingClass)) {
            event.preventDefault();
            return false;
        }

        // Get product data from mobile FAB container
        let productId = 0;
        let variantId = 0;
        let qty = 1;

        // Try to get from mobile FAB data-pid
        const mobileFab = document.getElementById('pd-mobile-fab');
        if (mobileFab) {
            const pidAttr = getDataAttribute(mobileFab, 'pid');
            if (pidAttr) productId = parseInt(pidAttr);
        }

        // Try to get from global variables (set by product detail page)
        if (productId <= 0 && typeof window.PD_ID !== 'undefined') {
            productId = parseInt(window.PD_ID || 0);
        }

        // CRITICAL: Always get current variant from selector (real-time)
        // This ensures we validate against the currently selected variant
        const variantSelector = document.getElementById('pd-variant-id');
        if (variantSelector) {
            variantId = parseInt(variantSelector.value || 0);
        }

        // Try to get quantity from quantity input
        const qtySelector = document.querySelector('[name="qty"]');
        if (qtySelector) {
            qty = parseInt(qtySelector.value || 1);
        }
        
        // Ensure minimum quantity is 1
        qty = Math.max(1, qty);


        if (productId <= 0) {
            return true; // Let default handler deal with it
        }

        // Event already prevented at interceptor level, just proceed with validation
        
        // Show loading state
        button.classList.add(config.loadingClass);
        const originalDisabled = button.disabled;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = action === 'cart' ? 'Validasi...' : 'Validasi...';
        
        
        // PREEMPTIVE BLOCKING: Set blocking flags BEFORE validation to prevent race conditions
        if (window.addToCart && typeof window.addToCart === 'function') {
            window.addToCart._stockValidatorBlocked = true;
        }
        
        // Also preemptively block other cart functions
        const originalAddToCartSubmit = window.addToCartSubmit;
        const originalPdAddToCartSubmit = window._pdAddToCartSubmit;
        
        // Temporarily block ALL cart functions during validation
        window.addToCartSubmit = (...args) => {
            return Promise.resolve(false);
        };
        
        if (originalPdAddToCartSubmit) {
            window._pdAddToCartSubmit = (...args) => {
                return Promise.resolve(false);
            };
        }
        
        validateBeforeCart(productId, variantId, qty, action)
            .then(isValid => {
                if (isValid) {
                    // Stock OK, proceed with original action
                    
                    if (action === 'cart') {
                        // For mobile cart, we need to recreate the original behavior
                        // Strategy: Try multiple methods to ensure cart add + toast success
                        
                        
                        let cartAddSuccess = false;
                        let errorMessage = '';
                        
                        // Method 1: Try original addToCart function
                        const originalAddToCart = window.addToCart && window.addToCart._original;
                        if (originalAddToCart && !cartAddSuccess) {
                            try {
                                const result = originalAddToCart(productId, qty, variantId);
                                
                                // Handle both sync and async returns
                                if (result && typeof result.then === 'function') {
                                    result.then(() => {
                                        cartAddSuccess = true;
                                    }).catch(err => {
                                        errorMessage = err.message || 'addToCart failed';
                                    });
                                } else {
                                    cartAddSuccess = true;
                                }
                            } catch (error) {
                                errorMessage = error.message || 'addToCart exception';
                            }
                        }
                        
                        // Method 2: Try pd-addtocart.js function (backup method)
                        if (typeof window._pdAddToCartSubmit === 'function' && !cartAddSuccess) {
                            try {
                                
                                // Create fake form for pd-addtocart.js
                                const fakeForm = document.createElement('form');
                                const qtyInput = document.createElement('input');
                                qtyInput.name = 'qty';
                                qtyInput.value = qty;
                                fakeForm.appendChild(qtyInput);
                                
                                // Set variant selector value for pd-addtocart to read
                                const variantSelector = document.getElementById('pd-variant-id');
                                if (variantSelector) {
                                    variantSelector.value = variantId;
                                }
                                
                                const fakeEvent = { 
                                    preventDefault: () => {},
                                    target: fakeForm
                                };
                                
                                // Call pd-addtocart.js function (this should handle toast internally)
                                const result = window._pdAddToCartSubmit(fakeEvent, productId);
                                if (result && typeof result.then === 'function') {
                                    result.then(() => {
                                        cartAddSuccess = true;
                                    });
                                } else {
                                    cartAddSuccess = true;
                                }
                            } catch (error) {
                            }
                        }
                        
                        // Method 3: Direct addToCart call (fallback)
                        if (typeof window.addToCart === 'function' && !cartAddSuccess) {
                            try {
                                const result = window.addToCart(productId, qty, variantId);
                                if (result && typeof result.then === 'function') {
                                    result.then(() => {
                                        cartAddSuccess = true;
                                    });
                                } else {
                                    cartAddSuccess = true;
                                }
                            } catch (error) {
                            }
                        }
                        
                        // Always show success toast for mobile (regardless of which method worked)
                        // This ensures user gets feedback for successful cart addition
                        setTimeout(() => {
                            if (window.showToast) {
                                
                                // Get product details for toast
                                const getVariantSummaryText = () => {
                                    const vs = document.getElementById('pd-variant-summary');
                                    if (!vs) return '';
                                    const items = Array.from(vs.querySelectorAll('.vs-item strong'))
                                        .map(el => el.textContent.trim())
                                        .filter(Boolean);
                                    return items.length ? items.join(' / ') : '';
                                };
                                
                                const escapeHtml = (s) => String(s||'').replace(/[&<>"']/g, m=>({
                                    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
                                }[m]));
                                
                                const variantText = getVariantSummaryText();
                                const skuText = (function(){ 
                                    const el = document.getElementById('pd-sku'); 
                                    return el ? el.textContent.trim() : (window.PD_SKU || 'N/A'); 
                                })();
                                const productName = window.PD_NAME || 'Product';
                                
                                window.showToast({
                                    type: 'success',
                                    title: 'Berhasil ditambahkan ke Keranjang',
                                    message: `<strong>${escapeHtml(productName)}</strong>${variantText ? ` Â· <em>${escapeHtml(variantText)}</em>` : ''}<br>SKU: ${escapeHtml(skuText)} Â· Qty: ${qty}`,
                                    duration: 5000,
                                    actions: [
                                        { 
                                            label: 'Lihat Keranjang', 
                                            onClick: () => { window.location.href = '/keranjang'; }
                                        },
                                        { 
                                            label: 'Lanjut Belanja', 
                                            variant: 'alt', 
                                            onClick: () => {} 
                                        }
                                    ]
                                });
                            } else {
                            }
                        }, 100); // Small delay to ensure cart operation completes first
                        
                    } else if (action === 'buy') {
                        // For mobile buy, call buyNow
                        if (typeof window.buyNow === 'function') {
                            window.buyNow();
                        }
                    }
                } else {
                    // Stock validation FAILED - absolutely NO cart function calls allowed
                    
                    // DO NOT CALL ANY CART FUNCTIONS - only show modal (already handled by validateBeforeCart)
                }
                
                // Always restore functions after validation (success or failure)
                setTimeout(() => {
                    // Remove blocking flag
                    if (window.addToCart && typeof window.addToCart === 'function') {
                        window.addToCart._stockValidatorBlocked = false;
                    }
                    
                    // Restore other functions
                    if (originalAddToCartSubmit && typeof originalAddToCartSubmit === 'function') {
                        window.addToCartSubmit = originalAddToCartSubmit;
                    }
                    if (originalPdAddToCartSubmit && typeof originalPdAddToCartSubmit === 'function') {
                        window._pdAddToCartSubmit = originalPdAddToCartSubmit;
                    }
                    
                }, 1000); // Shorter timeout since we want to restore quickly after success
            })
            .catch(error => {
                // On error, also block the action
            })
            .finally(() => {
                // Remove loading state
                button.classList.remove(config.loadingClass);
                button.disabled = originalDisabled;
                button.textContent = originalText;
            });

        return false;
    }

    /**
     * Intercept cart buttons
     */
    function interceptCartButtons() {

        
        // CRITICAL: Remove existing mobile cart handlers from product-detail.php
        setTimeout(() => {
            const mobileCartBtn = document.getElementById('mf-cart');
            if (mobileCartBtn) {
                // Clone the button to remove ALL existing event listeners
                const newBtn = mobileCartBtn.cloneNode(true);
                mobileCartBtn.parentNode.replaceChild(newBtn, mobileCartBtn);

                
                // Add our own handler to the new button
                newBtn.addEventListener('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    handleMobileButtonClick(event, 'cart');
                    return false;
                }, true);
            }
        }, 50);
        
        // Note: Add to cart buttons are now handled via form submission override (addToCartSubmit)
        // This provides better integration with existing pd-addtocart.js toast system

        // Buy now buttons - updated selectors (desktop + mobile)
        addEventListener(document, 'click', function(event) {
            const target = event.target;
            
            // Desktop buy buttons
            if (target.classList.contains('btn-buy') ||           // Product detail buy button
                target.classList.contains('btn-buy-now') || 
                target.classList.contains('buy-now-btn') || 
                target.id === 'btn-buy' ||                        // Specific ID match
                getDataAttribute(target, 'action') === 'buy-now' ||
                getDataAttribute(target, 'action') === 'buy') {
                
                handleButtonClick(event, 'buy');
            }
            
            // Mobile buy buttons
            else if (target.classList.contains('mf-buy') ||       // Mobile fab buy button
                     target.id === 'mf-buy') {                   // Mobile buy button ID
                
                handleMobileButtonClick(event, 'buy');
            }
            
            // Mobile cart buttons - ENHANCED BLOCKING
            else if (target.classList.contains('mf-cart') ||      // Mobile fab cart button
                     target.id === 'mf-cart') {                  // Mobile cart button ID
                
                
                // Immediately prevent all event propagation
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                handleMobileButtonClick(event, 'cart');
                
                // Return false to ensure no other handlers run
                return false;
            }
        }, true); // Use capturing phase to ensure we intercept before other handlers
        
        // Additional protection: Override addToCart function to add mobile button state checking
        const originalAddToCart = typeof window.addToCart === 'function' ? window.addToCart : null;
        if (originalAddToCart) {
            window.addToCart = async function(...args) {
                // Check if this call is coming from a mobile button that's currently being validated
                const mobileCartBtn = document.getElementById('mf-cart');
                if (mobileCartBtn && mobileCartBtn.classList.contains('loading-stock')) {
                    return Promise.reject(new Error('Mobile validation in progress - cart action blocked'));
                }
                
                // Check if functions are temporarily blocked (during stock failure)
                if (window.addToCart._stockValidatorBlocked) {
                    return Promise.reject(new Error('Stock validation failed - cart action blocked'));
                }
                
                // Allow normal calls
                return originalAddToCart.apply(this, args);
            };
            
            // Store reference to original for restoration
            window.addToCart._original = originalAddToCart;
        }
    }

    /**
     * Setup global click interceptor for security
     * This catches ALL clicks on cart/buy buttons and validates stock BEFORE any other handler
     */
    function setupGlobalClickInterceptor() {
        // Add capture-phase listener to catch clicks before other handlers
        document.addEventListener('click', function(event) {
            const target = event.target;
            
            // Check if this is a cart/buy button
            const isCartButton = target.matches('.btn-add-cart, .mf-cart, #mf-cart, #btn-add-cart') ||
                                target.closest('.btn-add-cart, .mf-cart, #mf-cart, #btn-add-cart');
            const isBuyButton = target.matches('.btn-buy-now, .mf-buy, #mf-buy, #btn-buy') ||
                               target.closest('.btn-buy-now, .mf-buy, #mf-buy, #btn-buy');
                               
            if (!isCartButton && !isBuyButton) {
                return; // Not our target, allow normal processing
            }
            
            const button = isCartButton ? 
                (target.matches('.btn-add-cart, .mf-cart, #mf-cart, #btn-add-cart') ? target : target.closest('.btn-add-cart, .mf-cart, #mf-cart, #btn-add-cart')) :
                (target.matches('.btn-buy-now, .mf-buy, #mf-buy, #btn-buy') ? target : target.closest('.btn-buy-now, .mf-buy, #mf-buy, #btn-buy'));
            
            // IMMEDIATE BLOCK: Prevent any processing first
            event.preventDefault();
            event.stopImmediatePropagation();
            
            // SECURITY CHECK 1: Is button marked as stock-blocked?
            if (button && button.hasAttribute('data-stock-blocked')) {
                
                const reason = button.getAttribute('data-stock-reason') || 'Stok tidak tersedia';
                showStockModal(reason);
                
                // Show security alert
                if (window.showToast) {
                    window.showToast({
                        type: 'error',
                        title: 'Aksi Diblokir',
                        message: 'Produk ini sedang habis stok dan tidak dapat ditambahkan ke keranjang.',
                        duration: 4000
                    });
                }
                
                return false;
            }
            
            // SECURITY CHECK 2: Real-time validation against cached stock info
            if (window._currentStockInfo && !window._currentStockInfo.can_add_to_cart) {
                
                showStockModal(window._currentStockInfo.message || 'Stok tidak tersedia');
                
                // Re-enforce button disabling
                if (button) {
                    button.disabled = true;
                    button.style.opacity = '0.5';
                    button.style.cursor = 'not-allowed';
                    button.setAttribute('data-stock-blocked', 'true');
                    button.setAttribute('data-stock-reason', window._currentStockInfo.message || 'Stok tidak tersedia');
                }
                
                return false;
            }
            
            // SECURITY CHECK 3: Smart client-side validation
            const productId = window.PD_ID ? parseInt(window.PD_ID) : 0;
            const variantSelector = document.getElementById('pd-variant-id');
            const variantId = variantSelector ? parseInt(variantSelector.value || 0) : 0;
            
            if (productId > 0) {
                // SMART VALIDATION: If we already have cached stock info showing stock is available,
                // and buttons are enabled, proceed immediately without re-validation
                if (window._currentStockInfo && window._currentStockInfo.can_add_to_cart && 
                    button && !button.disabled && !button.hasAttribute('data-stock-blocked')) {
                    
                    // Allow the action to proceed immediately with toast
                    if (isCartButton) {
                        // Trigger cart action with proper toast handling
                        if (typeof window._pdAddToCartSubmit === 'function') {
                            // Use pd-addtocart.js function for proper toast handling
                            const form = document.getElementById('pd-buy-form') || button.closest('form');
                            if (form) {
                                const fakeEvent = { 
                                    target: form,
                                    preventDefault: () => {}
                                };
                                window._pdAddToCartSubmit(fakeEvent, productId);
                            }
                        } else if (typeof window.addToCartSubmit === 'function') {
                            // Fallback to addToCartSubmit
                            const form = document.getElementById('pd-buy-form') || button.closest('form');
                            if (form) {
                                const fakeEvent = { 
                                    target: form,
                                    preventDefault: () => {}
                                };
                                window.addToCartSubmit(fakeEvent, productId);
                            }
                        } else if (typeof window.addToCart === 'function') {
                            // Direct addToCart call
                            window.addToCart(productId, 1, variantId);
                        }
                    } else if (isBuyButton) {
                        // Trigger buy action
                        if (typeof window.buyNow === 'function') {
                            window.buyNow();
                        }
                    }
                    
                    return false; // Action completed
                }
                
                // Get stock info from embedded variant data (for variant products)
                const stockInfo = getStockFromEmbeddedData(variantId);
                
                if (stockInfo && stockInfo.hasStock) {
                    
                    // Update global stock cache
                    window._currentStockInfo = {
                        can_add_to_cart: true,
                        is_in_stock: true,
                        available_stock: stockInfo.stock,
                        message: 'Stok tersedia'
                    };
                    
                    // IMPORTANT: Check if button was explicitly blocked by variant logic (e.g., pre-order exhausted)
                    // If data-stock-blocked is set, respect it and don't enable the button
                    const isExplicitlyBlocked = button.getAttribute('data-stock-blocked') === 'true';
                    
                    if (!isExplicitlyBlocked) {
                        // Remove stock blocking if it was set and enable button
                        button.removeAttribute('data-stock-blocked');
                        button.removeAttribute('data-stock-reason');
                        button.disabled = false;
                        button.style.opacity = '';
                        button.style.cursor = '';
                        button.classList.remove(config.disabledClass);
                    } else {
                        // Button is blocked by variant logic, show reason
                        const reason = button.getAttribute('data-stock-reason') || 'Tidak tersedia';
                        console.log('Button blocked by variant logic:', reason);
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                    
                    // Allow the action to proceed immediately with toast
                    if (isCartButton) {
                        // Trigger cart action with proper toast handling
                        if (typeof window._pdAddToCartSubmit === 'function') {
                            // Use pd-addtocart.js function for proper toast handling
                            const form = document.getElementById('pd-buy-form') || button.closest('form');
                            if (form) {
                                const fakeEvent = { 
                                    target: form,
                                    preventDefault: () => {}
                                };
                                window._pdAddToCartSubmit(fakeEvent, productId);
                            }
                        } else if (typeof window.addToCartSubmit === 'function') {
                            // Fallback to addToCartSubmit
                            const form = document.getElementById('pd-buy-form') || button.closest('form');
                            if (form) {
                                const fakeEvent = { 
                                    target: form,
                                    preventDefault: () => {}
                                };
                                window.addToCartSubmit(fakeEvent, productId);
                            }
                        } else if (typeof window.addToCart === 'function') {
                            // Direct addToCart call
                            window.addToCart(productId, 1, variantId);
                        }
                    } else if (isBuyButton) {
                        // Trigger buy action
                        if (typeof window.buyNow === 'function') {
                            window.buyNow();
                        }
                    }
                } else if (stockInfo && !stockInfo.hasStock) {
                    
                    // Update global stock cache
                    window._currentStockInfo = {
                        can_add_to_cart: false,
                        is_in_stock: false,
                        available_stock: stockInfo.stock,
                        message: `Stok tidak tersedia${stockInfo.sku ? ` untuk ${stockInfo.sku}` : ''}`
                    };
                    
                    // Force block button
                    button.disabled = true;
                    button.style.opacity = '0.5';
                    button.style.cursor = 'not-allowed';
                    button.setAttribute('data-stock-blocked', 'true');
                    button.setAttribute('data-stock-reason', window._currentStockInfo.message);
                    
                    // Show modal with variant info
                    const modalMessage = stockInfo ? 
                        `Varian yang dipilih (${stockInfo.sku}) sedang habis stok. Silakan pilih varian lain.` :
                        'Produk ini sedang habis stok. Silakan pilih varian lain.';
                    
                    showStockModal(modalMessage);
                    
                    // Show security warning
                    if (window.showToast) {
                        window.showToast({
                            type: 'warning',
                            title: 'Stok Tidak Tersedia',
                            message: 'Varian yang dipilih sedang habis stok. Silakan pilih varian lain.',
                            duration: 3000
                        });
                    }
                } else {
                    // stockInfo is null (simple product) - this means embedded data is not available
                    // For simple products, if buttons are enabled, we should proceed (trust the API response from updateStockDisplay)
                    if (button && !button.disabled && !button.hasAttribute('data-stock-blocked')) {
                        
                        // Allow the action to proceed immediately with toast
                        if (isCartButton) {
                            // Trigger cart action with proper toast handling
                            if (typeof window._pdAddToCartSubmit === 'function') {
                                // Use pd-addtocart.js function for proper toast handling
                                const form = document.getElementById('pd-buy-form') || button.closest('form');
                                if (form) {
                                    const fakeEvent = { 
                                        target: form,
                                        preventDefault: () => {}
                                    };
                                    window._pdAddToCartSubmit(fakeEvent, productId);
                                }
                            } else if (typeof window.addToCartSubmit === 'function') {
                                // Fallback to addToCartSubmit
                                const form = document.getElementById('pd-buy-form') || button.closest('form');
                                if (form) {
                                    const fakeEvent = { 
                                        target: form,
                                        preventDefault: () => {}
                                    };
                                    window.addToCartSubmit(fakeEvent, productId);
                                }
                            } else if (typeof window.addToCart === 'function') {
                                // Direct addToCart call
                                window.addToCart(productId, 1, variantId);
                            }
                        } else if (isBuyButton) {
                            // Trigger buy action
                            if (typeof window.buyNow === 'function') {
                                window.buyNow();
                            }
                        }
                    } else {
                        // Button is disabled, don't allow action
                        showStockModal('Produk ini sedang tidak tersedia.');
                    }
                }
            } else {
                // No product ID, block action
                showStockModal('Data produk tidak valid.');
            }
            
            return false; // Always block at capture phase
            
        }, true); // Use capture phase to run BEFORE other listeners
        

    }

    /**
     * Initialize button data attributes from current page
     */
    function initializeButtonAttributes() {
        // Get product data from page globals or form
        let productId = 0, variantId = 0;
        
        // Try to get from global variables (set by PHP)
        if (window.PD_ID) productId = parseInt(window.PD_ID);
        
        // Try to get from form
        const form = document.getElementById('pd-buy-form');
        if (form) {
            const pidAttr = form.getAttribute('data-pid');
            if (pidAttr) productId = parseInt(pidAttr);
            
            const varInput = document.getElementById('pd-variant-id');
            if (varInput) variantId = parseInt(varInput.value || 0);
        }
        
        // Try to get from mobile FAB
        const mobileFab = document.getElementById('pd-mobile-fab');
        if (mobileFab && productId <= 0) {
            const pidAttr = getDataAttribute(mobileFab, 'pid');
            if (pidAttr) productId = parseInt(pidAttr);
        }
        
        // Set attributes on desktop buttons
        const desktopButtons = document.querySelectorAll('.btn-add-cart, .btn-buy-now, #btn-add-cart, #btn-buy, #btn-buy-voucher');
        desktopButtons.forEach(button => {
            if (productId > 0) {
                button.setAttribute('data-product-id', productId);
                if (variantId > 0) {
                    button.setAttribute('data-variant-id', variantId);
                }
            }
        });
        
        // Set attributes on mobile buttons
        const mobileButtons = document.querySelectorAll('.mf-cart, .mf-buy, #mf-cart, #mf-buy');
        mobileButtons.forEach(button => {
            if (productId > 0) {
                button.setAttribute('data-product-id', productId);
                if (variantId > 0) {
                    button.setAttribute('data-variant-id', variantId);
                }
            }
        });
        

        
        // Initial stock display update on page load
        if (productId > 0) {
            setTimeout(() => {
                updateStockDisplay(productId, variantId);

            }, 100);
        }
    }

    /**
     * Update button attributes when variant changes
     */
    function updateButtonAttributesForVariant(variantId) {
        const productId = window.PD_ID ? parseInt(window.PD_ID) : 0;
        
        if (productId <= 0) return;
        
        // Update desktop buttons
        const desktopButtons = document.querySelectorAll('.btn-add-cart, .btn-buy-now, #btn-add-cart, #btn-buy, #btn-buy-voucher');
        desktopButtons.forEach(button => {
            button.setAttribute('data-product-id', productId);
            if (variantId > 0) {
                button.setAttribute('data-variant-id', variantId);
            } else {
                button.removeAttribute('data-variant-id');
            }
        });
        
        // Update mobile buttons
        const mobileButtons = document.querySelectorAll('.mf-cart, .mf-buy, #mf-cart, #mf-buy');
        mobileButtons.forEach(button => {
            button.setAttribute('data-product-id', productId);
            if (variantId > 0) {
                button.setAttribute('data-variant-id', variantId);
            } else {
                button.removeAttribute('data-variant-id');
            }
        });
        

    }

    /**
     * Setup variant change integration with existing product-detail.php handlers
     */
    function setupVariantChangeIntegration() {
        // Strategy: Hook into existing applyVariant function instead of adding new listener
        // This prevents conflicts with existing variant change functionality (gallery, pricing, etc.)
        
        // Method 1: Hook into existing applyVariant function
        setTimeout(() => {
            if (typeof window.applyVariant === 'function') {
                const originalApplyVariant = window.applyVariant;
                window.applyVariant = function(v, focusImage) {
                    // Call original function first
                    const result = originalApplyVariant.call(this, v, focusImage);
                    
                // Then add our stock validator logic
                const variantId = v ? (v.id || v.ID || 0) : 0;
                
                // Update button attributes for stock validator
                updateButtonAttributesForVariant(variantId);
                
                // Update stock display using embedded data (instant)
                const productId = window.PD_ID ? parseInt(window.PD_ID) : 0;
                if (productId > 0) {
                    updateStockDisplay(productId, variantId);
                }                    return result;
                };
                

            } else {

                setupVariantObserver();
            }
        }, 500);
        
        // Method 2: Direct observation of hidden input value changes (fallback)
        setTimeout(() => {
            setupVariantObserver();
        }, 1000);
    }

    /**
     * Setup variant observer as fallback when applyVariant hook fails
     */
    function setupVariantObserver() {
        const variantInput = document.getElementById('pd-variant-id');
        if (variantInput) {
            let lastVariantId = parseInt(variantInput.value || '0');
            
            // Use MutationObserver to watch for value changes
            if (window.MutationObserver) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                            const newVariantId = parseInt(variantInput.value || '0');
                            if (newVariantId !== lastVariantId) {
                    
                                updateButtonAttributesForVariant(newVariantId);
                                
                                // Update stock display with embedded data
                                const productId = window.PD_ID ? parseInt(window.PD_ID) : 0;
                                if (productId > 0) {
                                    updateStockDisplay(productId, newVariantId);
                                }
                                
                                lastVariantId = newVariantId;
                            }
                        }
                    });
                });
                
                observer.observe(variantInput, { 
                    attributes: true, 
                    attributeFilter: ['value'] 
                });
                

            }
            
            // Additional polling as ultimate fallback
            setInterval(() => {
                const currentVariantId = parseInt(variantInput.value || '0');
                if (currentVariantId !== lastVariantId) {
        
                    updateButtonAttributesForVariant(currentVariantId);
                    
                    // Update stock display with embedded data
                    const productId = window.PD_ID ? parseInt(window.PD_ID) : 0;
                    if (productId > 0) {
                        updateStockDisplay(productId, currentVariantId);
                    }
                    
                    lastVariantId = currentVariantId;
                }
            }, 1000);
            

        }
    }

    /**
     * Update stock display and enforce stock-based button blocking using embedded data
     */
    function updateStockDisplay(productId, variantId = 0) {

        
        // Get stock info from embedded data (instant)
        const embeddedStockInfo = getStockFromEmbeddedData(variantId);
        
        let stockInfo;
        if (embeddedStockInfo) {
            // Convert embedded data to standard format
            stockInfo = {
                can_add_to_cart: embeddedStockInfo.hasStock,
                is_in_stock: embeddedStockInfo.hasStock,
                available_stock: embeddedStockInfo.stock,
                message: embeddedStockInfo.hasStock ? 'Stok tersedia' : `Stok habis${embeddedStockInfo.sku ? ` untuk ${embeddedStockInfo.sku}` : ''}`,
                product_name: window.PD_NAME || 'Produk',
                sku: embeddedStockInfo.sku
            };
            

        } else {
            // Fallback to API call if embedded data not available

            checkStock(productId, variantId, 1)
                .then(apiStockInfo => {
                    updateStockDisplayWithInfo(apiStockInfo, productId, variantId);
                })
                .catch(error => {
                    console.error('Failed to update stock display via API:', error);
                });
            return;
        }
        
        updateStockDisplayWithInfo(stockInfo, productId, variantId);
    }

    /**
     * Update stock display with provided stock info
     */
    function updateStockDisplayWithInfo(stockInfo, productId, variantId) {
        // Store current stock status globally for blocking checks
        window._currentStockInfo = stockInfo;
        
        // Update stock indicators
        const stockIndicators = document.querySelectorAll('.stock-indicator');
        stockIndicators.forEach(indicator => {
            if (stockInfo.is_in_stock) {
                indicator.classList.add('in-stock');
                indicator.classList.remove('out-of-stock');
            } else {
                indicator.classList.add('out-of-stock');
                indicator.classList.remove('in-stock');
            }
        });
        
        // Update stock count
        const stockCounts = document.querySelectorAll('.stock-count');
        stockCounts.forEach(count => {
            count.textContent = stockInfo.available_stock || 0;
        });
        
        // CRITICAL: For digital products, DO NOT modify button states here
        // PHP already handles button disable/enable based on LICENSE_POOL count
        // Only physical products need JavaScript stock validation
        const isDigitalProduct = window.IS_DIGITAL === true || window.IS_DIGITAL === 'true';
        
        if (isDigitalProduct) {
            // For digital products: ONLY update global stock info, don't touch buttons
            // Let PHP-rendered disabled state remain authoritative
            console.log('[Stock Validator] Digital product detected - skipping button state modification');
            return; // Exit early, preserve PHP-set button states
        }
        
        // ENHANCED: Force disable buttons for out-of-stock with anti-tampering (PHYSICAL PRODUCTS ONLY)
        const allButtons = document.querySelectorAll('.btn-add-cart, .btn-buy-now, .mf-cart, .mf-buy, #btn-add-cart, #btn-buy, #btn-buy-voucher, #mf-cart, #mf-buy');
        allButtons.forEach(button => {
            if (stockInfo.can_add_to_cart) {
                // STOCK AVAILABLE - ENABLE BUTTONS
                button.classList.remove(config.disabledClass);
                button.disabled = false;
                button.style.opacity = '';
                button.style.cursor = '';
                
                // CRITICAL: Remove stock blocking attributes when stock becomes available
                button.removeAttribute('data-stock-blocked');
                button.removeAttribute('data-stock-reason');
                

            } else {
                // OUT OF STOCK - FORCE DISABLE WITH ANTI-TAMPERING
                button.classList.add(config.disabledClass);
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
                
                // Mark as stock-blocked to prevent re-enabling
                button.setAttribute('data-stock-blocked', 'true');
                button.setAttribute('data-stock-reason', stockInfo.message || 'Stok tidak tersedia');
                

            }
        });
        
        // Start aggressive button monitoring for out-of-stock variants
        if (!stockInfo.can_add_to_cart) {
            enforceStockDisabling(productId, variantId);
        }
        

    }

    /**
     * Aggressively enforce button disabling for out-of-stock items
     * CRITICAL: For digital products, DO NOT modify button states (PHP is authoritative)
     */
    function enforceStockDisabling(productId, variantId) {
        // CRITICAL: Skip enforcement for digital products - PHP handles button states
        const isDigitalProduct = window.IS_DIGITAL === true || window.IS_DIGITAL === 'true';
        if (isDigitalProduct) {
            console.log('[Stock Validator] Digital product - skipping button enforcement');
            return; // Exit early, let PHP-rendered disabled state remain
        }
        
        const monitorInterval = setInterval(() => {
            // Check if variant changed
            const currentVariantSelector = document.getElementById('pd-variant-id');
            const currentVariantId = currentVariantSelector ? parseInt(currentVariantSelector.value || 0) : 0;
            
            if (currentVariantId !== variantId) {
                // Variant changed, stop monitoring this variant
                clearInterval(monitorInterval);

                return;
            }
            
            // Check current stock status using embedded data (real-time check)
            const currentStockInfo = getStockFromEmbeddedData(currentVariantId);
            
            if (currentStockInfo && !currentStockInfo.hasStock) {
                // Still out of stock - continue monitoring for tampering
                const buttons = document.querySelectorAll('.btn-add-cart, .btn-buy-now, .mf-cart, .mf-buy, #btn-add-cart, #btn-buy, #btn-buy-voucher, #mf-cart, #mf-buy');
                buttons.forEach(button => {
                    // Check if button was manually enabled (inspect attack)
                    if (!button.disabled || button.style.opacity !== '0.5') {
                        
                        // Force re-disable
                        button.disabled = true;
                        button.style.opacity = '0.5';
                        button.style.cursor = 'not-allowed';
                        button.setAttribute('data-stock-blocked', 'true');
                        button.setAttribute('data-stock-reason', `Stok tidak tersedia${currentStockInfo.sku ? ` untuk ${currentStockInfo.sku}` : ''}`);
                        
                        // Show warning toast
                        if (window.showToast) {
                            window.showToast({
                                type: 'warning',
                                title: 'Aksi Tidak Diizinkan',
                                message: 'Produk ini sedang habis stok. Silakan pilih varian lain.',
                                duration: 3000
                            });
                        }
                    }
                });
            } else {
                // Stock available OR embedded data shows stock - stop monitoring
                clearInterval(monitorInterval);

                // For PHYSICAL products only, enable buttons
                // For DIGITAL products, skip (PHP is authoritative)
                const isDigitalProduct = window.IS_DIGITAL === true || window.IS_DIGITAL === 'true';
                
                if (!isDigitalProduct && currentStockInfo && currentStockInfo.hasStock) {
                    const buttons = document.querySelectorAll('.btn-add-cart, .btn-buy-now, .mf-cart, .mf-buy, #btn-add-cart, #btn-buy, #btn-buy-voucher, #mf-cart, #mf-buy');
                    buttons.forEach(button => {
                        button.disabled = false;
                        button.style.opacity = '';
                        button.style.cursor = '';
                        button.removeAttribute('data-stock-blocked');
                        button.removeAttribute('data-stock-reason');
                        button.classList.remove(config.disabledClass);
                    });

                }
            }
        }, 500); // Check every 500ms for tampering attempts
        
        // Auto-stop monitoring after 30 seconds to prevent memory leaks
        setTimeout(() => {
            clearInterval(monitorInterval);

        }, 30000);
    }

    /**
     * Override addToCartSubmit function to add stock validation
     * This function now works with pd-addtocart.js integration
     */
    function overrideAddToCartSubmitFunction() {
        // Check if pd-addtocart.js is already loaded
        const pdAddToCartExists = typeof window.addToCartSubmit === 'function' && 
                                  window.addToCartSubmit.toString().includes('showToast');
        
        if (pdAddToCartExists) {

            
            // Store the pd-addtocart.js function
            const pdAddToCartSubmit = window.addToCartSubmit;
            window._pdAddToCartSubmit = pdAddToCartSubmit;
            
            // Override with stock validation that calls pd-addtocart.js
            window.addToCartSubmit = async function(e, productId) {
                
                // Don't prevent default here - let pd-addtocart handle it if stock is valid
                
                try {
                    // Extract product data from form (same way as pd-addtocart.js)
                    const form = e.target;
                    const qty = parseInt(form.querySelector('[name=qty]')?.value || '1', 10) || 1;
                    
                    // CRITICAL: Always get current variant from selector (real-time)
                    let variantId = 0;
                    const variantSelector = document.getElementById('pd-variant-id');
                    if (variantSelector) {
                        variantId = parseInt(variantSelector.value || '0', 10) || 0;
                    }
                    
                    if (!productId || productId <= 0) {
                        return pdAddToCartSubmit(e, productId);
                    }


                    // Validate stock before proceeding
                    const isValid = await validateBeforeCart(productId, variantId, qty, 'cart');
                    
                    if (isValid) {
                        // Stock OK, call pd-addtocart.js function (it will handle toast)
                        return pdAddToCartSubmit(e, productId);
                    } else {
                        // Prevent the form submission
                        e.preventDefault();
                        // Stock validation failed, modal already shown by validateBeforeCart
                        return false;
                    }
                    
                } catch (error) {
                    e.preventDefault();
                    // On error, show modal and don't proceed
                    showStockModal({ 
                        message: 'Terjadi kesalahan saat memvalidasi stok. Silakan coba lagi.',
                        is_active: false 
                    }, 'cart');
                    return false;
                }
            };
        } else {
            // Original logic for when pd-addtocart.js is not present
            const originalAddToCartSubmit = typeof window.addToCartSubmit === 'function' ? window.addToCartSubmit : null;
            
            if (originalAddToCartSubmit) {
                window._originalAddToCartSubmit = originalAddToCartSubmit;
            }
            
            // Override with stock validation
            window.addToCartSubmit = async function(e, productId) {
                
                e.preventDefault();
                
                try {
                    const form = e.target;
                    const qty = parseInt(form.querySelector('[name=qty]')?.value || '1', 10) || 1;
                    
                    // CRITICAL: Always get current variant from selector (real-time)
                    let variantId = 0;
                    const variantSelector = document.getElementById('pd-variant-id');
                    if (variantSelector) {
                        variantId = parseInt(variantSelector.value || '0', 10) || 0;
                    }
                    
                    if (!productId || productId <= 0) {
                        if (originalAddToCartSubmit) return originalAddToCartSubmit(e, productId);
                        return false;
                    }


                    const isValid = await validateBeforeCart(productId, variantId, qty, 'cart');
                    
                    if (isValid) {
                        if (originalAddToCartSubmit) {
                            return originalAddToCartSubmit(e, productId);
                        } else {
                            if (typeof window.addToCart === 'function') {
                                await window.addToCart(productId, qty, variantId);
                            }
                        }
                    } else {
                    }
                    
                } catch (error) {
                    showStockModal({ 
                        message: 'Terjadi kesalahan saat memvalidasi stok. Silakan coba lagi.',
                        is_active: false 
                    }, 'cart');
                }
                
                return false;
            };
        }


    }

    /**
     * Override buyNow function to add stock validation
     */
    function overrideBuyNowFunction() {
        // Store original buyNow function if it exists
        const originalBuyNow = typeof window.buyNow === 'function' ? window.buyNow : null;
        
        // Override with stock validation
        window.buyNow = async function(e) {
            
            try {
                // Get product data (same way as pd-buynow.js)
                const form = document.getElementById('pd-buy-form');
                if (!form) {
                    if (originalBuyNow) return originalBuyNow(e);
                    return;
                }

                const productId = parseInt(form.dataset.pid || '0', 10);
                const qty = parseInt(form.querySelector('[name=qty]')?.value || '1', 10) || 1;
                
                // CRITICAL: Always get current variant from selector (real-time)
                let variantId = 0;
                const variantSelector = document.getElementById('pd-variant-id');
                if (variantSelector) {
                    variantId = parseInt(variantSelector.value || '0', 10) || 0;
                }
                
                if (!productId || productId <= 0) {
                    if (originalBuyNow) return originalBuyNow(e);
                    return;
                }


                // Validate stock before proceeding
                const isValid = await validateBeforeCart(productId, variantId, qty, 'buy');
                
                if (isValid) {
                    // Stock OK, call original buyNow function
                    if (originalBuyNow) {
                        return originalBuyNow(e);
                    } else {
                    }
                } else {
                    // Stock validation failed, modal already shown by validateBeforeCart
                }
                
            } catch (error) {
                // On error, show modal and don't proceed
                showStockModal({ 
                    message: 'Terjadi kesalahan saat memvalidasi stok. Silakan coba lagi.',
                    is_active: false 
                }, 'buy');
            }
        };


    }

    /**
     * Initialize stock validation
     */
    function init() {
        // Wait for DOM ready
        if (document.readyState === 'loading') {
            addEventListener(document, 'DOMContentLoaded', function() {
        initializeButtonAttributes();
        setupVariantChangeIntegration(); // Setup variant change integration
        interceptCartButtons();
        setupGlobalClickInterceptor(); // Setup global click security interceptor                // Override functions after other scripts load
                // Use multiple timeouts to catch late-loading scripts like pd-addtocart.js
                setTimeout(() => {
                    overrideAddToCartSubmitFunction();
                    overrideBuyNowFunction();
                }, 100);
                
                setTimeout(() => {
                    // Re-check and re-override if pd-addtocart.js loaded later
                    overrideAddToCartSubmitFunction();
                }, 500);
                
                setTimeout(() => {
                    // Final check for very late loading scripts
                    overrideAddToCartSubmitFunction();
                }, 1000);
                

            });
        } else {
            initializeButtonAttributes();
            setupVariantChangeIntegration(); // Setup variant change integration
            interceptCartButtons();
            setupGlobalClickInterceptor(); // Setup global click security interceptor
            
            // Override functions after other scripts load
            // Use multiple timeouts to catch late-loading scripts like pd-addtocart.js
            setTimeout(() => {
                overrideAddToCartSubmitFunction();
                overrideBuyNowFunction();
            }, 100);
            
            setTimeout(() => {
                // Re-check and re-override if pd-addtocart.js loaded later
                overrideAddToCartSubmitFunction();
            }, 500);
            
            setTimeout(() => {
                // Final check for very late loading scripts
                overrideAddToCartSubmitFunction();
            }, 1000);
            

        }
    }

    // Public API
    return {
        init: init,
        checkStock: checkStock,
        validateBeforeCart: validateBeforeCart,
        updateStockDisplay: updateStockDisplay,
        showStockModal: showStockModal,
        config: config
    };
})();

// Auto-initialize
if (typeof window !== 'undefined') {
    StockValidator.init();
}