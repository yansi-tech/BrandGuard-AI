const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { db } = require('../src/config');

async function main() {
  // Connect to the server first: the schema itself creates DB_NAME when needed.
  const { database, ...serverConfig } = db;
  const connection = await mysql.createConnection({ ...serverConfig, multipleStatements: true });
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_NAME may contain only letters, numbers, and underscores.');
  const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8')
    .replace(/brandguard_ai/g, database);
  await connection.query(schema);
  await connection.end();
  console.log('BrandGuard AI database initialized with sample rules.');
}

main().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
});
