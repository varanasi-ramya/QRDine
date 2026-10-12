/**
 * server/routes/orderRoutes.js
 * POST  /api/order/create        — validate and issue a server-generated QR code.
 * POST  /api/order/pay           — simulate payment and emit verification token.
 * GET   /api/order/:orderId      — recover current order status after reconnect.
 * PATCH /api/order/:orderId/status — vendor updates order status (PREPARING, READY, COMPLETED).
 */

import express from 'express';
import { createOrderHandler, payOrderHandler } from '../controllers/orderController.js';
import { getOrder, updateOrderStatus } from '../store/orderStore.js';

const router = express.Router();

router.post('/create', createOrderHandler);
router.post('/pay', payOrderHandler);

// Status recovery used by the student client after a socket reconnect.
router.get('/:orderId', (req, res) => {
  const order = getOrder(req.params.orderId.trim());
  if (!order) {
    return res.status(404).json({ success: false, error: 'Unknown order id' });
  }
  res.json({
    success: true,
    orderId: order.orderId,
    status: order.status,
    totalAmount: order.totalAmount,
    verificationHash: order.verificationHash,
    paidAt: order.paidAt,
    items: order.items.map(it => ({ id: it.id, name: it.name, qty: it.qty }))
  });
});

// Update order status (e.g. PREPARING, READY, COMPLETED)
router.patch('/:orderId/status', (req, res) => {
  const { status } = req.body || {};
  const orderId = req.params.orderId.trim();
  const order = updateOrderStatus(orderId, status);
  if (!order) {
    return res.status(400).json({ success: false, error: 'Invalid order id or status' });
  }

  const payload = {
    orderId: order.orderId,
    status: order.status,
    totalAmount: order.totalAmount,
    verificationHash: order.verificationHash,
    paidAt: order.paidAt,
    items: order.items.map(it => ({ id: it.id, name: it.name, qty: it.qty }))
  };

  if (req.io) {
    req.io.to(`order_${order.orderId}`).emit('order_status_update', payload);
    req.io.to('vendor_main').emit('order_status_update', payload);
  }

  res.json({ success: true, ...payload });
});

export default router;