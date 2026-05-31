export const SHIPPING_METHODS = [
  { id: 'pickup',  label: 'Pick Up From Office' },
  { id: 'courier', label: 'Courier Delivery' },
  { id: 'post',    label: 'Post Office Delivery' },
];

export const calcShipping = (method, weightKg) => {
  if (method === 'pickup') return 0;

  if (method === 'courier') {
    if (weightKg < 1) return 200;
    if (weightKg === 1) return 350;
    return 350 + Math.ceil(weightKg - 1) * 50;
  }

  if (method === 'post') {
    if (weightKg < 1) return 300;
    if (weightKg === 1) return 450;
    return 450 + Math.ceil(weightKg - 1) * 50;
  }

  return 0;
};

export const calcTotalWeightKg = (items) =>
  items.reduce((sum, i) => sum + ((i.product?.weight || 0) / 1000) * i.quantity, 0);