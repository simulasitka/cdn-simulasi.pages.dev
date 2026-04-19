/**
 * Review Submission Modal & Handler
 * Handles review form display, validation, and submission
 */

(function() {
    'use strict';

    let currentProductId = null;
    let currentOrderId = null;
    let selectedRating = 0;
    let uploadedImages = [];

    // Get CSRF token from meta tag
    function getCsrfToken() {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : '';
    }

    // Initialize
    function init() {
        createReviewModal();
        attachEventListeners();
        loadReviewableOrders();
    }

    // Create review modal HTML
    function createReviewModal() {
        const modalHTML = `
            <div class="modal-overlay" id="review-modal-overlay" style="display:none;">
                <div class="modal-content review-modal">
                    <div class="modal-header">
                        <h3 class="modal-title">Tulis Ulasan</h3>
                        <button type="button" class="modal-close" id="review-modal-close" aria-label="Tutup">
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <form id="review-form" class="review-form">
                            <!-- Product Info -->
                            <div class="review-product-info" id="review-product-info">
                                <img id="review-product-image" src="" alt="" class="review-product-thumb">
                                <div class="review-product-details">
                                    <h4 id="review-product-name"></h4>
                                    <p id="review-product-sku"></p>
                                </div>
                            </div>

                            <!-- Rating -->
                            <div class="form-group">
                                <label class="form-label">Rating <span style="color:#ef4444;">*</span></label>
                                <div class="star-rating-input" id="star-rating-input">
                                    <button type="button" class="star-btn" data-rating="1">★</button>
                                    <button type="button" class="star-btn" data-rating="2">★</button>
                                    <button type="button" class="star-btn" data-rating="3">★</button>
                                    <button type="button" class="star-btn" data-rating="4">★</button>
                                    <button type="button" class="star-btn" data-rating="5">★</button>
                                </div>
                                <p class="rating-label" id="rating-label">Pilih rating Anda</p>
                            </div>

                            <!-- Review Text -->
                            <div class="form-group">
                                <label class="form-label" for="review-text">Ulasan Anda <span style="color:#ef4444;">*</span></label>
                                <textarea 
                                    id="review-text" 
                                    name="review_text"
                                    class="form-control" 
                                    rows="6" 
                                    placeholder="Ceritakan pengalaman Anda dengan produk ini..."
                                    minlength="20"
                                    maxlength="5000"
                                    required></textarea>
                                <p class="form-hint">
                                    <span id="review-char-count">0</span>/5000 karakter
                                    <span style="color:#059669;font-weight:500;">
                                        💰 +1,000 point untuk ulasan ≥ 100 karakter
                                    </span>
                                </p>
                            </div>

                            <!-- Image Upload -->
                            <div class="form-group">
                                <label class="form-label">Upload Foto (Opsional)</label>
                                <div class="image-upload-container">
                                    <input type="file" 
                                           id="review-images" 
                                           name="images[]" 
                                           accept="image/jpeg,image/jpg,image/png,image/webp"
                                           multiple
                                           style="display:none;">
                                    <button type="button" class="btn-upload-trigger" id="upload-trigger">
                                        <svg width="24" height="24" viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
                                        </svg>
                                        <span>Pilih Foto</span>
                                    </button>
                                    <p class="form-hint">
                                        Max 5 foto, format JPG/PNG/WebP, max 2MB per foto
                                        <span style="color:#059669;font-weight:500;">
                                            💰 +2,000 point untuk ulasan dengan foto
                                        </span>
                                    </p>
                                </div>
                                <div class="image-preview-grid" id="image-preview-grid"></div>
                            </div>

                            <!-- Point Reward Info -->
                            <div class="point-reward-info">
                                <div class="pri-header">
                                    <span>🎁</span>
                                    <span>Dapatkan Point Reward</span>
                                </div>
                                <ul class="pri-list">
                                    <li>✅ Ulasan dasar: <strong>5,000 point</strong></li>
                                    <li id="pri-long-text" style="opacity:0.5;">📝 Ulasan panjang (≥100 kata): <strong>+1,000 point</strong></li>
                                    <li id="pri-images" style="opacity:0.5;">📸 Dengan foto: <strong>+2,000 point</strong></li>
                                </ul>
                                <div class="pri-total">
                                    Total Reward: <strong id="pri-total-points">5,000 point</strong>
                                </div>
                            </div>

                            <!-- Privacy Option -->
                            <div class="form-group" style="margin-top:20px;padding:15px;background:#f8fafc;border-radius:8px;">
                                <label class="checkbox-label" style="display:flex;align-items:center;cursor:pointer;margin:0;">
                                    <input type="checkbox" 
                                           id="review-anonymous" 
                                           name="is_anonymous"
                                           style="margin-right:8px;width:18px;height:18px;cursor:pointer;">
                                    <span style="font-size:14px;">
                                        <strong>🔒 Sembunyikan nama saya</strong>
                                        <span style="color:#64748b;display:block;font-size:13px;margin-top:4px;" id="review-anonymous-preview">
                                            Nama Anda akan ditampilkan dengan disamarkan untuk menjaga privasi
                                        </span>
                                    </span>
                                </label>
                            </div>

                            <!-- Error Alert -->
                            <div class="form-error" id="review-form-error" style="display:none;"></div>

                            <!-- Submit Buttons -->
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" id="review-cancel">Batal</button>
                                <button type="submit" class="btn btn-primary" id="review-submit">
                                    Kirim Ulasan
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Attach event listeners
    function attachEventListeners() {
        // Modal triggers - event delegation
        document.addEventListener('click', function(e) {
            const btn = e.target.closest('.btn-write-review');
            if (btn) {
                e.preventDefault();
                openReviewModal(
                    btn.dataset.productId,
                    btn.dataset.orderId,
                    btn.dataset.productName,
                    btn.dataset.productImage,
                    btn.dataset.productSku
                );
            }
        });

        // Close modal
        setTimeout(() => {
            const closeBtn = document.getElementById('review-modal-close');
            const cancelBtn = document.getElementById('review-cancel');
            const overlay = document.getElementById('review-modal-overlay');

            if (closeBtn) {
                closeBtn.addEventListener('click', closeReviewModal);
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', closeReviewModal);
            }
            if (overlay) {
                overlay.addEventListener('click', function(e) {
                    if (e.target === overlay) closeReviewModal();
                });
            }
        }, 100);

        // Star rating
        setTimeout(() => {
            const starButtons = document.querySelectorAll('.star-btn');
            starButtons.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const rating = parseInt(this.dataset.rating);
                    setRating(rating);
                });
            });
        }, 100);

        // Character count
        setTimeout(() => {
            const textarea = document.getElementById('review-text');
            if (textarea) {
                textarea.addEventListener('input', function() {
                    updateCharCount();
                    calculatePotentialPoints();
                });
            }
        }, 100);

        // Image upload
        setTimeout(() => {
            const uploadTrigger = document.getElementById('upload-trigger');
            const fileInput = document.getElementById('review-images');
            
            if (uploadTrigger && fileInput) {
                uploadTrigger.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', handleImageSelection);
            }
        }, 100);

        // Form submit
        setTimeout(() => {
            const form = document.getElementById('review-form');
            if (form) {
                form.addEventListener('submit', handleSubmit);
            }
        }, 100);
    }

    // Open review modal
    function openReviewModal(productId, orderId, productName, productImage, productSku) {
        const overlay = document.getElementById('review-modal-overlay');
        if (!overlay) {
            console.error('Modal overlay not found!');
            return;
        }
        
        currentProductId = productId;
        currentOrderId = orderId;
        selectedRating = 0;
        uploadedImages = [];

        // Set product info
        const nameEl = document.getElementById('review-product-name');
        const imageEl = document.getElementById('review-product-image');
        const skuEl = document.getElementById('review-product-sku');
        
        if (nameEl) nameEl.textContent = productName;
        if (imageEl) imageEl.src = productImage || '/assets/img/no-image.png';
        if (skuEl) skuEl.textContent = 'SKU: ' + productSku;

        // Update privacy preview with actual user name
        updatePrivacyPreview();

        // Reset form
        const form = document.getElementById('review-form');
        const previewGrid = document.getElementById('image-preview-grid');
        const errorEl = document.getElementById('review-form-error');
        
        if (form) form.reset();
        if (previewGrid) previewGrid.innerHTML = '';
        if (errorEl) errorEl.style.display = 'none';
        
        setRating(0);
        updateCharCount();
        calculatePotentialPoints();

        // Show modal
        overlay.style.display = 'flex';
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    // Close review modal
    function closeReviewModal() {
        const overlay = document.getElementById('review-modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 200); // Wait for fade animation
        }
        document.body.style.overflow = '';
    }

    // Set star rating
    function setRating(rating) {
        selectedRating = rating;
        const stars = document.querySelectorAll('.star-btn');
        const labels = ['', 'Sangat Buruk', 'Buruk', 'Cukup', 'Bagus', 'Sangat Bagus'];
        
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });

        document.getElementById('rating-label').textContent = labels[rating] || 'Pilih rating Anda';
    }

    // Update character count
    function updateCharCount() {
        const textarea = document.getElementById('review-text');
        const count = textarea.value.length;
        document.getElementById('review-char-count').textContent = count;
    }

    // Calculate potential points
    function calculatePotentialPoints() {
        const textarea = document.getElementById('review-text');
        if (!textarea) return;
        
        const charCount = textarea.value.trim().length;
        const hasImages = uploadedImages.length > 0;

        let totalPoints = 5000;
        let longTextActive = charCount >= 100;
        let imagesActive = hasImages;

        if (longTextActive) totalPoints += 1000;
        if (imagesActive) totalPoints += 2000;

        // Update UI
        const longTextEl = document.getElementById('pri-long-text');
        const imagesEl = document.getElementById('pri-images');
        const totalEl = document.getElementById('pri-total-points');
        
        if (longTextEl) longTextEl.style.opacity = longTextActive ? '1' : '0.5';
        if (imagesEl) imagesEl.style.opacity = imagesActive ? '1' : '0.5';
        if (totalEl) totalEl.textContent = totalPoints.toLocaleString('id-ID') + ' point';
    }

    // Handle image selection
    function handleImageSelection(e) {
        const files = Array.from(e.target.files);
        
        if (files.length > 5) {
            showError('Maksimal 5 foto yang dapat diupload');
            e.target.value = ''; // Reset input
            return;
        }

        uploadedImages = [];
        const previewGrid = document.getElementById('image-preview-grid');
        previewGrid.innerHTML = '';

        files.forEach((file, index) => {
            // Validate file type
            if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
                showError('Format file harus JPG, PNG, atau WebP');
                return;
            }

            // Validate file size (2MB)
            if (file.size > 2 * 1024 * 1024) {
                showError('Ukuran file maksimal 2MB');
                return;
            }

            uploadedImages.push(file);

            // Create preview
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewHTML = `
                    <div class="image-preview-item">
                        <img src="${e.target.result}" alt="Preview ${index + 1}">
                        <button type="button" class="remove-image" data-index="${index}" aria-label="Hapus">
                            <svg width="16" height="16" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                `;
                previewGrid.insertAdjacentHTML('beforeend', previewHTML);
            };
            reader.readAsDataURL(file);
        });

        calculatePotentialPoints();

        // Attach remove handlers
        setTimeout(() => {
            document.querySelectorAll('.remove-image').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = parseInt(this.dataset.index);
                    removeImage(index);
                });
            });
        }, 100);
    }

    // Remove image
    function removeImage(index) {
        uploadedImages.splice(index, 1);
        
        const previewGrid = document.getElementById('image-preview-grid');
        previewGrid.innerHTML = '';

        uploadedImages.forEach((file, idx) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewHTML = `
                    <div class="image-preview-item">
                        <img src="${e.target.result}" alt="Preview ${idx + 1}">
                        <button type="button" class="remove-image" data-index="${idx}" aria-label="Hapus">
                            <svg width="16" height="16" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                `;
                previewGrid.insertAdjacentHTML('beforeend', previewHTML);
            };
            reader.readAsDataURL(file);
        });

        calculatePotentialPoints();

        setTimeout(() => {
            document.querySelectorAll('.remove-image').forEach(btn => {
                btn.addEventListener('click', function() {
                    const idx = parseInt(this.dataset.index);
                    removeImage(idx);
                });
            });
        }, 100);
    }

    // Handle form submission
    async function handleSubmit(e) {
        e.preventDefault();

        // Validate
        if (selectedRating === 0) {
            showError('Silakan pilih rating terlebih dahulu');
            return;
        }

        const reviewText = document.getElementById('review-text').value.trim();
        if (reviewText.length < 20) {
            showError('Ulasan minimal 20 karakter');
            return;
        }

        const submitBtn = document.getElementById('review-submit');
        submitBtn.disabled = true;
        
        try {
            // Step 1: Upload images if any
            let imageUrls = [];
            if (uploadedImages.length > 0) {
                submitBtn.textContent = 'Mengupload foto...';
                imageUrls = await uploadImages();
                if (!imageUrls) {
                    // Upload failed
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Kirim Ulasan';
                    return;
                }
            }

            // Step 2: Submit review with image URLs
            submitBtn.textContent = 'Mengirim ulasan...';
            
            const payload = {
                csrf_token: getCsrfToken(),
                product_id: currentProductId,
                order_id: currentOrderId,
                rating: selectedRating,
                review_text: reviewText,
                is_anonymous: document.getElementById('review-anonymous').checked,
                images: imageUrls
            };

            const response = await fetch('/api/reviews/submit.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken()
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showSuccess(result.message || 'Ulasan berhasil dikirim!');
                closeReviewModal();
                
                // Refresh reviewable orders if on account page
                if (typeof loadReviewableOrders === 'function') {
                    setTimeout(loadReviewableOrders, 500);
                }
            } else {
                showError(result.message || 'Gagal mengirim ulasan');
            }
        } catch (error) {
            console.error('Submit error:', error);
            showError('Terjadi kesalahan saat mengirim ulasan');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Kirim Ulasan';
        }
    }

    /**
     * Upload images to server
     * @returns {Promise<Array|null>} Array of image URLs or null if failed
     */
    async function uploadImages() {
        if (uploadedImages.length === 0) {
            return [];
        }

        const formData = new FormData();
        uploadedImages.forEach(file => {
            formData.append('images[]', file);
        });

        try {
            const response = await fetch('/api/reviews/upload_images.php', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': getCsrfToken()
                },
                body: formData
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text);
                showError('Server error: Response bukan JSON. Cek browser console untuk detail.');
                return null;
            }

            const result = await response.json();

            if (result.success && result.images) {
                // Extract URLs from uploaded images
                return result.images.map(img => img.url);
            } else {
                showError(result.message || 'Gagal mengupload foto');
                return null;
            }
        } catch (error) {
            console.error('Upload images error:', error);
            showError('Terjadi kesalahan saat mengupload foto. Cek console untuk detail.');
            return null;
        }
    }

    // Load reviewable orders (for account page)
    async function loadReviewableOrders() {
        // Only run if on account/profile page
        const container = document.getElementById('reviewable-orders-list');
        const loading = document.getElementById('reviewable-orders-loading');
        const empty = document.getElementById('reviewable-orders-empty');
        
        if (!container) {
            return;
        }

        // Show loading
        if (loading) loading.style.display = 'block';
        if (empty) empty.style.display = 'none';
        container.innerHTML = '';

        try {
            const response = await fetch('/api/reviews/reviewable.php');
            const result = await response.json();

            if (loading) loading.style.display = 'none';

            if (result.success && result.data.length > 0) {
                renderReviewableOrders(result.data);
                if (empty) empty.style.display = 'none';
            } else {
                if (empty) empty.style.display = 'block';
            }
        } catch (error) {
            console.error('Load reviewable orders error:', error);
            if (loading) loading.style.display = 'none';
            if (empty) {
                empty.innerHTML = '<p>Gagal memuat data. Silakan refresh halaman.</p>';
                empty.style.display = 'block';
            }
        }
    }

    // Render reviewable orders
    function renderReviewableOrders(orders) {
        const container = document.getElementById('reviewable-orders-list');
        if (!container) return;

        let html = '';
        
        orders.forEach(order => {
            html += `
                <div class="reviewable-order-item">
                    <img src="${escapeHtml(order.product_image || '/assets/img/no-image.png')}" alt="${escapeHtml(order.product_name)}" class="roi-image">
                    <div class="roi-info">
                        <h4>${escapeHtml(order.product_name)}</h4>
                        <p class="roi-meta">Order: ${escapeHtml(order.order_number)}</p>
                        <p class="roi-meta">Dibeli: ${escapeHtml(order.order_date)}</p>
                    </div>
                    <button type="button" 
                            class="btn btn-primary btn-write-review"
                            data-product-id="${order.product_id}"
                            data-order-id="${order.order_id}"
                            data-product-name="${escapeHtml(order.product_name)}"
                            data-product-image="${escapeHtml(order.product_image || '')}"
                            data-product-sku="${escapeHtml(order.product_sku || '')}">
                        ✍️ Tulis Ulasan
                    </button>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    // Escape HTML for XSS protection
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show error
    function showError(message) {
        const errorEl = document.getElementById('review-form-error');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }

    // Show success
    function showSuccess(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast-notification success';
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#059669;color:white;padding:16px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;font-size:14px;font-weight:500;';
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Mask user name for privacy preview (like PHP maskReviewerName)
    function maskUserName(fullName) {
        if (!fullName || fullName.trim() === '') {
            return 'Anonymous';
        }
        
        const words = fullName.trim().split(/\s+/);
        const maskedWords = words.map(word => {
            const len = word.length;
            if (len <= 1) return word;
            return word.charAt(0) + '*'.repeat(len - 1);
        });
        
        return maskedWords.join(' ');
    }

    // Update privacy preview text with user's actual masked name
    function updatePrivacyPreview() {
        const previewEl = document.getElementById('review-anonymous-preview');
        if (!previewEl) return;
        
        const userName = window.userFullName || '';
        if (userName) {
            const maskedName = maskUserName(userName);
            previewEl.textContent = `Nama Anda akan ditampilkan sebagai "${maskedName}" untuk menjaga privasi`;
        } else {
            previewEl.textContent = 'Nama Anda akan ditampilkan dengan disamarkan untuk menjaga privasi';
        }
    }

    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export openReviewModal to global scope for use in other scripts
    window.openReviewModal = openReviewModal;

})();