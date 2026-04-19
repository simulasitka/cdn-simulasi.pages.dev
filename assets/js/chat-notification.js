/**
 * Customer Chat Push Notification Manager
 * Handles browser push notification subscription for customers
 * Version: 1.0.0
 * Date: 2026-01-19
 */

const ChatNotification = {
    // State
    status: 'not-supported', // not-supported, not-subscribed, subscribed, blocked
    subscription: null,
    vapidPublicKey: null, // Will be loaded from server
    
    /**
     * Initialize notification manager
     */
    async init() {
        // Check if user is logged in (only for logged-in users)
        if (!this.isUserLoggedIn()) {
            this.updateUI('not-supported');
            return;
        }
        
        // Check browser support
        if (!this.isSupported()) {
            this.updateUI('not-supported');
            return;
        }
        
        // Load VAPID key from server
        await this.loadVapidKey();
        
        if (!this.vapidPublicKey) {
            this.updateUI('not-supported');
            return;
        }
        
        // Register service worker if needed
        await this.registerServiceWorker();
        
        // Check current permission
        const permission = Notification.permission;
        
        if (permission === 'denied') {
            this.updateUI('blocked');
        } else if (permission === 'granted') {
            // Check if already subscribed
            const isSubscribed = await this.checkSubscriptionStatus();
            this.updateUI(isSubscribed ? 'subscribed' : 'not-subscribed');
        } else {
            // Default: not subscribed yet
            this.updateUI('not-subscribed');
            this.showInfoBar();
        }
    },
    
    /**
     * Check if user is logged in
     */
    isUserLoggedIn() {
        const metaTag = document.querySelector('meta[name="user-logged-in"]');
        return metaTag ? metaTag.getAttribute('content') === 'true' : false;
    },
    
    /**
     * Check if browser supports push notifications
     */
    isSupported() {
        return (
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window
        );
    },
    
    /**
     * Load VAPID public key from server
     */
    async loadVapidKey() {
        try {
            const response = await fetch('/api/chat/notifications/vapid_key', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            if (data.success && data.data?.public_key) {
                this.vapidPublicKey = data.data.public_key;
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('[ChatNotification] Error loading VAPID key:', error);
            return false;
        }
    },
    
    /**
     * Register service worker
     */
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return null;
        
        try {
            const registration = await navigator.serviceWorker.register('/sw-push.js', {
                scope: '/'
            });
            return registration;
        } catch (error) {
            return null;
        }
    },
    
    /**
     * Check subscription status from server
     */
    async checkSubscriptionStatus() {
        try {
            const response = await fetch('/api/chat/notifications/status', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            return data.data?.subscribed || false;
            
        } catch (error) {
            console.error('[ChatNotification] Error checking subscription:', error);
            return false;
        }
    },
    
    /**
     * Update UI based on status
     */
    updateUI(status) {
        this.status = status;
        const btn = document.getElementById('chatNotifToggle');
        
        if (!btn) {
            // Retry after a short delay (button might not be in DOM yet)
            setTimeout(() => this.updateUI(status), 100);
            return;
        }
        
        btn.setAttribute('data-status', status);
        
        // Show/hide button based on support
        if (status === 'not-supported') {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'block';
        }
        
        // Update SVG icon (bell vs bell-slash)
        const svg = btn.querySelector('svg');
        if (svg) {
            if (status === 'subscribed') {
                // Bell icon (active)
                svg.innerHTML = '<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>';
            } else {
                // Bell slash icon (inactive/blocked)
                svg.innerHTML = '<path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01c-.01 0-.01 0-.02.01-.23.09-.46.2-.68.31 0 0-.01 0-.01.01L18 14.68z"/>';
            }
        }
        
        // Update tooltip
        const tooltips = {
            'not-subscribed': 'Klik untuk aktifkan notifikasi',
            'subscribed': 'Notifikasi aktif',
            'blocked': 'Notifikasi diblokir'
        };
        
        if (tooltips[status]) {
            btn.title = tooltips[status];
        }
        
        // Hide info bar if subscribed or blocked
        if (status === 'subscribed' || status === 'blocked') {
            this.hideInfoBar();
        }
    },
    
    /**
     * Show info bar (if not dismissed)
     */
    showInfoBar() {
        if (localStorage.getItem('chat_notif_info_dismissed')) {
            return;
        }
        
        const infoBar = document.getElementById('chatNotifInfoBar');
        const popupBody = document.getElementById('chat-popup')?.querySelector('.chat-popup-body');
        
        if (infoBar) {
            infoBar.style.display = 'flex';
        }
        
        if (popupBody) {
            popupBody.classList.add('has-info-bar');
        }
    },
    
    /**
     * Hide info bar
     */
    hideInfoBar() {
        const infoBar = document.getElementById('chatNotifInfoBar');
        const popupBody = document.getElementById('chat-popup')?.querySelector('.chat-popup-body');
        
        if (infoBar) {
            infoBar.style.display = 'none';
        }
        
        if (popupBody) {
            popupBody.classList.remove('has-info-bar');
        }
    },
    
    /**
     * Dismiss info bar permanently
     */
    dismissInfo() {
        this.hideInfoBar();
        localStorage.setItem('chat_notif_info_dismissed', '1');
    },
    
    /**
     * Handle bell icon click
     */
    async handleToggleClick() {
        if (this.status === 'not-subscribed') {
            await this.subscribe();
        } else if (this.status === 'subscribed') {
            await this.unsubscribe();
        } else if (this.status === 'blocked') {
            this.showUnblockHelp();
        }
    },
    
    /**
     * Subscribe to push notifications
     */
    async subscribe() {
        try {
            // Request permission
            const permission = await Notification.requestPermission();
            
            if (permission === 'denied') {
                this.updateUI('blocked');
                this.showToast('Notifikasi diblokir', 'error');
                return;
            }
            
            if (permission !== 'granted') {
                return;
            }
            
            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;
            
            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
            });
            
            // Send subscription to server
            const response = await fetch('/api/chat/notifications/subscribe', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(subscription.toJSON())
            });
            
            if (!response.ok) {
                throw new Error('Failed to save subscription');
            }
            
            const result = await response.json();
            
            this.subscription = subscription;
            this.updateUI('subscribed');
            this.hideInfoBar();
            this.showToast('Notifikasi berhasil diaktifkan!', 'success');
            
            // Send test notification
            setTimeout(() => this.sendTestNotification(), 1000);
            
        } catch (error) {
            console.error('[ChatNotification] Subscribe error:', error);
            this.showToast('Gagal mengaktifkan notifikasi', 'error');
        }
    },
    
    /**
     * Unsubscribe from push notifications
     */
    async unsubscribe() {
        try {
            // Confirm first
            if (!confirm('Nonaktifkan notifikasi chat?')) {
                return;
            }
            
            // Get current subscription
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                // Unsubscribe from browser
                await subscription.unsubscribe();
                
                // Tell server
                await fetch('/api/chat/notifications/unsubscribe', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(subscription.toJSON())
                });
            }
            
            this.subscription = null;
            this.updateUI('not-subscribed');
            this.showInfoBar();
            this.showToast('Notifikasi dinonaktifkan', 'info');
            
        } catch (error) {
            console.error('[ChatNotification] Unsubscribe error:', error);
            this.showToast('Gagal menonaktifkan notifikasi', 'error');
        }
    },
    
    /**
     * Send test notification
     */
    async sendTestNotification() {
        try {
            const response = await fetch('/api/chat/notifications/test', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                // Test notification sent successfully
            }
        } catch (error) {
            // Test notification failed silently
        }
    },
    
    /**
     * Show unblock help modal/message
     */
    showUnblockHelp() {
        const message = `
            Notifikasi diblokir oleh browser.\n\n
            Untuk mengaktifkan:\n
            1. Klik ikon gembok/info di address bar\n
            2. Cari "Notifications" atau "Notifikasi"\n
            3. Ubah menjadi "Allow" atau "Izinkan"\n
            4. Refresh halaman ini
        `.trim().replace(/\s+/g, ' ');
        
        alert(message);
    },
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Simple toast implementation
        const toast = document.createElement('div');
        toast.className = `chat-toast chat-toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInUp 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    
    /**
     * Convert VAPID key to Uint8Array
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },
    
    /**
     * Check if push notification is currently active
     * @returns {Promise<boolean>}
     */
    async isPushActive() {
        try {
            // Check browser subscription
            if (!('serviceWorker' in navigator)) return false;
            
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) return false;
            
            const subscription = await registration.pushManager.getSubscription();
            if (!subscription) return false;
            
            // Also check server status
            const serverStatus = await this.checkSubscriptionStatus();
            
            return serverStatus;
        } catch (error) {
            return false;
        }
    },
    
    /**
     * Show logout confirmation if push notification is active
     * Call this before logout action
     * @returns {Promise<boolean>} true if user confirms logout, false if cancelled
     */
    async confirmLogoutWithPushNotification() {
        const isActive = await this.isPushActive();
        
        if (!isActive) {
            // No active push, proceed with logout
            return true;
        }
        
        // Show modal confirmation using modal.css
        return new Promise((resolve) => {
            // Create modal HTML
            const modalHTML = `
                <div class="modal-overlay" id="logoutConfirmModal">
                    <div class="modal-dialog">
                        <div class="modal-header">
                            <h3 class="modal-title">
                                <span class="modal-icon warning">⚠️</span>
                                Konfirmasi Logout
                            </h3>
                        </div>
                        <div class="modal-body">
                            <p class="modal-message">
                                Anda memiliki <strong>notifikasi push yang aktif</strong>.<br><br>
                                Setelah logout, Anda tidak akan menerima notifikasi chat lagi di perangkat ini.<br><br>
                                Apakah Anda yakin ingin melanjutkan logout?
                            </p>
                        </div>
                        <div class="modal-actions" style="padding: 0 20px 20px;">
                            <button class="modal-btn modal-btn-secondary" id="logoutCancelBtn">
                                Batal
                            </button>
                            <button class="modal-btn modal-btn-danger" id="logoutConfirmBtn">
                                Lanjutkan Logout
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Append to body
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer.firstElementChild);
            
            const modal = document.getElementById('logoutConfirmModal');
            const confirmBtn = document.getElementById('logoutConfirmBtn');
            const cancelBtn = document.getElementById('logoutCancelBtn');
            
            // Show modal with animation
            requestAnimationFrame(() => {
                modal.classList.add('show');
            });
            
            // Handle confirm
            const handleConfirm = () => {
                cleanup();
                resolve(true);
            };
            
            // Handle cancel
            const handleCancel = () => {
                cleanup();
                resolve(false);
            };
            
            // Cleanup function
            const cleanup = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.remove();
                }, 200);
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', handleBackdropClick);
            };
            
            // Handle backdrop click
            const handleBackdropClick = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };
            
            // Add event listeners
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            modal.addEventListener('click', handleBackdropClick);
        });
    }
};

// Add CSS animations
const chatNotifStyle = document.createElement('style');
chatNotifStyle.textContent = `
    @keyframes slideInUp {
        from {
            transform: translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutDown {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(chatNotifStyle);

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ChatNotification.init());
} else {
    ChatNotification.init();
}

// Expose to window for access from other scripts
window.ChatNotification = ChatNotification;