const db = require('../db');

const VALID_TYPES = ['guideline', 'preferred', 'prohibited', 'fact'];

async function listRules() {
  return db.query('SELECT * FROM brand_rules ORDER BY rule_type, created_at DESC');
}

async function createRule({ ruleType, title, content }) {
  if (!VALID_TYPES.includes(ruleType)) throw new Error('Invalid rule type.');
  if (!title?.trim() || !content?.trim()) throw new Error('A rule title and content are required.');
  const result = await db.query(
    'INSERT INTO brand_rules (rule_type, title, content) VALUES (?, ?, ?)',
    [ruleType, title.trim(), content.trim()]
  );
  const rows = await db.query('SELECT * FROM brand_rules WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function deleteRule(id) {
  const result = await db.query('DELETE FROM brand_rules WHERE id = ?', [id]);
  if (!result.affectedRows) throw new Error('Rule not found.');
}

module.exports = { listRules, createRule, deleteRule, VALID_TYPES };
