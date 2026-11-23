/**
 * Space Logistics Command — Local Backend Server
 * ------------------------------------------------
 * SETUP (do this once):
 *   1. Copy this entire backend/ folder to a new top-level  server/  directory
 *   2. cd server
 *   3. npm install
 *   4. node server.js        (or: npm run dev  for auto-restart)
 *
 * The server listens on http://localhost:3001 by default.
 * Set PORT environment variable to change the port.
 *
 * FRONTEND: add  VITE_API_URL=http://localhost:3001  to your .env file
 */

const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ── Helpers ──────────────────────────────────────────────────────────────────

const parseSort = (sort = '-created_date') => {
  const desc  = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  // Only allow safe column names for ORDER BY
  const safeField = ['created_date', 'updated_date', 'id'].includes(field)
    ? field
    : 'created_date';
  return { field: safeField, desc };
};

const toRecord = (row) => ({
  id:           row.id,
  created_date: row.created_date,
  updated_date: row.updated_date,
  created_by:   row.created_by,
  ...JSON.parse(row.data),
});

const matchesQuery = (record, query) =>
  Object.entries(query).every(([k, v]) => {
    const rv = record[k];
    if (v === true  || v === false) return rv === v;
    if (v === null)                 return rv === null || rv === undefined;
    return String(rv) === String(v);
  });

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/:entity — list all
app.get('/api/:entity', (req, res) => {
  const { entity } = req.params;
  const { sort = '-created_date', limit = '200' } = req.query;
  const { field, desc } = parseSort(sort);

  const rows = db.prepare(`
    SELECT * FROM entities
    WHERE entity_type = ?
    ORDER BY ${field} ${desc ? 'DESC' : 'ASC'}
    LIMIT ?
  `).all(entity, parseInt(limit, 10));

  res.json(rows.map(toRecord));
});

// POST /api/:entity/filter — filter by query object
app.post('/api/:entity/filter', (req, res) => {
  const { entity } = req.params;
  const { sort = '-created_date', limit = '200' } = req.query;
  const { field, desc } = parseSort(sort);
  const query = req.body || {};

  const rows = db.prepare(`
    SELECT * FROM entities
    WHERE entity_type = ?
    ORDER BY ${field} ${desc ? 'DESC' : 'ASC'}
    LIMIT ?
  `).all(entity, parseInt(limit, 10));

  const filtered = rows.map(toRecord).filter((r) => matchesQuery(r, query));
  res.json(filtered);
});

// POST /api/:entity — create one
app.post('/api/:entity', (req, res) => {
  const { entity } = req.params;
  const id   = uuidv4();
  const now  = new Date().toISOString();
  const data = req.body || {};

  db.prepare(`
    INSERT INTO entities (id, entity_type, data, created_date, updated_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, entity, JSON.stringify(data), now, now, 'local');

  res.status(201).json({ id, created_date: now, updated_date: now, created_by: 'local', ...data });
});

// POST /api/:entity/bulk — bulk create
app.post('/api/:entity/bulk', (req, res) => {
  const { entity } = req.params;
  const items = Array.isArray(req.body) ? req.body : [];
  const now   = new Date().toISOString();
  const results = [];

  const insertStmt = db.prepare(`
    INSERT INTO entities (id, entity_type, data, created_date, updated_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((list) => {
    for (const data of list) {
      const id = uuidv4();
      insertStmt.run(id, entity, JSON.stringify(data), now, now, 'local');
      results.push({ id, created_date: now, updated_date: now, created_by: 'local', ...data });
    }
  });

  insertAll(items);
  res.status(201).json(results);
});

// PUT /api/:entity/:id — update (merge patch)
app.put('/api/:entity/:id', (req, res) => {
  const { entity, id } = req.params;
  const now = new Date().toISOString();

  const existing = db.prepare(
    'SELECT * FROM entities WHERE id = ? AND entity_type = ?'
  ).get(id, entity);

  if (!existing) return res.status(404).json({ error: 'Not found' });

  const merged = { ...JSON.parse(existing.data), ...req.body };
  db.prepare(
    'UPDATE entities SET data = ?, updated_date = ? WHERE id = ? AND entity_type = ?'
  ).run(JSON.stringify(merged), now, id, entity);

  res.json({
    id,
    created_date: existing.created_date,
    updated_date: now,
    created_by:   existing.created_by,
    ...merged,
  });
});

// DELETE /api/:entity/:id — delete one
app.delete('/api/:entity/:id', (req, res) => {
  const { entity, id } = req.params;
  db.prepare('DELETE FROM entities WHERE id = ? AND entity_type = ?').run(id, entity);
  res.json({ success: true });
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', port: PORT }));

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🚀  Space Logistics API Server');
  console.log(`    http://localhost:${PORT}`);
  console.log('    SQLite: space-logistics.db\n');
});