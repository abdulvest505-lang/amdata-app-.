const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { initializePayment, verifyPayment } = require('../utils/paystack');

const router = express.Router();

// GET /api/wallet -> current balance
router.get('/', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [req.user.id]);
  res.json({ balance: result.rows[0]?.balance || 0 });
});

// GET /api/wallet/transactions -> ledger history for this user
router.get('/transactions', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [req.user.id]
  );
  res.json({ transactions: result.rows });
});

// POST /api/wallet/fund -> start a Paystack payment to top up wallet
router.post('/fund', requireAuth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 100) {
    return res.status(400).json({ error: 'Adadin kudi dole ya zama akalla ₦100' });
  }

  const reference = `AMD-FUND-${uuidv4()}`;
  try {
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    const email = userResult.rows[0].email;

    const paystackRes = await initializePayment({
      email,
      amountNaira: amount,
      reference,
      callback_url: `${process.env.FRONTEND_URL}/payment-callback.html`,
    });

    await pool.query(
      `INSERT INTO paystack_payments (reference, user_id, amount, status, raw_response)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [reference, req.user.id, amount, paystackRes]
    );

    res.json({ authorization_url: paystackRes.data.authorization_url, reference });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'An kasa fara biyan kudi da Paystack' });
  }
});

// GET /api/wallet/verify/:reference -> confirm payment & credit wallet (called after Paystack redirect)
router.get('/verify/:reference', requireAuth, async (req, res) => {
  const { reference } = req.params;
  const client = await pool.connect();
  try {
    const payment = await client.query(
      'SELECT * FROM paystack_payments WHERE reference = $1 AND user_id = $2',
      [reference, req.user.id]
    );
    if (!payment.rows.length) return res.status(404).json({ error: 'Ba a samu wannan ciniki ba' });
    if (payment.rows[0].status === 'success') {
      return res.json({ status: 'already_credited' });
    }

    const verifyRes = await verifyPayment(reference);
    const paid = verifyRes.data.status === 'success';

    await client.query('BEGIN');

    if (paid) {
      const amount = payment.rows[0].amount;

      const walletRes = await client.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance',
        [amount, req.user.id]
      );
      const newBalance = walletRes.rows[0].balance;

      await client.query(
        `INSERT INTO wallet_transactions (reference, user_id, type, source, amount, balance_after, status, meta)
         VALUES ($1, $2, 'credit', 'paystack_funding', $3, $4, 'success', $5)`,
        [reference, req.user.id, amount, newBalance, verifyRes]
      );

      await client.query(
        "UPDATE paystack_payments SET status = 'success', raw_response = $1 WHERE reference = $2",
        [verifyRes, reference]
      );
    } else {
      await client.query(
        "UPDATE paystack_payments SET status = 'failed', raw_response = $1 WHERE reference = $2",
        [verifyRes, reference]
      );
    }

    await client.query('COMMIT');
    res.json({ status: paid ? 'success' : 'failed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'An kasa tabbatar da biyan kudi' });
  } finally {
    client.release();
  }
});

module.exports = router;
