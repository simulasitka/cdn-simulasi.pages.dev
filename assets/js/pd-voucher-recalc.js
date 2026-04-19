/**
 * Product Detail - Voucher Discount Recalculation
 * 
 * Handles dynamic voucher discount recalculation when variant price changes
 * Supports both PERCENTAGE and FIXED_AMOUNT voucher types
 */

(function() {
  'use strict';

  /**
   * Calculate voucher discount based on type and price
   * 
   * @param {string} type - Voucher type: 'PERCENTAGE' or 'FIXED_AMOUNT'
   * @param {number} value - Voucher value (percentage or fixed amount)
   * @param {number} price - Current variant price
   * @param {number} maxDiscount - Maximum discount for percentage vouchers (0 = no limit)
   * @return {number} Calculated discount amount
   */
  function calculateVoucherDiscount(type, value, price, maxDiscount) {
    if (type === 'PERCENTAGE') {
      // Calculate percentage discount
      let discount = (price * value) / 100;
      
      // Apply max discount cap if set
      if (maxDiscount > 0 && discount > maxDiscount) {
        discount = maxDiscount;
      }
      
      return Math.round(discount);
    } else {
      // FIXED_AMOUNT - discount doesn't change with price
      return Math.round(value);
    }
  }

  /**
   * Format number as Rupiah without 'Rp' prefix
   * 
   * @param {number} num - Number to format
   * @return {string} Formatted number (e.g., "20.000")
   */
  function formatNumber(num) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Update voucher button discount label
   * 
   * @param {number} newPrice - New variant price
   */
  function updateVoucherDiscount(newPrice) {
    const voucherBtn = document.getElementById('btn-buy-voucher');
    if (!voucherBtn) return;

    // Get voucher data from button attributes
    const voucherType = voucherBtn.dataset.voucherType;
    const voucherValue = parseFloat(voucherBtn.dataset.voucherValue) || 0;
    const voucherMax = parseFloat(voucherBtn.dataset.voucherMax) || 0;

    if (!voucherType || voucherValue === 0) return;

    // Calculate new discount
    const newDiscount = calculateVoucherDiscount(voucherType, voucherValue, newPrice, voucherMax);

    // Update the discount label
    const saveLabel = voucherBtn.querySelector('.bv-save');
    if (saveLabel) {
      saveLabel.textContent = '-Rp' + formatNumber(newDiscount);
    }

    // Also update mobile FAB voucher display if exists
    updateMobileFabVoucher(newDiscount);
  }

  /**
   * Update mobile FAB voucher value
   * 
   * @param {number} discountAmount - New discount amount
   */
  function updateMobileFabVoucher(discountAmount) {
    const fab = document.getElementById('pd-mobile-fab');
    if (fab) {
      fab.dataset.voucherValue = discountAmount.toString();
    }
  }

  /**
   * Listen to variant change events and recalculate discount
   */
  function initVoucherRecalculation() {
    window.addEventListener('pd-variant-changed', function(e) {
      const detail = e.detail || {};
      const newPrice = detail.price || 0;

      if (newPrice > 0) {
        updateVoucherDiscount(newPrice);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoucherRecalculation);
  } else {
    initVoucherRecalculation();
  }

})();