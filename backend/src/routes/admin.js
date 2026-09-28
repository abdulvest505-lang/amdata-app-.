const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/users -> list all users
router.get('/users', async (req, res) => {
  const result = await pool.query(`
    SELECT u.id, u.full_name, u.email, u.phone, u.role, u.is_active, u.created_at,
           COALESCE(w.balance, 0) AS balance
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
    ORDER BY u.created_at DESC
  `);
  res.json({ users: result.rows });
});

// PATCH /api/admin/users/:id/status -> activate/suspend a user
router.patch('/users/:id/status', async (req, res) => {
  const { is_active } = req.body;
  await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, req.params.id]);
  res.json({ ok: true });
});

// POST /api/admin/users/:id/adjust-wallet -> manually credit/debit a user's wallet
router.post('/users/:id/adjust-wallet', async (req, res) => {
  const { amount, note } = req.body; // amount can be negative to debit
  if (!amount) return res.status(400).json({ error: 'Shigar da adadin kudi' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const walletRes = await client.query(
      'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2 RETURNING balance',
      [amount, req.params.id]
    );
    const reference = `AMD-ADJ-${Date.now()}`;
    await client.query(
      `INSERT INTO wallet_transactions (reference, user_id, type, source, amount, balance_after, status, meta)
       VALUES ($1, $2, $3, 'admin_adjustment', $4, $5, 'success', $6)`,
      [reference, req.params.id, amount > 0 ? 'credit' : 'debit', Math.abs(amount), walletRes.rows[0].balance, { note, by: req.user.id }]
    );
    await client.query('COMMIT');
    res.json({ ok: true, new_balance: walletRes.rows[0].balance });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'An kasa daidaita wallet' });
  } finally {
    client.release();
  }
});

// GET /api/admin/stats -> sales & wallet statistics for the dashboard
router.get('/stats', async (req, res) => {
  const [usersCount, totalWalletBalance, salesToday, salesTotal, ordersByNetwork, recentOrders] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM users'),
    pool.query('SELECT COALESCE(SUM(balance),0) AS total FROM wallets'),
    pool.query(`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS count FROM orders
                WHERE status = 'success' AND created_at::date = CURRENT_DATE`),
    pool.query(`SELECT COALESCE(SUM(amount),0) AS total, COUNT(*)::int AS count FROM orders WHERE status = 'success'`),
    pool.query(`SELECT network, COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total
                FROM orders WHERE status = 'success' GROUP BY network`),
    pool.query(`SELECT o.*, u.full_name, u.email FROM orders o JOIN users u ON u.id = o.user_id
                ORDER BY o.created_at DESC LIMIT 20`),
  ]);

  res.json({
    users_count: usersCount.rows[0].count,
    total_wallet_balance: totalWalletBalance.rows[0].total,
    sales_today: salesToday.rows[0],
    sales_total: salesTotal.rows[0],
    orders_by_network: ordersByNetwork.rows,
    recent_orders: recentOrders.rows,
  });
});

// GET /api/admin/orders -> all orders across all users
router.get('/orders', async (req, res) => {
  const result = await pool.query(`
    SELECT o.*, u.full_name, u.email FROM orders o
    JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC LIMIT 200
  `);
  res.json({ orders: result.rows });
});

module.exports = router;
