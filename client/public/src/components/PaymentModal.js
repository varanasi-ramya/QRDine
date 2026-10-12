/**
 * client/public/src/components/PaymentModal.js
 * Displays payment QR code modal overlay with simulation trigger
 * @param {HTMLElement} overlayEl 
 * @param {HTMLElement} modalEl 
 * @param {string} qrDataUrl 
 * @param {number} amount 
 * @param {Function} onSimulatePay 
 * @param {Function} onClose 
 */
export function showPaymentModal(overlayEl, modalEl, qrDataUrl, amount, onSimulatePay, onClose) {
  modalEl.className = 'modal-content card';
  modalEl.innerHTML = `
    <h2>Scan to Pay</h2>
    <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">Total Amount: <strong style="color: var(--text-color);">₹${amount}</strong></p>
    <div class="qr-wrap">
      <img src="${qrDataUrl}" alt="Payment QR Code" class="qr-image" />
    </div>
    <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Scan with UPI or tap below to simulate student payment:</p>
    <button id="sim-pay-btn" class="btn">Simulate Payment Success</button>
    <button id="close-modal-btn" class="btn btn-secondary">Cancel</button>
  `;

  overlayEl.style.display = 'flex';

  const payBtn = document.getElementById('sim-pay-btn');
  payBtn.onclick = async () => {
    payBtn.disabled = true;
    payBtn.innerText = 'Verifying Payment...';
    try {
      await onSimulatePay();
    } catch (err) {
      payBtn.disabled = false;
      payBtn.innerText = 'Simulate Payment Success';
      alert('Payment simulation failed: ' + (err.message || 'Unknown error'));
    }
  };

  document.getElementById('close-modal-btn').onclick = () => {
    overlayEl.style.display = 'none';
    if (onClose) onClose();
  };
}

export function hidePaymentModal(overlayEl) {
  overlayEl.style.display = 'none';
}