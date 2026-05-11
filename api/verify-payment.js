// api/verify-payment.js
// Vercel serverless function — verifies Razorpay payment signature
// KEY_SECRET never leaves this function

const crypto = require('crypto');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    plan
  } = req.body;

  // Check all required fields
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required payment fields' });
  }

  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (!KEY_SECRET) {
    console.error('Missing RAZORPAY_KEY_SECRET');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // HMAC-SHA256 verification
  const body_string = `${razorpay_order_id}|${razorpay_payment_id}`;
  const generated_signature = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(body_string)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer  = Buffer.from(generated_signature);
  const recvBuffer = Buffer.from(razorpay_signature);

  const signaturesMatch =
    sigBuffer.length === recvBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, recvBuffer);

  if (!signaturesMatch) {
    console.warn('Signature mismatch', {
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id
    });
    return res.status(400).json({
      error: 'Payment verification failed.'
    });
  }

  // Payment is genuine
  return res.status(200).json({
    success:    true,
    payment_id: razorpay_payment_id,
    order_id:   razorpay_order_id,
    plan:       plan || 'unknown',
    message:    'Payment verified successfully'
  });
};
