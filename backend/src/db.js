const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Creates all tables if they don't already exist. Safe to run on every boot.
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' or 'admin'
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      balance NUMERIC(14,2) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id)
    );

    -- Every wallet movement (funding, purchase debit, refund) is logged here.
    -- This is the ledger: balance in wallets table should always equal the sum of this table.
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(100) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL, -- 'credit' or 'debit'
      source VARCHAR(30) NOT NULL, -- 'paystack_funding', 'data_purchase', 'admin_adjustment', 'refund'
      amount NUMERIC(14,2) NOT NULL,
      balance_after NUMERIC(14,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'success', -- 'pending','success','failed'
      meta JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Data/airtime purchase orders sent to VTpass
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(100) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      network VARCHAR(20) NOT NULL, -- mtn, airtel, glo, 9mobile
      service_type VARCHAR(30) NOT NULL, -- e.g. mtn-data, airtel-data...
      variation_code VARCHAR(50),
      phone VARCHAR(20) NOT NULL,
      amount NUMERIC(14,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, success, failed
      vtpass_response JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS paystack_payments (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(100) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(14,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      raw_response JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  `);
  console.log('Database ready ✅');
}

module.exports = { pool, initDb };
