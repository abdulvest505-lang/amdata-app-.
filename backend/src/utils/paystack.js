const axios = require('axios');

const paystackApi = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

async function initializePayment({ email, amountNaira, reference, callback_url }) {
  const res = await paystackApi.post('/transaction/initialize', {
    email,
    amount: Math.round(amountNaira * 100), // Paystack expects kobo
    reference,
    callback_url,
  });
  return res.data;
}

async function verifyPayment(reference) {
  const res = await paystackApi.get(`/transaction/verify/${reference}`);
  return res.data;
}

module.exports = { initializePayment, verifyPayment };
