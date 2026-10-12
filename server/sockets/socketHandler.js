/**
 * server/sockets/socketHandler.js
 * Real-time synchronization between the Student App and the Vendor KDS.
 *
 * Rooms:
 *   - order_<ORDER_ID> : private room for one student's order.
 *                        Only the owning socket may join.
 *   - vendor_main      : the vendor kitchen display screen.
 *
 * Events (server -> client):
 *   - order_status        : current order state, emitted on join for reconnect recovery.
 *   - order_status_update : status transition (PAID -> PREPARING -> READY -> COMPLETED).
 *   - payment_verified    : emitted to the order room after a successful payment.
 *   - new_order_alert     : emitted to vendor_main for every newly paid order.
 */

import { getOrder, setOwner, canAccessOrder, listPaidOrders, updateOrderStatus } from '../store/orderStore.js';

export function setupSocketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // --- Vendor joins the kitchen display room ---
    socket.on('join_vendor_room', () => {
      socket.join('vendor_main');
      console.log(`[Socket] ${socket.id} joined vendor_main`);

      // Seed the vendor screen with any orders paid while it was away.
      const seed = listPaidOrders().map(orderToAlertPayload);
      if (seed.length) {
        socket.emit('new_order_alert', seed);
      }
    });

    // --- Student joins their private order room ---
    socket.on('join_order_room', (orderId) => {
      if (typeof orderId !== 'string' || !orderId.trim()) {
        socket.emit('order_error', { error: 'Invalid order id' });
        return;
      }

      const id = orderId.trim();
      const order = getOrder(id);
      if (!order) {
        socket.emit('order_error', { error: 'Unknown order id' });
        return;
      }

      // Ownership: only the socket that placed the order may subscribe.
      // First join establishes ownership; subsequent joins by the same socket
      // are harmless. A different socket is rejected.
      if (order.ownerSocketId && order.ownerSocketId !== socket.id) {
        socket.emit('order_error', { error: 'Access denied' });
        return;
      }

      setOwner(id, socket.id);
      socket.join(`order_${id}`);
      console.log(`[Socket] ${socket.id} joined order_${id}`);

      // Reconnect recovery: send the current state so the client can resume
      // without issuing a duplicate payment.
      socket.emit('order_status', orderToStatusPayload(order));
    });

    // --- Status updates from vendor ---
    socket.on('update_order_status', ({ orderId, status }) => {
      if (!orderId || !status) return;
      const order = updateOrderStatus(orderId.trim(), status);
      if (order) {
        const payload = orderToStatusPayload(order);
        io.to(`order_${order.orderId}`).emit('order_status_update', payload);
        io.to('vendor_main').emit('order_status_update', payload);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });
}

function orderToStatusPayload(order) {
  return {
    orderId: order.orderId,
    status: order.status,
    totalAmount: order.totalAmount,
    verificationHash: order.verificationHash,
    paidAt: order.paidAt,
    items: order.items.map(it => ({ id: it.id, name: it.name, qty: it.qty }))
  };
}

function orderToAlertPayload(order) {
  return {
    orderId: order.orderId,
    status: order.status,
    verificationHash: order.verificationHash,
    items: order.items.map(it => ({ id: it.id, name: it.name, qty: it.qty })),
    totalAmount: order.totalAmount,
    paidAt: order.paidAt
  };
}

export { orderToStatusPayload, orderToAlertPayload };