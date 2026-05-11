// api/create-order.js
// Vercel serverless function — creates a Razorpay order server-side
// KEY_SECRET never touches the browser

const https = require('https');

const PLAN_AMOUNTS = {
  starter: 9900,   // ₹99 in paise
  pro:     24900,  // ₹249 in paise
  power:   49900   // ₹499 in paise
};

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan } = req.body;

  // Validate plan
  if (!plan || !PLAN_AMOUNTS[plan]) {
    return res.status(400).json({
      error: 'Invalid plan. Must be starter, pro, or power.'
    });
  }

  const amount = PLAN_AMOUNTS[plan];

  const KEY_ID     = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_ID || !KEY_SECRET) {
    console.error('Missing Razorpay env vars');
    return res.status(500).json({ error: 'Payment configuration error' });
  }

  const payload = JSON.stringify({
    amount,
    currency: 'INR',
    receipt: `receipt_${plan}_${Date.now()}`,
    notes: { plan }
  });

  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');

  try {
    const order = await new Promise((resolve, reject) => {
      const req2 = https.request(
        {
          hostname: 'api.razorpay.com',
          path: '/v1/orders',
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (response.statusCode === 200) {
                resolve(parsed);
              } else {
                reject(new Error(parsed.error?.description || `Razorpay error ${response.statusCode}`));
              }
            } catch {
              reject(new Error('Failed to parse Razorpay response'));
            }
          });
        }
      );
      req2.on('error', reject);
      req2.write(payload);
      req2.end();
    });

    return res.status(200).json({
      order_id: order.id,
      amount:   order.amount,
      currency: order.currency,
      plan
    });

  } catch (err) {
    console.error('Create order error:', err.message);
    return res.status(500).json({
      error: 'Failed to create order. Please try again.'
    });
  }
};
