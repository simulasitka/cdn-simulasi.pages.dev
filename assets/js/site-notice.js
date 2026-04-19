/**
 * Site Notice Banner - Interactive Behavior
 * Handles dismiss functionality with localStorage persistence
 * Supports dynamic notice IDs for different campaigns
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'plazait_site_notice_dismissed';
    
    const banner = document.getElementById('holidayNotice');
    const closeBtn = document.getElementById('holidayNoticeClose');
    
    if (!banner || !closeBtn) return;

    // Get notice ID from data attribute
    const noticeId = banner.dataset.noticeId;
    if (!noticeId) {
        console.warn('Notice ID not found. Banner will not persist dismiss state.');
    }

    /**
     * Check if banner was previously dismissed
     */
    function wasDismissed() {
        if (!noticeId) return false;
        
        try {
            const dismissed = localStorage.getItem(STORAGE_KEY);
            return dismissed === noticeId;
        } catch (e) {
            console.warn('localStorage not available:', e);
            return false;
        }
    }

    /**
     * Mark banner as dismissed
     */
    function markDismissed() {
        if (!noticeId) return;
        
        try {
            localStorage.setItem(STORAGE_KEY, noticeId);
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }
    }

    /**
     * Hide banner with animation
     */
    function hideBanner() {
        banner.classList.add('hidden');
        document.body.classList.remove('has-holiday-notice');
        
        // Remove from DOM after animation
        setTimeout(() => {
            banner.remove();
        }, 300);
        
        markDismissed();
        
        // Analytics tracking (optional)
        if (window.gtag) {
            window.gtag('event', 'banner_dismiss', {
                'event_category': 'Site Notice',
                'event_label': noticeId || 'unknown',
            });
        }
    }

    /**
     * Initialize banner
     */
    function init() {
        // Check if already dismissed
        if (wasDismissed()) {
            banner.remove();
            return;
        }
        
        // Add body class for layout adjustment
        document.body.classList.add('has-holiday-notice');
        
        // Close button click
        closeBtn.addEventListener('click', hideBanner);
        
        // Keyboard support for close button
        closeBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                hideBanner();
            }
        });
        
        // Optional: Auto-hide after certain time (disabled by default)
        // setTimeout(hideBanner, 30000); // 30 seconds
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();