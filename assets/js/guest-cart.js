/**
 * Guest Cart Manager - localStorage based cart for guest users
 * 
 * Manages shopping cart items in browser localStorage for users who are not logged in.
 * Provides seamless transition to database when user logs in.
 */

class GuestCart {
    constructor() {
        this.storageKey = 'plazait_guest_cart';
        this.apiBase = '/api/cart';
        
        // Initialize cart structure
        this.cart = this.loadFromStorage();
        
        // Bind methods
        this.add = this.add.bind(this);
        this.remove = this.remove.bind(this);
        this.update = this.update.bind(this);
        this.clear = this.clear.bind(this);
        this.getItems = this.getItems.bind(this);
        this.mergeToDatabase = this.mergeToDatabase.bind(this);
    }
    
    /**
     * Load cart from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object' && parsed.items) {
                    return parsed;
                }
            }
        } catch (error) {
            // Silent error handling
        }
        
        return {
            items: {},
            updated_at: Date.now(),
            version: '1.0'
        };
    }
    
    /**
     * Save cart to localStorage
     */
    saveToStorage() {
        try {
            this.cart.updated_at = Date.now();
            localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
            
            // Dispatch custom event for cart updates
            window.dispatchEvent(new CustomEvent('guestCartUpdated', {
                detail: {
                    itemsCount: this.getItemsCount(),
                    linesCount: this.getLinesCount(),
                    items: this.cart.items
                }
            }));
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Generate cart item key
     */
    generateKey(productId, variantId = 0) {
        return `p${productId}v${variantId}`;
    }
    
    /**
     * Add item to guest cart
     */
    add(productId, qty = 1, variantId = 0, meta = {}) {
        const key = this.generateKey(productId, variantId);
        
        // Validate inputs
        if (!productId || productId <= 0 || !qty || qty <= 0) {
            throw new Error('Invalid product ID or quantity');
        }
        
        qty = Math.max(1, Math.min(999, parseInt(qty)));
        
        // Initialize item if not exists
        if (!this.cart.items[key]) {
            this.cart.items[key] = {
                pid: parseInt(productId),
                vid: parseInt(variantId) || 0,
                qty: 0,
                name: meta.name || '',
                sku: meta.sku || '',
                price: parseInt(meta.price) || 0,
                image_url: meta.image_url || '',
                product_url: meta.product_url || '/product/' + parseInt(productId),
                added_at: Date.now()
            };
        }
        
        // Update quantity
        this.cart.items[key].qty = Math.max(1, Math.min(999, this.cart.items[key].qty + qty));
        
        // Update metadata if provided
        if (meta.name) this.cart.items[key].name = meta.name;
        if (meta.sku) this.cart.items[key].sku = meta.sku;
        if (meta.price) this.cart.items[key].price = parseInt(meta.price);
        if (meta.image_url) this.cart.items[key].image_url = meta.image_url;
        if (meta.product_url) this.cart.items[key].product_url = meta.product_url;
        
        this.saveToStorage();
        
        return {
            key,
            item: this.cart.items[key],
            itemsCount: this.getItemsCount(),
            linesCount: this.getLinesCount()
        };
    }
    
    /**
     * Remove item from guest cart
     */
    remove(productId, variantId = 0) {
        const key = this.generateKey(productId, variantId);
        
        if (this.cart.items[key]) {
            delete this.cart.items[key];
            this.saveToStorage();
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Update item quantity
     */
    update(productId, qty, variantId = 0) {
        const key = this.generateKey(productId, variantId);
        
        if (!this.cart.items[key]) {
            return false;
        }
        
        qty = parseInt(qty);
        if (qty <= 0) {
            return this.remove(productId, variantId);
        }
        
        this.cart.items[key].qty = Math.max(1, Math.min(999, qty));
        this.saveToStorage();
        
        return true;
    }
    
    /**
     * Clear entire cart
     */
    clear() {
        this.cart = {
            items: {},
            updated_at: Date.now(),
            version: '1.0'
        };
        
        this.saveToStorage();
        
        return true;
    }
    
    /**
     * Get all cart items
     */
    getItems() {
        return this.cart.items;
    }
    
    /**
     * Get cart items as array
     */
    getItemsArray() {
        return Object.values(this.cart.items);
    }
    
    /**
     * Get total items count (sum of quantities)
     */
    getItemsCount() {
        return Object.values(this.cart.items).reduce((total, item) => total + (item.qty || 0), 0);
    }
    
    /**
     * Get lines count (number of different items)
     */
    getLinesCount() {
        return Object.keys(this.cart.items).length;
    }
    
    /**
     * Get cart summary
     */
    getSummary() {
        const itemsCount = this.getItemsCount();
        const linesCount = this.getLinesCount();
        const totalValue = Object.values(this.cart.items).reduce(
            (total, item) => total + ((item.qty || 0) * (item.price || 0)), 0
        );
        
        return {
            itemsCount,
            linesCount,
            totalValue,
            updatedAt: this.cart.updated_at
        };
    }
    
    /**
     * Check if cart has items
     */
    isEmpty() {
        return this.getLinesCount() === 0;
    }
    
    /**
     * Merge guest cart to database after user login
     */
    async mergeToDatabase() {
        const items = this.cart.items;
        
        if (Object.keys(items).length === 0) {
            return { ok: true, merged_count: 0, message: 'No items to merge' };
        }
        
        try {
            // Use new endpoint that handles localStorage format
            const response = await fetch(`${this.apiBase}/merge-localStorage.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    items: items  // Send localStorage format directly
                })
            });
            
            const result = await response.json();
            
            if (result.ok) {
                // Clear localStorage cart after successful merge
                this.clear();
                
                // Update cart counter
                if (window.updateCartCounter) {
                    try {
                        await window.updateCartCounter();
                    } catch (e) {
                        // Silent error handling
                    }
                }
                
                // Dispatch merge completion event
                window.dispatchEvent(new CustomEvent('guestCartMerged', {
                    detail: result
                }));
                
                return result;
            } else {
                throw new Error(result.error || 'Failed to merge cart');
            }
            
        } catch (error) {
            throw error;
        }
    }
    
    /**
     * Export cart data (for debugging or backup)
     */
    export() {
        return {
            ...this.cart,
            summary: this.getSummary()
        };
    }
    
    /**
     * Import cart data (for restore or testing)
     */
    import(cartData) {
        if (cartData && typeof cartData === 'object' && cartData.items) {
            this.cart = {
                items: cartData.items,
                updated_at: cartData.updated_at || Date.now(),
                version: cartData.version || '1.0'
            };
            
            this.saveToStorage();
            return true;
        }
        
        return false;
    }
}

// Create global instance
window.guestCart = new GuestCart();

// Auto-merge on page load if user is logged in
document.addEventListener('DOMContentLoaded', async function() {
    // Multiple ways to check if user is logged in
    const isLoggedIn = document.querySelector('meta[name="user-logged-in"]')?.content === 'true' ||
                      document.body.classList.contains('logged-in') ||
                      window.userLoggedIn === true ||
                      document.body.dataset.userLoggedIn === 'true';
    
    if (isLoggedIn && !window.guestCart.isEmpty()) {
        // Small delay to ensure page is fully loaded
        setTimeout(async () => {
            try {
                const result = await window.guestCart.mergeToDatabase();
            } catch (error) {
                // Silent error handling
            }
        }, 500);
    }
});

// Also listen for login events (if login happens via AJAX)
window.addEventListener('userLoggedIn', async function() {
    if (!window.guestCart.isEmpty()) {
        try {
            await window.guestCart.mergeToDatabase();
        } catch (error) {
            // Silent error handling
        }
    }
});