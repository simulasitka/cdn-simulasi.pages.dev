(function(){
  function selBadge(){
    return document.querySelector('[data-role="cart-badge"]') || document.getElementById('cartCount');
  }
  function setBadge(n){
    const el = selBadge();
    if (!el) return;
    const count = Math.max(0, parseInt(n||0,10) || 0);
    el.textContent = String(count);
    // Sembunyikan jika 0? Jika ingin selalu terlihat, hapus 2 baris di bawah
    if (count <= 0) { el.classList.add('is-empty'); }
    else { el.classList.remove('is-empty'); }
  }
  async function refresh(){
    try{
      // Primary: Use server-side endpoint (handles both logged and guest users)
      const res = await fetch('/api/cart/get-simple.php', { credentials:'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          setBadge(data.items_count || 0);
          return;
        }
      }
      
      // Fallback hanya untuk guest user: check localStorage
      const isLoggedIn = document.querySelector('meta[name="user-logged-in"]')?.content === 'true' ||
                        document.body.classList.contains('logged-in') ||
                        window.userLoggedIn === true;
      
      if (!isLoggedIn && window.guestCart && typeof window.guestCart.getItemsCount === 'function') {
        setBadge(window.guestCart.getItemsCount());
      }
    }catch(e){ 
      // Final fallback hanya untuk guest
      const isLoggedIn = document.querySelector('meta[name="user-logged-in"]')?.content === 'true';
      if (!isLoggedIn) {
        try {
          const guestCartData = JSON.parse(localStorage.getItem('plazait_guest_cart') || '{"items":{}}');
          const items = guestCartData.items || {};
          const count = Object.values(items).reduce((total, item) => total + (item.qty || 0), 0);
          setBadge(count);
        } catch(e2) {
          setBadge(0);
        }
      } else {
        setBadge(0);
      }
    }
  }

  // Ekspos untuk dipanggil dari skrip lain (opsional)
  window.CartBadge = { set: setBadge, refresh };
  window.updateCartCounter = refresh; // Alias for compatibility

  // Update saat halaman load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }

  // Dengarkan event global dari add/remove/update
  document.addEventListener('cart:updated', function(ev){
    const c = ev && ev.detail && typeof ev.detail.items_count === 'number'
      ? ev.detail.items_count : null;
    if (c !== null) setBadge(c);
    else refresh();
  });

  // Dengarkan event khusus cart remove untuk update badge
  document.addEventListener('cart:removed', function(ev){
    // Langsung refresh untuk memastikan data terbaru
    refresh();
  });

  // Jika addToCart sudah ada sebelum file ini, coba wrap agar badge ter-update.
  const prevAdd = window.addToCart;
  if (typeof prevAdd === 'function'){
    window.addToCart = async function(pid, qty, vid, meta){
      const res = await prevAdd(pid, qty, vid, meta);
      try{
        const cnt = res && res.cart ? res.cart.items_count : null;
        if (cnt !== null) setBadge(cnt);
        // tetap siarkan event agar listener lain ikut sync
        document.dispatchEvent(new CustomEvent('cart:updated', { detail: res.cart || {} }));
      }catch(_){}
      return res;
    };
  }

  // Helper function to check if user is logged in
  function isUserLoggedIn() {
    const metaTag = document.querySelector('meta[name="user-logged-in"]');
    return metaTag ? metaTag.getAttribute('content') === 'true' : false;
  }

  // Make login check globally accessible
  window.isUserLoggedIn = isUserLoggedIn;
})();