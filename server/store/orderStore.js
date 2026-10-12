/**
 * server/store/orderStore.js
 * In-memory order persistence.
 *
 * Acceptable for a college Software Engineering PBL demonstration.
 * NOTE: All order data is lost when the server restarts. For production use
 * this should be replaced with a real database.
 *
 * Concurrency safety: payment transitions are performed with an atomic
 * compare-and-set on the order status, so concurrent payment requests can
 * never produce multiple PAID transitions or inconsistent state.
 */

import crypto from 'node:crypto';

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

const orders = new Map(); // keyed by orderId
const ordersBySocket = new Map(); // keyed by owner socket id -> Set of orderIds

function recordOwner(orderId, socketId) {
  if (!socketId) return;
  const set = ordersBySocket.get(socketId) ?? new Set();
  set.add(orderId);
  ordersBySocket.set(socketId, set);
}

function unrecordOwner(orderId, socketId) {
  if (!socketId) return;
  const set = ordersBySocket.get(socketId);
  if (set) {
    set.delete(orderId);
    if (set.size === 0) ordersBySocket.delete(socketId);
  }
}

function listBySocket(socketId) {
  const set = ordersBySocket.get(socketId);
  if (!set) return [];
  return [...set]
    .map(id => orders.get(id))
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Create a new order.
 * @param {{id:string, qty:number, name:string, unitPrice:number}[]} items
 * @param {string} [ownerSocketId] - set when the owning client joins the order room
 */
export function createOrder(items, ownerSocketId) {
  const orderId = `ORD_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const createdAt = Date.now();
  const order = {
    orderId,
    items,
    totalAmount: items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0),
    status: ORDER_STATUS.PENDING_PAYMENT,
    createdAt,
    paidAt: null,
    verificationHash: null,
    ownerSocketId: ownerSocketId ?? null
  };
  orders.set(orderId, order);
  recordOwner(orderId, ownerSocketId);
  return order;
}

/**
 * Atomically transition an order from PENDING_PAYMENT to PAID.
 * Returns the updated order on success, or null if the order is not in a
 * state that can be paid (unknown id, already paid, cancelled, etc.).
 *
 * @param {string} orderId
 * @param {{verificationHash:string, paidAt:number}} payment
 */
export function markPaid(orderId, { verificationHash, paidAt }) {
  const order = orders.get(orderId);
  if (!order) return null;
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) return null;

  order.status = ORDER_STATUS.PAID;
  order.verificationHash = verificationHash;
  order.paidAt = paidAt ?? Date.now();
  return order;
}

export function getOrder(orderId) {
  return orders.get(orderId) ?? null;
}

/**
 * Record the owning socket for an order. Called when the student client
 * successfully joins their private order room. This is the ownership check:
 * only the owning socket may subscribe to payment_verified for that order.
 */
export function setOwner(orderId, socketId) {
  const order = orders.get(orderId);
  if (!order) return false;
  order.ownerSocketId = socketId;
  recordOwner(orderId, socketId);
  return true;
}

/**
 * Whether the given socket is allowed to access this order's private room.
 */
export function canAccessOrder(orderId, socketId) {
  const order = orders.get(orderId);
  if (!order) return false;
  return order.ownerSocketId === socketId;
}

export function updateOrderStatus(orderId, newStatus) {
  const order = orders.get(orderId);
  if (!order) return null;
  if (!Object.values(ORDER_STATUS).includes(newStatus)) return null;
  order.status = newStatus;
  return order;
}

export function listPaidOrders() {
  return [...orders.values()]
    .filter(o => o.status !== ORDER_STATUS.PENDING_PAYMENT && o.status !== ORDER_STATUS.CANCELLED)
    .sort((a, b) => (b.paidAt || b.createdAt) - (a.paidAt || a.createdAt));
}

export function listOrdersByOwner(socketId) {
  return listBySocket(socketId);
}

export function __resetStore() {
  orders.clear();
  ordersBySocket.clear();
}

export function __storeSize() {
  return orders.size;
}