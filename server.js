import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';
import { hashPassword, checkPassword, makeToken, requireAuth } from './auth.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

/* ---------------- AUTH ---------------- */

app.post('/api/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name',
      [email.toLowerCase().trim(), hash, name]
    );
    const user = result.rows[0];
    res.json({ token: makeToken(user), user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' });
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email=$1', [email?.toLowerCase().trim()]);
  const user = result.rows[0];
  if (!user || !(await checkPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json({ token: makeToken(user), user: { id: user.id, email: user.email, name: user.name } });
});

/* ---------------- PROJECTS ---------------- */

app.get('/api/projects', requireAuth, async (req, res) => {
  const r = await pool.query('SELECT * FROM projects WHERE owner_id=$1 ORDER BY created_at DESC', [req.user.userId]);
  res.json(r.rows);
});

app.post('/api/projects', requireAuth, async (req, res) => {
  const { name } = req.body;
  const r = await pool.query(
    'INSERT INTO projects (name, owner_id) VALUES ($1,$2) RETURNING *',
    [name, req.user.userId]
  );
  res.json(r.rows[0]);
});

// Helper: confirms the logged-in user actually owns this project before letting them touch it
async function assertOwnsProject(projectId, userId) {
  const r = await pool.query('SELECT id FROM projects WHERE id=$1 AND owner_id=$2', [projectId, userId]);
  return r.rows.length > 0;
}

/* ---------------- SUBCONTRACTORS ---------------- */

app.get('/api/projects/:projectId/subcontractors', requireAuth, async (req, res) => {
  if (!(await assertOwnsProject(req.params.projectId, req.user.userId))) return res.status(403).json({ error: 'Not your project' });
  const r = await pool.query('SELECT * FROM subcontractors WHERE project_id=$1 ORDER BY name', [req.params.projectId]);
  res.json(r.rows);
});

app.post('/api/projects/:projectId/subcontractors', requireAuth, async (req, res) => {
  if (!(await assertOwnsProject(req.params.projectId, req.user.userId))) return res.status(403).json({ error: 'Not your project' });
  const r = await pool.query(
    'INSERT INTO subcontractors (project_id, name) VALUES ($1,$2) RETURNING *',
    [req.params.projectId, req.body.name]
  );
  res.json(r.rows[0]);
});

app.delete('/api/subcontractors/:id', requireAuth, async (req, res) => {
  const check = await pool.query(
    `SELECT s.id FROM subcontractors s JOIN projects p ON s.project_id=p.id WHERE s.id=$1 AND p.owner_id=$2`,
    [req.params.id, req.user.userId]
  );
  if (!check.rows.length) return res.status(403).json({ error: 'Not allowed' });
  await pool.query('DELETE FROM subcontractors WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------------- MATERIALS ---------------- */

app.get('/api/projects/:projectId/materials', requireAuth, async (req, res) => {
  if (!(await assertOwnsProject(req.params.projectId, req.user.userId))) return res.status(403).json({ error: 'Not your project' });
  const r = await pool.query(
    `SELECT m.* FROM materials m JOIN subcontractors s ON m.subcontractor_id = s.id WHERE s.project_id=$1 ORDER BY m.needed_on_site_date`,
    [req.params.projectId]
  );
  res.json(r.rows);
});

app.post('/api/subcontractors/:subId/materials', requireAuth, async (req, res) => {
  const check = await pool.query(
    `SELECT s.id FROM subcontractors s JOIN projects p ON s.project_id=p.id WHERE s.id=$1 AND p.owner_id=$2`,
    [req.params.subId, req.user.userId]
  );
  if (!check.rows.length) return res.status(403).json({ error: 'Not allowed' });
  const { name, lead_time_weeks, needed_on_site_date, notes } = req.body;
  const r = await pool.query(
    `INSERT INTO materials (subcontractor_id, name, lead_time_weeks, needed_on_site_date, notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.subId, name, lead_time_weeks || 0, needed_on_site_date, notes || '']
  );
  res.json(r.rows[0]);
});

app.put('/api/materials/:id', requireAuth, async (req, res) => {
  const check = await pool.query(
    `SELECT m.id FROM materials m JOIN subcontractors s ON m.subcontractor_id=s.id JOIN projects p ON s.project_id=p.id
     WHERE m.id=$1 AND p.owner_id=$2`,
    [req.params.id, req.user.userId]
  );
  if (!check.rows.length) return res.status(403).json({ error: 'Not allowed' });

  const { name, lead_time_weeks, needed_on_site_date, notes, ordered, ordered_date } = req.body;
  const r = await pool.query(
    `UPDATE materials SET
       name=COALESCE($1,name),
       lead_time_weeks=COALESCE($2,lead_time_weeks),
       needed_on_site_date=COALESCE($3,needed_on_site_date),
       notes=COALESCE($4,notes),
       ordered=COALESCE($5,ordered),
       ordered_date=$6,
       updated_at=NOW()
     WHERE id=$7 RETURNING *`,
    [name, lead_time_weeks, needed_on_site_date, notes, ordered, ordered_date || null, req.params.id]
  );
  res.json(r.rows[0]);
});

app.delete('/api/materials/:id', requireAuth, async (req, res) => {
  const check = await pool.query(
    `SELECT m.id FROM materials m JOIN subcontractors s ON m.subcontractor_id=s.id JOIN projects p ON s.project_id=p.id
     WHERE m.id=$1 AND p.owner_id=$2`,
    [req.params.id, req.user.userId]
  );
  if (!check.rows.length) return res.status(403).json({ error: 'Not allowed' });
  await pool.query('DELETE FROM materials WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Material Log API running on port ${PORT}`));
