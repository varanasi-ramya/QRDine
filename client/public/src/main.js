import { fetchMenu, createOrder, triggerPayment } from './api.js';
import { socket, joinOrderSession } from './socket.js';
import { renderMenuList } from './components/MenuList.js';
import { renderCart } from './components/Cart.js';
import { showPaymentModal, hidePaymentModal } from './components/PaymentModal.js';
import { showReceiptCard } from './components/ReceiptCard.js';

// Application State
let menuItems = [];
let cart = [];
let currentOrderId = null;
let latestOrderData = null;

// DOM Selectors
const mainLayout = document.getElementById('main-layout');
const menuContainer = document.getElementById('menu-container');
const cartContainer = document.getElementById('cart-container');
const modalOverlay = document.getElementById('payment-modal-overlay');
const paymentModal = document.getElementById('payment-modal');
const receiptContainer = document.getElementById('receipt-container');
const statusPill = document.getElementById('connection-status');

/**
 * Initialize application
 */
async function init() {
  if (menuContainer) {
    menuContainer.innerHTML = '<p class="loading-state">Loading delicious canteen menu...</p>';
  }

  const menuResponse = await fetchMenu();
  
  if (menuResponse && menuResponse.success && Array.isArray(menuResponse.menu)) {
    menuItems = menuResponse.menu;
    updateViews();
  } else {
    const errorDetails = menuResponse?.error || 'Unable to reach backend server.';
    if (menuContainer) {
      menuContainer.innerHTML = `
        <div class="error-box">
          <p style="color: #ef4444; font-weight: 700; font-size: 15px;">Unable to connect to server</p>
          <p style="color: var(--text-muted); font-size: 13px; margin: 6px 0 12px 0;">
            ${escapeHtml(errorDetails)}
          </p>
          <button id="retry-menu-btn" class="btn btn-secondary" style="width: auto; padding: 7px 18px;">
            Retry Connection
          </button>
        </div>
      `;
      const retryBtn = document.getElementById('retry-menu-btn');
      if (retryBtn) {
        retryBtn.onclick = () => init();
      }
    }
    renderCart(cartContainer, cart, handleCheckout, handleAddToCart, handleRemoveFromCart, handleClearFromCart);
  }

  const logoBtn = document.querySelector('.brand-logo-btn');
  if (logoBtn) {
    logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (receiptContainer && receiptContainer.style.display !== 'none') {
        handleNewOrder();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  setupSocketListeners();
}

/**
 * Rerender both Menu and Cart components so counters stay synchronized
 */
function updateViews() {
  if (menuItems.length > 0) {
    renderMenuList(
      menuContainer,
      menuItems,
      cart,
      handleAddToCart,
      handleRemoveFromCart,
      handleClearFromCart
    );
  }
  renderCart(
    cartContainer,
    cart,
    handleCheckout,
    handleAddToCart,
    handleRemoveFromCart,
    handleClearFromCart
  );
}

/**
 * Add / Increment item in cart
 */
function handleAddToCart(item) {
  const existing = cart.find(c => c.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  }
  updateViews();
}

/**
 * Decrease quantity of item in cart (removes if qty drops to 0)
 */
function handleRemoveFromCart(item) {
  const existing = cart.find(c => c.id === item.id);
  if (!existing) return;
  existing.qty -= 1;
  if (existing.qty <= 0) {
    cart = cart.filter(c => c.id !== item.id);
  }
  updateViews();
}

/**
 * Remove an item completely from the cart
 */
function handleClearFromCart(item) {
  cart = cart.filter(c => c.id !== item.id);
  updateViews();
}

/**
 * Handle checkout button click
 */
async function handleCheckout() {
  if (cart.length === 0) return;

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.innerText = 'Generating QR...';
  }

  try {
    const orderPayload = cart.map(item => ({ id: item.id, qty: item.qty }));
    const res = await createOrder(orderPayload);

    if (res && res.success && res.orderId) {
      currentOrderId = res.orderId;

      // Join dedicated socket room for this order
      joinOrderSession(currentOrderId);

      // Show Payment QR Modal
      showPaymentModal(
        modalOverlay,
        paymentModal,
        res.qrDataUrl,
        res.totalAmount,
        async () => {
          // Trigger simulated payment
          const payRes = await triggerPayment(currentOrderId);
          if (!payRes || !payRes.success) {
            throw new Error(payRes?.error || 'Payment failed');
          }
        }
      );
    } else {
      alert(res?.error || 'Failed to initialize order. Please verify that the server is running.');
    }
  } catch (err) {
    console.error('Checkout error:', err);
    alert('Checkout failed: ' + err.message);
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.innerText = 'Generate Payment QR';
    }
  }
}

/**
 * Handle resetting state for a new order
 */
function handleNewOrder() {
  cart = [];
  currentOrderId = null;
  latestOrderData = null;
  if (receiptContainer) receiptContainer.style.display = 'none';
  if (mainLayout) mainLayout.style.display = 'grid';
  updateViews();
}

/**
 * Setup global Socket.IO event listeners
 */
function setupSocketListeners() {
  if (!socket) return;

  if (socket.connected && statusPill) {
    statusPill.textContent = 'Connected';
    statusPill.className = 'status-pill status-connected';
  }

  socket.on('connect', () => {
    console.log('[Socket] Connected to backend server');
    if (statusPill) {
      statusPill.textContent = 'Connected';
      statusPill.className = 'status-pill status-connected';
    }
    if (currentOrderId) {
      joinOrderSession(currentOrderId);
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from backend server');
    if (statusPill) {
      statusPill.textContent = 'Disconnected';
      statusPill.className = 'status-pill status-disconnected';
    }
  });

  socket.on('connect_error', () => {
    if (statusPill) {
      statusPill.textContent = 'Server Offline';
      statusPill.className = 'status-pill status-disconnected';
    }
  });

  // Successful payment confirmation
  socket.on('payment_verified', (data) => {
    console.log('[Socket] Payment verified:', data);
    latestOrderData = data;
    hidePaymentModal(modalOverlay);
    if (mainLayout) mainLayout.style.display = 'none';

    showReceiptCard(receiptContainer, data, handleNewOrder);
  });

  // Live order status updates (PREPARING -> READY -> COMPLETED)
  socket.on('order_status_update', (data) => {
    console.log('[Socket] Order status update received:', data);
    if (currentOrderId && data.orderId === currentOrderId) {
      latestOrderData = { ...(latestOrderData || {}), ...data };
      if (receiptContainer && receiptContainer.style.display !== 'none') {
        showReceiptCard(receiptContainer, latestOrderData, handleNewOrder);
      }
    }
  });

  // Reconnection recovery
  socket.on('order_status', (data) => {
    if (data && data.status !== 'PENDING_PAYMENT') {
      currentOrderId = data.orderId;
      latestOrderData = data;
      hidePaymentModal(modalOverlay);
      if (mainLayout) mainLayout.style.display = 'none';
      showReceiptCard(receiptContainer, data, handleNewOrder);
    }
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Boot application
init();