const mysql = require('mysql2/promise');
const { db: config } = require('./config');

const pool = mysql.createPool(config);

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function checkConnection() {
  await pool.query('SELECT 1');
}

module.exports = { pool, query, checkConnection };
