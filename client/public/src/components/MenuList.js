/**
 * client/public/src/components/MenuList.js
 * Renders the active canteen menu items with stock badges, item count on the add bar,
 * and remove controls beside add.
 *
 * @param {HTMLElement} container 
 * @param {Array} items 
 * @param {Array} cart - current cart items array
 * @param {Function} onAddItem - (item) => void
 * @param {Function} onRemoveItem - (item) => void (decrease by 1)
 * @param {Function} onClearItem - (item) => void (remove entirely)
 */
export function renderMenuList(container, items, cart = [], onAddItem, onRemoveItem, onClearItem) {
  const itemCount = items ? items.length : 0;
  container.innerHTML = `
    <h2 class="section-title">
      <span>Menu Items</span>
      <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">${itemCount} items</span>
    </h2>
  `;

  if (!items || items.length === 0) {
    container.innerHTML += '<p style="color: var(--text-muted); padding: 12px 0;">No menu items currently available.</p>';
    return;
  }

  const listWrap = document.createElement('div');
  listWrap.className = 'menu-list-wrap';

  items.forEach(item => {
    const isAvailable = Boolean(item.available);
    const cartEntry = cart.find(c => c.id === item.id);
    const count = cartEntry ? cartEntry.qty : 0;

    const itemEl = document.createElement('div');
    itemEl.className = `menu-item ${!isAvailable ? 'is-unavailable' : ''}`;
    itemEl.dataset.itemId = item.id;

    // Available / Out of stock badge
    const stockBadgeHtml = isAvailable
      ? '<span class="stock-badge in-stock">● Available</span>'
      : '<span class="stock-badge out-of-stock">✕ Out of Stock</span>';

    // Actions HTML: Item count on add bar + remove option beside add
    let actionsHtml = '';
    if (!isAvailable) {
      actionsHtml = '<button class="btn btn-disabled" disabled>Out of Stock</button>';
    } else if (count === 0) {
      actionsHtml = `<button class="btn btn-add" data-id="${item.id}" aria-label="Add ${escapeHtml(item.name)} to cart">+ Add</button>`;
    } else {
      actionsHtml = `
        <div class="item-actions-wrap">
          <div class="quantity-stepper">
            <button class="btn-stepper btn-minus" title="Decrease quantity" aria-label="Decrease ${escapeHtml(item.name)}">−</button>
            <span class="stepper-count" title="Quantity in cart">${count}</span>
            <button class="btn-stepper btn-plus" title="Increase quantity" aria-label="Increase ${escapeHtml(item.name)}">+</button>
          </div>
          <button class="btn-remove-item" title="Remove from cart" aria-label="Remove ${escapeHtml(item.name)}">Remove</button>
        </div>
      `;
    }

    itemEl.innerHTML = `
      <div class="item-info">
        <div class="item-header-line">
          <span class="item-name">${escapeHtml(item.name)}</span>
          ${stockBadgeHtml}
        </div>
        ${item.description ? `<p class="item-desc">${escapeHtml(item.description)}</p>` : ''}
        <span class="item-price">₹${item.price}</span>
      </div>
      <div class="item-action-container">
        ${actionsHtml}
      </div>
    `;

    // Attach event listeners
    if (isAvailable) {
      if (count === 0) {
        const addBtn = itemEl.querySelector('.btn-add');
        if (addBtn && onAddItem) addBtn.onclick = () => onAddItem(item);
      } else {
        const plusBtn = itemEl.querySelector('.btn-plus');
        const minusBtn = itemEl.querySelector('.btn-minus');
        const removeBtn = itemEl.querySelector('.btn-remove-item');

        if (plusBtn && onAddItem) plusBtn.onclick = () => onAddItem(item);
        if (minusBtn && onRemoveItem) minusBtn.onclick = () => onRemoveItem(item);
        if (removeBtn && onClearItem) removeBtn.onclick = () => onClearItem(item);
      }
    }

    listWrap.appendChild(itemEl);
  });

  container.appendChild(listWrap);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}