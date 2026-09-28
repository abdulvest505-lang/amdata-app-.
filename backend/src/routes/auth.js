const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('full_name').trim().notEmpty().withMessage('Sunan cikakke ana bukata'),
    body('email').isEmail().withMessage('Imel din ba daidai ba ne'),
    body('phone').trim().isLength({ min: 10, max: 15 }).withMessage('Lambar waya ba daidai ba'),
    body('password').isLength({ min: 6 }).withMessage('Password din dole ya zama akalla haruffa 6'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { full_name, email, phone, password, admin_code } = req.body;

    try {
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR phone = $2',
        [email.toLowerCase(), phone]
      );
      if (existing.rows.length) {
        return res.status(409).json({ error: 'Imel ko lambar waya an riga an yi amfani da su' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      // Optional: creating an admin account requires the secret ADMIN_SIGNUP_CODE
      const role = admin_code && admin_code === process.env.ADMIN_SIGNUP_CODE ? 'admin' : 'user';

      const result = await pool.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, full_name, email, phone, role, created_at`,
        [full_name, email.toLowerCase(), phone, password_hash, role]
      );
      const user = result.rows[0];

      await pool.query('INSERT INTO wallets (user_id, balance) VALUES ($1, 0)', [user.id]);

      const token = signToken(user);
      res.status(201).json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'An samu matsala wajen yin rajista' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('identifier').notEmpty().withMessage('Shigar da imel ko lambar waya'),
    body('password').notEmpty().withMessage('Shigar da password'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { identifier, password } = req.body;
    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 OR phone = $1',
        [identifier.toLowerCase()]
      );
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'Ba a samu account ba' });
      if (!user.is_active) return res.status(403).json({ error: 'An dakatar da account dinka' });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Password din ba daidai ba ne' });

      const token = signToken(user);
      delete user.password_hash;
      res.json({ token, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'An samu matsala wajen shiga' });
    }
  }
);

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json({ user: result.rows[0] });
});

module.exports = router;
