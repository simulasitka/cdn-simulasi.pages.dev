(function(){
  function esc(s){ return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }
  function getVariantSummaryText(){
    const vs = document.getElementById('pd-variant-summary');
    if (!vs) return '';
    const items = Array.from(vs.querySelectorAll('.vs-item strong')).map(el => el.textContent.trim()).filter(Boolean);
    return items.length ? items.join(' / ') : '';
  }
  window.addToCartSubmit = async function(e, productId){
    e.preventDefault();
    try {
      const form = e.target;
      const qty = parseInt(form.querySelector('[name=qty]')?.value || '1', 10) || 1;
      const variantId = parseInt(document.getElementById('pd-variant-id')?.value || '0', 10) || 0;
      await (window.addToCart ? window.addToCart(productId, qty, variantId) : Promise.reject(new Error('addToCart tidak tersedia')));

      const name = (window.PD_NAME !== undefined) ? String(window.PD_NAME) : (document.getElementById('pd-title')?.textContent || '');
      const sku  = (function(){ const el=document.getElementById('pd-sku'); return el?el.textContent.trim(): (window.PD_SKU||''); })();
      const variantText = getVariantSummaryText();

      if (window.showToast) {
        window.showToast({
          type: 'success',
          title: 'Berhasil ditambahkan ke Keranjang',
          message: `<strong>${esc(name)}</strong>${variantText?` · <em>${esc(variantText)}</em>`:''}<br>SKU: ${esc(sku)} · Qty: ${qty}`,
          duration: 5000,
          actions: [
            { label: 'Lihat Keranjang', onClick: ()=> { window.location.href = '/keranjang'; } },
            { label: 'Lanjut Belanja', variant: 'alt', onClick: ()=>{} }
          ]
        });
      }
    } catch (err) {
      if (window.showToast) {
        window.showToast({ type:'warn', title:'Gagal menambahkan', message: String(err?.message||'Terjadi kesalahan'), duration: 4500 });
      } else {
        console.error(err);
      }
    }
    return false;
  };
})();