/**
 * SQLite Database Setup
 * Uses a single flexible "entities" table — mirrors base44's schema-less document store.
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'space-logistics.db');
const db = new Database(DB_PATH);

// Performance tuning
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS entities (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    data        TEXT NOT NULL DEFAULT '{}',
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    created_by  TEXT DEFAULT 'local'
  );

  CREATE INDEX IF NOT EXISTS idx_entity_type
    ON entities (entity_type);

  CREATE INDEX IF NOT EXISTS idx_entity_type_created
    ON entities (entity_type, created_date DESC);

  CREATE INDEX IF NOT EXISTS idx_entity_type_updated
    ON entities (entity_type, updated_date DESC);
`);

console.log(`[DB] SQLite connected: ${DB_PATH}`);
module.exports = db;