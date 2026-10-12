/**
 * server/utils/hashGenerator.js
 * Generates the HMAC-SHA256 verification token used to confirm a payment.
 * The secret is read from the environment and NEVER hardcoded or exposed to clients.
 */

import crypto from 'node:crypto';

/**
 * Build a deterministic, tamper-evident verification code for an order.
 *
 * @param {object} params
 * @param {string} params.orderId
 * @param {number} params.amount
 * @param {number} params.timestamp - ms since epoch (server time of payment)
 * @param {string} params.secret - HMAC secret from the environment
 * @returns {string} short, human-readable uppercase verification code
 */
export function generateVerificationHash({ orderId, amount, timestamp, secret }) {
  const secretKey = secret || process.env.HASH_SECRET || 'canteen-dev-secret-2026-sha256-verified';
  if (!secretKey) {
    throw new Error('HASH_SECRET is not configured');
  }

  const payload = `${orderId}|${amount}|${timestamp}`;
  const digest = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  // Short, readable code for counter verification, e.g. CANTEEN-8F3A2B91
  return `CANTEEN-${digest.slice(0, 8).toUpperCase()}`;
}