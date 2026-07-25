// Shared promo discount calculation — no DB or socket dependencies
const calcDiscount = (promo, orderTotal) => {
  let discount = 0;
  if (promo.discountType === 'PERCENTAGE') {
    discount = (orderTotal * Number(promo.discountValue)) / 100;
    if (promo.maxDiscount) {
      discount = Math.min(discount, Number(promo.maxDiscount));
    }
  } else {
    // FLAT
    discount = Number(promo.discountValue);
  }
  // Discount cannot exceed order total
  return Math.min(discount, orderTotal);
};

module.exports = { calcDiscount };
