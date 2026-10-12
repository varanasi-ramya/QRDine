/**
 * client/public/src/components/ReceiptCard.js
 * Displays verified receipt with unique counter token and live order status tracker.
 *
 * @param {HTMLElement} container 
 * @param {Object} data 
 * @param {Function} [onNewOrder]
 */
export function showReceiptCard(container, data, onNewOrder) {
  container.style.display = 'block';
  
  const currentStatus = data.status || 'PAID';
  const itemsList = data.items 
    ? data.items.map(i => `<li><span>${escapeHtml(i.name)}</span><strong>${i.qty}x</strong></li>`).join('') 
    : '';

  const steps = [
    { key: 'PAID', label: 'Paid', icon: '✓' },
    { key: 'PREPARING', label: 'Preparing', icon: '🍳' },
    { key: 'READY', label: 'Ready', icon: '🔔' },
    { key: 'COMPLETED', label: 'Completed', icon: '★' }
  ];

  const statusOrder = ['PENDING_PAYMENT', 'PAID', 'PREPARING', 'READY', 'COMPLETED'];
  const currentIndex = statusOrder.indexOf(currentStatus);

  const stepsHtml = steps.map(step => {
    const stepIndex = statusOrder.indexOf(step.key);
    let stepClass = '';
    if (stepIndex < currentIndex) {
      stepClass = 'completed';
    } else if (stepIndex === currentIndex) {
      stepClass = 'active';
    }
    return `
      <div class="status-step ${stepClass}">
        <div class="step-icon-circle">${step.icon}</div>
        <span>${step.label}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="receipt-box card">
      <div class="receipt-check-icon">✓</div>
      <h2 class="receipt-title">Payment Confirmed!</h2>
      <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 8px;">Show this verification code at the pick-up counter:</p>
      
      <div class="verification-badge">${escapeHtml(data.verificationHash || '—')}</div>

      <!-- Live Order Status Tracker -->
      <div class="order-status-card">
        <div class="status-header-row">
          <span class="status-title-text">Live Order Status</span>
          <span class="status-live-pill status-${currentStatus.toLowerCase()}">${formatStatusLabel(currentStatus)}</span>
        </div>
        <div class="status-steps">
          ${stepsHtml}
        </div>
      </div>
      
      <div class="receipt-details">
        <div class="receipt-row">
          <span>Order ID:</span>
          <strong>${escapeHtml(data.orderId)}</strong>
        </div>
        <div class="receipt-row">
          <span>Total Paid:</span>
          <strong>₹${Number(data.totalAmount).toFixed(2)}</strong>
        </div>
      </div>

      <ul class="receipt-items-list">
        ${itemsList}
      </ul>

      <p class="sync-status-hint">✓ Synced in real time with Vendor Kitchen Display System</p>
      
      <button id="btn-new-order" class="btn" style="margin-top: 20px;">Place Another Order</button>
    </div>
  `;

  const newOrderBtn = document.getElementById('btn-new-order');
  if (newOrderBtn && onNewOrder) {
    newOrderBtn.onclick = onNewOrder;
  }
}

function formatStatusLabel(status) {
  switch (status) {
    case 'PAID': return 'Order Placed';
    case 'PREPARING': return 'Kitchen Preparing';
    case 'READY': return 'Ready for Pickup!';
    case 'COMPLETED': return 'Completed';
    default: return status;
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}