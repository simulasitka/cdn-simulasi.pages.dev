/**
 * Plaza IT Chat Widget - Lightweight Client
 * Vanilla JavaScript - No dependencies
 */

class PlazaChat {
    constructor(options = {}) {
        this.API_BASE = options.apiBase || '/api/chat';
        this.currentConversationId = null;
        this.currentView = 'list'; // 'list', 'messages', 'new'
        this.pollingInterval = null;
        this.pollingRate = options.pollingRate || 30000; // 30 seconds
        this.unreadCount = 0;
        this.conversations = [];
        this.messages = [];
        this.csrfToken = null; // CSRF token for security
        this.isWidgetOpen = false; // Track widget visibility
        this.pendingProductAttachment = null; // Product to attach (draft state)
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.bindEvents();
        this.checkOperatingHours();
        this.startPolling();
        this.setupVisibilityTracking();
        this.setupViewportHeight();
        this.checkAutoOpenHash();
    }
    
    /**
     * Check for #openchat hash and auto-open widget
     */
    checkAutoOpenHash() {
        if (window.location.hash === '#openchat') {
            const widget = document.getElementById('chat-widget');
            const isLoggedIn = widget?.dataset.isLoggedIn === 'true';
            
            if (isLoggedIn) {
                // Auto-open chat widget
                setTimeout(() => {
                    this.openWidget();
                    // Remove hash from URL without page reload
                    history.replaceState(null, null, window.location.pathname + window.location.search);
                }, 300); // Small delay to ensure DOM is ready
            } else {
                // Not logged in, remove hash
                history.replaceState(null, null, window.location.pathname + window.location.search);
            }
        }
    }
    
    /**
     * Check operating hours and display notice if outside hours
     */
    checkOperatingHours() {
        const now = new Date();
        const hour = now.getHours();
        const subtitle = document.getElementById('chatOperatingHours');
        
        console.log('🕐 Checking operating hours:', {
            currentHour: hour,
            currentTime: now.toLocaleTimeString('id-ID'),
            elementFound: !!subtitle,
            isOutsideHours: hour < 9 || hour >= 22
        });
        
        if (!subtitle) {
            console.warn('⚠️ chatOperatingHours element not found');
            return;
        }
        
        // Check if outside operating hours (before 9 AM or after 10 PM)
        const isOutsideHours = hour < 9 || hour >= 22;
        
        if (isOutsideHours) {
            subtitle.innerHTML = `
                <span>Di luar jam operasional • Balasan mungkin tertunda</span>
            `;
            subtitle.style.display = 'flex';
            console.log('✅ Operating hours notice displayed');
        } else {
            subtitle.style.display = 'none';
            console.log('✅ Operating hours notice hidden (within hours)');
        }
    }
    
    setupVisibilityTracking() {
        // Pause polling when tab is hidden to save resources
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Tab hidden - slow down polling or pause
                this.stopPolling();
            } else {
                // Tab visible - resume polling
                this.startPolling();
                // Immediate refresh when user comes back
                this.updateUnreadCount();
                if (this.isWidgetOpen) {
                    if (this.currentView === 'list') {
                        this.loadConversations();
                    } else if (this.currentView === 'messages' && this.currentConversationId) {
                        this.loadMessages(this.currentConversationId, true);
                    }
                }
            }
        });
    }
    
    setupViewportHeight() {
        // Set CSS custom property for viewport height (fallback for non-dvh browsers)
        const setViewportHeight = () => {
            // Use visualViewport API if available (more accurate for mobile)
            const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            document.documentElement.style.setProperty('--viewport-height', `${height}px`);
        };
        
        // Initial set
        setViewportHeight();
        
        // Update on resize and viewport changes
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', setViewportHeight);
            window.visualViewport.addEventListener('scroll', setViewportHeight);
        } else {
            window.addEventListener('resize', setViewportHeight);
        }
        
        // Update when orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(setViewportHeight, 100);
        });
    }
    
    cacheElements() {
        // Main widget
        this.widget = document.getElementById('chat-widget');
        this.toggleBtn = document.getElementById('chat-toggle-btn');
        this.popup = document.getElementById('chat-popup');
        this.closeBtn = document.getElementById('chat-close-btn');
        this.unreadBadge = document.getElementById('chat-unread-badge');
        
        // Get CSRF token from data attribute
        if (this.widget) {
            this.csrfToken = this.widget.dataset.csrfToken;
        }
        
        // Views
        this.listView = document.getElementById('chat-list-view');
        this.messagesView = document.getElementById('chat-messages-view');
        this.newView = document.getElementById('chat-new-view');
        
        // List view
        this.conversationsList = document.getElementById('chat-conversations-list');
        this.newBtn = document.getElementById('chat-new-btn');
        
        // Hide new conversation button (single-conversation model)
        if (this.newBtn) {
            this.newBtn.style.display = 'none';
        }
        
        // Messages view
        // No back button or title needed - single conversation model
        this.messagesContainer = document.getElementById('chat-messages-container');
        this.messageForm = document.getElementById('chat-message-form');
        this.messageInput = document.getElementById('chat-message-input');
        this.currentConversationIdInput = document.getElementById('chat-current-conversation-id');
        
        // New chat view
        this.newBackBtn = document.getElementById('chat-new-back-btn');
        this.startForm = document.getElementById('chat-start-form');
        this.newSubjectInput = document.getElementById('chat-new-subject');
        this.newMessageInput = document.getElementById('chat-new-message');
    }
    
    bindEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleWidget());
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeWidget());
        }
        
        if (this.newBtn) {
            this.newBtn.addEventListener('click', () => this.showNewView());
        }
        
        if (this.newBackBtn) {
            this.newBackBtn.addEventListener('click', () => this.showListView());
        }
        
        if (this.messageForm) {
            this.messageForm.addEventListener('submit', (e) => this.handleSendMessage(e));
        }
        
        if (this.startForm) {
            this.startForm.addEventListener('submit', (e) => this.handleStartConversation(e));
        }
        
        // Notification toggle button
        const notifToggle = document.getElementById('chatNotifToggle');
        if (notifToggle) {
            notifToggle.addEventListener('click', () => {
                if (window.ChatNotification) {
                    window.ChatNotification.handleToggleClick();
                }
            });
        }
        
        // Auto-resize textarea
        if (this.messageInput) {
            this.messageInput.addEventListener('input', () => this.autoResizeTextarea(this.messageInput));
            this.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.messageForm.dispatchEvent(new Event('submit'));
                }
            });
        }
        
        if (this.newMessageInput) {
            this.newMessageInput.addEventListener('input', () => this.autoResizeTextarea(this.newMessageInput));
        }
    }
    
    toggleWidget() {
        if (!this.popup) {
            return;
        }
        
        // Check if popup is hidden (display is 'none' or empty string)
        const isHidden = !this.popup.style.display || this.popup.style.display === 'none';
        
        if (isHidden) {
            this.openWidget();
        } else {
            this.closeWidget();
        }
    }
    
    openWidget() {
        if (!this.popup) {
            return;
        }
        
        // Check if user is logged in
        const isLoggedIn = this.widget.dataset.isLoggedIn === 'true';
        if (!isLoggedIn) {
            // Show login required message
            this.showLoginRequired();
            return;
        }
        
        this.popup.style.display = 'block';
        this.isWidgetOpen = true;
        
        // Check operating hours when widget opens
        this.checkOperatingHours();
        
        // Trigger mobile browser address bar auto-hide
        this.hideAddressBar();
        
        // Single-conversation model: Auto-load customer's conversation
        this.autoLoadConversation();
    }
    
    hideAddressBar() {
        // Only on mobile devices
        if (!this.isMobileDevice()) return;
        
        // Save current scroll position
        this.savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        
        // Method 1: Scroll down slightly to trigger browser auto-hide
        // Most mobile browsers hide address bar when scrolling down
        if (window.pageYOffset === 0) {
            // If at top, scroll down 1px
            window.scrollTo(0, 1);
        }
        
        // Method 2: Request minimal scroll for consistent behavior
        setTimeout(() => {
            window.scrollTo(0, Math.max(1, window.pageYOffset));
            // Update viewport height after scroll to recalculate
            this.updateViewportHeight();
        }, 100);
        
        // Additional attempt after longer delay (for stubborn browsers)
        setTimeout(() => {
            this.updateViewportHeight();
        }, 300);
    }
    
    updateViewportHeight() {
        const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        document.documentElement.style.setProperty('--viewport-height', `${height}px`);
    }
    
    restoreScrollPosition() {
        // Restore scroll position when closing chat
        if (typeof this.savedScrollPosition === 'number') {
            window.scrollTo(0, this.savedScrollPosition);
            this.savedScrollPosition = null;
        }
    }
    
    isMobileDevice() {
        // Detect mobile devices
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || window.innerWidth <= 768;
    }
    
    async autoLoadConversation() {
        // Show loading in messages view immediately
        this.showMessagesView(null); // Show view with loading state
        
        try {
            // Try to get or create conversation
            const res = await fetch(`${this.API_BASE}/start.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({
                    subject: 'Customer Support'
                    // No initial_message - just get/create conversation
                })
            });
            
            // Handle session expired
            if (res.status === 401 || res.status === 403) {
                this.handleSessionExpired();
                return;
            }
            
            const data = await res.json();
            
            if (data.success && data.data && data.data.conversation_id) {
                // Load messages for the conversation
                this.currentConversationId = data.data.conversation_id;
                this.currentConversationIdInput.value = data.data.conversation_id;
                this.loadMessages(data.data.conversation_id, false);
            } else {
                // Show error in messages view
                this.messagesContainer.innerHTML = `
                    <div class="text-center p-4">
                        <p class="text-danger">Gagal memuat percakapan</p>
                        <button id="chat-retry-load-btn" class="btn btn-sm btn-primary">
                            Coba Lagi
                        </button>
                    </div>
                `;
                const retryBtn = document.getElementById('chat-retry-load-btn');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => this.autoLoadConversation());
                }
            }
        } catch (err) {
            // Show error in messages view
            this.messagesContainer.innerHTML = `
                <div class="text-center p-4">
                    <p class="text-danger">Terjadi kesalahan: ${err.message}</p>
                    <button id="chat-retry-error-btn" class="btn btn-sm btn-primary">
                        Coba Lagi
                    </button>
                </div>
            `;
            const retryBtn = document.getElementById('chat-retry-error-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => this.autoLoadConversation());
            }
        }
    }
    
    closeWidget() {
        this.popup.style.display = 'none';
        this.isWidgetOpen = false;
        
        // Restore scroll position (optional - helps maintain context)
        // Comment out if you prefer to leave scroll position as-is
        // this.restoreScrollPosition();
    }
    
    showMessagesView(conversationId) {
        this.currentView = 'messages';
        this.listView.style.display = 'none';
        this.messagesView.style.display = 'flex';
        this.newView.style.display = 'none';
        
        // If conversationId is null, show loading (for autoLoadConversation)
        if (conversationId === null) {
            this.messagesContainer.innerHTML = '<div class="chat-loading">Memuat percakapan...</div>';
            return;
        }
        
        this.currentConversationId = conversationId;
        this.currentConversationIdInput.value = conversationId;
        
        // Clear messages when switching conversation
        this.messagesContainer.innerHTML = '';
        
        // Save to sessionStorage for persistence
        sessionStorage.setItem('plazaChat_lastConversation', conversationId);
        
        this.loadMessages(conversationId, false);
    }
    
    showNewView() {
        this.currentView = 'new';
        this.listView.style.display = 'none';
        this.messagesView.style.display = 'none';
        this.newView.style.display = 'flex';
        this.newMessageInput.focus();
    }
    
    async loadMessages(conversationId, preserveScroll = false) {
        try {
            if (!preserveScroll) {
                this.showLoading(this.messagesContainer);
            }
            
            const res = await fetch(`${this.API_BASE}/messages.php?conversation_id=${conversationId}&limit=50`);
            
            // Handle session expired
            if (res.status === 401 || res.status === 403) {
                this.handleSessionExpired();
                return;
            }
            
            const data = await res.json();
            
            if (data.success) {
                // Check if user was at bottom before update
                const wasAtBottom = preserveScroll ?
                    (this.messagesContainer.scrollHeight - this.messagesContainer.scrollTop - this.messagesContainer.clientHeight < 100) : false;
                
                this.messages = data.data.messages;
                // No need to set title - single conversation model
                this.renderMessages();
                
                // Mark as read
                await this.markAsRead(conversationId);
                
                // Scroll behavior
                if (!preserveScroll || wasAtBottom) {
                    this.scrollToBottom();
                }
                setTimeout(() => this.scrollToBottom(), 100);
            } else {
                this.showError(this.messagesContainer, data.message || 'Gagal memuat pesan');
            }
        } catch (err) {
            this.showError(this.messagesContainer, 'Terjadi kesalahan');
        }
    }
    
    async handleSendMessage(e) {
        e.preventDefault();
        
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        const conversationId = this.currentConversationIdInput.value;
        
        // Clear input immediately for better UX
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        
        // Optimistic UI: Show message immediately with loading status
        const tempId = 'temp_' + Date.now();
        const optimisticMessage = {
            ID: tempId,
            MESSAGE_TEXT: message,
            IS_MINE: true,
            CREATED_AT: new Date().toISOString(),
            STATUS: 'sending' // sending, sent, failed
        };
        
        // Add to messages array and render
        this.messages.push(optimisticMessage);
        this.renderOptimisticMessage(optimisticMessage);
        this.scrollToBottom();
        
        try {
            // Include product_id if this is first message with pending product
            const payload = {
                conversation_id: conversationId,
                message: message
            };
            
            if (this.pendingProductAttachment) {
                payload.product_id = this.pendingProductAttachment.id;
                if (this.pendingProductAttachment.variant_id) {
                    payload.variant_id = this.pendingProductAttachment.variant_id;
                }
            }
            
            const res = await fetch(`${this.API_BASE}/send.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            
            if (data.success) {
                // Remove temp message from array
                this.messages = this.messages.filter(m => m.ID !== tempId);
                
                // Remove temp message element from DOM
                const tempEl = this.messagesContainer.querySelector(`[data-message-id="${tempId}"]`);
                if (tempEl) tempEl.remove();
                
                // Clear product attachment after successful send
                if (this.pendingProductAttachment) {
                    this.removeProductAttachment();
                }
                
                // Reload messages to get real ID and sync (preserve scroll)
                this.loadMessages(conversationId, true);
            } else {
                // Mark as failed
                this.updateMessageStatus(tempId, 'failed', message, conversationId);
            }
        } catch (err) {
            console.error('Failed to send message:', err);
            // Mark as failed
            this.updateMessageStatus(tempId, 'failed', message, conversationId);
        }
    }
    
    renderOptimisticMessage(msg) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message mine';
        messageDiv.dataset.messageId = msg.ID;
        
        let bubbleHTML = '<div class="chat-message-bubble">';
        bubbleHTML += `<div class="message-text">${this.escapeHtml(msg.MESSAGE_TEXT)}</div>`;
        bubbleHTML += '<div class="message-meta">';
        bubbleHTML += `<span class="message-time">${this.formatTime(msg.CREATED_AT)}</span>`;
        
        // Status icon based on state
        if (msg.STATUS === 'sending') {
            bubbleHTML += '<span class="message-status loading"></span>';
        } else if (msg.STATUS === 'failed') {
            bubbleHTML += `
                <svg class="message-status failed" viewBox="0 0 16 16" fill="currentColor" title="Gagal terkirim. Klik untuk coba lagi">
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            `;
        } else {
            bubbleHTML += `
                <svg class="message-status sent" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
            `;
        }
        
        bubbleHTML += '</div></div>';
        messageDiv.innerHTML = bubbleHTML;
        
        // Fade in animation
        messageDiv.style.opacity = '0';
        messageDiv.style.transition = 'opacity 0.3s ease';
        this.messagesContainer.appendChild(messageDiv);
        requestAnimationFrame(() => {
            messageDiv.style.opacity = '1';
        });
    }
    
    updateMessageStatus(messageId, status, messageText = null, conversationId = null) {
        const messageEl = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageEl) return;
        
        const statusIcon = messageEl.querySelector('.message-status');
        if (!statusIcon) return;
        
        // Remove all status classes
        statusIcon.classList.remove('loading', 'sent', 'failed');
        
        if (status === 'sent') {
            statusIcon.classList.add('sent');
            statusIcon.innerHTML = `
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            `;
        } else if (status === 'failed') {
            statusIcon.classList.add('failed');
            statusIcon.setAttribute('title', 'Gagal terkirim. Klik untuk coba lagi');
            statusIcon.innerHTML = `
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            `;
            
            // Add retry click handler
            statusIcon.style.cursor = 'pointer';
            statusIcon.addEventListener('click', async () => {
                // Change to loading
                statusIcon.classList.remove('failed');
                statusIcon.classList.add('loading');
                statusIcon.innerHTML = '';
                
                // Retry send
                try {
                    const res = await fetch(`${this.API_BASE}/send.php`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': this.csrfToken
                        },
                        body: JSON.stringify({
                            conversation_id: conversationId,
                            message: messageText
                        })
                    });
                    
                    const data = await res.json();
                    
                    if (data.success) {
                        this.updateMessageStatus(messageId, 'sent');
                        setTimeout(() => {
                            this.loadMessages(conversationId, true);
                        }, 500);
                    } else {
                        this.updateMessageStatus(messageId, 'failed', messageText, conversationId);
                    }
                } catch (err) {
                    this.updateMessageStatus(messageId, 'failed', messageText, conversationId);
                }
            });
        }
    }
    
    async handleStartConversation(e) {
        e.preventDefault();
        
        const subject = this.newSubjectInput.value.trim() || 'Bantuan Pelanggan';
        const message = this.newMessageInput.value.trim();
        
        if (!message) {
            alert('Pesan tidak boleh kosong');
            return;
        }
        
        try {
            const res = await fetch(`${this.API_BASE}/start.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({
                    subject: subject,
                    initial_message: message
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                // Clear form
                this.newSubjectInput.value = '';
                this.newMessageInput.value = '';
                
                // Open conversation
                this.showMessagesView(data.data.conversation_id);
            } else {
                alert(data.message || 'Gagal membuat percakapan');
            }
        } catch (err) {
            console.error('Failed to start conversation:', err);
            alert('Terjadi kesalahan');
        }
    }
    
    async markAsRead(conversationId) {
        try {
            await fetch(`${this.API_BASE}/mark_read.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({conversation_id: conversationId})
            });
            
            // Update unread count
            this.updateUnreadCount();
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    }
    
    async updateUnreadCount() {
        // Don't call API if user is not logged in
        const isLoggedIn = this.widget.dataset.isLoggedIn === 'true';
        if (!isLoggedIn) {
            return;
        }
        
        try {
            const res = await fetch(`${this.API_BASE}/unread.php`);
            
            // Handle session expired (logged out in another tab)
            if (res.status === 401 || res.status === 403) {
                this.handleSessionExpired();
                return;
            }
            
            const data = await res.json();
            
            if (data.success) {
                this.unreadCount = data.data.unread_count;
                this.updateUnreadBadge();
            }
        } catch (err) {
            // Silent fail for polling
        }
    }
    
    updateUnreadBadge() {
        if (this.unreadBadge) {
            this.unreadBadge.textContent = this.unreadCount;
            this.unreadBadge.style.display = this.unreadCount > 0 ? 'block' : 'none';
        }
        
        // Also update bottom nav badge for mobile
        const bottomChatBadge = document.getElementById('bottomChatCount');
        if (bottomChatBadge) {
            bottomChatBadge.textContent = this.unreadCount;
            bottomChatBadge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    }
    
    renderMessages() {
        if (this.messages.length === 0) {
            if (!this.messagesContainer.querySelector('.text-center')) {
                this.messagesContainer.innerHTML = `
                    <div class="text-center" style="padding: 20px; color: #9ca3af;">
                        Belum ada pesan
                    </div>
                `;
            }
            return;
        }
        
        // Remove loading and empty state if exists
        const loadingState = this.messagesContainer.querySelector('.chat-loading');
        if (loadingState) loadingState.remove();
        
        const emptyState = this.messagesContainer.querySelector('.text-center');
        if (emptyState) emptyState.remove();
        
        // Get existing message IDs and date separators for differential update
        const existingMessages = this.messagesContainer.querySelectorAll('.chat-message');
        const existingIds = Array.from(existingMessages).map(el => parseInt(el.dataset.messageId || 0));
        const existingSeparators = new Set(Array.from(this.messagesContainer.querySelectorAll('.date-separator')).map(el => el.dataset.dateKey));
        
        // Group messages by date and render with separators
        let lastDateKey = null;
        
        this.messages.forEach((msg, index) => {
            const msgDateKey = this.getDateKey(msg.CREATED_AT);
            
            // Insert date separator if date changed
            if (msgDateKey !== lastDateKey && !existingSeparators.has(msgDateKey)) {
                const separator = document.createElement('div');
                separator.className = 'date-separator';
                separator.dataset.dateKey = msgDateKey;
                separator.innerHTML = `
                    <div class="date-separator-line"></div>
                    <div class="date-separator-text">${this.getDateLabel(msg.CREATED_AT)}</div>
                    <div class="date-separator-line"></div>
                `;
                this.messagesContainer.appendChild(separator);
                existingSeparators.add(msgDateKey);
            }
            lastDateKey = msgDateKey;
            
            if (existingIds.includes(msg.ID)) return; // Skip already rendered
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${msg.IS_MINE ? 'mine' : ''}`;
            messageDiv.dataset.messageId = msg.ID;
            
            // Build message bubble with WhatsApp-style structure
            let bubbleHTML = '<div class="chat-message-bubble">';
            
            // Sender name (only for non-mine messages)
            if (!msg.IS_MINE) {
                bubbleHTML += `<div class="message-sender">Admin Support</div>`;
            }
            
            // Product attachment (if exists)
            if (msg.PRODUCT && msg.PRODUCT.id) {
                const variantHTML = msg.PRODUCT.variant_summary 
                    ? `<div class="message-product-variant">${this.escapeHtml(msg.PRODUCT.variant_summary)}</div>` 
                    : '';
                bubbleHTML += `
                    <div class="message-product-card">
                        <img src="${this.escapeHtml(msg.PRODUCT.image || '')}" 
                             alt="${this.escapeHtml(msg.PRODUCT.name)}" 
                             onerror="this.src='/assets/images/placeholder-product.png'">
                        <div class="message-product-info">
                            <div class="message-product-name">${this.escapeHtml(msg.PRODUCT.name)}</div>
                            ${variantHTML}
                            <div class="message-product-price">Rp ${this.formatPrice(msg.PRODUCT.price)}</div>
                        </div>
                        <a href="${this.escapeHtml(msg.PRODUCT.url)}" 
                           class="message-product-link" 
                           target="_blank" 
                           title="Lihat produk">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                `;
            }
            
            // Message text
            bubbleHTML += `<div class="message-text">${this.escapeHtml(msg.MESSAGE_TEXT)}</div>`;
            
            // Message metadata (time + status)
            bubbleHTML += '<div class="message-meta">';
            bubbleHTML += `<span class="message-time">${this.formatTime(msg.CREATED_AT)}</span>`;
            
            // Status icon (only for mine messages) - checkmarks for sent/delivered/read
            if (msg.IS_MINE) {
                bubbleHTML += `
                    <svg class="message-status" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                    </svg>
                `;
            }
            
            bubbleHTML += '</div>'; // close message-meta
            bubbleHTML += '</div>'; // close chat-message-bubble
            
            messageDiv.innerHTML = bubbleHTML;
            
            // Smooth fade-in animation
            messageDiv.style.opacity = '0';
            messageDiv.style.transition = 'opacity 0.3s ease';
            this.messagesContainer.appendChild(messageDiv);
            requestAnimationFrame(() => {
                messageDiv.style.opacity = '1';
            });
        });
    }
    
    formatPrice(price) {
        // Format number with thousands separator
        return Math.floor(price).toLocaleString('id-ID');
    }

    getDateLabel(dateStr) {
        if (!dateStr) return '';
        
        const msgDate = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Reset time for comparison
        today.setHours(0, 0, 0, 0);
        yesterday.setHours(0, 0, 0, 0);
        msgDate.setHours(0, 0, 0, 0);
        
        if (msgDate.getTime() === today.getTime()) {
            return 'Hari ini';
        } else if (msgDate.getTime() === yesterday.getTime()) {
            return 'Kemarin';
        } else {
            return msgDate.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }

    getDateKey(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    
    showLoading(container) {
        container.innerHTML = '<div class="chat-loading">Memuat...</div>';
    }
    
    showError(container, message) {
        container.innerHTML = `<div class="chat-loading" style="color: #ef4444;">${this.escapeHtml(message)}</div>`;
    }
    
    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }
    
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }
    
    startPolling() {
        // Check if user is logged in
        const isLoggedIn = this.widget.dataset.isLoggedIn === 'true';
        if (!isLoggedIn) {
            return; // Don't poll if not logged in
        }
        
        // Initial load
        this.updateUnreadCount();
        
        // Smart polling based on widget state
        this.pollingInterval = setInterval(() => {
            // Always update unread count (lightweight)
            this.updateUnreadCount();
            
            // Only poll content when widget is open
            if (this.isWidgetOpen) {
                if (this.currentView === 'messages' && this.currentConversationId) {
                    // Refresh messages (preserve scroll position)
                    this.loadMessages(this.currentConversationId, true);
                }
                // Single-conversation model - no list view to refresh
            }
        }, this.pollingRate);
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
    }
    
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            return this.formatTime(dateStr);
        } else if (days === 1) {
            return 'Kemarin';
        } else if (days < 7) {
            return days + ' hari lalu';
        } else {
            return date.toLocaleDateString('id-ID', {day: 'numeric', month: 'short'});
        }
    }
    
    formatTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'});
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showLoginRequired() {
        const modal = document.getElementById('chatLoginModal');
        if (!modal) return;
        
        // Show modal
        modal.classList.add('show');
        
        // Handle confirm button
        const confirmBtn = document.getElementById('chatLoginConfirm');
        const cancelBtn = document.getElementById('chatLoginCancel');
        
        const handleConfirm = () => {
            const loginUrl = '/login';
            const returnUrl = window.location.pathname;
            window.location.href = loginUrl + '?redirect=' + encodeURIComponent(returnUrl);
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        // Remove existing listeners before adding new ones
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        });
    }
    
    handleSessionExpired() {
        // Stop polling immediately
        this.stopPolling();
        
        // Update widget state
        this.widget.dataset.isLoggedIn = 'false';
        this.isWidgetOpen = false;
        
        // Show session expired message
        if (this.popup && this.popup.style.display !== 'none') {
            this.messagesContainer.innerHTML = `
                <div class="text-center p-4">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="color: #f59e0b; margin: 0 auto 16px; display: block; min-width: 64px; min-height: 64px; max-width: 64px; max-height: 64px;">
                        <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.1 14.8,9.5V11C15.4,11 16,11.6 16,12.3V15.8C16,16.4 15.4,17 14.7,17H9.2C8.6,17 8,16.4 8,15.7V12.2C8,11.6 8.6,11 9.2,11V9.5C9.2,8.1 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,9.5V11H13.5V9.5C13.5,8.7 12.8,8.2 12,8.2Z"/>
                    </svg>
                    <h4 style="margin-bottom: 12px; color: #1f2937;">Sesi Berakhir</h4>
                    <p style="color: #6b7280; margin-bottom: 20px;">Anda telah logout di tab lain. Silakan login kembali untuk melanjutkan chat.</p>
                    <button id="chat-session-expired-login-btn" class="btn btn-primary" style="padding: 10px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
                        Login Kembali
                    </button>
                </div>
            `;
            
            // Attach event listener (CSP-compliant)
            const loginBtn = document.getElementById('chat-session-expired-login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => {
                    const returnUrl = window.location.pathname;
                    window.location.href = '/login?redirect=' + encodeURIComponent(returnUrl);
                });
            }
        }
        
        // Update badge to hide
        this.unreadCount = 0;
        this.updateUnreadBadge();
    }
    
    attachProduct(productData) {
        this.pendingProductAttachment = {
            id: productData.id,
            name: productData.name,
            price: productData.price,
            image: productData.image,
            url: productData.url,
            variant_id: productData.variant_id || null,
            variant_summary: productData.variant_summary || null
        };
        this.renderPendingProductCard();
    }
    
    renderPendingProductCard() {
        if (!this.pendingProductAttachment || !this.messageForm) return;
        let productCard = this.messageForm.querySelector('.chat-product-card');
        if (!productCard) {
            productCard = document.createElement('div');
            productCard.className = 'chat-product-card';
            this.messageForm.insertBefore(productCard, this.messageInput);
        }
        const product = this.pendingProductAttachment;
        const variantHTML = product.variant_summary 
            ? `<div class="chat-product-card-variant">${this.escapeHtml(product.variant_summary)}</div>` 
            : '';
        productCard.innerHTML = `
            <img src="${this.escapeHtml(product.image)}" alt="${this.escapeHtml(product.name)}">
            <div class="chat-product-card-content">
                <div class="chat-product-card-name">
                    ${this.escapeHtml(product.name)}
                </div>
                ${variantHTML}
                <div class="chat-product-card-price">
                    ${this.escapeHtml(product.price)}
                </div>
            </div>
            <button type="button" id="chat-remove-product-btn" 
                class="chat-product-card-remove"
                title="Hapus produk">
                ×
            </button>
        `;
        const removeBtn = productCard.querySelector('#chat-remove-product-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.removeProductAttachment());
        }
    }
    
    removeProductAttachment() {
        this.pendingProductAttachment = null;
        
        // Remove product card from DOM
        const productCard = this.messageForm?.querySelector('.chat-product-card');
        if (productCard) {
            productCard.remove();
        }
    }
    
    destroy() {
        this.stopPolling();
    }
}

// Initialize chat widget when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('chat-widget')) {
            window.plazaChat = new PlazaChat();
        }
    });
} else {
    if (document.getElementById('chat-widget')) {
        window.plazaChat = new PlazaChat();
    }
}