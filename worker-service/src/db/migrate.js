const fs = require('fs');
const path = require('path');
const pool = require('../lib/mysql');
const logger = require('../lib/logger');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const statements = schema.split(';').map(function (s) { return s.trim(); }).filter(Boolean);

  for (let i = 0; i < statements.length; i++) {
    await pool.query(statements[i]);
  }

  logger.info('Migration complete', { statements: statements.length });
  await pool.end();
}

migrate().catch(function (err) {
  logger.error('Migration failed', { error: err.message });
  process.exit(1);
});
