/**
 * client/public/src/components/Cart.js
 * Renders the student's cart summary with stepper controls, removal options,
 * and total calculation.
 *
 * @param {HTMLElement} container 
 * @param {Array} cartItems 
 * @param {Function} onCheckout 
 * @param {Function} onIncrease - (item) => void
 * @param {Function} onDecrease - (item) => void
 * @param {Function} onRemove - (item) => void
 */
export function renderCart(container, cartItems, onCheckout, onIncrease, onDecrease, onRemove) {
  const totalItemCount = cartItems ? cartItems.reduce((sum, it) => sum + it.qty, 0) : 0;
  
  container.innerHTML = `
    <h2 class="section-title">
      <span>Your Cart</span>
      <span style="font-size: 13px; font-weight: 600; color: var(--primary-color);">
        ${totalItemCount} ${totalItemCount === 1 ? 'item' : 'items'}
      </span>
    </h2>
  `;

  if (!cartItems || cartItems.length === 0) {
    container.innerHTML += `
      <div style="text-align: center; padding: 36px 12px; color: var(--text-muted);">
        <p style="font-size: 32px; margin-bottom: 8px;">🛒</p>
        <p style="font-weight: 700; font-size: 15px; color: var(--text-color);">Your cart is empty</p>
        <p style="font-size: 13px; margin-top: 4px; color: var(--text-muted);">
          Add items from the menu to start your order.
        </p>
      </div>
    `;
    return;
  }

  let totalAmount = 0;
  const itemsList = document.createElement('div');
  itemsList.className = 'cart-items-list';

  cartItems.forEach(item => {
    const itemSubtotal = item.price * item.qty;
    totalAmount += itemSubtotal;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-details">
        <span class="cart-item-name">${escapeHtml(item.name)}</span>
        <span class="cart-item-unit-price">₹${item.price} each</span>
      </div>
      <div class="cart-item-controls">
        <div class="quantity-stepper small">
          <button class="btn-stepper btn-cart-minus" title="Decrease" aria-label="Decrease ${escapeHtml(item.name)}">−</button>
          <span class="stepper-count">${item.qty}</span>
          <button class="btn-stepper btn-cart-plus" title="Increase" aria-label="Increase ${escapeHtml(item.name)}">+</button>
        </div>
        <span class="cart-item-subtotal">₹${itemSubtotal}</span>
        <button class="btn-cart-remove" title="Remove ${escapeHtml(item.name)}" aria-label="Remove item">×</button>
      </div>
    `;

    const plusBtn = row.querySelector('.btn-cart-plus');
    const minusBtn = row.querySelector('.btn-cart-minus');
    const removeBtn = row.querySelector('.btn-cart-remove');

    if (plusBtn && onIncrease) plusBtn.onclick = () => onIncrease(item);
    if (minusBtn && onDecrease) minusBtn.onclick = () => onDecrease(item);
    if (removeBtn && onRemove) removeBtn.onclick = () => onRemove(item);

    itemsList.appendChild(row);
  });

  container.appendChild(itemsList);

  const totalEl = document.createElement('div');
  totalEl.className = 'cart-total';
  totalEl.innerHTML = `
    <span>Total Amount:</span>
    <span class="total-value">₹${totalAmount}</span>
  `;
  container.appendChild(totalEl);

  const checkoutBtn = document.createElement('button');
  checkoutBtn.id = 'checkout-btn';
  checkoutBtn.className = 'btn btn-checkout';
  checkoutBtn.innerText = 'Generate Payment QR';
  checkoutBtn.onclick = onCheckout;

  container.appendChild(checkoutBtn);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}