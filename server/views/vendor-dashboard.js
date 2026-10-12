/**
 * server/views/vendor-dashboard.js
 * Vendor Kitchen Display System (KDS) controller.
 * Connects to the Socket.IO server, joins vendor_main, and renders
 * newly paid orders with their verification codes and status transitions.
 */

const SERVER_URL = window.location.origin;
const socket = window.io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

const statusEl = document.getElementById('status');
const ordersEl = document.getElementById('orders');
const emptyStateEl = document.getElementById('empty-state');
const errorBannerEl = document.getElementById('error-banner');

const seenOrderIds = new Set();

const logoBtn = document.querySelector('.brand-logo-btn');
if (logoBtn) {
  logoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// --- Connection status indicators ---
function setStatus(state, text) {
  statusEl.dataset.state = state;
  statusEl.querySelector('.status-text').textContent = text;
}

socket.on('connect', () => {
  setStatus('connected', 'Connected');
  errorBannerEl.hidden = true;
  socket.emit('join_vendor_room');
});

socket.on('disconnect', () => {
  setStatus('disconnected', 'Disconnected');
});

socket.on('connect_error', () => {
  setStatus('error', 'Connection error');
  errorBannerEl.hidden = false;
});

socket.on('reconnecting', (attempt) => {
  setStatus('connecting', `Reconnecting (${attempt})...`);
});

// --- Order rendering ---
socket.on('new_order_alert', (payload) => {
  const orders = Array.isArray(payload) ? payload : [payload];

  orders.forEach((order) => {
    if (!order || !order.orderId) return;
    if (seenOrderIds.has(order.orderId)) {
      updateExistingCard(order);
      return;
    }
    seenOrderIds.add(order.orderId);

    if (emptyStateEl) emptyStateEl.style.display = 'none';
    renderOrderCard(order);
  });
});

socket.on('order_status_update', (order) => {
  if (!order || !order.orderId) return;
  updateExistingCard(order);
});

function updateExistingCard(order) {
  const card = document.querySelector(`[data-order-id="${order.orderId}"]`);
  if (!card) {
    if (emptyStateEl) emptyStateEl.style.display = 'none';
    renderOrderCard(order);
    return;
  }

  const statusBadge = card.querySelector('.order-status-badge');
  if (statusBadge) {
    statusBadge.textContent = formatStatus(order.status || 'PAID');
    statusBadge.dataset.status = order.status || 'PAID';
  }

  const actionsContainer = card.querySelector('.order-actions');
  if (actionsContainer) {
    actionsContainer.innerHTML = getStatusActionButtonHtml(order.orderId, order.status || 'PAID');
    attachActionListeners(card, order.orderId);
  }
}

function renderOrderCard(order) {
  const card = document.createElement('article');
  card.className = 'order-card';
  card.dataset.orderId = order.orderId;

  const itemsHtml = (order.items || [])
    .map((it) => `<li><span>${escapeHtml(it.name)}</span><strong>${it.qty}x</strong></li>`)
    .join('');

  const time = formatTime(order.paidAt);
  const currentStatus = order.status || 'PAID';

  card.innerHTML = `
    <div class="order-head">
      <div>
        <span class="order-id">${escapeHtml(order.orderId)}</span>
        <span class="order-status-badge" data-status="${currentStatus}">${formatStatus(currentStatus)}</span>
      </div>
      <span class="order-time">${time}</span>
    </div>

    <ul class="order-items">${itemsHtml}</ul>

    <div class="order-foot">
      <span class="order-total">Total: ₹${Number(order.totalAmount).toFixed(2)}</span>
      <span class="verification-code">${escapeHtml(order.verificationHash || '—')}</span>
    </div>

    <div class="order-actions">
      ${getStatusActionButtonHtml(order.orderId, currentStatus)}
    </div>

    <p class="order-hint">Compare code with student receipt before handover.</p>
  `;

  attachActionListeners(card, order.orderId);
  ordersEl.prepend(card);
}

function getStatusActionButtonHtml(orderId, status) {
  if (status === 'PAID') {
    return `<button class="btn btn-action btn-preparing" data-action="PREPARING">🍳 Mark as Preparing</button>`;
  } else if (status === 'PREPARING') {
    return `<button class="btn btn-action btn-ready" data-action="READY">🔔 Mark Ready for Pickup</button>`;
  } else if (status === 'READY') {
    return `<button class="btn btn-action btn-completed" data-action="COMPLETED">✓ Hand Over & Complete</button>`;
  } else {
    return `<span class="completed-label">✓ Order Completed</span>`;
  }
}

function attachActionListeners(card, orderId) {
  const btn = card.querySelector('.btn-action');
  if (!btn) return;

  btn.onclick = () => {
    const nextStatus = btn.dataset.action;
    btn.disabled = true;
    socket.emit('update_order_status', { orderId, status: nextStatus });
  };
}

function formatStatus(status) {
  switch (status) {
    case 'PAID': return 'Paid';
    case 'PREPARING': return 'Preparing';
    case 'READY': return 'Ready for Pickup';
    case 'COMPLETED': return 'Completed';
    default: return status;
  }
}

// --- Helpers ---
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}