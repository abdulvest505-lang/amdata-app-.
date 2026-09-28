const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getDataVariations, purchaseData } = require('../utils/vtpass');

const router = express.Router();

// GET /api/data/plans/:network -> list available data bundles + prices from VTpass
router.get('/plans/:network', requireAuth, async (req, res) => {
  try {
    const data = await getDataVariations(req.params.network);
    res.json(data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'An kasa daukar jerin data plans' });
  }
});

// POST /api/data/purchase
// body: { network, phone, variation_code, amount }
router.post('/purchase', requireAuth, async (req, res) => {
  const { network, phone, variation_code, amount } = req.body;
  if (!network || !phone || !variation_code || !amount) {
    return res.status(400).json({ error: 'Cikakkun bayanai ana bukata: network, phone, variation_code, amount' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the wallet row so two purchases can't race each other into a negative balance
    const walletRes = await client.query(
      'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
      [req.user.id]
    );
    const balance = Number(walletRes.rows[0].balance);
    if (balance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ba ka da isasshen kudi a wallet dinka' });
    }

    const reference = `AMD-ORD-${uuidv4()}`;
    const request_id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Debit first (reserve funds), then call VTpass
    const newBalanceRes = await client.query(
      'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance',
      [amount, req.user.id]
    );
    const newBalance = newBalanceRes.rows[0].balance;

    await client.query(
      `INSERT INTO wallet_transactions (reference, user_id, type, source, amount, balance_after, status)
       VALUES ($1, $2, 'debit', 'data_purchase', $3, $4, 'success')`,
      [reference, req.user.id, amount, newBalance]
    );

    const orderInsert = await client.query(
      `INSERT INTO orders (reference, user_id, network, service_type, variation_code, phone, amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [reference, req.user.id, network, `${network}-data`, variation_code, phone, amount]
    );

    await client.query('COMMIT');

    // Call VTpass outside the DB transaction
    let vtRes;
    try {
      vtRes = await purchaseData({ network, phone, variation_code, amount, request_id });
    } catch (vtErr) {
      vtRes = { error: true, message: vtErr.response?.data || vtErr.message };
    }

    const success = vtRes?.code === '000'; // VTpass success code
    await pool.query(
      'UPDATE orders SET status = $1, vtpass_response = $2 WHERE reference = $3',
      [success ? 'success' : 'failed', vtRes, reference]
    );

    // If VTpass failed, refund the user automatically
    if (!success) {
      const refundRes = await pool.query(
        'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance',
        [amount, req.user.id]
      );
      await pool.query(
        `INSERT INTO wallet_transactions (reference, user_id, type, source, amount, balance_after, status)
         VALUES ($1, $2, 'credit', 'refund', $3, $4, 'success')`,
        [`${reference}-REFUND`, req.user.id, amount, refundRes.rows[0].balance]
      );
    }

    res.json({ order: orderInsert.rows[0], success, vtpass: vtRes });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'An kasa kammala sayen data' });
  } finally {
    client.release();
  }
});

// GET /api/data/orders -> this user's purchase history
router.get('/orders', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [req.user.id]
  );
  res.json({ orders: result.rows });
});

module.exports = router;
