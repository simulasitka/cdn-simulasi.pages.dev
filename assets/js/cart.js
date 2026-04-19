(function(){
  function $(s,ctx=document){ return ctx.querySelector(s); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }
  
  // CSRF token helper
  function getCsrfToken() {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag ? metaTag.getAttribute('content') : '';
  }
  
  function guessPdMeta(){
    const name = (window.PD_NAME !== undefined) ? String(window.PD_NAME) : ($('#pd-title')?.textContent || '');
    const sku  = (function(){ const el=$('#pd-sku'); return el ? el.textContent.trim() : (window.PD_SKU||''); })();
    // SECURITY FIX: Remove price from client-side metadata (will be validated server-side)
    const imgEl = $('#pd-main-img');
    const image_url = imgEl ? (imgEl.getAttribute('src') || '') : '';
    return { name, sku, image_url }; // price removed for security
  }

  async function addToCart(productId, qty=1, variantId=0, metaOpt){
    const meta = Object.assign(guessPdMeta(), metaOpt||{});
    const payload = {
      product_id: parseInt(productId||0,10) || 0,
      qty: parseInt(qty||1,10) || 1,
      variant_id: parseInt(variantId||0,10) || 0,
      meta
    };
    
    // Check if user is logged in
    const isLoggedIn = document.querySelector('meta[name="user-logged-in"]')?.content === 'true' ||
                      document.body.classList.contains('logged-in') ||
                      window.userLoggedIn === true ||
                      document.body.dataset.userLoggedIn === 'true';
    
    // Skip localStorage untuk logged user - mereka pakai database
    if (!isLoggedIn && window.guestCart) {
      try {
        window.guestCart.add(payload.product_id, payload.qty, payload.variant_id, meta);
      } catch (e) {
        console.warn('Failed to add to localStorage cart:', e);
      }
    }
    
    const res = await fetch('/api/cart/add.php', {
      method: 'POST',
      headers: { 
        'Content-Type':'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        ...payload,
        csrf_token: getCsrfToken()
      }),
    });
    const data = await res.json().catch(()=>({ ok:false, error:'Gagal menambahkan ke keranjang' }));
    if (!res.ok || !data.ok) {
      const msg = data && data.error ? data.error : 'Gagal menambahkan ke keranjang';
      throw new Error(msg);
    }

    // Update badge di navbar dengan data dari response
    try {
      const el = document.querySelector('[data-role="cart-badge"]') || document.getElementById('cartCount');
      if (el && data.cart && typeof data.cart.items_count === 'number') {
        el.textContent = String(data.cart.items_count);
        el.classList.toggle('is-empty', data.cart.items_count <= 0);
      }
    } catch(_){}

    // Siarkan event global (dipakai cart-badge.js dan halaman lain)
    try {
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: data.cart || {} }));
    } catch(_){}

    // Update CartBadge dengan data dari response (lebih reliable)
    try { 
      if (window.CartBadge && window.CartBadge.set) {
        window.CartBadge.set(data.cart.items_count||0);
      }
    } catch(_){}

    // Tambahan: refresh cart counter setelah delay kecil untuk memastikan data tersinkronisasi
    setTimeout(() => {
      if (window.updateCartCounter) {
        window.updateCartCounter();
      }
    }, 100);

    return data;
  }

  // Function to update cart counter from server
  async function updateCartCounter(){
    try {
      const res = await fetch('/api/cart/get.php', { credentials:'same-origin' });
      const data = await res.json().catch(()=>({ok:false}));
      if (data.ok && typeof data.items_count === 'number') {
        const el = document.querySelector('[data-role="cart-badge"]') || document.getElementById('cartCount');
        if (el) {
          el.textContent = String(data.items_count);
          el.classList.toggle('is-empty', data.items_count <= 0);
        }
        // Dispatch event
        try {
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: { items_count: data.items_count } }));
        } catch(_){}
      }
    } catch (err) {
      console.log('Could not update cart counter:', err);
    }
  }

  // Function to manually merge guest cart (if needed)
  async function mergeGuestCart(){
    try {
      const res = await fetch('/api/cart/merge-guest.php', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCsrfToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ csrf_token: getCsrfToken() })
      });
      const data = await res.json().catch(()=>({ok:false}));
      
      if (data.ok && data.merged_items > 0) {
        console.log(`Guest cart merged: ${data.merged_items} items`);
        // Update cart counter after merge
        await updateCartCounter();
        return data;
      }
      return data;
    } catch (err) {
      console.log('Could not merge guest cart:', err);
      return { ok: false, error: err.message };
    }
  }

  window.addToCart = addToCart;
  window.updateCartCounter = updateCartCounter;
  window.mergeGuestCart = mergeGuestCart;

  // Optional: auto-bind untuk tombol apapun yang punya data-addtocart
  document.addEventListener('click', async (e)=>{
    const btn = e.target.closest('[data-addtocart]');
    if (!btn) return;
    e.preventDefault();
    if (btn.disabled) return;

    const pid = parseInt(btn.getAttribute('data-pid')||'0',10);
    const vid = parseInt(btn.getAttribute('data-vid')||'0',10);
    const qty = parseInt(btn.getAttribute('data-qty')||'1',10) || 1;

    try {
      const data = await addToCart(pid, qty, vid);
      if (window.showToast) {
        const meta = guessPdMeta();
        window.showToast({
          type:'success',
          title:'Berhasil ditambahkan',
          message:`<strong>${esc(meta.name)}</strong>${meta.sku?` · <em>SKU: ${esc(meta.sku)}</em>`:''}<br>Qty: ${qty}`,
          duration: 3800,
          actions: [
            { label:'Lihat Keranjang', onClick: ()=> { window.location.href='/keranjang'; } },
            { label:'Lanjut Belanja', variant:'alt', onClick: ()=>{} }
          ]
        });
      }
    } catch (err) {
      if (window.showToast) {
        window.showToast({ type:'warn', title:'Gagal', message: String(err?.message||'Gagal menambahkan'), duration: 4200 });
      } else {
        console.error(err);
      }
    }
  });
})();