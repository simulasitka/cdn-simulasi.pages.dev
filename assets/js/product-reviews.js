/**
 * Product Reviews - Frontend JavaScript
 * Handles review display, submission, and helpful voting
 */

const ProductReviews = (function() {
  'use strict';

  let currentPage = 1;
  let currentSort = 'helpful';
  let productId = null;
  let isLoading = false;

  /**
   * Public API: Initialize reviews for a product
   */
  function init(pid) {
    productId = pid;
    
    if (!productId) {
      console.warn('Product ID not provided to ProductReviews.init()');
      return;
    }

    initializeReviewTab();
    loadReviews();
  }

  /**
   * Initialize review tab functionality
   */
  function initializeReviewTab() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        switchTab(tabName);
      });
    });

    // Sort dropdown
    const sortSelect = document.getElementById('review-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        currentSort = this.value;
        currentPage = 1;
        loadReviews();
      });
    }

    // Load more button
    const loadMoreBtn = document.getElementById('load-more-reviews');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function() {
        currentPage++;
        loadReviews(true); // Append mode
      });
    }

    // Write review button
    const writeReviewBtn = document.getElementById('write-review-btn');
    if (writeReviewBtn) {
      writeReviewBtn.addEventListener('click', showReviewModal);
    }
  }

  /**
   * Switch between product tabs
   */
  function switchTab(tabName) {
    // Update button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = content.id === `${tabName}-tab` ? 'block' : 'none';
    });
  }

  /**
   * Load reviews from API
   */
  async function loadReviews(append = false) {
    if (isLoading) return;
    isLoading = true;

    const container = document.getElementById('reviews-list');
    const loadMoreBtn = document.getElementById('load-more-reviews');

    // Check if review section exists (product might not have reviews section)
    if (!container) {
      console.log('Review section not found - product may not have reviews yet');
      isLoading = false;
      return;
    }

    try {
      if (!append) {
        container.innerHTML = '<div class="review-loading">Memuat ulasan...</div>';
      } else {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Memuat...';
      }

      const response = await fetch(`/api/reviews/list.php?product_id=${productId}&sort=${currentSort}&page=${currentPage}&limit=10`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Gagal memuat ulasan');
      }

      // Update statistics (only on initial load)
      if (!append && data.stats) {
        updateReviewStats(data.stats);
      }

      // Render reviews
      if (!append) {
        container.innerHTML = '';
      }

      const reviews = data.reviews || [];
      
      if (reviews.length === 0 && !append) {
        container.innerHTML = '<div class="no-reviews">Belum ada ulasan untuk produk ini. Jadilah yang pertama!</div>';
      } else {
        reviews.forEach(review => {
          container.appendChild(createReviewElement(review));
        });
      }

      // Update load more button
      if (loadMoreBtn) {
        if (data.pagination.has_more) {
          loadMoreBtn.style.display = 'block';
          loadMoreBtn.disabled = false;
          loadMoreBtn.textContent = 'Muat Lebih Banyak';
        } else {
          loadMoreBtn.style.display = 'none';
        }
      }

    } catch (error) {
      console.error('Load reviews error:', error);
      container.innerHTML = '<div class="review-error">Gagal memuat ulasan. Silakan coba lagi.</div>';
    } finally {
      isLoading = false;
    }
  }

  /**
   * Update review statistics display
   */
  function updateReviewStats(stats) {
    const avgRatingEl = document.getElementById('avg-rating');
    const totalReviewsEl = document.getElementById('total-reviews');
    const ratingBarsContainer = document.getElementById('rating-bars');

    if (avgRatingEl) {
      avgRatingEl.textContent = stats.average_rating.toFixed(1);
    }

    if (totalReviewsEl) {
      totalReviewsEl.textContent = `${stats.total_reviews} ulasan`;
    }

    // Update rating breakdown bars
    if (ratingBarsContainer) {
      ratingBarsContainer.innerHTML = '';
      stats.rating_breakdown.forEach(item => {
        const bar = document.createElement('div');
        bar.className = 'rating-bar';
        bar.innerHTML = `
          <span class="rating-label">${item.rating}★</span>
          <div class="bar-container">
            <div class="bar-fill" style="width: ${item.percentage}%"></div>
          </div>
          <span class="rating-count">${item.count}</span>
        `;
        ratingBarsContainer.appendChild(bar);
      });
    }

    // Update tab count
    const reviewTab = document.querySelector('[data-tab="reviews"]');
    if (reviewTab && stats.total_reviews > 0) {
      reviewTab.textContent = `Ulasan (${stats.total_reviews})`;
    }
  }

  /**
   * Create review element
   */
  function createReviewElement(review) {
    const div = document.createElement('div');
    div.className = 'review-item';
    div.dataset.reviewId = review.ID;

    // Build stars
    const stars = '★'.repeat(review.RATING) + '☆'.repeat(5 - review.RATING);

    // Build images if available
    let imagesHtml = '';
    if (review.images && review.images.length > 0) {
      imagesHtml = '<div class="review-images">';
      review.images.forEach(img => {
        imagesHtml += `<img src="${escapeHtml(img)}" alt="Review image" class="review-img" loading="lazy">`;
      });
      imagesHtml += '</div>';
    }

    // Verified purchase badge
    const verifiedBadge = review.IS_VERIFIED_PURCHASE === 'Y' 
      ? '<span class="verified-badge">✓ Pembelian Terverifikasi</span>' 
      : '';
    
    // Use DISPLAY_NAME if available (for anonymous reviews), otherwise use FULL_NAME
    const displayName = review.DISPLAY_NAME || review.FULL_NAME || 'Anonymous';
    const anonymousIndicator = review.IS_ANONYMOUS === 'Y' 
      ? '<span class="anonymous-badge" title="Nama pengguna disamarkan untuk privasi">🔒</span>' 
      : '';

    div.innerHTML = `
      <div class="review-header">
        <div class="review-author">
          <strong>${escapeHtml(displayName)}</strong>
          ${anonymousIndicator}
          ${verifiedBadge}
        </div>
        <div class="review-rating">
          <span class="stars">${stars}</span>
        </div>
      </div>
      <div class="review-date">${review.created_ago}</div>
      <div class="review-text">${escapeHtml(review.REVIEW_TEXT).replace(/\n/g, '<br>')}</div>
      ${imagesHtml}
      <div class="review-actions">
        <button class="btn-helpful" data-review-id="${review.ID}">
          <span class="helpful-icon">👍</span>
          <span class="helpful-text">Membantu (${review.HELPFUL_COUNT || 0})</span>
        </button>
      </div>
    `;

    // Add helpful button listener
    const helpfulBtn = div.querySelector('.btn-helpful');
    helpfulBtn.addEventListener('click', () => markAsHelpful(review.ID));

    return div;
  }

  /**
   * Get CSRF token from meta tag
   */
  function getCsrfToken() {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag ? metaTag.getAttribute('content') : '';
  }

  /**
   * Mark review as helpful
   */
  async function markAsHelpful(reviewId) {
    // Check if logged in
    const isLoggedIn = document.body.classList.contains('logged-in') || 
                      document.querySelector('meta[name="user-logged-in"]')?.content === 'true';

    if (!isLoggedIn) {
      showModal({
        title: 'Login Diperlukan',
        message: 'Silakan login terlebih dahulu untuk memberikan vote pada ulasan ini.',
        icon: 'info',
        buttons: [
          { text: 'Batal', className: 'modal-btn-secondary' },
          { text: 'Login', className: 'modal-btn-primary', callback: () => window.location.href = '/login' }
        ]
      });
      return;
    }

    // Get current button element
    const reviewItem = document.querySelector(`[data-review-id="${reviewId}"]`);
    const helpfulBtn = reviewItem?.querySelector('.btn-helpful');
    
    if (!helpfulBtn) return;
    
    // Disable button during request
    helpfulBtn.disabled = true;
    const originalText = helpfulBtn.querySelector('.helpful-text').textContent;

    try {
      const response = await fetch('/api/reviews/helpful.php', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ 
          csrf_token: getCsrfToken(),
          review_id: reviewId 
        })
      });

      const data = await response.json();

      if (data.success) {
        // Update button count immediately based on action
        const currentCount = parseInt(originalText.match(/\d+/)?.[0] || 0);
        const newCount = data.action === 'added' ? currentCount + 1 : currentCount - 1;
        helpfulBtn.querySelector('.helpful-text').textContent = `Membantu (${newCount})`;
        
        // Show success message
        showToast(data.message, 'success');
        
        // Re-enable button
        helpfulBtn.disabled = false;
      } else {
        showToast(data.message, 'error');
        helpfulBtn.disabled = false;
      }

    } catch (error) {
      console.error('Mark helpful error:', error);
      showToast('Gagal memberikan vote. Silakan coba lagi.', 'error');
      helpfulBtn.disabled = false;
    }
  }

  /**
   * Show review submission modal (placeholder)
   */
  function showReviewModal() {
    // TODO: Implement review modal
    // For now, redirect to account page
    window.location.href = '/account/orders';
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `review-toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Show modal dialog
   * @param {Object} options - Modal options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Modal message
   * @param {string} options.icon - Icon type (info, success, warning, danger)
   * @param {Array} options.buttons - Array of button objects {text, className, callback}
   */
  function showModal(options) {
    const {
      title = 'Konfirmasi',
      message = '',
      icon = 'info',
      buttons = [{ text: 'OK', className: 'modal-btn-primary' }]
    } = options;

    // Icon emoji mapping
    const iconEmojis = {
      info: 'ℹ️',
      success: '✓',
      warning: '⚠️',
      danger: '✕'
    };

    // Create modal HTML
    const modalHTML = `
      <div class="modal-overlay" id="helpful-vote-modal" style="display: flex !important; align-items: center !important; justify-content: center !important;">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">
              <span class="modal-icon ${icon}">${iconEmojis[icon] || iconEmojis.info}</span>
              ${escapeHtml(title)}
            </h3>
          </div>
          <div class="modal-body">
            <p class="modal-message">${escapeHtml(message)}</p>
            <div class="modal-actions">
              ${buttons.map((btn, index) => 
                `<button class="modal-btn ${btn.className || 'modal-btn-secondary'}" data-index="${index}">${escapeHtml(btn.text)}</button>`
              ).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    // Append to body
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    const modal = tempDiv.firstElementChild;
    document.body.appendChild(modal);

    // Add event listeners to buttons
    buttons.forEach((btn, index) => {
      const btnElement = modal.querySelector(`[data-index="${index}"]`);
      btnElement.addEventListener('click', () => {
        closeModal(modal);
        if (btn.callback && typeof btn.callback === 'function') {
          btn.callback();
        }
      });
    });

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });

    // Show modal with animation
    setTimeout(() => modal.classList.add('show'), 10);
  }

  /**
   * Close modal dialog
   */
  function closeModal(modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 200);
  }

  /**
   * Escape HTML for XSS protection
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get product ID from URL
   */
  function getProductIdFromUrl() {
    const match = window.location.pathname.match(/\/product\/(\d+)/);
    return match ? match[1] : null;
  }

  // Public API
  return {
    init: init
  };

})();